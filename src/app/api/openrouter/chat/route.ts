import { getUserId } from "@/lib/get-user-id";
import { NextResponse } from "next/server";
import { decryptApiKey } from "@/lib/encryption";
import { chatCompletion, parseSSEStream } from "@/lib/openrouter/client";
import { entityTools, executeToolCall } from "@/lib/openrouter/tools";
import { buildContext } from "@/lib/context/context-builder";
import { dbGetUserSettings } from "@/lib/db/user-settings";
import { dbGetCredits, dbDeductCredits } from "@/lib/db/billing";
import {
  MIN_BALANCE_TO_START,
  MAX_COST_PER_MESSAGE_USD,
  usdToCredits,
  formatCredits,
} from "@/lib/billing/credits";
import type { ChatCompletionMessage, StreamChunk, ToolCallResponse } from "@/lib/openrouter/types";

export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;

  const body = await request.json();
  const { messages, model_id, project_id, active_entity_ids, context_limit } = body as {
    messages: ChatCompletionMessage[];
    model_id: string;
    project_id: string;
    active_entity_ids?: string[];
    context_limit?: number;
  };

  if (!messages || !model_id || !project_id) {
    return new Response(
      JSON.stringify({ error: "messages, model_id, and project_id are required" }),
      { status: 400 }
    );
  }

  const settings = await dbGetUserSettings(userId);
  let apiKey: string;
  let usesCredits = false;

  if (settings?.openrouter_api_key_encrypted) {
    // BYOK path: user's own key, billed by their provider. No credit accounting at all.
    try {
      apiKey = await decryptApiKey(settings.openrouter_api_key_encrypted);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to decrypt API key" }), { status: 500 });
    }
  } else {
    // Credits path: system key, charged at actual usage after the response completes.
    const systemKey = process.env.OPENROUTER_SYSTEM_API_KEY;
    if (!systemKey) {
      return new Response(
        JSON.stringify({ error: "No API key configured. Add your OpenRouter key in Settings." }),
        { status: 400 }
      );
    }

    // Pre-flight floor. Cost isn't known until the generation finishes, so this is what
    // prevents a nearly-empty balance from going deeply negative on one expensive message.
    const balance = await dbGetCredits(userId);
    if (balance < MIN_BALANCE_TO_START) {
      return new Response(
        JSON.stringify({
          error: "insufficient_credits",
          message: `Your balance is ${formatCredits(balance)}, which is too low to start a message. Add credits in Settings, or connect your own OpenRouter key to use the app for free.`,
        }),
        { status: 402 }
      );
    }
    apiKey = systemKey;
    usesCredits = true;
  }

  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  const contextResult = await buildContext({
    projectId: project_id,
    userId,
    userMessage: (Array.isArray(lastUserMessage?.content)
      ? lastUserMessage.content.find((p) => p.type === "text")?.text
      : lastUserMessage?.content) || "",
    activeEntityIds: active_entity_ids || [],
    contextLimit: context_limit || 128000,
  });

  const fullMessages: ChatCompletionMessage[] = [
    { role: "system", content: contextResult.systemPrompt },
    ...messages,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "context_info",
            totalTokensUsed: contextResult.totalTokensUsed,
            contextLimit: contextResult.contextLimit,
            includedSummaries: contextResult.includedSummaries,
            hasProjectState: contextResult.hasProjectState,
          })}\n\n`
        )
      );

      try {
        const { costUsd } = await processChat({
          apiKey,
          messages: fullMessages,
          modelId: model_id,
          projectId: project_id,
          userId,
          controller,
          encoder,
          usesCredits,
        });

        if (usesCredits) {
          const credits = usdToCredits(costUsd);
          const remaining = await dbDeductCredits(userId, credits, `AI message (${model_id})`);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "balance", credits, remaining })}\n\n`
            )
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMsg })}\n\n`)
        );
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function processChat(params: {
  apiKey: string;
  messages: ChatCompletionMessage[];
  modelId: string;
  projectId: string;
  userId: string;
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  usesCredits: boolean;
}): Promise<{ costUsd: number }> {
  const { apiKey, messages, modelId, projectId, userId, controller, encoder, usesCredits } = params;

  // Summed across the initial generation and the post-tool-call follow-up. Present only
  // because the request sets `usage: { include: true }`.
  let costUsd = 0;

  const rawStream = await chatCompletion({
    apiKey,
    messages,
    model: modelId,
    tools: entityTools,
    stream: true,
  });

  const parsedStream = parseSSEStream(rawStream);
  const reader = parsedStream.getReader();

  let accumulatedContent = "";
  const accumulatedToolCalls: Map<number, { id: string; name: string; arguments: string }> =
    new Map();
  let usage: { prompt_tokens: number; completion_tokens: number } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = value as StreamChunk;
    const choice = chunk.choices?.[0];

    if (choice?.delta?.content) {
      accumulatedContent += choice.delta.content;
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "text", content: choice.delta.content })}\n\n`
        )
      );
    }

    if (choice?.delta?.tool_calls) {
      for (const tc of choice.delta.tool_calls) {
        if (!accumulatedToolCalls.has(tc.index)) {
          accumulatedToolCalls.set(tc.index, { id: tc.id || "", name: tc.function?.name || "", arguments: "" });
        }
        const existing = accumulatedToolCalls.get(tc.index)!;
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.name = tc.function.name;
        if (tc.function?.arguments) existing.arguments += tc.function.arguments;
      }
    }

    if (chunk.usage) {
      usage = { prompt_tokens: chunk.usage.prompt_tokens, completion_tokens: chunk.usage.completion_tokens };
      costUsd += chunk.usage.cost ?? 0;
    }
  }

  if (accumulatedToolCalls.size > 0) {
    const toolResults: Array<{ toolCallId: string; result: Record<string, unknown>; description: string }> = [];

    for (const [, tc] of accumulatedToolCalls) {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.arguments);
      } catch {
        args = {};
      }

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "tool_call_start", tool_call_id: tc.id, name: tc.name, arguments: args })}\n\n`
        )
      );

      const result = await executeToolCall(tc.name, args, projectId, userId);

      toolResults.push({ toolCallId: tc.id, result: result.result, description: result.description });

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "tool_call_result",
            tool_call_id: tc.id,
            name: tc.name,
            success: result.success,
            result: result.result,
            description: result.description,
          })}\n\n`
        )
      );
    }

    const toolCallMessages: ChatCompletionMessage[] = [
      ...messages,
      {
        role: "assistant",
        content: accumulatedContent || null,
        tool_calls: Array.from(accumulatedToolCalls.values()).map(
          (tc): ToolCallResponse => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          })
        ),
      },
      ...toolResults.map(
        (tr): ChatCompletionMessage => ({
          role: "tool",
          content: JSON.stringify(tr.result),
          tool_call_id: tr.toolCallId,
        })
      ),
    ];

    // Circuit breaker. The tool results are already applied and streamed to the client;
    // what's skipped is only the model's closing summary of what it did. This never
    // truncates a generation in flight — it declines to start an additional one.
    if (usesCredits && costUsd >= MAX_COST_PER_MESSAGE_USD) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "notice",
            message: `This message reached the ${formatCredits(usdToCredits(MAX_COST_PER_MESSAGE_USD))} per-message ceiling. Your changes were applied, but the AI's follow-up summary was skipped. A smaller context or a cheaper model will avoid this.`,
          })}\n\n`
        )
      );
      return { costUsd };
    }

    const followUpStream = await chatCompletion({ apiKey, messages: toolCallMessages, model: modelId, stream: true });
    const followUpParsed = parseSSEStream(followUpStream);
    const followUpReader = followUpParsed.getReader();

    while (true) {
      const { done, value } = await followUpReader.read();
      if (done) break;

      const chunk = value as StreamChunk;
      const choice = chunk.choices?.[0];

      if (choice?.delta?.content) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "text", content: choice.delta.content })}\n\n`)
        );
      }

      if (chunk.usage) {
        if (usage) {
          usage.prompt_tokens += chunk.usage.prompt_tokens;
          usage.completion_tokens += chunk.usage.completion_tokens;
        } else {
          usage = { prompt_tokens: chunk.usage.prompt_tokens, completion_tokens: chunk.usage.completion_tokens };
        }
        costUsd += chunk.usage.cost ?? 0;
      }
    }
  }

  if (usage) {
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ type: "usage", ...usage, cost: costUsd })}\n\n`)
    );
  }

  return { costUsd };
}
