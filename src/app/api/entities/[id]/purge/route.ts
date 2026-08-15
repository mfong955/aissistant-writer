import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { dbPurgeEntity } from "@/lib/db/entities";
import { getAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/get-user-id";
import type { Entity } from "@/types/database";

/**
 * Permanent removal — only reachable from the Attic (docs/attic.md §5), and only ever applied
 * to something already archived. File cleanup for image entities happens here, not at archive
 * time, so a restored image doesn't come back pointing at a deleted file.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const { data: entity } = await getAdminClient()
    .from("entities")
    .select("*")
    .eq("id", id)
    .eq("project_id", projectId)
    .not("archived_at", "is", null)
    .single() as unknown as { data: Entity | null; error: null };

  if (!entity) {
    return NextResponse.json({ error: "Not found in the Attic" }, { status: 404 });
  }

  if (entity.type === "image" && entity.content?.type === "image_file") {
    const url = entity.content.url as string;
    const filename = url.split("/").pop();
    if (filename) {
      const filePath = path.join(process.cwd(), ".data", "uploads", projectId, filename);
      await fs.unlink(filePath).catch(() => {});
    }
  }

  await dbPurgeEntity(id, projectId);
  return NextResponse.json({ ok: true });
}
