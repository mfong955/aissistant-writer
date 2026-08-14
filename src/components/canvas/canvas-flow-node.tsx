"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CanvasFlowNodeData extends Record<string, unknown> {
  title: string;
  body: string;
  kind: "freeform" | "linked";
  linkedEntityId?: string;
  color?: string;
  lane?: string;
  group?: string;
}

export type CanvasFlowNodeType = Node<CanvasFlowNodeData, "canvasNode">;

const DEFAULT_COLOR = "#64748b";

export function CanvasFlowNode({ data, selected }: NodeProps<CanvasFlowNodeType>) {
  const color = data.color || DEFAULT_COLOR;
  return (
    <div
      className={cn(
        "min-w-[160px] max-w-[220px] rounded-lg border-2 bg-card px-3 py-2 shadow-sm",
        selected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
      style={{ borderColor: color }}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-center gap-1">
        {data.kind === "linked" && <LinkIcon className="h-3 w-3 shrink-0 text-muted-foreground" />}
        <span className="truncate text-sm font-medium">{data.title || "Untitled"}</span>
      </div>
      {data.body && (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{data.body}</p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}
