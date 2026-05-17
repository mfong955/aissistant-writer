import { getDb } from "./database";
import type { ChangeLog, ChangeAction, ChangeActor } from "@/types/database";

function now() {
  return new Date().toISOString();
}

function rowToChangeLog(row: Record<string, unknown>): ChangeLog {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    entity_id: (row.entity_id as string | null) ?? null,
    action: row.action as ChangeAction,
    actor: row.actor as ChangeActor,
    description: row.description as string,
    old_version_hash: (row.old_version_hash as string | null) ?? null,
    new_version_hash: (row.new_version_hash as string | null) ?? null,
    metadata: row.metadata
      ? (JSON.parse(row.metadata as string) as Record<string, unknown>)
      : null,
    created_at: row.created_at as string,
  };
}

export function dbCreateChangeLog(params: {
  projectId: string;
  userId: string;
  entityId?: string | null;
  action: ChangeAction;
  actor: ChangeActor;
  description: string;
  oldVersionHash?: string | null;
  newVersionHash?: string | null;
  metadata?: Record<string, unknown>;
}): ChangeLog {
  const db = getDb();
  const id = crypto.randomUUID();
  const ts = now();

  db.prepare(
    `INSERT INTO change_logs
     (id, project_id, user_id, entity_id, action, actor, description,
      old_version_hash, new_version_hash, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.projectId,
    params.userId,
    params.entityId ?? null,
    params.action,
    params.actor,
    params.description,
    params.oldVersionHash ?? null,
    params.newVersionHash ?? null,
    params.metadata ? JSON.stringify(params.metadata) : null,
    ts
  );

  return rowToChangeLog(
    db.prepare("SELECT * FROM change_logs WHERE id = ?").get(id) as Record<string, unknown>
  );
}

export function dbGetChangeLogs(
  projectId: string,
  options?: { entityId?: string; limit?: number; offset?: number }
): ChangeLog[] {
  const db = getDb();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let sql = "SELECT * FROM change_logs WHERE project_id = ?";
  const args: unknown[] = [projectId];

  if (options?.entityId) {
    sql += " AND entity_id = ?";
    args.push(options.entityId);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  args.push(limit, offset);

  const rows = db.prepare(sql).all(...args) as Record<string, unknown>[];
  return rows.map(rowToChangeLog);
}
