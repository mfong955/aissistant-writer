"use client";

import { useEffect, useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listCanvasVersions, restoreCanvasVersion } from "@/lib/api/canvases";
import type { CanvasVersion } from "@/types/database";

interface CanvasVersionHistoryProps {
  canvasId: string;
  projectId: string;
  onClose: () => void;
  onRestored: () => void;
}

export function CanvasVersionHistory({ canvasId, projectId, onClose, onRestored }: CanvasVersionHistoryProps) {
  const [versions, setVersions] = useState<CanvasVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    listCanvasVersions(canvasId, projectId).then((v) => {
      setVersions(v);
      setLoading(false);
    });
  }, [canvasId, projectId]);

  async function handleRestore(versionId: string) {
    if (!confirm("Restore this version? The current state will be checkpointed first, so you can undo this too.")) return;
    setRestoringId(versionId);
    await restoreCanvasVersion(canvasId, projectId, versionId);
    setRestoringId(null);
    onRestored();
    onClose();
  }

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">Version history</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} title="Close">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {loading ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No checkpoints yet. Use &quot;Checkpoint&quot; on the board to save one.
          </p>
        ) : (
          <div className="space-y-1">
            {versions.map((v) => (
              <div key={v.id} className="rounded-md border px-2.5 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{v.label || "Checkpoint"}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={restoringId === v.id}
                    onClick={() => handleRestore(v.id)}
                    title="Restore this version"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
                <div className="mt-0.5 text-muted-foreground">
                  {new Date(v.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
