"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EntityType } from "@/types/database";
import { getTemplatesForType, templateToContent } from "@/lib/templates";

const entityTypes: { value: EntityType; label: string }[] = [
  { value: "folder", label: "Folder" },
  { value: "character", label: "Character" },
  { value: "chapter", label: "Chapter" },
  { value: "outline", label: "Outline" },
  { value: "note", label: "Note" },
  { value: "world_building", label: "World Building" },
  { value: "custom", label: "Custom" },
];

interface CreateEntityDialogProps {
  parentId?: string | null;
  onSubmit: (
    name: string,
    type: EntityType,
    parentId?: string | null,
    content?: Record<string, unknown> | null
  ) => Promise<void>;
  onCancel: () => void;
}

export function CreateEntityDialog({ parentId, onSubmit, onCancel }: CreateEntityDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<EntityType>("note");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const templates = getTemplatesForType(type);

  // Auto-select the first template when switching to a type that has one
  useEffect(() => {
    const t = getTemplatesForType(type);
    setSelectedTemplate(t.length > 0 ? t[0].label : null);
  }, [type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const template = templates.find((t) => t.label === selectedTemplate);
    const content = template ? templateToContent(template.markdown) : null;
    await onSubmit(name.trim(), type, parentId, content);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Create New Entity</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entity-name">Name</Label>
            <Input
              id="entity-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entity-type">Type</Label>
            <select
              id="entity-type"
              value={type}
              onChange={(e) => setType(e.target.value as EntityType)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {entityTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>Template</Label>
              <div className="flex flex-col gap-1.5">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="template"
                    value=""
                    checked={selectedTemplate === null}
                    onChange={() => setSelectedTemplate(null)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <span>Blank</span>
                </label>
                {templates.map((t) => (
                  <label
                    key={t.label}
                    className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="radio"
                      name="template"
                      value={t.label}
                      checked={selectedTemplate === t.label}
                      onChange={() => setSelectedTemplate(t.label)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
