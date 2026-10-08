import type { APIRoute } from "astro";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { authErrorCode } from "@/lib/auth-errors";

// Only the providers enabled in the Supabase panel; anything else from the form never reaches Supabase.
const PROVIDERS = ["discord", "google"] as const satisfies readonly Provider[];
type HostProvider = (typeof PROVIDERS)[number];

function isHostProvider(value: unknown): value is HostProvider {
  return PROVIDERS.some((provider) => provider === value);
}

// Starts sign-in with Discord or Google: 302 to Supabase, which sends the host on to the provider and back to
// /api/auth/callback. Only an error code goes into the URL; /auth/signin turns it into a Polish message.
export const POST: APIRoute = async (context) => {
  // A body that is not a form (JSON, no Content-Type) counts as no provider, not a 500.
  const form = await context.request.formData().catch(() => null);
  const provider = form?.get("provider");

  if (!isHostProvider(provider)) {
    return context.redirect("/auth/signin?error=unsupported_provider");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/auth/signin?error=config_missing");
  }
  // On the server this only builds the URL. The PKCE verifier goes to context.cookies (setAll in src/lib/supabase.ts)
  // before the call returns, so it leaves with the 302 below and the callback can exchange the code.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: new URL("/api/auth/callback", context.url).href,
      // Google otherwise signs in silently with the last account, which on a shared device may be someone else's.
      queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
    },
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("oauth start failed:", { name: error.name, status: error.status, code: error.code });
    return context.redirect(`/auth/signin?error=${encodeURIComponent(authErrorCode(error))}`);
  }

  return context.redirect(data.url);
};
