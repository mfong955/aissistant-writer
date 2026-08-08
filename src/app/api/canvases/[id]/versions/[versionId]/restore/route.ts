import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbRestoreCanvasVersion } from "@/lib/db/canvas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { id, versionId } = await params;
  const { project_id } = await request.json();
  if (!project_id) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  try {
    const canvas = await dbRestoreCanvasVersion(id, project_id, userId, versionId);
    return NextResponse.json({ canvas });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Restore failed" },
      { status: 400 }
    );
  }
}
