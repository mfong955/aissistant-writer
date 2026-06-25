"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus, Loader2, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/project-context";
import { buildTree } from "@/lib/entity-tree";
import { createEntity, updateEntity, deleteEntity } from "@/lib/api/entities";
import { TreeNode } from "./tree-node";
import { CreateEntityDialog } from "./create-entity-dialog";
import { EntityIcon } from "./entity-icon";
import type { EntityType } from "@/types/database";

interface PendingRename {
  entityId: string;
  oldName: string;
  newName: string;
  entityType: string;
}

interface RelatedNameCandidate {
  entityId: string;
  currentName: string;
  proposedName: string;
  checked: boolean;
}

interface ProjectExplorerProps {
  onSelectEntity: (entityId: string) => void;
  selectedEntityId?: string;
}

export function ProjectExplorer({
  onSelectEntity,
  selectedEntityId,
}: ProjectExplorerProps) {
  const { project, entities, refreshEntities } = useProject();
  const [showCreate, setShowCreate] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [pendingRename, setPendingRename] = useState<PendingRename | null>(null);
  const [relatedCandidates, setRelatedCandidates] = useState<RelatedNameCandidate[]>([]);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done">("idle");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageFiles = useCallback(async (files: FileList | null) => {
    if (!files || !project) return;
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("project_id", project.id);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));
      await fetch("/api/images", { method: "POST", body: formData });
    }
    await refreshEntities();
  }, [project, refreshEntities]);

  const progressEntity = useMemo(
    () => entities.find((e) => e.name === "Project Progress" && e.parent_id === null),
    [entities]
  );

  const instructionsEntity = useMemo(
    () => entities.find((e) => e.name === "AI Instructions" && e.parent_id === null),
    [entities]
  );

  const tree = useMemo(
    () => buildTree(entities.filter((e) => {
      if (e.parent_id !== null) return true;
      return e.name !== "AI Instructions" && e.name !== "Project Progress";
    })),
    [entities]
  );

  async function handleCreate(
    name: string,
    type: EntityType,
    parentId?: string | null,
    content?: Record<string, unknown> | null
  ) {
    if (!project) return;
    await createEntity({ projectId: project.id, name, type, parentId, content });
    await refreshEntities();
    setShowCreate(false);
  }

  function handleRename(entityId: string, newName: string) {
    if (!project) return;
    const entity = entities.find((e) => e.id === entityId);
    if (!entity || entity.name === newName) return;
    setPendingRename({ entityId, oldName: entity.name, newName, entityType: entity.type });
  }

  async function confirmRename() {
    if (!project || !pendingRename) return;
    const { entityId, newName, entityType } = pendingRename;
    const capturedOldName = pendingRename.oldName;
    setPendingRename(null);
    setSyncState("syncing");
    setSyncMessage(null);

    try {
      const { renamedFrom } = await updateEntity(entityId, { project_id: project.id, name: newName });
      const oldName = renamedFrom ?? capturedOldName;
      await refreshEntities();

      // Detect other entity names that contain oldName as a substring
      const candidates: RelatedNameCandidate[] = entities
        .filter((e) => e.id !== entityId && e.name.includes(oldName))
        .map((e) => ({
          entityId: e.id,
          currentName: e.name,
          proposedName: e.name.split(oldName).join(newName),
          checked: true,
        }));
      if (candidates.length > 0) {
        setRelatedCandidates(candidates);
      }

      const res = await fetch(`/api/projects/${project.id}/sync-references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renamedEntityId: entityId, oldName, newName, entityType }),
      });
      const data = await res.json() as { programmaticUpdates: string[]; aiSummary: string | null };
      await refreshEntities();

      const parts: string[] = [];
      if (data.programmaticUpdates.length > 0) {
        parts.push(`Updated ${data.programmaticUpdates.length} file(s): ${data.programmaticUpdates.join(", ")}`);
      }
      if (data.aiSummary) parts.push(data.aiSummary);
      const summary = parts.length > 0 ? parts.join(" · ") : "No references found.";
      setSyncMessage(summary);

      window.dispatchEvent(
        new CustomEvent("aissistant:rename-synced", {
          detail: { message: `Renamed "${oldName}" → "${newName}". ${summary}` },
        })
      );
    } catch {
      setSyncMessage("Rename succeeded; reference sync failed.");
    } finally {
      setSyncState("done");
      setTimeout(() => { setSyncState("idle"); setSyncMessage(null); }, 4000);
    }
  }

  async function applyRelatedRenames() {
    if (!project) return;
    const selected = relatedCandidates.filter((c) => c.checked);
    setRelatedCandidates([]);
    for (const c of selected) {
      await updateEntity(c.entityId, { project_id: project.id, name: c.proposedName });
    }
    if (selected.length > 0) {
      await refreshEntities();
      window.dispatchEvent(
        new CustomEvent("aissistant:rename-synced", {
          detail: { message: `Also renamed ${selected.length} related file(s): ${selected.map((c) => `"${c.currentName}" → "${c.proposedName}"`).join(", ")}` },
        })
      );
    }
  }

  async function handleDelete(entityId: string) {
    if (!project) return;
    if (!confirm("Delete this entity and all its children?")) return;
    await deleteEntity(entityId, project.id);
    await refreshEntities();
  }

  async function handleMove(entityId: string, newParentId: string | null) {
    if (!project) return;
    await updateEntity(entityId, { project_id: project.id, parent_id: newParentId });
    await refreshEntities();
  }

  async function handleReorder(draggedId: string, targetId: string, position: "before" | "after") {
    if (!project) return;
    const target = entities.find((e) => e.id === targetId);
    if (!target) return;

    // Get all siblings (same parent as target), sorted by current sort_order
    const siblings = entities
      .filter((e) => e.parent_id === target.parent_id && e.id !== draggedId)
      .sort((a, b) => a.sort_order - b.sort_order);

    // Insert dragged item at the correct position
    const insertIdx = siblings.findIndex((e) => e.id === targetId) + (position === "after" ? 1 : 0);
    siblings.splice(insertIdx, 0, entities.find((e) => e.id === draggedId)!);

    // Assign new sort_orders (multiples of 100 to leave space)
    await Promise.all(
      siblings.map((e, i) =>
        updateEntity(e.id, {
          project_id: project.id,
          sort_order: i * 100,
          parent_id: target.parent_id,
        })
      )
    );
    await refreshEntities();
  }

  function handleCreateChild(parentId: string) {
    setCreateParentId(parentId);
    setShowCreate(true);
  }

  function handleCreateRoot() {
    setCreateParentId(null);
    setShowCreate(true);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => imageInputRef.current?.click()}
            title="Upload image"
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCreateRoot}
            title="New entity"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <input
        ref={imageInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif"
        onChange={(e) => { handleImageFiles(e.target.files); e.target.value = ""; }}
      />
      <div className="flex-1 overflow-auto py-1">
        {/* Project Progress — pinned first */}
        {progressEntity && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-sm px-1 py-0.5 text-sm hover:bg-accent cursor-pointer mx-1 mb-0.5",
              selectedEntityId === progressEntity.id && "bg-accent"
            )}
            onClick={() => onSelectEntity(progressEntity.id)}
          >
            <span className="w-3.5 shrink-0" />
            <EntityIcon type={progressEntity.type} name={progressEntity.name} className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate text-teal-500 font-medium">{progressEntity.name}</span>
          </div>
        )}
        {/* AI Instructions — pinned second */}
        {instructionsEntity && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-sm px-1 py-0.5 text-sm hover:bg-accent cursor-pointer mx-1 mb-1",
              selectedEntityId === instructionsEntity.id && "bg-accent"
            )}
            onClick={() => onSelectEntity(instructionsEntity.id)}
          >
            <span className="w-3.5 shrink-0" />
            <EntityIcon type={instructionsEntity.type} name={instructionsEntity.name} className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate text-purple-500 font-medium">{instructionsEntity.name}</span>
          </div>
        )}
        {tree.length === 0 && !instructionsEntity && !progressEntity ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            <p>No entities yet</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={handleCreateRoot}
            >
              <Plus className="mr-1 h-3 w-3" />
              Create one
            </Button>
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.entity.id}
              node={node}
              depth={0}
              onSelect={onSelectEntity}
              onRename={handleRename}
              onDelete={handleDelete}
              onCreateChild={handleCreateChild}
              onMove={handleMove}
              onReorder={handleReorder}
              selectedId={selectedEntityId}
            />
          ))
        )}
        {/* Root-level drop zone — drag a file here to move it out of any folder */}
        <div
          className="mx-1 mt-1 rounded-sm border border-dashed border-transparent py-2 text-center text-[10px] text-transparent transition-colors hover:border-border hover:text-muted-foreground"
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary/40", "text-muted-foreground"); }}
          onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary/40", "text-muted-foreground"); }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("border-primary/40", "text-muted-foreground");
            const draggedId = e.dataTransfer.getData("text/plain");
            if (draggedId) handleMove(draggedId, null);
          }}
        >
          Drop here to move to root
        </div>
      </div>
      {showCreate && (
        <CreateEntityDialog
          parentId={createParentId}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Sync status banner */}
      {syncState !== "idle" && (
        <div className="flex items-center gap-1.5 border-t px-3 py-1.5 text-xs text-muted-foreground">
          {syncState === "syncing" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              <span>Syncing references…</span>
            </>
          ) : (
            <span className="truncate">{syncMessage}</span>
          )}
        </div>
      )}

      {/* Rename confirmation dialog */}
      {pendingRename && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[400px] rounded-lg border bg-background p-5 shadow-xl">
            <h3 className="mb-1 text-sm font-semibold">Rename file?</h3>
            <p className="mb-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">&quot;{pendingRename.oldName}&quot;</span>
              {" → "}
              <span className="font-medium text-foreground">&quot;{pendingRename.newName}&quot;</span>
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              Exact references in all project files will be updated automatically.
              The AI will also scan for contextual mentions.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPendingRename(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmRename}>
                Rename &amp; Sync
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Related file names dialog — shown when other file names contain the old name */}
      {relatedCandidates.length > 0 && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[480px] rounded-lg border bg-background p-5 shadow-xl">
            <h3 className="mb-1 text-sm font-semibold">Update related file names?</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              These file names contain the old name. Select which ones to rename.
            </p>
            <div className="mb-3 flex gap-2 text-xs">
              <button
                className="text-primary underline"
                onClick={() => setRelatedCandidates((prev) => prev.map((c) => ({ ...c, checked: true })))}
              >
                Select all
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                className="text-primary underline"
                onClick={() => setRelatedCandidates((prev) => prev.map((c) => ({ ...c, checked: false })))}
              >
                Deselect all
              </button>
            </div>
            <div className="mb-4 max-h-48 space-y-2 overflow-y-auto">
              {relatedCandidates.map((c) => (
                <label key={c.entityId} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.checked}
                    onChange={(e) =>
                      setRelatedCandidates((prev) =>
                        prev.map((x) => x.entityId === c.entityId ? { ...x, checked: e.target.checked } : x)
                      )
                    }
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span className="flex-1 min-w-0 text-xs">
                    <span className="font-medium">{c.currentName}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-medium text-primary">{c.proposedName}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRelatedCandidates([])}>
                Skip
              </Button>
              <Button
                size="sm"
                onClick={applyRelatedRenames}
                disabled={relatedCandidates.every((c) => !c.checked)}
              >
                Rename Selected
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
