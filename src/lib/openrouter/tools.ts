import type { ToolDefinition } from "./types";
import { getAdminClient } from "@/lib/supabase/admin";
import { textToTiptapJson, extractTextFromTiptap } from "@/lib/tiptap-utils";
import { appendToSessionLog, resolveEntityParent } from "@/lib/db/entities";
import { isExplorerRootEntity, type ExplorerRootKey } from "@/lib/entity-roots";
import type { EntityType } from "@/types/database";

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

    default:
      return { success: false, result: { error: `Unknown tool: ${toolName}` }, description: `Unknown tool: ${toolName}` };
  }
}
