import type { Entity, CanvasContent, CanvasVersion } from "@/types/database";

export async function getCanvases(projectId: string): Promise<Entity[]> {
  const res = await fetch(`/api/canvases?project_id=${projectId}`);
  const data = (await res.json()) as { canvases: Entity[] };
  return data.canvases;
}

export async function getCanvas(id: string, projectId: string): Promise<Entity | null> {
  const res = await fetch(`/api/canvases/${id}?project_id=${projectId}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { canvas: Entity };
  return data.canvas;
}

export async function createCanvas(projectId: string, name: string): Promise<Entity> {
  const res = await fetch("/api/canvases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, name }),
  });
  const data = (await res.json()) as { canvas: Entity };
  return data.canvas;
}

export async function renameCanvas(id: string, projectId: string, name: string): Promise<Entity> {
  const res = await fetch(`/api/canvases/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, name }),
  });
  const data = (await res.json()) as { canvas: Entity };
  return data.canvas;
}

export async function deleteCanvas(id: string, projectId: string): Promise<void> {
  await fetch(`/api/canvases/${id}?project_id=${projectId}`, { method: "DELETE" });
}

export type CanvasSaveResult =
  | { ok: true; canvas: Entity }
  | { ok: false; conflict: true; currentVersionHash: string };

/**
 * Saves canvas content. Pass the version_hash the caller started editing from — a 409 means
 * the canvas was saved elsewhere since (another tab, another browser, the AI); the caller
 * should reload rather than retry, per docs/canvas-mode.md §2 (conflict detection, not merge).
 */
export async function updateCanvasContent(
  id: string,
  projectId: string,
  content: CanvasContent,
  expectedVersionHash: string | null
): Promise<CanvasSaveResult> {
  const res = await fetch(`/api/canvases/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, content, expected_version_hash: expectedVersionHash }),
  });
  if (res.status === 409) {
    const data = (await res.json()) as { current_version_hash: string };
    return { ok: false, conflict: true, currentVersionHash: data.current_version_hash };
  }
  const data = (await res.json()) as { canvas: Entity };
  return { ok: true, canvas: data.canvas };
}

export async function listCanvasVersions(id: string, projectId: string): Promise<CanvasVersion[]> {
  const res = await fetch(`/api/canvases/${id}/versions?project_id=${projectId}`);
  const data = (await res.json()) as { versions: CanvasVersion[] };
  return data.versions;
}

export async function saveCanvasCheckpoint(
  id: string,
  projectId: string,
  content: CanvasContent,
  label?: string
): Promise<CanvasVersion> {
  const res = await fetch(`/api/canvases/${id}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, content, label }),
  });
  const data = (await res.json()) as { version: CanvasVersion };
  return data.version;
}

export async function restoreCanvasVersion(
  id: string,
  projectId: string,
  versionId: string
): Promise<Entity> {
  const res = await fetch(`/api/canvases/${id}/versions/${versionId}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId }),
  });
  const data = (await res.json()) as { canvas: Entity };
  return data.canvas;
}
