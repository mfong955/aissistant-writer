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

  const { project_id } = await request.json();

  if (!project_id) {
    return NextResponse.json(
      { error: "project_id is required" },
      { status: 400 }
    );
  }

  // Close any existing open sessions for this project
  await supabase
    .from("sessions")
    .update({
      ended_at: new Date().toISOString(),
    })
    .eq("project_id", project_id)
    .eq("user_id", user.id)
    .is("ended_at", null);

  // Create new session
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      project_id,
      user_id: user.id,
      started_at: new Date().toISOString(),
      entities_viewed: [],
      entities_edited: [],
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id });
}
