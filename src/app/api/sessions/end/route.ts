import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbEndSession } from "@/lib/db/sessions";

export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { session_id } = await request.json();

  if (!session_id) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  const result = await dbEndSession(session_id, userId);
  if (!result) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, durationSeconds: result.durationSeconds });
}
