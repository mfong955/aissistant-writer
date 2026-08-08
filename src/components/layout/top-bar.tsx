"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenLine, Settings, SlidersHorizontal, ChevronLeft, Focus, Search, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProject } from "@/contexts/project-context";
import { ProjectSettingsDialog } from "@/components/project/project-settings-dialog";
import { ProjectExportMenu } from "@/components/project/project-export-menu";

export type ProjectMode = "explorer" | "canvas";

interface TopBarProps {
  mode: ProjectMode;
  onModeChange: (mode: ProjectMode) => void;
}

export function TopBar({ mode, onModeChange }: TopBarProps) {
  const { project } = useProject();
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={() => router.push("/projects")} title="Back to projects">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2">
        <PenLine className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{project?.name}</span>
      </div>
      <div className="flex items-center rounded-md border p-0.5 text-xs">
        <button
          onClick={() => onModeChange("explorer")}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 transition-colors",
            mode === "explorer" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <PenLine className="h-3 w-3" /> Explorer
        </button>
        <button
          onClick={() => onModeChange("canvas")}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 transition-colors",
            mode === "canvas" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Workflow className="h-3 w-3" /> Canvas
        </button>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost" size="sm"
          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hidden sm:flex"
          title="Search (⌘K)"
          onClick={() => window.dispatchEvent(new CustomEvent("aissistant:open-search"))}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
          <kbd className="ml-1 rounded border bg-muted px-1 py-0.5 font-sans text-[10px]">⌘K</kbd>
        </Button>
        <ProjectExportMenu />
        <Button
          variant="ghost" size="icon"
          title="Focus mode (Esc to exit)"
          onClick={() => window.dispatchEvent(new CustomEvent("aissistant:toggle-focus"))}
        >
          <Focus className="h-4 w-4" />
        </Button>
        <ProjectSettingsDialog>
          <Button variant="ghost" size="icon" title="Project settings">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </ProjectSettingsDialog>
        <Button variant="ghost" size="icon" asChild title="App settings">
          <Link href="/settings"><Settings className="h-4 w-4" /></Link>
        </Button>
      </div>
    </div>
  );
}
