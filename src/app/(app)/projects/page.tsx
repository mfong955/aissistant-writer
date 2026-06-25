"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { WelcomeModal } from "@/components/projects/welcome-modal";
import type { Project } from "@/types/database";

const WELCOMED_KEY = "aissistant:welcomed";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/projects")
      .then(async (r) => {
        const text = await r.text();
        try {
          return JSON.parse(text) as { projects: Project[]; error?: string };
        } catch {
          throw new Error(`Server error (${r.status}): ${text.slice(0, 200)}`);
        }
      })
      .then((data) => {
        if (data.error) setLoadError(data.error);
        const list = data.projects || [];
        setProjects(list);
        setLoading(false);
        if (list.length === 0 && !localStorage.getItem(WELCOMED_KEY)) {
          setShowWelcome(true);
        }
      })
      .catch((err: Error) => {
        setLoadError(err.message);
        setLoading(false);
      });
  }, []);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId) {
      setTimeout(() => renameInputRef.current?.focus(), 20);
    }
  }, [renamingId]);

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

  function startRename(project: Project, e: React.MouseEvent) {
    e.stopPropagation();
    setRenamingId(project.id);
    setRenameValue(project.name);
  }

  async function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== projects.find((p) => p.id === id)?.name) {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
      }
    }
    setRenamingId(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  function dismissWelcome() {
    localStorage.setItem(WELCOMED_KEY, "1");
    setShowWelcome(false);
  }

  function welcomeGetStarted() {
    localStorage.setItem(WELCOMED_KEY, "1");
    setShowWelcome(false);
    setShowCreate(true);
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      {showWelcome && (
        <WelcomeModal onGetStarted={welcomeGetStarted} onDismiss={dismissWelcome} />
      )}

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
      ) : loadError ? (
        <div className="mt-12 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
          <p className="font-medium text-destructive">Failed to load projects</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">{loadError}</p>
          <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>Retry</Button>
        </div>
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
              className="group flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
              onClick={() => renamingId !== project.id && router.push(`/project/${project.id}`)}
            >
              <div className="min-w-0 flex-1">
                {renamingId === project.id ? (
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(project.id);
                        if (e.key === "Escape") cancelRename();
                      }}
                      onBlur={() => commitRename(project.id)}
                      className="w-full rounded border bg-background px-2 py-0.5 text-base font-medium outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onMouseDown={(e) => { e.preventDefault(); commitRename(project.id); }}
                      className="shrink-0 rounded p-0.5 hover:bg-muted"
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); cancelRename(); }}
                      className="shrink-0 rounded p-0.5 hover:bg-muted"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{project.name}</h3>
                    <button
                      onClick={(e) => startRename(project, e)}
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-foreground transition-opacity"
                      title="Rename project"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {project.description && renamingId !== project.id && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{project.description}</p>
                )}
                {renamingId !== project.id && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {new Date(project.updated_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              {renamingId !== project.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDelete(project.id, e)}
                  title="Delete project"
                  className="ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
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
