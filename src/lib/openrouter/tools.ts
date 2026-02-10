import type { ToolDefinition } from "./types";
import { createClient } from "@/lib/supabase/server";
import { textToTiptapJson, extractTextFromTiptap } from "@/lib/tiptap-utils";
import type { EntityType } from "@/types/database";

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
            description:
              "The ID of the entity to read (from the Project Files list)",
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
        "Create a new entity in the project (character, chapter, outline, note, world_building, folder, or custom). Use this when the user describes a new character, chapter, scene, or any other content that should be stored as a separate file.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of the entity",
          },
          type: {
            type: "string",
            enum: [
              "character",
              "chapter",
              "outline",
              "note",
              "world_building",
              "folder",
              "custom",
            ],
            description: "Type of entity to create",
          },
          content: {
            type: "string",
            description:
              "The content for the entity in plain text. This will be converted to the editor format.",
          },
          parent_id: {
            type: "string",
            description:
              "ID of the parent folder to create this entity in. Omit to create at root level.",
          },
        },
        required: ["name", "type", "content"],
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
          entity_id: {
            type: "string",
            description: "The ID of the entity to update",
          },
          content: {
            type: "string",
            description: "The new content for the entity in plain text.",
          },
          name: {
            type: "string",
            description: "New name for the entity (only if renaming)",
          },
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
          entity_id: {
            type: "string",
            description: "The ID of the entity to delete",
          },
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
  const supabase = await createClient();

  switch (toolName) {
    case "read_entity": {
      const entityId = args.entity_id as string;

      const { data: entity, error } = await supabase
        .from("entities")
        .select("id, name, type, content")
        .eq("id", entityId)
        .eq("project_id", projectId)
        .single();

      if (error || !entity) {
        return {
          success: false,
          result: { error: error?.message || "Entity not found" },
          description: `Failed to read entity ${entityId}`,
        };
      }

      const contentText = entity.content
        ? extractTextFromTiptap(entity.content as Record<string, unknown>)
        : "(empty)";

      return {
        success: true,
        result: {
          entity_id: entity.id,
          name: entity.name,
          type: entity.type,
          content: contentText,
        },
        description: `Read ${entity.type}: ${entity.name}`,
      };
    }

    case "create_entity": {
      const content = textToTiptapJson(args.content as string);
      const { data, error } = await supabase
        .from("entities")
        .insert({
          project_id: projectId,
          user_id: userId,
          name: args.name as string,
          type: args.type as EntityType,
          content,
          parent_id: (args.parent_id as string) || null,
          sort_order: 0,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          result: { error: error.message },
          description: `Failed to create ${args.type}: ${args.name}`,
        };
      }

      // Log the change
      await supabase.from("change_logs").insert({
        project_id: projectId,
        user_id: userId,
        entity_id: data.id,
        action: "create",
        actor: "ai",
        description: `Created ${args.type}: ${args.name}`,
      });

      return {
        success: true,
        result: { entity_id: data.id, name: data.name, type: data.type },
        description: `Created ${args.type}: ${args.name}`,
      };
    }

    case "update_entity": {
      const entityId = args.entity_id as string;
      const content = textToTiptapJson(args.content as string);
      const updates: Record<string, unknown> = { content };
      if (args.name) updates.name = args.name;

      const { data, error } = await supabase
        .from("entities")
        .update(updates)
        .eq("id", entityId)
        .eq("project_id", projectId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          result: { error: error.message },
          description: `Failed to update entity ${entityId}`,
        };
      }

      await supabase.from("change_logs").insert({
        project_id: projectId,
        user_id: userId,
        entity_id: entityId,
        action: "update",
        actor: "ai",
        description: `Updated ${data.type}: ${data.name}`,
      });

      return {
        success: true,
        result: { entity_id: data.id, name: data.name, type: data.type },
        description: `Updated ${data.type}: ${data.name}`,
      };
    }

    case "delete_entity": {
      const entityId = args.entity_id as string;

      // Get entity info before deleting
      const { data: entity } = await supabase
        .from("entities")
        .select("name, type")
        .eq("id", entityId)
        .eq("project_id", projectId)
        .single();

      const { error } = await supabase
        .from("entities")
        .delete()
        .eq("id", entityId)
        .eq("project_id", projectId);

      if (error) {
        return {
          success: false,
          result: { error: error.message },
          description: `Failed to delete entity ${entityId}`,
        };
      }

      await supabase.from("change_logs").insert({
        project_id: projectId,
        user_id: userId,
        entity_id: entityId,
        action: "delete",
        actor: "ai",
        description: `Deleted ${entity?.type || "entity"}: ${entity?.name || entityId}`,
      });

      return {
        success: true,
        result: { entity_id: entityId, deleted: true },
        description: `Deleted ${entity?.type || "entity"}: ${entity?.name || entityId}`,
      };
    }

    default:
      return {
        success: false,
        result: { error: `Unknown tool: ${toolName}` },
        description: `Unknown tool: ${toolName}`,
      };
  }
}
