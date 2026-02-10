"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EntityType } from "@/types/database";

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
  onSubmit: (name: string, type: EntityType, parentId?: string | null) => Promise<void>;
  onCancel: () => void;
}

export function CreateEntityDialog({
  parentId,
  onSubmit,
  onCancel,
}: CreateEntityDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<EntityType>("note");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await onSubmit(name.trim(), type, parentId);
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
