-- Aissistant Writer - Initial Database Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  settings jsonb default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Entities (characters, chapters, outlines, notes, world-building, folders, custom)
create table entities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  parent_id uuid references entities(id) on delete cascade,
  type text not null check (type in ('folder', 'character', 'chapter', 'outline', 'note', 'world_building', 'custom')),
  name text not null,
  content jsonb,
  properties jsonb default '{}',
  sort_order integer not null default 0,
  version_hash text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Entity summaries (L1 - AI-generated summaries per entity)
create table entity_summaries (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references entities(id) on delete cascade not null unique,
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  summary text not null,
  version_hash text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Project states (L2 - compressed project overview)
create table project_states (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null unique,
  user_id uuid references auth.users(id) on delete cascade not null,
  state_content text not null,
  entity_hashes jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Conversations (chat history)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  messages jsonb not null default '[]',
  model_id text,
  total_prompt_tokens integer default 0,
  total_completion_tokens integer default 0,
  total_cost numeric(12, 8) default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Change logs (every entity modification)
create table change_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_id uuid references entities(id) on delete set null,
  action text not null check (action in ('create', 'update', 'delete', 'rename', 'move')),
  actor text not null check (actor in ('user', 'ai')),
  description text not null,
  old_version_hash text,
  new_version_hash text,
  metadata jsonb,
  created_at timestamptz default now() not null
);

-- Sessions (activity tracking)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  entities_viewed uuid[] default '{}',
  entities_edited uuid[] default '{}',
  summary text,
  created_at timestamptz default now() not null
);

-- Uploaded files (reference materials)
create table uploaded_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text not null,
  entity_id uuid references entities(id) on delete set null,
  created_at timestamptz default now() not null
);

-- User settings (API keys, preferences)
create table user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  openrouter_api_key_encrypted text,
  preferred_model_id text,
  settings jsonb default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index idx_projects_user_id on projects(user_id);
create index idx_entities_project_parent_sort on entities(project_id, parent_id, sort_order);
create index idx_entities_project_id on entities(project_id);
create index idx_entity_summaries_entity_id on entity_summaries(entity_id);
create index idx_change_logs_project_created on change_logs(project_id, created_at desc);
create index idx_change_logs_entity_id on change_logs(entity_id);
create index idx_conversations_project_created on conversations(project_id, created_at desc);
create index idx_sessions_project_user on sessions(project_id, user_id, started_at desc);
create index idx_uploaded_files_project on uploaded_files(project_id);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_projects_updated_at before update on projects
  for each row execute function update_updated_at_column();

create trigger update_entities_updated_at before update on entities
  for each row execute function update_updated_at_column();

create trigger update_entity_summaries_updated_at before update on entity_summaries
  for each row execute function update_updated_at_column();

create trigger update_project_states_updated_at before update on project_states
  for each row execute function update_updated_at_column();

create trigger update_conversations_updated_at before update on conversations
  for each row execute function update_updated_at_column();

create trigger update_user_settings_updated_at before update on user_settings
  for each row execute function update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table projects enable row level security;
alter table entities enable row level security;
alter table entity_summaries enable row level security;
alter table project_states enable row level security;
alter table conversations enable row level security;
alter table change_logs enable row level security;
alter table sessions enable row level security;
alter table uploaded_files enable row level security;
alter table user_settings enable row level security;

-- Projects: users can only access their own
create policy "Users can view own projects" on projects for select using (auth.uid() = user_id);
create policy "Users can create own projects" on projects for insert with check (auth.uid() = user_id);
create policy "Users can update own projects" on projects for update using (auth.uid() = user_id);
create policy "Users can delete own projects" on projects for delete using (auth.uid() = user_id);

-- Entities: users can only access their own
create policy "Users can view own entities" on entities for select using (auth.uid() = user_id);
create policy "Users can create own entities" on entities for insert with check (auth.uid() = user_id);
create policy "Users can update own entities" on entities for update using (auth.uid() = user_id);
create policy "Users can delete own entities" on entities for delete using (auth.uid() = user_id);

-- Entity summaries: users can only access their own
create policy "Users can view own summaries" on entity_summaries for select using (auth.uid() = user_id);
create policy "Users can create own summaries" on entity_summaries for insert with check (auth.uid() = user_id);
create policy "Users can update own summaries" on entity_summaries for update using (auth.uid() = user_id);
create policy "Users can delete own summaries" on entity_summaries for delete using (auth.uid() = user_id);

-- Project states: users can only access their own
create policy "Users can view own project states" on project_states for select using (auth.uid() = user_id);
create policy "Users can create own project states" on project_states for insert with check (auth.uid() = user_id);
create policy "Users can update own project states" on project_states for update using (auth.uid() = user_id);
create policy "Users can delete own project states" on project_states for delete using (auth.uid() = user_id);

-- Conversations: users can only access their own
create policy "Users can view own conversations" on conversations for select using (auth.uid() = user_id);
create policy "Users can create own conversations" on conversations for insert with check (auth.uid() = user_id);
create policy "Users can update own conversations" on conversations for update using (auth.uid() = user_id);
create policy "Users can delete own conversations" on conversations for delete using (auth.uid() = user_id);

-- Change logs: users can only access their own
create policy "Users can view own change logs" on change_logs for select using (auth.uid() = user_id);
create policy "Users can create own change logs" on change_logs for insert with check (auth.uid() = user_id);

-- Sessions: users can only access their own
create policy "Users can view own sessions" on sessions for select using (auth.uid() = user_id);
create policy "Users can create own sessions" on sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on sessions for update using (auth.uid() = user_id);

-- Uploaded files: users can only access their own
create policy "Users can view own files" on uploaded_files for select using (auth.uid() = user_id);
create policy "Users can create own files" on uploaded_files for insert with check (auth.uid() = user_id);
create policy "Users can delete own files" on uploaded_files for delete using (auth.uid() = user_id);

-- User settings: users can only access their own
create policy "Users can view own settings" on user_settings for select using (auth.uid() = user_id);
create policy "Users can create own settings" on user_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings" on user_settings for update using (auth.uid() = user_id);
