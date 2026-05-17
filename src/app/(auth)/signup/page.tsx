"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Local mode: no signup required. Redirect straight to the app.
export default function SignUpPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return null;
}
