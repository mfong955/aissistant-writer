"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Save, History, AlertTriangle, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/project-context";
import { getCanvas, updateCanvasContent, saveCanvasCheckpoint } from "@/lib/api/canvases";
import { CanvasNodePanel } from "./canvas-node-panel";
import { CanvasVersionHistory } from "./canvas-version-history";
import { CanvasFlowNode, type CanvasFlowNodeData } from "./canvas-flow-node";
import type { Entity, CanvasContent, CanvasNode as StoredNode } from "@/types/database";

interface CanvasBoardProps {
  canvasId?: string;
}

type NodeData = CanvasFlowNodeData;

const NODE_TYPES = { canvasNode: CanvasFlowNode };

function toFlowNodes(nodes: StoredNode[]): Node<NodeData>[] {
  return nodes.map((n) => ({
    id: n.id,
    position: n.position,
    type: "canvasNode",
    data: { title: n.title, body: n.body, kind: n.kind, linkedEntityId: n.linkedEntityId, color: n.color },
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
  const [showHistory, setShowHistory] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  const versionHashRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  const load = useCallback(async () => {
    if (!canvasId || !project) return;
    setLoading(true);
    setConflict(false);
    setSelectedNodeId(null);
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
  }, []);

  function addNode() {
    const id = crypto.randomUUID();
    const offset = nodes.length * 24;
    const newNode: Node<NodeData> = {
      id,
      position: { x: 120 + offset, y: 120 + offset },
      type: "canvasNode",
      data: { title: "New Node", body: "", kind: "freeform" },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
    scheduleSave();
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
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
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
