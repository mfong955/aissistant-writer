"use client";

import { User, Bot, Check, X, FileText } from "lucide-react";
import type { ChatMessageUI } from "@/hooks/use-chat";

interface ChatMessageProps {
  message: ChatMessageUI;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 px-4 py-3 ${isUser ? "" : "bg-muted/30"}`}>
      <div className="mt-0.5 shrink-0">
        {isUser ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
            <User className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary">
            <Bot className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content || (message.toolCalls?.length ? "" : "...")}
        </div>

        {/* Tool call results */}
        {message.toolCalls?.map((tc) => (
          <div
            key={tc.id}
            className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">
              {tc.description || `${tc.name}(${JSON.stringify(tc.arguments)})`}
            </span>
            {tc.success === true && (
              <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
            )}
            {tc.success === false && (
              <X className="h-3.5 w-3.5 shrink-0 text-red-600" />
            )}
          </div>
        ))}

        {/* Token info */}
        {message.promptTokens !== undefined && (
          <div className="text-xs text-muted-foreground">
            {message.promptTokens + (message.completionTokens || 0)} tokens
          </div>
        )}
      </div>
    </div>
  );
}
