import { textToTiptapJson } from "./tiptap-utils";
import type { EntityType, ProjectType } from "@/types/database";
import type { ExplorerRootKey } from "./entity-roots";

const CHARACTER_TEMPLATE = `
# Character Name

## Overview
Brief description of who this character is and their role in the story.

## Appearance
Physical description — height, build, notable features, how they dress.

## Personality
Core traits, quirks, speech patterns, mannerisms.

## Background
Upbringing, key formative events, secrets they carry.

## Goals & Motivation
What they want, why they want it, and what they fear losing.

## Relationships
Key connections to other characters.
`.trim();

const CHAPTER_TEMPLATE = `
# Chapter Title

## Summary
What happens in this chapter and why it matters.

## POV Character
Whose perspective we follow.

## Setting
Where and when this takes place.

## Key Events
-
-
-

## Chapter Goal
What the POV character wants. What changes by the end.

## Notes
`.trim();

const OUTLINE_TEMPLATE = `
# Story Outline

## Premise
The core conflict or central question of the story.

## Act 1 — Setup
Introduce protagonist, establish the world, inciting incident.

## Act 2 — Confrontation
Rising stakes, complications, midpoint reversal, darkest moment.

## Act 3 — Resolution
Climax, resolution, aftermath.

## Key Themes

## Unresolved Questions
`.trim();

const WORLD_BUILDING_TEMPLATE = `
# World Building

## Overview
The world at a glance — tone, genre, feel.

## Geography & Setting
Key locations, maps, environments.

## Culture & Society
Customs, social structures, politics, factions.

## History & Lore
Founding events, myths, major turning points.

## Magic / Technology
Systems, rules, costs, limits.

## Notes
`.trim();

const SCENE_TEMPLATE = `
# Scene Title

## Setting
Where and when.

## Characters Present

## Scene Goal
What a character is trying to achieve.

## Conflict
What stands in the way.

## Outcome
How the scene ends — success, failure, or complication.
`.trim();

const TEMPLATES: Partial<Record<EntityType, { label: string; markdown: string }[]>> = {
  character: [{ label: "Character Sheet", markdown: CHARACTER_TEMPLATE }],
  chapter: [
    { label: "Chapter Plan", markdown: CHAPTER_TEMPLATE },
    { label: "Scene Card", markdown: SCENE_TEMPLATE },
  ],
  outline: [{ label: "Three-Act Outline", markdown: OUTLINE_TEMPLATE }],
  world_building: [{ label: "World Building", markdown: WORLD_BUILDING_TEMPLATE }],
};

export type Template = { label: string; markdown: string };

export function getTemplatesForType(type: EntityType): Template[] {
  return TEMPLATES[type] ?? [];
}

export function templateToContent(markdown: string): Record<string, unknown> {
  return textToTiptapJson(markdown);
}

// ── Project starter templates ──────────────────────────────────────────────

export type ProjectSeedItem = {
  name: string;
  type: Exclude<EntityType, "folder">;
  templateKey?: EntityType; // entity template to pre-fill content
};

export type ProjectFolderConfig = {
  name: string;
  /** Which of the three fixed explorer roots this folder is seeded under. */
  root: ExplorerRootKey;
  seeds: ProjectSeedItem[];
};

export type ProjectTemplateConfig = {
  folders: ProjectFolderConfig[];
};

// Per docs/onboarding-workflows.md §1: Canon is cumulative and survives every rewrite,
// Manuscript is disposable draft content, Unsorted holds anything not yet classified.
// Only the novel skeleton (Characters, Settings, Timeline, Rules) is spec'd explicitly;
// the rest is a best-effort mapping of the prior flat folder set onto the three roots —
// seeded, not fixed, and expected to be revised once real imports inform the taxonomy.
export const PROJECT_TEMPLATES: Partial<Record<NonNullable<ProjectType>, ProjectTemplateConfig>> = {
  novel: {
    folders: [
      { name: "Characters", root: "canon", seeds: [] },
      { name: "Settings", root: "canon", seeds: [{ name: "World Overview", type: "world_building", templateKey: "world_building" }] },
      { name: "Timeline", root: "canon", seeds: [] },
      { name: "Rules", root: "canon", seeds: [] },
      { name: "Chapters", root: "manuscript", seeds: [{ name: "Chapter 1", type: "chapter", templateKey: "chapter" }] },
      { name: "Outlines", root: "unsorted", seeds: [{ name: "Story Outline", type: "outline", templateKey: "outline" }] },
      { name: "Notes", root: "unsorted", seeds: [] },
    ],
  },
  short_story: {
    folders: [
      { name: "Characters", root: "canon", seeds: [] },
      { name: "Settings", root: "canon", seeds: [] },
      { name: "Drafts", root: "manuscript", seeds: [{ name: "Draft", type: "chapter" }] },
      { name: "Notes", root: "unsorted", seeds: [{ name: "Story Outline", type: "outline", templateKey: "outline" }] },
    ],
  },
  non_fiction: {
    folders: [
      { name: "Research", root: "canon", seeds: [] },
      { name: "Chapters", root: "manuscript", seeds: [{ name: "Chapter 1 — Introduction", type: "chapter", templateKey: "chapter" }] },
      { name: "Outlines", root: "unsorted", seeds: [{ name: "Book Outline", type: "outline", templateKey: "outline" }] },
      { name: "Notes", root: "unsorted", seeds: [] },
    ],
  },
  textbook: {
    folders: [
      { name: "Glossary", root: "canon", seeds: [] },
      { name: "Units", root: "manuscript", seeds: [{ name: "Unit 1 — Introduction", type: "chapter", templateKey: "chapter" }] },
      { name: "Exercises", root: "unsorted", seeds: [] },
      { name: "Notes", root: "unsorted", seeds: [] },
    ],
  },
  screenplay: {
    folders: [
      { name: "Characters", root: "canon", seeds: [] },
      { name: "Acts", root: "manuscript", seeds: [] },
      { name: "Scenes", root: "manuscript", seeds: [] },
      { name: "Notes", root: "unsorted", seeds: [{ name: "Beat Sheet", type: "outline", templateKey: "outline" }] },
    ],
  },
  poetry: {
    folders: [
      { name: "Poems", root: "manuscript", seeds: [{ name: "First Poem", type: "chapter" }] },
      { name: "Collections", root: "manuscript", seeds: [] },
      { name: "Notes", root: "unsorted", seeds: [] },
    ],
  },
  game_narrative: {
    folders: [
      { name: "Characters", root: "canon", seeds: [] },
      { name: "Lore", root: "canon", seeds: [{ name: "World Lore", type: "world_building", templateKey: "world_building" }] },
      { name: "Quests", root: "manuscript", seeds: [] },
      { name: "Dialogue", root: "manuscript", seeds: [] },
      { name: "Notes", root: "unsorted", seeds: [] },
    ],
  },
};
