import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/types/database";

const supabase = createClient();

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createProject(
  name: string,
  description?: string
): Promise<Project> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, "name" | "description" | "settings">>
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
