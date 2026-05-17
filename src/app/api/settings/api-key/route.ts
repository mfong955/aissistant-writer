import { NextResponse } from "next/server";
import { getLocalUserId } from "@/lib/local-user";
import { encryptApiKey } from "@/lib/encryption";
import { dbUpsertUserSettings, dbGetUserSettings } from "@/lib/db/user-settings";

export async function GET() {
  const userId = getLocalUserId();
  const settings = dbGetUserSettings(userId);
  return NextResponse.json({
    hasKey: !!settings?.openrouter_api_key_encrypted,
    preferredModelId: settings?.preferred_model_id ?? null,
  });
}

export async function POST(request: Request) {
  const userId = getLocalUserId();
  const { apiKey } = await request.json();

  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const encrypted = await encryptApiKey(apiKey);
  dbUpsertUserSettings(userId, { openrouter_api_key_encrypted: encrypted });
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const userId = getLocalUserId();
  dbUpsertUserSettings(userId, { openrouter_api_key_encrypted: null });
  return NextResponse.json({ success: true });
}
