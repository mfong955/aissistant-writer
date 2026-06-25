"use client";

import { useState, useCallback, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { TopBar } from "@/components/layout/top-bar";
import { ProjectExplorer } from "@/components/explorer/project-explorer";
import { EditorContainer } from "@/components/editor/editor-container";
import { ChatPanelContent } from "@/components/chat/chat-panel";
import { SearchDialog } from "@/components/search/search-dialog";
import { useProject } from "@/contexts/project-context";
import { useSessionTracker } from "@/hooks/use-session-tracker";
import "allotment/dist/style.css";

export function ProjectShell() {
  const [selectedEntityId, setSelectedEntityId] = useState<string>();
  const [activeEditorEntityId, setActiveEditorEntityId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const { project, refreshEntities } = useProject();

  const { trackView, trackEdit } = useSessionTracker({
    projectId: project?.id || "",
  });

  const handleSelectEntity = useCallback(
    (entityId: string) => {
      setSelectedEntityId(entityId);
      trackView(entityId);
    },
    [trackView]
  );

  const handleEntityChange = useCallback(() => {
    refreshEntities();
  }, [refreshEntities]);

  const handleActiveTabChange = useCallback(
    (entityId: string | null) => {
      setActiveEditorEntityId(entityId);
      if (entityId) trackView(entityId);
    },
    [trackView]
  );

  // Track edits when autosave fires for the active entity
  useEffect(() => {
    if (activeEditorEntityId) {
      trackEdit(activeEditorEntityId);
    }
  }, [activeEditorEntityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd+K / Ctrl+K and custom event to open search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
    }
    function onEvent() { setSearchOpen(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("aissistant:open-search", onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("aissistant:open-search", onEvent);
    };
  }, []);

  // Active entity IDs for context building — the entity currently open in the editor
  const activeEntityIds = activeEditorEntityId ? [activeEditorEntityId] : [];

  return (
    <>
    <SearchDialog
      open={searchOpen}
      onClose={() => setSearchOpen(false)}
      onSelect={handleSelectEntity}
    />
    <AppShell
      topBar={<TopBar />}
      sidebar={
        <ProjectExplorer
          onSelectEntity={handleSelectEntity}
          selectedEntityId={selectedEntityId}
        />
      }
      editor={
        <EditorContainer
          selectedEntityId={selectedEntityId}
          onActiveTabChange={handleActiveTabChange}
        />
      }
      chat={
        <ChatPanelContent
          activeEntityIds={activeEntityIds}
          onEntityChange={handleEntityChange}
        />
      }
    />
    </>
  );
}
