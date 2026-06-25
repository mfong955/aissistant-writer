"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageViewerProps {
  name: string;
  content: Record<string, unknown> | null;
}

export function ImageViewer({ name, content }: ImageViewerProps) {
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // Support file-based storage (image_file) and old base64 storage (image_data)
  const src =
    (content?.url as string | undefined) ??
    (content?.src as string | undefined) ??
    null;
  const fileName =
    (content?.originalName as string | undefined) ??
    (content?.fileName as string | undefined) ??
    name;

  if (!src) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No image data
      </div>
    );
  }

  function handleDownload() {
    const a = document.createElement("a");
    a.href = src!;
    a.download = fileName;
    a.click();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center overflow-auto p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          className="max-h-full max-w-full rounded-md object-contain shadow-md"
          onLoad={(e) => {
            const img = e.currentTarget;
            setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />
      </div>
      <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
        <span className="truncate">
          {fileName}
          {naturalSize && (
            <span className="ml-2 opacity-60">
              {naturalSize.w} × {naturalSize.h}
            </span>
          )}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleDownload} title="Download">
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
