"use client";

import { Loader2, RotateCcw, Maximize2, Minimize2, Wand2, SpellCheck } from "lucide-react";

export type AIAction = "continue" | "rewrite" | "expand" | "shorten" | "fix";

const ACTIONS: { id: AIAction; label: string; icon: React.ElementType; title: string }[] = [
  { id: "continue", label: "Continue", icon: Wand2, title: "Continue writing after this passage" },
  { id: "rewrite", label: "Rewrite", icon: RotateCcw, title: "Rewrite to improve flow and clarity" },
  { id: "expand", label: "Expand", icon: Maximize2, title: "Expand with more detail and description" },
  { id: "shorten", label: "Shorten", icon: Minimize2, title: "Shorten by about half" },
  { id: "fix", label: "Fix", icon: SpellCheck, title: "Fix grammar and spelling" },
];

interface AIToolbarProps {
  x: number;
  y: number;
  onAction: (action: AIAction) => void;
  status: "idle" | "loading";
}

export function AIToolbar({ x, y, onAction, status }: AIToolbarProps) {
  const safeX =
    typeof window !== "undefined" ? Math.min(x, window.innerWidth - 340) : x;

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border border-border bg-background/95 p-1 shadow-xl backdrop-blur-sm"
      style={{
        left: safeX,
        top: y - 8,
        transform: "translateY(-100%)",
      }}
      // Prevent mousedown from stealing focus and clearing textarea selection
      onMouseDown={(e) => e.preventDefault()}
    >
      {status === "loading" ? (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Writing…</span>
        </div>
      ) : (
        <>
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              title={action.title}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <action.icon className="h-3 w-3" />
              {action.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
