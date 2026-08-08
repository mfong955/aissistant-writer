import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbGetCanvas, dbListCanvasVersions, dbSaveCanvasVersion } from "@/lib/db/canvas";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  const canvas = await dbGetCanvas(id, projectId);
  if (!canvas) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = await dbListCanvasVersions(id);
  return NextResponse.json({ versions });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { id } = await params;
  const body = await request.json();
  const { project_id, content, label } = body;
  if (!project_id || !content) {
    return NextResponse.json({ error: "project_id and content are required" }, { status: 400 });
  }

  const canvas = await dbGetCanvas(id, project_id);
  if (!canvas) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const version = await dbSaveCanvasVersion(id, project_id, userId, content, label);
  return NextResponse.json({ version }, { status: 201 });
}
