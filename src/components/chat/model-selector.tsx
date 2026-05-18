"use client";

import { useEffect, useState } from "react";
import type { OpenRouterModel } from "@/lib/openrouter/types";

interface ModelSelectorProps {
  selectedModelId: string | null;
  onSelect: (modelId: string, contextLength: number) => void;
  onNoApiKey?: (noKey: boolean) => void;
}

export function ModelSelector({ selectedModelId, onSelect, onNoApiKey }: ModelSelectorProps) {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/openrouter/models")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error);
        }
        return res.json();
      })
      .then((data) => {
        const models: OpenRouterModel[] = data.models || [];
        setModels(models);
        onNoApiKey?.(false);
        if (!selectedModelId && models.length > 0) {
          // Restore previously selected model from localStorage, then preferred defaults
          const savedId = typeof window !== "undefined" ? localStorage.getItem("aissistant:modelId") : null;
          const PREFERRED = [
            "anthropic/claude-sonnet-4-6",
            "anthropic/claude-sonnet-4-5",
            "anthropic/claude-3.5-sonnet",
            "anthropic/claude-3-sonnet",
          ];
          const preferred =
            (savedId ? models.find((m) => m.id === savedId) : undefined) ??
            PREFERRED.map((id) => models.find((m) => m.id === id)).find(Boolean) ??
            models.find((m) => m.id.includes("claude") && m.id.includes("sonnet")) ??
            models[0];
          onSelect(preferred.id, preferred.context_length);
        }
      })
      .catch((err) => {
        setError(err.message);
        if (err.message === "No API key configured") {
          onNoApiKey?.(true);
        }
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">{error}</div>
    );
  }

  if (loading) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        Loading models...
      </div>
    );
  }

  return (
    <select
      value={selectedModelId || ""}
      onChange={(e) => {
        const model = models.find((m) => m.id === e.target.value);
        if (model) {
          localStorage.setItem("aissistant:modelId", model.id);
          onSelect(model.id, model.context_length);
        }
      }}
      className="w-full border-b bg-transparent px-3 py-2 text-xs focus:outline-none"
    >
      {models.map((model) => (
        <option key={model.id} value={model.id}>
          {model.name} ({Math.round(model.context_length / 1000)}K ctx)
        </option>
      ))}
    </select>
  );
}
