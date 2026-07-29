import type {
  OpenRouterModel,
  ChatCompletionMessage,
  ChatCompletionRequest,
  ToolDefinition,
  StreamChunk,
  ToolCallResponse,
} from "./types";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export async function listModels(apiKey: string): Promise<OpenRouterModel[]> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data as OpenRouterModel[];
}

export async function chatCompletion(params: {
  apiKey: string;
  messages: ChatCompletionMessage[];
  model: string;
  tools?: ToolDefinition[];
  stream?: boolean;
  maxTokens?: number;
}): Promise<ReadableStream<Uint8Array>> {
  const body: ChatCompletionRequest = {
    model: params.model,
    messages: params.messages,
    stream: params.stream ?? true,
    max_tokens: params.maxTokens,
    usage: { include: true },
  };

  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools;
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://aissistant-writer.app",
      "X-Title": "Aissistant Writer",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${error}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  return response.body;
}

export async function chatCompletionJson(params: {
  apiKey: string;
  messages: ChatCompletionMessage[];
  model: string;
  tools?: ToolDefinition[];
  maxTokens?: number;
}): Promise<{ content: string | null; toolCalls?: ToolCallResponse[]; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const body: ChatCompletionRequest = {
    model: params.model,
    messages: params.messages,
    stream: false,
    max_tokens: params.maxTokens ?? 1024,
  };

  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools;
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://aissistant-writer.app",
      "X-Title": "Aissistant Writer",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string | null; tool_calls?: ToolCallResponse[] } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  const message = data.choices?.[0]?.message;
  return {
    content: message?.content ?? null,
    toolCalls: message?.tool_calls,
    usage: data.usage,
  };
}

export function parseSSEStream(
  stream: ReadableStream<Uint8Array>
): ReadableStream<StreamChunk> {
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream<StreamChunk>({
    async start(controller) {
      const reader = stream.getReader();
      try {
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
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const chunk = JSON.parse(data) as StreamChunk;
              controller.enqueue(chunk);
            } catch {
              // Skip malformed chunks
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
