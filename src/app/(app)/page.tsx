"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import type { Project } from "@/types/database";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: { projects: Project[] }) => {
        setProjects(data.projects || []);
        setLoading(false);
      });
  }, []);

  async function handleCreate(name: string, description: string, projectType: import("@/types/database").ProjectType | null) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || null, project_type: projectType }),
    });
    const data = (await res.json()) as { project: Project };
    if (data.project) {
      router.push(`/project/${data.project.id}`);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this project? This cannot be undone.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Aissistant Writer</h1>
          <p className="text-muted-foreground">Your writing projects</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {loading ? (
        <div className="mt-12 text-center text-muted-foreground">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="mt-12 text-center">
          <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No projects yet</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            Create your first project
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
              onClick={() => router.push(`/project/${project.id}`)}
            >
              <div>
                <h3 className="font-medium">{project.name}</h3>
                {project.description && (
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Updated {new Date(project.updated_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleDelete(project.id, e)}
                title="Delete project"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProjectDialog
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
