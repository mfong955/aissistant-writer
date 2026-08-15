-- The Attic — soft delete for entities. See docs/attic.md.
-- Run this in the Supabase SQL Editor. NOT auto-applied — same as 004/005/006, apply manually.

alter table entities add column if not exists archived_at timestamptz;

create index if not exists entities_archived_at_idx on entities(project_id, archived_at);
