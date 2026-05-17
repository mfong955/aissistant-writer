import { NextResponse } from "next/server";
import { getLocalUserId } from "@/lib/local-user";
import { dbGetEntities, dbCreateEntity } from "@/lib/db/entities";
import type { EntityType } from "@/types/database";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  const entities = dbGetEntities(projectId);
  return NextResponse.json({ entities });
}

export async function POST(request: Request) {
  const userId = getLocalUserId();
  const { project_id, name, type, parent_id, content } = await request.json();

  if (!project_id || !name || !type) {
    return NextResponse.json(
      { error: "project_id, name, and type are required" },
      { status: 400 }
    );
  }

  const entity = dbCreateEntity({
    projectId: project_id,
    userId,
    name,
    type: type as EntityType,
    parentId: parent_id ?? null,
    content: content ?? null,
  });

  return NextResponse.json({ entity }, { status: 201 });
}
