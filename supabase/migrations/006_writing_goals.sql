-- Writing goals & progress tracking. See docs/writing-goals.md.
-- Run this in the Supabase SQL Editor. NOT auto-applied — same as 004/005, apply manually.

alter table entities add column if not exists word_count integer not null default 0;

-- One row per project per day. `date` is a UTC YYYY-MM-DD string, matching the day-key
-- convention appendToSessionLog already uses for the Logs/ folder — no new convention.
-- words_delta can be negative on a heavy-cut day; deletions never retroactively adjust past
-- rows (docs/writing-goals.md §1 — the Attic philosophy applied to progress tracking).
create table if not exists daily_writing_stats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  words_delta integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, date)
);

create index if not exists daily_writing_stats_project_id_idx on daily_writing_stats(project_id);

alter table daily_writing_stats enable row level security;
create policy "no_client_access" on daily_writing_stats using (false) with check (false);
