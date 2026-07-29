-- Usage-proportional credit deduction.
--
-- Replaces deduct_credit(), which removed exactly 1 credit per message regardless of
-- model or context size. With 300+ OpenRouter models and a large injected context, a
-- frontier model on a big project could cost several dollars against a single credit.
--
-- Credits are now denominated in tenths of a cent: 1 credit = $0.001 of account balance.
-- See src/lib/billing/credits.ts for the conversion and markup.

DROP FUNCTION IF EXISTS deduct_credit(UUID);

-- Deducts an arbitrary credit amount and logs the transaction in one round-trip.
-- Returns the resulting balance.
--
-- The balance is permitted to go negative. Deduction runs *after* the AI call completes,
-- because the actual cost is not known until OpenRouter reports it, so refusing at this
-- point would mean absorbing a cost already incurred. MIN_BALANCE_TO_START in the API
-- routes is what keeps any shortfall small.
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    SELECT balance INTO v_balance FROM user_credits WHERE user_id = p_user_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  INSERT INTO user_credits (user_id, balance)
  VALUES (p_user_id, -p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = user_credits.balance - p_amount, updated_at = now()
  RETURNING balance INTO v_balance;

  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (p_user_id, -p_amount, 'consumption', COALESCE(p_description, 'AI usage'));

  RETURN v_balance;
END;
$$;
