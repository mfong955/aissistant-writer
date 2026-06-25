import type { Entity, EntityType } from "@/types/database";

export async function getEntities(projectId: string): Promise<Entity[]> {
  const res = await fetch(`/api/entities?project_id=${projectId}`);
  const data = (await res.json()) as { entities: Entity[] };
  return data.entities;
}

export async function createEntity(params: {
  projectId: string;
  name: string;
  type: EntityType;
  parentId?: string | null;
  content?: Record<string, unknown> | null;
}): Promise<Entity> {
  const res = await fetch("/api/entities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: params.projectId,
      name: params.name,
      type: params.type,
      parent_id: params.parentId ?? null,
      content: params.content ?? null,
    }),
  });
  const data = (await res.json()) as { entity: Entity };
  return data.entity;
}

export async function updateEntity(
  id: string,
  updates: Partial<Pick<Entity, "name" | "content" | "properties" | "sort_order" | "parent_id" | "version_hash">> & { project_id: string }
): Promise<{ entity: Entity; renamedFrom?: string }> {
  const res = await fetch(`/api/entities/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return res.json() as Promise<{ entity: Entity; renamedFrom?: string }>;
}

export async function deleteEntity(id: string, projectId: string): Promise<void> {
  await fetch(`/api/entities/${id}?project_id=${projectId}`, { method: "DELETE" });
}

export async function saveEntityContent(
  id: string,
  projectId: string,
  content: Record<string, unknown>,
  versionHash: string
): Promise<Entity> {
  const { entity } = await updateEntity(id, { project_id: projectId, content, version_hash: versionHash });
  return entity;
}
