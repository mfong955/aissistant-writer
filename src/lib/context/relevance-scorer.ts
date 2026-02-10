import type { Entity, EntitySummary } from "@/types/database";

interface ScoredEntity {
  entity: Entity;
  summary: EntitySummary | null;
  score: number;
}

export function scoreEntities(params: {
  entities: Entity[];
  summaries: EntitySummary[];
  userMessage: string;
  activeEntityIds: string[];
  recentEntityIds?: string[];
}): ScoredEntity[] {
  const { entities, summaries, userMessage, activeEntityIds, recentEntityIds = [] } = params;
  const summaryMap = new Map(summaries.map((s) => [s.entity_id, s]));
  const messageLower = userMessage.toLowerCase();

  const scored: ScoredEntity[] = entities
    .filter((e) => e.type !== "folder") // Don't score folders
    .map((entity) => {
      let score = 0;

      // Active tabs: highest priority
      if (activeEntityIds.includes(entity.id)) {
        score += 1.0;
      }

      // Name mention in user message
      if (messageLower.includes(entity.name.toLowerCase())) {
        score += 0.8;
      }

      // Recently edited/viewed
      if (recentEntityIds.includes(entity.id)) {
        score += 0.3;
      }

      // Type bonus: characters and world-building are more likely to be contextually relevant
      if (entity.type === "character" || entity.type === "world_building") {
        score += 0.1;
      }

      return {
        entity,
        summary: summaryMap.get(entity.id) || null,
        score,
      };
    });

  // Sort by score descending, then by updated_at descending
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.entity.updated_at).getTime() - new Date(a.entity.updated_at).getTime();
  });

  return scored;
}
