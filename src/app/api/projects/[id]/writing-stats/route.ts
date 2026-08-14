import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbGetWritingStats } from "@/lib/db/writing-stats";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const { id: projectId } = await params;

  const stats = await dbGetWritingStats(projectId);
  return NextResponse.json(stats);
}
