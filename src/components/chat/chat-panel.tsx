"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Trash2, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useProject } from "@/contexts/project-context";
import { useChat } from "@/hooks/use-chat";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ModelSelector } from "./model-selector";

interface ChatPanelContentProps {
  activeEntityIds?: string[];
  onEntityChange?: () => void;
}

export function ChatPanelContent({ activeEntityIds, onEntityChange }: ChatPanelContentProps) {
  const { project } = useProject();
  const [modelId, setModelId] = useState<string | null>(null);
  const [contextLimit, setContextLimit] = useState<number>(128000);
  const [noApiKey, setNoApiKey] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleModelSelect = useCallback((id: string, ctxLength: number) => {
    setModelId(id);
    setContextLimit(ctxLength);
  }, []);

  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    totalPromptTokens,
    totalCompletionTokens,
    contextInfo,
  } = useChat({
    projectId: project?.id || "",
    modelId,
    activeEntityIds,
    contextLimit,
    onEntityChange,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const totalTokens = totalPromptTokens + totalCompletionTokens;

  // Context usage percentage for the bar
  const contextUsagePercent = contextInfo
    ? Math.min(100, Math.round((contextInfo.totalTokensUsed / contextInfo.contextLimit) * 100))
    : 0;

  const contextBarColor =
    contextUsagePercent < 50
      ? "bg-green-500"
      : contextUsagePercent < 80
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="flex h-full flex-col">
      <ModelSelector
        selectedModelId={modelId}
        onSelect={handleModelSelect}
        onNoApiKey={setNoApiKey}
      />

      {/* Context usage bar */}
      {contextInfo && (
        <div className="border-b px-3 py-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              Context: {contextInfo.totalTokensUsed.toLocaleString()} / {contextInfo.contextLimit.toLocaleString()} tokens
            </span>
            <span>
              {contextInfo.includedSummaries} summaries{contextInfo.hasProjectState ? " + project state" : ""}
            </span>
          </div>
          <div className="mt-0.5 h-1 w-full rounded-full bg-muted">
            <div
              className={`h-1 rounded-full transition-all ${contextBarColor}`}
              style={{ width: `${contextUsagePercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto">
        {messages.length === 0 ? (
          noApiKey ? (
            <div className="flex h-full items-center justify-center p-4">
              <Card className="max-w-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Set Up AI Assistant
                  </CardTitle>
                  <CardDescription>
                    Connect an AI model to start writing with your assistant.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    This app uses{" "}
                    <a
                      href="https://openrouter.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      OpenRouter
                    </a>{" "}
                    to connect to AI models like GPT-4o, Claude, and Gemini.
                    You need an API key to get started.
                  </p>
                  <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                    <li>
                      Create an account at{" "}
                      <a
                        href="https://openrouter.ai/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        openrouter.ai
                      </a>
                    </li>
                    <li>Generate an API key in your dashboard</li>
                    <li>Paste it in Settings</li>
                  </ol>
                  <Button asChild className="w-full">
                    <Link href="/settings">Go to Settings</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
              Start a conversation with the AI assistant
            </div>
          )
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Token usage bar */}
      {totalTokens > 0 && (
        <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            {totalTokens.toLocaleString()} tokens ({totalPromptTokens.toLocaleString()} in /{" "}
            {totalCompletionTokens.toLocaleString()} out)
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={clearMessages}
            title="Clear conversation"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}

      <ChatInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        disabled={!modelId}
      />
    </div>
  );
}
