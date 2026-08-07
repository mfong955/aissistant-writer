import type { Project } from "@/types/database";

// docs/onboarding-workflows.md §2 — what a writer already has when starting a project.
// Independent of project type: type determines the Canon skeleton, entry point determines
// what's already in the project on arrival.
export type EntryPoint = "nothing" | "seed" | "pile";

export const ENTRY_POINTS: { key: EntryPoint; title: string; description: string }[] = [
  { key: "nothing", title: "Nothing yet", description: "I want to write something." },
  { key: "seed", title: "A seed", description: "A character, an image, a “what if,” a scene, a feeling." },
  { key: "pile", title: "A pile", description: "Notes, docs, half-drafts, an abandoned project." },
];

// docs/onboarding-workflows.md §3 — non-binding, switchable any time. v1 cut (§6) ships
// workflows 1, 2, 4, 7; 3, 5, 6 are deferred.
export type WorkflowKey = "discovery" | "anchor_scene" | "beat_sheet" | "pile_import";

export interface WorkflowDefinition {
  key: WorkflowKey;
  title: string;
  bestFor: string;
  whereItBreaks: string;
  /** Steering note injected into the system prompt — shapes the AI's opening move and ongoing lean. */
  openingGuidance: string;
}

export const WORKFLOWS: WorkflowDefinition[] = [
  {
    key: "discovery",
    title: "Just start writing",
    bestFor: "Thinking by writing; short fiction; anyone who freezes when planning.",
    whereItBreaks: "The middle, around 30–40k words.",
    openingGuidance:
      "Open by asking what scene or moment they want to write right now, not about plot or planning. Get them writing actual prose in the first exchange. If they later stall mid-project, gently note that's exactly where this approach tends to break, and offer to pull a beat sheet over what already exists.",
  },
  {
    key: "anchor_scene",
    title: "Write the scene you can't stop thinking about",
    bestFor: "A vivid moment with no story around it yet.",
    whereItBreaks: "Building outward can stall if the scene has no consequences.",
    openingGuidance:
      "Open by asking about the scene that's stuck in their head — what they see, who's in it, what's about to happen — and help them write it first. Only once it exists, ask what has to be true before and after it for the scene to matter to a larger story.",
  },
  {
    key: "beat_sheet",
    title: "Beat sheet first",
    bestFor: "Genre and commercial fiction; writers who find a labeled empty box less frightening than a blank one.",
    whereItBreaks: "Formula fatigue — beats filled dutifully rather than truthfully.",
    openingGuidance:
      "Walk through beat-sheet structure one beat at a time in plain language — ask what happens at each beat rather than naming the beat and waiting for them to know what that means. If answers start feeling dutiful rather than true to the story, say so.",
  },
  {
    key: "pile_import",
    title: "Bring your pile",
    bestFor: "Returning to an abandoned project.",
    whereItBreaks: "Organizing becomes a way to avoid writing.",
    openingGuidance:
      "Ask them to drop their existing files into chat so you can extract and organize them. Propose where things fit across Canon/Manuscript/Unsorted rather than filing anything silently. If they're still organizing several turns in with no new writing, gently flag that organizing can become a way to avoid writing.",
  },
];

/** docs/onboarding-workflows.md §3: "Default for cold start: #2" (anchor scene). */
export function defaultWorkflowKey(entryPoint?: EntryPoint | null): WorkflowKey {
  return entryPoint === "pile" ? "pile_import" : "anchor_scene";
}

export function getWorkflow(key: WorkflowKey | null | undefined): WorkflowDefinition | null {
  return WORKFLOWS.find((w) => w.key === key) ?? null;
}

export type WorkflowStatus = "unset" | "chosen" | "skipped";

export interface OnboardingSettings {
  entryPoint?: EntryPoint;
  workflow?: WorkflowKey | null;
  workflowStatus?: WorkflowStatus;
}

/** Reads onboarding fields out of the free-form `projects.settings` JSONB blob. */
export function getOnboardingSettings(project: Pick<Project, "settings">): OnboardingSettings {
  return (project.settings ?? {}) as OnboardingSettings;
}
