# Consistency checking

Implementation spec. Read `AGENTS.md` and `docs/apply-flow.md` first — this feature is a
specialized use of the mechanism that doc already built, not a new one.

**The problem this solves.** AGENTS.md's own Goal section lists AI consistency checking as a
core feature, same tier as chat-first authoring: *"the AI fact-checks against established
character traits, settings, timelines, and flags contradictions."* Today that's one passive line
in the system prompt ("flag contradictions when you detect them") — it only happens if the model
happens to notice mid-conversation about something else. There's no way to actually ask for a
check and get back something structured, reviewable, and actionable. For a stated flagship
feature, the gap between promise and delivery is real.

It matters most for the returning-writer persona (`docs/onboarding-workflows.md`'s second core
persona): someone back after months away has almost certainly drifted from their own canon
without noticing, and doesn't remember the project well enough to catch it themselves.

---

## 1. This is not a new mechanism — it's propose_plan with a third source

`docs/apply-flow.md` already built a batch-review-and-approve pipeline: `propose_plan`,
halts the turn, renders as a card, applies through existing entity CRUD. A consistency finding
is structurally the same thing as a plan item — *"here's a discrepancy, here's a suggested fix,
you decide."* Rather than a new tool, `propose_plan` gains a third `source`: `"consistency"`.
Everything else — the review card, the halt-the-round behavior, the apply endpoint — is reused
as-is.

**One real addition is needed: a `"flag"` action**, alongside the existing `"create"`/`"update"`.
Not every contradiction has an obvious fix — *"Chapter 7 has him in Rivenhall, but the timeline
has him still traveling there — not sure which is right"* is a legitimate finding with nothing to
apply, just something for the writer to look at. Forcing the model to always propose a concrete
fix would push it toward inventing one it isn't confident about, which is exactly the failure
mode `docs/onboarding-workflows.md` §4 already rejected for imports (*"admitting confusion earns
more trust than a confident wrong guess"*). A `flag` item has no `entity_id`/`content` — just
`reason` and a `quote` — and never reaches the apply endpoint; it's informational, dismissible,
not appliable. This is a small, generally useful extension to `propose_plan`, not
consistency-specific plumbing.

---

## 2. Scope for v1: the open entity against Canon, not the whole manuscript

Checking an entire multi-chapter manuscript against canon is a large, expensive operation — it
would mean reading every Manuscript entity via `read_entity` in turn, easily exceeding
`MAX_TOOL_ROUNDS` (8) on anything but a short project, and burning real tokens/cost on every
run. That's a genuine v2 problem (batching, pagination, probably its own progress UI) and not
needed to deliver real value now.

**v1 scope is nearly free by comparison, because the pieces are already in context on every
turn:** Canon summaries are always included by lookup (the explorer-roots work), and the entity
currently open in the editor is already injected as "Currently Editing" full content
(`context-builder.ts`'s `activeEntityContent`). A check of *"does what I'm looking at right now
contradict established canon"* requires **zero additional tool calls** — the model already has
everything it needs sitting in the system prompt. This is the whole reason to scope it this way:
it's the cheapest possible version of the feature that's still genuinely useful, not a
compromise.

Whole-project sweeps are an explicit non-goal for this build — flagged in §6, not designed here.

---

## 3. Trigger: on-demand, chat-driven, no new UI surface

Matches the leanest pattern already used for `ask_question`/`propose_plan` themselves: no new
button, no new page. The writer asks in chat ("check this scene against what I've established,"
"does this contradict Sera's character sheet?"), and system-prompt guidance tells the model to
respond with `propose_plan(source: "consistency", ...)` instead of just describing issues in
prose. The model may also do this unprompted, sparingly, the same way `ask_question` is allowed
to fire opportunistically rather than only on request — if it notices something clearly wrong
while doing other work, it can flag it rather than staying silent. Not a forced systematic pass;
same "don't interview a writer who didn't ask" calibration `ask_question`'s own guidance already
establishes.

---

## 4. Item shape

Extends `propose_plan`'s existing `items[]` — no new tool, no new endpoint:

```
{
  action: "create" | "update" | "flag"   // flag is new
  // update/flag:
  entity_id?: string       // the Manuscript entity with the issue (flag can omit if general)
  quote?: string            // the specific passage in question
  established_fact?: string // what Canon actually says, and where
  // update only:
  content?: string          // proposed corrected text, full replacement
  // all:
  reason: string            // the contradiction itself, in plain language
}
```

A finding with a clear fix comes back as `action: "update"` with `content` set — reviewed and
applied exactly like any other plan item. A finding with no confident fix comes back as
`action: "flag"` — shown, not appliable.

---

## 5. Review card changes

`PlanReviewCard` renders `flag` items in a visually distinct section — no checkbox, no
edit-content affordance (there's no content to edit), just the `reason`/`quote`/`established_fact`
and, if useful, a "Jump to entity" link. "Select all" / "Apply N selected" only ever count
`create`/`update` items; flags are acknowledged by reading them, not by an action.
`POST /api/plans/apply` never receives flag items — filtered client-side before the request is
built, same as an unchecked item today.

---

## 6. Open questions

- Whole-manuscript sweep (v2): needs batching across many `read_entity` calls, likely its own
  progress affordance since it wouldn't complete in one turn, and a cost conversation for the
  credits path. Not designed here — flagged so it isn't lost, not because it isn't worth doing.
- Should applying an `update` from a consistency finding also leave a trace on the *other*
  entity, e.g. a note on the Canon side that "this was resolved by editing Chapter 7"? Not for
  v1 — the `change_logs` entry from the apply step already records what changed; a
  cross-reference is a nice-to-have, not required for the finding to be useful.
- Proactive vs. request-only calibration is `ask_question`'s same open question, transplanted
  here. No new answer needed — same guidance, same failure mode to avoid (over-flagging becomes
  its own annoyance).

---

## 7. Build order

1. Extend `propose_plan`'s schema: `source` gains `"consistency"`, `action` gains `"flag"`.
   `executeToolCall`'s `propose_plan` case needs no logic change — it already just passes
   through whatever shape the model sends.
2. `PlanReviewCard`: render `flag` items in their own section, exclude them from
   select-all/apply.
3. `POST /api/plans/apply`: defensive filter — ignore any `action: "flag"` item that somehow
   arrives, alongside the client-side filter.
4. System-prompt guidance: when to reach for `propose_plan(source: "consistency")` instead of
   just describing an issue in prose, and the update-vs-flag judgment call.
