import { createClient } from "@/lib/supabase/client";
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("change_logs")
    .insert({
      project_id: params.projectId,
      user_id: user.id,
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
  return data;
}

export async function getChangeLogs(
  projectId: string,
  options?: {
    entityId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ChangeLog[]> {
  const supabase = createClient();
  let query = supabase
    .from("change_logs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (options?.entityId) {
    query = query.eq("entity_id", options.entityId);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
