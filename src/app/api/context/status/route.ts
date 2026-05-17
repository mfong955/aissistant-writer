import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/database";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const db = getDb();

  const entities = db
    .prepare("SELECT id, name, version_hash FROM entities WHERE project_id = ? AND type != 'folder'")
    .all(projectId) as { id: string; name: string; version_hash: string | null }[];

  const summaries = db
    .prepare("SELECT entity_id, version_hash FROM entity_summaries WHERE project_id = ?")
    .all(projectId) as { entity_id: string; version_hash: string | null }[];

  const summaryMap = new Map(summaries.map((s) => [s.entity_id, s.version_hash]));

  const staleSummaries = entities
    .filter((entity) => {
      const summaryHash = summaryMap.get(entity.id);
      if (!summaryHash) return true;
      return entity.version_hash !== summaryHash;
    })
    .map((entity) => ({
      entityId: entity.id,
      entityName: entity.name,
      reason: summaryMap.has(entity.id) ? "outdated" : "missing",
    }));

  return NextResponse.json({
    staleSummaries,
    totalEntities: entities.length,
    totalSummaries: summaries.length,
  });
}
