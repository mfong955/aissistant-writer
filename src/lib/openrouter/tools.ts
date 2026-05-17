import type { ToolDefinition } from "./types";
import { getDb } from "@/lib/db/database";
import { textToTiptapJson, extractTextFromTiptap } from "@/lib/tiptap-utils";
import { appendToSessionLog } from "@/lib/db/entities";
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
        "Create a new entity in the project (character, chapter, outline, note, world_building, folder, or custom). IMPORTANT PLACEMENT RULES: Always check the Project Files list in the system prompt for existing folder IDs. Non-folder entities MUST use parent_id to place them in the correct folder (e.g. characters go in the Characters/ folder, chapters go in Chapters/, etc.). If the correct folder does not exist yet, call create_entity with type='folder' first to create it, then immediately call create_entity again for the actual entity with parent_id set to the new folder's ID. Never place content entities at the root level if an appropriate folder exists or should exist.",
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
          parent_id: {
            type: "string",
            description: "ID of the parent folder entity (from the Project Files list). Required for all non-folder entities — look up the folder's ID in Project Files and always set this.",
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
  const db = getDb();

  switch (toolName) {
    case "read_entity": {
      const entityId = args.entity_id as string;
      const entity = db
        .prepare("SELECT id, name, type, content FROM entities WHERE id = ? AND project_id = ?")
        .get(entityId, projectId) as { id: string; name: string; type: string; content: string | null } | undefined;

      if (!entity) {
        return { success: false, result: { error: "Entity not found" }, description: `Failed to read entity ${entityId}` };
      }

      const contentText = entity.content
        ? extractTextFromTiptap(JSON.parse(entity.content) as Record<string, unknown>)
        : "(empty)";

      return {
        success: true,
        result: { entity_id: entity.id, name: entity.name, type: entity.type, content: contentText },
        description: `Read ${entity.type}: ${entity.name}`,
      };
    }

    case "create_entity": {
      const content = textToTiptapJson(args.content as string);
      const id = crypto.randomUUID();
      const ts = new Date().toISOString();

      try {
        db.prepare(
          `INSERT INTO entities (id, project_id, user_id, name, type, content, parent_id, sort_order, properties, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, '{}', ?, ?)`
        ).run(
          id,
          projectId,
          userId,
          args.name as string,
          args.type as EntityType,
          JSON.stringify(content),
          (args.parent_id as string) || null,
          ts,
          ts
        );

        db.prepare(
          `INSERT INTO change_logs (id, project_id, user_id, entity_id, action, actor, description, created_at)
           VALUES (?, ?, ?, ?, 'create', 'ai', ?, ?)`
        ).run(crypto.randomUUID(), projectId, userId, id, `Created ${args.type}: ${args.name}`, ts);

        appendToSessionLog(projectId, userId, `Created ${args.type}: ${args.name as string}`);
        return {
          success: true,
          result: { entity_id: id, name: args.name as string, type: args.type as string },
          description: `Created ${args.type}: ${args.name}`,
        };
      } catch (err) {
        return {
          success: false,
          result: { error: err instanceof Error ? err.message : "Unknown error" },
          description: `Failed to create ${args.type}: ${args.name}`,
        };
      }
    }

    case "update_entity": {
      const entityId = args.entity_id as string;
      const content = textToTiptapJson(args.content as string);
      const ts = new Date().toISOString();

      const entity = db
        .prepare("SELECT name, type FROM entities WHERE id = ? AND project_id = ?")
        .get(entityId, projectId) as { name: string; type: string } | undefined;

      if (!entity) {
        return { success: false, result: { error: "Entity not found" }, description: `Failed to update entity ${entityId}` };
      }

      const name = (args.name as string | undefined) || entity.name;

      try {
        db.prepare("UPDATE entities SET content = ?, name = ?, updated_at = ? WHERE id = ? AND project_id = ?")
          .run(JSON.stringify(content), name, ts, entityId, projectId);

        db.prepare(
          `INSERT INTO change_logs (id, project_id, user_id, entity_id, action, actor, description, created_at)
           VALUES (?, ?, ?, ?, 'update', 'ai', ?, ?)`
        ).run(crypto.randomUUID(), projectId, userId, entityId, `Updated ${entity.type}: ${name}`, ts);

        appendToSessionLog(projectId, userId, `Updated ${entity.type}: ${name}`);
        return {
          success: true,
          result: { entity_id: entityId, name, type: entity.type },
          description: `Updated ${entity.type}: ${name}`,
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

      const entity = db
        .prepare("SELECT name, type FROM entities WHERE id = ? AND project_id = ?")
        .get(entityId, projectId) as { name: string; type: string } | undefined;

      try {
        db.prepare("DELETE FROM entities WHERE id = ? AND project_id = ?").run(entityId, projectId);

        const ts = new Date().toISOString();
        db.prepare(
          `INSERT INTO change_logs (id, project_id, user_id, entity_id, action, actor, description, created_at)
           VALUES (?, ?, ?, ?, 'delete', 'ai', ?, ?)`
        ).run(
          crypto.randomUUID(),
          projectId,
          userId,
          entityId,
          `Deleted ${entity?.type || "entity"}: ${entity?.name || entityId}`,
          ts
        );

        appendToSessionLog(projectId, userId, `Deleted ${entity?.type || "entity"}: ${entity?.name || entityId}`);
        return {
          success: true,
          result: { entity_id: entityId, deleted: true },
          description: `Deleted ${entity?.type || "entity"}: ${entity?.name || entityId}`,
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
