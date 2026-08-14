"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Trash2, Key, Loader2, Zap, Compass, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useProject } from "@/contexts/project-context";
import { useChat } from "@/hooks/use-chat";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ModelSelector } from "./model-selector";
import { WorkflowPickerCard } from "./workflow-picker-card";
import { getOnboardingSettings, getWorkflow, type WorkflowKey } from "@/lib/onboarding";
import type { Project } from "@/types/database";

interface ChatPanelContentProps {
  activeEntityIds?: string[];
  onEntityChange?: () => void;
}

export function ChatPanelContent({ activeEntityIds, onEntityChange }: ChatPanelContentProps) {
  const { project, entities, setProject } = useProject();
  const [modelId, setModelId] = useState<string | null>(null);
  const [contextLimit, setContextLimit] = useState<number>(128000);
  const [noApiKey, setNoApiKey] = useState(false);
  const [pickerOpenManually, setPickerOpenManually] = useState(false);
  const [creditsEnabled, setCreditsEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((data: { enabled: boolean }) => setCreditsEnabled(data.enabled));
  }, []);

  const onboarding = project ? getOnboardingSettings(project) : {};
  const workflowUnset = !onboarding.workflowStatus || onboarding.workflowStatus === "unset";
  const chosenWorkflow = getWorkflow(onboarding.workflow);

  async function handleChooseWorkflow(key: WorkflowKey | null) {
    if (!project) return;
    const nextSettings = {
      ...(project.settings ?? {}),
      workflow: key,
      workflowStatus: key ? "chosen" : "skipped",
    };
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: nextSettings }),
    });
    if (res.ok) {
      const data = (await res.json()) as { project: Project };
      setProject(data.project);
    }
    setPickerOpenManually(false);
  }

  // Drag-to-resize input area
  const [inputAreaHeight, setInputAreaHeight] = useState(100);
  const dragRef = useRef({ dragging: false, startY: 0, startHeight: 0 });

  function handleDragPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { dragging: true, startY: e.clientY, startHeight: inputAreaHeight };
  }
  function handleDragPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.dragging) return;
    const delta = dragRef.current.startY - e.clientY;
    setInputAreaHeight(Math.max(72, Math.min(520, dragRef.current.startHeight + delta)));
  }
  function handleDragPointerUp() {
    dragRef.current.dragging = false;
  }

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
    addSystemMessage,
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

  // Listen for rename-sync events from the explorer
  useEffect(() => {
    const handler = (e: CustomEvent<{ message: string }>) => {
      addSystemMessage(e.detail.message);
    };
    window.addEventListener("aissistant:rename-synced", handler as EventListener);
    return () => window.removeEventListener("aissistant:rename-synced", handler as EventListener);
  }, [addSystemMessage]);

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

      {/* Workflow indicator — always available, per docs/onboarding-workflows.md §3 ("non-binding") */}
      {project && !noApiKey && (
        <button
          type="button"
          onClick={() => setPickerOpenManually((v) => !v)}
          className="flex items-center gap-1 border-b px-3 py-1 text-[11px] text-muted-foreground hover:bg-accent"
        >
          <Compass className="h-3 w-3" />
          <span>
            Workflow: {chosenWorkflow ? chosenWorkflow.title : workflowUnset ? "Not set" : "Free-form"}
          </span>
          <ChevronDown className="h-3 w-3" />
        </button>
      )}

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
        {!noApiKey && project && (pickerOpenManually || (workflowUnset && messages.length === 0)) ? (
          <WorkflowPickerCard project={project} onChoose={handleChooseWorkflow} />
        ) : messages.length === 0 ? (
          noApiKey ? (
            <div className="flex h-full items-center justify-center p-4">
              <Card className="max-w-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Set Up AI Assistant
                  </CardTitle>
                  <CardDescription>
                    Choose how you&apos;d like to power your AI assistant.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border p-3">
                    <p className="mb-1 text-sm font-medium">Option A — Bring your own API key</p>
                    <p className="text-xs text-muted-foreground">
                      Free to use. Get an API key from{" "}
                      <a
                        href="https://openrouter.ai/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        openrouter.ai
                      </a>{" "}
                      and paste it in Settings. You pay OpenRouter directly at cost.
                    </p>
                  </div>
                  {creditsEnabled && (
                    <div className="rounded-lg border p-3">
                      <p className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        Option B &mdash; Buy AI credits
                      </p>
                      <p className="text-xs text-muted-foreground">
                        No API key needed. Buy a credit pack (from $5) and start chatting immediately.
                      </p>
                    </div>
                  )}
                  <Button asChild className="w-full">
                    <Link href="/settings">Go to Settings</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : chosenWorkflow ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
              <p className="max-w-xs text-sm text-muted-foreground">
                Ready when you are — type below, or try one of these to get started.
              </p>
              <div className="flex max-w-xs flex-col gap-2">
                {chosenWorkflow.starterPrompts.map((sp) => (
                  <button
                    key={sp.label}
                    type="button"
                    onClick={() => sendMessage(sp.prompt)}
                    className="rounded-lg border px-3 py-2 text-left text-xs hover:border-primary hover:bg-primary/5"
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
              Start a conversation with the AI assistant
            </div>
          )
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onQuickReply={(text) => sendMessage(text)} />
            ))}
            {isStreaming && (() => {
              const last = messages[messages.length - 1];
              const isThinking = last?.role === "assistant" && !last.content && !last.toolCalls?.length;
              const hasToolInFlight = last?.role === "assistant" && last.toolCalls?.some((tc) => tc.success === undefined);
              const isGenerating = last?.role === "assistant" && (last.content || last.toolCalls?.length);
              return (
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground border-t bg-muted/20">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  <span>
                    {isThinking ? "Thinking…" : hasToolInFlight ? "Running tools…" : isGenerating ? "Generating…" : "Working…"}
                  </span>
                </div>
              );
            })()}
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

      {/* Drag handle */}
      <div
        className="flex h-2.5 cursor-ns-resize select-none items-center justify-center border-t hover:bg-accent/60 active:bg-accent"
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
        title="Drag to resize input area"
      >
        <div className="h-0.5 w-8 rounded-full bg-border" />
      </div>
      <div style={{ height: `${inputAreaHeight}px` }} className="shrink-0 overflow-hidden">
        <ChatInput
          onSend={(msg, images) => sendMessage(msg, images)}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          disabled={!modelId}
          entities={entities.filter((e) => e.type !== "folder" && e.type !== "image")}
          history={messages.filter((m) => m.role === "user").map((m) => m.content)}
        />
      </div>
    </div>
  );
}
