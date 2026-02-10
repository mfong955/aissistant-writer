"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const HEARTBEAT_INTERVAL = 60_000; // 60 seconds
const INACTIVITY_TIMEOUT = 300_000; // 5 minutes

interface UseSessionTrackerOptions {
  projectId: string;
}

export function useSessionTracker({ projectId }: UseSessionTrackerOptions) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const entitiesViewedRef = useRef<Set<string>>(new Set());
  const entitiesEditedRef = useRef<Set<string>>(new Set());
  const lastActivityRef = useRef(Date.now());
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start a new session
  const startSession = useCallback(async () => {
    if (!projectId) return;

    try {
      const res = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });

      if (res.ok) {
        const data = await res.json();
        setSessionId(data.sessionId);
        setIsActive(true);
        entitiesViewedRef.current.clear();
        entitiesEditedRef.current.clear();
      }
    } catch {
      // Non-critical
    }
  }, [projectId]);

  // End the current session
  const endSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await fetch("/api/sessions/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch {
      // Best effort
    }

    setSessionId(null);
    setIsActive(false);
  }, [sessionId]);

  // Send heartbeat
  const sendHeartbeat = useCallback(async () => {
    if (!sessionId || !isActive) return;

    try {
      await fetch("/api/sessions/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          entities_viewed: Array.from(entitiesViewedRef.current),
          entities_edited: Array.from(entitiesEditedRef.current),
        }),
      });
    } catch {
      // Non-critical
    }
  }, [sessionId, isActive]);

  // Track entity view
  const trackView = useCallback((entityId: string) => {
    entitiesViewedRef.current.add(entityId);
    lastActivityRef.current = Date.now();
  }, []);

  // Track entity edit
  const trackEdit = useCallback((entityId: string) => {
    entitiesEditedRef.current.add(entityId);
    lastActivityRef.current = Date.now();
  }, []);

  // Reset inactivity timer on user activity
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (!isActive && sessionId) {
      // Resuming from inactive — start a new session
      startSession();
    }

    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    inactivityTimeoutRef.current = setTimeout(() => {
      setIsActive(false);
      endSession();
    }, INACTIVITY_TIMEOUT);
  }, [isActive, sessionId, startSession, endSession]);

  // Start session on mount
  useEffect(() => {
    startSession();

    return () => {
      // Best-effort session end on unmount
      if (sessionId) {
        navigator.sendBeacon(
          "/api/sessions/end",
          JSON.stringify({ session_id: sessionId })
        );
      }
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Heartbeat interval
  useEffect(() => {
    if (!sessionId || !isActive) return;

    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [sessionId, isActive, sendHeartbeat]);

  // Activity detection
  useEffect(() => {
    const events = ["mousemove", "keydown", "scroll", "click"];
    const handler = () => resetInactivityTimer();

    for (const event of events) {
      window.addEventListener(event, handler, { passive: true });
    }

    // Initial inactivity timer
    resetInactivityTimer();

    // beforeunload handler
    const handleUnload = () => {
      if (sessionId) {
        navigator.sendBeacon(
          "/api/sessions/end",
          JSON.stringify({ session_id: sessionId })
        );
      }
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      for (const event of events) {
        window.removeEventListener(event, handler);
      }
      window.removeEventListener("beforeunload", handleUnload);
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [sessionId, resetInactivityTimer]);

  return {
    sessionId,
    isActive,
    trackView,
    trackEdit,
  };
}
