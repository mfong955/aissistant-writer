import { getDb } from "./database";
import type { Session } from "@/types/database";

function now() {
  return new Date().toISOString();
}

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    started_at: row.started_at as string,
    ended_at: (row.ended_at as string | null) ?? null,
    duration_seconds: (row.duration_seconds as number | null) ?? null,
    entities_viewed: JSON.parse((row.entities_viewed as string) || "[]") as string[],
    entities_edited: JSON.parse((row.entities_edited as string) || "[]") as string[],
    summary: (row.summary as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export function dbStartSession(projectId: string, userId: string): Session {
  const db = getDb();
  const ts = now();

  // Close any open sessions first
  db.prepare(
    "UPDATE sessions SET ended_at = ? WHERE project_id = ? AND user_id = ? AND ended_at IS NULL"
  ).run(ts, projectId, userId);

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO sessions
     (id, project_id, user_id, started_at, entities_viewed, entities_edited, created_at)
     VALUES (?, ?, ?, ?, '[]', '[]', ?)`
  ).run(id, projectId, userId, ts, ts);

  return rowToSession(
    db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Record<string, unknown>
  );
}

export function dbEndSession(
  id: string,
  userId: string
): { durationSeconds: number } | null {
  const db = getDb();
  const session = db
    .prepare("SELECT started_at FROM sessions WHERE id = ? AND user_id = ?")
    .get(id, userId) as { started_at: string } | undefined;

  if (!session) return null;

  const endedAt = now();
  const durationSeconds = Math.round(
    (new Date(endedAt).getTime() - new Date(session.started_at).getTime()) / 1000
  );

  db.prepare(
    "UPDATE sessions SET ended_at = ?, duration_seconds = ? WHERE id = ? AND user_id = ?"
  ).run(endedAt, durationSeconds, id, userId);

  return { durationSeconds };
}

export function dbUpdateSessionActivity(
  id: string,
  userId: string,
  entitiesViewed: string[],
  entitiesEdited: string[]
): void {
  getDb()
    .prepare(
      "UPDATE sessions SET entities_viewed = ?, entities_edited = ? WHERE id = ? AND user_id = ?"
    )
    .run(JSON.stringify(entitiesViewed), JSON.stringify(entitiesEdited), id, userId);
}

export function dbGetSessionHistory(
  projectId: string,
  userId: string,
  limit = 20
): Session[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM sessions WHERE project_id = ? AND user_id = ? ORDER BY started_at DESC LIMIT ?"
    )
    .all(projectId, userId, limit) as Record<string, unknown>[];
  return rows.map(rowToSession);
}
