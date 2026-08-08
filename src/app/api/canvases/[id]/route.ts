import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbGetCanvas, dbUpdateCanvasContent } from "@/lib/db/canvas";
import { dbUpdateEntity, dbDeleteEntity } from "@/lib/db/entities";

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
  return NextResponse.json({ canvas });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const { id } = await params;
  const body = await request.json();
  const { project_id } = body;
  if (!project_id) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  // Content updates are conflict-aware (docs/canvas-mode.md §2) — the caller must supply the
  // version_hash it started editing from. A mismatch means someone else saved in between.
  if (body.content !== undefined) {
    const result = await dbUpdateCanvasContent(
      id,
      project_id,
      body.content,
      body.expected_version_hash ?? null
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: "conflict", current_version_hash: result.currentVersionHash },
        { status: 409 }
      );
    }
    return NextResponse.json({ canvas: result.canvas });
  }

  if (body.name !== undefined) {
    const canvas = await dbUpdateEntity(id, project_id, { name: body.name });
    if (!canvas) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ canvas });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

export async function DELETE(
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
  await dbDeleteEntity(id, projectId);
  return NextResponse.json({ ok: true });
}
