import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import {
  dbCreateUploadedFile,
  dbGetUploadedFiles,
  dbGetUploadedFile,
  dbDeleteUploadedFile,
} from "@/lib/db/uploaded-files";
import path from "path";
import fs from "fs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("project_id") as string | null;
  const entityId = formData.get("entity_id") as string | null;

  if (!file || !projectId) {
    return NextResponse.json({ error: "file and project_id are required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
  }

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const ext = file.name.split(".").pop() || "bin";
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const storagePath = path.join(userId, projectId, fileName);
  const fullPath = path.join(UPLOADS_DIR, storagePath);

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(fullPath, buffer);

  const record = await dbCreateUploadedFile({
    projectId,
    userId,
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    storagePath,
    entityId: entityId || null,
  });

  return NextResponse.json({ file: record });
}

export async function GET(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const files = await dbGetUploadedFiles(projectId, userId);
  return NextResponse.json({ files });
}

export async function DELETE(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { file_id } = await request.json();

  if (!file_id) {
    return NextResponse.json({ error: "file_id is required" }, { status: 400 });
  }

  const fileRecord = await dbGetUploadedFile(file_id, userId);
  if (!fileRecord) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const fullPath = path.join(UPLOADS_DIR, fileRecord.storage_path);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  await dbDeleteUploadedFile(file_id, userId);
  return NextResponse.json({ ok: true });
}
