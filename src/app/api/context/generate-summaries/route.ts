import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { getAdminClient } from "@/lib/supabase/admin";
import { dbUpsertEntitySummary } from "@/lib/db/entity-summaries";
import { dbUpsertProjectState } from "@/lib/db/project-states";
import {
  generateEntitySummary,
  generateProjectState,
} from "@/lib/context/summary-generator";
import { computeContentHash } from "@/lib/content-hash";
import { extractTextFromTiptap } from "@/lib/tiptap-utils";

export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const body = await request.json();
  const { project_id, entity_id } = body as {
    project_id: string;
    entity_id?: string;
  };

  if (!project_id) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const supabase = getAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", project_id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let entitiesToProcess: Record<string, unknown>[];

  if (entity_id) {
    const { data: row } = await supabase
      .from("entities")
      .select("*")
      .eq("id", entity_id)
      .eq("project_id", project_id)
      .single();
    entitiesToProcess = row ? [row as Record<string, unknown>] : [];
  } else {
    const [{ data: entities }, { data: summaries }] = await Promise.all([
      supabase.from("entities").select("*").eq("project_id", project_id).neq("type", "folder"),
      supabase
        .from("entity_summaries")
        .select("entity_id, version_hash")
        .eq("project_id", project_id),
    ]);

    const summaryMap = new Map(
      (summaries ?? []).map((s) => [(s as { entity_id: string; version_hash: string | null }).entity_id, (s as { entity_id: string; version_hash: string | null }).version_hash])
    );

    entitiesToProcess = (entities ?? []).filter((entity) => {
      const e = entity as { id: string; version_hash: string | null };
      const summaryHash = summaryMap.get(e.id);
      return e.version_hash !== summaryHash || !summaryHash;
    }) as Record<string, unknown>[];
  }

  const results: Array<{ entityId: string; name: string; status: string }> = [];

  for (const entity of entitiesToProcess) {
    try {
      const contentText = entity.content
        ? extractTextFromTiptap(entity.content as Record<string, unknown>)
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

      const contentHash = await computeContentHash(entity.content as Record<string, unknown>);

      await dbUpsertEntitySummary({
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
      const [{ data: allSummaries }, { data: allEntities }] = await Promise.all([
        supabase.from("entity_summaries").select("entity_id, summary").eq("project_id", project_id),
        supabase.from("entities").select("id, name, type").eq("project_id", project_id).neq("type", "folder"),
      ]);

      const entityMap = new Map(
        (allEntities ?? []).map((e) => [(e as { id: string; name: string; type: string }).id, e as { id: string; name: string; type: string }])
      );

      const entitySummaries = (allSummaries ?? [])
        .map((s) => {
          const sum = s as { entity_id: string; summary: string };
          const entity = entityMap.get(sum.entity_id);
          if (!entity) return null;
          return { name: entity.name, type: entity.type, summary: sum.summary };
        })
        .filter(Boolean) as Array<{ name: string; type: string; summary: string }>;

      if (entitySummaries.length > 0) {
        const stateContent = await generateProjectState({
          projectId: project_id,
          userId,
          projectName: project.name as string,
          entitySummaries,
        });

        const entityHashes: Record<string, string> = {};
        for (const s of allSummaries ?? []) {
          entityHashes[((s as { entity_id: string }).entity_id)] = "summarized";
        }

        await dbUpsertProjectState({
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
