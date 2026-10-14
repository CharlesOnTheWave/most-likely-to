import type { APIContext } from "astro";
import { logEvent } from "@/lib/log";
import type { ActionResult, RoomFailure } from "@/lib/rooms/server";

// What the JSON routes of the room screen share: the start, vote and reveal actions (src/pages/api/rooms/[id]/*.ts),
// the room's state and the screens' reports (src/pages/api/client-events.ts). Every answer is JSON and never cached;
// an error is a code from src/lib/rooms/errors.ts, never free text.

const NO_STORE = { "Cache-Control": "no-store" };

// A vote is ~100 characters; anything much longer is not our screen.
const MAX_BODY_LENGTH = 4096;

// Someone outside the room (no session and no cookie of the room, another host's room, no such room): the same 404 as
// for a room that does not exist, so the answer does not tell which rooms exist.
export const OUTSIDE_ROOM: RoomFailure = { ok: false, reason: "room_unknown" };

export function jsonAnswer(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

// Astro's checkOrigin stops a cross-site POST only for form content types
// (node_modules/astro/dist/core/app/origin-check.js), so a JSON route checks the content type and the Origin itself.
// Every browser sends Origin on a POST from fetch, so a missing one counts as foreign. Answers null when the request
// may go on.
export function refuseForeignPost(context: APIContext, op: string): Response | null {
  const contentType = context.request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    logEvent("warn", { op, step: "content_type", status: 415 });
    return jsonAnswer({ error: "unsupported_media_type" }, 415);
  }
  if (context.request.headers.get("Origin") !== context.url.origin) {
    logEvent("warn", { op, step: "origin", status: 403 });
    return jsonAnswer({ error: "forbidden" }, 403);
  }
  return null;
}

// The request's JSON body, or a 400 to send back. Only the error's name is logged, never the body.
export async function readJsonBody(
  context: APIContext,
  op: string,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const invalid = { ok: false as const, response: jsonAnswer({ error: "invalid_body" }, 400) };
  let text: string;
  try {
    text = await context.request.text();
  } catch (error) {
    logEvent("warn", { op, step: "body", status: 400, errName: error instanceof Error ? error.name : "unknown" });
    return invalid;
  }
  if (text.length > MAX_BODY_LENGTH) {
    logEvent("warn", { op, step: "body", status: 400, code: "too_large" });
    return invalid;
  }
  try {
    const body: unknown = JSON.parse(text);
    return { ok: true, body };
  } catch (error) {
    logEvent("warn", { op, step: "body", status: 400, errName: error instanceof Error ? error.name : "unknown" });
    return invalid;
  }
}

function statusFor(reason: string): number {
  if (reason === "room_unknown") return 404;
  if (reason === "invalid_body") return 400;
  if (reason === "service_unavailable") return 503;
  if (reason === "unexpected") return 500;
  return 409;
}

// The answer to one attempt of a round's action, and its one log line {op, outcome, roomId}: "ok" or the refusal code,
// never the vote's target or who sent it. 200 {ok: true}; a refusal 409 {error: code}; someone outside the room 404; a
// body that is not ours 400; a failure 503 or 500 (already logged with its status and code by src/lib/rooms/server.ts).
// roomId is left out when it did not match the pattern of a room id.
export function actionAnswer(op: string, roomId: string | undefined, result: ActionResult): Response {
  if (result.ok) {
    logEvent("info", { op, outcome: "ok", roomId });
    return jsonAnswer({ ok: true });
  }
  const status = statusFor(result.reason);
  logEvent(status >= 500 ? "error" : "info", { op, outcome: result.reason, roomId, status });
  return jsonAnswer({ error: status === 404 ? "not_found" : result.reason }, status);
}
