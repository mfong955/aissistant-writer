import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripe, getCreditPack } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase/admin";
import { dbAddCredits } from "@/lib/db/billing";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      payment_status: string;
      client_reference_id: string | null;
      metadata: Record<string, string> | null;
      payment_intent: string | null;
    };

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

    // Idempotency check: if this payment_intent_id was already processed, skip silently.
    // The unique index on credit_transactions(stripe_payment_intent_id) is the hard guard;
    // this check avoids a noisy constraint violation log on retries.
    if (paymentIntentId) {
      const supabase = getAdminClient();
      const { data: existing } = await supabase
        .from("credit_transactions")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .limit(1) as unknown as { data: { id: string }[] | null };

      if (existing && existing.length > 0) {
        console.log(`Webhook: payment_intent ${paymentIntentId} already processed, skipping`);
        return NextResponse.json({ received: true });
      }
    }

    const userId = session.client_reference_id ?? session.metadata?.userId;
    const packId = session.metadata?.packId;

    if (!userId || !packId) {
      console.error("Webhook: missing userId or packId in session metadata");
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const pack = getCreditPack(packId);
    if (!pack) {
      console.error(`Webhook: unknown packId "${packId}"`);
      return NextResponse.json({ error: "Unknown pack" }, { status: 400 });
    }

    try {
      await dbAddCredits(userId, pack.credits, {
        description: `Purchased ${pack.name} (${pack.credits} credits)`,
        stripePaymentIntentId: paymentIntentId ?? undefined,
      });
      console.log(`Webhook: added ${pack.credits} credits to user ${userId}`);
    } catch (err) {
      console.error("Webhook: failed to add credits", err);
      // Return 500 so Stripe retries — the idempotency check above will catch the retry
      return NextResponse.json({ error: "Failed to process payment" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
