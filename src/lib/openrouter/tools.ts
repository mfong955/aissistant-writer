import type { ToolDefinition } from "./types";
import { getAdminClient } from "@/lib/supabase/admin";
import { textToTiptapJson, extractTextFromTiptap } from "@/lib/tiptap-utils";
import { appendToSessionLog, resolveEntityParent, dbGetEntity, dbUpdateEntity, dbDeleteEntity } from "@/lib/db/entities";
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
        "Move an entity to the Attic (soft delete, recoverable) along with everything nested under it. Use this only when the user explicitly asks to remove an entity. Nothing is destroyed — the writer can restore it later from the Attic.",
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
        "Create a new canvas — an interactive plot/story-mapping board, kept completely separate from the project's real documents until the writer explicitly applies it (not built yet, so for now it's purely a planning surface). Can be seeded with starter nodes and the connections between them in the same call. Pick `layout` based on what the content actually is — don't default to a plain grid for anything that has real structure: " +
        "'timeline' — chronological plot beats/events; order the `nodes` array chronologically and it lays out left-to-right automatically. " +
        "'lanes' — parallel storylines, character arcs, or subplot threads that need to be compared side by side across the same span of time; give each node a `lane` (e.g. a character or subplot name) and same-lane nodes form a row. " +
        "'cluster' — relationship webs, factions, or thematic groupings with no inherent order; give each node a `group` and same-group nodes stay spatially close together. " +
        "'grid' — genuinely unordered freeform notes only; this is not a good default for anything with real chronology or grouping. " +
        "Also: use a consistent color per category across the whole canvas (e.g. every character node the same color, every plot-point node another) rather than random colors per node — color should mean something, and label edges (e.g. 'leads to', 'betrays', 'loves') whenever the relationship type isn't obvious from context alone.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the canvas" },
          layout: {
            type: "string",
            enum: ["timeline", "lanes", "cluster", "grid"],
            description: "How to lay out the starter nodes. See tool description for when to use each — pick based on the actual structure of the content, not by default.",
          },
          nodes: {
            type: "array",
            description: "Optional starter nodes, laid out automatically per `layout`.",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                body: { type: "string", description: "Notes, description, or whatever's relevant for this box." },
                linked_entity_id: { type: "string", description: "Optional — ties this node to a real project entity by ID, from the Project Files list." },
                color: { type: "string", description: "Optional hex color, e.g. #3b82f6. Keep it consistent per category across the canvas." },
                lane: { type: "string", description: "Only meaningful when layout='lanes' — the swimlane this node belongs in (e.g. a character or subplot name)." },
                group: { type: "string", description: "Only meaningful when layout='cluster' — the cluster this node belongs in (e.g. a faction or theme)." },
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
        "Edit an existing canvas: add, update, or remove nodes and edges. Pass only what's actually changing. To connect a newly-added node in the same call, reference it in add_edges as \"new:N\" (N = its 0-indexed position in add_nodes) instead of a real ID. New nodes are positioned automatically: give a `lane` or `group` matching an existing node's to place it alongside that structure (e.g. adding one more event to a character's existing timeline row); without one, it's appended clear of everything else. This deliberately never repositions existing nodes — the writer may have manually arranged them, and moving things without being asked is exactly the kind of silent AI behavior to avoid.",
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
                lane: { type: "string", description: "Match an existing node's lane to place this in the same row." },
                group: { type: "string", description: "Match an existing node's group to place this in the same cluster." },
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
                lane: { type: "string" },
                group: { type: "string" },
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

// A deliberate pause point. Without this, the model's only way to get input mid-task was to
// write a question in prose and hope the turn just... ends there — but with multi-round tool
// access (route.ts's processChat loop), nothing structurally stops it from instead guessing
// and continuing to act across rounds. Calling this tool always ends the turn immediately, no
// matter what round it's in or what other tools were called alongside it (see processChat).
export const interactionTools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "ask_question",
      description:
        "Pause and ask the writer a clarifying question before continuing — use when a real decision point would meaningfully change what you do next and you genuinely don't have enough information to make a reasonable call yourself. This always stops the turn and waits for their reply; nothing else happens until they answer, so don't reach for it on routine choices — for those, make a reasonable decision yourself and just say what you chose and why. Overusing this is its own failure mode: a writer who wanted to just start typing doesn't want to be interviewed first.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question, in plain language." },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Optional short answers shown as clickable buttons — use only when there are a few natural, distinct choices (e.g. picking between named alternatives). Omit entirely for open-ended questions; don't force options onto something that isn't naturally multiple-choice.",
          },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_plan",
      description:
        "Propose a batch of changes to the real project — creates, updates, or flagged issues with no proposed fix — for the writer to review and approve item by item before anything is actually written. See docs/apply-flow.md and docs/consistency-checking.md. Use this instead of create_entity/update_entity specifically when you're about to write several things at once AND the content came from somewhere the writer hasn't already seen and typed themselves — applying a canvas, organizing a document they just uploaded, or a consistency check against Canon they asked for (or a clear contradiction you noticed in passing). For a single item, or content the writer is actively dictating to you in this conversation, use create_entity/update_entity directly instead — don't make them review something they basically just told you to do. Like ask_question, this always ends the turn and waits; nothing is written until they respond.",
      parameters: {
        type: "object",
        properties: {
          source: {
            type: "string",
            enum: ["canvas", "import", "consistency"],
            description: "Where this batch came from — which canvas/import triggered it, or 'consistency' for a contradiction check against Canon.",
          },
          summary: {
            type: "string",
            description: "One or two sentences the writer sees above the list, e.g. \"Found 14 characters, 3 settings, 9 chapters, and 40 pages I couldn't classify.\"",
          },
          items: {
            type: "array",
            description: "The proposed changes or flagged findings. Each becomes one reviewable row.",
            items: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["create", "update", "flag"],
                  description: "flag = a finding with no confident fix — informational only, nothing to apply. Don't force a fix you're not sure of; flag it instead (docs/consistency-checking.md §1).",
                },
                name: { type: "string", description: "Required for action=create." },
                type: {
                  type: "string",
                  enum: ["character", "chapter", "outline", "note", "world_building", "folder", "custom"],
                  description: "Required for action=create.",
                },
                root: {
                  type: "string",
                  enum: ["canon", "manuscript", "unsorted"],
                  description: "Required for action=create — same guidance as create_entity's root param.",
                },
                path: { type: "string", description: "Optional folder path within the root, same convention as create_entity." },
                entity_id: { type: "string", description: "Required for action=update — the entity being changed, from the Project Files list. Optional for flag, if the finding points at a specific entity." },
                content: { type: "string", description: "Required for action=update — the proposed content, in plain text. Omit for flag; there's nothing to apply." },
                quote: { type: "string", description: "For flag (and useful for update) — the specific passage the finding is about." },
                established_fact: { type: "string", description: "For flag/update from a consistency check — what Canon actually says, and where." },
                reason: { type: "string", description: "One line: why this item. E.g. \"appears in 4 scenes, no character sheet yet\" or the contradiction itself in plain language." },
              },
              required: ["action", "reason"],
            },
          },
        },
        required: ["source", "summary", "items"],
      },
    },
  },
];

// Canvas layout. Grounded in two bodies of practice: narrative-planning tools (Plottr-style
// horizontal timelines for chronological beats; swimlanes for parallel arcs/subplots; freeform
// mind-map clustering for relationship webs) and general node-link diagram legibility research
// (minimize edge crossings; group related nodes spatially so adjacency does that work for you
// instead of a crossing-minimization pass; use position and color consistently, not
// decoratively). No force-directed physics or crossing-minimization solver here — deliberately
// left out because good grouping already gets most of that benefit for the graph sizes and
// edge patterns a story-planning canvas actually has (chronological chains, small relationship
// clusters), and a physics sim would add real complexity for a marginal gain at this scale.
const GRID_COLS = 4;
const GRID_SPACING_X = 220;
const GRID_SPACING_Y = 160;
const TIMELINE_SPACING_X = 240;
const TIMELINE_Y = 160;
const LANE_SPACING_X = 240;
const LANE_HEIGHT = 180;
const LANE_ORIGIN_X = 220;
const LANE_ORIGIN_Y = 100;
const CLUSTER_COLS = 3;
const CLUSTER_WIDTH = 700;
const CLUSTER_HEIGHT = 420;
const CLUSTER_IN_GROUP_COLS = 2;
const CLUSTER_IN_GROUP_SPACING_X = 240;
const CLUSTER_IN_GROUP_SPACING_Y = 160;

type Point = { x: number; y: number };

function layoutGrid(count: number): Point[] {
  return Array.from({ length: count }, (_, i) => ({
    x: 120 + (i % GRID_COLS) * GRID_SPACING_X,
    y: 120 + Math.floor(i / GRID_COLS) * GRID_SPACING_Y,
  }));
}

/** Left-to-right in array order = chronological order. For chronological plot beats/events. */
function layoutTimeline(count: number): Point[] {
  return Array.from({ length: count }, (_, i) => ({ x: 120 + i * TIMELINE_SPACING_X, y: TIMELINE_Y }));
}

/** One horizontal row per distinct `lane`, ordered left-to-right within each. For parallel
 *  storylines/character arcs that need to be compared across the same timeframe. */
function layoutLanes(items: { lane?: string }[]): Point[] {
  const laneOrder: string[] = [];
  const posInLane = new Map<string, number>();
  return items.map((item) => {
    const lane = item.lane || "General";
    if (!laneOrder.includes(lane)) laneOrder.push(lane);
    const i = posInLane.get(lane) ?? 0;
    posInLane.set(lane, i + 1);
    return { x: LANE_ORIGIN_X + i * LANE_SPACING_X, y: LANE_ORIGIN_Y + laneOrder.indexOf(lane) * LANE_HEIGHT };
  });
}

/** Nodes sharing a `group` are packed into the same spatial region, distinct groups spread
 *  across a grid of regions. For relationship webs / thematic clusters with no inherent order. */
function layoutCluster(items: { group?: string }[]): Point[] {
  const groupOrder: string[] = [];
  const posInGroup = new Map<string, number>();
  return items.map((item) => {
    const group = item.group || "Ungrouped";
    if (!groupOrder.includes(group)) groupOrder.push(group);
    const groupIndex = groupOrder.indexOf(group);
    const i = posInGroup.get(group) ?? 0;
    posInGroup.set(group, i + 1);
    const originX = 100 + (groupIndex % CLUSTER_COLS) * CLUSTER_WIDTH;
    const originY = 100 + Math.floor(groupIndex / CLUSTER_COLS) * CLUSTER_HEIGHT;
    return {
      x: originX + (i % CLUSTER_IN_GROUP_COLS) * CLUSTER_IN_GROUP_SPACING_X,
      y: originY + Math.floor(i / CLUSTER_IN_GROUP_COLS) * CLUSTER_IN_GROUP_SPACING_Y,
    };
  });
}

function layoutForNewCanvas(
  layout: string | undefined,
  items: { lane?: string; group?: string }[]
): Point[] {
  if (layout === "timeline") return layoutTimeline(items.length);
  if (layout === "lanes") return layoutLanes(items);
  if (layout === "cluster") return layoutCluster(items);
  return layoutGrid(items.length);
}

/**
 * Positions for nodes added to an *existing* canvas via update_canvas. Deliberately doesn't
 * re-run a full-canvas layout — the writer may have manually dragged nodes around, and silently
 * undoing that would be exactly the kind of surprising AI behavior the rest of this app goes out
 * of its way to avoid. Instead: align with existing structure when a lane/group hint points at
 * something already on the board, otherwise append clear of everything else.
 */
function positionForIncrementalAdd(
  existingNodes: CanvasNode[],
  hint: { lane?: string; group?: string },
  indexAmongNew: number
): Point {
  if (hint.lane) {
    const sameLane = existingNodes.filter((n) => n.lane === hint.lane);
    if (sameLane.length > 0) {
      return { x: Math.max(...sameLane.map((n) => n.position.x)) + LANE_SPACING_X, y: sameLane[0].position.y };
    }
    const maxY = existingNodes.length > 0 ? Math.max(...existingNodes.map((n) => n.position.y)) : LANE_ORIGIN_Y - LANE_HEIGHT;
    return { x: LANE_ORIGIN_X, y: maxY + LANE_HEIGHT };
  }
  if (hint.group) {
    const sameGroup = existingNodes.filter((n) => n.group === hint.group);
    if (sameGroup.length > 0) {
      const avgX = sameGroup.reduce((s, n) => s + n.position.x, 0) / sameGroup.length;
      const avgY = sameGroup.reduce((s, n) => s + n.position.y, 0) / sameGroup.length;
      return { x: avgX + 40 * (indexAmongNew + 1), y: avgY + 40 * (indexAmongNew + 1) };
    }
  }
  const maxX = existingNodes.length > 0 ? Math.max(...existingNodes.map((n) => n.position.x)) : 60;
  const maxY = existingNodes.length > 0 ? Math.max(...existingNodes.map((n) => n.position.y)) : 60;
  return { x: maxX + TIMELINE_SPACING_X * (indexAmongNew + 1), y: maxY };
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
      const entity = await dbGetEntity(entityId, projectId);

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

      const entity = await dbGetEntity(entityId, projectId);

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
        await dbUpdateEntity(entityId, projectId, { content, name });

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
      const entity = await dbGetEntity(entityId, projectId);

      if (entity && isExplorerRootEntity(entity as { properties: Record<string, unknown> })) {
        return {
          success: false,
          result: { error: "Canon, Manuscript, and Unsorted are fixed containers and cannot be deleted." },
          description: `Refused to delete fixed root: ${entity.name}`,
        };
      }

      try {
        // Soft delete (docs/attic.md) — archives this entity and its whole subtree, recoverable
        // from the Attic. Never a real hard delete from AI-facing tool calls.
        await dbDeleteEntity(entityId, projectId);

        const now = new Date().toISOString();
        await supabase.from("change_logs").insert({
          id: crypto.randomUUID(),
          project_id: projectId,
          user_id: userId,
          entity_id: entityId,
          action: "delete",
          actor: "ai",
          description: `Moved to Attic: ${entity?.type ?? "entity"} "${entity?.name ?? entityId}"`,
          created_at: now,
        });

        await appendToSessionLog(projectId, userId, `Moved to Attic: ${entity?.type ?? "entity"} "${entity?.name ?? entityId}"`);
        return {
          success: true,
          result: { entity_id: entityId, deleted: true },
          description: `Moved to Attic: ${entity?.type ?? "entity"} "${entity?.name ?? entityId}"`,
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
      const layout = args.layout as string | undefined;
      const rawNodes = (args.nodes as Array<{ title: string; body?: string; linked_entity_id?: string; color?: string; lane?: string; group?: string }> | undefined) ?? [];
      const rawEdges = (args.edges as Array<{ source_index: number; target_index: number; label?: string }> | undefined) ?? [];

      try {
        const canvas = await dbCreateCanvas(projectId, userId, name);

        if (rawNodes.length > 0) {
          const nodeIds = rawNodes.map(() => crypto.randomUUID());
          const positions = layoutForNewCanvas(layout, rawNodes);
          const nodes: CanvasNode[] = rawNodes.map((n, i) => ({
            id: nodeIds[i],
            position: positions[i],
            title: n.title,
            body: n.body ?? "",
            kind: n.linked_entity_id ? "linked" : "freeform",
            linkedEntityId: n.linked_entity_id,
            color: n.color,
            lane: n.lane,
            group: n.group,
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

      const updateNodes = (args.update_nodes as Array<{ id: string; title?: string; body?: string; color?: string; linked_entity_id?: string; lane?: string; group?: string }> | undefined) ?? [];
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
                lane: upd.lane ?? n.lane,
                group: upd.group ?? n.group,
              }
            : n
        );
      }

      // Positioned against existing structure (matching lane/group), never by re-running a
      // full layout — see positionForIncrementalAdd's own reasoning above.
      const addNodes = (args.add_nodes as Array<{ title: string; body?: string; linked_entity_id?: string; color?: string; lane?: string; group?: string }> | undefined) ?? [];
      const newNodeIds: string[] = [];
      const nodesBeforeAdd = nodes;
      addNodes.forEach((n, i) => {
        const id = crypto.randomUUID();
        newNodeIds.push(id);
        nodes.push({
          id,
          position: positionForIncrementalAdd(nodesBeforeAdd, { lane: n.lane, group: n.group }, i),
          title: n.title,
          body: n.body ?? "",
          kind: n.linked_entity_id ? "linked" : "freeform",
          linkedEntityId: n.linked_entity_id,
          color: n.color,
          lane: n.lane,
          group: n.group,
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

    case "ask_question": {
      const question = args.question as string;
      const options = (args.options as string[] | undefined) ?? [];
      return {
        success: true,
        result: { question, options },
        description: `Asked: ${question}`,
      };
    }

    case "propose_plan": {
      // Pure surface-and-pause, like ask_question — never touches the database. Applying a
      // plan is a separate, explicit step (POST /api/plans/apply) executed only once the writer
      // has reviewed and approved specific items; see docs/apply-flow.md §4.
      const source = args.source as string;
      const summary = args.summary as string;
      const rawItems = (args.items as Array<{
        action: "create" | "update" | "flag";
        name?: string;
        type?: string;
        root?: string;
        path?: string;
        entity_id?: string;
        content?: string;
        quote?: string;
        established_fact?: string;
        reason: string;
      }> | undefined) ?? [];

      const items = rawItems.map((item) => ({ id: crypto.randomUUID(), ...item }));

      return {
        success: true,
        result: { source, summary, items },
        description: `Proposed a plan: ${summary}`,
      };
    }

    default:
      return { success: false, result: { error: `Unknown tool: ${toolName}` }, description: `Unknown tool: ${toolName}` };
  }
}
