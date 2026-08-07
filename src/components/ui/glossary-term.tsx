"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface GlossaryTermProps {
  children: React.ReactNode;
  definition: string;
  example?: string;
  className?: string;
}

/**
 * A term with a dotted underline that reveals a definition on hover/focus. Costs nothing
 * for readers who already know the word — they just never trigger it — so it's the one
 * way to teach craft vocabulary to new writers without annoying veterans with unwanted
 * explanations.
 */
export function GlossaryTerm({ children, definition, example, className }: GlossaryTermProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-block border-b border-dotted border-muted-foreground/60 cursor-help", className)}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-md border bg-popover p-2.5 text-xs font-normal normal-case text-popover-foreground shadow-md"
        >
          <span className="block">{definition}</span>
          {example && <span className="mt-1 block text-muted-foreground italic">{example}</span>}
        </span>
      )}
    </span>
  );
}
