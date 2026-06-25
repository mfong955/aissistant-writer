import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const supabase = getAdminClient();

  const [{ data: entities }, { data: summaries }] = await Promise.all([
    supabase
      .from("entities")
      .select("id, name, version_hash")
      .eq("project_id", projectId)
      .neq("type", "folder"),
    supabase
      .from("entity_summaries")
      .select("entity_id, version_hash")
      .eq("project_id", projectId),
  ]);

  const summaryMap = new Map(
    (summaries ?? []).map((s) => {
      const row = s as { entity_id: string; version_hash: string | null };
      return [row.entity_id, row.version_hash];
    })
  );

  type EntityRow = { id: string; name: string; version_hash: string | null };
  const staleSummaries = ((entities ?? []) as EntityRow[]).filter((entity) => {
    const summaryHash = summaryMap.get(entity.id);
    if (!summaryHash) return true;
    return entity.version_hash !== summaryHash;
  }).map((entity) => ({
    entityId: entity.id,
    entityName: entity.name,
    reason: summaryMap.has(entity.id) ? "outdated" : "missing",
  }));

  return NextResponse.json({
    staleSummaries,
    totalEntities: (entities ?? []).length,
    totalSummaries: (summaries ?? []).length,
  });
}
