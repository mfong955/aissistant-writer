import { NextResponse } from "next/server";
import { getLocalUserId } from "@/lib/local-user";
import { dbGetProject, dbUpdateProject, dbDeleteProject } from "@/lib/db/projects";
import { initProjectFolders } from "@/lib/db/entities";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getLocalUserId();
  const project = dbGetProject(id, userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getLocalUserId();
  const updates = await request.json();
  const project = dbUpdateProject(id, userId, updates);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (updates.project_type) {
    initProjectFolders(id, userId, project.project_type);
  }
  return NextResponse.json({ project });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getLocalUserId();
  dbDeleteProject(id, userId);
  return NextResponse.json({ ok: true });
}
