import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbGetSessionHistory } from "@/lib/db/sessions";

export async function GET(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const sessions = await dbGetSessionHistory(projectId, userId);
  return NextResponse.json({ sessions });
}
