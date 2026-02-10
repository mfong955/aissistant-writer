// Simple token estimation using character count.
// Average English text is approximately 4 characters per token.
// This is a heuristic — not exact, but fast and good enough for budget management.

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateTokensForMessages(
  messages: Array<{ role: string; content: string | null }>
): number {
  let total = 0;
  for (const msg of messages) {
    // Each message has overhead (~4 tokens for role, formatting)
    total += 4;
    if (msg.content) {
      total += estimateTokens(msg.content);
    }
  }
  return total;
}
