import { tiptapToMarkdown } from "./tiptap-utils";
import { marked } from "marked";
import type { Entity } from "@/types/database";
import { buildTree, flattenTree } from "./entity-tree";

type TiptapMark = { type: string };
type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
};

// ─── Markdown ─────────────────────────────────────────────────────────────────

export function exportAsMarkdown(name: string, content: Record<string, unknown> | null) {
  const md = content ? tiptapToMarkdown(content) : "";
  downloadBlob(`${name}.md`, new Blob([md], { type: "text/markdown" }));
}

// ─── PDF (browser print) ──────────────────────────────────────────────────────

export function exportAsPdf(name: string, content: Record<string, unknown> | null) {
  const md = content ? tiptapToMarkdown(content) : "";
  const body = marked(md, { async: false }) as string;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Allow pop-ups to export PDF, then try again.");
    return;
  }

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escHtml(name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12pt;
    line-height: 1.75;
    color: #111;
    padding: 0.75in 1in;
  }
  h1 { font-size: 24pt; font-weight: 700; margin: 1.5em 0 0.5em; }
  h2 { font-size: 18pt; font-weight: 600; margin: 1.25em 0 0.5em; }
  h3 { font-size: 14pt; font-weight: 600; margin: 1em 0 0.5em; }
  h4, h5, h6 { font-weight: 600; margin: 0.75em 0 0.4em; }
  p { margin-bottom: 1em; }
  ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
  ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1em; }
  li { margin-bottom: 0.25em; }
  blockquote {
    border-left: 3px solid #aaa;
    padding-left: 1em;
    margin: 0 0 1em;
    font-style: italic;
    color: #555;
  }
  strong { font-weight: 700; }
  em { font-style: italic; }
  code { font-family: monospace; background: #f0f0f0; padding: 0.1em 0.3em; border-radius: 3px; font-size: 10pt; }
  pre { background: #f0f0f0; padding: 1em; border-radius: 4px; overflow-x: auto; margin-bottom: 1em; }
  hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }
  @media print {
    body { padding: 0; }
    @page { margin: 1in; size: letter; }
  }
</style>
</head>
<body>${body}</body>
</html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 300);
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────

export async function exportAsDocx(name: string, content: Record<string, unknown> | null) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
  } = await import("docx");

  function toRuns(nodes: TiptapNode[]) {
    return nodes.flatMap((node) => {
      if (node.type === "hardBreak") return [new TextRun({ break: 1 })];
      if (node.type !== "text") return [];
      const marks = node.marks ?? [];
      return [
        new TextRun({
          text: node.text ?? "",
          bold: marks.some((m) => m.type === "bold"),
          italics: marks.some((m) => m.type === "italic"),
          strike: marks.some((m) => m.type === "strike"),
        }),
      ];
    });
  }

  function listItemRuns(item: TiptapNode) {
    return (item.content ?? []).flatMap((child) => toRuns(child.content ?? []));
  }

  const HEADING_LEVELS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ] as const;

  function toParagraphs(node: TiptapNode): InstanceType<typeof Paragraph>[] {
    switch (node.type) {
      case "doc":
        return (node.content ?? []).flatMap(toParagraphs);

      case "heading": {
        const idx = Math.min(((node.attrs?.level as number) ?? 1) - 1, 5);
        return [
          new Paragraph({ heading: HEADING_LEVELS[idx], children: toRuns(node.content ?? []) }),
        ];
      }

      case "paragraph":
        return [new Paragraph({ children: toRuns(node.content ?? []) })];

      case "bulletList":
        return (node.content ?? []).map(
          (item) => new Paragraph({ bullet: { level: 0 }, children: listItemRuns(item) })
        );

      case "orderedList":
        return (node.content ?? []).map(
          (item, i) =>
            new Paragraph({
              children: [
                new TextRun({ text: `${i + 1}. ` }),
                ...listItemRuns(item),
              ],
            })
        );

      case "blockquote":
        return (node.content ?? []).map(
          (child) =>
            new Paragraph({
              indent: { left: 720 },
              children: [
                new TextRun({ text: "│ ", color: "888888" }),
                ...toRuns(child.content ?? []),
              ],
            })
        );

      case "horizontalRule":
        return [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "* * *", color: "888888" })],
          }),
        ];

      default:
        return [];
    }
  }

  const root = (content ?? { type: "doc", content: [{ type: "paragraph" }] }) as TiptapNode;

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Georgia", size: 24 } },
      },
    },
    sections: [{ children: toParagraphs(root) }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(`${name}.docx`, blob);
}

// ─── Project export ───────────────────────────────────────────────────────────

function buildEntityPaths(entities: Entity[]): Map<string, string> {
  const idToEntity = new Map(entities.map((e) => [e.id, e]));
  const paths = new Map<string, string>();

  function getPath(id: string): string {
    if (paths.has(id)) return paths.get(id)!;
    const entity = idToEntity.get(id)!;
    const segment = entity.name.replace(/[/\\?%*:|"<>]/g, "-");
    if (!entity.parent_id || !idToEntity.has(entity.parent_id)) {
      paths.set(id, segment);
    } else {
      paths.set(id, `${getPath(entity.parent_id)}/${segment}`);
    }
    return paths.get(id)!;
  }

  for (const entity of entities) getPath(entity.id);
  return paths;
}

export async function exportProjectAsZip(projectName: string, entities: Entity[]) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const paths = buildEntityPaths(entities);

  for (const entity of entities) {
    if (entity.type === "folder" || entity.type === "image") continue;
    const md = entity.content ? tiptapToMarkdown(entity.content) : "";
    zip.file(`${paths.get(entity.id)}.md`, md);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(`${projectName}.zip`, blob);
}

export function exportProjectAsPdf(projectName: string, entities: Entity[]) {
  const tree = buildTree(entities.filter((e) => e.type !== "image"));
  const ordered = flattenTree(tree).filter((e) => e.type !== "folder");

  const sections = ordered
    .map((e) => {
      const md = e.content ? tiptapToMarkdown(e.content) : "";
      return `<h1>${escHtml(e.name)}</h1>\n${marked(md, { async: false }) as string}`;
    })
    .join('<hr style="margin:2em 0">');

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { alert("Allow pop-ups to export PDF, then try again."); return; }

  win.document.write(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${escHtml(projectName)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Georgia,"Times New Roman",serif; font-size:12pt; line-height:1.75; color:#111; padding:0.75in 1in; }
  h1 { font-size:24pt; font-weight:700; margin:1.5em 0 0.5em; }
  h2 { font-size:18pt; font-weight:600; margin:1.25em 0 0.5em; }
  h3 { font-size:14pt; font-weight:600; margin:1em 0 0.5em; }
  h4,h5,h6 { font-weight:600; margin:0.75em 0 0.4em; }
  p { margin-bottom:1em; }
  ul { list-style-type:disc; padding-left:1.5em; margin-bottom:1em; }
  ol { list-style-type:decimal; padding-left:1.5em; margin-bottom:1em; }
  li { margin-bottom:0.25em; }
  blockquote { border-left:3px solid #aaa; padding-left:1em; margin:0 0 1em; font-style:italic; color:#555; }
  strong { font-weight:700; } em { font-style:italic; }
  code { font-family:monospace; background:#f0f0f0; padding:0.1em 0.3em; border-radius:3px; font-size:10pt; }
  pre { background:#f0f0f0; padding:1em; border-radius:4px; overflow-x:auto; margin-bottom:1em; }
  hr { border:none; border-top:1px solid #ccc; margin:2em 0; }
  @media print { body { padding:0; } @page { margin:1in; size:letter; } }
</style></head><body>${sections}</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 300);
}

export async function exportProjectAsDocx(projectName: string, entities: Entity[]) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = await import("docx");

  const HEADING_LEVELS = [
    HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
  ] as const;

  function toRuns(nodes: TiptapNode[]) {
    return nodes.flatMap((node) => {
      if (node.type === "hardBreak") return [new TextRun({ break: 1 })];
      if (node.type !== "text") return [];
      const marks = node.marks ?? [];
      return [new TextRun({ text: node.text ?? "", bold: marks.some((m) => m.type === "bold"), italics: marks.some((m) => m.type === "italic"), strike: marks.some((m) => m.type === "strike") })];
    });
  }

  function listItemRuns(item: TiptapNode) {
    return (item.content ?? []).flatMap((child) => toRuns(child.content ?? []));
  }

  function toParagraphs(node: TiptapNode): InstanceType<typeof Paragraph>[] {
    switch (node.type) {
      case "doc": return (node.content ?? []).flatMap(toParagraphs);
      case "heading": {
        const idx = Math.min(((node.attrs?.level as number) ?? 1) - 1, 5);
        return [new Paragraph({ heading: HEADING_LEVELS[idx], children: toRuns(node.content ?? []) })];
      }
      case "paragraph": return [new Paragraph({ children: toRuns(node.content ?? []) })];
      case "bulletList": return (node.content ?? []).map((item) => new Paragraph({ bullet: { level: 0 }, children: listItemRuns(item) }));
      case "orderedList": return (node.content ?? []).map((item, i) => new Paragraph({ children: [new TextRun({ text: `${i + 1}. ` }), ...listItemRuns(item)] }));
      case "blockquote": return (node.content ?? []).map((child) => new Paragraph({ indent: { left: 720 }, children: [new TextRun({ text: "│ ", color: "888888" }), ...toRuns(child.content ?? [])] }));
      case "horizontalRule": return [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "* * *", color: "888888" })] })];
      default: return [];
    }
  }

  const tree = buildTree(entities.filter((e) => e.type !== "image"));
  const ordered = flattenTree(tree).filter((e) => e.type !== "folder");

  const children: InstanceType<typeof Paragraph>[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const entity = ordered[i];
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(entity.name)] }));
    const root = (entity.content ?? { type: "doc", content: [{ type: "paragraph" }] }) as TiptapNode;
    children.push(...toParagraphs(root));
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Georgia", size: 24 } } } },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(`${projectName}.docx`, blob);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
