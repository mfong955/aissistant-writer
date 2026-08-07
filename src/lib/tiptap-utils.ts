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

type TiptapMark = { type: string; attrs?: Record<string, unknown> };
type TiptapNode = { type: string; attrs?: Record<string, unknown>; content?: TiptapNode[]; marks?: TiptapMark[]; text?: string };

/**
 * Parse inline markdown (bold, italic, strike, inline code, links, underline) in a string
 * into Tiptap text nodes.
 */
function parseInline(text: string): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  // Combined regex, in priority order: **bold**/__bold__, *italic*/_italic_, ~~strike~~,
  // `code`, [text](url), <u>underline</u>
  const re = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|~~(.*?)~~|`([^`]*?)`|\[([^\]]*?)\]\(([^)]*?)\)|<u>(.*?)<\/u>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1]) {
      nodes.push({ type: "text", text: m[2], marks: [{ type: "bold" }] });
    } else if (m[3]) {
      nodes.push({ type: "text", text: m[4], marks: [{ type: "italic" }] });
    } else if (m[5] !== undefined) {
      nodes.push({ type: "text", text: m[5], marks: [{ type: "strike" }] });
    } else if (m[6] !== undefined) {
      nodes.push({ type: "text", text: m[6], marks: [{ type: "code" }] });
    } else if (m[7] !== undefined) {
      nodes.push({ type: "text", text: m[7], marks: [{ type: "link", attrs: { href: m[8] } }] });
    } else if (m[9] !== undefined) {
      nodes.push({ type: "text", text: m[9], marks: [{ type: "underline" }] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes.length ? nodes : [{ type: "text", text }];
}

type CellAlign = "left" | "center" | "right" | null;

/** Splits a GFM table row on unescaped `|`, trimming a leading/trailing pipe if present. */
function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "\\" && trimmed[i + 1] === "|") {
      current += "|";
      i++;
    } else if (trimmed[i] === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += trimmed[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") && !trimmed.includes("|")) return false;
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(trimmed);
}

function parseAlignments(sepLine: string): CellAlign[] {
  return splitTableRow(sepLine).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
}

function tableRowNode(cells: string[], aligns: CellAlign[], isHeader: boolean): TiptapNode {
  return {
    type: "tableRow",
    content: cells.map((cellText, colIdx) => ({
      type: isHeader ? "tableHeader" : "tableCell",
      attrs: { colspan: 1, rowspan: 1, colwidth: null, align: aligns[colIdx] ?? null },
      content: [{ type: "paragraph", content: parseInline(cellText) }],
    })),
  };
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

    // Table (GFM pipe syntax): a row line immediately followed by a valid separator line
    if (/^\s*\|/.test(line) && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1])) {
      const headerCells = splitTableRow(line);
      const aligns = parseAlignments(lines[i + 1]);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i]) && lines[i].trim() !== "") {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      content.push({
        type: "table",
        content: [
          tableRowNode(headerCells, aligns, true),
          ...bodyRows.map((cells) => tableRowNode(cells, aligns, false)),
        ],
      });
      continue;
    }

    // Fenced code block
    const fenceMatch = /^```(\w*)\s*$/.exec(line.trim());
    if (fenceMatch) {
      const language = fenceMatch[1] || null;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "```") {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      content.push({
        type: "codeBlock",
        attrs: { language },
        content: codeLines.length ? [{ type: "text", text: codeLines.join("\n") }] : [],
      });
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
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|>\s|[-*]\s|\d+\.\s|---+$|```|\s*\|)/.test(lines[i])) {
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
      const hasCode = marks.some((m) => m.type === "code");
      if (hasCode) return `\`${text}\``;

      const hasBold = marks.some((m) => m.type === "bold");
      const hasItalic = marks.some((m) => m.type === "italic");
      const hasStrike = marks.some((m) => m.type === "strike");
      const hasUnderline = marks.some((m) => m.type === "underline");
      const link = marks.find((m) => m.type === "link");

      let out = text;
      if (hasBold && hasItalic) out = `***${out}***`;
      else if (hasBold) out = `**${out}**`;
      else if (hasItalic) out = `*${out}*`;
      if (hasStrike) out = `~~${out}~~`;
      if (hasUnderline) out = `<u>${out}</u>`;
      if (link) out = `[${out}](${(link.attrs?.href as string | undefined) ?? ""})`;
      return out;
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
      case "codeBlock": {
        const lang = (node.attrs?.language as string | undefined) || "";
        const text = (node.content || []).map((c) => c.text || "").join("");
        lines.push("```" + lang);
        lines.push(text);
        lines.push("```");
        lines.push("");
        break;
      }
      case "table": {
        const rows = node.content || [];
        rows.forEach((row, rowIdx) => {
          const cells = row.content || [];
          const cellTexts = cells.map((cell) =>
            (cell.content || []).map((p) => inlineToMd(p.content || [])).join(" ")
          );
          lines.push(`| ${cellTexts.join(" | ")} |`);
          if (rowIdx === 0) {
            const sep = cells.map((cell) => {
              const align = cell.attrs?.align as CellAlign | undefined;
              if (align === "center") return ":---:";
              if (align === "right") return "---:";
              if (align === "left") return ":---";
              return "---";
            });
            lines.push(`| ${sep.join(" | ")} |`);
          }
        });
        lines.push("");
        break;
      }
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
