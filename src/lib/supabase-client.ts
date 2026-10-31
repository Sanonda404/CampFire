import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getParticipantToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem("campfire_token");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("campfire_token", token);
  }
  return token;
}

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return createBrowserClient(url, anonKey, {
    global: { headers: { "x-participant-token": getParticipantToken() } },
    realtime: { params: { eventsPerSecond: 10 } },
  });
}
