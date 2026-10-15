import type { APIRoute } from "astro";
import { actionAnswer, bodyRound, OUTSIDE_ROOM, readJsonBody, refuseForeignPost } from "@/lib/rooms/json-route";
import { castVote, ringLobby } from "@/lib/rooms/server";
import { PLAYER_TOKEN_PATTERN, playerCookieName, UUID_PATTERN } from "@/lib/rooms/tokens";
import { createClient } from "@/lib/supabase";

const OP = "vote";

// The body's target: a nick of the room, or null for an abstention. undefined when the body is not ours.
function voteTarget(body: unknown): string | null | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body) || !Object.hasOwn(body, "target")) {
    return undefined;
  }
  const { target } = body as Record<string, unknown>;
  return typeof target === "string" || target === null ? target : undefined;
}

// A vote, final once cast (decision D2): a guest by the room's cookie, the host by the session. The target comes only
// in this JSON body and goes only into cast_vote's POST body, never into a URL, a log line or the answer, which is
// {ok: true} or {error: code} (src/lib/rooms/json-route.ts). The screen confirms the vote from this answer at once
// (PRD NFR: "Oddany głos jest potwierdzony na ekranie gracza natychmiast"). The body's round is the number of the
// question on the voter's screen, so a vote never lands in a question the voter has not seen (round_over; T1 of
// context/changes/full-game-evening/research.md); a screen loaded before S-03 sends none and still votes.
export const POST: APIRoute = async (context) => {
  const refused = refuseForeignPost(context, OP);
  if (refused) return refused;

  const roomId = context.params.id ?? "";
  if (!UUID_PATTERN.test(roomId)) return actionAnswer(OP, undefined, OUTSIDE_ROOM);

  const body = await readJsonBody(context, OP);
  if (!body.ok) return body.response;
  const target = voteTarget(body.body);
  const round = bodyRound(body.body);
  if (target === undefined || round === undefined) {
    return actionAnswer(OP, roomId, { ok: false, reason: "invalid_body" });
  }

  // A cookie in another form is not ours (cast_vote would raise on it), so it counts as none.
  const cookie = context.cookies.get(playerCookieName(roomId))?.value;
  const playerToken = cookie !== undefined && PLAYER_TOKEN_PATTERN.test(cookie) ? cookie : null;
  if (!context.locals.user && !playerToken) return actionAnswer(OP, roomId, OUTSIDE_ROOM);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return actionAnswer(OP, roomId, { ok: false, reason: "service_unavailable" });

  const result = await castVote(supabase, roomId, target, playerToken, round);
  if (result.ok) await ringLobby(context.locals, supabase, roomId);
  return actionAnswer(OP, roomId, result);
};
