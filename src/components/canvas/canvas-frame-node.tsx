"use client";

import type { NodeProps, Node } from "@xyflow/react";

export interface CanvasFrameNodeData extends Record<string, unknown> {
  label: string;
  width: number;
  height: number;
}

export type CanvasFrameNodeType = Node<CanvasFrameNodeData, "frame">;

/**
 * A purely visual, non-interactive backdrop rendered behind nodes that share a lane/group —
 * the "frames around groups of nodes" pattern that graph-UX research consistently calls out
 * as the highest-leverage way to make a node-link diagram legible (see the layout comment in
 * tools.ts). Computed fresh from node positions on every render (see computeFrames in
 * canvas-board.tsx) rather than stored — it can never drift out of sync with where the nodes
 * actually are, and there's nothing to persist or for a concurrent edit to conflict on.
 */
export function CanvasFrameNode({ data }: NodeProps<CanvasFrameNodeType>) {
  return (
    <div
      style={{ width: data.width, height: data.height }}
      className="relative rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/5"
    >
      <span className="absolute -top-6 left-1 whitespace-nowrap text-xs font-medium text-muted-foreground">
        {data.label}
      </span>
    </div>
  );
}
