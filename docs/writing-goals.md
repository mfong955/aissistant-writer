# Writing goals & progress tracking

Implementation spec. Read `AGENTS.md` first.

**The problem this solves.** AGENTS.md's own Goal section names this directly, in the
session-tracking bullet: *"auto-detect inactivity, log what was worked on, update
**goals**/progress automatically."* Session tracking exists (heartbeat, inactivity detection,
history) and Project Progress exists (a qualitative AI-written snapshot), but there's no actual
goal-setting mechanism and no quantitative progress anywhere. "Goals" is named and undelivered.

Everything shipped so far this cycle (canvas, apply flow, consistency checking) is about
organizing and trusting AI-written content. This is the first feature aimed purely at
*momentum* — which is arguably the real disease "never starts" and "abandons projects" are both
symptoms of. It serves both core personas directly: the word-zero writer needs to feel like
something is happening; the returning writer needs a reason to keep coming back.

---

## 1. What gets tracked, and how

**Word count lives on the entity.** `entities` gains a `word_count` column, kept in lockstep with
`content` at the one place content actually changes: `dbCreateEntity` (word count = the initial
content's count) and `dbUpdateEntity` (when `updates.content` is present, fetch the entity's
current `word_count` first, compute the new count, write both together, and record the
**delta** — new minus old, which can be negative on a heavy cut day, and that's shown honestly
rather than clamped to zero).

This is one hook point covering every source of a content change uniformly — human autosave,
`update_entity`/`create_entity` tool calls, and applied plan items all go through
`dbCreateEntity`/`dbUpdateEntity` already, so none of those call sites need their own
word-count logic.

**Deltas accumulate into a small daily table**, not a live recomputation: `daily_writing_stats`
(`project_id`, `date`, `words_delta`, one row per project per day, upserted by adding to the
existing delta). `date` uses the same UTC `YYYY-MM-DD` string convention `appendToSessionLog`
already uses for the Logs/ folder — no new day-key convention introduced.

**Scope: every entity, not Manuscript-only, for v1.** A stricter version would only count
Manuscript-rooted entities (this is meant to feel like *writing* progress, not "renamed a
folder"). Resolving an entity's root costs an extra lookup on every single save, and Canon/
Unsorted edits are typically far smaller and rarer than actual drafting — so the impurity this
introduces is expected to be small in practice. Flagged as a v2 revisit if it turns out to
matter (§6), not designed around here.

**Deletion doesn't retroactively erase history.** If an entity is deleted, its past contribution
to `daily_writing_stats` stays as-is — the record reflects that those words *were* written on
that day, not a live "current total" that shrinks when something is cut. This is the Attic
philosophy (`docs/onboarding-workflows.md` §5 — nothing is ever destroyed) applied to progress:
a cut scene was still real effort, and erasing that from the historical record the moment
something is deleted would be actively demoralizing for exactly the writers this feature is
supposed to help. A project's "total words" is the cumulative sum of daily deltas since the
project began, not a live count of what currently exists.

---

## 2. Goals

Stored in `projects.settings.goals` (same JSONB blob workflow/entry-point state already lives
in) — no new table:

```
goals: {
  daily?: number                              // words/day target
  total?: { words: number; deadline?: string } // project target, optional date
}
```

Both are optional and independent; a writer can set either, both, or neither. Read/written
through the existing `PATCH /api/projects/[id]` route — no new endpoint, same client-side
merge-then-send pattern the workflow picker already uses (`{ ...project.settings, goals }`).

**Pace, for a total goal with a deadline:** simple linear arithmetic, no smoothing — needed
daily rate = (target − current total) / days remaining, compared against the actual average
daily rate over the trailing 7 days of `daily_writing_stats`. "3 days ahead of pace" / "behind
pace by roughly 40 words/day." Cheap once the daily data exists; not worth more precision than
that for a project this size.

---

## 3. Streaks

Consecutive days with `words_delta > 0`, walking backward from today. Today gets the benefit of
the doubt: if today has no activity *yet*, the streak is computed as of yesterday rather than
showing as broken — the writer hasn't lost anything until the day actually ends without writing.
The UI can still make "write today to keep it going" implicit through framing, without the
number itself lying about what's already happened.

---

## 4. UI

A compact, **always-visible** stat in `TopBar` — motivational features that live behind a menu
don't work; the whole point is being glimpsed constantly, the way Scrivener's project targets or
NaNoWriMo's bar do. Something like `1,240 words today · 🔥 4`. Clicking it opens a small popover:
today's count, streak, goal progress bars (daily and/or total, whichever are set), and the
goal-editing inputs themselves — no separate settings page.

No historical chart/sparkline in v1 (§6) — the daily number and the streak carry the motivational
weight on their own; a chart is a real UI investment for a marginal addition to that.

---

## 5. Data flow summary

1. Entity content changes (any path) → `dbCreateEntity`/`dbUpdateEntity` computes the word-count
   delta → upserts today's `daily_writing_stats` row for the project.
2. `GET /api/projects/[id]/writing-stats` reads that table, returns `{ wordsToday, streak,
   totalWords }`.
3. `TopBar` fetches it, renders the compact stat, and reads/writes `goals` via the existing
   project settings route for the popover.

---

## 6. Open questions / deferred

- Manuscript-only scoping (vs. every entity) — revisit if the "impurity" from Canon/Unsorted
  edits turns out to visibly skew the numbers once there's real usage to look at.
- Historical chart/sparkline — real UI work, deferred; today's number + streak is enough to
  start.
- Should the AI mention stats in its own Project Progress summary ("4-day streak, on pace")?
  A nice touch, not essential, and adds to an already-detailed system prompt — left out of v1.
- Backfill: existing entities get `word_count = 0` until next edited (the migration default,
  not a computed backfill). A one-time, low-stakes cosmetic gap — the count corrects itself the
  next time each entity is touched — not worth a backfill script for a feature with no real
  users yet.

---

## 7. Build order

1. Migration `006_writing_goals.sql` — `entities.word_count`, `daily_writing_stats` table.
2. `countWords` utility (`tiptap-utils.ts`) — wraps the existing `extractTextFromTiptap`.
3. Wire word-count delta tracking into `dbCreateEntity`/`dbUpdateEntity`, plus a
   `dbGetWritingStats(projectId)` helper (today's words, streak, total).
4. `GET /api/projects/[id]/writing-stats` route.
5. `TopBar` compact stat + goal-setting popover, wired to the stats route and the existing
   project-settings PATCH route.
