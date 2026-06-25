import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getUserId } from "@/lib/get-user-id";
import { dbCreateEntity } from "@/lib/db/entities";

export async function POST(request: Request) {
  try {
    const userIdOrError = await getUserId();
    if (userIdOrError instanceof NextResponse) return userIdOrError;
    const userId = userIdOrError;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("project_id") as string | null;
    const name = formData.get("name") as string | null;

    if (!file || !projectId || !name) {
      return NextResponse.json({ error: "file, project_id, and name are required" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), ".data", "uploads", projectId);
    await fs.mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    await fs.writeFile(path.join(uploadDir, filename), Buffer.from(bytes));
    const entity = await dbCreateEntity({
      projectId,
      userId,
      name,
      type: "image",
      content: {
        type: "image_file",
        url: `/api/images/${projectId}/${filename}`,
        mimeType: file.type || "image/jpeg",
        originalName: file.name,
      },
    });

    return NextResponse.json({ entity }, { status: 201 });
  } catch (err) {
    console.error("Image upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
