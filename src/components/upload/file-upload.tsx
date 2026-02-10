"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadedFile {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

interface FileUploadProps {
  projectId: string;
  entityId?: string;
  onUpload?: (file: UploadedFile) => void;
}

export function FileUpload({ projectId, entityId, onUpload }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("project_id", projectId);
      if (entityId) {
        formData.append("entity_id", entityId);
      }

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Upload failed");
        }

        const data = await res.json();
        onUpload?.(data.file);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [projectId, entityId, onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [uploadFile]
  );

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-sm transition-colors ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
      >
        {isUploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="mt-1 text-xs text-muted-foreground">
              Drop file or click to upload (max 10MB)
            </span>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />

      {error && (
        <div className="flex items-center gap-1 text-xs text-red-500">
          <X className="h-3 w-3" />
          {error}
        </div>
      )}
    </div>
  );
}

interface FileListProps {
  projectId: string;
  files: UploadedFile[];
  onDelete?: (fileId: string) => void;
}

export function FileList({ files, onDelete }: FileListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(
    async (fileId: string) => {
      setDeletingId(fileId);
      try {
        const res = await fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_id: fileId }),
        });

        if (res.ok) {
          onDelete?.(fileId);
        }
      } catch {
        // Silently ignore
      } finally {
        setDeletingId(null);
      }
    },
    [onDelete]
  );

  if (files.length === 0) return null;

  return (
    <div className="space-y-1">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="shrink-0 text-muted-foreground">
            {formatFileSize(file.size_bytes)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 shrink-0"
            onClick={() => handleDelete(file.id)}
            disabled={deletingId === file.id}
          >
            {deletingId === file.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
