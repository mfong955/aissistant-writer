import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { dbGetEntity, dbUpdateEntity, dbDeleteEntity, appendToSessionLog } from "@/lib/db/entities";
import { dbCreateChangeLog } from "@/lib/db/change-logs";
import { getUserId } from "@/lib/get-user-id";
import { isExplorerRootEntity } from "@/lib/entity-roots";

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
  const entity = await dbGetEntity(id, projectId);
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entity });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { id } = await params;
  const { project_id, ...updates } = await request.json();
  if (!project_id) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const before = await dbGetEntity(id, project_id);
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isRoot = isExplorerRootEntity(before);
  if (isRoot && "name" in updates && updates.name !== before.name) {
    return NextResponse.json({ error: "Canon, Manuscript, and Unsorted cannot be renamed." }, { status: 400 });
  }
  if (isRoot && "parent_id" in updates && updates.parent_id !== before.parent_id) {
    return NextResponse.json({ error: "Canon, Manuscript, and Unsorted cannot be moved." }, { status: 400 });
  }
  if (!isRoot && "parent_id" in updates && updates.parent_id === null) {
    return NextResponse.json(
      { error: "Entities can't be moved outside Canon, Manuscript, or Unsorted — move to Unsorted instead." },
      { status: 400 }
    );
  }

  const entity = await dbUpdateEntity(id, project_id, updates);
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (before && updates.name && updates.name !== before.name) {
    const description = `Renamed ${before.type}: "${before.name}" → "${updates.name}"`;
    await Promise.all([
      dbCreateChangeLog({ projectId: project_id, userId, entityId: id, action: "rename", actor: "user", description }),
      appendToSessionLog(project_id, userId, description),
    ]);
  }

  const renamedFrom =
    before && updates.name && updates.name !== before.name ? before.name : undefined;
  return NextResponse.json({ entity, renamedFrom });
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

  const entity = await dbGetEntity(id, projectId);
  if (entity && isExplorerRootEntity(entity)) {
    return NextResponse.json({ error: "Canon, Manuscript, and Unsorted are fixed containers and cannot be deleted." }, { status: 400 });
  }
  if (entity?.type === "image" && entity.content?.type === "image_file") {
    const url = entity.content.url as string;
    const filename = url.split("/").pop();
    if (filename) {
      const filePath = path.join(process.cwd(), ".data", "uploads", projectId, filename);
      await fs.unlink(filePath).catch(() => {});
    }
  }

  await dbDeleteEntity(id, projectId);
  return NextResponse.json({ ok: true });
}
