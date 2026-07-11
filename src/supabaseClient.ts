import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

if (url && anonKey) {
  client = createClient(url, anonKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  return client;
}

export function isBackendConfigured(): boolean {
  return client !== null;
}
