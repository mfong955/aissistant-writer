import { NextResponse } from "next/server";

// Not used in local mode — will be re-enabled when cloud sync is added.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/`);
}
