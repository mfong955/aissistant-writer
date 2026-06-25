"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Send, Square, Paperclip, Link, X, Image as ImageIcon, AtSign, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tiptapToMarkdown } from "@/lib/tiptap-utils";
import type { ImageAttachment } from "@/hooks/use-chat";
import type { Entity } from "@/types/database";

type Attachment =
  | { id: string; type: "file"; name: string; content: string }
  | { id: string; type: "image"; name: string; base64url: string; mimeType: string }
  | { id: string; type: "link"; name: string; content: string }
  | { id: string; type: "entity"; name: string; content: string; entityId: string };

const TEXT_EXTENSIONS = /\.(md|markdown|txt|csv|json|jsonl|yaml|yml|toml|py|js|ts|tsx|jsx|html|css|scss|xml|svg|sh|bash|zsh|env|ini|cfg|conf|log|rst|tex)$/i;
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|avif)$/i;

interface ChatInputProps {
  onSend: (message: string, images?: ImageAttachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  entities?: Entity[];
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  entities,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionFromText = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mentionResults = useMemo(() => {
    if (mentionQuery === null || !entities?.length) return [];
    const q = mentionQuery.toLowerCase();
    return entities
      .filter((e) => e.type !== "folder" && (!q || e.name.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [mentionQuery, entities]);

  const addEntityToChat = useCallback((entity: Entity) => {
    setAttachments((prev) => {
      if (prev.some((a) => a.type === "entity" && a.entityId === entity.id)) return prev;
      const content = entity.content ? tiptapToMarkdown(entity.content) : "(empty file)";
      return [
        ...prev,
        { id: crypto.randomUUID(), type: "entity" as const, name: entity.name, content, entityId: entity.id },
      ];
    });
  }, []);

  // Listen for right-click "Add to Chat" from the explorer
  useEffect(() => {
    function handler(e: CustomEvent<{ entity: Entity }>) {
      addEntityToChat(e.detail.entity);
    }
    window.addEventListener("aissistant:add-to-chat", handler as EventListener);
    return () => window.removeEventListener("aissistant:add-to-chat", handler as EventListener);
  }, [addEntityToChat]);

  function selectMention(entity: Entity) {
    if (mentionFromText.current && textareaRef.current) {
      const cursor = textareaRef.current.selectionStart || 0;
      const before = input.slice(0, cursor);
      const after = input.slice(cursor);
      const atIdx = before.search(/@\w*$/);
      if (atIdx >= 0) setInput(before.slice(0, atIdx) + after);
    }
    addEntityToChat(entity);
    setMentionQuery(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handleAtButtonClick() {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const start = ta.selectionStart ?? input.length;
    const before = input.slice(0, start);
    const after = input.slice(start);
    const prevChar = before.length > 0 ? before[before.length - 1] : null;
    const prefix = prevChar && prevChar !== " " && prevChar !== "\n" ? " " : "";
    setInput(before + prefix + "@" + after);
    mentionFromText.current = true;
    setMentionQuery("");
    setMentionIndex(0);
    const newCursor = start + prefix.length + 1;
    requestAnimationFrame(() => {
      ta.setSelectionRange(newCursor, newCursor);
      ta.focus();
    });
  }

  function buildTextMessage(text: string): string {
    if (!attachments.length) return text;
    const parts = [text.trim()];
    const fileAndEntityAttachments = attachments.filter(
      (a): a is Extract<Attachment, { type: "file" }> | Extract<Attachment, { type: "entity" }> =>
        a.type === "file" || a.type === "entity"
    );
    const linkAttachments = attachments.filter(
      (a): a is Extract<Attachment, { type: "link" }> => a.type === "link"
    );
    if (fileAndEntityAttachments.length) {
      parts.push(
        `\n\n[Attached files]\n` +
          fileAndEntityAttachments.map((a) => `--- ${a.name} ---\n${a.content}`).join("\n\n")
      );
    }
    if (linkAttachments.length) {
      parts.push(`\n\n[Attached links]\n` + linkAttachments.map((a) => `- ${a.content}`).join("\n"));
    }
    return parts.join("");
  }

  function handleSubmit() {
    const text = input.trim();
    if (!text || disabled) return;
    const images = attachments
      .filter((a): a is Extract<Attachment, { type: "image" }> => a.type === "image")
      .map((a) => ({ name: a.name, base64url: a.base64url, mimeType: a.mimeType }));
    onSend(buildTextMessage(text), images.length ? images : undefined);
    setInput("");
    setAttachments([]);
    setShowLinkInput(false);
    setLinkInput("");
    setMentionQuery(null);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);

    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const match = /@(\w*)$/.exec(before);
    if (match) {
      const atIdx = match.index;
      const charBefore = atIdx > 0 ? before[atIdx - 1] : null;
      if (charBefore === null || charBefore === " " || charBefore === "\n") {
        mentionFromText.current = true;
        setMentionQuery(match[1]);
        setMentionIndex(0);
        return;
      }
    }
    setMentionQuery(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, mentionResults.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (mentionResults[mentionIndex]) selectMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const isText = file.type.startsWith("text/") || TEXT_EXTENSIONS.test(file.name);
      const isImage = file.type.startsWith("image/") || IMAGE_EXTENSIONS.test(file.name);

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64url = ev.target?.result as string;
          setAttachments((prev) => [
            ...prev,
            { id: crypto.randomUUID(), type: "image", name: file.name, base64url, mimeType: file.type || "image/png" },
          ]);
        };
        reader.readAsDataURL(file);
      } else if (isText) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setAttachments((prev) => [
            ...prev,
            { id: crypto.randomUUID(), type: "file", name: file.name, content },
          ]);
        };
        reader.readAsText(file, "utf-8");
      } else if (
        file.name.endsWith(".pdf") || file.type === "application/pdf" ||
        /\.(doc|docx|rtf)$/i.test(file.name) ||
        file.type === "application/msword" ||
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/rtf"
      ) {
        const id = crypto.randomUUID();
        setAttachments((prev) => [
          ...prev,
          { id, type: "file", name: file.name, content: `[Extracting text from "${file.name}"…]` },
        ]);
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target?.result as string;
          const base64 = dataUrl.split(",")[1] ?? "";
          try {
            const res = await fetch("/api/extract-document", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ base64, mimeType: file.type, fileName: file.name }),
            });
            const data = await res.json() as { text?: string; error?: string };
            const content = data.text?.trim()
              ? `[${file.name}]\n${data.text.trim()}`
              : `[Could not extract text from "${file.name}": ${data.error || "unknown error"}]`;
            setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, content } : a));
          } catch {
            setAttachments((prev) =>
              prev.map((a) => a.id === id ? { ...a, content: `[Failed to extract "${file.name}"]` } : a)
            );
          }
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "file",
            name: file.name,
            content: `[Unsupported format: ${file.type || file.name.split(".").pop()} — ${(file.size / 1024).toFixed(1)} KB]`,
          },
        ]);
      }
    });
    e.target.value = "";
  }, []);

  function handleAddLink() {
    const url = linkInput.trim();
    if (!url) return;
    setAttachments((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: "link", name: url, content: url },
    ]);
    setLinkInput("");
    setShowLinkInput(false);
  }

  return (
    <div className="relative h-full flex flex-col px-3 pt-2 pb-3 gap-2">
      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {attachments.map((att) => (
            <span
              key={att.id}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground max-w-[200px]"
            >
              {att.type === "image" ? (
                <ImageIcon className="h-3 w-3 shrink-0 text-blue-400" />
              ) : att.type === "entity" ? (
                <AtSign className="h-3 w-3 shrink-0 text-primary" />
              ) : att.type === "file" ? (
                <Paperclip className="h-3 w-3 shrink-0" />
              ) : (
                <Link className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">{att.name}</span>
              <button
                onClick={() => removeAttachment(att.id)}
                className="shrink-0 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Link input */}
      {showLinkInput && (
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="url"
            className="flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="https://..."
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddLink();
              if (e.key === "Escape") { setShowLinkInput(false); setLinkInput(""); }
            }}
            autoFocus
          />
          <Button size="sm" variant="outline" onClick={handleAddLink} disabled={!linkInput.trim()}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowLinkInput(false); setLinkInput(""); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Textarea row */}
      <div className="flex flex-1 min-h-0 gap-2">
        <div className="flex shrink-0 flex-col justify-end gap-1 pb-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground"
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isStreaming}
          >
            <Paperclip className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "h-7 w-7 text-muted-foreground",
              mentionQuery !== null && "text-primary bg-primary/10"
            )}
            title="Mention a file (@)"
            onClick={handleAtButtonClick}
            disabled={disabled || isStreaming}
          >
            <AtSign className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground"
            title="Attach link"
            onClick={() => setShowLinkInput((v) => !v)}
            disabled={disabled || isStreaming}
          >
            <Link className="h-3.5 w-3.5" />
          </Button>
        </div>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay closing so clicks on the popup register first
            setTimeout(() => setMentionQuery(null), 150);
          }}
          placeholder={disabled ? "Configure API key in settings…" : "Type a message… (@ to mention a file, Shift+Enter for new line)"}
          disabled={disabled || isStreaming}
          className="flex-1 h-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex shrink-0 items-end pb-0.5">
          {isStreaming ? (
            <Button size="icon" variant="destructive" onClick={onStop}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!input.trim() || disabled}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".txt,.md,.markdown,.csv,.json,.jsonl,.yaml,.yml,.py,.js,.ts,.tsx,.jsx,.html,.css,.xml,.sh,.log,.rst,.tex,.png,.jpg,.jpeg,.gif,.webp,.avif,.pdf,.doc,.docx,.rtf"
        onChange={handleFileChange}
      />

      {/* @ mention popup */}
      {mentionQuery !== null && mentionResults.length > 0 && textareaRef.current &&
        createPortal(
          (() => {
            const rect = textareaRef.current!.getBoundingClientRect();
            return (
              <div
                className="fixed z-50 overflow-hidden rounded-md border bg-popover shadow-md"
                style={{
                  left: rect.left,
                  bottom: window.innerHeight - rect.top + 4,
                  width: rect.width,
                  maxHeight: "240px",
                  overflowY: "auto",
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="px-2 py-1 text-[10px] text-muted-foreground border-b">
                  Project files — ↑↓ navigate, Enter/Tab to add
                </div>
                {mentionResults.map((entity, i) => (
                  <button
                    key={entity.id}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent",
                      i === mentionIndex && "bg-accent"
                    )}
                    onMouseDown={(e) => { e.preventDefault(); selectMention(entity); }}
                    onMouseEnter={() => setMentionIndex(i)}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{entity.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground capitalize shrink-0">
                      {entity.type.replace("_", " ")}
                    </span>
                  </button>
                ))}
                {mentionQuery !== null && mentionResults.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No matching files</div>
                )}
              </div>
            );
          })(),
          document.body
        )
      }

      {/* Empty state for @ popup when no results */}
      {mentionQuery !== null && mentionResults.length === 0 && entities?.length && textareaRef.current &&
        createPortal(
          (() => {
            const rect = textareaRef.current!.getBoundingClientRect();
            return (
              <div
                className="fixed z-50 overflow-hidden rounded-md border bg-popover shadow-md"
                style={{ left: rect.left, bottom: window.innerHeight - rect.top + 4, width: rect.width }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No matching files{mentionQuery ? ` for "${mentionQuery}"` : ""}
                </div>
              </div>
            );
          })(),
          document.body
        )
      }
    </div>
  );
}
