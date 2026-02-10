export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string; // cost per token in USD
    completion: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
  };
}

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCallResponse[];
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCallResponse {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  tools?: ToolDefinition[];
  stream?: boolean;
  max_tokens?: number;
}

export interface StreamDelta {
  role?: string;
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

export interface StreamChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: StreamDelta;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface UsageData {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
}
