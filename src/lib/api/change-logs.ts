import type { ChangeLog, ChangeAction, ChangeActor } from "@/types/database";

export async function createChangeLog(params: {
  projectId: string;
  entityId?: string | null;
  action: ChangeAction;
  actor: ChangeActor;
  description: string;
  oldVersionHash?: string | null;
  newVersionHash?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<ChangeLog> {
  const res = await fetch("/api/change-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: params.projectId,
      entity_id: params.entityId ?? null,
      action: params.action,
      actor: params.actor,
      description: params.description,
      old_version_hash: params.oldVersionHash ?? null,
      new_version_hash: params.newVersionHash ?? null,
      metadata: params.metadata,
    }),
  });
  const data = (await res.json()) as { log: ChangeLog };
  return data.log;
}

export async function getChangeLogs(
  projectId: string,
  options?: { entityId?: string; limit?: number; offset?: number }
): Promise<ChangeLog[]> {
  const params = new URLSearchParams({ project_id: projectId });
  if (options?.entityId) params.set("entity_id", options.entityId);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));

  const res = await fetch(`/api/change-logs?${params}`);
  const data = (await res.json()) as { logs: ChangeLog[] };
  return data.logs;
}
