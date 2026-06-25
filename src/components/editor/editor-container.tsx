"use client";

import { useCallback, useMemo, useEffect, useState, useRef } from "react";
import { PenLine, Eye, Pencil, ImagePlus, Target, CaseSensitive } from "lucide-react";
import { useProject } from "@/contexts/project-context";
import type { Entity } from "@/types/database";
import { useEditorTabs } from "@/hooks/use-editor-tabs";
import { useAutosave } from "@/hooks/use-autosave";
import { tiptapToMarkdown, textToTiptapJson } from "@/lib/tiptap-utils";
import { updateEntity } from "@/lib/api/entities";
import { EditorTabs } from "./editor-tabs";
import { MarkdownEditor } from "./markdown-editor";
import { EditorPreview } from "./editor-preview";
import { ImageViewer } from "./image-viewer";
import { ExportMenu } from "./export-menu";
import { FindReplaceBar } from "./find-replace-bar";

interface EditorContainerProps {
  selectedEntityId?: string;
  onActiveTabChange?: (entityId: string | null) => void;
}

export function EditorContainer({ selectedEntityId, onActiveTabChange }: EditorContainerProps) {
  const { entities, project, refreshEntities } = useProject();
  const [isDragOver, setIsDragOver] = useState(false);
  const [targetInput, setTargetInput] = useState<string>("");
  const [targetOpen, setTargetOpen] = useState(false);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const {
    tabs,
    activeTab,
    activeTabId,
    openTab,
    closeTab,
    switchTab,
    markModified,
    updateTabName,
  } = useEditorTabs();

  const [isPreview, setIsPreview] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [liveMarkdown, setLiveMarkdown] = useState<string | null>(null);
  // Separate state for find/replace edits so they push into the textarea
  const [replacedMarkdown, setReplacedMarkdown] = useState<string | undefined>(undefined);
  const [findQuery, setFindQuery] = useState("");
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  // Open tab when entity is selected from explorer
  useEffect(() => {
    if (!selectedEntityId) return;
    const entity = entities.find((e) => e.id === selectedEntityId);
    if (entity && entity.type !== "folder") {
      openTab(entity);
    }
  }, [selectedEntityId, entities, openTab]);

  // Keep tab names in sync with entity names (handles renames)
  useEffect(() => {
    for (const tab of tabs) {
      const entity = entities.find((e) => e.id === tab.entityId);
      if (entity && entity.name !== tab.name) {
        updateTabName(entity.id, entity.name);
      }
    }
  }, [entities, tabs, updateTabName]);

  // Notify parent when active tab changes
  useEffect(() => {
    onActiveTabChange?.(activeTab?.entityId || null);
  }, [activeTab?.entityId, onActiveTabChange]);

  // Reset to edit mode and close find/replace when active tab changes
  useEffect(() => {
    setIsPreview(false);
    setShowFindReplace(false);
    setLiveMarkdown(null);
    setReplacedMarkdown(undefined);
    setFindQuery("");
    setCurrentMatchIdx(0);
  }, [activeTab?.entityId]);

  // Ctrl/Cmd+H → toggle find/replace
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "h") {
        e.preventDefault();
        setShowFindReplace((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const isImageEntity = activeEntity?.type === "image";

  const wordCount = useMemo(() => {
    if (!activeEntity?.content || isImageEntity) return 0;
    const md = tiptapToMarkdown(activeEntity.content);
    const words = md.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [activeEntity?.content, isImageEntity]);

  const readingTime = Math.ceil(wordCount / 200);

  const wordCountTarget: number | null =
    typeof activeEntity?.properties?.wordCountTarget === "number"
      ? (activeEntity.properties.wordCountTarget as number)
      : null;

  const targetProgress = wordCountTarget ? Math.min(wordCount / wordCountTarget, 1) : null;

  function openTargetPopover() {
    setTargetInput(wordCountTarget ? String(wordCountTarget) : "");
    setTargetOpen(true);
    setTimeout(() => targetInputRef.current?.focus(), 20);
  }

  async function saveTarget() {
    if (!activeEntity) return;
    const val = parseInt(targetInput, 10);
    const target = !isNaN(val) && val > 0 ? val : null;
    await updateEntity(activeEntity.id, {
      project_id: activeEntity.project_id,
      properties: { ...activeEntity.properties, wordCountTarget: target ?? undefined },
    });
    await refreshEntities();
    setTargetOpen(false);
  }

  async function clearTarget() {
    if (!activeEntity) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { wordCountTarget: _removed, ...rest } = (activeEntity.properties ?? {}) as Record<string, unknown>;
    await updateEntity(activeEntity.id, { project_id: activeEntity.project_id, properties: rest });
    await refreshEntities();
    setTargetOpen(false);
  }

  function targetColor(): string {
    if (targetProgress === null) return "";
    if (targetProgress >= 1) return "text-green-500";
    if (targetProgress >= 0.8) return "text-yellow-500";
    return "";
  }

  function isImageFile(f: File) {
    return f.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(f.name);
  }

  function hasImageFiles(dt: DataTransfer) {
    return dt.types.includes("Files");
  }

  function handleEditorDragEnter(e: React.DragEvent) {
    if (!hasImageFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragOver(true);
  }

  function handleEditorDragOver(e: React.DragEvent) {
    if (!hasImageFiles(e.dataTransfer)) return;
    e.preventDefault();
  }

  function handleEditorDragLeave() {
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragOver(false);
  }

  async function handleEditorDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (!project) return;
    const imageFiles = Array.from(e.dataTransfer.files).filter(isImageFile);
    for (const file of imageFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("project_id", project.id);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/images", { method: "POST", body: formData });
      const data = await res.json() as { entity?: Entity };
      if (data.entity) openTab(data.entity);
    }
    if (imageFiles.length > 0) await refreshEntities();
  }

  return (
    <div
      className="relative flex h-full flex-col"
      onDragEnter={handleEditorDragEnter}
      onDragOver={handleEditorDragOver}
      onDragLeave={handleEditorDragLeave}
      onDrop={handleEditorDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed border-primary bg-primary/5 pointer-events-none">
          <ImagePlus className="h-10 w-10 text-primary opacity-70" />
          <p className="text-sm font-medium text-primary">Drop image to upload</p>
        </div>
      )}
      <div className="flex items-center">
        <div className="flex-1 overflow-hidden">
          <EditorTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSwitch={switchTab}
            onClose={closeTab}
          />
        </div>
        {activeEntity && !isImageEntity && (
          <>
            <ExportMenu name={activeEntity.name} content={activeEntity.content} />
            <button
              onClick={() => setShowFindReplace((v) => !v)}
              title={`Find & Replace (${typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+H)`}
              className={`flex shrink-0 items-center gap-1 border-b border-l px-3 py-1.5 text-xs transition-colors hover:bg-accent hover:text-foreground ${showFindReplace ? "bg-accent text-foreground" : "text-muted-foreground"}`}
            >
              <CaseSensitive className="h-3 w-3" /><span className="hidden sm:inline">Find</span>
            </button>
            <button
              onClick={() => setIsPreview((v) => !v)}
              title={isPreview ? "Edit" : "Preview"}
              className="flex shrink-0 items-center gap-1 border-b border-l px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {isPreview ? (
                <><Pencil className="h-3 w-3" /><span>Edit</span></>
              ) : (
                <><Eye className="h-3 w-3" /><span>Preview</span></>
              )}
            </button>
          </>
        )}
      </div>
      {activeEntity ? (
        isImageEntity ? (
          <ImageViewer name={activeEntity.name} content={activeEntity.content} />
        ) : (
          <>
            <div className="flex flex-1 flex-col overflow-hidden">
              {showFindReplace && !isPreview && (
                <FindReplaceBar
                  value={liveMarkdown ?? (activeEntity.content ? tiptapToMarkdown(activeEntity.content) : "")}
                  onChange={(md) => {
                    handleUpdate(textToTiptapJson(md));
                    setLiveMarkdown(md);
                    setReplacedMarkdown(md); // push into textarea immediately
                  }}
                  onClose={() => { setShowFindReplace(false); setFindQuery(""); }}
                  onQueryChange={setFindQuery}
                  onMatchIdxChange={(idx) => setCurrentMatchIdx(idx)}
                />
              )}
              <div className="flex-1 overflow-hidden">
                {isPreview ? (
                  <EditorPreview content={activeEntity.content} />
                ) : (
                  <MarkdownEditor
                    key={activeEntity.id}
                    content={activeEntity.content}
                    onUpdate={handleUpdate}
                    onInitialize={handleInitialize}
                    onMarkdownChange={setLiveMarkdown}
                    findQuery={findQuery}
                    currentMatchIdx={currentMatchIdx}
                    externalMarkdown={replacedMarkdown}
                    projectId={project?.id}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t px-3 py-1 text-xs text-muted-foreground">
              {/* Word count + target */}
              <div className="relative flex items-center gap-2">
                <span className={targetColor()}>
                  {wordCountTarget ? (
                    <>
                      {wordCount.toLocaleString()} / {wordCountTarget.toLocaleString()} words
                    </>
                  ) : (
                    <>
                      {wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}
                      {wordCount > 0 && (
                        <span className="ml-2 opacity-60">{readingTime} min read</span>
                      )}
                    </>
                  )}
                </span>

                {/* Progress bar when target is set */}
                {targetProgress !== null && (
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${targetProgress >= 1 ? "bg-green-500" : targetProgress >= 0.8 ? "bg-yellow-500" : "bg-primary/50"}`}
                      style={{ width: `${targetProgress * 100}%` }}
                    />
                  </div>
                )}

                <button
                  onClick={openTargetPopover}
                  title={wordCountTarget ? "Edit word count target" : "Set word count target"}
                  className="opacity-40 hover:opacity-100 transition-opacity"
                >
                  <Target className="h-3 w-3" />
                </button>

                {/* Target popover */}
                {targetOpen && (
                  <div className="absolute bottom-full left-0 mb-2 flex items-center gap-1.5 rounded-md border bg-popover px-2 py-1.5 shadow-md">
                    <span className="shrink-0 text-[11px]">Target:</span>
                    <input
                      ref={targetInputRef}
                      type="number"
                      min={1}
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTarget();
                        if (e.key === "Escape") setTargetOpen(false);
                      }}
                      placeholder="e.g. 2000"
                      className="w-24 rounded border bg-transparent px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="shrink-0 text-[11px] text-muted-foreground">words</span>
                    <button
                      onClick={saveTarget}
                      className="rounded bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground hover:bg-primary/90"
                    >
                      Set
                    </button>
                    {wordCountTarget && (
                      <button
                        onClick={clearTarget}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Save status */}
              <span>
                {isPreview ? (
                  "Preview mode — click Edit to make changes"
                ) : isSaving ? (
                  "Saving..."
                ) : lastSaved ? (
                  `Saved ${lastSaved.toLocaleTimeString()}`
                ) : null}
              </span>
            </div>
          </>
        )
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
          <PenLine className="h-12 w-12 opacity-30" />
          <p className="mt-4">Select an entity from the explorer to start writing</p>
        </div>
      )}
    </div>
  );
}
