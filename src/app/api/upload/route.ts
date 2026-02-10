import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("project_id") as string | null;
  const entityId = formData.get("entity_id") as string | null;

  if (!file || !projectId) {
    return NextResponse.json(
      { error: "file and project_id are required" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File size exceeds 10MB limit" },
      { status: 400 }
    );
  }

  // Generate a unique storage path
  const ext = file.name.split(".").pop() || "bin";
  const storagePath = `${user.id}/${projectId}/${crypto.randomUUID()}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // Record in database
  const { data: record, error: dbError } = await supabase
    .from("uploaded_files")
    .insert({
      project_id: projectId,
      user_id: user.id,
      name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: storagePath,
      entity_id: entityId || null,
    })
    .select("id, name, mime_type, size_bytes, created_at")
    .single();

  if (dbError) {
    // Clean up the uploaded file if DB insert fails
    await supabase.storage.from("uploads").remove([storagePath]);
    return NextResponse.json(
      { error: `Database error: ${dbError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ file: record });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json(
      { error: "project_id is required" },
      { status: 400 }
    );
  }

  const { data: files, error } = await supabase
    .from("uploaded_files")
    .select("id, name, mime_type, size_bytes, entity_id, created_at")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ files: files || [] });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { file_id } = await request.json();

  if (!file_id) {
    return NextResponse.json(
      { error: "file_id is required" },
      { status: 400 }
    );
  }

  // Get storage path before deleting record
  const { data: fileRecord } = await supabase
    .from("uploaded_files")
    .select("storage_path")
    .eq("id", file_id)
    .eq("user_id", user.id)
    .single();

  if (!fileRecord) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Delete from storage
  await supabase.storage.from("uploads").remove([fileRecord.storage_path]);

  // Delete from database
  await supabase
    .from("uploaded_files")
    .delete()
    .eq("id", file_id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
