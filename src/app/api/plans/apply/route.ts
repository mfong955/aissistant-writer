import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbCreateEntity, dbUpdateEntity, dbGetEntity, resolveEntityParent, appendToSessionLog } from "@/lib/db/entities";
import { dbCreateChangeLog } from "@/lib/db/change-logs";
import { textToTiptapJson } from "@/lib/tiptap-utils";
import { isExplorerRootEntity, type ExplorerRootKey } from "@/lib/entity-roots";
import type { EntityType } from "@/types/database";

const EXPLORER_ROOT_KEYS: ExplorerRootKey[] = ["canon", "manuscript", "unsorted"];

interface PlanItem {
  id: string;
  action: "create" | "update";
  name?: string;
  type?: string;
  root?: string;
  path?: string;
  entity_id?: string;
  content: string;
}

interface ApplyResult {
  id: string;
  success: boolean;
  entity_id?: string;
  error?: string;
}

/**
 * Executes writer-approved items from a plan (docs/apply-flow.md §4). Deliberately does not
 * round-trip through the model — the writer has already decided what to accept, so this just
 * calls the same entity CRUD functions create_entity/update_entity already use, directly.
 * `actor: "user"` in the resulting change_logs entries, not "ai" — the writer approved each
 * one, even though the AI drafted it.
 */
export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;

  const { project_id, items } = (await request.json()) as { project_id: string; items: PlanItem[] };

  if (!project_id || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "project_id and at least one item are required" }, { status: 400 });
  }

  const results: ApplyResult[] = [];

  for (const item of items) {
    try {
      const content = textToTiptapJson(item.content ?? "");

      if (item.action === "create") {
        if (!item.name || !item.type || !item.root) {
          throw new Error("Missing name, type, or root");
        }
        if (!EXPLORER_ROOT_KEYS.includes(item.root as ExplorerRootKey)) {
          throw new Error(`Invalid root "${item.root}" — must be canon, manuscript, or unsorted`);
        }

        const parentId = await resolveEntityParent(project_id, userId, item.root as ExplorerRootKey, item.path);
        const entity = await dbCreateEntity({
          projectId: project_id,
          userId,
          name: item.name,
          type: item.type as EntityType,
          parentId,
          content,
        });

        await dbCreateChangeLog({
          projectId: project_id,
          userId,
          entityId: entity.id,
          action: "create",
          actor: "user",
          description: `Created ${item.type}: ${item.name} (applied from plan)`,
        });
        await appendToSessionLog(project_id, userId, `Applied plan: created ${item.type}: ${item.name}`);

        results.push({ id: item.id, success: true, entity_id: entity.id });
      } else if (item.action === "update") {
        if (!item.entity_id) throw new Error("Missing entity_id");

        const existing = await dbGetEntity(item.entity_id, project_id);
        if (!existing) throw new Error("Entity not found");
        if (isExplorerRootEntity(existing)) {
          throw new Error("Canon, Manuscript, and Unsorted are fixed containers and cannot be edited");
        }
        if (existing.type === "canvas") {
          throw new Error("This is a canvas, not a document — can't apply plan content to it");
        }

        const entity = await dbUpdateEntity(item.entity_id, project_id, { content });
        if (!entity) throw new Error("Entity not found");

        await dbCreateChangeLog({
          projectId: project_id,
          userId,
          entityId: entity.id,
          action: "update",
          actor: "user",
          description: `Updated ${entity.type}: ${entity.name} (applied from plan)`,
        });
        await appendToSessionLog(project_id, userId, `Applied plan: updated ${entity.type}: ${entity.name}`);

        results.push({ id: item.id, success: true, entity_id: entity.id });
      } else {
        throw new Error(`Unknown action "${item.action}"`);
      }
    } catch (err) {
      results.push({ id: item.id, success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return NextResponse.json({ results });
}
