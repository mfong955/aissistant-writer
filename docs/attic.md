# The Attic

Implementation spec. Read `AGENTS.md` and `docs/onboarding-workflows.md` §5 first — this
builds a feature that document already named and designed, and never got built.

**The problem this solves.** `dbDeleteEntity` is a genuine hard `.delete()` today. No
`archived_at` column, no trash, no recovery path — canvases got a proper version-history
restore mechanism (`canvas_versions`) this session, but a chapter or character sheet has zero
protection. One misclick, or the AI calling `delete_entity` on the wrong thing, and it's gone,
with only a plain `confirm()` dialog standing in the way.

This isn't a new idea — `docs/onboarding-workflows.md` §5 named it, gave it its name, and
described it in one sentence: *"One nullable `archived_at` column plus a filter. Everything
removed is searchable and restorable... nothing is ever destroyed, only re-shelved."* It was
never built. The reasoning for why it matters is already recorded too: *"writers do not delete
drafts, because deleting feels like killing."* That's the whole case for doing this now — every
serious writing tool has some answer to "get back what I just lost," and this one currently
doesn't.

---

## 1. Mechanism

`entities` gains `archived_at timestamptz` (null = active). Three operations replace the
current single hard-delete:

- **Archive** (what "delete" now means everywhere in the UI): sets `archived_at = now()`.
- **Restore**: sets `archived_at = null`.
- **Purge**: the actual hard `.delete()` — only reachable from inside the Attic view itself,
  never the default action anywhere else.

`dbDeleteEntity`'s name and signature don't change — every existing caller (`/api/entities/[id]`,
`tools.ts`'s `delete_entity`) was already using "delete" to mean "remove this from my view,"
which archiving satisfies just as well; nothing needs to change at those call sites. Two new
functions are added: `dbRestoreEntity` and `dbPurgeEntity`, plus `dbGetArchivedEntities` for the
Attic's own listing.

This applies uniformly to every entity type, including canvases — there's no canvas-specific
delete path, so canvas deletion gets Attic protection for free, on top of the version history
(`canvas_versions`) it already has for content changes within a canvas that still exists.

---

## 2. Cascading — archive/restore walk the subtree, purge doesn't need to

Archiving a folder has to take its contents with it, or children end up orphaned: once archived
parents are filtered out of every listing (§3), a child whose `parent_id` points at a
now-invisible parent would read as a floating root-level node to `buildTree` — breaking the
"only Canon/Manuscript/Unsorted at the top level" invariant the explorer-roots work established.
So **archive walks the whole subtree** (fetch the project's full entity set including already-
archived rows, build a parent→children map, collect every descendant of the target, batch-update
`archived_at` on all of them at once) — matches the intuitive expectation anyway: deleting a
folder used to take its contents with it via `ON DELETE CASCADE`; archiving a folder should too.
**Restore does the same walk in reverse** — restoring a folder un-hides everything currently
archived inside it, not just the folder itself.

**Purge needs no custom cascade logic.** `entities.parent_id` already has `ON DELETE CASCADE` at
the schema level (since `001_initial_schema.sql`) — a real hard `.delete()` on the top-level
archived entity automatically removes its descendants through the existing foreign key, exactly
as hard-delete already worked before this feature existed.

---

## 3. Every "all entities" query needs the same filter — auditing them, not hooking a global one

There's no clean way to force a project-wide filter onto every Supabase query without RLS (which
this app's service-role admin client deliberately bypasses), so this is a matter of auditing
every touch point rather than one central fix. Listed here so the build doesn't miss one:

- `dbGetEntities` — the explorer tree, the chat entity picker, everywhere entity lists get
  built. Must filter.
- `dbGetEntity` — single-entity fetch, used by API routes and every tool's read/update/delete
  guard. Must filter — an archived entity should read as "not found" for normal operations,
  the same as if it didn't exist, everywhere except the Attic's own lookup.
- `context-builder.ts`'s direct entity query — must filter, or archived Manuscript/Canon content
  would keep counting toward AI context and Canon-lookup, defeating the point of archiving it.
- `syncEntityReferences` (rename-sync) — must filter; a rename shouldn't reach into the trash
  and rewrite content sitting there.
- `dbGetCanvases` — must filter, now that canvases can be archived too.

Deliberately **not** filtered: the new `dbGetArchivedEntities`, which does the opposite (only
archived rows) for the Attic view itself.

---

## 4. What's explicitly out of scope for v1

- **The AI referencing archived content unprompted** — `docs/onboarding-workflows.md` §5's own
  aspirational example (*"you cut a scene where she confronts her father — the chapter you're
  writing might want it"*) is a real, nice idea, but it needs a new AI tool and system-prompt
  guidance of its own. The core win here is "nothing is permanently lost and it's recoverable" —
  that's what's being built. Proactive AI awareness of the trash is a natural v2, not required
  for this to be valuable on its own.
- **Reference tracking into archived content** — if a chapter mentions a character who's since
  been archived, nothing detects or flags that. Out of scope, same as the rest of the app not
  doing deep reference tracking beyond the existing rename-sync feature.

---

## 5. UI

**Not a third top-level mode.** Canvas mode earned a mode toggle because it's a primary place to
work; the Attic is somewhere you visit occasionally to recover something. A dialog (matching
`ProjectSettingsDialog`'s weight), triggered by a new icon button in `TopBar`: a flat list of
archived items (name, type, which root it used to live under, when archived), each with
**Restore** and **Delete Forever**. Delete Forever gets its own explicit confirmation — that's
the one action here that's still genuinely irreversible, so it's the one that still deserves to
feel weighty, in contrast to everything else this feature makes safe.

**Existing delete confirmation gets reworded, not removed.** `project-explorer.tsx`'s
`confirm("Delete this entity and all its children?")` currently implies permanence that's no
longer true — worth still having *a* confirmation (avoid mildly-annoying accidental clicks even
if recoverable), but the wording should say what's actually going to happen: moved to the Attic,
restorable anytime. `tools.ts`'s `delete_entity` tool description gets the same honesty update.

---

## 6. Build order

1. Migration `007_attic.sql` — `entities.archived_at`, an index on `(project_id, archived_at)`.
2. `entities.ts`: `dbDeleteEntity` becomes archive-with-cascade; add `dbRestoreEntity` (cascade),
   `dbPurgeEntity` (relies on existing FK cascade), `dbGetArchivedEntities`. Add the
   `archived_at` filter to `dbGetEntities`, `dbGetEntity`, `syncEntityReferences`.
3. Add the same filter to `context-builder.ts`'s entity query and `canvas.ts`'s `dbGetCanvases`.
4. API routes: `GET` archived list, `POST` restore, `DELETE` purge (all scoped under
   `/api/entities/[id]/...` or a dedicated `/api/entities/archived` list route).
5. `AtticDialog` component + `TopBar` button; reword the explorer's delete confirmation and the
   `delete_entity` tool description.
