"use client";

import { useState, useEffect } from "react";
import { Clock, FileEdit, Eye } from "lucide-react";
import { useProject } from "@/contexts/project-context";

interface Session {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  entities_viewed: string[];
  entities_edited: string[];
  summary: string | null;
}

interface SessionHistoryProps {
  projectId: string;
}

export function SessionHistory({ projectId }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const { entities } = useProject();

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch(
          `/api/sessions/history?project_id=${encodeURIComponent(projectId)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions || []);
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, [projectId]);

  const entityNameMap = new Map(entities.map((e) => [e.id, e.name]));

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading session history...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No sessions recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-medium">Session History</h3>
      {sessions.map((session) => (
        <div
          key={session.id}
          className="rounded-md border p-3 text-xs"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDate(session.started_at)}</span>
            {session.duration_seconds && (
              <span>({formatDuration(session.duration_seconds)})</span>
            )}
            {!session.ended_at && (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Active
              </span>
            )}
          </div>

          {session.entities_viewed.length > 0 && (
            <div className="mt-1.5 flex items-start gap-1.5">
              <Eye className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">
                Viewed:{" "}
                {session.entities_viewed
                  .map((id) => entityNameMap.get(id) || "Unknown")
                  .join(", ")}
              </span>
            </div>
          )}

          {session.entities_edited.length > 0 && (
            <div className="mt-1 flex items-start gap-1.5">
              <FileEdit className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">
                Edited:{" "}
                {session.entities_edited
                  .map((id) => entityNameMap.get(id) || "Unknown")
                  .join(", ")}
              </span>
            </div>
          )}

          {session.summary && (
            <p className="mt-1.5 text-muted-foreground">{session.summary}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
