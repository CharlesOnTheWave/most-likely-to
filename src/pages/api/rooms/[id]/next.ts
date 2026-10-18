import type { APIRoute } from "astro";
import { actionAnswer, bodyRound, OUTSIDE_ROOM, readJsonBody, refuseForeignPost } from "@/lib/rooms/json-route";
import { hostRoomCategories, nextRound, ringLobby } from "@/lib/rooms/server";
import { UUID_PATTERN } from "@/lib/rooms/tokens";
import { shuffledQuestions } from "@/lib/rounds/draw";
import { createClient } from "@/lib/supabase";

const OP = "next";

// "Następne pytanie", for the room's host (the session), once the round on the host's screen is revealed or skipped.
// The body carries that round's number ({round}), so a double click or a resent request never moves past a question
// nobody has seen (round_over). The Worker sends the game's whole pool in random order (src/lib/rounds/draw.ts), and
// next_round opens the first question not played in this game yet (FR-015; decision D1 of
// context/archive/2026-10-15-full-game-evening/research.md). JSON from the room screen: {ok: true} or {error: code}
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

  // Only the host sees the room's row, so anyone else ends here as outside the room.
  const room = await hostRoomCategories(supabase, roomId);
  if (!room.ok) return actionAnswer(OP, roomId, room);
  if (!room.selection) return actionAnswer(OP, roomId, OUTSIDE_ROOM);

  const result = await nextRound(supabase, roomId, round, shuffledQuestions(room.selection, Math.random));
  if (result.ok) await ringLobby(context.locals, supabase, roomId);
  return actionAnswer(OP, roomId, result);
};
