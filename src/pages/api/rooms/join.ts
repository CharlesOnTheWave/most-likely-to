import type { APIRoute } from "astro";
import { joinRoom, ringLobby, roomLink, roomLobby } from "@/lib/rooms/server";
import { LINK_TOKEN_PATTERN, newPlayerToken, playerCookieName, playerCookieOptions } from "@/lib/rooms/tokens";
import { createClient } from "@/lib/supabase";

// A guest joins through the host's link and gets the room's cookie. Only an error code and the link code (checked
// against its pattern) go into the URL, never the nick; /j/<code> turns the code into a Polish message
// (src/lib/rooms/errors.ts).
export const POST: APIRoute = async (context) => {
  // A body that is not a form counts as empty fields, not a 500. The nick rule lives in the database.
  const form = await context.request.formData().catch(() => null);
  const link = form?.get("link");
  const nick = form?.get("nick");
  if (typeof link !== "string" || !LINK_TOKEN_PATTERN.test(link)) {
    return context.redirect("/j/invalid");
  }
  const backToLink = (reason: string) => context.redirect(`/j/${link}?error=${encodeURIComponent(reason)}`);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return backToLink("service_unavailable");
  }

  const room = await roomLink(supabase, link);
  if (!room.ok) return backToLink(room.reason);
  if (room.status !== "open") return backToLink(room.status === "closed" ? "room_closed" : "room_unknown");

  // Someone already in the room (a guest whose cookie still works, or the host) goes back to it without a second entry:
  // a double tap on "Dołącz", or the link opened again. Same rule as the /j/<code> page.
  const playerToken = context.cookies.get(playerCookieName(room.roomId))?.value;
  if (context.locals.user || playerToken) {
    const inside = await roomLobby(supabase, room.roomId, playerToken);
    if (!inside.ok) return backToLink(inside.reason);
    if (inside.lobby) return context.redirect(`/r/${room.roomId}`);
  }

  const newToken = newPlayerToken();
  const result = await joinRoom(supabase, {
    linkToken: link,
    nick: typeof nick === "string" ? nick : "",
    playerToken: newToken,
  });
  if (!result.ok) {
    return backToLink(result.reason);
  }

  context.cookies.set(playerCookieName(result.roomId), newToken, playerCookieOptions(context.url));
  // The host and the players already in the room fetch the list again.
  await ringLobby(context.locals, supabase, result.roomId);
  return context.redirect(`/r/${result.roomId}`);
};
