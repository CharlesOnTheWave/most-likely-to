import type { APIRoute } from "astro";
import { actionAnswer, bodyRound, OUTSIDE_ROOM, readJsonBody, refuseForeignPost } from "@/lib/rooms/json-route";
import { reactRound } from "@/lib/rooms/server";
import { PLAYER_TOKEN_PATTERN, playerCookieName, UUID_PATTERN } from "@/lib/rooms/tokens";
import { createClient } from "@/lib/supabase";

const OP = "react";

// The body's thumb: "up", "down", or "none" to take it back. undefined when the body is not ours.
function bodyReaction(body: unknown): "up" | "down" | "none" | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body) || !Object.hasOwn(body, "reaction")) {
    return undefined;
  }
  const { reaction } = body as Record<string, unknown>;
  return reaction === "up" || reaction === "down" || reaction === "none" ? reaction : undefined;
}

// A thumb on the question just revealed (S-11, PRD FR-016 and FR-018): a guest by the room's cookie, the host by the
// session, a latecomer let in during the round too. The thumb comes only in this JSON body and goes only into
// react_round's POST body, never into a URL, a log line or the answer, which is {ok: true} or {error: code}
// (src/lib/rooms/json-route.ts). Nobody else sees it, so no bell: the room's state does not change. The body's round is
// the number of the question on the player's screen, so a thumb never lands on a question the player has not seen
// (round_over). A body without one is not our screen's (invalid_body).
export const POST: APIRoute = async (context) => {
  const refused = refuseForeignPost(context, OP);
  if (refused) return refused;

  const roomId = context.params.id ?? "";
  if (!UUID_PATTERN.test(roomId)) return actionAnswer(OP, undefined, OUTSIDE_ROOM);

  const body = await readJsonBody(context, OP);
  if (!body.ok) return body.response;
  const reaction = bodyReaction(body.body);
  const round = bodyRound(body.body);
  if (reaction === undefined || typeof round !== "number") {
    return actionAnswer(OP, roomId, { ok: false, reason: "invalid_body" });
  }

  // A cookie in another form is not ours (react_round would raise on it), so it counts as none.
  const cookie = context.cookies.get(playerCookieName(roomId))?.value;
  const playerToken = cookie !== undefined && PLAYER_TOKEN_PATTERN.test(cookie) ? cookie : null;
  if (!context.locals.user && !playerToken) return actionAnswer(OP, roomId, OUTSIDE_ROOM);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return actionAnswer(OP, roomId, { ok: false, reason: "service_unavailable" });

  const result = await reactRound(supabase, roomId, round, reaction, playerToken);
  return actionAnswer(OP, roomId, result);
};
