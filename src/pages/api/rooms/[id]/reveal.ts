import type { APIRoute } from "astro";
import { actionAnswer, OUTSIDE_ROOM, refuseForeignPost } from "@/lib/rooms/json-route";
import { revealRound, ringLobby } from "@/lib/rooms/server";
import { UUID_PATTERN } from "@/lib/rooms/tokens";
import { createClient } from "@/lib/supabase";

const OP = "reveal";

// "Odsłoń wynik", for the room's host (the session), at any time and with no threshold (PRD FR-009, decision D3); a
// second reveal is ok too. JSON from the room screen: {ok: true} or {error: code} (src/lib/rooms/json-route.ts).
export const POST: APIRoute = async (context) => {
  const refused = refuseForeignPost(context, OP);
  if (refused) return refused;

  const roomId = context.params.id ?? "";
  if (!UUID_PATTERN.test(roomId)) return actionAnswer(OP, undefined, OUTSIDE_ROOM);
  if (!context.locals.user) return actionAnswer(OP, roomId, OUTSIDE_ROOM);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return actionAnswer(OP, roomId, { ok: false, reason: "service_unavailable" });

  const result = await revealRound(supabase, roomId);
  if (result.ok) await ringLobby(context.locals, supabase, roomId);
  return actionAnswer(OP, roomId, result);
};
