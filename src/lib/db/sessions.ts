import { getAdminClient } from "@/lib/supabase/admin";
import type { Session } from "@/types/database";

export async function dbStartSession(projectId: string, userId: string): Promise<Session> {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  await supabase
    .from("sessions")
    .update({ ended_at: now })
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .is("ended_at", null);

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      user_id: userId,
      started_at: now,
      entities_viewed: [],
      entities_edited: [],
    })
    .select()
    .single();
  if (error) throw error;
  return data as Session;
}

export async function dbEndSession(
  id: string,
  userId: string
): Promise<{ durationSeconds: number } | null> {
  const supabase = getAdminClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("started_at")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!session) return null;

  const endedAt = new Date().toISOString();
  const durationSeconds = Math.round(
    (new Date(endedAt).getTime() - new Date(session.started_at as string).getTime()) / 1000
  );

  await supabase
    .from("sessions")
    .update({ ended_at: endedAt, duration_seconds: durationSeconds })
    .eq("id", id)
    .eq("user_id", userId);

  return { durationSeconds };
}

export async function dbUpdateSessionActivity(
  id: string,
  userId: string,
  entitiesViewed: string[],
  entitiesEdited: string[]
): Promise<void> {
  await getAdminClient()
    .from("sessions")
    .update({ entities_viewed: entitiesViewed, entities_edited: entitiesEdited })
    .eq("id", id)
    .eq("user_id", userId);
}

export async function dbGetSessionHistory(
  projectId: string,
  userId: string,
  limit = 20
): Promise<Session[]> {
  const { data, error } = await getAdminClient()
    .from("sessions")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Session[];
}
