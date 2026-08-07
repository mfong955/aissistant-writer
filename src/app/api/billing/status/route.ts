import { NextResponse } from "next/server";
import { creditsEnabled } from "@/lib/billing/credits";

export async function GET() {
  return NextResponse.json({ enabled: creditsEnabled() });
}
