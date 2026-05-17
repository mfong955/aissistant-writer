import { getDb } from "@/lib/db/database";
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
  const db = getDb();
  const { projectId, userMessage, activeEntityIds, contextLimit } = params;

  const project = db
    .prepare("SELECT name, project_type, system_instructions FROM projects WHERE id = ?")
    .get(projectId) as { name: string; project_type: string | null; system_instructions: string | null } | undefined;
  const projectName = project?.name || "Untitled Project";

  // Instructions entity takes precedence over project.system_instructions
  const instructionsRow = db
    .prepare("SELECT content FROM entities WHERE project_id = ? AND name = 'AI Instructions' AND parent_id IS NULL")
    .get(projectId) as { content: string | null } | undefined;
  const resolvedInstructions = instructionsRow?.content
    ? extractTextFromTiptap(JSON.parse(instructionsRow.content))
    : (project?.system_instructions ?? null);

  const progressRow = db
    .prepare("SELECT id, content FROM entities WHERE project_id = ? AND name = 'Project Progress' AND parent_id IS NULL")
    .get(projectId) as { id: string; content: string | null } | undefined;
  const progressContent = progressRow?.content
    ? extractTextFromTiptap(JSON.parse(progressRow.content))
    : null;

  const entityRows = db
    .prepare("SELECT * FROM entities WHERE project_id = ?")
    .all(projectId) as Record<string, unknown>[];

  const summaryRows = db
    .prepare("SELECT * FROM entity_summaries WHERE project_id = ?")
    .all(projectId) as Record<string, unknown>[];

  const projectStateRow = db
    .prepare("SELECT state_content FROM project_states WHERE project_id = ?")
    .get(projectId) as { state_content: string } | undefined;

  // Deserialize JSON fields
  const allEntities: Entity[] = entityRows.map((row) => ({
    id: row.id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    parent_id: (row.parent_id as string | null) ?? null,
    type: row.type as Entity["type"],
    name: row.name as string,
    content: row.content ? (JSON.parse(row.content as string) as Record<string, unknown>) : null,
    properties: JSON.parse((row.properties as string) || "{}") as Record<string, unknown>,
    sort_order: row.sort_order as number,
    version_hash: (row.version_hash as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));

  const allSummaries: EntitySummary[] = summaryRows.map((row) => ({
    id: row.id as string,
    entity_id: row.entity_id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    summary: row.summary as string,
    version_hash: (row.version_hash as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));

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
  if (projectStateRow?.state_content) {
    const stateTokens = estimateTokens(projectStateRow.state_content);
    if (stateTokens < remainingBudget) {
      projectStateContent = projectStateRow.state_content;
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
