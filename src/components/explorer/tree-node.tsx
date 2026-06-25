"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Trash2, Plus, Pencil, MessageSquarePlus } from "lucide-react";
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
  onMove: (entityId: string, newParentId: string | null) => void;
  onReorder: (draggedId: string, targetId: string, position: "before" | "after") => void;
  selectedId?: string;
}

export function TreeNode({
  node, depth, onSelect, onRename, onDelete, onCreateChild, onMove, onReorder, selectedId,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.entity.name);
  const [dragOver, setDragOver] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<"before" | "after" | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const isFolder = node.entity.type === "folder";
  const isSelected = node.entity.id === selectedId;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!contextMenu) return;
    function close() { setContextMenu(null); }
    document.addEventListener("scroll", close, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    return () => { document.removeEventListener("scroll", close, true); };
  }, [contextMenu]);

  function handleDoubleClick() {
    setEditing(true);
    setEditName(node.entity.name);
  }

  function handleRenameSubmit() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== node.entity.name) onRename(node.entity.id, trimmed);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleRenameSubmit();
    else if (e.key === "Escape") { setEditing(false); setEditName(node.entity.name); }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function handleAddToChat() {
    window.dispatchEvent(new CustomEvent("aissistant:add-to-chat", { detail: { entity: node.entity } }));
    setContextMenu(null);
  }

  function handleDragStart(e: React.DragEvent) {
    e.stopPropagation();
    e.dataTransfer.setData("text/plain", node.entity.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function getDropPosition(e: React.DragEvent): "before" | "after" | "into" {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return "into";
    const relY = e.clientY - rect.top;
    const pct = relY / rect.height;
    if (isFolder && pct > 0.25 && pct < 0.75) return "into";
    return pct < 0.5 ? "before" : "after";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const pos = getDropPosition(e);
    if (pos === "into") { setDragOver(true); setDropIndicator(null); }
    else { setDragOver(false); setDropIndicator(pos); }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.stopPropagation();
    setDragOver(false);
    setDropIndicator(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === node.entity.id) {
      setDragOver(false);
      setDropIndicator(null);
      return;
    }
    const pos = getDropPosition(e);
    if (pos === "into" && isFolder) {
      onMove(draggedId, node.entity.id);
      setExpanded(true);
    } else {
      onReorder(draggedId, node.entity.id, pos === "before" ? "before" : "after");
    }
    setDragOver(false);
    setDropIndicator(null);
  }

  return (
    <div>
      {/* Before-drop indicator */}
      {dropIndicator === "before" && (
        <div className="mx-1 h-0.5 rounded-full bg-primary" style={{ marginLeft: `${depth * 16 + 4}px` }} />
      )}

      <div
        ref={rowRef}
        draggable
        className={cn(
          "group flex items-center gap-1 rounded-sm px-1 py-0.5 text-sm hover:bg-accent",
          isSelected && "bg-accent",
          dragOver && "bg-primary/10 ring-1 ring-primary/40"
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => { if (isFolder) setExpanded(!expanded); onSelect(node.entity.id); }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isFolder ? (
          <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <EntityIcon type={node.entity.type} isOpen={isFolder && expanded} name={node.entity.name} className="h-4 w-4 shrink-0" />
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
            <Button variant="ghost" size="icon" className="h-5 w-5"
              onClick={(e) => { e.stopPropagation(); onCreateChild(node.entity.id); }} title="New child">
              <Plus className="h-3 w-3" />
            </Button>
          )}
          {!isFolder && (
            <Button variant="ghost" size="icon" className="h-5 w-5"
              onClick={(e) => { e.stopPropagation(); handleAddToChat(); }} title="Add to chat">
              <MessageSquarePlus className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-5 w-5"
            onClick={(e) => { e.stopPropagation(); handleDoubleClick(); }} title="Rename">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5"
            onClick={(e) => { e.stopPropagation(); onDelete(node.entity.id); }} title="Delete">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* After-drop indicator */}
      {dropIndicator === "after" && (
        <div className="mx-1 h-0.5 rounded-full bg-primary" style={{ marginLeft: `${depth * 16 + 4}px` }} />
      )}

      {/* Right-click context menu */}
      {contextMenu && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div className="fixed z-50 min-w-[180px] rounded-md border bg-popover py-1 shadow-md"
            style={{ left: contextMenu.x, top: contextMenu.y }}>
            {!isFolder && (
              <>
                <button className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent" onClick={handleAddToChat}>
                  <MessageSquarePlus className="h-3.5 w-3.5 text-primary" />Add to Chat
                </button>
                <div className="my-1 border-t" />
              </>
            )}
            <button className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
              onClick={() => { handleDoubleClick(); setContextMenu(null); }}>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />Rename
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-accent"
              onClick={() => { onDelete(node.entity.id); setContextMenu(null); }}>
              <Trash2 className="h-3.5 w-3.5" />Delete
            </button>
          </div>
        </>,
        document.body
      )}

      {isFolder && expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.entity.id} node={child} depth={depth + 1}
              onSelect={onSelect} onRename={onRename} onDelete={onDelete}
              onCreateChild={onCreateChild} onMove={onMove} onReorder={onReorder}
              selectedId={selectedId} />
          ))}
        </div>
      )}
    </div>
  );
}
