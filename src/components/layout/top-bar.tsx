"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenLine, Settings, SlidersHorizontal, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/project-context";
import { ProjectSettingsDialog } from "@/components/project/project-settings-dialog";

export function TopBar() {
  const { project } = useProject();
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => router.push("/")}
        title="Back to projects"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2">
        <PenLine className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{project?.name}</span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ProjectSettingsDialog>
          <Button variant="ghost" size="icon" title="Project settings">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </ProjectSettingsDialog>
        <Button variant="ghost" size="icon" asChild title="App settings">
          <Link href="/settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
