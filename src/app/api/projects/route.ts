import { NextResponse } from "next/server";
import { getLocalUserId } from "@/lib/local-user";
import { dbGetProjects, dbCreateProject } from "@/lib/db/projects";
import { initProjectFolders } from "@/lib/db/entities";

export async function GET() {
  const userId = getLocalUserId();
  const projects = dbGetProjects(userId);
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const userId = getLocalUserId();
  const { name, description, project_type } = await request.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const project = dbCreateProject(userId, name, description ?? null, project_type ?? null);
  if (project_type) {
    initProjectFolders(project.id, userId, project.project_type);
  }
  return NextResponse.json({ project }, { status: 201 });
}
