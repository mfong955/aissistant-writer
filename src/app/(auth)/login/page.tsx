"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Local mode: no login required. Redirect straight to the app.
export default function LoginPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return null;
}
