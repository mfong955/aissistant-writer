"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Plus, Loader2 } from "lucide-react";
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
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done">("idle");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

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

  async function handleCreate(name: string, type: EntityType, parentId?: string | null) {
    if (!project) return;
    await createEntity({
      projectId: project.id,
      name,
      type,
      parentId,
    });
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
    setPendingRename(null);
    setSyncState("syncing");
    setSyncMessage(null);

    try {
      // Use renamedFrom from the server — authoritative old name, never stale
      const { renamedFrom } = await updateEntity(entityId, { project_id: project.id, name: newName });
      const oldName = renamedFrom ?? pendingRename.oldName;
      await refreshEntities();

      const res = await fetch(`/api/projects/${project.id}/sync-references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renamedEntityId: entityId, oldName, newName, entityType }),
      });
      const data = await res.json() as { programmaticUpdates: string[]; aiSummary: string | null };

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

  async function handleDelete(entityId: string) {
    if (!project) return;
    if (!confirm("Delete this entity and all its children?")) return;
    await deleteEntity(entityId, project.id);
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
              selectedId={selectedEntityId}
            />
          ))
        )}
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

      {/* Rename confirmation dialog — rendered in document.body via portal to escape Allotment's CSS transform stacking context */}
      {pendingRename && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[400px] rounded-lg border bg-background p-5 shadow-xl">
            <h3 className="mb-1 text-sm font-semibold">Rename file?</h3>
            <p className="mb-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">"{pendingRename.oldName}"</span>
              {" → "}
              <span className="font-medium text-foreground">"{pendingRename.newName}"</span>
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
    </div>
  );
}
