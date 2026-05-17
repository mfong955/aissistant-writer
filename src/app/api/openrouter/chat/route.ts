import { getLocalUserId } from "@/lib/local-user";
import { decryptApiKey } from "@/lib/encryption";
import { chatCompletion, parseSSEStream } from "@/lib/openrouter/client";
import { entityTools, executeToolCall } from "@/lib/openrouter/tools";
import { buildContext } from "@/lib/context/context-builder";
import { dbGetUserSettings } from "@/lib/db/user-settings";
import type { ChatCompletionMessage, StreamChunk, ToolCallResponse } from "@/lib/openrouter/types";

export async function POST(request: Request) {
  const userId = getLocalUserId();

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

  const settings = dbGetUserSettings(userId);
  if (!settings?.openrouter_api_key_encrypted) {
    return new Response(JSON.stringify({ error: "No API key configured" }), { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = await decryptApiKey(settings.openrouter_api_key_encrypted);
  } catch {
    return new Response(JSON.stringify({ error: "Failed to decrypt API key" }), { status: 500 });
  }

  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  const contextResult = await buildContext({
    projectId: project_id,
    userId,
    userMessage: lastUserMessage?.content || "",
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
        await processChat({
          apiKey,
          messages: fullMessages,
          modelId: model_id,
          projectId: project_id,
          userId,
          controller,
          encoder,
        });
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
}) {
  const { apiKey, messages, modelId, projectId, userId, controller, encoder } = params;

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
      }
    }
  }

  if (usage) {
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ type: "usage", ...usage })}\n\n`)
    );
  }
}
