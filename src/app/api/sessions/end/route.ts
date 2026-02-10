import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { session_id } = await request.json();

  if (!session_id) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 }
    );
  }

  // Get session start time for duration calculation
  const { data: session } = await supabase
    .from("sessions")
    .select("started_at")
    .eq("id", session_id)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  const endedAt = new Date();
  const startedAt = new Date(session.started_at);
  const durationSeconds = Math.round(
    (endedAt.getTime() - startedAt.getTime()) / 1000
  );

  const { error } = await supabase
    .from("sessions")
    .update({
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq("id", session_id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, durationSeconds });
}
