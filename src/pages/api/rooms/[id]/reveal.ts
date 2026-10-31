import type { APIRoute } from "astro";
import { actionAnswer, bodyRound, OUTSIDE_ROOM, readJsonBody, refuseForeignPost } from "@/lib/rooms/json-route";
import { revealRound, ringLobby } from "@/lib/rooms/server";
import { PLAYER_TOKEN_PATTERN, playerCookieName, UUID_PATTERN } from "@/lib/rooms/tokens";
import { createClient } from "@/lib/supabase";

const OP = "reveal";

// "Odsłoń wynik", for the room's leader: the host by the session, a co-host by the room's cookie (S-07), at any time
// and with no threshold (PRD FR-009, decision D3); a second reveal is ok too. reveal_round decides who leads: a guest
// of the room without the co-host role gets not_leader. The body carries the number of the round on the leader's
// screen ({round}), so a screen behind the game never reveals a question it has not shown, and a skipped one has
// nothing to reveal (round_over; F2 of context/archive/2026-10-20-deferred-review-fixes/plan.md). JSON from the room
// screen: {ok: true} or {error: code} (src/lib/rooms/json-route.ts).
export const POST: APIRoute = async (context) => {
  const refused = refuseForeignPost(context, OP);
  if (refused) return refused;

  const roomId = context.params.id ?? "";
  if (!UUID_PATTERN.test(roomId)) return actionAnswer(OP, undefined, OUTSIDE_ROOM);

  const body = await readJsonBody(context, OP);
  if (!body.ok) return body.response;
  const round = bodyRound(body.body);
  if (typeof round !== "number") return actionAnswer(OP, roomId, { ok: false, reason: "invalid_body" });

  // A cookie in another form is not ours (reveal_round would raise on it), so it counts as none.
  const cookie = context.cookies.get(playerCookieName(roomId))?.value;
  const playerToken = cookie !== undefined && PLAYER_TOKEN_PATTERN.test(cookie) ? cookie : null;
  if (!context.locals.user && !playerToken) return actionAnswer(OP, roomId, OUTSIDE_ROOM);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return actionAnswer(OP, roomId, { ok: false, reason: "service_unavailable" });

  const result = await revealRound(supabase, roomId, round, playerToken);
  if (result.ok) await ringLobby(context.locals, supabase, roomId);
  return actionAnswer(OP, roomId, result);
};
