import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbGetCredits } from "@/lib/db/billing";

export async function GET() {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;

  const balance = await dbGetCredits(userIdOrError);
  return NextResponse.json({ balance });
}
