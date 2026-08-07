"use client";

import { ENTRY_POINTS, type EntryPoint } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";

interface EntryPointDialogProps {
  onSelect: (entryPoint: EntryPoint) => void;
  onCancel: () => void;
}

export function EntryPointDialog({ onSelect, onCancel }: EntryPointDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold">What do you have?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No wrong answer — this just helps us meet you where you are. You can always start writing before anything else is decided.
        </p>
        <div className="mt-4 space-y-2">
          {ENTRY_POINTS.map((ep) => (
            <button
              key={ep.key}
              type="button"
              onClick={() => onSelect(ep.key)}
              className="w-full rounded-lg border px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
            >
              <p className="font-medium">{ep.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{ep.description}</p>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
