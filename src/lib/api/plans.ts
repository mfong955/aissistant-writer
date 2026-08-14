import type { PlanItemUI } from "@/hooks/use-chat";

export interface ApplyPlanResult {
  id: string;
  success: boolean;
  entity_id?: string;
  error?: string;
}

export async function applyPlan(
  projectId: string,
  items: PlanItemUI[]
): Promise<{ results: ApplyPlanResult[] }> {
  const res = await fetch("/api/plans/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, items }),
  });
  return (await res.json()) as { results: ApplyPlanResult[] };
}
