import { getAdminClient } from "@/lib/supabase/admin";
import type { ProjectState } from "@/types/database";

export async function dbGetProjectState(projectId: string): Promise<ProjectState | null> {
  const { data, error } = await getAdminClient()
    .from("project_states")
    .select("*")
    .eq("project_id", projectId)
    .single();
  if (error) return null;
  return data as ProjectState;
}

export async function dbUpsertProjectState(params: {
  projectId: string;
  userId: string;
  stateContent: string;
  entityHashes: Record<string, string>;
}): Promise<void> {
  await getAdminClient()
    .from("project_states")
    .upsert(
      {
        project_id: params.projectId,
        user_id: params.userId,
        state_content: params.stateContent,
        entity_hashes: params.entityHashes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    );
}
