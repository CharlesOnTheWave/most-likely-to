import type { APIRoute } from "astro";
import { stateFor } from "@/lib/live-sync/server";
import { isValidRoomId, isValidSeq } from "@/lib/live-sync/shared";

const NO_STORE = { "Cache-Control": "no-store" };

// The board a player fetches after each bell; open to guests.
export const GET: APIRoute = (context) => {
  const room = context.url.searchParams.get("room");
  const seqParam = context.url.searchParams.get("seq") ?? "";
  const seq = /^\d{1,16}$/.test(seqParam) ? Number(seqParam) : NaN;
  if (!isValidRoomId(room) || !isValidSeq(seq)) {
    return Response.json({ error: "Invalid room or seq" }, { status: 400, headers: NO_STORE });
  }
  return Response.json(stateFor(room, seq), { headers: NO_STORE });
};
