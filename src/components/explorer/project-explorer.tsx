"use client";

import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/project-context";
import { buildTree } from "@/lib/entity-tree";
import { createEntity, updateEntity, deleteEntity } from "@/lib/api/entities";
import { TreeNode } from "./tree-node";
import { CreateEntityDialog } from "./create-entity-dialog";
import { EntityIcon } from "./entity-icon";
import type { EntityType } from "@/types/database";

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

  const instructionsEntity = useMemo(
    () => entities.find((e) => e.name === "AI Instructions" && e.parent_id === null),
    [entities]
  );

  const tree = useMemo(
    () => buildTree(entities.filter((e) => e.name !== "AI Instructions" || e.parent_id !== null)),
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

  async function handleRename(entityId: string, newName: string) {
    if (!project) return;
    await updateEntity(entityId, { project_id: project.id, name: newName });
    await refreshEntities();
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
        {/* AI Instructions — pinned at top */}
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
        {tree.length === 0 && !instructionsEntity ? (
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
    </div>
  );
}
