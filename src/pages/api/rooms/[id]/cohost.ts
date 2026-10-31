import type { APIRoute } from "astro";
import { actionAnswer, bodyNick, OUTSIDE_ROOM, readJsonBody, refuseForeignPost } from "@/lib/rooms/json-route";
import { ringLobby, setCohost } from "@/lib/rooms/server";
import { UUID_PATTERN } from "@/lib/rooms/tokens";
import { createClient } from "@/lib/supabase";

const OP = "cohost";

// The body's role: true gives it, false takes it. undefined when the body is not ours.
function bodyCohost(body: unknown): boolean | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body) || !Object.hasOwn(body, "cohost")) {
    return undefined;
  }
  const { cohost } = body as Record<string, unknown>;
  return typeof cohost === "boolean" ? cohost : undefined;
}

// The host's role button by a guest's nick (S-07), for the room's host only (the session), in the lobby and while the
// game is in play: {nick, cohost: true} gives the guest the co-host role, {nick, cohost: false} takes it, and the same
// value twice is ok. The nick, as it stands on the host's list of players, goes only into set_cohost's POST body, never
// into a URL or a log line. A nick no guest of the room has (gone, or the host's own) is player_unknown. Every screen
// learns the change from the bell, the co-host's own too. JSON from the room screen: {ok: true} or {error: code}
// (src/lib/rooms/json-route.ts).
export const POST: APIRoute = async (context) => {
  const refused = refuseForeignPost(context, OP);
  if (refused) return refused;

  const roomId = context.params.id ?? "";
  if (!UUID_PATTERN.test(roomId)) return actionAnswer(OP, undefined, OUTSIDE_ROOM);

  const body = await readJsonBody(context, OP);
  if (!body.ok) return body.response;
  const nick = bodyNick(body.body);
  const cohost = bodyCohost(body.body);
  if (nick === undefined || cohost === undefined) {
    return actionAnswer(OP, roomId, { ok: false, reason: "invalid_body" });
  }

  // Only the host gives and takes the role: a co-host's cookie does not count here.
  if (!context.locals.user) return actionAnswer(OP, roomId, OUTSIDE_ROOM);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return actionAnswer(OP, roomId, { ok: false, reason: "service_unavailable" });

  // Another host's room answers room_unknown from the database, the same 404 as no room at all.
  const result = await setCohost(supabase, roomId, nick, cohost);
  if (result.ok) await ringLobby(context.locals, supabase, roomId);
  return actionAnswer(OP, roomId, result);
};
