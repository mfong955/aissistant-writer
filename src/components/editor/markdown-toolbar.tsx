"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link as LinkIcon,
  Table,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  wrapSelection,
  toggleLinePrefix,
  toggleHeading,
  insertCodeBlock,
  insertHorizontalRule,
  insertTable,
  insertLink,
  type TextEdit,
} from "@/lib/markdown-toolbar-actions";

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  getText: () => string;
  onApply: (edit: TextEdit) => void;
}

function LinkButton({ textareaRef, getText, onApply }: MarkdownToolbarProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const savedSelection = useRef({ start: 0, end: 0 });

  function openPopover() {
    const ta = textareaRef.current;
    if (!ta) return;
    savedSelection.current = { start: ta.selectionStart, end: ta.selectionEnd };
    setUrl("");
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function apply() {
    const trimmed = url.trim();
    if (trimmed) {
      const { start, end } = savedSelection.current;
      onApply(insertLink(getText(), start, end, trimmed));
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openPopover} title="Link">
        <LinkIcon className="h-4 w-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 flex w-64 items-center gap-1 rounded-md border bg-popover p-1.5 shadow-md">
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="https://..."
              className="h-7 flex-1 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </>
      )}
    </div>
  );
}

export function MarkdownToolbar({ textareaRef, getText, onApply }: MarkdownToolbarProps) {
  function apply(transform: (text: string, start: number, end: number) => TextEdit) {
    const ta = textareaRef.current;
    if (!ta) return;
    onApply(transform(getText(), ta.selectionStart, ta.selectionEnd));
  }

  const tools = [
    { icon: Heading1, title: "Heading 1", action: () => apply((t, s, e) => toggleHeading(t, s, e, 1)) },
    { icon: Heading2, title: "Heading 2", action: () => apply((t, s, e) => toggleHeading(t, s, e, 2)) },
    { icon: Heading3, title: "Heading 3", action: () => apply((t, s, e) => toggleHeading(t, s, e, 3)) },
    { type: "separator" as const },
    { icon: Bold, title: "Bold", action: () => apply((t, s, e) => wrapSelection(t, s, e, "**")) },
    { icon: Italic, title: "Italic", action: () => apply((t, s, e) => wrapSelection(t, s, e, "*")) },
    { icon: Underline, title: "Underline", action: () => apply((t, s, e) => wrapSelection(t, s, e, "<u>", "</u>")) },
    { icon: Strikethrough, title: "Strikethrough", action: () => apply((t, s, e) => wrapSelection(t, s, e, "~~")) },
    { icon: Code, title: "Inline Code", action: () => apply((t, s, e) => wrapSelection(t, s, e, "`")) },
    { type: "separator" as const },
    { icon: List, title: "Bullet List", action: () => apply((t, s, e) => toggleLinePrefix(t, s, e, "- ")) },
    { icon: ListOrdered, title: "Ordered List", action: () => apply((t, s, e) => toggleLinePrefix(t, s, e, "1. ")) },
    { icon: Quote, title: "Blockquote", action: () => apply((t, s, e) => toggleLinePrefix(t, s, e, "> ")) },
    { icon: FileCode, title: "Code Block", action: () => apply((t, s, e) => insertCodeBlock(t, s, e)) },
    { icon: Minus, title: "Horizontal Rule", action: () => apply((t, s) => insertHorizontalRule(t, s)) },
    { icon: Table, title: "Table", action: () => apply((t, s) => insertTable(t, s)) },
  ];

  return (
    <div className="flex items-center gap-0.5 border-b px-2 py-1">
      {tools.map((tool, i) =>
        "type" in tool ? (
          <div key={i} className="mx-1 h-5 w-px bg-border" />
        ) : (
          <Button
            key={tool.title}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={tool.action}
            title={tool.title}
          >
            <tool.icon className="h-4 w-4" />
          </Button>
        )
      )}
      <div className="mx-1 h-5 w-px bg-border" />
      <LinkButton textareaRef={textareaRef} getText={getText} onApply={onApply} />
    </div>
  );
}
