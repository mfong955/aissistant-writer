import { getDb } from "./database";
import type { Project, ProjectType } from "@/types/database";

function now() {
  return new Date().toISOString();
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    project_type: (row.project_type as ProjectType | null) ?? null,
    system_instructions: (row.system_instructions as string | null) ?? null,
    settings: JSON.parse((row.settings as string) || "{}") as Record<string, unknown>,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function dbGetProjects(userId: string): Project[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId) as Record<string, unknown>[];
  return rows.map(rowToProject);
}

export function dbGetProject(id: string, userId: string): Project | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?")
    .get(id, userId) as Record<string, unknown> | undefined;
  return row ? rowToProject(row) : null;
}

export function dbCreateProject(
  userId: string,
  name: string,
  description?: string | null,
  projectType?: ProjectType | null
): Project {
  const db = getDb();
  const id = crypto.randomUUID();
  const ts = now();
  db.prepare(
    "INSERT INTO projects (id, user_id, name, description, project_type, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?)"
  ).run(id, userId, name, description ?? null, projectType ?? null, ts, ts);
  return dbGetProject(id, userId)!;
}

export function dbUpdateProject(
  id: string,
  userId: string,
  updates: Partial<Pick<Project, "name" | "description" | "project_type" | "system_instructions" | "settings">>
): Project | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push("description = ?"); values.push(updates.description); }
  if (updates.project_type !== undefined) { fields.push("project_type = ?"); values.push(updates.project_type); }
  if (updates.system_instructions !== undefined) { fields.push("system_instructions = ?"); values.push(updates.system_instructions); }
  if (updates.settings !== undefined) { fields.push("settings = ?"); values.push(JSON.stringify(updates.settings)); }
  if (fields.length === 0) return dbGetProject(id, userId);

  fields.push("updated_at = ?");
  values.push(now(), id, userId);

  db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`).run(...values);
  return dbGetProject(id, userId);
}

export function dbDeleteProject(id: string, userId: string): void {
  getDb().prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(id, userId);
}
