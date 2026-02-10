import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateEntitySummary,
  generateProjectState,
} from "@/lib/context/summary-generator";
import { computeContentHash } from "@/lib/content-hash";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { project_id, entity_id } = body as {
    project_id: string;
    entity_id?: string; // If provided, regenerate just this entity's summary
  };

  if (!project_id) {
    return NextResponse.json(
      { error: "project_id is required" },
      { status: 400 }
    );
  }

  try {
    // Fetch project
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Determine which entities need summary regeneration
    let entitiesToProcess;

    if (entity_id) {
      // Single entity mode
      const { data } = await supabase
        .from("entities")
        .select("*")
        .eq("id", entity_id)
        .eq("project_id", project_id)
        .single();

      entitiesToProcess = data ? [data] : [];
    } else {
      // All entities mode — find those with stale or missing summaries
      const { data: entities } = await supabase
        .from("entities")
        .select("*")
        .eq("project_id", project_id)
        .neq("type", "folder");

      const { data: summaries } = await supabase
        .from("entity_summaries")
        .select("entity_id, version_hash")
        .eq("project_id", project_id);

      const summaryMap = new Map(
        (summaries || []).map((s) => [s.entity_id, s.version_hash])
      );

      // Filter to entities whose content hash differs from summary's version_hash
      entitiesToProcess = (entities || []).filter((entity) => {
        const currentHash = entity.version_hash;
        const summaryHash = summaryMap.get(entity.id);
        return currentHash !== summaryHash || !summaryHash;
      });
    }

    // Generate summaries for stale entities
    const results: Array<{ entityId: string; name: string; status: string }> = [];

    for (const entity of entitiesToProcess) {
      try {
        const contentText = entity.content
          ? extractTextFromContent(entity.content)
          : "";

        if (!contentText.trim()) {
          results.push({
            entityId: entity.id,
            name: entity.name,
            status: "skipped_empty",
          });
          continue;
        }

        const summary = await generateEntitySummary({
          entityId: entity.id,
          projectId: project_id,
          userId: user.id,
          entityName: entity.name,
          entityType: entity.type,
          content: contentText,
        });

        // Compute version hash from the content used to generate the summary
        const contentHash = await computeContentHash(entity.content || {});

        // Upsert entity summary
        await supabase.from("entity_summaries").upsert(
          {
            entity_id: entity.id,
            project_id: project_id,
            user_id: user.id,
            summary,
            version_hash: contentHash,
          },
          { onConflict: "entity_id" }
        );

        results.push({
          entityId: entity.id,
          name: entity.name,
          status: "generated",
        });
      } catch (err) {
        results.push({
          entityId: entity.id,
          name: entity.name,
          status: `error: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    }

    // Regenerate L2 project state if any summaries were updated
    let projectStateStatus = "skipped";
    const generatedCount = results.filter((r) => r.status === "generated").length;

    if (generatedCount > 0 || !entity_id) {
      try {
        // Fetch all current summaries for project state generation
        const { data: allSummaries } = await supabase
          .from("entity_summaries")
          .select("entity_id, summary")
          .eq("project_id", project_id);

        const { data: allEntities } = await supabase
          .from("entities")
          .select("id, name, type")
          .eq("project_id", project_id)
          .neq("type", "folder");

        const entityMap = new Map(
          (allEntities || []).map((e) => [e.id, e])
        );

        const entitySummaries = (allSummaries || [])
          .map((s) => {
            const entity = entityMap.get(s.entity_id);
            if (!entity) return null;
            return {
              name: entity.name,
              type: entity.type,
              summary: s.summary,
            };
          })
          .filter(Boolean) as Array<{
            name: string;
            type: string;
            summary: string;
          }>;

        if (entitySummaries.length > 0) {
          const stateContent = await generateProjectState({
            projectId: project_id,
            userId: user.id,
            projectName: project.name,
            entitySummaries,
          });

          // Build entity hashes for change detection
          const entityHashes: Record<string, string> = {};
          for (const s of allSummaries || []) {
            entityHashes[s.entity_id] = "summarized";
          }

          await supabase.from("project_states").upsert(
            {
              project_id: project_id,
              user_id: user.id,
              state_content: stateContent,
              entity_hashes: entityHashes,
            },
            { onConflict: "project_id" }
          );

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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
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
