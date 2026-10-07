import type { APIRoute } from "astro";
import { roomLobby } from "@/lib/rooms/server";
import { playerCookieName, UUID_PATTERN } from "@/lib/rooms/tokens";
import { createClient } from "@/lib/supabase";

const NO_STORE = { "Cache-Control": "no-store" };

// The lobby the room screen fetches after each bell and every 15 s: the database is the source of truth, the channel
// only says "check". The host is recognised by the session, a guest by the room's cookie. Anyone else, a malformed id
// and a room that does not exist get the same 404, so the endpoint does not tell which rooms exist.
export const GET: APIRoute = async (context) => {
  const roomId = context.params.id ?? "";
  if (!UUID_PATTERN.test(roomId)) {
    return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "service_unavailable" }, { status: 503, headers: NO_STORE });
  }

  const result = await roomLobby(supabase, roomId, context.cookies.get(playerCookieName(roomId))?.value);
  if (!result.ok) {
    const status = result.reason === "service_unavailable" ? 503 : 500;
    return Response.json({ error: result.reason }, { status, headers: NO_STORE });
  }
  if (!result.lobby) {
    return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }
  return Response.json(result.lobby, { headers: NO_STORE });
};
