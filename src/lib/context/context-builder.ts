import { createClient } from "@/lib/supabase/server";
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
  contextLimit: number; // model's context_length
}): Promise<ContextBuildResult> {
  const supabase = await createClient();
  const { projectId, userMessage, activeEntityIds, contextLimit } = params;

  // Fetch project info
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  const projectName = project?.name || "Untitled Project";

  // Fetch all entities for the project
  const { data: entities } = await supabase
    .from("entities")
    .select("*")
    .eq("project_id", projectId);

  // Fetch all summaries
  const { data: summaries } = await supabase
    .from("entity_summaries")
    .select("*")
    .eq("project_id", projectId);

  // Fetch project state (L2)
  const { data: projectState } = await supabase
    .from("project_states")
    .select("state_content")
    .eq("project_id", projectId)
    .single();

  // Calculate budget
  const basePromptTokens = 500; // Role + capabilities section
  const safetyMargin = Math.floor(contextLimit * 0.1);
  const completionReserve = Math.min(2048, Math.floor(contextLimit * 0.15));
  let remainingBudget = contextLimit - basePromptTokens - safetyMargin - completionReserve;

  // Build entity index (compact list of all entities with IDs)
  const allEntities = (entities as Entity[]) || [];
  const entityIndex = allEntities.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    parent_id: e.parent_id,
  }));

  // Budget check for entity index — cap at 15% of remaining budget
  let entityIndexForPrompt: typeof entityIndex | undefined;
  if (entityIndex.length > 0) {
    const indexText = formatEntityIndex(entityIndex);
    const indexTokens = estimateTokens(indexText);
    if (indexTokens < remainingBudget * 0.15) {
      entityIndexForPrompt = entityIndex;
      remainingBudget -= indexTokens;
    } else {
      // Truncate to most recently updated entities for very large projects
      const truncated = entityIndex.slice(0, 100);
      const truncatedText = formatEntityIndex(truncated);
      const truncatedTokens = estimateTokens(truncatedText);
      if (truncatedTokens < remainingBudget * 0.15) {
        entityIndexForPrompt = truncated;
        remainingBudget -= truncatedTokens;
      }
    }
  }

  // Always include L2 project state
  let projectStateContent: string | undefined;
  if (projectState?.state_content) {
    const stateTokens = estimateTokens(projectState.state_content);
    if (stateTokens < remainingBudget) {
      projectStateContent = projectState.state_content;
      remainingBudget -= stateTokens;
    }
  }

  // Include L0 full content for active entity
  let activeEntityContent:
    | { name: string; type: string; content: string }
    | undefined;

  if (activeEntityIds.length > 0 && entities) {
    const activeEntity = allEntities.find(
      (e) => e.id === activeEntityIds[0]
    );
    if (activeEntity?.content) {
      const contentText = extractTextFromTiptap(activeEntity.content);
      const contentTokens = estimateTokens(contentText);
      if (contentTokens < remainingBudget * 0.4) {
        // Don't let L0 use more than 40% of remaining budget
        activeEntityContent = {
          name: activeEntity.name,
          type: activeEntity.type,
          content: contentText,
        };
        remainingBudget -= contentTokens;
      }
    }
  }

  // Score and select L1 summaries
  const scored = scoreEntities({
    entities: allEntities,
    summaries: (summaries as EntitySummary[]) || [],
    userMessage,
    activeEntityIds,
  });

  const includedSummaries: Array<{ name: string; type: string; summary: string }> = [];
  for (const item of scored) {
    if (!item.summary || item.score === 0) continue;
    const summaryTokens = estimateTokens(item.summary.summary);
    if (summaryTokens > remainingBudget) continue;

    includedSummaries.push({
      name: item.entity.name,
      type: item.entity.type,
      summary: item.summary.summary,
    });
    remainingBudget -= summaryTokens;
  }

  // Build the system prompt
  const systemPrompt = buildSystemPrompt({
    projectName,
    projectState: projectStateContent,
    entitySummaries: includedSummaries,
    activeEntityContent,
    entityIndex: entityIndexForPrompt,
  });

  const totalTokensUsed = estimateTokens(systemPrompt);

  return {
    systemPrompt,
    totalTokensUsed,
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
