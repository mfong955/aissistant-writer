import { getAdminClient } from "@/lib/supabase/admin";
import type { Entity, EntityType, ProjectType } from "@/types/database";
import { textToTiptapJson, extractTextFromTiptap, replaceTextInTiptapDoc } from "@/lib/tiptap-utils";
import { PROJECT_TEMPLATES, getTemplatesForType } from "@/lib/templates";
import { EXPLORER_ROOTS, reservedRootTag, type ExplorerRootKey } from "@/lib/entity-roots";

/**
 * Ensures a single fixed explorer root (Canon / Manuscript / Unsorted) exists for a project.
 * Idempotent by name+type, matching the ensure* pattern used for Progress/Instructions/Logs
 * below. Roots are ordinary `folder` entities tagged via `properties._reserved` — enforced
 * at the application layer, not the schema (docs/onboarding-workflows.md §1).
 */
export async function ensureExplorerRoot(
  projectId: string,
  userId: string,
  key: ExplorerRootKey
): Promise<Entity> {
  const config = EXPLORER_ROOTS.find((r) => r.key === key)!;
  const supabase = getAdminClient();
  const { data: existing } = await supabase
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .eq("name", config.name)
    .eq("type", "folder")
    .is("parent_id", null)
    .single();

  if (existing) return existing as Entity;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("entities")
    .insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      user_id: userId,
      parent_id: null,
      type: "folder",
      name: config.name,
      content: null,
      properties: { _reserved: reservedRootTag(key) },
      sort_order: config.sortOrder,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Entity;
}

/** Seeds the project-type skeleton (per src/lib/templates.ts) inside the given roots. Idempotent. */
async function seedProjectTemplateFolders(
  projectId: string,
  userId: string,
  projectType: ProjectType | null,
  roots: Record<ExplorerRootKey, Entity>
): Promise<void> {
  const template = projectType ? PROJECT_TEMPLATES[projectType] : null;
  if (!template?.folders.length) return;

  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("entities")
    .select("name, parent_id")
    .eq("project_id", projectId)
    .eq("type", "folder") as unknown as { data: { name: string; parent_id: string | null }[] | null; error: null };

  const existingByParent = new Set(
    (existing ?? []).map((r) => `${r.parent_id ?? ""}:${r.name}`)
  );

  for (let i = 0; i < template.folders.length; i++) {
    const folderConfig = template.folders[i];
    const rootId = roots[folderConfig.root].id;
    if (existingByParent.has(`${rootId}:${folderConfig.name}`)) continue;

    const folderId = crypto.randomUUID();
    await supabase.from("entities").insert({
      id: folderId,
      project_id: projectId,
      user_id: userId,
      parent_id: rootId,
      type: "folder",
      name: folderConfig.name,
      content: null,
      properties: {},
      sort_order: i,
      created_at: now,
      updated_at: now,
    });

    // Seed content entities inside this folder
    for (let j = 0; j < folderConfig.seeds.length; j++) {
      const seed = folderConfig.seeds[j];
      let content: Record<string, unknown> | null = null;
      if (seed.templateKey) {
        const tpl = getTemplatesForType(seed.templateKey)[0];
        if (tpl) content = textToTiptapJson(tpl.markdown);
      }
      await supabase.from("entities").insert({
        id: crypto.randomUUID(),
        project_id: projectId,
        user_id: userId,
        parent_id: folderId,
        type: seed.type,
        name: seed.name,
        content,
        properties: {},
        sort_order: j,
        created_at: now,
        updated_at: now,
      });
    }
  }
}

/**
 * Ensures Canon, Manuscript, and Unsorted exist for a project, and seeds the project-type
 * Canon skeleton. Every project creation/access path must call this — see
 * docs/onboarding-workflows.md §1.
 */
export async function ensureExplorerRoots(
  projectId: string,
  userId: string,
  projectType: ProjectType | null
): Promise<Record<ExplorerRootKey, Entity>> {
  const [canon, manuscript, unsorted] = await Promise.all([
    ensureExplorerRoot(projectId, userId, "canon"),
    ensureExplorerRoot(projectId, userId, "manuscript"),
    ensureExplorerRoot(projectId, userId, "unsorted"),
  ]);
  const roots: Record<ExplorerRootKey, Entity> = { canon, manuscript, unsorted };
  await seedProjectTemplateFolders(projectId, userId, projectType, roots);
  return roots;
}

/**
 * Resolves (creating as needed) the folder a new AI-authored entity should be placed in,
 * given a fixed root and an optional slash-separated path inside it. Used by the
 * create_entity tool so the model can only ever write inside Canon/Manuscript/Unsorted.
 */
export async function resolveEntityParent(
  projectId: string,
  userId: string,
  root: ExplorerRootKey,
  path?: string | null
): Promise<string> {
  const rootEntity = await ensureExplorerRoot(projectId, userId, root);
  const segments = (path ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  const supabase = getAdminClient();
  let parentId = rootEntity.id;
  const now = new Date().toISOString();

  for (const segment of segments) {
    const { data: existing } = await supabase
      .from("entities")
      .select("id")
      .eq("project_id", projectId)
      .eq("parent_id", parentId)
      .eq("type", "folder")
      .eq("name", segment)
      .single() as unknown as { data: { id: string } | null; error: null };

    if (existing) {
      parentId = existing.id;
      continue;
    }

    const folderId = crypto.randomUUID();
    await supabase.from("entities").insert({
      id: folderId,
      project_id: projectId,
      user_id: userId,
      parent_id: parentId,
      type: "folder",
      name: segment,
      content: null,
      properties: {},
      sort_order: 0,
      created_at: now,
      updated_at: now,
    });
    parentId = folderId;
  }

  return parentId;
}

export async function dbGetEntities(projectId: string): Promise<Entity[]> {
  const { data, error } = await getAdminClient()
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Entity[];
}

export async function dbGetEntity(id: string, projectId: string): Promise<Entity | null> {
  const { data, error } = await getAdminClient()
    .from("entities")
    .select("*")
    .eq("id", id)
    .eq("project_id", projectId)
    .single();
  if (error) return null;
  return data as Entity;
}

export async function dbCreateEntity(params: {
  projectId: string;
  userId: string;
  name: string;
  type: EntityType;
  parentId?: string | null;
  content?: Record<string, unknown> | null;
}): Promise<Entity> {
  const supabase = getAdminClient();

  const siblingsQuery = supabase
    .from("entities")
    .select("sort_order")
    .eq("project_id", params.projectId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const { data: siblings } = (params.parentId
    ? await siblingsQuery.eq("parent_id", params.parentId)
    : await siblingsQuery.is("parent_id", null)
  ) as unknown as { data: { sort_order: number }[] | null; error: null };

  const maxSort = siblings?.[0]?.sort_order as number | undefined;
  const sortOrder = maxSort != null ? maxSort + 1 : 0;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("entities")
    .insert({
      id: crypto.randomUUID(),
      project_id: params.projectId,
      user_id: params.userId,
      parent_id: params.parentId ?? null,
      type: params.type,
      name: params.name,
      content: params.content ?? null,
      properties: {},
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Entity;
}

export async function dbUpdateEntity(
  id: string,
  projectId: string,
  updates: Partial<Pick<Entity, "name" | "content" | "properties" | "sort_order" | "parent_id" | "version_hash">>
): Promise<Entity | null> {
  if (Object.keys(updates).length === 0) return dbGetEntity(id, projectId);
  const { data, error } = await getAdminClient()
    .from("entities")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("project_id", projectId)
    .select()
    .single();
  if (error) return null;
  return data as Entity;
}

export async function dbDeleteEntity(id: string, projectId: string): Promise<void> {
  await getAdminClient()
    .from("entities")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId);
}

const PROGRESS_DEFAULT = `## Status
[Overall project status — e.g. "Novel · First Draft: Chapter 1 of 12 in progress"]

## Last Session
[AI will update this after each session]

## Currently Working On
[Active focus right now]

## Next Steps
1. [First priority]
2. [Second priority]
3. [Third priority]

## Key Decisions
[Important canon/story decisions the AI must respect — keep this list short and pruned]`;

export async function ensureProgressEntity(projectId: string, userId: string): Promise<Entity> {
  const supabase = getAdminClient();
  const { data: existing } = await supabase
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .eq("name", "Project Progress")
    .is("parent_id", null)
    .single();

  if (existing) return existing as Entity;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("entities")
    .insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      user_id: userId,
      parent_id: null,
      type: "note",
      name: "Project Progress",
      content: textToTiptapJson(PROGRESS_DEFAULT),
      properties: { _reserved: "progress" },
      sort_order: -2,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Entity;
}

const INSTRUCTIONS_DEFAULT = `# AI Instructions
This file is read by every AI before every response — it is the project-level AGENTS.md.
Edit it freely. The AI will follow whatever you write here.

---

## Switching or Starting Fresh with a New AI
1. Open this project in the app.
2. The AI automatically reads this file and "Project Progress" (pinned in the explorer) before responding.
3. That's all — no copy-pasting. The AI will know the project structure, where it left off, and what comes next.

---

## Project Map
Where to find everything:

- Project Progress (pinned in explorer) — live snapshot updated by the AI after every working session. Contains: current status, last session summary, next steps, and key decisions. Start here when resuming.
- Logs/ folder — full timestamped history of all AI changes, one file per day (YYYY-MM-DD). Read these if you need to trace what happened in a specific session.
- AI Instructions (this file) — behavioral rules and project navigation. The AI reads this first.
- Project folders (Characters/, Chapters/, etc.) — content lives here, organized by project type.

Open questions and flags: add them to the "Next Steps" or "Key Decisions" section of Project Progress so they are always visible to the AI.

---

## Behavioral Guidelines
Fill in the sections below to shape how the AI writes and reasons for this project.

Tone & genre: [describe the mood, genre, and stylistic conventions]
Character voice: [how should specific characters speak and behave?]
Naming conventions: [any rules for place names, magic systems, terminology]
Things to avoid: [tropes, phrases, or approaches that don't fit this project]
Story rules: [world-building constraints and canon the AI must never break]`;

export async function ensureInstructionsEntity(
  projectId: string,
  userId: string,
  initialContent?: string | null
): Promise<Entity> {
  const supabase = getAdminClient();
  const { data: existing } = await supabase
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .eq("name", "AI Instructions")
    .is("parent_id", null)
    .single();

  if (existing) return existing as Entity;

  const text = initialContent?.trim() || INSTRUCTIONS_DEFAULT;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("entities")
    .insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      user_id: userId,
      parent_id: null,
      type: "note",
      name: "AI Instructions",
      content: textToTiptapJson(text),
      properties: { _reserved: "instructions" },
      sort_order: -1,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Entity;
}

export async function ensureLogsFolder(projectId: string, userId: string): Promise<Entity> {
  const supabase = getAdminClient();
  const { data: existing } = await supabase
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .eq("name", "Logs")
    .eq("type", "folder")
    .is("parent_id", null)
    .single();

  if (existing) return existing as Entity;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("entities")
    .insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      user_id: userId,
      parent_id: null,
      type: "folder",
      name: "Logs",
      content: null,
      properties: { _reserved: "logs_folder" },
      sort_order: 998,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Entity;
}

export async function appendToSessionLog(
  projectId: string,
  userId: string,
  entry: string
): Promise<void> {
  const supabase = getAdminClient();
  const folder = await ensureLogsFolder(projectId, userId);
  const folderId = folder.id;

  const today = new Date().toISOString().split("T")[0]!;
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const logLine = `[${time}] ${entry}`;
  const now = new Date().toISOString();

  const { data: existingLog } = await supabase
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .eq("parent_id", folderId)
    .eq("name", today)
    .single() as unknown as { data: { id: string; content: Record<string, unknown> | null } | null; error: null };

  if (existingLog) {
    const currentText = existingLog.content
      ? extractTextFromTiptap(existingLog.content as Record<string, unknown>)
      : "";
    const newText = currentText ? `${currentText}\n\n${logLine}` : logLine;
    await supabase
      .from("entities")
      .update({ content: textToTiptapJson(newText), updated_at: now })
      .eq("id", existingLog.id);
  } else {
    await supabase.from("entities").insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      user_id: userId,
      parent_id: folderId,
      type: "note",
      name: today,
      content: textToTiptapJson(logLine),
      properties: { _reserved: "session_log" },
      sort_order: 0,
      created_at: now,
      updated_at: now,
    });
  }
}

export async function syncEntityReferences(
  projectId: string,
  userId: string,
  renamedEntityId: string,
  oldName: string,
  newName: string
): Promise<string[]> {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const { data: rows } = await supabase
    .from("entities")
    .select("id, name, content, properties")
    .eq("project_id", projectId)
    .not("content", "is", null);

  if (!rows?.length) return [];

  const updated: string[] = [];

  for (const row of (rows ?? []) as { id: string; name: string; content: Record<string, unknown> | null; properties: Record<string, unknown> }[]) {
    if ((row.properties as Record<string, unknown>)?._reserved === "session_log") continue;
    if (!row.content) continue;

    const { doc: updatedDoc, changed } = replaceTextInTiptapDoc(
      row.content as Record<string, unknown>,
      oldName,
      newName
    );
    if (!changed) continue;

    await supabase
      .from("entities")
      .update({ content: updatedDoc, updated_at: now })
      .eq("id", row.id);

    updated.push(row.name);
  }

  if (updated.length > 0) {
    await appendToSessionLog(
      projectId,
      userId,
      `Synced references: "${oldName}" → "${newName}" in ${updated.length} file(s): ${updated.join(", ")}`
    );
  }

  return updated;
}
