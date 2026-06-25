"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tiptapToMarkdown, textToTiptapJson } from "@/lib/tiptap-utils";
import { AIToolbar, type AIAction } from "./ai-toolbar";

interface MarkdownEditorProps {
  content: Record<string, unknown> | null;
  onUpdate: (content: Record<string, unknown>) => void;
  onInitialize: (content: Record<string, unknown>) => void;
  onMarkdownChange?: (md: string) => void;
  findQuery?: string;
  currentMatchIdx?: number;
  externalMarkdown?: string;
  projectId?: string;
}

function getMatches(text: string, query: string): number[] {
  if (!query) return [];
  const out: number[] = [];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let i = 0;
  while ((i = lower.indexOf(q, i)) !== -1) { out.push(i); i += q.length; }
  return out;
}

function renderHighlighted(text: string, query: string, currentIdx: number) {
  if (!query) return null;
  const matches = getMatches(text, query);
  if (matches.length === 0) return <span>{text}</span>;

  const nodes: React.ReactNode[] = [];
  let last = 0;
  matches.forEach((pos, i) => {
    if (pos > last) nodes.push(<span key={`t${pos}`}>{text.slice(last, pos)}</span>);
    nodes.push(
      <mark
        key={`m${pos}`}
        className={i === currentIdx
          ? "rounded-[2px] bg-orange-400/60 dark:bg-orange-500/50"
          : "rounded-[2px] bg-yellow-300/50 dark:bg-yellow-500/30"}
        style={{ color: "transparent" }}
      >
        {text.slice(pos, pos + query.length)}
      </mark>
    );
    last = pos + query.length;
  });
  if (last < text.length) nodes.push(<span key={`t${last}`}>{text.slice(last)}</span>);
  return <>{nodes}</>;
}

interface ToolbarState {
  x: number;
  y: number;
  selectionStart: number;
  selectionEnd: number;
  selectedText: string;
}

export function MarkdownEditor({
  content, onUpdate, onInitialize, onMarkdownChange,
  findQuery = "", currentMatchIdx = 0, externalMarkdown,
  projectId,
}: MarkdownEditorProps) {
  const [markdown, setMarkdown] = useState(() => (content ? tiptapToMarkdown(content) : ""));
  const lastContentRef = useRef(content);
  const lastExternalRef = useRef<string | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const markdownRef = useRef(markdown);

  // AI toolbar state
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [aiStatus, setAIStatus] = useState<"idle" | "loading">("idle");
  const mousePos = useRef({ x: 0, y: 0 });

  // Keep markdown ref in sync for use inside async callbacks
  useEffect(() => { markdownRef.current = markdown; }, [markdown]);

  useEffect(() => { if (content) onInitialize(content); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync when content changes externally (AI writes, entity switches, etc.)
  useEffect(() => {
    if (JSON.stringify(content) !== JSON.stringify(lastContentRef.current)) {
      lastContentRef.current = content;
      setMarkdown(content ? tiptapToMarkdown(content) : "");
    }
  }, [content]);

  // Push find/replace edits into the textarea
  useEffect(() => {
    if (externalMarkdown !== undefined && externalMarkdown !== lastExternalRef.current) {
      lastExternalRef.current = externalMarkdown;
      setMarkdown(externalMarkdown);
    }
  }, [externalMarkdown]);

  // Scroll to current find match
  useEffect(() => {
    if (!findQuery || !textareaRef.current || !scrollContainerRef.current) return;
    const matches = getMatches(markdown, findQuery);
    if (matches.length === 0) return;
    const pos = matches[currentMatchIdx] ?? matches[0];
    const textBefore = markdown.slice(0, pos);
    const linesBefore = textBefore.split("\n").length - 1;
    const totalLines = markdown.split("\n").length;
    const container = scrollContainerRef.current;
    const scrollFraction = linesBefore / Math.max(totalLines, 1);
    container.scrollTop = scrollFraction * (container.scrollHeight - container.clientHeight);
  }, [currentMatchIdx, findQuery, markdown]);

  // Track mouse position globally for toolbar placement
  useEffect(() => {
    function onMove(e: MouseEvent) { mousePos.current = { x: e.clientX, y: e.clientY }; }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Hide toolbar when clicking outside it
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!toolbar || aiStatus === "loading") return;
      const target = e.target as HTMLElement;
      if (!target.closest("[data-ai-toolbar]")) {
        setToolbar(null);
      }
    }
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [toolbar, aiStatus]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setMarkdown(text);
      onUpdate(textToTiptapJson(text));
      onMarkdownChange?.(text);
    },
    [onUpdate, onMarkdownChange]
  );

  function checkSelection() {
    if (aiStatus === "loading") return;
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd } = ta;
    if (selectionStart === selectionEnd) { setToolbar(null); return; }
    const selectedText = ta.value.slice(selectionStart, selectionEnd).trim();
    if (!selectedText || selectedText.length < 5) { setToolbar(null); return; }
    setToolbar({
      x: mousePos.current.x,
      y: mousePos.current.y,
      selectionStart,
      selectionEnd,
      selectedText,
    });
  }

  async function handleAIAction(action: AIAction) {
    if (!toolbar || !projectId) return;
    const modelId =
      (typeof window !== "undefined" ? localStorage.getItem("aissistant:modelId") : null) ??
      "anthropic/claude-sonnet-4-6";

    const { selectionStart, selectionEnd, selectedText } = toolbar;
    const beforeText = markdownRef.current.slice(0, selectionStart);
    const afterText = markdownRef.current.slice(selectionEnd);
    // "continue" inserts after the selection rather than replacing it
    const isInsertAfter = action === "continue";

    setAIStatus("loading");
    let accumulated = "";

    try {
      const res = await fetch("/api/openrouter/inline-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, selectedText, beforeText, projectId, modelId }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        console.error("Inline action error:", data.error);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") break;

          try {
            const event = JSON.parse(data) as { content?: string; error?: string };
            if (event.error) { console.error("Stream error:", event.error); break; }
            if (event.content) {
              accumulated += event.content;
              const newMarkdown = isInsertAfter
                ? beforeText + selectedText + afterText.replace(/^\n*/, "\n\n") + accumulated
                : beforeText + accumulated + afterText;
              setMarkdown(newMarkdown);
              onUpdate(textToTiptapJson(newMarkdown));
              onMarkdownChange?.(newMarkdown);
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      console.error("AI action failed:", err);
    } finally {
      setAIStatus("idle");
      setToolbar(null);
    }
  }

  const hasFind = Boolean(findQuery);
  const matches = hasFind ? getMatches(markdown, findQuery) : [];
  const totalLines = Math.max(markdown.split("\n").length, 1);
  const markerPositions = matches.map((pos) => {
    const lineNo = markdown.slice(0, pos).split("\n").length - 1;
    return (lineNo / totalLines) * 100;
  });

  return (
    <div className="relative h-full">
      {/* Find match scroll markers */}
      {hasFind && markerPositions.length > 0 && (
        <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-1.5">
          {markerPositions.map((pct, i) => (
            <div
              key={i}
              className={`absolute left-0 right-0 h-1 rounded-full ${
                i === currentMatchIdx ? "bg-orange-400" : "bg-yellow-400/70"
              }`}
              style={{ top: `${pct}%` }}
            />
          ))}
        </div>
      )}

      <div ref={scrollContainerRef} className="h-full overflow-auto px-8 py-6">
        <div className="relative mx-auto w-full max-w-[720px]">
          {/* Find highlight overlay */}
          {hasFind && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 font-mono text-sm leading-relaxed"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "transparent" }}
            >
              {renderHighlighted(markdown, findQuery, currentMatchIdx)}
            </div>
          )}

          <textarea
            ref={textareaRef}
            className="find-target relative block min-h-[calc(100vh-12rem)] w-full resize-none bg-transparent font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
            value={markdown}
            onChange={handleChange}
            onMouseUp={checkSelection}
            placeholder="Start writing... (use # for headings, **bold**, *italic*, - for lists)"
            spellCheck
            disabled={aiStatus === "loading"}
          />
        </div>
      </div>

      {/* AI floating toolbar */}
      {toolbar && projectId && (
        <div data-ai-toolbar>
          <AIToolbar
            x={toolbar.x}
            y={toolbar.y}
            status={aiStatus}
            onAction={handleAIAction}
          />
        </div>
      )}
    </div>
  );
}
