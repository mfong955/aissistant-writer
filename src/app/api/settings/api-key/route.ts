import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { encryptApiKey } from "@/lib/encryption";
import { dbUpsertUserSettings, dbGetUserSettings } from "@/lib/db/user-settings";

export async function GET() {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const settings = await dbGetUserSettings(userIdOrError);
  return NextResponse.json({
    hasKey: !!settings?.openrouter_api_key_encrypted,
    preferredModelId: settings?.preferred_model_id ?? null,
  });
}

export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { apiKey } = await request.json();

  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  try {
    const encrypted = await encryptApiKey(apiKey);
    await dbUpsertUserSettings(userId, { openrouter_api_key_encrypted: encrypted });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save API key";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  await dbUpsertUserSettings(userIdOrError, { openrouter_api_key_encrypted: null });
  return NextResponse.json({ success: true });
}
