-- Canvas mode — data model scaffolding. See docs/canvas-mode.md.
-- Run this in the Supabase SQL Editor. NOT auto-applied — same as 004, apply manually.

-- Widen the entities.type check constraint to include every type actually in use. This also
-- fixes a pre-existing gap: 'image' was added to the app long after 001_initial_schema.sql's
-- constraint was written and was never migrated in, so it has only worked if the live database
-- was never actually running that original constraint. Found and fixed as a side effect of
-- adding 'canvas'. Written to find and drop whatever the constraint is actually named, rather
-- than guessing — inline column checks get a Postgres-generated name that isn't guaranteed to
-- match the "obvious" one.
do $$
declare
  con record;
begin
  for con in
    select pgc.conname
    from pg_constraint pgc
    join pg_class rel on rel.oid = pgc.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(pgc.conkey)
    where rel.relname = 'entities' and pgc.contype = 'c' and att.attname = 'type'
  loop
    execute format('alter table entities drop constraint %I', con.conname);
  end loop;
end $$;

alter table entities add constraint entities_type_check
  check (type in ('folder', 'character', 'chapter', 'outline', 'note', 'world_building', 'custom', 'image', 'canvas'));

-- Canvas version snapshots — restorable checkpoints, written before AI bulk edits and on
-- explicit user checkpoints. Append-only; the Attic philosophy (docs/onboarding-workflows.md
-- §5) applied to structured canvas data instead of prose.
create table if not exists canvas_versions (
  id uuid primary key default gen_random_uuid(),
  canvas_id uuid references entities(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  snapshot jsonb not null,
  label text,
  created_at timestamptz not null default now()
);

create index if not exists canvas_versions_canvas_id_idx on canvas_versions(canvas_id);

alter table canvas_versions enable row level security;
create policy "no_client_access" on canvas_versions using (false) with check (false);
