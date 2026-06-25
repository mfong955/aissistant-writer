import { dbGetUserSettings } from "@/lib/db/user-settings";
import { decryptApiKey } from "@/lib/encryption";

export async function generateEntitySummary(params: {
  entityId: string;
  projectId: string;
  userId: string;
  entityName: string;
  entityType: string;
  content: string;
}): Promise<string> {
  const settings = await dbGetUserSettings(params.userId);

  if (!settings?.openrouter_api_key_encrypted) {
    throw new Error("No API key configured");
  }

  const apiKey = await decryptApiKey(settings.openrouter_api_key_encrypted);
  const model = settings.preferred_model_id || "openai/gpt-4o-mini";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://aissistant-writer.app",
      "X-Title": "Aissistant Writer",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a summarization assistant. Create a concise summary (200-500 words) of the following content. Focus on key facts, traits, events, and relationships that would be relevant for maintaining story consistency. Be factual and specific.",
        },
        {
          role: "user",
          content: `Summarize this ${params.entityType} named "${params.entityName}":\n\n${params.content}`,
        },
      ],
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`Summary generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  return (data.choices[0]?.message?.content as string) || "No summary generated.";
}

export async function generateProjectState(params: {
  projectId: string;
  userId: string;
  projectName: string;
  entitySummaries: Array<{ name: string; type: string; summary: string }>;
}): Promise<string> {
  const settings = await dbGetUserSettings(params.userId);

  if (!settings?.openrouter_api_key_encrypted) {
    throw new Error("No API key configured");
  }

  const apiKey = await decryptApiKey(settings.openrouter_api_key_encrypted);
  const model = settings.preferred_model_id || "openai/gpt-4o-mini";

  const entityList = params.entitySummaries
    .map((s) => `- ${s.name} (${s.type}): ${s.summary}`)
    .join("\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://aissistant-writer.app",
      "X-Title": "Aissistant Writer",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a project summarization assistant. Create a compressed overview of the writing project that captures all essential information an AI would need to understand the project context. Include: all character names with brief descriptions, current plot progress, active plot threads, key settings, and notable relationships.",
        },
        {
          role: "user",
          content: `Create a project state overview for "${params.projectName}":\n\n${entityList}`,
        },
      ],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Project state generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  return (data.choices[0]?.message?.content as string) || "No project state generated.";
}
