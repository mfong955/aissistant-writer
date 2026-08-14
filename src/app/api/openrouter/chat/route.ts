import { getUserId } from "@/lib/get-user-id";
import { NextResponse } from "next/server";
import { decryptApiKey } from "@/lib/encryption";
import { chatCompletion, parseSSEStream } from "@/lib/openrouter/client";
import { entityTools, canvasTools, executeToolCall } from "@/lib/openrouter/tools";
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

  // Everything up to the stream itself is pre-flight setup — a synchronous failure anywhere
  // in here previously fell through to Next.js's own error page (HTML/plain text, not JSON),
  // which is exactly what produced "Unexpected token 'I', 'Internal S'... is not valid JSON"
  // on the client: the frontend always expects JSON or an SSE stream, never gets either, and
  // the real error never even reaches the UI. Wrapping this guarantees a JSON body either way,
  // and logs server-side so the actual cause is visible in the dev server's own output.
  let apiKey: string;
  let usesCredits = false;
  let contextResult: Awaited<ReturnType<typeof buildContext>>;

  try {
    const settings = await dbGetUserSettings(userId);

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
    contextResult = await buildContext({
      projectId: project_id,
      userId,
      userMessage: (Array.isArray(lastUserMessage?.content)
        ? lastUserMessage.content.find((p) => p.type === "text")?.text
        : lastUserMessage?.content) || "",
      activeEntityIds: active_entity_ids || [],
      contextLimit: context_limit || 128000,
    });
  } catch (error) {
    console.error("[POST /api/openrouter/chat] setup failed:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to prepare chat request" }),
      { status: 500 }
    );
  }

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
        let errorMsg = error instanceof Error ? error.message : "Unknown error";
        if (!usesCredits && /OpenRouter error: 401/.test(errorMsg)) {
          errorMsg =
            "Your OpenRouter API key was rejected (401 from OpenRouter itself, not this app). " +
            "It may be invalid, revoked, or corrupted. Go to Settings, remove it, and paste a fresh " +
            "key from openrouter.ai/settings/keys, then use \"Test Connection\" to confirm.";
        }
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

// Bounded so a model that keeps deciding to call tools can't loop forever — a real risk for
// "read a few files, then synthesize" tasks. On the final round tools are withheld, forcing a
// text-only wrap-up rather than another (would-be-empty) tool round.
const MAX_TOOL_ROUNDS = 8;

async function runCompletionRound(params: {
  apiKey: string;
  messages: ChatCompletionMessage[];
  modelId: string;
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  includeTools: boolean;
}): Promise<{
  content: string;
  toolCalls: Map<number, { id: string; name: string; arguments: string }>;
  usage: { prompt_tokens: number; completion_tokens: number } | null;
  costUsd: number;
}> {
  const { apiKey, messages, modelId, controller, encoder, includeTools } = params;

  const rawStream = await chatCompletion({
    apiKey,
    messages,
    model: modelId,
    tools: includeTools ? [...entityTools, ...canvasTools] : undefined,
    stream: true,
  });

  const parsedStream = parseSSEStream(rawStream);
  const reader = parsedStream.getReader();

  let accumulatedContent = "";
  const accumulatedToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
  let usage: { prompt_tokens: number; completion_tokens: number } | null = null;
  let costUsd = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = value as StreamChunk;
    const choice = chunk.choices?.[0];

    if (choice?.delta?.content) {
      accumulatedContent += choice.delta.content;
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "text", content: choice.delta.content })}\n\n`)
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

  return { content: accumulatedContent, toolCalls: accumulatedToolCalls, usage, costUsd };
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

  let costUsd = 0;
  let usageTotal: { prompt_tokens: number; completion_tokens: number } | null = null;
  let currentMessages = messages;
  let anyToolCallsHappened = false;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const result = await runCompletionRound({
      apiKey,
      messages: currentMessages,
      modelId,
      controller,
      encoder,
      includeTools: round < MAX_TOOL_ROUNDS,
    });

    costUsd += result.costUsd;
    if (result.usage) {
      usageTotal = usageTotal
        ? {
            prompt_tokens: usageTotal.prompt_tokens + result.usage.prompt_tokens,
            completion_tokens: usageTotal.completion_tokens + result.usage.completion_tokens,
          }
        : result.usage;
    }

    if (result.toolCalls.size === 0) {
      // No further tool calls — this round's text (if any) is the final answer. If the model
      // ended the whole exchange with neither text nor a tool call, don't leave the user
      // staring at a blank message with no way to tell what happened.
      if (!result.content.trim()) {
        const message = anyToolCallsHappened
          ? "The AI used some tools but didn't send a final message afterward — check the tool results above for what changed, or ask it to continue."
          : "The AI didn't return a response. This can happen with some models — try resending, or switching models in the selector above.";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "notice", message })}\n\n`)
        );
      }
      break;
    }

    anyToolCallsHappened = true;

    const toolResults: Array<{ toolCallId: string; result: Record<string, unknown>; description: string }> = [];
    for (const [, tc] of result.toolCalls) {
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

      const toolResult = await executeToolCall(tc.name, args, projectId, userId);
      toolResults.push({ toolCallId: tc.id, result: toolResult.result, description: toolResult.description });

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "tool_call_result",
            tool_call_id: tc.id,
            name: tc.name,
            success: toolResult.success,
            result: toolResult.result,
            description: toolResult.description,
          })}\n\n`
        )
      );
    }

    // Circuit breaker. Tool results up to this point are already applied and streamed to the
    // client; what's skipped is only further rounds. Never truncates a generation in flight.
    if (usesCredits && costUsd >= MAX_COST_PER_MESSAGE_USD) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "notice",
            message: `This message reached the ${formatCredits(usdToCredits(MAX_COST_PER_MESSAGE_USD))} per-message ceiling. Changes made so far were applied, but the AI couldn't continue further. A smaller context or a cheaper model will avoid this.`,
          })}\n\n`
        )
      );
      break;
    }

    currentMessages = [
      ...currentMessages,
      {
        role: "assistant",
        content: result.content || null,
        tool_calls: Array.from(result.toolCalls.values()).map(
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
  }

  if (usageTotal) {
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ type: "usage", ...usageTotal, cost: costUsd })}\n\n`)
    );
  }

  return { costUsd };
}
