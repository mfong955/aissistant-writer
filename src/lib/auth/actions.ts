"use server";

import { redirect } from "next/navigation";

// Auth is a no-op in local mode. These stubs satisfy any existing callers
// and will be replaced when cloud sync + Supabase auth is re-enabled.

export async function signUp() {
  redirect("/");
}

export async function signIn() {
  redirect("/");
}

export async function signOut() {
  redirect("/");
}
