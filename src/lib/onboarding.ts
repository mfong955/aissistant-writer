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
// workflows 1, 2, 4, 7, plus "brain_dump" (added from direct product feedback — a distinct
// axis from the other four: sorting unstructured ideas rather than drafting toward a shape).
export type WorkflowKey = "discovery" | "anchor_scene" | "beat_sheet" | "pile_import" | "brain_dump";

export interface StarterPrompt {
  label: string;
  /** Sent verbatim as the user's first chat message when clicked. Always optional to click. */
  prompt: string;
}

export interface WorkflowDefinition {
  key: WorkflowKey;
  title: string;
  /** Plain-language definition of the method itself — shown in the picker card. */
  about: string;
  bestFor: string;
  /**
   * Known failure mode. Not shown in the picker UI (feedback: leads with the wrong thing
   * before someone's even chosen) — used only in the system-prompt steering note so the AI
   * can proactively flag it if it starts happening.
   */
  whereItBreaks: string;
  /** Steering note injected into the system prompt — shapes the AI's opening move and ongoing lean. */
  openingGuidance: string;
  /**
   * Optional one-click prompts shown after choosing this workflow — a mix of "explain the
   * theory and guide me" and "just start doing it." Purely optional accelerators for
   * beginner/intermediate writers; a writer who already knows the method just types their
   * own first message and never sees these get in the way.
   */
  starterPrompts: StarterPrompt[];
}

export const WORKFLOWS: WorkflowDefinition[] = [
  {
    key: "discovery",
    title: "Just start writing",
    about:
      "Write without planning first — let the story reveal itself through the act of writing, scene by scene, rather than mapping it out beforehand.",
    bestFor: "Thinking by writing; short fiction; anyone who freezes when planning.",
    whereItBreaks: "The middle, around 30–40k words.",
    openingGuidance:
      "Open by asking what scene or moment they want to write right now, not about plot or planning. Get them writing actual prose in the first exchange. If they later stall mid-project, gently note that's exactly where this approach tends to break, and offer to pull a beat sheet over what already exists.",
    starterPrompts: [
      { label: "How does this approach actually work?", prompt: "Explain how writing by discovery works and how you'll help me as I go." },
      { label: "Just start", prompt: "I don't have a plan — ask me questions until a scene starts to form, then let's write it." },
    ],
  },
  {
    key: "anchor_scene",
    title: "Write the scene you can't stop thinking about",
    about:
      "Start with the one vivid moment already alive in your head — write that scene first, then work outward to figure out what has to surround it.",
    bestFor: "A vivid moment with no story around it yet.",
    whereItBreaks: "Building outward can stall if the scene has no consequences.",
    openingGuidance:
      "Open by asking about the scene that's stuck in their head — what they see, who's in it, what's about to happen — and help them write it first. Only once it exists, ask what has to be true before and after it for the scene to matter to a larger story.",
    starterPrompts: [
      { label: "How does this approach actually work?", prompt: "Explain the 'anchor scene' approach and how we'll build a story outward from it." },
      { label: "Let's write the scene", prompt: "Here's the scene I can't stop picturing — let's write it together." },
    ],
  },
  {
    key: "beat_sheet",
    title: "Beat sheet first",
    about:
      "Rough out the story's major turning points before drafting a word of prose — anything from a formal beat sheet (Save the Cat-style) to a looser personal outline. You choose how rigid; the AI follows your lead.",
    bestFor: "Genre and commercial fiction; writers who find a labeled empty box less frightening than a blank one.",
    whereItBreaks: "Formula fatigue — beats filled dutifully rather than truthfully.",
    openingGuidance:
      "First ask whether they want a tight, named-beat structure (Save the Cat-style) or a looser personal outline — then follow whichever they pick. Walk through it one beat/section at a time in plain language, asking what happens rather than naming the beat and waiting for them to know what that means. If answers start feeling dutiful rather than true to the story, say so.",
    starterPrompts: [
      { label: "How does a beat sheet actually work?", prompt: "Explain how a beat sheet works and walk me through building one." },
      { label: "Let's build it together", prompt: "Let's build my beat sheet together, one beat at a time." },
    ],
  },
  {
    key: "brain_dump",
    title: "Just start planning",
    about:
      "No structure required. Talk through everything in your head — characters, scenes, fragments, half-formed questions, in any order — and the AI listens, asks clarifying questions, and sorts it into Canon and Unsorted as you go.",
    bestFor: "You've got a lot of ideas and want help sorting them before worrying about structure or drafting.",
    whereItBreaks: "Can circle forever if nothing ever gets committed to page.",
    openingGuidance:
      "Don't ask about plot structure or push toward drafting yet. Just listen — ask open questions that keep them talking, and organize what they share into Canon/Unsorted entities as the conversation goes, telling them what you filed and where. Once a good pile of material exists, gently suggest picking a drafting approach when it feels right — never before they're ready.",
    starterPrompts: [
      { label: "How does this work?", prompt: "Explain how this approach works — what should I expect as I just talk things out with you?" },
      { label: "Let me just talk", prompt: "Here's everything in my head, unsorted — help me make sense of it." },
    ],
  },
  {
    key: "pile_import",
    title: "Bring your pile",
    about:
      "Drop in your existing notes, docs, or half-finished drafts. The AI extracts what's there and proposes how it maps onto Canon, Manuscript, and Unsorted — you decide what to keep.",
    bestFor: "Returning to an abandoned project.",
    whereItBreaks: "Organizing becomes a way to avoid writing.",
    openingGuidance:
      "Tell them exactly how to bring files in: click the paperclip/attach icon at the bottom-left of the chat box (there's no drag-and-drop yet) to upload a document — PDF, DOCX, or plain text all work. Once something substantial is uploaded and they want it organized, use propose_plan rather than create_entity/update_entity directly — never file an import silently. Say plainly when a file was too thin to extract much from rather than inventing content to fill the gap. If they're still organizing several turns in with no new writing, gently flag that organizing can become a way to avoid writing.",
    starterPrompts: [
      { label: "What will you do with my files?", prompt: "Explain what happens when I drop my files in — how do you decide what goes where?" },
      { label: "Here's my pile", prompt: "I'll drop my files in now — tell me what you find." },
    ],
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
