import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbGetProject, dbUpdateProject, dbDeleteProject } from "@/lib/db/projects";
import { ensureExplorerRoots } from "@/lib/db/entities";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const project = await dbGetProject(id, userIdOrError);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const updates = await request.json();
  const project = await dbUpdateProject(id, userId, updates);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (updates.project_type) {
    await ensureExplorerRoots(id, userId, project.project_type);
  }
  return NextResponse.json({ project });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  await dbDeleteProject(id, userIdOrError);
  return NextResponse.json({ ok: true });
}
