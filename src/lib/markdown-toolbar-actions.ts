/**
 * Pure text transforms for the markdown toolbar. The live editor
 * (`MarkdownEditor`) is a plain `<textarea>` of raw markdown, not a Tiptap
 * WYSIWYG surface — so "Bold" means "wrap the selection in **", not an
 * editor command. Each function takes the full text plus the current
 * selection and returns the new text plus where the selection should land
 * afterward, so the caller can restore focus/selection on the textarea.
 */

export interface TextEdit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export function wrapSelection(
  text: string,
  start: number,
  end: number,
  openMarker: string,
  closeMarker: string = openMarker
): TextEdit {
  const selected = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);

  // Toggle off if the selection is already wrapped in exactly this marker pair.
  if (before.endsWith(openMarker) && after.startsWith(closeMarker)) {
    const newText =
      before.slice(0, before.length - openMarker.length) + selected + after.slice(closeMarker.length);
    return {
      text: newText,
      selectionStart: start - openMarker.length,
      selectionEnd: end - openMarker.length,
    };
  }

  const placeholder = selected || "text";
  const newText = before + openMarker + placeholder + closeMarker + after;
  return {
    text: newText,
    selectionStart: start + openMarker.length,
    selectionEnd: start + openMarker.length + placeholder.length,
  };
}

function lineBounds(text: string, start: number, end: number): { lineStart: number; lineEnd: number } {
  const lineStart = text.lastIndexOf("\n", Math.max(start - 1, 0)) + 1;
  let lineEnd = text.indexOf("\n", end > start ? end - 1 : end);
  if (lineEnd === -1) lineEnd = text.length;
  return { lineStart, lineEnd };
}

export function toggleLinePrefix(text: string, start: number, end: number, prefix: string): TextEdit {
  const { lineStart, lineEnd } = lineBounds(text, start, end);
  const block = text.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const contentLines = lines.filter((l) => l.trim() !== "");
  const allPrefixed = contentLines.length > 0 && contentLines.every((l) => l.startsWith(prefix));

  const newLines = lines.map((l) => {
    if (l.trim() === "") return l;
    return allPrefixed ? l.slice(prefix.length) : prefix + l;
  });
  const newBlock = newLines.join("\n");
  const newText = text.slice(0, lineStart) + newBlock + text.slice(lineEnd);
  const delta = allPrefixed ? -prefix.length : prefix.length;

  return {
    text: newText,
    selectionStart: Math.max(start + delta, lineStart),
    selectionEnd: Math.max(end + (newBlock.length - block.length), lineStart),
  };
}

export function toggleHeading(text: string, start: number, end: number, level: number): TextEdit {
  const { lineStart, lineEnd } = lineBounds(text, start, start);
  const line = text.slice(lineStart, lineEnd);
  const marker = "#".repeat(level) + " ";
  const existing = /^(#{1,6})\s+/.exec(line);

  let newLine: string;
  if (existing && existing[1].length === level) {
    newLine = line.slice(existing[0].length);
  } else if (existing) {
    newLine = marker + line.slice(existing[0].length);
  } else {
    newLine = marker + line;
  }

  const newText = text.slice(0, lineStart) + newLine + text.slice(lineEnd);
  const delta = newLine.length - line.length;
  return { text: newText, selectionStart: start + delta, selectionEnd: end + delta };
}

export function insertCodeBlock(text: string, start: number, end: number): TextEdit {
  const selected = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);
  const openPad = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const closePad = after.length > 0 && !after.startsWith("\n") ? "\n" : "";

  const prefix = `${openPad}\`\`\`\n`;
  const suffix = `\n\`\`\`${closePad}`;
  const newText = before + prefix + selected + suffix + after;
  const cursor = before.length + prefix.length + selected.length;
  return { text: newText, selectionStart: cursor, selectionEnd: cursor };
}

export function insertHorizontalRule(text: string, start: number): TextEdit {
  const before = text.slice(0, start);
  const after = text.slice(start);
  const openPad = before.length === 0 ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const closePad = after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const insert = `${openPad}---${closePad}`;
  const newText = before + insert + after;
  const pos = before.length + insert.length;
  return { text: newText, selectionStart: pos, selectionEnd: pos };
}

export function insertTable(text: string, start: number): TextEdit {
  const before = text.slice(0, start);
  const after = text.slice(start);
  const openPad = before.length === 0 ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const closePad = after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const table =
    "| Header 1 | Header 2 | Header 3 |\n" +
    "| --- | --- | --- |\n" +
    "| Cell | Cell | Cell |\n" +
    "| Cell | Cell | Cell |";
  const insert = `${openPad}${table}${closePad}`;
  const newText = before + insert + after;
  const cellStart = before.length + openPad.length + 2; // just past "| "
  return { text: newText, selectionStart: cellStart, selectionEnd: cellStart + "Header 1".length };
}

export function insertLink(text: string, start: number, end: number, url: string): TextEdit {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const label = text.slice(start, end) || "link text";
  const inserted = `[${label}](${url})`;
  const newText = before + inserted + after;
  return { text: newText, selectionStart: start + 1, selectionEnd: start + 1 + label.length };
}
