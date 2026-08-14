import { getAdminClient } from "@/lib/supabase/admin";

export interface WritingStats {
  wordsToday: number;
  streak: number;
  totalWords: number;
}

/**
 * Reads accumulated daily_writing_stats rows for a project and derives today's count, the
 * current streak, and the all-time total. See docs/writing-goals.md §§1, 3.
 */
export async function dbGetWritingStats(projectId: string): Promise<WritingStats> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("daily_writing_stats")
    .select("date, words_delta")
    .eq("project_id", projectId) as unknown as { data: { date: string; words_delta: number }[] | null };

  const rows = data ?? [];
  const deltasByDate = new Map(rows.map((r) => [r.date, r.words_delta]));

  const totalWords = rows.reduce((sum, r) => sum + r.words_delta, 0);

  const todayKey = new Date().toISOString().split("T")[0]!;
  const wordsToday = deltasByDate.get(todayKey) ?? 0;

  // Consecutive days with words_delta > 0, walking backward from today. Today gets the
  // benefit of the doubt: if it has no activity yet, the streak is computed as of yesterday
  // rather than showing as already broken (docs/writing-goals.md §3).
  let streak = 0;
  const cursor = new Date(`${todayKey}T00:00:00Z`);
  let isToday = true;
  while (true) {
    const key = cursor.toISOString().split("T")[0]!;
    const delta = deltasByDate.get(key) ?? 0;
    if (delta > 0) {
      streak++;
    } else if (!(isToday && key === todayKey)) {
      break;
    }
    isToday = false;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return { wordsToday, streak, totalWords };
}
