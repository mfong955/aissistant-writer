import type { Project } from "@/types/database";

export async function getProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  const data = (await res.json()) as { projects: Project[] };
  return data.projects;
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) throw new Error("Project not found");
  const data = (await res.json()) as { project: Project };
  return data.project;
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  const data = (await res.json()) as { project: Project };
  return data.project;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, "name" | "description" | "settings">>
): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = (await res.json()) as { project: Project };
  return data.project;
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(`/api/projects/${id}`, { method: "DELETE" });
}
