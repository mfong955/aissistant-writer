import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbUpdateSessionActivity } from "@/lib/db/sessions";

export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { session_id, entities_viewed, entities_edited } = await request.json();

  if (!session_id) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  await dbUpdateSessionActivity(
    session_id,
    userId,
    entities_viewed || [],
    entities_edited || []
  );

  return NextResponse.json({ ok: true });
}
