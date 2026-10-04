import type { APIRoute } from "astro";
import { ringRoom } from "@/lib/live-sync/server";
import { isValidRoomId, isValidSeq } from "@/lib/live-sync/shared";
import { createClient } from "@/lib/supabase";

// Only a signed-in user rings through this endpoint; the public channel itself does not enforce it.
export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Sign in to ring" }, { status: 401 });
  }

  const body = (await context.request.json().catch(() => null)) as { room?: unknown; seq?: unknown } | null;
  const room = body?.room;
  const seq = body?.seq;
  if (!isValidRoomId(room) || !isValidSeq(seq)) {
    return Response.json({ error: "Invalid room or seq" }, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const result = await ringRoom(supabase, room, seq);
  return Response.json(result, { status: result.ok ? 200 : 502 });
};
