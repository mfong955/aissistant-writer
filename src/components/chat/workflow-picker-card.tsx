"use client";

import { useState } from "react";
import { Compass } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GlossaryTerm } from "@/components/ui/glossary-term";
import { WORKFLOWS, defaultWorkflowKey, type WorkflowKey } from "@/lib/onboarding";
import type { Project } from "@/types/database";

interface WorkflowPickerCardProps {
  project: Project;
  onChoose: (key: WorkflowKey | null) => void;
}

export function WorkflowPickerCard({ project, onChoose }: WorkflowPickerCardProps) {
  const [saving, setSaving] = useState<WorkflowKey | null | "pending">(null);
  const settings = (project.settings ?? {}) as { entryPoint?: string };
  const recommended = defaultWorkflowKey(settings.entryPoint as "nothing" | "seed" | "pile" | undefined);

  async function choose(key: WorkflowKey | null) {
    setSaving(key ?? "pending");
    await onChoose(key);
  }

  return (
    <div className="flex h-full items-center justify-center overflow-auto p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5" />
            How do you want to start?
          </CardTitle>
          <CardDescription>
            Totally optional, and never permanent — you can switch or drop this anytime from the
            &ldquo;Workflow&rdquo; button above the chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {WORKFLOWS.map((wf) => (
            <button
              key={wf.key}
              type="button"
              disabled={saving !== null}
              onClick={() => choose(wf.key)}
              className="relative w-full rounded-lg border px-3.5 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-60"
            >
              {wf.key === recommended && (
                <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Suggested
                </span>
              )}
              <p className="text-sm font-medium">
                {wf.key === "beat_sheet" ? (
                  <>
                    <GlossaryTerm
                      definition="A scene-by-scene skeleton of your story's major turning points, mapped out before you draft."
                      example="e.g. Save the Cat's 15-beat structure — opening image, inciting incident, midpoint, all-is-lost, finale."
                    >
                      Beat sheet
                    </GlossaryTerm>{" "}
                    first
                  </>
                ) : (
                  wf.title
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">Best for:</span> {wf.bestFor}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">Where it breaks:</span> {wf.whereItBreaks}
              </p>
            </button>
          ))}

          <div className="pt-1 text-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving !== null}
              onClick={() => choose(null)}
            >
              {saving === "pending" ? "One sec…" : "Not sure — skip this"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
