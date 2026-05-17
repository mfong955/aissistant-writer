import { NextResponse } from "next/server";
import { dbGetEntity, dbUpdateEntity, dbDeleteEntity, appendToSessionLog } from "@/lib/db/entities";
import { getDb } from "@/lib/db/database";
import { getLocalUserId } from "@/lib/local-user";

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

  const before = dbGetEntity(id, project_id);
  const entity = dbUpdateEntity(id, project_id, updates);
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Log user-initiated renames so the AI is always aware of old → new name mappings
  if (before && updates.name && updates.name !== before.name) {
    const userId = getLocalUserId();
    const ts = new Date().toISOString();
    const description = `Renamed ${before.type}: "${before.name}" → "${updates.name}"`;
    getDb()
      .prepare(
        `INSERT INTO change_logs (id, project_id, user_id, entity_id, action, actor, description, created_at)
         VALUES (?, ?, ?, ?, 'rename', 'user', ?, ?)`
      )
      .run(crypto.randomUUID(), project_id, userId, id, description, ts);
    appendToSessionLog(project_id, userId, description);
  }

  const renamedFrom =
    before && updates.name && updates.name !== before.name ? before.name : undefined;
  return NextResponse.json({ entity, renamedFrom });
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
