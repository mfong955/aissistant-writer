"use client";

import { BookOpen, Brain, Search, Cloud, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Brain,
    title: "AI Writing Assistant",
    desc: "Chat with an AI that knows your entire project — characters, plot, world-building and all.",
  },
  {
    icon: BookOpen,
    title: "Organized by entity",
    desc: "Chapters, characters, outlines, world-building — each in its own file with smart templates.",
  },
  {
    icon: Search,
    title: "Project-wide search",
    desc: "Find anything across all your files instantly with ⌘K.",
  },
  {
    icon: Cloud,
    title: "Cloud backup",
    desc: "End-to-end encrypted sync to the cloud. Your data stays yours.",
  },
  {
    icon: Download,
    title: "Export anywhere",
    desc: "Export your project as PDF, Word, or a ZIP of markdown files.",
  },
];

interface WelcomeModalProps {
  onGetStarted: () => void;
  onDismiss: () => void;
}

export function WelcomeModal({ onGetStarted, onDismiss }: WelcomeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-background p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <BookOpen className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Welcome to Aissistant Writer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your AI-powered writing studio for long-form projects.
          </p>
        </div>

        <div className="mb-6 space-y-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full" size="lg" onClick={onGetStarted}>
          Create my first project
        </Button>
        <button
          onClick={onDismiss}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
