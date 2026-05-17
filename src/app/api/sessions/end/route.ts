import { NextResponse } from "next/server";
import { getLocalUserId } from "@/lib/local-user";
import { dbEndSession } from "@/lib/db/sessions";

export async function POST(request: Request) {
  const userId = getLocalUserId();
  const { session_id } = await request.json();

  if (!session_id) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  const result = dbEndSession(session_id, userId);
  if (!result) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, durationSeconds: result.durationSeconds });
}
