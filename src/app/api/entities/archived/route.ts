import { NextResponse } from "next/server";
import { dbGetArchivedEntities } from "@/lib/db/entities";
import { getUserId } from "@/lib/get-user-id";

export async function GET(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  const entities = await dbGetArchivedEntities(projectId);
  return NextResponse.json({ entities });
}
