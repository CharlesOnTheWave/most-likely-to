import type { APIRoute } from "astro";
import { joinRoom, requestJoin, ringLobby, roomLink, roomLobby } from "@/lib/rooms/server";
import {
  LINK_TOKEN_PATTERN,
  newPlayerToken,
  PLAYER_TOKEN_PATTERN,
  playerCookieName,
  playerCookieOptions,
} from "@/lib/rooms/tokens";
import { createClient } from "@/lib/supabase";

// A guest joins a room in the lobby through the host's link and gets the room's cookie. Once the game is in play, the
// same form sends a latecomer's request to join, which the host answers on the room screen (S-08). Only an error code
// and the link code (checked against its pattern) go into the URL, never the nick; /j/<code> turns the code into a
// Polish message (src/lib/rooms/errors.ts).
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
  if (room.status === "closed") return backToLink("room_closed");
  if (room.status === "unknown") return backToLink("room_unknown");

  // Someone already in the room (a guest whose cookie still works, or the host) goes back to it without a second entry:
  // a double tap on "Dołącz", or the link opened again, also once the game has started. Same rule as the /j/<code>
  // page.
  const playerToken = context.cookies.get(playerCookieName(room.roomId))?.value;
  if (context.locals.user || playerToken) {
    const inside = await roomLobby(supabase, room.roomId, playerToken);
    if (!inside.ok) return backToLink(inside.reason);
    if (inside.lobby) return context.redirect(`/r/${room.roomId}`);
  }

  // A game in play takes no one new through join_room (game_started): a latecomer asks the host instead. The request's
  // token is the one in the room's cookie when it has our form (a request asked before, e.g. turned away and asking
  // again), else a new one, because request_join raises on any other form. Once the host lets them in it is the
  // player's token, so the same cookie opens the room. Back to the link with a 303, whose page shows the waiting
  // screen; a refusal goes back with its code, above the form.
  if (room.status === "started") {
    const requestToken =
      playerToken !== undefined && PLAYER_TOKEN_PATTERN.test(playerToken) ? playerToken : newPlayerToken();
    const asked = await requestJoin(supabase, link, typeof nick === "string" ? nick : "", requestToken);
    if (!asked.ok) return backToLink(asked.reason);

    context.cookies.set(playerCookieName(room.roomId), requestToken, playerCookieOptions(context.url));
    // The host's screen fetches its list of requests again.
    await ringLobby(context.locals, supabase, room.roomId);
    return context.redirect(`/j/${link}`, 303);
  }

  // A room in the lobby. If the game starts between these two calls, join_room says game_started, and the link's page
  // shows the request form under it.
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
