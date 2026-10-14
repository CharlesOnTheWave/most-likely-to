import type { APIRoute } from "astro";
import { parseClientEvent } from "@/lib/client-events";
import { logEvent } from "@/lib/log";
import { jsonAnswer, readJsonBody, refuseForeignPost } from "@/lib/rooms/json-route";

const OP = "client";

// A player's screen reports a broken live connection, a failed refresh or a crashed island (decision D4 in
// context/changes/first-live-round/research.md; audit L1, L2, L4), so the owner finds it in Workers Logs. Open to
// guests (no session needed), JSON from the app's own pages only. A valid report is one line {op, event, state,
// roomId} and a 204; anything else a 400, logged with the field that failed and never with the body. The screen limits
// how often it reports (a visible tab, at most a few per event).
export const POST: APIRoute = async (context) => {
  const refused = refuseForeignPost(context, OP);
  if (refused) return refused;

  const body = await readJsonBody(context, OP);
  if (!body.ok) return body.response;

  const report = parseClientEvent(body.body);
  if (!report.ok) {
    logEvent("warn", { op: OP, outcome: "invalid", field: report.field, status: 400 });
    return jsonAnswer({ error: "invalid_event" }, 400);
  }

  const { event, state, roomId } = report.value;
  logEvent(event === "island_crash" ? "error" : "warn", { op: OP, event, state, roomId });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
};
