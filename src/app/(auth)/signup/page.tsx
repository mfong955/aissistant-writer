"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenLine, Eye, EyeOff, Chrome } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const router = useRouter();

  const supabase = createClient();

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setMessage({ text: "Password must be at least 8 characters.", kind: "err" });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMessage({ text: error.message, kind: "err" });
    } else {
      setMessage({ text: `Check ${email} to confirm your account, then sign in.`, kind: "ok" });
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
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Start writing with AI assistance</p>
      </div>

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

      <form onSubmit={handleSignUp} className="space-y-4">
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
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
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
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
