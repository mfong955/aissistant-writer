-- Aissistant Writer — application schema
-- Run this in the Supabase SQL Editor

-- Projects
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  project_type text,
  system_instructions text,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Entities (self-referential for folders)
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  parent_id uuid references entities(id) on delete cascade,
  type text not null,
  name text not null,
  content jsonb,
  properties jsonb not null default '{}',
  sort_order integer not null default 0,
  version_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Entity summaries (one per entity)
create table if not exists entity_summaries (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null unique,
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  summary text not null,
  version_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Project states (one per project)
create table if not exists project_states (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null unique,
  user_id uuid references auth.users(id) on delete cascade not null,
  state_content text,
  entity_hashes jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Change logs
create table if not exists change_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_id uuid,
  action text not null,
  actor text not null,
  description text not null,
  old_version_hash text,
  new_version_hash text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  entities_viewed jsonb not null default '[]',
  entities_edited jsonb not null default '[]',
  summary text,
  created_at timestamptz not null default now()
);

-- Uploaded files
create table if not exists uploaded_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_id uuid,
  name text not null,
  mime_type text not null,
  size_bytes integer not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- User settings (one per user)
create table if not exists user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  openrouter_api_key_encrypted text,
  preferred_model_id text,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists entities_project_id_idx on entities(project_id);
create index if not exists entities_parent_id_idx on entities(parent_id);
create index if not exists entity_summaries_project_id_idx on entity_summaries(project_id);
create index if not exists change_logs_project_id_idx on change_logs(project_id);
create index if not exists sessions_project_id_idx on sessions(project_id);
create index if not exists uploaded_files_project_id_idx on uploaded_files(project_id);

-- Row Level Security (service role bypasses these; they block direct client access)
alter table projects enable row level security;
alter table entities enable row level security;
alter table entity_summaries enable row level security;
alter table project_states enable row level security;
alter table change_logs enable row level security;
alter table sessions enable row level security;
alter table uploaded_files enable row level security;
alter table user_settings enable row level security;

create policy "no_client_access" on projects using (false) with check (false);
create policy "no_client_access" on entities using (false) with check (false);
create policy "no_client_access" on entity_summaries using (false) with check (false);
create policy "no_client_access" on project_states using (false) with check (false);
create policy "no_client_access" on change_logs using (false) with check (false);
create policy "no_client_access" on sessions using (false) with check (false);
create policy "no_client_access" on uploaded_files using (false) with check (false);
create policy "no_client_access" on user_settings using (false) with check (false);
