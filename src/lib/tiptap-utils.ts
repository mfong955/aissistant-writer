/**
 * Convert plain text to Tiptap JSON document format.
 * Splits on double newlines to create paragraphs.
 */
export function textToTiptapJson(text: string): Record<string, unknown> {
  const paragraphs = text.split("\n\n").filter(Boolean);
  return {
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p.trim() }],
    })),
  };
}

/**
 * Extract plain text from a Tiptap JSON document.
 * Walks the node tree, collecting text and adding newlines after block nodes.
 */
export function extractTextFromTiptap(content: Record<string, unknown>): string {
  const parts: string[] = [];

  function walk(node: Record<string, unknown>) {
    if (node.text && typeof node.text === "string") {
      parts.push(node.text);
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child as Record<string, unknown>);
      }
      if (node.type === "paragraph" || node.type === "heading") {
        parts.push("\n");
      }
    }
  }

  walk(content);
  return parts.join("").trim();
}
