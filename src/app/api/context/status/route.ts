import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json(
      { error: "project_id is required" },
      { status: 400 }
    );
  }

  // Fetch all non-folder entities
  const { data: entities } = await supabase
    .from("entities")
    .select("id, name, version_hash")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .neq("type", "folder");

  // Fetch existing summaries
  const { data: summaries } = await supabase
    .from("entity_summaries")
    .select("entity_id, version_hash")
    .eq("project_id", projectId);

  const summaryMap = new Map(
    (summaries || []).map((s) => [s.entity_id, s.version_hash])
  );

  const staleSummaries = (entities || [])
    .filter((entity) => {
      const summaryHash = summaryMap.get(entity.id);
      if (!summaryHash) return true; // Missing summary
      return entity.version_hash !== summaryHash; // Outdated
    })
    .map((entity) => ({
      entityId: entity.id,
      entityName: entity.name,
      reason: summaryMap.has(entity.id) ? "outdated" : "missing",
    }));

  return NextResponse.json({
    staleSummaries,
    totalEntities: (entities || []).length,
    totalSummaries: (summaries || []).length,
  });
}
