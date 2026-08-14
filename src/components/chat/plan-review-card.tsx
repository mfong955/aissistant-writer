"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, ListChecks, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyPlan } from "@/lib/api/plans";
import type { PlanUI } from "@/hooks/use-chat";

interface PlanReviewCardProps {
  plan: PlanUI;
  projectId: string;
  onApplied: (message: string) => void;
}

const SOURCE_LABEL: Record<string, string> = {
  canvas: "from canvas",
  import: "from import",
  consistency: "consistency check",
};

export function PlanReviewCard({ plan, projectId, onApplied }: PlanReviewCardProps) {
  const applicableItems = plan.items.filter((i) => i.action !== "flag");
  const flaggedItems = plan.items.filter((i) => i.action === "flag");

  const [checked, setChecked] = useState<Set<string>>(new Set(applicableItems.map((i) => i.id)));
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleApply() {
    const selected = applicableItems
      .filter((i) => checked.has(i.id))
      .map((i) => ({ ...i, content: edited[i.id] ?? i.content ?? "" }));
    if (selected.length === 0) return;

    setApplying(true);
    const { results } = await applyPlan(projectId, selected);
    setApplying(false);
    setApplied(true);

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.length - succeeded;
    onApplied(
      failed > 0
        ? `Applied ${succeeded} of ${results.length} item(s) from the plan — ${failed} failed.`
        : `Applied ${succeeded} item(s) from the plan to the project.`
    );
  }

  if (applied) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
        <Check className="h-3.5 w-3.5 shrink-0" />
        <span>Applied — see the confirmation below.</span>
      </div>
    );
  }

  return (
    <div className="max-w-md rounded-lg border">
      <div className="flex items-center gap-1.5 border-b px-3 py-2">
        <ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-medium uppercase text-muted-foreground">
          Plan — {SOURCE_LABEL[plan.source] ?? plan.source}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <p className="text-sm">{plan.summary}</p>
        <p className="text-[11px] text-muted-foreground">
          Nothing here has been written to your project yet — review each item, then apply what looks right.
        </p>

        {applicableItems.length > 0 && (
          <>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className="text-primary underline"
                onClick={() => setChecked(new Set(applicableItems.map((i) => i.id)))}
              >
                Select all
              </button>
              <span className="text-muted-foreground">·</span>
              <button type="button" className="text-primary underline" onClick={() => setChecked(new Set())}>
                Deselect all
              </button>
            </div>

            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {applicableItems.map((item) => (
                <div key={item.id} className="rounded-md border px-2.5 py-2 text-xs">
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      checked={checked.has(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">
                          {item.action === "create" ? item.name || "Untitled" : "Update existing entity"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {item.action === "create"
                            ? `${item.type ?? "entity"} → ${item.root ?? "?"}${item.path ? "/" + item.path : ""}`
                            : "content change"}
                        </span>
                      </div>
                      {item.reason && <p className="mt-0.5 text-muted-foreground">{item.reason}</p>}
                      {item.established_fact && (
                        <p className="mt-0.5 text-muted-foreground">
                          <span className="font-medium text-foreground/70">Established:</span> {item.established_fact}
                        </p>
                      )}
                      <button
                        type="button"
                        className="mt-1 flex items-center gap-0.5 text-[10px] text-primary"
                        onClick={(e) => {
                          e.preventDefault();
                          setExpandedId((v) => (v === item.id ? null : item.id));
                        }}
                      >
                        {expandedId === item.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {expandedId === item.id ? "Hide content" : "Preview / edit content"}
                      </button>
                      {expandedId === item.id && (
                        <textarea
                          className="mt-1 w-full resize-none rounded border bg-background p-1.5 text-xs"
                          rows={5}
                          value={edited[item.id] ?? item.content ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEdited((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        />
                      )}
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <Button size="sm" className="w-full" disabled={applying || checked.size === 0} onClick={handleApply}>
              {applying ? "Applying…" : `Apply ${checked.size} selected`}
            </Button>
          </>
        )}

        {/* Flagged findings — informational only, nothing to apply (docs/consistency-checking.md §1) */}
        {flaggedItems.length > 0 && (
          <div className="space-y-1.5 border-t pt-2">
            <p className="text-[10px] font-medium uppercase text-muted-foreground">
              Flagged — no confident fix, worth a look
            </p>
            {flaggedItems.map((item) => (
              <div key={item.id} className="flex items-start gap-1.5 rounded-md border border-dashed px-2.5 py-2 text-xs">
                <Flag className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p>{item.reason}</p>
                  {item.quote && <p className="mt-0.5 italic text-muted-foreground">&ldquo;{item.quote}&rdquo;</p>}
                  {item.established_fact && (
                    <p className="mt-0.5 text-muted-foreground">
                      <span className="font-medium text-foreground/70">Established:</span> {item.established_fact}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
