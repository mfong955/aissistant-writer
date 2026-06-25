"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronUp, ChevronDown, Replace } from "lucide-react";

interface FindReplaceBarProps {
  value: string;
  onChange: (newValue: string) => void;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onMatchIdxChange: (idx: number, total: number) => void;
}

function getMatches(text: string, query: string): number[] {
  if (!query) return [];
  const positions: number[] = [];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let idx = 0;
  while ((idx = lower.indexOf(q, idx)) !== -1) {
    positions.push(idx);
    idx += q.length;
  }
  return positions;
}

export function FindReplaceBar({ value, onChange, onClose, onQueryChange, onMatchIdxChange }: FindReplaceBarProps) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the find input when the bar appears — don't touch the textarea
  useEffect(() => { findInputRef.current?.focus(); }, []);

  const matches = getMatches(value, find);
  const count = matches.length;
  const current = count > 0 ? ((matchIndex % count) + count) % count : 0;

  // Notify parent whenever query or current match changes (parent drives highlights + scroll)
  useEffect(() => {
    onQueryChange(find);
    onMatchIdxChange(0, count);
    setMatchIndex(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find]);

  useEffect(() => {
    onMatchIdxChange(current, count);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, count]);

  function navigate(dir: 1 | -1) {
    setMatchIndex((i) => ((i + dir + count) % count + count) % count);
  }

  function replaceOne() {
    if (count === 0 || !find) return;
    const pos = matches[current];
    onChange(value.slice(0, pos) + replace + value.slice(pos + find.length));
  }

  function replaceAll() {
    if (!find) return;
    const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    onChange(value.replace(re, replace));
    onClose();
  }

  return (
    <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5 text-xs">
      {/* Find */}
      <div className="flex items-center gap-1 rounded border bg-background px-2 py-1 focus-within:ring-1 focus-within:ring-ring">
        <input
          ref={findInputRef}
          value={find}
          onChange={(e) => setFind(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate(e.shiftKey ? -1 : 1);
            if (e.key === "Escape") onClose();
          }}
          placeholder="Find"
          className="w-36 bg-transparent outline-none placeholder:text-muted-foreground"
        />
        {find && (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {count === 0 ? "no matches" : `${current + 1}/${count}`}
          </span>
        )}
      </div>

      <button onClick={() => navigate(-1)} disabled={count === 0} title="Previous (Shift+Enter)"
        className="rounded p-0.5 hover:bg-accent disabled:opacity-40">
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => navigate(1)} disabled={count === 0} title="Next (Enter)"
        className="rounded p-0.5 hover:bg-accent disabled:opacity-40">
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Replace */}
      <div className="flex items-center gap-1 rounded border bg-background px-2 py-1 focus-within:ring-1 focus-within:ring-ring">
        <input
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          placeholder="Replace"
          className="w-32 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>

      <button onClick={replaceOne} disabled={count === 0} title="Replace this match"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent disabled:opacity-40">
        <Replace className="h-3 w-3" /><span>Replace</span>
      </button>
      <button onClick={replaceAll} disabled={count === 0}
        className="rounded px-1.5 py-0.5 hover:bg-accent disabled:opacity-40">
        All
      </button>

      <button onClick={onClose} className="ml-auto rounded p-0.5 hover:bg-accent" title="Close (Esc)">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
