import { notFound, redirect } from "next/navigation";
import { ProjectProvider } from "@/contexts/project-context";
import { ProjectShell } from "./project-shell";
import { dbGetProject } from "@/lib/db/projects";
import { createClient } from "@/lib/supabase/server";
import { ensureInstructionsEntity, ensureLogsFolder, ensureProgressEntity } from "@/lib/db/entities";

export default async function ProjectLayout({
  params,
}: {
  params: Promise<{ projectId: string }>;
  children: React.ReactNode;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const userId = user.id;
  const project = await dbGetProject(projectId, userId);

  if (!project) {
    notFound();
  }

  await Promise.all([
    ensureInstructionsEntity(projectId, userId, project.system_instructions),
    ensureProgressEntity(projectId, userId),
    ensureLogsFolder(projectId, userId),
  ]);

  return (
    <ProjectProvider project={project}>
      <ProjectShell />
    </ProjectProvider>
  );
}
