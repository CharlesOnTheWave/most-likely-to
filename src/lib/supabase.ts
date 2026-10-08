import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";

export function createClient(requestHeaders: Headers, cookies: AstroCookies) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return null;
  }
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    // Only the server reads the session and PKCE cookies (no auth client in the browser), so scripts never need them.
    cookieOptions: { httpOnly: true },
    cookies: {
      getAll() {
        return parseCookieHeader(requestHeaders.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}

// URL and key for the browser, only for Realtime subscriptions (AGENTS.md). Anything but a publishable key gives null,
// so a misconfigured secret key is never served.
export function getPublicSupabaseConfig(): { supabaseUrl: string; supabaseKey: string } | null {
  if (!SUPABASE_URL || !SUPABASE_KEY?.startsWith("sb_publishable_")) {
    return null;
  }
  return { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY };
}
