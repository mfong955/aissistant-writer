# The Apply flow

Implementation spec. Read `AGENTS.md`, `docs/onboarding-workflows.md`, and `docs/canvas-mode.md`
first — this document is the connective piece both already called for and neither ever got:
a reviewable bridge from AI-proposed content into the real project.

**The problem this solves.** Two features already exist that produce organized content the
writer hasn't personally typed, and both were explicitly designed to *never* file that content
silently:

- Canvas mode (`docs/canvas-mode.md` §4) was always meant to end in an "Apply to Project" step
  that proposes named changes and lets the writer approve them item by item. It was never built
  — today a canvas is a dead end. A writer can spend an hour plotting a story on a board and then
  has to manually retype it into Canon/Manuscript.
- Import ("bring your pile," `docs/onboarding-workflows.md` §4) was specified as *"never
  auto-file an import — the AI proposes, the writer disposes."* That was never built either.
  Today, dropping a document into chat and asking the AI to organize it goes straight through
  `create_entity`/`update_entity`, the same as any other chat request — there is no staging step
  at all, which directly contradicts the spec.

Both gaps are the same gap. This doc builds the mechanism once.

---

## 1. Scope — what goes through review, and what doesn't

**Not everything.** The core chat-first loop — "add a character named Mara," "update Chapter 3"
— stays exactly as fast and direct as it is today, via the existing `create_entity`/
`update_entity`/`delete_entity` tools, unchanged. Gating every single AI write behind a review
screen would be a real regression to the product's core feel, and nothing about this problem
requires it.

Review applies specifically to **bulk, derived-from-an-external-artifact** writes — content the
writer hasn't seen yet because it came from a canvas or an imported file, not from typing it
themselves in conversation. That's a real trust boundary the other two docs already agree on
independently; this doc just gives it one shared mechanism.

The dividing line is a new tool, not a new rule bolted onto the old ones: `propose_plan`.
`create_entity`/`update_entity`/`delete_entity` are untouched. The AI decides which to reach
for — system-prompt guidance (§3) steers it, not a hard mechanical trigger. A canvas with one
node, or an import that turns out to be a single short note, doesn't need the ceremony; the
model can just say so and use `create_entity` directly. Flagged as an open question (§7) whether
that judgment call needs a hard backstop later.

---

## 2. The Plan

A **Plan** is the structured proposal `propose_plan` produces. It is not a new database table —
it's ephemeral, scoped to one chat exchange, held in the SSE payload and client state only, the
same way tool-call results already are. If the page reloads mid-review, the plan is gone and the
writer asks again; nothing durable is lost because nothing was written yet.

```
{
  source: "canvas" | "import"
  summary: string          // "Found 14 characters, 3 settings, 9 chapters, and 40 pages I
                            // couldn't classify." — written by the model, shown above the list
  items: [{
    id: string              // client-generated, for the review UI only
    action: "create" | "update"
    // create:
    name?: string
    type?: EntityType
    root?: "canon" | "manuscript" | "unsorted"
    path?: string
    // update:
    entity_id?: string
    // both:
    content: string          // plain text, same convention create_entity/update_entity already use
    reason: string           // one line: why this item — "appears in 4 scenes, no character sheet"
  }]
}
```

Deliberately mirrors `create_entity`'s own parameter shape (`name`/`type`/`root`/`path`/
`content`) — translating an accepted item into an actual write is a direct pass-through, not a
transform.

**No new "unclassified" bucket.** An item the model isn't confident about is simply proposed with
`root: "unsorted"` — the explorer roots system already has an answer for "I'm not sure," and
duplicating it here would be exactly the kind of premature taxonomy the roots work already
learned to avoid.

---

## 3. The tool

`propose_plan(source, summary, items[])` — pure surface-and-pause, like `ask_question`: it never
touches the database itself. Execution just returns the plan for the client to render.

**Always ends the turn.** Same rule as `ask_question`, same reason: proposing and then continuing
to act anyway would defeat the entire point. `processChat`'s round loop checks for
`propose_plan` calls exactly the way it already checks for `ask_question` and breaks immediately,
regardless of what else ran in that round.

System-prompt guidance (added to the existing tools list in `system-prompt-template.ts`):

> Use `propose_plan` instead of `create_entity`/`update_entity` when you're about to write several
> things at once *and* the content came from somewhere the writer hasn't already seen and typed
> themselves — a canvas being applied, or a document they just uploaded to be organized. For a
> single item, or content the writer is actively dictating to you in this conversation, just use
> `create_entity`/`update_entity` directly — don't make them review something they basically just
> told you to do.

---

## 4. Review UI

Rendered as a card inline in the assistant's chat message — same placement pattern as the
workflow-picker card, not a separate modal, so it stays in the natural flow of the conversation
rather than interrupting it.

- `summary` at the top.
- One row per item: destination (`root`/`path` for creates, entity name for updates), a
  collapsed content preview, `reason`, a checkbox (checked by default), and an edit affordance
  (inline textarea) for adjusting content or destination before applying.
- Select all / none, matching the existing rename-sync review dialog's pattern
  (`project-explorer.tsx`) for consistency — not the same component (different data shape,
  needs to render inline in chat rather than as a floating dialog), but the same interaction
  language.
- One "Apply selected" button.

**Execution bypasses the model entirely.** Clicking "Apply selected" calls a plain API route,
not another chat turn — `POST /api/plans/apply` with the accepted (and possibly edited) items.
The route executes each one through the *existing* `dbCreateEntity`/`dbUpdateEntity`/
`resolveEntityParent` functions — the same code path `create_entity`'s tool execution already
uses, called directly instead of asking the model to re-emit N tool calls. This is more
reliable (no risk of the model failing to reproduce the plan on a second pass), cheaper (no
extra generation), and simpler (no round-trip needed once the writer has already decided).

Each applied item gets a normal `change_logs` entry and session-log line, actor `"user"` (the
writer approved it, even though the AI drafted it) — consistent with how every other write in
this app is attributed.

---

## 5. Canvas → Plan

Triggered by a new "Apply to Project" button in the canvas toolbar (`canvas-board.tsx`, next to
Checkpoint/History). Clicking it doesn't call a new endpoint — it drops a message into the
already-visible chat panel via the same custom-event bridge the explorer's "Add to Chat" already
uses (`aissistant:add-to-chat` in `chat-input.tsx`): a new `aissistant:canvas-apply` event
carrying the canvas id, picked up by `chat-panel.tsx`, which sends a fixed kickoff prompt
("Apply canvas <name> to the project — read it and propose a plan."). Chat is already visible
during Canvas mode (confirmed: `AppShell`'s `chat` slot is unconditional in `project-shell.tsx`,
only `sidebar`/`editor` swap between modes) — no new UI surface needed, just the button and the
event.

From there the model calls `read_canvas`, then `propose_plan`:

- A `kind: "linked"` node (already tied to a real entity) → an `update` item folding the node's
  `body` into that entity's content.
- A `kind: "freeform"` node → a `create` item, using the same type/root/path judgment the model
  already applies for ordinary `create_entity` calls.
- Edge labels inform content prose ("connected to Kessa via 'betrays'") rather than becoming
  their own structured field — not worth a new concept for what a sentence already covers.

---

## 6. Import → Plan

No new upload UI — the existing paperclip-attach flow (`chat-input.tsx`, PDF/DOCX/text
extraction via `/api/extract-document`) is unchanged. The only change is what happens *after*
extraction: system-prompt guidance for the `pile_import` workflow (already present in
`onboarding.ts`'s `openingGuidance`) gets one line added, steering the model toward
`propose_plan` once it has something substantial to organize, instead of filing directly.

---

## 7. Open questions

- Should there be a hard item-count threshold below which the model is *required* to skip
  `propose_plan` and just create directly (e.g., a canvas with 1–2 nodes)? Left as prompt-guided
  judgment for v1; revisit if the model's calibration proves unreliable in practice rather than
  pre-building a rule for a problem not yet observed.
- Server-side duplicate detection — if a proposed `create` item's name closely matches an
  existing entity in the same root, should the apply endpoint warn rather than silently create a
  near-duplicate? Worth adding, not required for v1; the model already has the entity index and
  is asked to prefer `update` when it recognizes an existing match, so this is a safety net for
  when that judgment misses, not the primary mechanism.
- Should applying from a canvas leave a marker on the canvas itself (e.g., a checkpoint labeled
  "Applied") so it's visible later which version of the board a given batch of project changes
  came from? Nice-to-have, deferred — doesn't block the core flow.

---

## 8. Build order

1. `propose_plan` tool (schema + pure surface-and-pause execution, mirroring `ask_question`) +
   loop integration (halt the round the same way `ask_question` does) + system-prompt guidance.
2. `POST /api/plans/apply` — executes accepted items via the existing entity CRUD functions.
3. Frontend: plan review card component, `use-chat.ts` handling for a new `plan` SSE event,
   wired into the chat message list the same way the workflow-picker card already is.
4. Canvas "Apply to Project" button + the `aissistant:canvas-apply` event bridge.
5. One line of added guidance to the `pile_import` workflow's system-prompt text so imports route
   through the same mechanism — no new import-specific UI.
