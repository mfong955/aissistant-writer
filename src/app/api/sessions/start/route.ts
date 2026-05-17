import { NextResponse } from "next/server";
import { getLocalUserId } from "@/lib/local-user";
import { dbStartSession } from "@/lib/db/sessions";

export async function POST(request: Request) {
  const userId = getLocalUserId();
  const { project_id } = await request.json();

  if (!project_id) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const session = dbStartSession(project_id, userId);
  return NextResponse.json({ sessionId: session.id });
}
