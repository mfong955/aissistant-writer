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

// Deducts usage-proportional credits after an AI call completes and returns the
// resulting balance. The balance may go negative — the cost is already incurred by the
// time this runs, so refusing here would mean absorbing it. MIN_BALANCE_TO_START keeps
// the shortfall to at most one message's worth.
export async function dbDeductCredits(
  userId: string,
  amount: number,
  description?: string
): Promise<number> {
  if (amount <= 0) return dbGetCredits(userId);

  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_description: description ?? null,
  }) as unknown as { data: number; error: { message: string } | null };

  if (error) throw new Error(`Failed to deduct credits: ${error.message}`);
  return data;
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
