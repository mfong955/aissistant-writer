"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { saveEntityContent } from "@/lib/api/entities";
import { computeContentHash } from "@/lib/content-hash";

export function useAutosave(entityId: string | null, projectId: string | null) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastSavedHash = useRef<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (content: Record<string, unknown>) => {
      if (!entityId || !projectId) return;
      const hash = await computeContentHash(content);
      if (hash === lastSavedHash.current) return;

      setIsSaving(true);
      try {
        await saveEntityContent(entityId, projectId, content, hash);
        lastSavedHash.current = hash;
        setLastSaved(new Date());
      } finally {
        setIsSaving(false);
      }
    },
    [entityId, projectId]
  );

  const debouncedSave = useCallback(
    (content: Record<string, unknown>) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        save(content);
      }, 2000);
    },
    [save]
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [entityId]);

  useEffect(() => {
    lastSavedHash.current = null;
    setLastSaved(null);
  }, [entityId]);

  const initializeHash = useCallback(async (content: Record<string, unknown>) => {
    const hash = await computeContentHash(content);
    lastSavedHash.current = hash;
  }, []);

  return { debouncedSave, isSaving, lastSaved, initializeHash };
}
