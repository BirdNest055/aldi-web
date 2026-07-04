import { createClient } from "@supabase/supabase-js";

let _client: any = null;

export function getDb() {
  if (!_client) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.SUPABASE_SECRET_KEY || "";
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
    }
    _client = createClient(url, key);
  }
  return _client;
}
