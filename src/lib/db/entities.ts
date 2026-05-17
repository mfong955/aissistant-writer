import { getDb } from "./database";
import type { Entity, EntityType, ProjectType } from "@/types/database";
import { textToTiptapJson, extractTextFromTiptap } from "@/lib/tiptap-utils";

const DEFAULT_FOLDERS: Record<NonNullable<ProjectType>, string[]> = {
  novel: ["Characters", "Settings", "Chapters", "Outlines", "Notes"],
  short_story: ["Characters", "Settings", "Drafts", "Notes"],
  non_fiction: ["Chapters", "Research", "Outlines", "Notes"],
  textbook: ["Units", "Exercises", "Glossary", "Notes"],
  screenplay: ["Characters", "Acts", "Scenes", "Notes"],
  poetry: ["Poems", "Collections", "Notes"],
  game_narrative: ["Characters", "Lore", "Quests", "Dialogue", "Notes"],
  other: [],
};

export function initProjectFolders(projectId: string, userId: string, projectType: ProjectType | null): string[] {
  if (!projectType || !DEFAULT_FOLDERS[projectType]?.length) return [];
  const db = getDb();
  const existing = db
    .prepare("SELECT name FROM entities WHERE project_id = ? AND type = 'folder' AND parent_id IS NULL")
    .all(projectId) as { name: string }[];
  const existingNames = new Set(existing.map((r) => r.name));

  const created: string[] = [];
  const ts = now();
  for (const folderName of DEFAULT_FOLDERS[projectType]) {
    if (existingNames.has(folderName)) continue;
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO entities (id, project_id, user_id, parent_id, type, name, content, properties, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 'folder', ?, NULL, '{}', 0, ?, ?)`
    ).run(id, projectId, userId, folderName, ts, ts);
    created.push(folderName);
  }
  return created;
}

function now() {
  return new Date().toISOString();
}

function rowToEntity(row: Record<string, unknown>): Entity {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    parent_id: (row.parent_id as string | null) ?? null,
    type: row.type as EntityType,
    name: row.name as string,
    content: row.content ? (JSON.parse(row.content as string) as Record<string, unknown>) : null,
    properties: JSON.parse((row.properties as string) || "{}") as Record<string, unknown>,
    sort_order: row.sort_order as number,
    version_hash: (row.version_hash as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function dbGetEntities(projectId: string): Entity[] {
  const rows = getDb()
    .prepare("SELECT * FROM entities WHERE project_id = ? ORDER BY sort_order ASC")
    .all(projectId) as Record<string, unknown>[];
  return rows.map(rowToEntity);
}

export function dbGetEntity(id: string, projectId: string): Entity | null {
  const row = getDb()
    .prepare("SELECT * FROM entities WHERE id = ? AND project_id = ?")
    .get(id, projectId) as Record<string, unknown> | undefined;
  return row ? rowToEntity(row) : null;
}

export function dbCreateEntity(params: {
  projectId: string;
  userId: string;
  name: string;
  type: EntityType;
  parentId?: string | null;
  content?: Record<string, unknown> | null;
}): Entity {
  const db = getDb();

  const siblingRow = db
    .prepare(
      "SELECT MAX(sort_order) as max_sort FROM entities WHERE project_id = ? AND parent_id IS ?"
    )
    .get(params.projectId, params.parentId ?? null) as { max_sort: number | null } | undefined;

  const sortOrder = siblingRow?.max_sort != null ? siblingRow.max_sort + 1 : 0;
  const id = crypto.randomUUID();
  const ts = now();

  db.prepare(
    `INSERT INTO entities
     (id, project_id, user_id, parent_id, type, name, content, properties, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?)`
  ).run(
    id,
    params.projectId,
    params.userId,
    params.parentId ?? null,
    params.type,
    params.name,
    params.content ? JSON.stringify(params.content) : null,
    sortOrder,
    ts,
    ts
  );

  return dbGetEntity(id, params.projectId)!;
}

export function dbUpdateEntity(
  id: string,
  projectId: string,
  updates: Partial<Pick<Entity, "name" | "content" | "properties" | "sort_order" | "parent_id" | "version_hash">>
): Entity | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name); }
  if (updates.content !== undefined) { fields.push("content = ?"); values.push(updates.content ? JSON.stringify(updates.content) : null); }
  if (updates.properties !== undefined) { fields.push("properties = ?"); values.push(JSON.stringify(updates.properties)); }
  if (updates.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(updates.sort_order); }
  if (updates.parent_id !== undefined) { fields.push("parent_id = ?"); values.push(updates.parent_id); }
  if (updates.version_hash !== undefined) { fields.push("version_hash = ?"); values.push(updates.version_hash); }
  if (fields.length === 0) return dbGetEntity(id, projectId);

  fields.push("updated_at = ?");
  values.push(now(), id, projectId);

  db.prepare(`UPDATE entities SET ${fields.join(", ")} WHERE id = ? AND project_id = ?`).run(...values);
  return dbGetEntity(id, projectId);
}

export function dbDeleteEntity(id: string, projectId: string): void {
  getDb().prepare("DELETE FROM entities WHERE id = ? AND project_id = ?").run(id, projectId);
}

const INSTRUCTIONS_DEFAULT = `This is your project's AI Instructions file.
The AI reads this before every response — treat it like a project-specific AGENTS.md.

Add any rules that should guide the AI for this project:

Tone & genre: describe the mood, genre, and any stylistic conventions.
Character voice: how should specific characters speak and behave?
Naming conventions: any rules for place names, magic systems, terminology?
Things to avoid: tropes, phrases, or approaches that don't fit this project.
Story rules: world-building constraints the AI must respect.`;

export function ensureInstructionsEntity(projectId: string, userId: string, initialContent?: string | null): Entity {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM entities WHERE project_id = ? AND name = 'AI Instructions' AND parent_id IS NULL")
    .get(projectId) as Record<string, unknown> | undefined;
  if (existing) return rowToEntity(existing);

  const id = crypto.randomUUID();
  const ts = now();
  const text = initialContent?.trim() || INSTRUCTIONS_DEFAULT;
  const content = textToTiptapJson(text);
  db.prepare(
    `INSERT INTO entities (id, project_id, user_id, parent_id, type, name, content, properties, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 'note', 'AI Instructions', ?, '{"_reserved":"instructions"}', -1, ?, ?)`
  ).run(id, projectId, userId, JSON.stringify(content), ts, ts);
  return dbGetEntity(id, projectId)!;
}

export function ensureLogsFolder(projectId: string, userId: string): Entity {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM entities WHERE project_id = ? AND name = 'Logs' AND type = 'folder' AND parent_id IS NULL")
    .get(projectId) as Record<string, unknown> | undefined;
  if (existing) return rowToEntity(existing);

  const id = crypto.randomUUID();
  const ts = now();
  db.prepare(
    `INSERT INTO entities (id, project_id, user_id, parent_id, type, name, content, properties, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 'folder', 'Logs', NULL, '{"_reserved":"logs_folder"}', 998, ?, ?)`
  ).run(id, projectId, userId, ts, ts);
  return dbGetEntity(id, projectId)!;
}

export function appendToSessionLog(projectId: string, userId: string, entry: string): void {
  const db = getDb();

  // Ensure Logs folder exists
  const folder = ensureLogsFolder(projectId, userId);
  const folderId = folder.id;

  const today = new Date().toISOString().split("T")[0]!;
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const logLine = `[${time}] ${entry}`;

  const existingLog = db
    .prepare("SELECT * FROM entities WHERE project_id = ? AND parent_id = ? AND name = ?")
    .get(projectId, folderId, today) as Record<string, unknown> | undefined;

  const ts = now();
  if (existingLog) {
    const currentText = existingLog.content
      ? extractTextFromTiptap(JSON.parse(existingLog.content as string))
      : "";
    const newText = currentText ? `${currentText}\n\n${logLine}` : logLine;
    db.prepare("UPDATE entities SET content = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(textToTiptapJson(newText)), ts, existingLog.id);
  } else {
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO entities (id, project_id, user_id, parent_id, type, name, content, properties, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'note', ?, ?, '{"_reserved":"session_log"}', 0, ?, ?)`
    ).run(id, projectId, userId, folderId, today, JSON.stringify(textToTiptapJson(logLine)), ts, ts);
  }
}
