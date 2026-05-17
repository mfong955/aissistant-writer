import { getDb } from "./database";
import type { UserSettings } from "@/types/database";

function now() {
  return new Date().toISOString();
}

function rowToSettings(row: Record<string, unknown>): UserSettings {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    openrouter_api_key_encrypted: (row.openrouter_api_key_encrypted as string | null) ?? null,
    preferred_model_id: (row.preferred_model_id as string | null) ?? null,
    settings: JSON.parse((row.settings as string) || "{}") as Record<string, unknown>,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function dbGetUserSettings(userId: string): UserSettings | null {
  const row = getDb()
    .prepare("SELECT * FROM user_settings WHERE user_id = ?")
    .get(userId) as Record<string, unknown> | undefined;
  return row ? rowToSettings(row) : null;
}

export function dbUpsertUserSettings(
  userId: string,
  updates: Partial<Pick<UserSettings, "openrouter_api_key_encrypted" | "preferred_model_id" | "settings">>
): void {
  const db = getDb();
  const ts = now();
  const existing = db
    .prepare("SELECT id FROM user_settings WHERE user_id = ?")
    .get(userId) as { id: string } | undefined;

  if (existing) {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.openrouter_api_key_encrypted !== undefined) {
      fields.push("openrouter_api_key_encrypted = ?");
      values.push(updates.openrouter_api_key_encrypted);
    }
    if (updates.preferred_model_id !== undefined) {
      fields.push("preferred_model_id = ?");
      values.push(updates.preferred_model_id);
    }
    if (updates.settings !== undefined) {
      fields.push("settings = ?");
      values.push(JSON.stringify(updates.settings));
    }
    if (fields.length === 0) return;

    fields.push("updated_at = ?");
    values.push(ts, userId);

    db.prepare(`UPDATE user_settings SET ${fields.join(", ")} WHERE user_id = ?`).run(...values);
  } else {
    db.prepare(
      `INSERT INTO user_settings
       (id, user_id, openrouter_api_key_encrypted, preferred_model_id, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      userId,
      updates.openrouter_api_key_encrypted ?? null,
      updates.preferred_model_id ?? null,
      JSON.stringify(updates.settings ?? {}),
      ts,
      ts
    );
  }
}
