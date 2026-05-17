import { getDb } from "./database";
import type { EntitySummary } from "@/types/database";

function now() {
  return new Date().toISOString();
}

function rowToSummary(row: Record<string, unknown>): EntitySummary {
  return {
    id: row.id as string,
    entity_id: row.entity_id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    summary: row.summary as string,
    version_hash: (row.version_hash as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function dbGetEntitySummaries(projectId: string): EntitySummary[] {
  const rows = getDb()
    .prepare("SELECT * FROM entity_summaries WHERE project_id = ?")
    .all(projectId) as Record<string, unknown>[];
  return rows.map(rowToSummary);
}

export function dbGetEntitySummary(entityId: string): EntitySummary | null {
  const row = getDb()
    .prepare("SELECT * FROM entity_summaries WHERE entity_id = ?")
    .get(entityId) as Record<string, unknown> | undefined;
  return row ? rowToSummary(row) : null;
}

export function dbUpsertEntitySummary(params: {
  entityId: string;
  projectId: string;
  userId: string;
  summary: string;
  versionHash: string;
}): void {
  const db = getDb();
  const ts = now();
  const existing = db
    .prepare("SELECT id FROM entity_summaries WHERE entity_id = ?")
    .get(params.entityId) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      "UPDATE entity_summaries SET summary = ?, version_hash = ?, updated_at = ? WHERE entity_id = ?"
    ).run(params.summary, params.versionHash, ts, params.entityId);
  } else {
    db.prepare(
      `INSERT INTO entity_summaries
       (id, entity_id, project_id, user_id, summary, version_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      params.entityId,
      params.projectId,
      params.userId,
      params.summary,
      params.versionHash,
      ts,
      ts
    );
  }
}
