import { getAdminClient } from "@/lib/supabase/admin";
import type { ChangeLog, ChangeAction, ChangeActor } from "@/types/database";

export async function dbCreateChangeLog(params: {
  projectId: string;
  userId: string;
  entityId?: string | null;
  action: ChangeAction;
  actor: ChangeActor;
  description: string;
  oldVersionHash?: string | null;
  newVersionHash?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<ChangeLog> {
  const { data, error } = await getAdminClient()
    .from("change_logs")
    .insert({
      id: crypto.randomUUID(),
      project_id: params.projectId,
      user_id: params.userId,
      entity_id: params.entityId ?? null,
      action: params.action,
      actor: params.actor,
      description: params.description,
      old_version_hash: params.oldVersionHash ?? null,
      new_version_hash: params.newVersionHash ?? null,
      metadata: params.metadata ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ChangeLog;
}

export async function dbGetChangeLogs(
  projectId: string,
  options?: { entityId?: string; limit?: number; offset?: number }
): Promise<ChangeLog[]> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = getAdminClient()
    .from("change_logs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.entityId) {
    query = query.eq("entity_id", options.entityId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ChangeLog[];
}
