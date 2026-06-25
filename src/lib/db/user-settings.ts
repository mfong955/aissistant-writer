import { getAdminClient } from "@/lib/supabase/admin";
import type { UserSettings } from "@/types/database";

export async function dbGetUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await getAdminClient()
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data as UserSettings;
}

export async function dbUpsertUserSettings(
  userId: string,
  updates: Partial<Pick<UserSettings, "openrouter_api_key_encrypted" | "preferred_model_id" | "settings">>
): Promise<void> {
  if (Object.keys(updates).length === 0) return;
  await getAdminClient()
    .from("user_settings")
    .upsert(
      { user_id: userId, ...updates, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
}
