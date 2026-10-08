import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { authErrorCode } from "@/lib/auth-errors";

// Supabase sends the host back here from Discord or Google: `code` on success, `error` / `error_code` otherwise.
// It lives under /api/auth/ and not /auth/*, which S-01 redirects away for signed-in users. Only an error code goes
// into the URL; /auth/signin turns it into a Polish message (src/lib/auth-errors.ts).
export const GET: APIRoute = async (context) => {
  const params = context.url.searchParams;

  // A cancelled consent gives only `error=access_denied`; Supabase's own failures add `error_code`.
  const providerError = params.get("error_code") ?? params.get("error");
  if (providerError) {
    // Codes only: error_description is free text from the provider and may name the account.
    // eslint-disable-next-line no-console
    console.error("oauth callback error:", { error: params.get("error"), error_code: params.get("error_code") });
    return context.redirect(`/auth/signin?error=${encodeURIComponent(providerError)}`);
  }

  const code = params.get("code");
  if (!code) {
    return context.redirect("/auth/signin?error=bad_oauth_callback");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/auth/signin?error=config_missing");
  }
  // Reads the PKCE verifier cookie set by /api/auth/oauth and writes the session cookies through setAll.
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Workers Logs are the only trace. Never log the `code` from the URL, tokens or the email.
    // eslint-disable-next-line no-console
    console.error("oauth callback failed:", { name: error.name, status: error.status, code: error.code });
    return context.redirect(`/auth/signin?error=${encodeURIComponent(authErrorCode(error))}`);
  }

  return context.redirect("/");
};
