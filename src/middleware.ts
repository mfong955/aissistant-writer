import { type NextRequest, NextResponse } from "next/server";

// No authentication required — app runs fully locally.
// Supabase auth is kept in the codebase but not enforced here;
// it will be wired back in when cloud sync is added.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
