export type EntityType =
  | "folder"
  | "character"
  | "chapter"
  | "outline"
  | "note"
  | "world_building"
  | "custom";

export type ChangeAction = "create" | "update" | "delete" | "rename" | "move";
export type ChangeActor = "user" | "ai";

export type ProjectType =
  | "novel"
  | "short_story"
  | "non_fiction"
  | "textbook"
  | "screenplay"
  | "poetry"
  | "game_narrative"
  | "other";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  project_type: ProjectType | null;
  system_instructions: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: string;
  project_id: string;
  user_id: string;
  parent_id: string | null;
  type: EntityType;
  name: string;
  content: Record<string, unknown> | null;
  properties: Record<string, unknown>;
  sort_order: number;
  version_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntitySummary {
  id: string;
  entity_id: string;
  project_id: string;
  user_id: string;
  summary: string;
  version_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectState {
  id: string;
  project_id: string;
  user_id: string;
  state_content: string;
  entity_hashes: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  timestamp?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Conversation {
  id: string;
  project_id: string;
  user_id: string;
  title: string | null;
  messages: ChatMessage[];
  model_id: string | null;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

export interface ChangeLog {
  id: string;
  project_id: string;
  user_id: string;
  entity_id: string | null;
  action: ChangeAction;
  actor: ChangeActor;
  description: string;
  old_version_hash: string | null;
  new_version_hash: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Session {
  id: string;
  project_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  entities_viewed: string[];
  entities_edited: string[];
  summary: string | null;
  created_at: string;
}

export interface UploadedFile {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  entity_id: string | null;
  created_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  openrouter_api_key_encrypted: string | null;
  preferred_model_id: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
