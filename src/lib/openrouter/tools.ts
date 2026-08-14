import type { ToolDefinition } from "./types";
import { getAdminClient } from "@/lib/supabase/admin";
import { textToTiptapJson, extractTextFromTiptap } from "@/lib/tiptap-utils";
import { appendToSessionLog, resolveEntityParent } from "@/lib/db/entities";
import { dbGetCanvas, dbCreateCanvas, dbUpdateCanvasContent } from "@/lib/db/canvas";
import { isExplorerRootEntity, type ExplorerRootKey } from "@/lib/entity-roots";
import type { EntityType, CanvasContent, CanvasNode, CanvasEdge } from "@/types/database";

const EXPLORER_ROOT_KEYS: ExplorerRootKey[] = ["canon", "manuscript", "unsorted"];

export const entityTools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_entity",
      description:
        "Read the full content of a project entity. Use this to inspect the current content of a character, chapter, or other entity before making changes or when you need to reference specific details.",
      parameters: {
        type: "object",
        properties: {
          entity_id: {
            type: "string",
            description: "The ID of the entity to read (from the Project Files list)",
          },
        },
        required: ["entity_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_entity",
      description:
        "Create a new entity in the project (character, chapter, outline, note, world_building, folder, or custom). Every entity must be placed under one of three fixed top-level roots: 'canon' (durable story facts — characters, settings, timeline, rules; survives every rewrite), 'manuscript' (the actual draft — scenes, chapters; disposable and replaceable), or 'unsorted' (anything you're not confident how to classify). Use `path` to nest inside folders within that root, e.g. 'Characters' or 'Settings/Locations' — folders are created automatically as needed. When uncertain where something belongs, use root='unsorted' rather than guessing or inventing a new top-level location.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the entity" },
          type: {
            type: "string",
            enum: ["character", "chapter", "outline", "note", "world_building", "folder", "custom"],
            description: "Type of entity to create",
          },
          content: {
            type: "string",
            description: "The content for the entity in plain text. This will be converted to the editor format.",
          },
          root: {
            type: "string",
            enum: ["canon", "manuscript", "unsorted"],
            description: "Which fixed top-level container to place this entity under. canon = durable story facts (characters, settings, timeline, rules). manuscript = the draft itself (scenes, chapters). unsorted = anything ambiguous — the safe default when unsure.",
          },
          path: {
            type: "string",
            description: "Optional folder path within the root, e.g. 'Characters' or 'Locations/Capital City'. Folders are created automatically if they don't already exist. Omit to place the entity directly under the root.",
          },
        },
        required: ["name", "type", "content", "root"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_entity",
      description:
        "Update an existing entity's content. Use this when the user wants to modify an existing character, chapter, or other entity.",
      parameters: {
        type: "object",
        properties: {
          entity_id: { type: "string", description: "The ID of the entity to update" },
          content: { type: "string", description: "The new content for the entity in plain text." },
          name: { type: "string", description: "New name for the entity (only if renaming)" },
        },
        required: ["entity_id", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_entity",
      description:
        "Delete an entity from the project. Use this only when the user explicitly asks to remove an entity.",
      parameters: {
        type: "object",
        properties: {
          entity_id: { type: "string", description: "The ID of the entity to delete" },
        },
        required: ["entity_id"],
      },
    },
  },
];

// A canvas is a visual plot/story-mapping board (docs/canvas-mode.md), never a document.
// It's separate from the Canon/Manuscript/Unsorted tree and read_entity/create_entity/
// update_entity refuse to touch it — these are the canvas-specific equivalents. Canvas edits
// are direct, no confirmation step: the canvas is a sandbox the writer can always undo via its
// own version history, and nothing here ever writes to the real project until the writer uses
// the (not yet built) "Apply to Project" step.
export const canvasTools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_canvas",
      description:
        "Read a canvas's full node/edge graph — a visual plot/story board, not a document. Use this before editing a canvas, or when asked to interpret, summarize, or explain one.",
      parameters: {
        type: "object",
        properties: {
          canvas_id: { type: "string", description: "The ID of the canvas to read (from the Canvases list)" },
        },
        required: ["canvas_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_canvas",
      description:
        "Create a new canvas — an interactive plot/story-mapping board, kept completely separate from the project's real documents until the writer explicitly applies it (not built yet, so for now it's purely a planning surface). Can be seeded with starter nodes and the connections between them in the same call.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the canvas" },
          nodes: {
            type: "array",
            description: "Optional starter nodes, laid out automatically.",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                body: { type: "string", description: "Notes, description, or whatever's relevant for this box." },
                linked_entity_id: { type: "string", description: "Optional — ties this node to a real project entity by ID, from the Project Files list." },
                color: { type: "string", description: "Optional hex color, e.g. #3b82f6." },
              },
              required: ["title"],
            },
          },
          edges: {
            type: "array",
            description: "Optional connections between the nodes above, referenced by their 0-indexed position in the `nodes` array (they don't have real IDs yet within this call).",
            items: {
              type: "object",
              properties: {
                source_index: { type: "number", description: "Index into `nodes` for the connection's start." },
                target_index: { type: "number", description: "Index into `nodes` for the connection's end." },
                label: { type: "string" },
              },
              required: ["source_index", "target_index"],
            },
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_canvas",
      description:
        "Edit an existing canvas: add, update, or remove nodes and edges. Pass only what's actually changing. To connect a newly-added node in the same call, reference it in add_edges as \"new:N\" (N = its 0-indexed position in add_nodes) instead of a real ID.",
      parameters: {
        type: "object",
        properties: {
          canvas_id: { type: "string", description: "The ID of the canvas to edit" },
          add_nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                body: { type: "string" },
                linked_entity_id: { type: "string" },
                color: { type: "string" },
              },
              required: ["title"],
            },
          },
          update_nodes: {
            type: "array",
            description: "Partial updates to existing nodes by ID — only include fields that are changing.",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                body: { type: "string" },
                linked_entity_id: { type: "string" },
                color: { type: "string" },
              },
              required: ["id"],
            },
          },
          remove_node_ids: { type: "array", items: { type: "string" } },
          add_edges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source: { type: "string", description: "A real node ID, or \"new:N\" referencing add_nodes." },
                target: { type: "string", description: "A real node ID, or \"new:N\" referencing add_nodes." },
                label: { type: "string" },
              },
              required: ["source", "target"],
            },
          },
          remove_edge_ids: { type: "array", items: { type: "string" } },
        },
        required: ["canvas_id"],
      },
    },
  },
];

function layoutPosition(index: number): { x: number; y: number } {
  return { x: 120 + (index % 4) * 220, y: 120 + Math.floor(index / 4) * 160 };
}

function resolveNodeRef(ref: string, newNodeIds: string[]): string {
  if (ref.startsWith("new:")) {
    const idx = parseInt(ref.slice(4), 10);
    return newNodeIds[idx] ?? ref;
  }
  return ref;
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  projectId: string,
  userId: string
): Promise<{ success: boolean; result: Record<string, unknown>; description: string }> {
  const supabase = getAdminClient();

  switch (toolName) {
    case "read_entity": {
      const entityId = args.entity_id as string;
      const { data: entity } = await supabase
        .from("entities")
        .select("id, name, type, content")
        .eq("id", entityId)
        .eq("project_id", projectId)
        .single();

      if (!entity) {
        return { success: false, result: { error: "Entity not found" }, description: `Failed to read entity ${entityId}` };
      }
      if (entity.type === "canvas") {
        return {
          success: false,
          result: { error: "This is a canvas, not a document — read_entity can't interpret it. Canvas AI access isn't available yet." },
          description: `Refused to read canvas: ${entity.name}`,
        };
      }

      const contentText = entity.content
        ? extractTextFromTiptap(entity.content as Record<string, unknown>)
        : "(empty)";

      return {
        success: true,
        result: { entity_id: entity.id, name: entity.name, type: entity.type, content: contentText },
        description: `Read ${entity.type}: ${entity.name}`,
      };
    }

    case "create_entity": {
      const rootArg = args.root as string;
      if (!EXPLORER_ROOT_KEYS.includes(rootArg as ExplorerRootKey)) {
        return {
          success: false,
          result: { error: `Invalid root "${rootArg}". Must be one of: canon, manuscript, unsorted.` },
          description: `Failed to create ${args.name as string}: invalid root`,
        };
      }
      const root = rootArg as ExplorerRootKey;
      const content = textToTiptapJson(args.content as string);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      try {
        const parentId = await resolveEntityParent(projectId, userId, root, args.path as string | undefined);
        await supabase.from("entities").insert({
          id,
          project_id: projectId,
          user_id: userId,
          name: args.name as string,
          type: args.type as EntityType,
          content,
          parent_id: parentId,
          sort_order: 0,
          properties: {},
          created_at: now,
          updated_at: now,
        });

        await supabase.from("change_logs").insert({
          id: crypto.randomUUID(),
          project_id: projectId,
          user_id: userId,
          entity_id: id,
          action: "create",
          actor: "ai",
          description: `Created ${args.type as string}: ${args.name as string}`,
          created_at: now,
        });

        await appendToSessionLog(projectId, userId, `Created ${args.type as string}: ${args.name as string}`);
        return {
          success: true,
          result: { entity_id: id, name: args.name as string, type: args.type as string },
          description: `Created ${args.type as string}: ${args.name as string}`,
        };
      } catch (err) {
        return {
          success: false,
          result: { error: err instanceof Error ? err.message : "Unknown error" },
          description: `Failed to create ${args.type as string}: ${args.name as string}`,
        };
      }
    }

    case "update_entity": {
      const entityId = args.entity_id as string;
      const content = textToTiptapJson(args.content as string);
      const now = new Date().toISOString();

      const { data: entity } = await supabase
        .from("entities")
        .select("name, type, properties")
        .eq("id", entityId)
        .eq("project_id", projectId)
        .single();

      if (!entity) {
        return { success: false, result: { error: "Entity not found" }, description: `Failed to update entity ${entityId}` };
      }
      if (isExplorerRootEntity(entity as { properties: Record<string, unknown> })) {
        return {
          success: false,
          result: { error: "Canon, Manuscript, and Unsorted are fixed containers and cannot be edited." },
          description: `Refused to update fixed root: ${entity.name}`,
        };
      }
      if (entity.type === "canvas") {
        return {
          success: false,
          result: { error: "This is a canvas, not a document — update_entity can't write to it. Canvas AI access isn't available yet." },
          description: `Refused to update canvas: ${entity.name}`,
        };
      }

      const name = (args.name as string | undefined) || entity.name;

      try {
        await supabase
          .from("entities")
          .update({ content, name, updated_at: now })
          .eq("id", entityId)
          .eq("project_id", projectId);

        await supabase.from("change_logs").insert({
          id: crypto.randomUUID(),
          project_id: projectId,
          user_id: userId,
          entity_id: entityId,
          action: "update",
          actor: "ai",
          description: `Updated ${entity.type as string}: ${name}`,
          created_at: now,
        });

        await appendToSessionLog(projectId, userId, `Updated ${entity.type as string}: ${name}`);
        return {
          success: true,
          result: { entity_id: entityId, name, type: entity.type },
          description: `Updated ${entity.type as string}: ${name}`,
        };
      } catch (err) {
        return {
          success: false,
          result: { error: err instanceof Error ? err.message : "Unknown error" },
          description: `Failed to update entity ${entityId}`,
        };
      }
    }

    case "delete_entity": {
      const entityId = args.entity_id as string;
      const { data: entity } = await supabase
        .from("entities")
        .select("name, type, properties")
        .eq("id", entityId)
        .eq("project_id", projectId)
        .single();

      if (entity && isExplorerRootEntity(entity as { properties: Record<string, unknown> })) {
        return {
          success: false,
          result: { error: "Canon, Manuscript, and Unsorted are fixed containers and cannot be deleted." },
          description: `Refused to delete fixed root: ${entity.name}`,
        };
      }

      try {
        await supabase
          .from("entities")
          .delete()
          .eq("id", entityId)
          .eq("project_id", projectId);

        const now = new Date().toISOString();
        await supabase.from("change_logs").insert({
          id: crypto.randomUUID(),
          project_id: projectId,
          user_id: userId,
          entity_id: entityId,
          action: "delete",
          actor: "ai",
          description: `Deleted ${entity?.type ?? "entity"}: ${entity?.name ?? entityId}`,
          created_at: now,
        });

        await appendToSessionLog(projectId, userId, `Deleted ${entity?.type ?? "entity"}: ${entity?.name ?? entityId}`);
        return {
          success: true,
          result: { entity_id: entityId, deleted: true },
          description: `Deleted ${entity?.type ?? "entity"}: ${entity?.name ?? entityId}`,
        };
      } catch (err) {
        return {
          success: false,
          result: { error: err instanceof Error ? err.message : "Unknown error" },
          description: `Failed to delete entity ${entityId}`,
        };
      }
    }

    case "read_canvas": {
      const canvasId = args.canvas_id as string;
      const canvas = await dbGetCanvas(canvasId, projectId);
      if (!canvas) {
        return { success: false, result: { error: "Canvas not found" }, description: `Failed to read canvas ${canvasId}` };
      }
      const content = (canvas.content ?? { nodes: [], edges: [] }) as unknown as CanvasContent;
      return {
        success: true,
        result: { canvas_id: canvas.id, name: canvas.name, nodes: content.nodes, edges: content.edges },
        description: `Read canvas: ${canvas.name} (${content.nodes.length} node(s), ${content.edges.length} edge(s))`,
      };
    }

    case "create_canvas": {
      const name = args.name as string;
      const rawNodes = (args.nodes as Array<{ title: string; body?: string; linked_entity_id?: string; color?: string }> | undefined) ?? [];
      const rawEdges = (args.edges as Array<{ source_index: number; target_index: number; label?: string }> | undefined) ?? [];

      try {
        const canvas = await dbCreateCanvas(projectId, userId, name);

        if (rawNodes.length > 0) {
          const nodeIds = rawNodes.map(() => crypto.randomUUID());
          const nodes: CanvasNode[] = rawNodes.map((n, i) => ({
            id: nodeIds[i],
            position: layoutPosition(i),
            title: n.title,
            body: n.body ?? "",
            kind: n.linked_entity_id ? "linked" : "freeform",
            linkedEntityId: n.linked_entity_id,
            color: n.color,
          }));
          const edges: CanvasEdge[] = rawEdges
            .filter((e) => nodeIds[e.source_index] && nodeIds[e.target_index])
            .map((e) => ({
              id: crypto.randomUUID(),
              source: nodeIds[e.source_index],
              target: nodeIds[e.target_index],
              label: e.label,
            }));

          const result = await dbUpdateCanvasContent(canvas.id, projectId, { nodes, edges }, canvas.version_hash);
          if (!result.ok) {
            return {
              success: false,
              result: { error: "Canvas was created but changed before its starter nodes could be added — try update_canvas instead." },
              description: `Created canvas "${name}" but failed to seed it`,
            };
          }
        }

        await appendToSessionLog(projectId, userId, `Created canvas: ${name}`);
        return {
          success: true,
          result: { canvas_id: canvas.id, name, node_count: rawNodes.length },
          description: `Created canvas: ${name}${rawNodes.length ? ` with ${rawNodes.length} node(s)` : ""}`,
        };
      } catch (err) {
        return {
          success: false,
          result: { error: err instanceof Error ? err.message : "Unknown error" },
          description: `Failed to create canvas: ${name}`,
        };
      }
    }

    case "update_canvas": {
      const canvasId = args.canvas_id as string;
      const canvas = await dbGetCanvas(canvasId, projectId);
      if (!canvas) {
        return { success: false, result: { error: "Canvas not found" }, description: `Failed to update canvas ${canvasId}` };
      }

      const content = (canvas.content ?? { nodes: [], edges: [] }) as unknown as CanvasContent;
      let nodes = [...content.nodes];
      let edges = [...content.edges];

      const removeNodeIds = new Set((args.remove_node_ids as string[] | undefined) ?? []);
      if (removeNodeIds.size > 0) {
        nodes = nodes.filter((n) => !removeNodeIds.has(n.id));
        edges = edges.filter((e) => !removeNodeIds.has(e.source) && !removeNodeIds.has(e.target));
      }

      const updateNodes = (args.update_nodes as Array<{ id: string; title?: string; body?: string; color?: string; linked_entity_id?: string }> | undefined) ?? [];
      for (const upd of updateNodes) {
        nodes = nodes.map((n) =>
          n.id === upd.id
            ? {
                ...n,
                title: upd.title ?? n.title,
                body: upd.body ?? n.body,
                color: upd.color ?? n.color,
                linkedEntityId: upd.linked_entity_id ?? n.linkedEntityId,
                kind: (upd.linked_entity_id ?? n.linkedEntityId) ? "linked" : n.kind,
              }
            : n
        );
      }

      const addNodes = (args.add_nodes as Array<{ title: string; body?: string; linked_entity_id?: string; color?: string }> | undefined) ?? [];
      const newNodeIds: string[] = [];
      addNodes.forEach((n, i) => {
        const id = crypto.randomUUID();
        newNodeIds.push(id);
        nodes.push({
          id,
          position: layoutPosition(nodes.length + i),
          title: n.title,
          body: n.body ?? "",
          kind: n.linked_entity_id ? "linked" : "freeform",
          linkedEntityId: n.linked_entity_id,
          color: n.color,
        });
      });

      const removeEdgeIds = new Set((args.remove_edge_ids as string[] | undefined) ?? []);
      if (removeEdgeIds.size > 0) edges = edges.filter((e) => !removeEdgeIds.has(e.id));

      const addEdges = (args.add_edges as Array<{ source: string; target: string; label?: string }> | undefined) ?? [];
      for (const e of addEdges) {
        edges.push({
          id: crypto.randomUUID(),
          source: resolveNodeRef(e.source, newNodeIds),
          target: resolveNodeRef(e.target, newNodeIds),
          label: e.label,
        });
      }

      try {
        const result = await dbUpdateCanvasContent(canvasId, projectId, { nodes, edges }, canvas.version_hash);
        if (!result.ok) {
          return {
            success: false,
            result: { error: "This canvas changed elsewhere just now — read it again before retrying." },
            description: `Failed to update canvas: ${canvas.name}`,
          };
        }
        await appendToSessionLog(projectId, userId, `Updated canvas: ${canvas.name}`);
        return {
          success: true,
          result: { canvas_id: canvasId, node_count: nodes.length, edge_count: edges.length },
          description: `Updated canvas: ${canvas.name}`,
        };
      } catch (err) {
        return {
          success: false,
          result: { error: err instanceof Error ? err.message : "Unknown error" },
          description: `Failed to update canvas: ${canvas.name}`,
        };
      }
    }

    default:
      return { success: false, result: { error: `Unknown tool: ${toolName}` }, description: `Unknown tool: ${toolName}` };
  }
}
