"use client";

import { useState } from "react";
import { Check, Loader2, Zap, X } from "lucide-react";
import { CREDIT_PACKS } from "@/lib/stripe";
import { Button } from "@/components/ui/button";

interface Props {
  onClose: () => void;
}

export function PurchaseDialog({ onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    if (!selected) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: selected }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Failed to create checkout session");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Buy AI credits</h2>
            <p className="text-sm text-muted-foreground">1 credit = 1 AI message</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => setSelected(pack.id)}
              className={`relative w-full rounded-xl border p-4 text-left transition-all ${
                selected === pack.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              {pack.popular && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                  Popular
                </span>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      selected === pack.id ? "bg-primary/10" : "bg-muted"
                    }`}
                  >
                    <Zap
                      className={`h-4 w-4 ${selected === pack.id ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </div>
                  <div>
                    <p className="font-medium">{pack.name}</p>
                    <p className="text-sm text-muted-foreground">{pack.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold">{pack.priceLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      ${(pack.priceCents / pack.credits / 100).toFixed(3)}/msg
                    </p>
                  </div>
                  {selected === pack.id && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleBuy}
            disabled={!selected || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting…
              </>
            ) : (
              "Continue to payment"
            )}
          </Button>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Secure payment via Stripe. Credits are non-refundable.
        </p>
      </div>
    </div>
  );
}
