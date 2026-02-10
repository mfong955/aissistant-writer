"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

interface TiptapEditorProps {
  content: Record<string, unknown> | null;
  onUpdate: (content: Record<string, unknown>) => void;
  onInitialize: (content: Record<string, unknown>) => void;
}

export function TiptapEditor({
  content,
  onUpdate,
  onInitialize,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
    ],
    content: content || undefined,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getJSON() as Record<string, unknown>);
    },
  });

  // Initialize hash when content is first loaded
  useEffect(() => {
    if (content) {
      onInitialize(content);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update editor content when the entity changes
  useEffect(() => {
    if (editor && content) {
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = JSON.stringify(content);
      if (currentContent !== newContent) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content]);

  return (
    <div className="prose-editor h-full overflow-auto px-8 py-6">
      <style jsx global>{`
        .prose-editor .tiptap {
          max-width: 720px;
          margin: 0 auto;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.125rem;
          line-height: 1.75;
          outline: none;
          min-height: 100%;
        }
        .prose-editor .tiptap p {
          margin-bottom: 1em;
        }
        .prose-editor .tiptap h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          font-family: inherit;
        }
        .prose-editor .tiptap h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.25em;
          margin-bottom: 0.5em;
        }
        .prose-editor .tiptap h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        .prose-editor .tiptap blockquote {
          border-left: 3px solid var(--border);
          padding-left: 1em;
          margin-left: 0;
          font-style: italic;
          color: var(--muted-foreground);
        }
        .prose-editor .tiptap ul,
        .prose-editor .tiptap ol {
          padding-left: 1.5em;
          margin-bottom: 1em;
        }
        .prose-editor .tiptap li {
          margin-bottom: 0.25em;
        }
        .prose-editor .tiptap .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--muted-foreground);
          pointer-events: none;
          height: 0;
        }
      `}</style>
      <EditorContent editor={editor} className="h-full" />
    </div>
  );
}

export { type TiptapEditorProps };
