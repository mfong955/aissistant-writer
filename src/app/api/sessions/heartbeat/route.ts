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

  const { session_id, entities_viewed, entities_edited } = await request.json();

  if (!session_id) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 }
    );
  }

  // Update session with latest activity data
  const { error } = await supabase
    .from("sessions")
    .update({
      entities_viewed: entities_viewed || [],
      entities_edited: entities_edited || [],
    })
    .eq("id", session_id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
