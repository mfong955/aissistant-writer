import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptApiKey } from "@/lib/encryption";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiKey } = await request.json();
  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const encrypted = await encryptApiKey(apiKey);

  // Upsert user settings
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      openrouter_api_key_encrypted: encrypted,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("user_settings")
    .update({ openrouter_api_key_encrypted: null })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
