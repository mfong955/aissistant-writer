"use client";

import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface CanvasEdgePanelProps {
  edge: { id: string; label?: string };
  onChange: (label: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function CanvasEdgePanel({ edge, onChange, onDelete, onClose }: CanvasEdgePanelProps) {
  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">Connection</span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete} title="Delete connection">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} title="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-3">
        <div className="space-y-1.5">
          <Label htmlFor="edge-label">Label</Label>
          <Input
            id="edge-label"
            value={edge.label ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. leads to, betrays, loves"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            What this connection means — shown on the line itself. Leave blank for an unlabeled connection.
          </p>
        </div>
      </div>
    </div>
  );
}
