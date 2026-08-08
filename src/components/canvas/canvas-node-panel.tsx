"use client";

import { X, Trash2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { CanvasNode, Entity } from "@/types/database";

const COLORS = ["#64748b", "#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#a855f7"];

interface CanvasNodePanelProps {
  node: CanvasNode;
  entities: Entity[];
  onChange: (updates: Partial<CanvasNode>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function CanvasNodePanel({ node, entities, onChange, onDelete, onClose }: CanvasNodePanelProps) {
  const linkableEntities = entities.filter((e) => e.type !== "folder" && e.type !== "canvas" && e.type !== "image");

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">Node</span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete} title="Delete node">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} title="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-3">
        <div className="space-y-1.5">
          <Label htmlFor="node-title">Title</Label>
          <Input
            id="node-title"
            value={node.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="node-body">Notes</Label>
          <textarea
            id="node-body"
            value={node.body}
            onChange={(e) => onChange({ body: e.target.value })}
            rows={6}
            className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Whatever you want to put here — a scene idea, a character beat, an open question..."
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <LinkIcon className="h-3 w-3" />
            Linked to
          </Label>
          <select
            value={node.linkedEntityId ?? ""}
            onChange={(e) =>
              onChange({
                kind: e.target.value ? "linked" : "freeform",
                linkedEntityId: e.target.value || undefined,
              })
            }
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Not linked — freeform</option>
            {linkableEntities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Ties this box back to a real project file. Doesn&apos;t change the file — only the
            &quot;Apply to Project&quot; step (not built yet) writes back to the explorer.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Color</Label>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ color: c })}
                className="h-6 w-6 rounded-full ring-offset-2 ring-offset-background"
                style={{ backgroundColor: c, outline: node.color === c ? `2px solid ${c}` : "none" }}
                title={c}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
