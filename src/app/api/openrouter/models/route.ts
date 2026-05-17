import { NextResponse } from "next/server";
import { getLocalUserId } from "@/lib/local-user";
import { decryptApiKey } from "@/lib/encryption";
import { listModels } from "@/lib/openrouter/client";
import { dbGetUserSettings } from "@/lib/db/user-settings";

const modelCache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  const userId = getLocalUserId();

  const cached = modelCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const settings = dbGetUserSettings(userId);
  if (!settings?.openrouter_api_key_encrypted) {
    return NextResponse.json({ error: "No API key configured" }, { status: 400 });
  }

  try {
    const apiKey = await decryptApiKey(settings.openrouter_api_key_encrypted);
    const models = await listModels(apiKey);

    const chatModels = models
      .filter((m) => m.context_length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    const result = { models: chatModels };
    modelCache.set(userId, { data: result, expires: Date.now() + CACHE_TTL });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch models" },
      { status: 500 }
    );
  }
}
