"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Check, X } from "lucide-react";
import { consumeStoredVerifier } from "@/lib/openrouter-oauth";

function OpenRouterCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"working" | "success" | "error">("working");
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setStatus("error");
      setError("OpenRouter didn't return an authorization code — the connection may have been denied or cancelled.");
      return;
    }

    const verifier = consumeStoredVerifier();
    if (!verifier) {
      setStatus("error");
      setError("Couldn't find the connection request that started this — try connecting again from Settings.");
      return;
    }

    fetch("/api/settings/api-key/oauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: verifier }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Server returned ${res.status}`);
        }
        setStatus("success");
        setTimeout(() => router.replace("/settings"), 1200);
      })
      .catch((err) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to connect OpenRouter account");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-16 text-center">
      {status === "working" && (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Connecting your OpenRouter account…</p>
        </>
      )}
      {status === "success" && (
        <>
          <Check className="h-8 w-8 text-green-600" />
          <p className="text-sm">Connected. Taking you back to Settings…</p>
        </>
      )}
      {status === "error" && (
        <>
          <X className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button
            className="text-sm text-primary underline"
            onClick={() => router.replace("/settings")}
          >
            Back to Settings
          </button>
        </>
      )}
    </div>
  );
}

export default function OpenRouterCallbackPage() {
  return (
    <Suspense>
      <OpenRouterCallbackInner />
    </Suspense>
  );
}
