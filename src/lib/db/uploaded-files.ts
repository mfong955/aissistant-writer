import { getAdminClient } from "@/lib/supabase/admin";
import type { UploadedFile } from "@/types/database";

export async function dbCreateUploadedFile(params: {
  projectId: string;
  userId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  entityId?: string | null;
}): Promise<UploadedFile> {
  const { data, error } = await getAdminClient()
    .from("uploaded_files")
    .insert({
      id: crypto.randomUUID(),
      project_id: params.projectId,
      user_id: params.userId,
      name: params.name,
      mime_type: params.mimeType,
      size_bytes: params.sizeBytes,
      storage_path: params.storagePath,
      entity_id: params.entityId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as UploadedFile;
}

export async function dbGetUploadedFiles(projectId: string, userId: string): Promise<UploadedFile[]> {
  const { data, error } = await getAdminClient()
    .from("uploaded_files")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as UploadedFile[];
}

export async function dbGetUploadedFile(id: string, userId: string): Promise<UploadedFile | null> {
  const { data, error } = await getAdminClient()
    .from("uploaded_files")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data as UploadedFile;
}

export async function dbDeleteUploadedFile(id: string, userId: string): Promise<void> {
  await getAdminClient()
    .from("uploaded_files")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
}
