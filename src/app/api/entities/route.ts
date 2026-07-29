import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbGetEntities, dbCreateEntity } from "@/lib/db/entities";
import type { EntityType } from "@/types/database";

export async function GET(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  const entities = await dbGetEntities(projectId);
  return NextResponse.json({ entities });
}

export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { project_id, name, type, parent_id, content } = await request.json();

  if (!project_id || !name || !type) {
    return NextResponse.json(
      { error: "project_id, name, and type are required" },
      { status: 400 }
    );
  }
  if (!parent_id) {
    return NextResponse.json(
      { error: "parent_id is required — entities must be created inside Canon, Manuscript, or Unsorted." },
      { status: 400 }
    );
  }

  const entity = await dbCreateEntity({
    projectId: project_id,
    userId,
    name,
    type: type as EntityType,
    parentId: parent_id ?? null,
    content: content ?? null,
  });

  return NextResponse.json({ entity }, { status: 201 });
}
