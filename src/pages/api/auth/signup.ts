import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { authErrorCode } from "@/lib/auth-errors";

// Only an error code goes into the URL; /auth/signup turns it into a Polish message (src/lib/auth-errors.ts).
export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email");
  const password = form.get("password");

  // The form validates in the browser, but a post without JS or before hydration lands here as is.
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return context.redirect("/auth/signup?error=missing_fields");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/auth/signup?error=config_missing");
  }
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // The raw message no longer reaches the URL, so Workers Logs are the only trace. Never log the email or password.
    // eslint-disable-next-line no-console
    console.error("sign-up failed:", { name: error.name, status: error.status, code: error.code });
    return context.redirect(`/auth/signup?error=${encodeURIComponent(authErrorCode(error))}`);
  }

  return context.redirect("/auth/confirm-email");
};
