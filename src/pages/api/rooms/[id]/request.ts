import type { APIRoute } from "astro";
import { jsonAnswer } from "@/lib/rooms/json-route";
import { joinRequestState } from "@/lib/rooms/server";
import { PLAYER_TOKEN_PATTERN, playerCookieName, UUID_PATTERN } from "@/lib/rooms/tokens";
import { createClient } from "@/lib/supabase";

// A latecomer's own request (S-08), which the waiting screen on /j/<code> (JoinWaiting) fetches after each bell and
// every 15 s: the state of the request whose token is in the room's cookie (JoinRequestState, src/lib/rooms/shared.ts).
// Never the question, the players or anyone else's request: whoever is still outside sees nothing of the game. No
// cookie, or one in another form than ours, has no request: { state: "none" } without asking the database. A malformed
// id gets the same 404 as the room's state (lobby.ts).
export const GET: APIRoute = async (context) => {
  const roomId = context.params.id ?? "";
  if (!UUID_PATTERN.test(roomId)) {
    return jsonAnswer({ error: "not_found" }, 404);
  }

  const playerToken = context.cookies.get(playerCookieName(roomId))?.value;
  if (playerToken === undefined || !PLAYER_TOKEN_PATTERN.test(playerToken)) {
    return jsonAnswer({ state: "none" });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonAnswer({ error: "service_unavailable" }, 503);
  }

  const result = await joinRequestState(supabase, roomId, playerToken);
  if (!result.ok) {
    return jsonAnswer({ error: result.reason }, result.reason === "service_unavailable" ? 503 : 500);
  }
  return jsonAnswer(result.request);
};
