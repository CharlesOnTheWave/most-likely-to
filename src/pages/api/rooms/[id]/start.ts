import type { APIRoute } from "astro";
import { actionAnswer, OUTSIDE_ROOM, refuseForeignPost } from "@/lib/rooms/json-route";
import { hostRoomCategories, ringLobby, startGame } from "@/lib/rooms/server";
import { UUID_PATTERN } from "@/lib/rooms/tokens";
import { drawQuestion } from "@/lib/rounds/draw";
import { createClient } from "@/lib/supabase";

const OP = "start";

// "Zacznij grę", for the room's host (the session). The Worker draws the question from the room's categories
// (src/lib/rounds/draw.ts); start_game checks the room and the players (at least 3), fixes who may vote and opens
// round 1. JSON from the room screen: {ok: true} or {error: code} (src/lib/rooms/json-route.ts).
export const POST: APIRoute = async (context) => {
  const refused = refuseForeignPost(context, OP);
  if (refused) return refused;

  const roomId = context.params.id ?? "";
  if (!UUID_PATTERN.test(roomId)) return actionAnswer(OP, undefined, OUTSIDE_ROOM);
  if (!context.locals.user) return actionAnswer(OP, roomId, OUTSIDE_ROOM);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return actionAnswer(OP, roomId, { ok: false, reason: "service_unavailable" });

  // Only the host sees the room's row, so anyone else ends here as outside the room.
  const room = await hostRoomCategories(supabase, roomId);
  if (!room.ok) return actionAnswer(OP, roomId, room);
  if (!room.selection) return actionAnswer(OP, roomId, OUTSIDE_ROOM);

  const questionId = drawQuestion(room.selection, Math.random);
  if (!questionId) return actionAnswer(OP, roomId, { ok: false, reason: "no_questions" });

  const result = await startGame(supabase, roomId, questionId);
  if (result.ok) await ringLobby(context.locals, supabase, roomId);
  return actionAnswer(OP, roomId, result);
};
