"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PenLine, Mail, Eye, EyeOff, Chrome } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "password" | "magic-link";

function UrlError() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  if (!urlError) return null;
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {urlError}
    </div>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const router = useRouter();

  const supabase = createClient();

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage({ text: error.message, kind: "err" });
    } else {
      router.push("/projects");
      router.refresh();
    }
    setLoading(false);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMessage({ text: error.message, kind: "err" });
    } else {
      setMessage({ text: `Check ${email} — a sign-in link is on its way.`, kind: "ok" });
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Brand */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <PenLine className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to Aissistant Writer</p>
      </div>

      {/* URL error (e.g. from OAuth failure) */}
      <Suspense>
        <UrlError />
      </Suspense>

      {/* Inline message */}
      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${message.kind === "ok" ? "border border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200" : "border border-destructive/40 bg-destructive/5 text-destructive"}`}>
          {message.text}
        </div>
      )}

      {/* Google */}
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        <Chrome className="h-4 w-4" />
        {googleLoading ? "Redirecting…" : "Continue with Google"}
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Email / password form */}
      {mode === "password" ? (
        <form onSubmit={handlePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <button
            type="button"
            onClick={() => { setMode("magic-link"); setMessage(null); }}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            <Mail className="mr-1 inline h-3 w-3" />
            Use a magic link instead
          </button>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-magic">Email</Label>
            <Input
              id="email-magic"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send magic link"}
          </Button>
          <button
            type="button"
            onClick={() => { setMode("password"); setMessage(null); }}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Use password instead
          </button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
