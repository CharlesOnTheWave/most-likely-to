import type { APIRoute } from "astro";
import { actionAnswer, bodyRound, OUTSIDE_ROOM, readJsonBody, refuseForeignPost } from "@/lib/rooms/json-route";
import { revealRound, ringLobby } from "@/lib/rooms/server";
import { UUID_PATTERN } from "@/lib/rooms/tokens";
import { createClient } from "@/lib/supabase";

const OP = "reveal";

// "Odsłoń wynik", for the room's host (the session), at any time and with no threshold (PRD FR-009, decision D3); a
// second reveal is ok too. The body carries the number of the round on the host's screen ({round}), so a screen behind
// the game never reveals a question it has not shown, and a skipped one has nothing to reveal (round_over; F2 of
// context/archive/2026-10-20-deferred-review-fixes/plan.md). JSON from the room screen: {ok: true} or {error: code}
// (src/lib/rooms/json-route.ts).
export const POST: APIRoute = async (context) => {
  const refused = refuseForeignPost(context, OP);
  if (refused) return refused;

  const roomId = context.params.id ?? "";
  if (!UUID_PATTERN.test(roomId)) return actionAnswer(OP, undefined, OUTSIDE_ROOM);

  const body = await readJsonBody(context, OP);
  if (!body.ok) return body.response;
  const round = bodyRound(body.body);
  if (typeof round !== "number") return actionAnswer(OP, roomId, { ok: false, reason: "invalid_body" });

  if (!context.locals.user) return actionAnswer(OP, roomId, OUTSIDE_ROOM);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return actionAnswer(OP, roomId, { ok: false, reason: "service_unavailable" });

  const result = await revealRound(supabase, roomId, round);
  if (result.ok) await ringLobby(context.locals, supabase, roomId);
  return actionAnswer(OP, roomId, result);
};
