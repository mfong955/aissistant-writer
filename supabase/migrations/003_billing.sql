-- Billing tables: credits wallet and transaction ledger

CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,         -- positive = purchase/bonus, negative = consumption
  type TEXT NOT NULL CHECK (type IN ('purchase', 'consumption', 'bonus', 'refund')),
  description TEXT,
  stripe_payment_intent_id TEXT,   -- populated on purchases
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_id_idx ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_created_at_idx ON credit_transactions(created_at DESC);

-- Idempotency guard: prevents duplicate credit grants if Stripe retries the webhook
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_payment_intent_unique
  ON credit_transactions(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- RLS: service role bypasses; anon/authenticated clients cannot touch these tables
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_client_access ON user_credits FOR ALL TO authenticated USING (false);
CREATE POLICY no_client_access ON credit_transactions FOR ALL TO authenticated USING (false);

-- Atomic credit addition: updates balance AND logs the transaction in one round-trip.
-- The unique index on stripe_payment_intent_id makes this naturally idempotent for purchases.
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_credits (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = user_credits.balance + p_amount, updated_at = now();

  INSERT INTO credit_transactions (user_id, amount, type, description, stripe_payment_intent_id)
  VALUES (
    p_user_id,
    p_amount,
    'purchase',
    COALESCE(p_description, 'Purchased ' || p_amount || ' credits'),
    p_stripe_payment_intent_id
  );
END;
$$;

-- Atomic credit deduction: updates balance and inserts transaction in one round-trip.
-- Returns TRUE if a credit was deducted, FALSE if balance was already 0.
CREATE OR REPLACE FUNCTION deduct_credit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE user_credits
  SET balance = balance - 1, updated_at = now()
  WHERE user_id = p_user_id AND balance >= 1;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 1 THEN
    INSERT INTO credit_transactions (user_id, amount, type, description)
    VALUES (p_user_id, -1, 'consumption', 'AI message');
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;
