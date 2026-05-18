import { NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (opts: { data?: Buffer; url?: string }) => {
    getText: () => Promise<{ text: string }>;
    getInfo: () => Promise<{ total: number }>;
    destroy: () => void;
  };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
};

export async function POST(request: Request) {
  const { base64, mimeType, fileName } = await request.json() as {
    base64: string;
    mimeType: string;
    fileName: string;
  };

  if (!base64) {
    return NextResponse.json({ error: "base64 is required" }, { status: 400 });
  }

  const buffer = Buffer.from(base64, "base64");
  const name = fileName ?? "";

  try {
    if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return NextResponse.json({ text: result.text });
      } finally {
        parser.destroy();
      }
    }

    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx") ||
      mimeType === "application/msword" ||
      name.endsWith(".doc")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return NextResponse.json({ text: result.value });
    }

    if (mimeType === "application/rtf" || name.endsWith(".rtf")) {
      const raw = buffer.toString("latin1");
      const text = raw
        .replace(/\\par[d]?\b/g, "\n")
        .replace(/\{[^{}]*\}/g, "")
        .replace(/\\[a-z]+[-]?\d*\s?/g, "")
        .replace(/[{}\\]/g, "")
        .replace(/\r?\n{3,}/g, "\n\n")
        .trim();
      return NextResponse.json({ text });
    }

    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
