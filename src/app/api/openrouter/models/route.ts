import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import { listModels } from "@/lib/openrouter/client";

// Cache models per user for 5 minutes
const modelCache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check cache
  const cached = modelCache.get(user.id);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  // Get API key
  const { data: settings } = await supabase
    .from("user_settings")
    .select("openrouter_api_key_encrypted")
    .eq("user_id", user.id)
    .single();

  if (!settings?.openrouter_api_key_encrypted) {
    return NextResponse.json(
      { error: "No API key configured" },
      { status: 400 }
    );
  }

  try {
    const apiKey = await decryptApiKey(settings.openrouter_api_key_encrypted);
    const models = await listModels(apiKey);

    // Filter to chat-capable models and sort by name
    const chatModels = models
      .filter((m) => m.context_length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    const result = { models: chatModels };
    modelCache.set(user.id, { data: result, expires: Date.now() + CACHE_TTL });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch models" },
      { status: 500 }
    );
  }
}
