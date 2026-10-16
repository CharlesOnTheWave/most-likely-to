import type { APIRoute } from "astro";
import { actionAnswer, bodyRound, OUTSIDE_ROOM, readJsonBody, refuseForeignPost } from "@/lib/rooms/json-route";
import { hostRoomCategories, ringLobby, skipRound } from "@/lib/rooms/server";
import { UUID_PATTERN } from "@/lib/rooms/tokens";
import { shuffledQuestions } from "@/lib/rounds/draw";
import { createClient } from "@/lib/supabase";

const OP = "skip";

// "Pomiń pytanie", for the room's host (the session), while the round on the host's screen is voting. Its votes are
// gone and the next question opens at once from the game's pool in random order, as in next.ts (decisions D2 and D3 of
// context/archive/2026-10-15-full-game-evening/research.md). The body carries that round's number ({round}), so the
// same skip sent twice never skips the question after it (round_over). JSON from the room screen: {ok: true} or
// {error: code} (src/lib/rooms/json-route.ts).
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

  // Only the host sees the room's row, so anyone else ends here as outside the room.
  const room = await hostRoomCategories(supabase, roomId);
  if (!room.ok) return actionAnswer(OP, roomId, room);
  if (!room.selection) return actionAnswer(OP, roomId, OUTSIDE_ROOM);

  const result = await skipRound(supabase, roomId, round, shuffledQuestions(room.selection, Math.random));
  if (result.ok) await ringLobby(context.locals, supabase, roomId);
  return actionAnswer(OP, roomId, result);
};
