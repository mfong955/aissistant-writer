import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { getStripe, getCreditPack } from "@/lib/stripe";
import { creditsEnabled } from "@/lib/billing/credits";

export async function POST(request: Request) {
  if (!creditsEnabled()) {
    return NextResponse.json({ error: "Credits are not enabled on this deployment" }, { status: 400 });
  }

  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;

  const { packId } = await request.json() as { packId: string };
  const pack = getCreditPack(packId);
  if (!pack) {
    return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: userId,
    metadata: {
      userId,
      packId: pack.id,
      credits: String(pack.credits),
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.priceCents,
          product_data: {
            name: `Smartaiss — ${pack.name}`,
            description: pack.description,
          },
        },
      },
    ],
    success_url: `${origin}/settings?billing=success&pack=${pack.id}`,
    cancel_url: `${origin}/settings?billing=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
