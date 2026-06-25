import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ segments: string[] }> }
) {
  const { segments } = await params;
  const filePath = path.join(process.cwd(), ".data", "uploads", ...segments);

  try {
    const bytes = await fs.readFile(filePath);
    const ext = segments[segments.length - 1]?.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME[ext] ?? "application/octet-stream";
    return new Response(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
