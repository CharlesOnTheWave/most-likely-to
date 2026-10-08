import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { authErrorCode } from "@/lib/auth-errors";

// Supabase sends the host back here from Discord or Google: `code` on success, `error` / `error_code` otherwise.
// It lives under /api/auth/ and not /auth/*, which S-01 redirects away for signed-in users. Only an error code goes
// into the URL; /auth/signin turns it into a Polish message (src/lib/auth-errors.ts).

// Anyone can open this URL, so `error` and `error_code` are untrusted: anything but a short code becomes "unknown"
// before it reaches the logs or the redirect.
const ERROR_CODE_PATTERN = /^[a-z0-9_]{1,64}$/;

function errorCodeParam(value: string | null): string | null {
  if (!value) return null;
  return ERROR_CODE_PATTERN.test(value) ? value : "unknown";
}

export const GET: APIRoute = async (context) => {
  const params = context.url.searchParams;

  // A cancelled consent gives only `error=access_denied`; Supabase's own failures add `error_code`.
  const errorParam = errorCodeParam(params.get("error"));
  const errorCodeValue = errorCodeParam(params.get("error_code"));
  const providerError = errorCodeValue ?? errorParam;
  if (providerError) {
    // Codes only: error_description is free text from the provider and may name the account.
    // eslint-disable-next-line no-console
    console.error("oauth callback error:", { error: errorParam, error_code: errorCodeValue });
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
