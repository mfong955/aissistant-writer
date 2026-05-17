import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, "database.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      settings TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      parent_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('folder','character','chapter','outline','note','world_building','custom')),
      name TEXT NOT NULL,
      content TEXT,
      properties TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER NOT NULL DEFAULT 0,
      version_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entity_summaries (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL UNIQUE REFERENCES entities(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      version_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_states (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      state_content TEXT NOT NULL,
      entity_hashes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      title TEXT,
      messages TEXT NOT NULL DEFAULT '[]',
      model_id TEXT,
      total_prompt_tokens INTEGER NOT NULL DEFAULT 0,
      total_completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS change_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
      action TEXT NOT NULL CHECK (action IN ('create','update','delete','rename','move')),
      actor TEXT NOT NULL CHECK (actor IN ('user','ai')),
      description TEXT NOT NULL,
      old_version_hash TEXT,
      new_version_hash TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER,
      entities_viewed TEXT NOT NULL DEFAULT '[]',
      entities_edited TEXT NOT NULL DEFAULT '[]',
      summary TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      openrouter_api_key_encrypted TEXT,
      preferred_model_id TEXT,
      settings TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_entities_project_parent_sort ON entities(project_id, parent_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_entities_project_id ON entities(project_id);
    CREATE INDEX IF NOT EXISTS idx_entity_summaries_entity_id ON entity_summaries(entity_id);
    CREATE INDEX IF NOT EXISTS idx_change_logs_project_created ON change_logs(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_change_logs_entity_id ON change_logs(entity_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_project_created ON conversations(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_project_user ON sessions(project_id, user_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_uploaded_files_project ON uploaded_files(project_id);
  `);

  // Safe migrations for columns added after initial schema
  const migrate = (sql: string) => { try { db.exec(sql); } catch { /* column already exists */ } };
  migrate("ALTER TABLE projects ADD COLUMN project_type TEXT");
  migrate("ALTER TABLE projects ADD COLUMN system_instructions TEXT");
}
