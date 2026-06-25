"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/project-context";
import { exportProjectAsZip, exportProjectAsPdf, exportProjectAsDocx } from "@/lib/export";

type Format = "zip" | "pdf" | "docx";

const OPTIONS: { format: Format; label: string; ext: string; description: string }[] = [
  { format: "zip",  label: "ZIP archive", ext: ".zip",  description: "All files as markdown" },
  { format: "pdf",  label: "PDF",         ext: ".pdf",  description: "All files combined" },
  { format: "docx", label: "Word",        ext: ".docx", description: "All files combined" },
];

export function ProjectExportMenu() {
  const { project, entities } = useProject();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function run(format: Format) {
    if (!project) return;
    setOpen(false);
    setLoading(true);
    try {
      if (format === "zip")  await exportProjectAsZip(project.name, entities);
      if (format === "pdf")  exportProjectAsPdf(project.name, entities);
      if (format === "docx") await exportProjectAsDocx(project.name, entities);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 px-2 text-xs"
        onClick={() => setOpen((v) => !v)}
        title="Export project"
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-md border bg-popover shadow-md">
          <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground">
            Export entire project as…
          </div>
          {OPTIONS.map(({ format, label, ext, description }) => (
            <button
              key={format}
              className="flex w-full flex-col px-3 py-2 text-left text-xs hover:bg-accent"
              onClick={() => run(format)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground">{ext}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
