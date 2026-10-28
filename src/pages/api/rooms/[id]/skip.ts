import type { APIRoute } from "astro";
import { actionAnswer, bodyRound, OUTSIDE_ROOM, readJsonBody, refuseForeignPost } from "@/lib/rooms/json-route";
import { leaderSelection, ringLobby, skipRound } from "@/lib/rooms/server";
import { PLAYER_TOKEN_PATTERN, playerCookieName, UUID_PATTERN } from "@/lib/rooms/tokens";
import { shuffledQuestions } from "@/lib/rounds/draw";
import { createClient } from "@/lib/supabase";

const OP = "skip";

// "Pomiń pytanie", for the room's leader: the host by the session, a co-host by the room's cookie (S-07), while the
// round on the leader's screen is voting. Its votes are gone and the next question opens at once from the game's pool
// in random order, as in next.ts (decisions D2 and D3 of context/archive/2026-10-15-full-game-evening/research.md). The
// body carries that round's number ({round}), so the same skip sent twice never skips the question after it
// (round_over). JSON from the room screen: {ok: true} or {error: code} (src/lib/rooms/json-route.ts).
export const POST: APIRoute = async (context) => {
  const refused = refuseForeignPost(context, OP);
  if (refused) return refused;

  const roomId = context.params.id ?? "";
  if (!UUID_PATTERN.test(roomId)) return actionAnswer(OP, undefined, OUTSIDE_ROOM);

  const body = await readJsonBody(context, OP);
  if (!body.ok) return body.response;
  const round = bodyRound(body.body);
  if (typeof round !== "number") return actionAnswer(OP, roomId, { ok: false, reason: "invalid_body" });

  // A cookie in another form is not ours (skip_round would raise on it), so it counts as none.
  const cookie = context.cookies.get(playerCookieName(roomId))?.value;
  const playerToken = cookie !== undefined && PLAYER_TOKEN_PATTERN.test(cookie) ? cookie : null;
  if (!context.locals.user && !playerToken) return actionAnswer(OP, roomId, OUTSIDE_ROOM);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return actionAnswer(OP, roomId, { ok: false, reason: "service_unavailable" });

  // Only a leader gets the room's categories: anyone outside the room ends here as outside it, and a guest of the
  // room without the co-host role as not_leader.
  const room = await leaderSelection(supabase, roomId, playerToken);
  if (!room.ok) return actionAnswer(OP, roomId, room);

  const result = await skipRound(supabase, roomId, round, shuffledQuestions(room.selection, Math.random), playerToken);
  if (result.ok) await ringLobby(context.locals, supabase, roomId);
  return actionAnswer(OP, roomId, result);
};
