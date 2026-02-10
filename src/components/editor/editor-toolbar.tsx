"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  const tools = [
    {
      icon: Heading1,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      active: editor.isActive("heading", { level: 1 }),
      title: "Heading 1",
    },
    {
      icon: Heading2,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive("heading", { level: 2 }),
      title: "Heading 2",
    },
    {
      icon: Heading3,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor.isActive("heading", { level: 3 }),
      title: "Heading 3",
    },
    { type: "separator" as const },
    {
      icon: Bold,
      action: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive("bold"),
      title: "Bold",
    },
    {
      icon: Italic,
      action: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive("italic"),
      title: "Italic",
    },
    { type: "separator" as const },
    {
      icon: List,
      action: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive("bulletList"),
      title: "Bullet List",
    },
    {
      icon: ListOrdered,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive("orderedList"),
      title: "Ordered List",
    },
    {
      icon: Quote,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive("blockquote"),
      title: "Blockquote",
    },
  ];

  return (
    <div className="flex items-center gap-0.5 border-b px-2 py-1">
      {tools.map((tool, i) => {
        if ("type" in tool && tool.type === "separator") {
          return (
            <div key={i} className="mx-1 h-5 w-px bg-border" />
          );
        }
        const { icon: Icon, action, active, title } = tool as {
          icon: React.ComponentType<{ className?: string }>;
          action: () => void;
          active: boolean;
          title: string;
        };
        return (
          <Button
            key={title}
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", active && "bg-accent")}
            onClick={action}
            title={title}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
