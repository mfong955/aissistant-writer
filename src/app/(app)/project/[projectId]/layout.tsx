import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProjectProvider } from "@/contexts/project-context";
import { ProjectShell } from "./project-shell";

export default async function ProjectLayout({
  params,
}: {
  params: Promise<{ projectId: string }>;
  children: React.ReactNode;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    notFound();
  }

  return (
    <ProjectProvider project={project}>
      <ProjectShell />
    </ProjectProvider>
  );
}
