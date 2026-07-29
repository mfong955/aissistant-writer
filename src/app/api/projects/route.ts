import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbGetProjects, dbCreateProject } from "@/lib/db/projects";
import { ensureExplorerRoots } from "@/lib/db/entities";

export async function GET() {
  try {
    const userIdOrError = await getUserId();
    if (userIdOrError instanceof NextResponse) return userIdOrError;
    const userId = userIdOrError;
    const projects = await dbGetProjects(userId);
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return NextResponse.json({ error: String(err), projects: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;
  const { name, description, project_type } = await request.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const project = await dbCreateProject(userId, name, description ?? null, project_type ?? null);
  await ensureExplorerRoots(project.id, userId, project.project_type);
  return NextResponse.json({ project }, { status: 201 });
}
