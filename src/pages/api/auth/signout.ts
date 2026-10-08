import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    // Local scope: signing out on a shared device (the TV) leaves the host signed in on their phone.
    await supabase.auth.signOut({ scope: "local" });
  }
  return context.redirect("/");
};
