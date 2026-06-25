import { getAdminClient } from "@/lib/supabase/admin";

export async function dbGetCredits(userId: string): Promise<number> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .single() as unknown as { data: { balance: number } | null; error: { code: string } | null };

  // PGRST116 = no row found — user has never purchased, balance is 0
  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch credit balance: ${JSON.stringify(error)}`);
  }
  return data?.balance ?? 0;
}

// Atomically adds credits and logs the transaction in one DB round-trip.
// The unique index on stripe_payment_intent_id makes this idempotent for purchases.
export async function dbAddCredits(
  userId: string,
  amount: number,
  opts: { description?: string; stripePaymentIntentId?: string } = {}
): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.rpc("add_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_description: opts.description ?? null,
    p_stripe_payment_intent_id: opts.stripePaymentIntentId ?? null,
  }) as unknown as { error: { message: string } | null };

  if (error) throw new Error(`Failed to add credits: ${error.message}`);
}

// Returns true if a credit was deducted, false if balance was 0.
export async function dbDeductCredit(userId: string): Promise<boolean> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("deduct_credit", {
    p_user_id: userId,
  }) as unknown as { data: boolean; error: { message: string } | null };

  if (error) throw new Error(`Failed to deduct credit: ${error.message}`);
  return data === true;
}

export type CreditTransaction = {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
};

export async function dbGetCreditTransactions(userId: string): Promise<CreditTransaction[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("id, amount, type, description, stripe_payment_intent_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50) as unknown as { data: CreditTransaction[] | null; error: { message: string } | null };

  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);
  return data ?? [];
}
