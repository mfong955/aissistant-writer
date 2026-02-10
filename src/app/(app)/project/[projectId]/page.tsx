"use client";

import { PenLine } from "lucide-react";

export default function ProjectPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
      <PenLine className="h-12 w-12 opacity-30" />
      <p className="mt-4">Select an entity from the explorer to start writing</p>
    </div>
  );
}
