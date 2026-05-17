import { getDb } from "./database";
import type { UploadedFile } from "@/types/database";

function now() {
  return new Date().toISOString();
}

function rowToFile(row: Record<string, unknown>): UploadedFile {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    mime_type: row.mime_type as string,
    size_bytes: row.size_bytes as number,
    storage_path: row.storage_path as string,
    entity_id: (row.entity_id as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export function dbCreateUploadedFile(params: {
  projectId: string;
  userId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  entityId?: string | null;
}): UploadedFile {
  const db = getDb();
  const id = crypto.randomUUID();
  const ts = now();

  db.prepare(
    `INSERT INTO uploaded_files
     (id, project_id, user_id, name, mime_type, size_bytes, storage_path, entity_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.projectId,
    params.userId,
    params.name,
    params.mimeType,
    params.sizeBytes,
    params.storagePath,
    params.entityId ?? null,
    ts
  );

  return rowToFile(
    db.prepare("SELECT * FROM uploaded_files WHERE id = ?").get(id) as Record<string, unknown>
  );
}

export function dbGetUploadedFiles(projectId: string, userId: string): UploadedFile[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM uploaded_files WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC"
    )
    .all(projectId, userId) as Record<string, unknown>[];
  return rows.map(rowToFile);
}

export function dbGetUploadedFile(id: string, userId: string): UploadedFile | null {
  const row = getDb()
    .prepare("SELECT * FROM uploaded_files WHERE id = ? AND user_id = ?")
    .get(id, userId) as Record<string, unknown> | undefined;
  return row ? rowToFile(row) : null;
}

export function dbDeleteUploadedFile(id: string, userId: string): void {
  getDb()
    .prepare("DELETE FROM uploaded_files WHERE id = ? AND user_id = ?")
    .run(id, userId);
}
