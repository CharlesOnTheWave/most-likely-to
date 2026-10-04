import type { APIRoute } from "astro";
import { getPublicSupabaseConfig } from "@/lib/supabase";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET: APIRoute = () => {
  const config = getPublicSupabaseConfig();
  if (!config) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503, headers: NO_STORE });
  }
  return Response.json(config, { headers: NO_STORE });
};
