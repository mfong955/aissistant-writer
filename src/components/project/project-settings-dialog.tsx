"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/project-context";
import type { Project, ProjectType } from "@/types/database";

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

const INSTRUCTIONS_PLACEHOLDER = `Add custom instructions for your AI writing assistant.

Examples:
- This story is a dark fantasy with mature themes. Don't soften the tone.
- The protagonist speaks in a casual, modern voice. Avoid formal language.
- Chapter titles should follow the format "Part X: [Theme]"
- All character names draw from ancient Norse mythology.`;

export function ProjectSettingsDialog({ children }: { children: React.ReactNode }) {
  const { project, setProject } = useProject();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [projectType, setProjectType] = React.useState<ProjectType | "">("");
  const [instructions, setInstructions] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open && project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setProjectType(project.project_type ?? "");
      setInstructions(project.system_instructions ?? "");
    }
  }, [open, project]);

  const handleSave = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || project.name,
          description: description.trim() || null,
          project_type: projectType || null,
          system_instructions: instructions.trim() || null,
        }),
      });
      const data = (await res.json()) as { project: Project };
      if (data.project) {
        setProject(data.project);
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-lg bg-background border border-border shadow-lg p-6 flex flex-col gap-5 focus:outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">Project Settings</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Project Name</label>
              <input
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Untitled Project"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Description</label>
              <input
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your project"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Project Type</label>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
              <p className="text-xs text-muted-foreground">
                Sets default folder structure and file organization guidelines for the AI.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Writing Instructions</label>
              <textarea
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[140px] resize-y"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={INSTRUCTIONS_PLACEHOLDER}
              />
              <p className="text-xs text-muted-foreground">
                The AI reads these before every response. Set tone, style, naming rules, or any project-specific conventions.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Dialog.Close asChild>
              <Button variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
