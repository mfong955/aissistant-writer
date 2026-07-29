import type { ProjectType } from "@/types/database";

const FOLDER_GUIDELINES: Record<NonNullable<ProjectType>, string> = {
  novel: `- root="canon": Characters/ (arc, backstory, voice, relationships), Settings/ (locations, world-building, maps, culture, history), Timeline/ (chronology of story events), Rules/ (magic systems, story logic, constraints)
- root="manuscript": Chapters/ — numbered chapter drafts (e.g. "Chapter 01 - The Beginning"); use a zero-padded number prefix so files sort correctly
- root="unsorted": Outlines/ (beat sheets, scene lists), Notes/ (research, inspiration, miscellaneous)`,

  short_story: `- root="canon": Characters/, Settings/
- root="manuscript": Drafts/ — numbered drafts of the story
- root="unsorted": Notes/ — research, ideas, revision notes

Keep the structure lean — short stories rarely need more than these folders.`,

  non_fiction: `- root="canon": Research/ — source notes, interview transcripts, data, quotes with citations (always include the source name and date)
- root="manuscript": Chapters/ — numbered chapter drafts; link to the relevant research files in the chapter notes
- root="unsorted": Outlines/ (book structure, chapter summaries, argument maps), Notes/ (open questions, ideas, editorial feedback)`,

  textbook: `- root="canon": Glossary/ — key terms with definitions
- root="manuscript": Units/ — top-level unit folders (e.g. "Unit 1 - Introduction"), with chapter drafts nested inside; use a consistent numbering scheme (Unit 01, Chapter 01-01, etc.)
- root="unsorted": Exercises/ (end-of-chapter problems and solutions), Notes/ (instructor notes, learning objectives, errata)`,

  screenplay: `- root="canon": Characters/ — character breakdowns (motivation, arc, voice, relationships)
- root="manuscript": Acts/ (act structure documents), Scenes/ (individual scene scripts or breakdowns) — use standard screenplay formatting in scene headings (INT./EXT., location, time)
- root="unsorted": Notes/ — theme analysis, production notes, revision history`,

  poetry: `- root="manuscript": Poems/ (individual poem files), Collections/ (thematic groupings or sequences)
- root="unsorted": Notes/ — craft notes, revision history, influences

Keep poem file names short and descriptive. Group related poems into Collections/ subfolders. This project type has no default Canon folders — create one under root="canon" only if durable world/character facts emerge.`,

  game_narrative: `- root="canon": Characters/ (protagonists, NPCs, factions — motivation, backstory, dialogue voice), Lore/ (world history, rules, mythology, geography — flag whether player-visible or background-only)
- root="manuscript": Quests/ (objectives, success/fail states), Dialogue/ (conversation scripts and dialogue trees — always note which character speaks and their emotional state)
- root="unsorted": Notes/ — design notes, tone guidelines, consistency rules`,

  other: `Group related content into clearly named folders inside the appropriate root.
Use descriptive file names that make the content obvious at a glance.
Prefer a shallow folder structure — no more than two levels deep unless the project is very large.`,
};

function getDefaultFolderGuidance(projectType: ProjectType | null): string {
  const perType = projectType ? FOLDER_GUIDELINES[projectType] : null;
  const intro = `Every entity lives under one of three fixed top-level roots — pass \`root\` (and optionally \`path\`) to create_entity:
- canon — durable story facts that survive every rewrite
- manuscript — the actual draft; disposable and replaceable
- unsorted — anything you're not confident how to classify; always a safe default`;
  if (!perType) {
    return `${intro}\n\nWhen creating files, group related content into clearly named folders inside the appropriate root (e.g. Characters/ under canon, Chapters/ under manuscript). Use descriptive, consistently formatted names.`;
  }
  return `${intro}\n\nRecommended folders for this project type:\n${perType}`;
}

export function buildSystemPrompt(params: {
  projectName: string;
  projectType?: ProjectType | null;
  systemInstructions?: string | null;
  projectProgress?: string | null;
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
- create_entity: Create a new project entity (character, chapter, outline, note, world_building, folder, or custom). Every entity must be placed under root="canon", "manuscript", or "unsorted" — see File Organization below
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
- You can answer general writing questions about technique, style, and overcoming writer's block

After any session where you created, updated, or deleted content: update the "Project Progress" entity using update_entity (find it by name in Project Files). Keep the file under 200 words — it is a live snapshot, not a journal. Overwrite "Last Session" with what you did this session; do not append. Move detailed notes to Logs/. Only current status, active focus, next steps, and key decisions belong in the progress file.`);

  // File organization guidance (always included)
  sections.push(`## File Organization\n${getDefaultFolderGuidance(params.projectType ?? null)}`);

  // Custom project instructions (user-defined, injected after defaults so they can override)
  if (params.systemInstructions?.trim()) {
    sections.push(`## Project Instructions\n${params.systemInstructions.trim()}`);
  }

  // Project Progress (live snapshot — overwritten each session by the AI)
  if (params.projectProgress?.trim()) {
    sections.push(`## Project Progress\n${params.projectProgress.trim()}`);
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
