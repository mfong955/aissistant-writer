import { getAdminClient } from "@/lib/supabase/admin";
import type { EntitySummary } from "@/types/database";

export async function dbGetEntitySummaries(projectId: string): Promise<EntitySummary[]> {
  const { data, error } = await getAdminClient()
    .from("entity_summaries")
    .select("*")
    .eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []) as EntitySummary[];
}

export async function dbGetEntitySummary(entityId: string): Promise<EntitySummary | null> {
  const { data, error } = await getAdminClient()
    .from("entity_summaries")
    .select("*")
    .eq("entity_id", entityId)
    .single();
  if (error) return null;
  return data as EntitySummary;
}

export async function dbUpsertEntitySummary(params: {
  entityId: string;
  projectId: string;
  userId: string;
  summary: string;
  versionHash: string;
}): Promise<void> {
  await getAdminClient()
    .from("entity_summaries")
    .upsert(
      {
        entity_id: params.entityId,
        project_id: params.projectId,
        user_id: params.userId,
        summary: params.summary,
        version_hash: params.versionHash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entity_id" }
    );
}
