import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { decryptApiKey } from "@/lib/encryption";
import { dbGetUserSettings } from "@/lib/db/user-settings";
import { syncEntityReferences } from "@/lib/db/entities";
import { chatCompletionJson } from "@/lib/openrouter/client";
import { entityTools, executeToolCall } from "@/lib/openrouter/tools";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ChatCompletionMessage } from "@/lib/openrouter/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { id: projectId } = await params;

  const { renamedEntityId, oldName, newName, entityType } = await request.json() as {
    renamedEntityId: string;
    oldName: string;
    newName: string;
    entityType: string;
  };

  if (!renamedEntityId || !oldName || !newName) {
    return NextResponse.json({ error: "renamedEntityId, oldName, and newName are required" }, { status: 400 });
  }

  const programmaticUpdates = await syncEntityReferences(projectId, userId, renamedEntityId, oldName, newName);

  let aiSummary: string | null = null;
  const settings = await dbGetUserSettings(userId);

  if (settings?.openrouter_api_key_encrypted && settings.preferred_model_id) {
    try {
      const apiKey = await decryptApiKey(settings.openrouter_api_key_encrypted);
      aiSummary = await runSemanticReferenceUpdate({
        apiKey,
        model: settings.preferred_model_id,
        projectId,
        userId,
        renamedEntityId,
        oldName,
        newName,
        entityType,
        programmaticUpdates,
      });
    } catch {
      aiSummary = null;
    }
  }

  return NextResponse.json({ programmaticUpdates, aiSummary });
}

async function runSemanticReferenceUpdate(params: {
  apiKey: string;
  model: string;
  projectId: string;
  userId: string;
  renamedEntityId: string;
  oldName: string;
  newName: string;
  entityType: string;
  programmaticUpdates: string[];
}): Promise<string> {
  const { apiKey, model, projectId, userId, renamedEntityId, oldName, newName, entityType, programmaticUpdates } = params;

  const { data: entityRows } = await getAdminClient()
    .from("entities")
    .select("id, name, type, parent_id")
    .eq("project_id", projectId);

  const rows = (entityRows ?? []) as { id: string; name: string; type: string; parent_id: string | null }[];
  const nameById = new Map(rows.map((e) => [e.id, e.name]));
  const indexLines = rows
    .filter((e) => e.id !== renamedEntityId)
    .map((e) => {
      const parentNote = e.parent_id ? `, in: ${nameById.get(e.parent_id) || "unknown"}` : "";
      return `- [${e.id}] ${e.name} (${e.type}${parentNote})`;
    });

  const alreadyUpdated = programmaticUpdates.length > 0
    ? `Exact text replacements already applied in: ${programmaticUpdates.join(", ")}.`
    : "No exact matches found in other files.";

  const systemPrompt = `You are performing a targeted reference-sync task — not a general writing assistant.

A ${entityType} was renamed from "${oldName}" to "${newName}".
${alreadyUpdated}

Your job: check remaining project files for CONTEXTUAL references that exact replacement would miss — for example, prose that describes "${oldName}" by description, indirect mentions, or places where the name is embedded in a sentence. Use read_entity to inspect files you're uncertain about, then update_entity only where needed. Do not re-apply changes already listed above.

When finished, respond with one brief sentence summarising what you changed, or confirm nothing more was needed. Do not explain your process.

## Project Files
${indexLines.join("\n")}`;

  const messages: ChatCompletionMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Please check for any remaining contextual references to "${oldName}" and update them to "${newName}".` },
  ];

  let loopMessages = [...messages];
  let finalSummary = "No contextual references found.";

  for (let i = 0; i < 5; i++) {
    const response = await chatCompletionJson({ apiKey, model, messages: loopMessages, tools: entityTools, maxTokens: 1024 });

    if (!response.toolCalls?.length) {
      finalSummary = response.content || finalSummary;
      break;
    }

    const toolResults: Array<{ toolCallId: string; result: Record<string, unknown> }> = [];
    for (const tc of response.toolCalls) {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }
      const result = await executeToolCall(tc.function.name, args, projectId, userId);
      toolResults.push({ toolCallId: tc.id, result: result.result });
    }

    loopMessages = [
      ...loopMessages,
      {
        role: "assistant",
        content: response.content || null,
        tool_calls: response.toolCalls,
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

  return finalSummary;
}
