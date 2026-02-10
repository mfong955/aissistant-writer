"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useProject } from "@/contexts/project-context";

interface StaleSummary {
  entityId: string;
  entityName: string;
  reason: "missing" | "outdated";
}

interface ContextStatus {
  staleSummaries: StaleSummary[];
  isRegenerating: boolean;
  lastRegenerated: Date | null;
  regenerateSummaries: (entityId?: string) => Promise<void>;
}

export function useContextStatus(projectId: string): ContextStatus {
  const { entities } = useProject();
  const [staleSummaries, setStaleSummaries] = useState<StaleSummary[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [lastRegenerated, setLastRegenerated] = useState<Date | null>(null);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for stale summaries by comparing entity version_hash to summary version_hash
  const checkStaleSummaries = useCallback(async () => {
    if (!projectId) return;

    try {
      const res = await fetch(
        `/api/context/status?project_id=${encodeURIComponent(projectId)}`
      );
      if (!res.ok) return;

      const data = await res.json();
      setStaleSummaries(data.staleSummaries || []);
    } catch {
      // Silently ignore — non-critical
    }
  }, [projectId]);

  // Check for stale summaries when entities change (debounced)
  useEffect(() => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }
    checkTimeoutRef.current = setTimeout(checkStaleSummaries, 5000);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [entities, checkStaleSummaries]);

  const regenerateSummaries = useCallback(
    async (entityId?: string) => {
      if (!projectId || isRegenerating) return;

      setIsRegenerating(true);
      try {
        const res = await fetch("/api/context/generate-summaries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            entity_id: entityId,
          }),
        });

        if (res.ok) {
          setLastRegenerated(new Date());
          // Re-check stale summaries after regeneration
          await checkStaleSummaries();
        }
      } catch {
        // Silently ignore
      } finally {
        setIsRegenerating(false);
      }
    },
    [projectId, isRegenerating, checkStaleSummaries]
  );

  return {
    staleSummaries,
    isRegenerating,
    lastRegenerated,
    regenerateSummaries,
  };
}
