import { getAdminClient } from "@/lib/supabase/admin";
import { computeContentHash } from "@/lib/content-hash";
import type { Entity, CanvasContent, CanvasVersion } from "@/types/database";

const EMPTY_CANVAS: CanvasContent = { nodes: [], edges: [] };

// Archived canvases (docs/attic.md) are just entities with type: "canvas" — the same
// dbDeleteEntity/dbRestoreEntity path handles them, so every normal query here excludes
// archived rows the same way entities.ts's dbGetEntities/dbGetEntity do.

export async function dbGetCanvases(projectId: string): Promise<Entity[]> {
  const { data, error } = await getAdminClient()
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .eq("type", "canvas")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Entity[];
}

export async function dbGetCanvas(id: string, projectId: string): Promise<Entity | null> {
  const { data, error } = await getAdminClient()
    .from("entities")
    .select("*")
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("type", "canvas")
    .is("archived_at", null)
    .single();
  if (error) return null;
  return data as Entity;
}

export async function dbCreateCanvas(projectId: string, userId: string, name: string): Promise<Entity> {
  const now = new Date().toISOString();
  const versionHash = await computeContentHash(EMPTY_CANVAS as unknown as Record<string, unknown>);

  const { data, error } = await getAdminClient()
    .from("entities")
    .insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      user_id: userId,
      parent_id: null,
      type: "canvas",
      name,
      content: EMPTY_CANVAS,
      properties: {},
      sort_order: 0,
      version_hash: versionHash,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Entity;
}

export type CanvasUpdateResult =
  | { ok: true; canvas: Entity }
  | { ok: false; conflict: true; currentVersionHash: string };

/**
 * Updates a canvas's content, refusing the write if the canvas changed since the caller last
 * read it (docs/canvas-mode.md §2 — conflict detection, not real-time merge). The caller
 * supplies the version_hash it started editing from; a mismatch means someone else (another
 * tab, another browser, the AI) saved in between.
 */
export async function dbUpdateCanvasContent(
  id: string,
  projectId: string,
  content: CanvasContent,
  expectedVersionHash: string | null
): Promise<CanvasUpdateResult> {
  const supabase = getAdminClient();

  const { data: current, error: readError } = await supabase
    .from("entities")
    .select("version_hash")
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("type", "canvas")
    .is("archived_at", null)
    .single();
  if (readError || !current) throw readError ?? new Error("Canvas not found");

  const currentHash = (current as { version_hash: string | null }).version_hash;
  if (expectedVersionHash !== null && currentHash !== expectedVersionHash) {
    return { ok: false, conflict: true, currentVersionHash: currentHash ?? "" };
  }

  const newHash = await computeContentHash(content as unknown as Record<string, unknown>);
  const { data, error } = await supabase
    .from("entities")
    .update({ content, version_hash: newHash, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("project_id", projectId)
    .select()
    .single();
  if (error) throw error;
  return { ok: true, canvas: data as Entity };
}

export async function dbSaveCanvasVersion(
  canvasId: string,
  projectId: string,
  userId: string,
  snapshot: CanvasContent,
  label?: string
): Promise<CanvasVersion> {
  const { data, error } = await getAdminClient()
    .from("canvas_versions")
    .insert({
      id: crypto.randomUUID(),
      canvas_id: canvasId,
      project_id: projectId,
      user_id: userId,
      snapshot,
      label: label ?? null,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as CanvasVersion;
}

export async function dbListCanvasVersions(canvasId: string): Promise<CanvasVersion[]> {
  const { data, error } = await getAdminClient()
    .from("canvas_versions")
    .select("*")
    .eq("canvas_id", canvasId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CanvasVersion[];
}

/**
 * Restores a canvas to an earlier version. Itself checkpoints the state right before the
 * restore, so undoing a restore is just restoring again — nothing is ever destroyed.
 */
export async function dbRestoreCanvasVersion(
  canvasId: string,
  projectId: string,
  userId: string,
  versionId: string
): Promise<Entity> {
  const supabase = getAdminClient();

  const [{ data: canvas, error: canvasError }, { data: version, error: versionError }] = await Promise.all([
    supabase.from("entities").select("*").eq("id", canvasId).eq("project_id", projectId).eq("type", "canvas").single(),
    supabase.from("canvas_versions").select("*").eq("id", versionId).eq("canvas_id", canvasId).single(),
  ]);
  if (canvasError || !canvas) throw canvasError ?? new Error("Canvas not found");
  if (versionError || !version) throw versionError ?? new Error("Version not found");

  const current = canvas as Entity;
  await dbSaveCanvasVersion(canvasId, projectId, userId, current.content as unknown as CanvasContent, "Before restore");

  const snapshot = (version as CanvasVersion).snapshot;
  const newHash = await computeContentHash(snapshot as unknown as Record<string, unknown>);
  const { data, error } = await supabase
    .from("entities")
    .update({ content: snapshot, version_hash: newHash, updated_at: new Date().toISOString() })
    .eq("id", canvasId)
    .eq("project_id", projectId)
    .select()
    .single();
  if (error) throw error;
  return data as Entity;
}
