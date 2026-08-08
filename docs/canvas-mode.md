# Canvas mode

Implementation spec. Read `AGENTS.md` first. This is a future feature — the data model is
being scaffolded now; the UI, AI tools, and apply-to-documents flow are not yet built.

**The problem this solves.** Prose is a bad medium for holding a story's shape in your head
while you're still deciding what that shape is. Writers plan visually — index cards, corkboards,
whiteboards — before or alongside drafting. Canvas mode gives them an interactive board for
that, with the AI able to read and edit it as a genuine collaborator, while keeping it
strictly separate from the real manuscript until the writer explicitly says to apply it.

---

## 1. What a canvas is

A canvas is a board of nodes and edges — boxes with titles and freeform content, connected by
lines — representing plot points, scenes, character arcs, timelines, whatever the writer is
mapping out. It is **not** part of the Canon/Manuscript/Unsorted tree (`docs/onboarding-workflows.md`
§1). It's a separate, parallel surface: temporary by default, promotable to real project
content only through an explicit, reviewable step.

**Canvas mode is its own UI mode**, not a node type inside the existing explorer — a
toolbar-level switch between "Explorer" (today's Canon/Manuscript/Unsorted view + document
editor) and "Canvas" (a list of the project's canvases + the board view). Canvases never
appear in the regular explorer tree.

### Node shape

```
{
  id: string
  position: { x: number, y: number }
  title: string
  kind: "freeform" | "linked"
  linkedEntityId?: string   // present when kind === "linked" — ties back to a real entity
  body: string              // notes, description, whatever the writer put there
  color?: string
}
```

`linkedEntityId` is what makes the canvas AI-legible in project terms rather than just a
diagram: a node can point at an actual Canon character or Manuscript chapter, so both the
writer and the AI can move between "the box on the board" and "the real file" without
re-explaining which is which.

### Edge shape

```
{ id: string, source: string, target: string, label?: string }
```

No edge types or semantics beyond a label for v1 — no attempt to formally model "causes" vs.
"follows" vs. "conflicts with." That's exactly the kind of premature taxonomy the explorer-roots
work already learned to avoid pre-committing to (`docs/onboarding-workflows.md` §7).

---

## 2. Storage

Canvases are `entities` rows (`type: "canvas"`), not a new top-level object — this reuses RLS,
`version_hash`, and the existing autosave/API infrastructure for free. `content` holds
`{ nodes: [...], edges: [...] }` instead of a Tiptap document. `parent_id` stays `null`; the
explorer's tree-building excludes `type === "canvas"` the same way it already excludes
Progress/Instructions by name — canvases simply never enter that tree. Canvas mode's own list
queries for `type === "canvas"` directly.

This required widening the `entities.type` check constraint, which is also where the
long-standing gap where `'image'` was never added to it (`001_initial_schema.sql`) got fixed
as a side effect — see migration `005_canvas_mode.sql`.

### Versions

A separate `canvas_versions` table: `canvas_id`, `snapshot` (jsonb), `label`, `created_at`.
Append-only, never overwritten — the Attic philosophy (`docs/onboarding-workflows.md` §5)
applied to structured data instead of prose. A snapshot is written:

- automatically, before the AI makes a bulk edit to a canvas
- on an explicit "checkpoint" action from the writer

Restoring a version writes its snapshot back as current content — and itself creates a
checkpoint of the state just before the restore, so restoring is never itself destructive.

### Conflict detection, not real-time collaboration

The scenario to guard against is accidental — the same canvas open in two tabs or two
browsers — not simultaneous co-editing as a feature. `entities.version_hash` already exists
for exactly this: before a save, compare the hash the client started from against the current
server value. Mismatch → refuse the save, tell the writer to reload. No merge, no live
cursors, no operational transforms — those solve a different problem than the one in scope
here, and would be a substantially larger feature in their own right.

---

## 3. AI integration

Two tools, mirroring `create_entity`/`update_entity`'s shape: `read_canvas` (returns the full
node/edge graph) and `update_canvas` (a structured patch — add/remove/edit nodes and edges in
one call, since a graph is small enough to read and write wholesale rather than needing
per-node tool calls). When a canvas is the active context in chat, its full graph is included
the same way "Currently Editing" content is today.

**AI writes to a canvas directly — no confirmation step.** The canvas itself is the sandbox;
gating every AI edit behind a click would put a wall in front of something explicitly
reversible (undo via version history) and two-way (the writer can just edit it back, or ask the
AI to). The caution belongs at the boundary between the canvas and the real project, not
inside the canvas.

---

## 4. Applying a canvas to the project

The one place this *does* require explicit approval, because it's the boundary between the
sandbox and real project content:

1. Writer clicks "Apply to Project."
2. The AI reads the full canvas and produces a plan: concrete, named changes using the same
   `root` + `path` model `create_entity` already uses — e.g. *"Create `Mara` under
   Canon/Characters; update `Chapter 3` under Manuscript to reflect the new confrontation
   scene."*
3. The plan renders as a per-item accept/edit/reject list — the same review-dialog pattern
   already built for rename-sync suggestions in the explorer (`project-explorer.tsx`'s related-
   names dialog), not a new UI concept.
4. Only accepted items execute, through the normal `create_entity`/`update_entity` tools.

This is the impact-report pattern from `docs/onboarding-workflows.md` §5, generalized beyond
rewrites: propose, let the writer decide item by item, never propagate silently. The doc's own
reasoning for that rule applies unchanged here — *"deciding what a change means is the
writing; writers want to do it."*

---

## 5. Rendering

React Flow (`@xyflow/react`) for the board itself — dragging, connecting, pan/zoom, minimap.
This is a well-solved UI problem; hand-rolling it would be a lot of fiddly work to end up
somewhere worse than the standard tool for exactly this shape of interface.

---

## 6. Build order

1. **Data model** (in progress): migration, types, `src/lib/db/canvas.ts` data-access layer
   with conflict-aware writes. No UI yet.
2. Canvas mode UI: mode toggle, canvas list ("its own explorer"), React Flow board, node/edge
   editing, checkpoint action, version history view.
3. AI tools: `read_canvas`, `update_canvas`, wiring into the chat context builder.
4. Apply-to-project flow: plan generation + the per-item review dialog.

## 7. Open questions

- Exactly how AI-authored canvas generation gets triggered from chat ("build me a plot canvas
  for this project") — a dedicated intent, or the model deciding to call a
  `create_canvas`-equivalent tool on its own judgment? Decide when tool wiring starts (step 3).
- Whether `linkedEntityId` nodes should live-sync their title from the real entity's name (so a
  rename in the explorer doesn't leave a stale label on the board) — likely yes, deferred until
  the UI exists to notice the problem concretely.
- Multi-canvas relationships (does a project usually have one working canvas, or many
  simultaneously — one per plot thread, one for character arcs, etc.)? Unknown until real use;
  same "don't pre-commit to taxonomy" stance as the explorer roots.
