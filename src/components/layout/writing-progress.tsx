"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flame } from "lucide-react";
import { useProject } from "@/contexts/project-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "@/types/database";

interface Stats {
  wordsToday: number;
  streak: number;
  totalWords: number;
}

interface Goals {
  daily?: number;
  total?: { words: number; deadline?: string };
}

const REFRESH_MS = 30_000;

function computePace(goals: Goals, totalWords: number): string | null {
  if (!goals.total?.deadline) return null;
  const deadline = new Date(`${goals.total.deadline}T00:00:00Z`);
  const today = new Date(`${new Date().toISOString().split("T")[0]}T00:00:00Z`);
  const daysRemaining = Math.max(1, Math.round((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const remainingWords = goals.total.words - totalWords;
  if (remainingWords <= 0) return "Target reached.";
  const neededPerDay = Math.ceil(remainingWords / daysRemaining);
  return `${neededPerDay.toLocaleString()} words/day needed to hit your target by ${goals.total.deadline}.`;
}

/**
 * Compact, always-visible word-count/streak stat with a goal-setting popover.
 * See docs/writing-goals.md §4 — the point is being glimpsed constantly, not living behind a menu.
 */
export function WritingProgress() {
  const { project, setProject } = useProject();
  const [stats, setStats] = useState<Stats | null>(null);
  const [open, setOpen] = useState(false);
  const [dailyInput, setDailyInput] = useState("");
  const [totalWordsInput, setTotalWordsInput] = useState("");
  const [deadlineInput, setDeadlineInput] = useState("");
  const [saving, setSaving] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const goals: Goals = (project?.settings as { goals?: Goals } | undefined)?.goals ?? {};

  const fetchStats = useCallback(async () => {
    if (!project) return;
    const res = await fetch(`/api/projects/${project.id}/writing-stats`);
    if (res.ok) setStats(await res.json());
  }, [project]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchStats]);

  useEffect(() => {
    if (open) {
      fetchStats();
      setDailyInput(goals.daily ? String(goals.daily) : "");
      setTotalWordsInput(goals.total?.words ? String(goals.total.words) : "");
      setDeadlineInput(goals.total?.deadline ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function saveGoals() {
    if (!project) return;
    setSaving(true);
    const nextGoals: Goals = {
      daily: dailyInput.trim() ? Number(dailyInput) : undefined,
      total: totalWordsInput.trim()
        ? { words: Number(totalWordsInput), deadline: deadlineInput.trim() || undefined }
        : undefined,
    };
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { ...(project.settings ?? {}), goals: nextGoals } }),
    });
    setSaving(false);
    if (res.ok) {
      const data = (await res.json()) as { project: Project };
      setProject(data.project);
    }
  }

  async function hideProgress() {
    if (!project) return;
    setOpen(false);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { ...(project.settings ?? {}), writingProgressHidden: true } }),
    });
    if (res.ok) {
      const data = (await res.json()) as { project: Project };
      setProject(data.project);
    }
  }

  const isHidden = Boolean((project?.settings as { writingProgressHidden?: boolean } | undefined)?.writingProgressHidden);
  if (!project || isHidden) return null;

  const dailyProgress = goals.daily && stats ? Math.min(100, Math.round((stats.wordsToday / goals.daily) * 100)) : null;
  const totalProgress =
    goals.total?.words && stats ? Math.min(100, Math.round((stats.totalWords / goals.total.words) * 100)) : null;
  const pace = stats ? computePace(goals, stats.totalWords) : null;

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
        title="Writing progress"
      >
        <span>{(stats?.wordsToday ?? 0).toLocaleString()} today</span>
        {stats && stats.streak > 0 && (
          <span className="flex items-center gap-0.5">
            <Flame className="h-3 w-3 text-orange-500" />
            {stats.streak}
          </span>
        )}
      </Button>

      {open &&
        buttonRef.current &&
        createPortal(
          (() => {
            const rect = buttonRef.current!.getBoundingClientRect();
            return (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div
                  className="fixed z-50 w-72 rounded-lg border bg-popover p-3 text-sm shadow-md"
                  style={{ top: rect.bottom + 6, right: window.innerWidth - rect.right }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{(stats?.wordsToday ?? 0).toLocaleString()} words today</span>
                    {stats && stats.streak > 0 && (
                      <span className="flex items-center gap-1 text-xs text-orange-500">
                        <Flame className="h-3.5 w-3.5" />
                        {stats.streak}-day streak
                      </span>
                    )}
                  </div>

                  {dailyProgress !== null && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${dailyProgress}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {stats?.wordsToday.toLocaleString()} / {goals.daily?.toLocaleString()} words today
                      </p>
                    </div>
                  )}

                  {totalProgress !== null && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${totalProgress}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {stats?.totalWords.toLocaleString()} / {goals.total?.words.toLocaleString()} words
                        {pace ? ` — ${pace}` : ""}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 space-y-2 border-t pt-2">
                    <div className="space-y-1">
                      <Label htmlFor="daily-goal" className="text-[11px]">Daily target (words)</Label>
                      <Input
                        id="daily-goal"
                        type="number"
                        min={0}
                        className="h-7 text-xs"
                        value={dailyInput}
                        onChange={(e) => setDailyInput(e.target.value)}
                        placeholder="e.g. 500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="total-goal" className="text-[11px]">Project target (words)</Label>
                        <Input
                          id="total-goal"
                          type="number"
                          min={0}
                          className="h-7 text-xs"
                          value={totalWordsInput}
                          onChange={(e) => setTotalWordsInput(e.target.value)}
                          placeholder="e.g. 80000"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="deadline" className="text-[11px]">Deadline (optional)</Label>
                        <Input
                          id="deadline"
                          type="date"
                          className="h-7 text-xs"
                          value={deadlineInput}
                          onChange={(e) => setDeadlineInput(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button size="sm" className="h-7 w-full text-xs" disabled={saving} onClick={saveGoals}>
                      {saving ? "Saving…" : "Save goals"}
                    </Button>
                    <button
                      type="button"
                      className="w-full text-center text-[11px] text-muted-foreground underline"
                      onClick={hideProgress}
                    >
                      Hide this — not everyone wants to see it. Turn it back on in Project Settings.
                    </button>
                  </div>
                </div>
              </>
            );
          })(),
          document.body
        )}
    </>
  );
}
