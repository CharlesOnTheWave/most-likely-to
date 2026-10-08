import type { APIRoute } from "astro";

// Sign-up with a password is gone: a new host creates an account with Discord or Google on the sign-in page, so old
// links and bookmarks land there instead of on a 404.
export const GET: APIRoute = (context) => context.redirect("/auth/signin");
