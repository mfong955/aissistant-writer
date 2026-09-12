// Client-side PKCE for OpenRouter's OAuth connect flow (docs/byok-oauth.md). Runs entirely in
// the browser — the verifier only ever needs to survive the redirect-out/redirect-back round
// trip in the same tab, so sessionStorage is sufficient; no server-side session state needed.

const VERIFIER_STORAGE_KEY = "openrouter_oauth_code_verifier";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return new Uint8Array(digest);
}

/** Generates a verifier, stashes it in sessionStorage, and redirects to OpenRouter's auth page. */
export async function startOpenRouterConnect(): Promise<void> {
  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = base64UrlEncode(await sha256(verifier));
  sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);

  const callbackUrl = `${window.location.origin}/openrouter/callback`;
  const authUrl = new URL("https://openrouter.ai/auth");
  authUrl.searchParams.set("callback_url", callbackUrl);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("key_label", "Smartaiss");
  window.location.href = authUrl.toString();
}

/** Reads (and clears) the verifier stashed by startOpenRouterConnect. Null if it's missing —
 *  e.g. the callback opened in a different browser/tab than the one that started the flow. */
export function consumeStoredVerifier(): string | null {
  const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY);
  return verifier;
}
