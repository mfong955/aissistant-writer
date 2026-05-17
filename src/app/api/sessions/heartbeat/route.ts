import { NextResponse } from "next/server";
import { getLocalUserId } from "@/lib/local-user";
import { dbUpdateSessionActivity } from "@/lib/db/sessions";

export async function POST(request: Request) {
  const userId = getLocalUserId();
  const { session_id, entities_viewed, entities_edited } = await request.json();

  if (!session_id) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  dbUpdateSessionActivity(
    session_id,
    userId,
    entities_viewed || [],
    entities_edited || []
  );

  return NextResponse.json({ ok: true });
}
