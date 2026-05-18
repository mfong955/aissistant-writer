"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Key, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
export default function SettingsPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings/api-key")
      .then((r) => r.json())
      .then((data: { hasKey: boolean }) => setHasKey(data.hasKey));
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/settings/api-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey.trim() }),
    });

    if (res.ok) {
      setHasKey(true);
      setApiKey("");
      setMessage("API key saved successfully");
    } else {
      try {
        const data = await res.json();
        setMessage(`Error: ${data.error ?? "Unknown error"}`);
      } catch {
        setMessage(`Error: server returned ${res.status}`);
      }
    }
    setSaving(false);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);

    const res = await fetch("/api/openrouter/models");
    if (res.ok) {
      const data = await res.json();
      setTestResult("success");
      setMessage(`Connected. ${data.models?.length || 0} models available.`);
    } else {
      setTestResult("error");
      const data = await res.json();
      setMessage(`Test failed: ${data.error}`);
    }
    setTesting(false);
  }

  async function handleRemove() {
    if (!confirm("Remove your API key?")) return;
    const res = await fetch("/api/settings/api-key", { method: "DELETE" });
    if (res.ok) {
      setHasKey(false);
      setMessage("API key removed");
      setTestResult(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-8 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            OpenRouter API Key
          </CardTitle>
          <CardDescription>
            Enter your OpenRouter API key to connect to AI models.
            Get one at{" "}
            <a
              href="https://openrouter.ai/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              openrouter.ai
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasKey ? (
            <div className="flex items-center gap-2 rounded-md bg-muted p-3">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm">API key configured</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={handleRemove}
              >
                Remove
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="api-key">
              {hasKey ? "Replace API key" : "API Key"}
            </Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
              />
              <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {hasKey && (
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
              className="w-full"
            >
              {testing ? "Testing..." : "Test Connection"}
            </Button>
          )}

          {message && (
            <div
              className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                testResult === "success"
                  ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
                  : testResult === "error"
                    ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
                    : "bg-muted"
              }`}
            >
              {testResult === "success" && <Check className="h-4 w-4" />}
              {testResult === "error" && <X className="h-4 w-4" />}
              {message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
