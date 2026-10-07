import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  // A signed-in host has nothing to do on the sign-in screens and goes home. Sign-in errors (S-05, and Supabase's OAuth
  // state errors) come back to /auth/signin with ?error= or ?error_code=, so those still reach a host with a session.
  const { pathname, searchParams } = context.url;
  if (
    context.locals.user &&
    pathname.startsWith("/auth/") &&
    !searchParams.has("error") &&
    !searchParams.has("error_code")
  ) {
    return context.redirect("/");
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
