"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, Loader2 } from "lucide-react";
import { exportAsMarkdown, exportAsPdf, exportAsDocx } from "@/lib/export";

interface ExportMenuProps {
  name: string;
  content: Record<string, unknown> | null;
}

type Format = "md" | "pdf" | "docx";

const OPTIONS: { format: Format; label: string; ext: string }[] = [
  { format: "md",   label: "Markdown",   ext: ".md"   },
  { format: "pdf",  label: "PDF",        ext: ".pdf"  },
  { format: "docx", label: "Word",       ext: ".docx" },
];

export function ExportMenu({ name, content }: ExportMenuProps) {
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
    setOpen(false);
    setLoading(true);
    try {
      if (format === "md")   exportAsMarkdown(name, content);
      if (format === "pdf")  exportAsPdf(name, content);
      if (format === "docx") await exportAsDocx(name, content);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Export"
        className="flex shrink-0 items-center gap-1 border-b border-l px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Download className="h-3 w-3" />
        )}
        <span>Export</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-0.5 w-44 overflow-hidden rounded-md border bg-popover shadow-md">
          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
            Download as…
          </div>
          {OPTIONS.map(({ format, label, ext }) => (
            <button
              key={format}
              className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-accent"
              onClick={() => run(format)}
            >
              <span>{label}</span>
              <span className="text-muted-foreground">{ext}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
