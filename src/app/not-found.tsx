import Link from "next/link";
import { PenLine } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <PenLine className="h-10 w-10 text-primary/40" />
      <h1 className="mt-6 text-5xl font-bold tracking-tight">404</h1>
      <p className="mt-3 text-muted-foreground">This page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-9 items-center rounded-lg border border-border bg-background px-4 text-sm transition-colors hover:bg-accent"
      >
        Go home
      </Link>
    </div>
  );
}
