import { getAdminClient } from "@/lib/supabase/admin";
import type { Entity, EntityType, ProjectType } from "@/types/database";
import { textToTiptapJson, extractTextFromTiptap, replaceTextInTiptapDoc } from "@/lib/tiptap-utils";
import { PROJECT_TEMPLATES, getTemplatesForType } from "@/lib/templates";

export async function initProjectFolders(
  projectId: string,
  userId: string,
  projectType: ProjectType | null
): Promise<string[]> {
  const template = projectType ? PROJECT_TEMPLATES[projectType] : null;
  if (!template?.folders.length) return [];

  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("entities")
    .select("name")
    .eq("project_id", projectId)
    .eq("type", "folder")
    .is("parent_id", null) as unknown as { data: { name: string }[] | null; error: null };

  const existingNames = new Set((existing ?? []).map((r: { name: string }) => r.name));
  const created: string[] = [];

  for (let i = 0; i < template.folders.length; i++) {
    const folderConfig = template.folders[i];
    if (existingNames.has(folderConfig.name)) continue;

    const folderId = crypto.randomUUID();
    await supabase.from("entities").insert({
      id: folderId,
      project_id: projectId,
      user_id: userId,
      parent_id: null,
      type: "folder",
      name: folderConfig.name,
      content: null,
      properties: {},
      sort_order: i,
      created_at: now,
      updated_at: now,
    });
    created.push(folderConfig.name);

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
  return created;
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
