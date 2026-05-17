import { NextResponse } from "next/server";
import { dbGetEntity, dbUpdateEntity, dbDeleteEntity } from "@/lib/db/entities";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  const entity = dbGetEntity(id, projectId);
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entity });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { project_id, ...updates } = await request.json();
  if (!project_id) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  const entity = dbUpdateEntity(id, project_id, updates);
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entity });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  dbDeleteEntity(id, projectId);
  return NextResponse.json({ ok: true });
}
