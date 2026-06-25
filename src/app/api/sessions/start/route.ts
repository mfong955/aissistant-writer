import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbStartSession } from "@/lib/db/sessions";

export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { project_id } = await request.json();

  if (!project_id) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const session = await dbStartSession(project_id, userId);
  return NextResponse.json({ sessionId: session.id });
}
