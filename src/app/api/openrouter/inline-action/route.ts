import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbGetUserSettings } from "@/lib/db/user-settings";
import { decryptApiKey } from "@/lib/encryption";
import { dbDeductCredit } from "@/lib/db/billing";
import { buildContext } from "@/lib/context/context-builder";
import { chatCompletion, parseSSEStream } from "@/lib/openrouter/client";
import type { ChatCompletionMessage, StreamChunk } from "@/lib/openrouter/types";

type InlineAction = "continue" | "rewrite" | "expand" | "shorten" | "fix";

const ACTION_PROMPTS: Record<InlineAction, (selected: string, before: string) => string> = {
  continue: (selected, before) =>
    `Continue writing directly after this passage. Match the style, voice, and point of view exactly. Output only the continuation — no preamble:\n\n${before.slice(-800)}${selected}`,
  rewrite: (selected) =>
    `Rewrite this passage to improve clarity, flow, and prose quality. Preserve the exact meaning and voice. Output only the rewritten passage:\n\n${selected}`,
  expand: (selected) =>
    `Expand this passage with more detail, emotion, and sensory description. Output only the expanded version:\n\n${selected}`,
  shorten: (selected) =>
    `Shorten this passage by about half while keeping the essential content and voice. Output only the shortened version:\n\n${selected}`,
  fix: (selected) =>
    `Fix any grammar, spelling, and punctuation errors. Do not change word choice or style. Output only the corrected text:\n\n${selected}`,
};

export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;

  const { action, selectedText, beforeText, projectId, modelId } = await request.json() as {
    action: InlineAction;
    selectedText: string;
    beforeText: string;
    projectId: string;
    modelId: string;
  };

  if (!action || !selectedText?.trim() || !projectId || !modelId) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
  }

  if (!ACTION_PROMPTS[action]) {
    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
  }

  // Resolve API key — same BYOK / credits logic as chat route
  const settings = await dbGetUserSettings(userId);
  let apiKey: string;

  if (settings?.openrouter_api_key_encrypted) {
    try {
      apiKey = await decryptApiKey(settings.openrouter_api_key_encrypted);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to decrypt API key" }), { status: 500 });
    }
  } else {
    const systemKey = process.env.OPENROUTER_SYSTEM_API_KEY;
    if (!systemKey) {
      return new Response(JSON.stringify({ error: "No API key configured" }), { status: 400 });
    }
    const deducted = await dbDeductCredit(userId);
    if (!deducted) {
      return new Response(
        JSON.stringify({ error: "insufficient_credits", message: "Out of AI credits. Buy more in Settings." }),
        { status: 402 }
      );
    }
    apiKey = systemKey;
  }

  // Build project context — use selected text as the query for relevance scoring
  const contextResult = await buildContext({
    projectId,
    userId,
    userMessage: selectedText,
    activeEntityIds: [],
    contextLimit: 32000,
  });

  const systemPrompt = `${contextResult.systemPrompt}

You are an inline writing assistant embedded in a text editor. When asked to perform a writing action, respond with ONLY the resulting text — no preamble, no explanation, no "Here is the rewritten version:", no quotes around the output. Just the text itself, ready to drop into the manuscript.`;

  const messages: ChatCompletionMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: ACTION_PROMPTS[action](selectedText, beforeText) },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const rawStream = await chatCompletion({
          apiKey,
          messages,
          model: modelId,
          stream: true,
        });

        const parsedStream = parseSSEStream(rawStream);
        const reader = parsedStream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = value as StreamChunk;
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
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
