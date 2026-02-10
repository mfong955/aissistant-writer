"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Move,
  Bot,
  User,
} from "lucide-react";
import { getChangeLogs } from "@/lib/api/change-logs";
import { useProject } from "@/contexts/project-context";
import type { ChangeLog } from "@/types/database";

const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  rename: ArrowRight,
  move: Move,
};

export function ChangeLogPanel() {
  const { project } = useProject();
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    getChangeLogs(project.id, { limit: 50 })
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [project]);

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading logs...</div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No changes logged yet.
      </div>
    );
  }

  // Group logs by date
  const grouped = new Map<string, ChangeLog[]>();
  for (const log of logs) {
    const date = new Date(log.created_at).toLocaleDateString();
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(log);
  }

  return (
    <div className="h-full overflow-auto">
      {Array.from(grouped.entries()).map(([date, dateLogs]) => (
        <div key={date}>
          <div className="sticky top-0 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {date}
          </div>
          {dateLogs.map((log) => {
            const ActionIcon = actionIcons[log.action] || Pencil;
            const ActorIcon = log.actor === "ai" ? Bot : User;
            return (
              <div
                key={log.id}
                className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-accent/50"
              >
                <ActionIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{log.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <ActorIcon className="h-3 w-3" />
                    <span>
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
