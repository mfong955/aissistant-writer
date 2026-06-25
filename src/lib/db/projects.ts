import { getAdminClient } from "@/lib/supabase/admin";
import type { Project, ProjectType } from "@/types/database";

export async function dbGetProjects(userId: string): Promise<Project[]> {
  const { data, error } = await getAdminClient()
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function dbGetProject(id: string, userId: string): Promise<Project | null> {
  const { data, error } = await getAdminClient()
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data as Project;
}

export async function dbCreateProject(
  userId: string,
  name: string,
  description?: string | null,
  projectType?: ProjectType | null
): Promise<Project> {
  const { data, error } = await getAdminClient()
    .from("projects")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      name,
      description: description ?? null,
      project_type: projectType ?? null,
      settings: {},
    })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function dbUpdateProject(
  id: string,
  userId: string,
  updates: Partial<Pick<Project, "name" | "description" | "project_type" | "system_instructions" | "settings">>
): Promise<Project | null> {
  if (Object.keys(updates).length === 0) return dbGetProject(id, userId);
  const { data, error } = await getAdminClient()
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) return null;
  return data as Project;
}

export async function dbDeleteProject(id: string, userId: string): Promise<void> {
  await getAdminClient()
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
}
