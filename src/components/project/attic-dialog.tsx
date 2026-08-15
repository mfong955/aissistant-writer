"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { X, Archive, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/project-context";
import { getArchivedEntities, getEntities, restoreEntity, purgeEntity } from "@/lib/api/entities";
import { findRootKeyForEntity, EXPLORER_ROOTS, type ExplorerRootKey } from "@/lib/entity-roots";
import type { Entity } from "@/types/database";

const ROOT_LABEL = new Map(EXPLORER_ROOTS.map((r) => [r.key, r.name]));

function formatArchivedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The Attic — a dialog, not a third mode (docs/attic.md §5). Archived entities are recoverable
 * indefinitely; "Delete Forever" is the one action here that's still genuinely irreversible.
 */
export function AtticDialog({ children }: { children: React.ReactNode }) {
  const { project } = useProject();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [archived, setArchived] = React.useState<Entity[]>([]);
  const [rootByEntityId, setRootByEntityId] = React.useState<Map<string, ExplorerRootKey | null>>(new Map());
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      const [archivedEntities, activeEntities] = await Promise.all([
        getArchivedEntities(project.id),
        getEntities(project.id),
      ]);
      const entityById = new Map<string, Entity>([
        ...activeEntities.map((e) => [e.id, e] as const),
        ...archivedEntities.map((e) => [e.id, e] as const),
      ]);
      const roots = new Map<string, ExplorerRootKey | null>();
      for (const entity of archivedEntities) {
        roots.set(entity.id, findRootKeyForEntity(entity, entityById));
      }
      setArchived(archivedEntities);
      setRootByEntityId(roots);
    } finally {
      setLoading(false);
    }
  }, [project]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleRestore = async (entity: Entity) => {
    if (!project) return;
    setBusyId(entity.id);
    try {
      await restoreEntity(entity.id, project.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async (entity: Entity) => {
    if (!project) return;
    if (!confirm(`Permanently delete "${entity.name}" and everything nested inside it? This cannot be undone.`)) return;
    setBusyId(entity.id);
    try {
      await purgeEntity(entity.id, project.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-lg bg-background border border-border shadow-lg p-6 flex flex-col gap-4 focus:outline-none max-h-[80vh]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-muted-foreground" />
              <Dialog.Title className="text-base font-semibold">The Attic</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-xs text-muted-foreground -mt-2">
            Nothing is deleted forever until you say so. Restore anything below, anytime.
          </Dialog.Description>

          <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : archived.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                The Attic is empty.
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {archived.map((entity) => {
                  const rootKey = rootByEntityId.get(entity.id);
                  const rootLabel = rootKey ? ROOT_LABEL.get(rootKey) : null;
                  const isBusy = busyId === entity.id;
                  return (
                    <li
                      key={entity.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                    >
                      <div className="min-w-0 flex flex-col">
                        <span className="truncate text-sm font-medium">{entity.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {entity.type}
                          {rootLabel ? ` · was in ${rootLabel}` : ""}
                          {" · archived "}
                          {formatArchivedAt(entity.archived_at ?? entity.updated_at)}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="outline" size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          disabled={isBusy}
                          onClick={() => handleRestore(entity)}
                          title="Restore"
                        >
                          <RotateCcw className="h-3 w-3" /> Restore
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                          disabled={isBusy}
                          onClick={() => handlePurge(entity)}
                          title="Delete forever"
                        >
                          <Trash2 className="h-3 w-3" /> Delete Forever
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
