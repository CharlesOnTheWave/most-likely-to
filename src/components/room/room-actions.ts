import { logEvent } from "@/lib/log";
import { roomErrorMessage } from "@/lib/rooms/errors";

// The game's actions from the room screen (src/pages/api/rooms/[id]/start.ts, vote.ts, reveal.ts, next.ts, skip.ts,
// end.ts, admit.ts, reject.ts): JSON from the app's own page (the routes check Content-Type and Origin), answered
// {ok: true} or {error: code}. A vote, "Odsłoń wynik", "Następne pytanie" and "Pomiń pytanie" carry the number of the
// question on the screen ({round}), so none of them lands in a question the player has not seen. The host's "Wpuść"
// (admit) and "Odrzuć" (reject) carry the latecomer's nick from the list of requests ({nick}). A vote's target goes only
// in the body: never in the URL, a log line or storage on the device (AGENTS.md, Hard Rules; S-04 shows it after a
// reload). Browser lines go through src/lib/log.ts too, so the target cannot slip into one.

export type RoomAction = "start" | "vote" | "reveal" | "next" | "skip" | "end" | "admit" | "reject";

// The screen shows a refusal by its code's text (src/lib/rooms/errors.ts), never text from the answer.
export type ActionOutcome = { ok: true } | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

// A code no map knows ("unexpected") gives the generic text.
function refused(code: string): ActionOutcome {
  return { ok: false, message: roomErrorMessage(code) ?? "" };
}

export async function sendRoomAction(roomId: string, action: RoomAction, body: unknown): Promise<ActionOutcome> {
  let res: Response;
  try {
    res = await fetch(`/api/rooms/${roomId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    logEvent("warn", { op: action, roomId, step: "fetch", errName: errorName(error) });
    return refused("unexpected");
  }

  let answer: unknown;
  try {
    answer = await res.json();
  } catch (error) {
    logEvent("warn", { op: action, roomId, step: "answer", status: res.status, errName: errorName(error) });
    return refused(res.status >= 500 ? "service_unavailable" : "unexpected");
  }
  if (res.ok && isRecord(answer) && answer.ok === true) return { ok: true };
  if (isRecord(answer) && typeof answer.error === "string") return refused(answer.error);
  logEvent("warn", { op: action, roomId, step: "answer", status: res.status, field: "error" });
  return refused("unexpected");
}
