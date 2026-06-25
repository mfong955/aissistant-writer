"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, FileText, Folder, Image } from "lucide-react";
import { useProject } from "@/contexts/project-context";
import { tiptapToMarkdown } from "@/lib/tiptap-utils";
import type { Entity } from "@/types/database";

interface SearchResult {
  entity: Entity;
  matchType: "name" | "content";
  snippet: string | null;
}

function getSnippet(text: string, query: string): string | null {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 40);
  const before = (start > 0 ? "…" : "") + text.slice(start, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length, end) + (end < text.length ? "…" : "");
  return `${before}__MATCH__${match}__END__${after}`;
}

function SnippetLine({ snippet }: { snippet: string }) {
  const parts = snippet.split(/(__MATCH__|__END__)/);
  let inMatch = false;
  return (
    <span className="truncate text-[11px] text-muted-foreground">
      {parts.map((part, i) => {
        if (part === "__MATCH__") { inMatch = true; return null; }
        if (part === "__END__") { inMatch = false; return null; }
        return inMatch
          ? <mark key={i} className="bg-yellow-200/70 dark:bg-yellow-800/50 text-foreground rounded-[2px] px-[1px]">{part}</mark>
          : <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function entityIcon(type: Entity["type"]) {
  if (type === "folder") return <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  if (type === "image") return <Image className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  return <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
}

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (entityId: string) => void;
}

export function SearchDialog({ open, onClose, onSelect }: SearchDialogProps) {
  const { entities } = useProject();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) {
      return entities
        .filter((e) => e.type !== "folder")
        .slice(0, 8)
        .map((e) => ({ entity: e, matchType: "name", snippet: null }));
    }
    const q = query.trim();
    const out: SearchResult[] = [];
    for (const entity of entities) {
      if (entity.type === "folder") continue;
      const nameMatch = entity.name.toLowerCase().includes(q.toLowerCase());
      if (nameMatch) {
        out.push({ entity, matchType: "name", snippet: null });
        continue;
      }
      if (entity.content) {
        const md = tiptapToMarkdown(entity.content);
        const snippet = getSnippet(md, q);
        if (snippet) {
          out.push({ entity, matchType: "content", snippet });
        }
      }
    }
    return out.slice(0, 12);
  }, [query, entities]);

  useEffect(() => { setSelected(0); }, [results]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) { pick(results[selected].entity.id); }
    if (e.key === "Escape") { onClose(); }
  }

  function pick(id: string) {
    onSelect(id);
    onClose();
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-xl border bg-popover shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search files and content…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setQuery("")}
            >
              Clear
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results for &quot;{query}&quot;
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.entity.id}
                className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors ${i === selected ? "bg-accent" : "hover:bg-accent/60"}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => pick(r.entity.id)}
              >
                <span className="mt-0.5">{entityIcon(r.entity.type)}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{r.entity.name}</span>
                  {r.snippet ? (
                    <SnippetLine snippet={r.snippet} />
                  ) : (
                    <span className="text-[11px] text-muted-foreground capitalize">{r.entity.type}</span>
                  )}
                </span>
                {r.matchType === "content" && (
                  <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    content
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-[10px] text-muted-foreground">
          <span><kbd className="font-sans">↑↓</kbd> navigate</span>
          <span><kbd className="font-sans">↵</kbd> open</span>
          <span><kbd className="font-sans">Esc</kbd> close</span>
          {!query && <span className="ml-auto">Recent files</span>}
          {query && <span className="ml-auto">{results.length} result{results.length !== 1 ? "s" : ""}</span>}
        </div>
      </div>
    </div>,
    document.body
  );
}
