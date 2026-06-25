import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbCreateChangeLog, dbGetChangeLogs } from "@/lib/db/change-logs";
import type { ChangeAction, ChangeActor } from "@/types/database";

export async function GET(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const entityId = searchParams.get("entity_id") ?? undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;
  const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined;

  const logs = await dbGetChangeLogs(projectId, { entityId, limit, offset });
  return NextResponse.json({ logs });
}

export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const body = await request.json();
  const { project_id, entity_id, action, actor, description, old_version_hash, new_version_hash, metadata } = body;

  if (!project_id || !action || !actor || !description) {
    return NextResponse.json({ error: "project_id, action, actor, description are required" }, { status: 400 });
  }

  const log = await dbCreateChangeLog({
    projectId: project_id,
    userId,
    entityId: entity_id ?? null,
    action: action as ChangeAction,
    actor: actor as ChangeActor,
    description,
    oldVersionHash: old_version_hash ?? null,
    newVersionHash: new_version_hash ?? null,
    metadata,
  });

  return NextResponse.json({ log }, { status: 201 });
}
