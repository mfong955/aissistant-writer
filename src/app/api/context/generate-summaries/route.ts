import { NextResponse } from "next/server";
import { getLocalUserId } from "@/lib/local-user";
import { getDb } from "@/lib/db/database";
import { dbUpsertEntitySummary } from "@/lib/db/entity-summaries";
import { dbUpsertProjectState } from "@/lib/db/project-states";
import {
  generateEntitySummary,
  generateProjectState,
} from "@/lib/context/summary-generator";
import { computeContentHash } from "@/lib/content-hash";

export async function POST(request: Request) {
  const userId = getLocalUserId();
  const body = await request.json();
  const { project_id, entity_id } = body as {
    project_id: string;
    entity_id?: string;
  };

  if (!project_id) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const db = getDb();

  const project = db
    .prepare("SELECT name FROM projects WHERE id = ?")
    .get(project_id) as { name: string } | undefined;

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let entitiesToProcess: Record<string, unknown>[];

  if (entity_id) {
    const row = db
      .prepare("SELECT * FROM entities WHERE id = ? AND project_id = ?")
      .get(entity_id, project_id) as Record<string, unknown> | undefined;
    entitiesToProcess = row ? [row] : [];
  } else {
    const entities = db
      .prepare("SELECT * FROM entities WHERE project_id = ? AND type != 'folder'")
      .all(project_id) as Record<string, unknown>[];

    const summaries = db
      .prepare("SELECT entity_id, version_hash FROM entity_summaries WHERE project_id = ?")
      .all(project_id) as { entity_id: string; version_hash: string | null }[];

    const summaryMap = new Map(summaries.map((s) => [s.entity_id, s.version_hash]));

    entitiesToProcess = entities.filter((entity) => {
      const currentHash = entity.version_hash as string | null;
      const summaryHash = summaryMap.get(entity.id as string);
      return currentHash !== summaryHash || !summaryHash;
    });
  }

  const results: Array<{ entityId: string; name: string; status: string }> = [];

  for (const entity of entitiesToProcess) {
    try {
      const contentText = entity.content
        ? extractTextFromContent(JSON.parse(entity.content as string) as Record<string, unknown>)
        : "";

      if (!contentText.trim()) {
        results.push({ entityId: entity.id as string, name: entity.name as string, status: "skipped_empty" });
        continue;
      }

      const summary = await generateEntitySummary({
        entityId: entity.id as string,
        projectId: project_id,
        userId,
        entityName: entity.name as string,
        entityType: entity.type as string,
        content: contentText,
      });

      const contentHash = await computeContentHash(
        JSON.parse(entity.content as string) as Record<string, unknown>
      );

      dbUpsertEntitySummary({
        entityId: entity.id as string,
        projectId: project_id,
        userId,
        summary,
        versionHash: contentHash,
      });

      results.push({ entityId: entity.id as string, name: entity.name as string, status: "generated" });
    } catch (err) {
      results.push({
        entityId: entity.id as string,
        name: entity.name as string,
        status: `error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  let projectStateStatus = "skipped";
  const generatedCount = results.filter((r) => r.status === "generated").length;

  if (generatedCount > 0 || !entity_id) {
    try {
      const allSummaries = db
        .prepare("SELECT entity_id, summary FROM entity_summaries WHERE project_id = ?")
        .all(project_id) as { entity_id: string; summary: string }[];

      const allEntities = db
        .prepare("SELECT id, name, type FROM entities WHERE project_id = ? AND type != 'folder'")
        .all(project_id) as { id: string; name: string; type: string }[];

      const entityMap = new Map(allEntities.map((e) => [e.id, e]));

      const entitySummaries = allSummaries
        .map((s) => {
          const entity = entityMap.get(s.entity_id);
          if (!entity) return null;
          return { name: entity.name, type: entity.type, summary: s.summary };
        })
        .filter(Boolean) as Array<{ name: string; type: string; summary: string }>;

      if (entitySummaries.length > 0) {
        const stateContent = await generateProjectState({
          projectId: project_id,
          userId,
          projectName: project.name,
          entitySummaries,
        });

        const entityHashes: Record<string, string> = {};
        for (const s of allSummaries) {
          entityHashes[s.entity_id] = "summarized";
        }

        dbUpsertProjectState({
          projectId: project_id,
          userId,
          stateContent,
          entityHashes,
        });

        projectStateStatus = "generated";
      }
    } catch (err) {
      projectStateStatus = `error: ${err instanceof Error ? err.message : "unknown"}`;
    }
  }

  return NextResponse.json({
    entitySummaries: results,
    projectState: projectStateStatus,
    totalProcessed: entitiesToProcess.length,
    generated: generatedCount,
  });
}

function extractTextFromContent(content: Record<string, unknown>): string {
  const parts: string[] = [];

  function walk(node: Record<string, unknown>) {
    if (node.text && typeof node.text === "string") {
      parts.push(node.text);
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child as Record<string, unknown>);
      }
      if (node.type === "paragraph" || node.type === "heading") {
        parts.push("\n");
      }
    }
  }

  walk(content);
  return parts.join("").trim();
}
