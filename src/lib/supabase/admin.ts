import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Permissive database type — avoids 'never' errors until we generate proper types.
// All table Row/Insert/Update types are Record<string, unknown> so we cast to our own types at the call site.
type AnyDatabase = {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};

let _client: SupabaseClient<AnyDatabase> | null = null;

export function getAdminClient(): SupabaseClient<AnyDatabase> {
  if (!_client) {
    _client = createClient<AnyDatabase>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _client;
}
