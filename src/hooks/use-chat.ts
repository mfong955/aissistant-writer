"use client";

import { useState, useCallback, useRef } from "react";

export interface ImageAttachment {
  name: string;
  base64url: string;
  mimeType: string;
}

export interface ChatMessageUI {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imageAttachments?: ImageAttachment[];
  toolCalls?: ToolCallUI[];
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
  timestamp: Date;
}

export interface ToolCallUI {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  success?: boolean;
  result?: Record<string, unknown>;
  description?: string;
}

export interface ContextInfo {
  totalTokensUsed: number;
  contextLimit: number;
  includedSummaries: number;
  hasProjectState: boolean;
}

interface UseChatOptions {
  projectId: string;
  modelId: string | null;
  activeEntityIds?: string[];
  contextLimit?: number;
  onEntityChange?: () => void;
}

export function useChat({
  projectId,
  modelId,
  activeEntityIds,
  contextLimit,
  onEntityChange,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessageUI[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [totalPromptTokens, setTotalPromptTokens] = useState(0);
  const [totalCompletionTokens, setTotalCompletionTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userMessage: string, imageAttachments?: ImageAttachment[]) => {
      if (!modelId || !userMessage.trim() || isStreaming) return;

      const userMsg: ChatMessageUI = {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage.trim(),
        imageAttachments,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessageUI = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolCalls: [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Build messages for the API — use content array for vision when images present
        const apiMessages = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.imageAttachments?.length
            ? [
                { type: "text" as const, text: m.content },
                ...m.imageAttachments.map((img) => ({
                  type: "image_url" as const,
                  image_url: { url: img.base64url },
                })),
              ]
            : m.content,
        }));

        const response = await fetch("/api/openrouter/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            model_id: modelId,
            project_id: projectId,
            active_entity_ids: activeEntityIds || [],
            context_limit: contextLimit,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Chat request failed");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") break;

            try {
              const event = JSON.parse(data);

              switch (event.type) {
                case "context_info":
                  setContextInfo({
                    totalTokensUsed: event.totalTokensUsed,
                    contextLimit: event.contextLimit,
                    includedSummaries: event.includedSummaries,
                    hasProjectState: event.hasProjectState,
                  });
                  break;

                case "text":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + event.content }
                        : m
                    )
                  );
                  break;

                case "tool_call_start":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            toolCalls: [
                              ...(m.toolCalls || []),
                              {
                                id: event.tool_call_id,
                                name: event.name,
                                arguments: event.arguments,
                              },
                            ],
                          }
                        : m
                    )
                  );
                  break;

                case "tool_call_result":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            toolCalls: m.toolCalls?.map((tc) =>
                              tc.id === event.tool_call_id
                                ? {
                                    ...tc,
                                    success: event.success,
                                    result: event.result,
                                    description: event.description,
                                  }
                                : tc
                            ),
                          }
                        : m
                    )
                  );
                  if (event.name !== "read_entity") {
                    onEntityChange?.();
                  }
                  break;

                case "usage":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            promptTokens: event.prompt_tokens,
                            completionTokens: event.completion_tokens,
                          }
                        : m
                    )
                  );
                  setTotalPromptTokens((prev) => prev + (event.prompt_tokens || 0));
                  setTotalCompletionTokens(
                    (prev) => prev + (event.completion_tokens || 0)
                  );
                  break;

                case "error":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: `Error: ${event.error}` }
                        : m
                    )
                  );
                  break;
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      m.content ||
                      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                  }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [messages, modelId, projectId, activeEntityIds, contextLimit, isStreaming, onEntityChange]
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setTotalPromptTokens(0);
    setTotalCompletionTokens(0);
    setTotalCost(0);
    setContextInfo(null);
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "system", content, timestamp: new Date() },
    ]);
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    addSystemMessage,
    totalPromptTokens,
    totalCompletionTokens,
    totalCost,
    contextInfo,
  };
}
