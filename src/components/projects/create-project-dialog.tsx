"use client";

import { useState } from "react";
import { Folder, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROJECT_TEMPLATES } from "@/lib/templates";
import { EXPLORER_ROOTS } from "@/lib/entity-roots";
import type { ProjectType } from "@/types/database";

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "novel", label: "Novel" },
  { value: "short_story", label: "Short Story" },
  { value: "non_fiction", label: "Non-Fiction" },
  { value: "textbook", label: "Textbook / Academic" },
  { value: "screenplay", label: "Screenplay" },
  { value: "poetry", label: "Poetry Collection" },
  { value: "game_narrative", label: "Game Narrative" },
  { value: "other", label: "Other" },
];

interface CreateProjectDialogProps {
  onSubmit: (name: string, description: string, projectType: ProjectType | null) => Promise<void>;
  onCancel: () => void;
}

export function CreateProjectDialog({
  onSubmit,
  onCancel,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState<ProjectType | "">("");
  const [loading, setLoading] = useState(false);

  const starterTemplate = projectType ? PROJECT_TEMPLATES[projectType as ProjectType] : null;
  const foldersByRoot = starterTemplate
    ? EXPLORER_ROOTS.map((root) => ({
        root,
        folders: starterTemplate.folders.filter((f) => f.root === root.key),
      })).filter((g) => g.folders.length > 0)
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await onSubmit(name.trim(), description.trim(), (projectType as ProjectType) || null);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Create New Project</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Novel"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description (optional)</Label>
            <Input
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A sci-fi thriller about..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-type">Project Type (optional)</Label>
            <select
              id="project-type"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType | "")}
            >
              <option value="">Select a type…</option>
              {PROJECT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Template preview */}
          {starterTemplate && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Every project gets Canon, Manuscript, and Unsorted — this type also seeds:
              </p>
              <div className="space-y-2">
                {foldersByRoot.map(({ root, folders }) => (
                  <div key={root.key}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {root.name}
                    </p>
                    <div className="space-y-1 pl-1">
                      {folders.map((folder) => (
                        <div key={folder.name} className="flex items-center gap-1.5 text-xs">
                          <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="font-medium">{folder.name}</span>
                          {folder.seeds.length > 0 && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <span>·</span>
                              <FileText className="h-2.5 w-2.5" />
                              {folder.seeds.map((s) => s.name).join(", ")}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
