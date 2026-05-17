import { notFound } from "next/navigation";
import { ProjectProvider } from "@/contexts/project-context";
import { ProjectShell } from "./project-shell";
import { dbGetProject } from "@/lib/db/projects";
import { getLocalUserId } from "@/lib/local-user";
import { ensureInstructionsEntity, ensureLogsFolder, ensureProgressEntity } from "@/lib/db/entities";

export default async function ProjectLayout({
  params,
}: {
  params: Promise<{ projectId: string }>;
  children: React.ReactNode;
}) {
  const { projectId } = await params;
  const userId = getLocalUserId();
  const project = dbGetProject(projectId, userId);

  if (!project) {
    notFound();
  }

  // Ensure every project has its AI Instructions file and Logs folder
  ensureInstructionsEntity(projectId, userId, project.system_instructions);
  ensureProgressEntity(projectId, userId);
  ensureLogsFolder(projectId, userId);

  return (
    <ProjectProvider project={project}>
      <ProjectShell />
    </ProjectProvider>
  );
}
