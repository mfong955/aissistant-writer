"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Zap, Plus, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PurchaseDialog } from "./purchase-dialog";
import type { CreditTransaction } from "@/lib/db/billing";

export function BillingCard() {
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [showPurchase, setShowPurchase] = useState(false);
  const [notification, setNotification] = useState<{ text: string; kind: "ok" | "info" } | null>(null);

  useEffect(() => {
    const billing = searchParams.get("billing");
    if (billing === "success") {
      setNotification({ text: "Payment successful! Credits have been added to your account.", kind: "ok" });
      // Clean the URL without full navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("billing");
      url.searchParams.delete("pack");
      window.history.replaceState({}, "", url.toString());
    } else if (billing === "cancelled") {
      setNotification({ text: "Payment cancelled.", kind: "info" });
      const url = new URL(window.location.href);
      url.searchParams.delete("billing");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  const fetchData = async () => {
    const [balanceData, txData] = await Promise.all([
      fetch("/api/billing/balance").then((r) => r.json()) as Promise<{ balance: number }>,
      fetch("/api/billing/transactions").then((r) => r.json()) as Promise<{ transactions: CreditTransaction[] }>,
    ]);
    setBalance(balanceData.balance);
    setTransactions(txData.transactions);
    return balanceData.balance;
  };

  useEffect(() => {
    const billing = searchParams.get("billing");

    if (billing === "success") {
      // Fetch immediately, then once more after 3 s to catch a slow webhook.
      fetchData().then((initialBalance) => {
        const timer = setTimeout(async () => {
          const updated = await fetchData();
          // If balance still hasn't moved after the delay, try once more at 7 s.
          if (updated === initialBalance) {
            setTimeout(fetchData, 4000);
          }
        }, 3000);
        return () => clearTimeout(timer);
      });
    } else {
      fetchData();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            AI Credits
          </CardTitle>
          <CardDescription>
            Credits are used when you chat without a personal OpenRouter API key.
            1 credit = 1 AI message.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notification && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                notification.kind === "ok"
                  ? "border border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {notification.text}
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
            <div>
              <p className="text-sm text-muted-foreground">Current balance</p>
              <p className="text-3xl font-bold">
                {balance === null ? "—" : balance}
              </p>
              <p className="text-xs text-muted-foreground">credits remaining</p>
            </div>
            <Button onClick={() => setShowPurchase(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Buy credits
            </Button>
          </div>

          {transactions.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Recent transactions</h3>
              <div className="space-y-1">
                {transactions.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg p-2 hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      {tx.amount > 0 ? (
                        <TrendingUp className="h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="text-sm">{tx.description ?? tx.type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span
                        className={tx.amount > 0 ? "font-medium text-green-600" : "text-muted-foreground"}
                      >
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(tx.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showPurchase && <PurchaseDialog onClose={() => setShowPurchase(false)} />}
    </>
  );
}
