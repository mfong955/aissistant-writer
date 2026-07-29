// Credit math — single source of truth for the credits (non-BYOK) path.
//
// Credits are denominated in tenths of a cent: 1 credit = $0.001 of account balance.
// A $5 purchase grants 5000 credits. Usage is deducted at OpenRouter's actual reported
// cost for the generation, plus MARKUP.
//
// Users on their own OpenRouter key (BYOK) never touch any of this — they pay their
// provider directly and nothing here applies to them.

/** 1 credit = $0.001, so 1000 credits = $1.00 of account balance. */
export const CREDITS_PER_USD = 1000;

/**
 * Applied to OpenRouter's reported cost. Covers Stripe (2.9% + $0.30 per charge, which
 * is ~8.9% of a $5 top-up) and OpenRouter's own fee on credit purchases. This is a
 * break-even figure, not a profit margin, and it is stated plainly in the purchase UI.
 */
export const MARKUP = 1.2;

/**
 * A request on the credits path will not start below this balance.
 *
 * Deduction happens *after* a response completes, because the actual cost isn't known
 * until then. This floor is what keeps a balance from going deeply negative when a
 * single expensive message lands on a nearly-empty account.
 */
export const MIN_BALANCE_TO_START = 250; // $0.25

/**
 * Circuit breaker for a single user message.
 *
 * This is NOT a limit on response length — a generation already in flight is never
 * truncated, and `max_tokens` is deliberately left unset so prose can run long. This
 * ceiling only prevents an *additional* round-trip from being started after tool calls,
 * which is the one place a single message can multiply its own cost.
 */
export const MAX_COST_PER_MESSAGE_USD = 1.0;

/** Converts an OpenRouter cost in USD into credits to deduct, markup included. */
export function usdToCredits(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.ceil(usd * MARKUP * CREDITS_PER_USD);
}

/** Converts a credit balance into the dollar figure shown to the user. */
export function creditsToUsd(credits: number): number {
  return credits / CREDITS_PER_USD;
}

/** Formats a credit balance for display, e.g. 4317 -> "$4.32". */
export function formatCredits(credits: number): string {
  return `$${creditsToUsd(credits).toFixed(2)}`;
}
