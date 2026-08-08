import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbGetCanvases, dbCreateCanvas } from "@/lib/db/canvas";

export async function GET(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  const canvases = await dbGetCanvases(projectId);
  return NextResponse.json({ canvases });
}

export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { project_id, name } = await request.json();

  if (!project_id || !name || typeof name !== "string") {
    return NextResponse.json({ error: "project_id and name are required" }, { status: 400 });
  }

  const canvas = await dbCreateCanvas(project_id, userId, name);
  return NextResponse.json({ canvas }, { status: 201 });
}
