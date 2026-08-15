import { NextResponse } from "next/server";
import { dbRestoreEntity, appendToSessionLog } from "@/lib/db/entities";
import { getUserId } from "@/lib/get-user-id";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { id } = await params;
  const { project_id } = await request.json();
  if (!project_id) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  await dbRestoreEntity(id, project_id);
  await appendToSessionLog(project_id, userId, `Restored from the Attic`);
  return NextResponse.json({ ok: true });
}
