# Cold-start onboarding, workflows, and the rewrite model

Implementation spec. Read `AGENTS.md` first — this document expands the Phase 3 items in
its "What's next" list and does not repeat decisions recorded there.

**The problem this solves.** The product is aimed at writers who have a story in their
head and never start it. Everything below serves one goal: a stranger arrives, and within
ten minutes has written prose they're willing to keep. Not planned a novel. Written
something.

---

## 1. Project structure

Three permanent top-level containers per project. None can be deleted or renamed.

| Root | Holds | Lifecycle |
|---|---|---|
| **Canon** | Characters, settings, timeline, rules, themes | Cumulative. Survives every rewrite. |
| **Manuscript** | Scenes, chapters, drafts | Disposable by design. Replaced on a restart. |
| **Unsorted** | Anything unclassified, including import leftovers | Permanent, first-class, not an error state. |

Inside `Canon`, each project type seeds a default skeleton (novel: Characters, Settings,
Timeline, Rules). Seeded, not fixed — the writer can rename, nest, add, and remove freely.
The correct taxonomy is not yet known; it should be learned from real imports.

**Enforced at the application layer, not the schema.** `entities` keeps `type` and
`parent_id` exactly as they are. Roots are rows the app guarantees exist. Revising the
ontology later is a data migration, not a schema migration.

### The rule that makes this worth doing

**The AI may only create entities inside these three roots, and must route to `Unsorted`
when uncertain rather than inventing a location.**

This is the point of fixing the structure. A free-form tree does not fragment because
writers organize badly — it fragments because the *model* names things inconsistently
across sessions ("Characters", then "Cast", then "characters"), after which the context
builder silently stops finding them. Constraining the model's write targets buys
determinism for `context-builder.ts` and `relevance-scorer.ts` while costing the writer
no freedom at all.

Implementation notes:
- `src/lib/openrouter/tools.ts` — entity-creating tools take a root plus a path, with a
  closed enum for the root. No free-form root strings.
- `src/lib/context/context-builder.ts` — all Canon summaries can now be included by
  lookup instead of relevance guessing. Manuscript stays relevance-scored; it is large.
- Every project creation path must seed all three roots, including imports.

---

## 2. Entry points

Do not ask a new user what kind of writer they are — a cold-start writer cannot answer
that. Ask what they already have, which they can answer instantly.

| Door | User state | Lands in |
|---|---|---|
| **Nothing yet** | "I want to write something." | Conversation. The AI's job is to find the seed, not hand them one. |
| **A seed** | A character, an image, a "what if", a scene, a feeling. | Conversation that converts the seed into Canon entries plus a first scene. |
| **A pile** | Notes, docs, half-drafts, an abandoned project. | Import staging (§4). |

The third door is underserved everywhere else in this category and is the closest to the
founder's own experience. Every competitor onboards as though the user is starting fresh.

---

## 3. Workflows

Offered after the entry point, never before. Each is presented with a diagram, who it
suits, **and where it usually breaks** — publishing failure modes is a differentiator and
builds trust with writers who have been burned by AI tools.

**Workflows are non-binding.** A writer may switch at any time and their work carries
across. A discovery writer who stalls at 35k words should be able to pull a beat sheet
over what already exists; a planner sick of planning should be able to jump into a scene.
That fluidity *is* the product — every methodology tool that forces commitment loses.

| # | Workflow | Best for | Where it breaks |
|---|---|---|---|
| 1 | **Just start writing** (discovery) | Thinking by writing; short fiction; anyone who freezes when planning | The middle, around 30–40k words |
| 2 | **Write the scene you can't stop thinking about** (anchor scene) | A vivid moment with no story around it | Building outward can stall if the scene has no consequences |
| 3 | **One sentence, then grow it** (Snowflake) | Large casts, multiple threads, needing to see the shape first | Snowflaking forever and never drafting |
| 4 | **Beat sheet first** (Save the Cat) | Genre and commercial fiction; people who find a labeled empty box less frightening than a blank one | Formula fatigue; beats filled dutifully rather than truthfully |
| 5 | **Start at the end** (Seven-Point) | Mysteries, thrillers, twist-dependent stories | Hard when the ending is genuinely unknown |
| 6 | **Start with a person** (Story Circle) | Literary and character-driven work; "I have a character but no plot" | Plot can stay thin if want-vs-need never externalizes |
| 7 | **Bring your pile** (import and organize) | Returning to an abandoned project | Organizing becomes a way to avoid writing |

**Default for cold start: #2.** It is the most common real state, produces prose within
ten minutes, and no competitor leads with it.

For research grounding on the ~50/50 plotter/pantser split and the structures above, see
the sources in the conversation record; the practical consequence is that there is no
majority approach to optimize for, which is the argument for offering several.

### Entry point × workflow are independent axes

Entry point determines what is in the project on arrival. Workflow determines what the AI
does next. Any door feeds any workflow — do not collapse them into one menu.

The cell worth building first: **pile + beat sheet.** Import an abandoned novel, and the
AI maps what exists onto the beats and shows the holes. That is a diagnosis, not a
feature — *here is why it stalled and here is what is missing* — and nothing else on the
market offers it.

---

## 4. Import staging

**Never auto-file an import.** The AI proposes; the writer disposes.

1. Extract (`extract-document` already handles PDF and DOCX).
2. Propose a structure in a staging view: "Found 14 characters, 3 settings, 9 chapters,
   and 40 pages I couldn't classify."
3. Accept, edit, or reject **per item**.
4. Unclassified material goes to `Unsorted` — visible and usable, not discarded.
5. Original uploads remain intact and viewable forever.

Admitting confusion earns more trust than a confident wrong guess, and it turns a bad
import from a data-integrity disaster into an annoyance.

### The fork after staging

Ask the real question — three options, not two:

- **Continue where I left off** → jump to the most recent Manuscript entity
- **Rework it** → impact-report flow (§5)
- **Start fresh, keep the bones** → new Manuscript, Canon carried forward, old Manuscript
  archived

---

## 5. Rewrites and restarts

**The constraint is psychological before it is technical. Writers do not delete drafts,
because deleting feels like killing.** Every writer has a cuts file they never open. The
governing rule follows from that:

> Nothing is ever destroyed, only re-shelved.

Once that promise is credible, "strip it and start over" stops being frightening and
becomes the feature.

**Canon / Manuscript split (§1) does most of the work.** Almost every real rewrite discards
manuscript and keeps canon. With the split structural rather than inferred, "start over"
is: keep Canon, archive Manuscript, open an empty one.

**The Attic — soft delete, never hard delete.** One nullable `archived_at` column plus a
filter. Everything removed is searchable and restorable, and — the part that delights —
*the AI can still read it*: "You cut a scene where she confronts her father. The chapter
you're writing might want it." One column, and nobody else in this category does it.

**Impact reports, not auto-propagation.** For changes like "make her the antagonist" or
"cut the sister", the AI produces a report — "affects chapters 3, 7, 11 and Maya's
character sheet; here is the specific contradiction in each" — and the writer works the
list, approving or rejecting each fix.

Automatic propagation is explicitly rejected, not merely deferred. Its failure mode is
*invisible*: the user discovers it weeks later, in chapter 7, when a character says
something they never wrote. That is an unrecoverable trust failure. Deciding what a change
means is the writing; writers want to do it.

**Drafts as first-class objects — deferred.** A `drafts` table with `entities.draft_id`,
so a project holds Draft 1 and Draft 2 and restarting means a carry-forward picker. It is
the right long-term shape, because "the second draft" and "the version where she was the
villain" is how writers think — far better than git-style history, which is a developer
concept. Build it when a user asks. §1 and the Attic capture most of the value first.

---

## 6. v1 cut

Ship this; defer the rest.

**In:** three explorer roots with seeded skeleton and constrained AI writes · three entry
points · workflows 1, 2, 4, 7 · import staging · `archived_at` and the Attic view · the
post-staging fork.

**Out:** workflows 3, 5, 6 · drafts as objects · impact reports · the pile-plus-beat-sheet
diagnosis (build it second — it is the thing people will talk about, but it depends on
everything above).

The Canon/Manuscript split and the Attic are in v1 specifically because they are what make
impact reports possible later. Nothing else deferred here is load-bearing.

---

## 7. Open questions

- Does OpenRouter's OAuth PKCE flow work for BYOK connect? Under BYOK-only launch this is
  the single highest-leverage unknown — copy-pasting an API key is now the *only* door
  into the product, and it will lose most non-technical writers.
- What is the real Canon taxonomy? Unknown until ~10 real imports. Do not pre-commit.
- Where does the workflow chooser live — first-run only, or always available from a
  project? Non-binding workflows argue for always available.
