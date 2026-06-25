"use client";

import { useMemo } from "react";
import { marked } from "marked";
import { tiptapToMarkdown } from "@/lib/tiptap-utils";

interface EditorPreviewProps {
  content: Record<string, unknown> | null;
}

export function EditorPreview({ content }: EditorPreviewProps) {
  const html = useMemo(() => {
    if (!content) return "";
    try {
      const md = tiptapToMarkdown(content);
      const result = marked(md, { async: false });
      return result as string;
    } catch {
      return "<p><em>Unable to render preview.</em></p>";
    }
  }, [content]);

  return (
    <div className="h-full overflow-auto px-8 py-6">
      <div
        className="prose-preview mx-auto max-w-[720px]"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style jsx global>{`
        .prose-preview {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.125rem;
          line-height: 1.75;
          color: var(--foreground);
        }
        .prose-preview h1 { font-size: 2rem; font-weight: 700; margin: 1.5em 0 0.5em; }
        .prose-preview h2 { font-size: 1.5rem; font-weight: 600; margin: 1.25em 0 0.5em; }
        .prose-preview h3 { font-size: 1.25rem; font-weight: 600; margin: 1em 0 0.5em; }
        .prose-preview h4, .prose-preview h5, .prose-preview h6 { font-weight: 600; margin: 0.75em 0 0.4em; }
        .prose-preview p { margin-bottom: 1em; }
        .prose-preview ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
        .prose-preview ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1em; }
        .prose-preview ul ul { list-style-type: circle; }
        .prose-preview ul ul ul { list-style-type: square; }
        .prose-preview li { margin-bottom: 0.25em; display: list-item; }
        .prose-preview blockquote {
          border-left: 3px solid var(--border);
          padding-left: 1em;
          margin-left: 0;
          font-style: italic;
          color: var(--muted-foreground);
        }
        .prose-preview strong { font-weight: 700; }
        .prose-preview em { font-style: italic; }
        .prose-preview code { font-family: monospace; background: var(--muted); padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
        .prose-preview pre { background: var(--muted); padding: 1em; border-radius: 6px; overflow-x: auto; margin-bottom: 1em; }
        .prose-preview hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
      `}</style>
    </div>
  );
}
