"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 *
 * Renders the popover through a portal at a fixed, viewport-relative position (computed
 * from the trigger's bounding rect) rather than positioning it relative to its own DOM
 * parent — otherwise it gets clipped by any ancestor with overflow:auto/hidden, which a
 * small chat panel almost always has.
 */
export function GlossaryTerm({ children, definition, example, className }: GlossaryTermProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.top, left: rect.left + rect.width / 2 });
  }

  function hide() {
    setCoords(null);
  }

  return (
    <span
      ref={triggerRef}
      className={cn("border-b border-dotted border-muted-foreground/60 cursor-help", className)}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {coords &&
        createPortal(
          <span
            role="tooltip"
            className="fixed z-[100] w-56 -translate-x-1/2 -translate-y-full rounded-md border bg-popover p-2.5 text-xs font-normal normal-case text-popover-foreground shadow-md"
            style={{ top: coords.top - 6, left: coords.left }}
          >
            <span className="block">{definition}</span>
            {example && <span className="mt-1 block text-muted-foreground italic">{example}</span>}
          </span>,
          document.body
        )}
    </span>
  );
}
