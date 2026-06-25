import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { dbGetEntity, dbUpdateEntity, dbDeleteEntity, appendToSessionLog } from "@/lib/db/entities";
import { dbCreateChangeLog } from "@/lib/db/change-logs";
import { getUserId } from "@/lib/get-user-id";

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

  const [before, entity] = await Promise.all([
    dbGetEntity(id, project_id),
    dbUpdateEntity(id, project_id, updates),
  ]);
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
