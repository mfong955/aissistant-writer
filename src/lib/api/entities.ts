import { createClient } from "@/lib/supabase/client";
import type { Entity, EntityType } from "@/types/database";

export async function getEntities(projectId: string): Promise<Entity[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createEntity(params: {
  projectId: string;
  name: string;
  type: EntityType;
  parentId?: string | null;
}): Promise<Entity> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get max sort_order for siblings
  const { data: siblings } = await supabase
    .from("entities")
    .select("sort_order")
    .eq("project_id", params.projectId)
    .is("parent_id", params.parentId ?? null)
    .order("sort_order", { ascending: false })
    .limit(1);

  const sortOrder = siblings && siblings.length > 0 ? siblings[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("entities")
    .insert({
      project_id: params.projectId,
      user_id: user.id,
      name: params.name,
      type: params.type,
      parent_id: params.parentId ?? null,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEntity(
  id: string,
  updates: Partial<Pick<Entity, "name" | "content" | "properties" | "sort_order" | "parent_id" | "version_hash">>
): Promise<Entity> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("entities")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEntity(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("entities").delete().eq("id", id);
  if (error) throw error;
}

export async function saveEntityContent(
  id: string,
  content: Record<string, unknown>,
  versionHash: string
): Promise<Entity> {
  return updateEntity(id, { content, version_hash: versionHash });
}
