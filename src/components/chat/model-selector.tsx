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
        setModels(data.models || []);
        onNoApiKey?.(false);
        // Auto-select first model if none selected
        if (!selectedModelId && data.models?.length > 0) {
          onSelect(data.models[0].id, data.models[0].context_length);
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
