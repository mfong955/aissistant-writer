"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Save, History, AlertTriangle, Workflow, Map as MapIcon, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProject } from "@/contexts/project-context";
import { getCanvas, updateCanvasContent, saveCanvasCheckpoint } from "@/lib/api/canvases";
import { CanvasNodePanel } from "./canvas-node-panel";
import { CanvasEdgePanel } from "./canvas-edge-panel";
import { CanvasVersionHistory } from "./canvas-version-history";
import { CanvasFlowNode, type CanvasFlowNodeData } from "./canvas-flow-node";
import { CanvasFrameNode, type CanvasFrameNodeType } from "./canvas-frame-node";
import type { Entity, CanvasContent, CanvasNode as StoredNode } from "@/types/database";

interface CanvasBoardProps {
  canvasId?: string;
}

type NodeData = CanvasFlowNodeData;

const NODE_TYPES = { canvasNode: CanvasFlowNode, frame: CanvasFrameNode };

// Rough rendered size of a node — just enough for frame padding to look right, not pixel-exact.
const APPROX_NODE_WIDTH = 220;
const APPROX_NODE_HEIGHT = 100;
const FRAME_PADDING = 40;
const FRAME_LABEL_SPACE = 28;

/** Derives labeled backdrop frames from current node positions — see canvas-frame-node.tsx. */
function computeFrames(nodes: Node<NodeData>[]): CanvasFrameNodeType[] {
  const groups = new Map<string, Node<NodeData>[]>();
  for (const n of nodes) {
    const key = n.data.lane ? `lane:${n.data.lane}` : n.data.group ? `group:${n.data.group}` : null;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }

  const frames: CanvasFrameNodeType[] = [];
  for (const [key, members] of groups) {
    const minX = Math.min(...members.map((m) => m.position.x));
    const minY = Math.min(...members.map((m) => m.position.y));
    const maxX = Math.max(...members.map((m) => m.position.x)) + APPROX_NODE_WIDTH;
    const maxY = Math.max(...members.map((m) => m.position.y)) + APPROX_NODE_HEIGHT;
    const width = maxX - minX + FRAME_PADDING * 2;
    const height = maxY - minY + FRAME_PADDING * 2 + FRAME_LABEL_SPACE;
    frames.push({
      id: `frame-${key}`,
      type: "frame",
      position: { x: minX - FRAME_PADDING, y: minY - FRAME_PADDING - FRAME_LABEL_SPACE },
      data: { label: key.slice(key.indexOf(":") + 1), width, height },
      draggable: false,
      selectable: false,
      zIndex: -1,
    });
  }
  return frames;
}

function toFlowNodes(nodes: StoredNode[]): Node<NodeData>[] {
  return nodes.map((n) => ({
    id: n.id,
    position: n.position,
    type: "canvasNode",
    data: {
      title: n.title,
      body: n.body,
      kind: n.kind,
      linkedEntityId: n.linkedEntityId,
      color: n.color,
      lane: n.lane,
      group: n.group,
    },
  }));
}

function toFlowEdges(edges: CanvasContent["edges"]): Edge[] {
  return edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label }));
}

function toStoredContent(nodes: Node<NodeData>[], edges: Edge[]): CanvasContent {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      position: n.position,
      title: n.data.title,
      body: n.data.body,
      kind: n.data.kind,
      linkedEntityId: n.data.linkedEntityId,
      color: n.data.color,
      lane: n.data.lane,
      group: n.data.group,
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: typeof e.label === "string" ? e.label : undefined })),
  };
}

export function CanvasBoard({ canvasId }: CanvasBoardProps) {
  const { project, entities } = useProject();
  const [canvasEntity, setCanvasEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  const versionHashRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const reactFlowRef = useRef<ReactFlowInstance<Node<NodeData>, Edge> | null>(null);

  const load = useCallback(async () => {
    if (!canvasId || !project) return;
    setLoading(true);
    setConflict(false);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    const canvas = await getCanvas(canvasId, project.id);
    if (canvas) {
      const content = (canvas.content ?? { nodes: [], edges: [] }) as unknown as CanvasContent;
      setNodes(toFlowNodes(content.nodes));
      setEdges(toFlowEdges(content.edges));
      versionHashRef.current = canvas.version_hash;
      setCanvasEntity(canvas);
    }
    dirtyRef.current = false;
    setLoading(false);
  }, [canvasId, project, setNodes, setEdges]);

  useEffect(() => {
    load();
  }, [load]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!canvasId || !project || !dirtyRef.current || conflict) return;
      dirtyRef.current = false;
      setSaving(true);
      const content = toStoredContent(nodes, edges);
      const result = await updateCanvasContent(canvasId, project.id, content, versionHashRef.current);
      setSaving(false);
      if (!result.ok) {
        setConflict(true);
        return;
      }
      versionHashRef.current = result.canvas.version_hash;
    }, 1200);
  }, [canvasId, project, nodes, edges, conflict]);

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  function handleNodesChange(changes: Parameters<typeof onNodesChange>[0]) {
    onNodesChange(changes);
    scheduleSave();
  }

  function handleEdgesChange(changes: Parameters<typeof onEdgesChange>[0]) {
    onEdgesChange(changes);
    scheduleSave();
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, id: crypto.randomUUID() }, eds));
      scheduleSave();
    },
    [setEdges, scheduleSave]
  );

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick: EdgeMouseHandler = useCallback((_e, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  function addNode() {
    const id = crypto.randomUUID();
    const offset = nodes.length * 24;
    const newNode: Node<NodeData> = {
      id,
      position: { x: 120 + offset, y: 120 + offset },
      type: "canvasNode",
      data: { title: "New Node", body: "", kind: "freeform" },
      // Programmatic add bypasses React Flow's own click-to-select handling, so without this
      // the new node would neither show the "selected" ring nor be scrolled into view — it'd
      // exist, but be invisible/indistinguishable, which reads as "nothing happened."
      selected: true,
    };
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), newNode]);
    setSelectedNodeId(id);
    scheduleSave();
    // Bring it into view regardless of current pan/zoom — same reasoning as above.
    requestAnimationFrame(() => {
      reactFlowRef.current?.fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.25 });
    });
  }

  function updateSelectedNode(updates: Partial<NodeData>) {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...updates } } : n)));
    scheduleSave();
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
    scheduleSave();
  }

  function updateSelectedEdgeLabel(label: string) {
    if (!selectedEdgeId) return;
    setEdges((eds) => eds.map((e) => (e.id === selectedEdgeId ? { ...e, label } : e)));
    scheduleSave();
  }

  function deleteSelectedEdge() {
    if (!selectedEdgeId) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
    scheduleSave();
  }

  async function checkpoint() {
    if (!canvasId || !project) return;
    const content = toStoredContent(nodes, edges);
    const label = prompt("Label for this checkpoint (optional):") ?? undefined;
    await saveCanvasCheckpoint(canvasId, project.id, content, label || undefined);
  }

  async function reloadAfterConflict() {
    await load();
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const frameNodes = useMemo(() => computeFrames(nodes), [nodes]);
  const renderedNodes = useMemo(() => [...frameNodes, ...nodes], [frameNodes, nodes]);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  if (!canvasId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <Workflow className="h-10 w-10 opacity-30" />
        <p>Select or create a canvas to start mapping.</p>
      </div>
    );
  }

  if (loading || !canvasEntity) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading canvas…</div>;
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-1 border-b px-2 py-1">
          <span className="mr-2 truncate text-sm font-medium">{canvasEntity.name}</span>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={addNode}>
            <Plus className="h-3.5 w-3.5" /> Node
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={checkpoint}>
            <Save className="h-3.5 w-3.5" /> Checkpoint
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="h-3.5 w-3.5" /> History
          </Button>
          <Button
            variant="ghost" size="sm"
            className={cn("h-7 gap-1.5 text-xs", showMiniMap && "bg-accent")}
            onClick={() => setShowMiniMap((v) => !v)}
            title={showMiniMap ? "Hide minimap" : "Show minimap"}
          >
            <MapIcon className="h-3.5 w-3.5" /> Map
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("aissistant:canvas-apply", {
                  detail: { canvasId, canvasName: canvasEntity.name },
                })
              );
            }}
            title="Ask the AI to propose applying this canvas to your project"
          >
            <Send className="h-3.5 w-3.5" /> Apply to Project
          </Button>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {saving ? "Saving…" : "Never propagates to your project until you apply it"}
          </span>
        </div>

        {conflict && (
          <div className="flex items-center gap-2 border-b bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">
              This canvas changed elsewhere (another tab, another browser) since you loaded it. Your recent edits weren&apos;t saved.
            </span>
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={reloadAfterConflict}>
              Reload
            </Button>
          </div>
        )}

        <div className="flex-1">
          <ReactFlow
            // Frame backdrops are a different node-data shape (label/width/height, not
            // title/body/kind) rendered by their own component — React Flow supports mixed
            // node types at runtime, but typing every handler for the union isn't worth it
            // for nodes that are draggable:false/selectable:false and never round-trip
            // through onNodesChange in a way that touches CanvasFlowNodeData's fields.
            nodes={renderedNodes as Node<NodeData>[]}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onInit={(instance) => { reactFlowRef.current = instance; }}
            fitView
          >
            <Background />
            <Controls />
            {showMiniMap && <MiniMap pannable zoomable />}
          </ReactFlow>
        </div>
      </div>

      {selectedNode && (
        <CanvasNodePanel
          node={{
            id: selectedNode.id,
            position: selectedNode.position,
            title: selectedNode.data.title,
            body: selectedNode.data.body,
            kind: selectedNode.data.kind,
            linkedEntityId: selectedNode.data.linkedEntityId,
            color: selectedNode.data.color,
          }}
          entities={entities}
          onChange={updateSelectedNode}
          onDelete={deleteSelectedNode}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      {selectedEdge && (
        <CanvasEdgePanel
          edge={{ id: selectedEdge.id, label: typeof selectedEdge.label === "string" ? selectedEdge.label : undefined }}
          onChange={updateSelectedEdgeLabel}
          onDelete={deleteSelectedEdge}
          onClose={() => setSelectedEdgeId(null)}
        />
      )}

      {showHistory && project && (
        <CanvasVersionHistory
          canvasId={canvasId}
          projectId={project.id}
          onClose={() => setShowHistory(false)}
          onRestored={load}
        />
      )}
    </div>
  );
}
