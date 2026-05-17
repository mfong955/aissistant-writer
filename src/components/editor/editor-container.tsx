"use client";

import { useCallback, useMemo, useEffect } from "react";
import { PenLine } from "lucide-react";
import { useProject } from "@/contexts/project-context";
import { useEditorTabs } from "@/hooks/use-editor-tabs";
import { useAutosave } from "@/hooks/use-autosave";
import { EditorTabs } from "./editor-tabs";
import { TiptapEditor } from "./tiptap-editor";

interface EditorContainerProps {
  selectedEntityId?: string;
  onActiveTabChange?: (entityId: string | null) => void;
}

export function EditorContainer({ selectedEntityId, onActiveTabChange }: EditorContainerProps) {
  const { entities } = useProject();
  const {
    tabs,
    activeTab,
    activeTabId,
    openTab,
    closeTab,
    switchTab,
    markModified,
  } = useEditorTabs();

  // Open tab when entity is selected from explorer
  useEffect(() => {
    if (!selectedEntityId) return;
    const entity = entities.find((e) => e.id === selectedEntityId);
    if (entity && entity.type !== "folder") {
      openTab(entity);
    }
  }, [selectedEntityId, entities, openTab]);

  // Notify parent when active tab changes
  useEffect(() => {
    onActiveTabChange?.(activeTab?.entityId || null);
  }, [activeTab?.entityId, onActiveTabChange]);

  const activeEntity = useMemo(() => {
    if (!activeTab) return null;
    return entities.find((e) => e.id === activeTab.entityId) || null;
  }, [activeTab, entities]);

  const { debouncedSave, isSaving, lastSaved, initializeHash } = useAutosave(
    activeEntity?.id || null,
    activeEntity?.project_id || null
  );

  const handleUpdate = useCallback(
    (content: Record<string, unknown>) => {
      if (activeTabId) {
        markModified(activeTabId, true);
        debouncedSave(content);
      }
    },
    [activeTabId, markModified, debouncedSave]
  );

  const handleInitialize = useCallback(
    (content: Record<string, unknown>) => {
      initializeHash(content);
    },
    [initializeHash]
  );

  return (
    <div className="flex h-full flex-col">
      <EditorTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitch={switchTab}
        onClose={closeTab}
      />
      {activeEntity ? (
        <>
          <div className="flex-1 overflow-hidden">
            <TiptapEditor
              key={activeEntity.id}
              content={activeEntity.content}
              onUpdate={handleUpdate}
              onInitialize={handleInitialize}
            />
          </div>
          <div className="flex items-center justify-end border-t px-3 py-1 text-xs text-muted-foreground">
            {isSaving ? (
              <span>Saving...</span>
            ) : lastSaved ? (
              <span>Saved {lastSaved.toLocaleTimeString()}</span>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
          <PenLine className="h-12 w-12 opacity-30" />
          <p className="mt-4">Select an entity from the explorer to start writing</p>
        </div>
      )}
    </div>
  );
}
