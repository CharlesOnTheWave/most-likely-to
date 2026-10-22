import type { APIRoute } from "astro";
import { actionAnswer, bodyNick, OUTSIDE_ROOM, readJsonBody, refuseForeignPost } from "@/lib/rooms/json-route";
import { admitLatecomer, ringLobby } from "@/lib/rooms/server";
import { UUID_PATTERN } from "@/lib/rooms/tokens";
import { createClient } from "@/lib/supabase";

const OP = "admit";

// "Wpuść", for the room's host (the session), while the game is in play (S-08): the latecomer whose request has this
// nick becomes a player, sees the round in progress and votes from the next question on. The body carries the nick as
// it stands on the host's list ({nick}); it goes only into admit_latecomer's POST body, never into a URL or a log line.
// A request already answered (a double tap, the host's second screen) is request_unknown. JSON from the room screen:
// {ok: true} or {error: code} (src/lib/rooms/json-route.ts).
export const POST: APIRoute = async (context) => {
  const refused = refuseForeignPost(context, OP);
  if (refused) return refused;

  const roomId = context.params.id ?? "";
  if (!UUID_PATTERN.test(roomId)) return actionAnswer(OP, undefined, OUTSIDE_ROOM);

  const body = await readJsonBody(context, OP);
  if (!body.ok) return body.response;
  const nick = bodyNick(body.body);
  if (nick === undefined) return actionAnswer(OP, roomId, { ok: false, reason: "invalid_body" });

  if (!context.locals.user) return actionAnswer(OP, roomId, OUTSIDE_ROOM);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return actionAnswer(OP, roomId, { ok: false, reason: "service_unavailable" });

  // Another host's room answers room_unknown from the database, the same 404 as no room at all.
  const result = await admitLatecomer(supabase, roomId, nick);
  // The latecomer's waiting screen moves on to the room, and every screen shows the new player.
  if (result.ok) await ringLobby(context.locals, supabase, roomId);
  return actionAnswer(OP, roomId, result);
};
