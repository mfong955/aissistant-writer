/**
 * Walk a Tiptap JSON doc and replace all occurrences of oldText in text nodes.
 * Returns the updated doc and whether any replacements were made.
 */
export function replaceTextInTiptapDoc(
  doc: Record<string, unknown>,
  oldText: string,
  newText: string
): { doc: Record<string, unknown>; changed: boolean } {
  let changed = false;

  function walk(node: Record<string, unknown>): Record<string, unknown> {
    if (node.type === "text" && typeof node.text === "string" && node.text.includes(oldText)) {
      changed = true;
      return { ...node, text: (node.text as string).split(oldText).join(newText) };
    }
    if (Array.isArray(node.content)) {
      const newContent = (node.content as Record<string, unknown>[]).map(walk);
      return { ...node, content: newContent };
    }
    return node;
  }

  return { doc: walk(doc), changed };
}

type TiptapMark = { type: string };
type TiptapNode = { type: string; attrs?: Record<string, unknown>; content?: TiptapNode[]; marks?: TiptapMark[]; text?: string };

/**
 * Parse inline markdown (bold, italic) in a string into Tiptap text nodes.
 */
function parseInline(text: string): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  // Combined regex: **bold**, *italic*, __bold__, _italic_
  const re = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1]) {
      nodes.push({ type: "text", text: m[2], marks: [{ type: "bold" }] });
    } else {
      nodes.push({ type: "text", text: m[4], marks: [{ type: "italic" }] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes.length ? nodes : [{ type: "text", text }];
}

/**
 * Convert plain text / markdown to Tiptap JSON.
 * Handles headings (#), bullet lists (- / *), ordered lists (1.), blockquotes (>), bold (**), italic (*).
 */
export function textToTiptapJson(text: string): Record<string, unknown> {
  const lines = text.split("\n");
  const content: TiptapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const hm = /^(#{1,6})\s+(.+)$/.exec(line);
    if (hm) {
      content.push({ type: "heading", attrs: { level: hm[1].length }, content: parseInline(hm[2].trim()) });
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s/.test(line)) {
      const bqLines: string[] = [];
      while (i < lines.length && /^>\s/.test(lines[i])) {
        bqLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      content.push({ type: "blockquote", content: [{ type: "paragraph", content: parseInline(bqLines.join(" ")) }] });
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push({ type: "listItem", content: [{ type: "paragraph", content: parseInline(lines[i].replace(/^[-*]\s/, "")) }] });
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push({ type: "listItem", content: [{ type: "paragraph", content: parseInline(lines[i].replace(/^\d+\.\s/, "")) }] });
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Blank line → skip (paragraph boundary)
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: collect non-empty, non-special lines
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|>\s|[-*]\s|\d+\.\s|---+$)/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      content.push({ type: "paragraph", content: parseInline(paraLines.join(" ")) });
    }
  }

  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/**
 * Convert a Tiptap JSON document to markdown text.
 */
export function tiptapToMarkdown(content: Record<string, unknown>): string {
  const root = content as TiptapNode;
  const lines: string[] = [];

  function inlineToMd(nodes: TiptapNode[]): string {
    return nodes.map((node) => {
      if (node.type === "hardBreak") return "\n";
      if (node.type !== "text") return "";
      const text = node.text || "";
      const marks = node.marks || [];
      const hasBold = marks.some((m) => m.type === "bold");
      const hasItalic = marks.some((m) => m.type === "italic");
      const hasCode = marks.some((m) => m.type === "code");
      if (hasCode) return `\`${text}\``;
      if (hasBold && hasItalic) return `***${text}***`;
      if (hasBold) return `**${text}**`;
      if (hasItalic) return `*${text}*`;
      return text;
    }).join("");
  }

  function listItemText(item: TiptapNode): string {
    return (item.content || [])
      .map((child) => inlineToMd((child as TiptapNode).content || []))
      .join(" ");
  }

  function processNode(node: TiptapNode): void {
    switch (node.type) {
      case "doc":
        for (const child of node.content || []) processNode(child);
        break;
      case "heading": {
        const level = (node.attrs?.level as number) || 1;
        lines.push(`${"#".repeat(level)} ${inlineToMd(node.content || [])}`);
        lines.push("");
        break;
      }
      case "paragraph": {
        const text = inlineToMd(node.content || []);
        lines.push(text);
        lines.push("");
        break;
      }
      case "bulletList":
        for (const item of node.content || []) lines.push(`- ${listItemText(item as TiptapNode)}`);
        lines.push("");
        break;
      case "orderedList":
        (node.content || []).forEach((item, i) => lines.push(`${i + 1}. ${listItemText(item as TiptapNode)}`));
        lines.push("");
        break;
      case "blockquote":
        for (const child of node.content || []) lines.push(`> ${inlineToMd((child as TiptapNode).content || [])}`);
        lines.push("");
        break;
      case "horizontalRule":
        lines.push("---");
        lines.push("");
        break;
    }
  }

  processNode(root);

  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  return lines.join("\n");
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
