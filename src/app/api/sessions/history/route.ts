import { NextResponse } from "next/server";
import { getLocalUserId } from "@/lib/local-user";
import { dbGetSessionHistory } from "@/lib/db/sessions";

export async function GET(request: Request) {
  const userId = getLocalUserId();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const sessions = dbGetSessionHistory(projectId, userId);
  return NextResponse.json({ sessions });
}
