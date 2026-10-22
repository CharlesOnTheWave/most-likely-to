import type { APIRoute } from "astro";
import { actionAnswer, bodyNick, OUTSIDE_ROOM, readJsonBody, refuseForeignPost } from "@/lib/rooms/json-route";
import { rejectLatecomer, ringLobby } from "@/lib/rooms/server";
import { UUID_PATTERN } from "@/lib/rooms/tokens";
import { createClient } from "@/lib/supabase";

const OP = "reject";

// "Odrzuć", for the room's host (the session), while the game is in play (S-08), with no question first: the request
// with this nick is turned away, the latecomer's screen says so, and they may ask again. The body as in admit.ts
// ({nick}, never logged). A request already answered is request_unknown. JSON from the room screen: {ok: true} or
// {error: code} (src/lib/rooms/json-route.ts).
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
  const result = await rejectLatecomer(supabase, roomId, nick);
  // The latecomer's waiting screen shows the refusal, and the host's other screens drop the request from the list.
  if (result.ok) await ringLobby(context.locals, supabase, roomId);
  return actionAnswer(OP, roomId, result);
};
