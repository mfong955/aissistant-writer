import { getAdminClient } from "@/lib/supabase/admin";
import { scoreEntities } from "./relevance-scorer";
import { estimateTokens } from "./token-estimator";
import { buildSystemPrompt } from "./system-prompt-template";
import { extractTextFromTiptap } from "@/lib/tiptap-utils";
import type { Entity, EntitySummary } from "@/types/database";

interface ContextBuildResult {
  systemPrompt: string;
  totalTokensUsed: number;
  contextLimit: number;
  includedSummaries: number;
  hasProjectState: boolean;
}

export async function buildContext(params: {
  projectId: string;
  userId: string;
  userMessage: string;
  activeEntityIds: string[];
  contextLimit: number;
}): Promise<ContextBuildResult> {
  const supabase = getAdminClient();
  const { projectId, userMessage, activeEntityIds, contextLimit } = params;

  const { data: project } = await supabase
    .from("projects")
    .select("name, project_type, system_instructions")
    .eq("id", projectId)
    .single() as unknown as { data: { name: string; project_type: string | null; system_instructions: string | null } | null; error: null };

  const projectName = project?.name || "Untitled Project";

  const { data: instructionsRow } = await supabase
    .from("entities")
    .select("content")
    .eq("project_id", projectId)
    .eq("name", "AI Instructions")
    .is("parent_id", null)
    .single() as unknown as { data: { content: Record<string, unknown> | null } | null; error: null };

  const resolvedInstructions = instructionsRow?.content
    ? extractTextFromTiptap(instructionsRow.content as Record<string, unknown>)
    : (project?.system_instructions ?? null);

  const { data: progressRow } = await supabase
    .from("entities")
    .select("id, content")
    .eq("project_id", projectId)
    .eq("name", "Project Progress")
    .is("parent_id", null)
    .single() as unknown as { data: { id: string; content: Record<string, unknown> | null } | null; error: null };

  const progressContent = progressRow?.content
    ? extractTextFromTiptap(progressRow.content as Record<string, unknown>)
    : null;

  const [{ data: entityRows }, { data: summaryRows }, { data: projectStateRow }] = await Promise.all([
    supabase.from("entities").select("*").eq("project_id", projectId),
    supabase.from("entity_summaries").select("*").eq("project_id", projectId),
    supabase.from("project_states").select("state_content").eq("project_id", projectId).single(),
  ]);

  const allEntities: Entity[] = (entityRows ?? []) as Entity[];
  const allSummaries: EntitySummary[] = (summaryRows ?? []) as EntitySummary[];

  const basePromptTokens = 500;
  const safetyMargin = Math.floor(contextLimit * 0.1);
  const completionReserve = Math.min(2048, Math.floor(contextLimit * 0.15));
  let remainingBudget = contextLimit - basePromptTokens - safetyMargin - completionReserve;

  const entityIndex = allEntities.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    parent_id: e.parent_id,
  }));

  let entityIndexForPrompt: typeof entityIndex | undefined;
  if (entityIndex.length > 0) {
    const indexText = formatEntityIndex(entityIndex);
    const indexTokens = estimateTokens(indexText);
    if (indexTokens < remainingBudget * 0.15) {
      entityIndexForPrompt = entityIndex;
      remainingBudget -= indexTokens;
    } else {
      const truncated = entityIndex.slice(0, 100);
      const truncatedTokens = estimateTokens(formatEntityIndex(truncated));
      if (truncatedTokens < remainingBudget * 0.15) {
        entityIndexForPrompt = truncated;
        remainingBudget -= truncatedTokens;
      }
    }
  }

  let projectStateContent: string | undefined;
  const stateContent = projectStateRow?.state_content as string | undefined;
  if (stateContent) {
    const stateTokens = estimateTokens(stateContent);
    if (stateTokens < remainingBudget) {
      projectStateContent = stateContent;
      remainingBudget -= stateTokens;
    }
  }

  let activeEntityContent: { name: string; type: string; content: string } | undefined;
  if (activeEntityIds.length > 0) {
    const activeEntity = allEntities.find((e) => e.id === activeEntityIds[0]);
    if (activeEntity?.content) {
      const contentText = extractTextFromTiptap(activeEntity.content);
      const contentTokens = estimateTokens(contentText);
      if (contentTokens < remainingBudget * 0.4) {
        activeEntityContent = { name: activeEntity.name, type: activeEntity.type, content: contentText };
        remainingBudget -= contentTokens;
      }
    }
  }

  const scored = scoreEntities({
    entities: allEntities,
    summaries: allSummaries,
    userMessage,
    activeEntityIds,
  });

  const includedSummaries: Array<{ name: string; type: string; summary: string }> = [];
  for (const item of scored) {
    if (!item.summary || item.score === 0) continue;
    const summaryTokens = estimateTokens(item.summary.summary);
    if (summaryTokens > remainingBudget) continue;
    includedSummaries.push({ name: item.entity.name, type: item.entity.type, summary: item.summary.summary });
    remainingBudget -= summaryTokens;
  }

  const systemPrompt = buildSystemPrompt({
    projectName,
    projectType: project?.project_type as import("@/types/database").ProjectType | null ?? null,
    systemInstructions: resolvedInstructions,
    projectProgress: progressContent,
    projectState: projectStateContent,
    entitySummaries: includedSummaries,
    activeEntityContent,
    entityIndex: entityIndexForPrompt,
  });

  return {
    systemPrompt,
    totalTokensUsed: estimateTokens(systemPrompt),
    contextLimit,
    includedSummaries: includedSummaries.length,
    hasProjectState: !!projectStateContent,
  };
}

function formatEntityIndex(
  entities: Array<{ id: string; name: string; type: string; parent_id: string | null }>
): string {
  const nameById = new Map(entities.map((e) => [e.id, e.name]));
  return entities
    .map((e) => {
      const parentNote = e.parent_id ? `, in: ${nameById.get(e.parent_id) || "unknown"}` : "";
      return `- [${e.id}] ${e.name} (${e.type}${parentNote})`;
    })
    .join("\n");
}
