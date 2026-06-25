import { NextResponse } from "next/server";
import { getUserId } from "@/lib/get-user-id";
import { dbGetCreditTransactions } from "@/lib/db/billing";

export async function GET() {
  const userIdOrError = await getUserId();
  if (userIdOrError instanceof NextResponse) return userIdOrError;

  const transactions = await dbGetCreditTransactions(userIdOrError);
  return NextResponse.json({ transactions });
}
