import type { ProjectType } from "@/types/database";

const FOLDER_GUIDELINES: Record<NonNullable<ProjectType>, string> = {
  novel: `Recommended folder structure for novels:
- Characters/ — one file per significant character (arc, backstory, voice, relationships)
- Settings/ — locations, world-building, maps, culture, history
- Chapters/ — numbered chapter drafts (e.g. "Chapter 01 - The Beginning")
- Outlines/ — beat sheets, chapter-by-chapter outlines, scene lists
- Notes/ — research, inspiration, miscellaneous

When creating a new character, place it inside Characters/.
When creating a new chapter, place it inside Chapters/ and use a zero-padded number prefix so files sort correctly.
When creating world-building content, place it inside Settings/.`,

  short_story: `Recommended folder structure for short stories:
- Characters/ — main and supporting characters
- Settings/ — location and atmosphere notes
- Drafts/ — numbered drafts of the story
- Notes/ — research, ideas, revision notes

Keep the structure lean — short stories rarely need more than these four folders.`,

  non_fiction: `Recommended folder structure for non-fiction books:
- Chapters/ — numbered chapter drafts
- Research/ — source notes, interview transcripts, data, quotes with citations
- Outlines/ — book structure, chapter summaries, argument maps
- Notes/ — open questions, ideas, editorial feedback

When creating research notes, always include the source name and date.
When creating a chapter, link to the relevant research files in the chapter notes.`,

  textbook: `Recommended folder structure for textbooks:
- Units/ — top-level unit folders (e.g. "Unit 1 - Introduction")
- Chapters/ — chapter drafts, placed inside their unit folder
- Exercises/ — end-of-chapter problems and solutions
- Glossary/ — key terms with definitions
- Notes/ — instructor notes, learning objectives, errata

Use a consistent numbering scheme: Unit 01, Chapter 01-01, etc.`,

  screenplay: `Recommended folder structure for screenplays:
- Characters/ — character breakdowns (motivation, arc, voice, relationships)
- Acts/ — act structure documents
- Scenes/ — individual scene scripts or scene-by-scene breakdowns
- Notes/ — theme analysis, production notes, revision history

Use standard screenplay formatting conventions in scene headings (INT./EXT., location, time).`,

  poetry: `Recommended folder structure for poetry collections:
- Poems/ — individual poem files
- Collections/ — thematic groupings or sequences
- Notes/ — craft notes, revision history, influences

Keep poem file names short and descriptive. Group related poems into Collections/ subfolders.`,

  game_narrative: `Recommended folder structure for game narratives:
- Characters/ — protagonists, NPCs, factions (motivation, backstory, dialogue voice)
- Lore/ — world history, rules, mythology, geography
- Quests/ — quest scripts, objectives, success/fail states
- Dialogue/ — conversation scripts and dialogue trees
- Notes/ — design notes, tone guidelines, consistency rules

When creating dialogue, always note which character speaks and what emotional state they are in.
When creating lore, flag whether it is player-visible or background-only.`,

  other: `When creating files, group related content into clearly named folders.
Use descriptive file names that make the content obvious at a glance.
Prefer a shallow folder structure — no more than two levels deep unless the project is very large.`,
};

function getDefaultFolderGuidance(projectType: ProjectType | null): string {
  if (!projectType) {
    return `When creating files, group related content into clearly named folders (e.g. Characters/, Settings/, Chapters/).
Use descriptive, consistently formatted names. Prefer a shallow folder structure.`;
  }
  return FOLDER_GUIDELINES[projectType];
}

export function buildSystemPrompt(params: {
  projectName: string;
  projectType?: ProjectType | null;
  systemInstructions?: string | null;
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

  // File organization guidance (always included)
  sections.push(`## File Organization\n${getDefaultFolderGuidance(params.projectType ?? null)}`);

  // Custom project instructions (user-defined, injected after defaults so they can override)
  if (params.systemInstructions?.trim()) {
    sections.push(`## Project Instructions\n${params.systemInstructions.trim()}`);
  }

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
