"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight, Trash2, Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { EntityIcon } from "./entity-icon";
import type { TreeNode as TreeNodeType } from "@/types";
import { Button } from "@/components/ui/button";

interface TreeNodeProps {
  node: TreeNodeType;
  depth: number;
  onSelect: (entityId: string) => void;
  onRename: (entityId: string, newName: string) => void;
  onDelete: (entityId: string) => void;
  onCreateChild: (parentId: string) => void;
  selectedId?: string;
}

export function TreeNode({
  node,
  depth,
  onSelect,
  onRename,
  onDelete,
  onCreateChild,
  selectedId,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.entity.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFolder = node.entity.type === "folder";
  const isSelected = node.entity.id === selectedId;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function handleDoubleClick() {
    setEditing(true);
    setEditName(node.entity.name);
  }

  function handleRenameSubmit() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== node.entity.name) {
      onRename(node.entity.id, trimmed);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setEditing(false);
      setEditName(node.entity.name);
    }
  }

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-sm px-1 py-0.5 text-sm hover:bg-accent",
          isSelected && "bg-accent"
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => {
          if (isFolder) setExpanded(!expanded);
          onSelect(node.entity.id);
        }}
        onDoubleClick={handleDoubleClick}
      >
        {isFolder ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-90"
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <EntityIcon
          type={node.entity.type}
          isOpen={isFolder && expanded}
          name={node.entity.name}
          className="h-4 w-4 shrink-0"
        />
        {editing ? (
          <input
            ref={inputRef}
            className="flex-1 rounded bg-background px-1 text-sm outline-none ring-1 ring-ring"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span className="flex-1 truncate">{node.entity.name}</span>
        )}
        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          {isFolder && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                onCreateChild(node.entity.id);
              }}
              title="New child"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={(e) => {
              e.stopPropagation();
              handleDoubleClick();
            }}
            title="Rename"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.entity.id);
            }}
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {isFolder && expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.entity.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onCreateChild={onCreateChild}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
