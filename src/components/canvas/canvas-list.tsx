"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, Workflow, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/project-context";
import { getCanvases, createCanvas, renameCanvas, deleteCanvas } from "@/lib/api/canvases";
import type { Entity } from "@/types/database";

interface CanvasListProps {
  selectedCanvasId?: string;
  onSelectCanvas: (canvasId: string) => void;
}

export function CanvasList({ selectedCanvasId, onSelectCanvas }: CanvasListProps) {
  const { project } = useProject();
  const [canvases, setCanvases] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!project) return;
    const list = await getCanvases(project.id);
    setCanvases(list);
    setLoading(false);
  }, [project]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (renamingId) setTimeout(() => renameInputRef.current?.focus(), 20);
  }, [renamingId]);

  async function handleCreate() {
    if (!project) return;
    const canvas = await createCanvas(project.id, "Untitled Canvas");
    await refresh();
    onSelectCanvas(canvas.id);
    setRenamingId(canvas.id);
    setRenameValue(canvas.name);
  }

  function startRename(canvas: Entity, e: React.MouseEvent) {
    e.stopPropagation();
    setRenamingId(canvas.id);
    setRenameValue(canvas.name);
  }

  async function commitRename(id: string) {
    const trimmed = renameValue.trim();
    const current = canvases.find((c) => c.id === id);
    if (project && trimmed && current && trimmed !== current.name) {
      await renameCanvas(id, project.id, trimmed);
      await refresh();
    }
    setRenamingId(null);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!project) return;
    if (!confirm("Delete this canvas? Its version history goes with it. This cannot be undone.")) return;
    await deleteCanvas(id, project.id);
    await refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">Canvases</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCreate} title="New canvas">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {loading ? null : canvases.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            <p>No canvases yet</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={handleCreate}>
              <Plus className="mr-1 h-3 w-3" />
              Create one
            </Button>
          </div>
        ) : (
          canvases.map((canvas) => (
            <div
              key={canvas.id}
              className={cn(
                "group flex items-center gap-1.5 rounded-sm px-2 py-1 mx-1 text-sm hover:bg-accent cursor-pointer",
                selectedCanvasId === canvas.id && "bg-accent"
              )}
              onClick={() => onSelectCanvas(canvas.id)}
            >
              <Workflow className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
              {renamingId === canvas.id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(canvas.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onBlur={() => commitRename(canvas.id)}
                  className="flex-1 rounded bg-background px-1 text-sm outline-none ring-1 ring-ring"
                />
              ) : (
                <span className="flex-1 truncate">{canvas.name}</span>
              )}
              <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => startRename(canvas, e)} title="Rename">
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => handleDelete(canvas.id, e)} title="Delete">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
