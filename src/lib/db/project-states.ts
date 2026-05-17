import { getDb } from "./database";
import type { ProjectState } from "@/types/database";

function now() {
  return new Date().toISOString();
}

function rowToState(row: Record<string, unknown>): ProjectState {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    state_content: row.state_content as string,
    entity_hashes: row.entity_hashes
      ? (JSON.parse(row.entity_hashes as string) as Record<string, string>)
      : null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function dbGetProjectState(projectId: string): ProjectState | null {
  const row = getDb()
    .prepare("SELECT * FROM project_states WHERE project_id = ?")
    .get(projectId) as Record<string, unknown> | undefined;
  return row ? rowToState(row) : null;
}

export function dbUpsertProjectState(params: {
  projectId: string;
  userId: string;
  stateContent: string;
  entityHashes: Record<string, string>;
}): void {
  const db = getDb();
  const ts = now();
  const existing = db
    .prepare("SELECT id FROM project_states WHERE project_id = ?")
    .get(params.projectId) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      "UPDATE project_states SET state_content = ?, entity_hashes = ?, updated_at = ? WHERE project_id = ?"
    ).run(params.stateContent, JSON.stringify(params.entityHashes), ts, params.projectId);
  } else {
    db.prepare(
      `INSERT INTO project_states
       (id, project_id, user_id, state_content, entity_hashes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      params.projectId,
      params.userId,
      params.stateContent,
      JSON.stringify(params.entityHashes),
      ts,
      ts
    );
  }
}
