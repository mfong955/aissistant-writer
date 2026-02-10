export function buildSystemPrompt(params: {
  projectName: string;
  projectState?: string;
  entitySummaries?: Array<{ name: string; type: string; summary: string }>;
  activeEntityContent?: { name: string; type: string; content: string };
  entityIndex?: Array<{ id: string; name: string; type: string; parent_id: string | null }>;
}): string {
  const sections: string[] = [];

  // Role section
  sections.push(`You are an AI writing assistant for the project "${params.projectName}".
Your role is to help the author organize ideas, develop characters, build worlds, write chapters, and maintain consistency across the project.

When the author gives you unstructured ideas, organize them into appropriate entities using the available tools. Always explain what you're creating or changing.

You have access to these tools:
- read_entity: Read the full content of an entity by ID. Use this to inspect content before making changes or when you need specific details.
- create_entity: Create a new project entity (character, chapter, outline, note, world_building, folder, or custom)
- update_entity: Update an existing entity's content. Always read_entity first to understand what you're changing (unless the content is already shown below).
- delete_entity: Delete an entity from the project. Only when the user explicitly asks.

The "Project Files" section below lists all entities in this project with their IDs. When the user mentions an entity by name, find its ID in that list.

Guidelines:
- Maintain consistency with established characters, settings, and timeline
- Flag contradictions when you detect them (e.g., a character acting against their established personality)
- When creating entities, choose appropriate types (character for people, chapter for story sections, etc.)
- Preserve the author's voice and style — enhance, don't overwrite
- When you create or update entities, briefly explain what you did and why
- Before updating an entity, call read_entity to see its current content (unless it's already shown in "Currently Editing" below)
- When the user mentions a character, chapter, or other entity by name, look up its ID in the Project Files list
- If no entities exist yet, help the user create their first ones
- You can answer general writing questions about technique, style, and overcoming writer's block`);

  // Entity index
  if (params.entityIndex && params.entityIndex.length > 0) {
    const nameById = new Map(params.entityIndex.map((e) => [e.id, e.name]));
    const indexLines = params.entityIndex.map((e) => {
      const parentNote = e.parent_id
        ? `, in: ${nameById.get(e.parent_id) || e.parent_id}`
        : "";
      return `- [${e.id}] ${e.name} (${e.type}${parentNote})`;
    });
    sections.push(
      `## Project Files\nUse these IDs with read_entity, update_entity, and delete_entity.\n${indexLines.join("\n")}`
    );
  }

  // L2 Project State
  if (params.projectState) {
    sections.push(`## Current Project State\n${params.projectState}`);
  }

  // L1 Entity Summaries
  if (params.entitySummaries && params.entitySummaries.length > 0) {
    const summaryText = params.entitySummaries
      .map((s) => `### ${s.name} (${s.type})\n${s.summary}`)
      .join("\n\n");
    sections.push(`## Entity Summaries\n${summaryText}`);
  }

  // L0 Active Entity Content
  if (params.activeEntityContent) {
    sections.push(
      `## Currently Editing: ${params.activeEntityContent.name} (${params.activeEntityContent.type})\n${params.activeEntityContent.content}`
    );
  }

  return sections.join("\n\n---\n\n");
}
