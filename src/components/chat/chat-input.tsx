"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Square, Paperclip, Link, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Attachment {
  id: string;
  type: "file" | "link";
  name: string;
  content: string;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function buildMessageWithAttachments(text: string): string {
    if (!attachments.length) return text;
    const parts = [text.trim()];
    const fileAttachments = attachments.filter((a) => a.type === "file");
    const linkAttachments = attachments.filter((a) => a.type === "link");
    if (fileAttachments.length) {
      parts.push(
        `\n\n[Attached files]\n` +
          fileAttachments
            .map((a) => `--- ${a.name} ---\n${a.content}`)
            .join("\n\n")
      );
    }
    if (linkAttachments.length) {
      parts.push(
        `\n\n[Attached links]\n` + linkAttachments.map((a) => `- ${a.content}`).join("\n")
      );
    }
    return parts.join("");
  }

  function handleSubmit() {
    const text = input.trim();
    if (!text || disabled) return;
    onSend(buildMessageWithAttachments(text));
    setInput("");
    setAttachments([]);
    setShowLinkInput(false);
    setLinkInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
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
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          { id: crypto.randomUUID(), type: "file", name: file.name, content },
        ]);
      };
      // Read text files as text; treat others as a reference
      if (file.type.startsWith("text/") || /\.(md|txt|csv|json|py|js|ts|tsx|jsx|html|css)$/i.test(file.name)) {
        reader.readAsText(file);
      } else {
        setAttachments((prev) => [
          ...prev,
          { id: crypto.randomUUID(), type: "file", name: file.name, content: `[Binary file — ${file.type || "unknown type"}, ${(file.size / 1024).toFixed(1)} KB]` },
        ]);
      }
    });
    // Reset file input so the same file can be re-attached
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
    <div className="h-full flex flex-col px-3 pt-2 pb-3 gap-2">
      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {attachments.map((att) => (
            <span
              key={att.id}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground max-w-[200px]"
            >
              {att.type === "file" ? (
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

      {/* Textarea row — fills remaining space */}
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
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Configure API key in settings…" : "Type a message… (Shift+Enter for new line)"}
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
        accept=".txt,.md,.csv,.json,.py,.js,.ts,.tsx,.jsx,.html,.css,.pdf,.doc,.docx"
        onChange={handleFileChange}
      />
    </div>
  );
}
