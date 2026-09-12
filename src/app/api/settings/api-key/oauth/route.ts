import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { encryptApiKey } from "@/lib/encryption";
import { dbUpsertUserSettings } from "@/lib/db/user-settings";

/**
 * Server-side half of OpenRouter's OAuth PKCE flow (docs/byok-oauth.md). The client already
 * did the redirect-out/redirect-back dance; this just exchanges the resulting code for a real
 * API key and stores it through the exact same path a manually-pasted key uses.
 */
export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;

  const { code, code_verifier } = await request.json();
  if (!code || typeof code !== "string" || !code_verifier || typeof code_verifier !== "string") {
    return NextResponse.json({ error: "Missing code or code_verifier" }, { status: 400 });
  }

  try {
    const exchangeRes = await fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier, code_challenge_method: "S256" }),
    });

    if (!exchangeRes.ok) {
      const errBody = await exchangeRes.text().catch(() => "");
      return NextResponse.json(
        { error: `OpenRouter rejected the exchange: ${errBody || exchangeRes.statusText}` },
        { status: 502 }
      );
    }

    const { key } = (await exchangeRes.json()) as { key?: string };
    if (!key) {
      return NextResponse.json({ error: "OpenRouter did not return a key" }, { status: 502 });
    }

    const encrypted = await encryptApiKey(key);
    await dbUpsertUserSettings(userId, { openrouter_api_key_encrypted: encrypted });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to connect OpenRouter account";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
