import type { ParseResult } from "@/lib/rooms/shared";
import { UUID_PATTERN } from "@/lib/rooms/tokens";

// What a player's screen may report to POST /api/client-events (decision D4 in
// context/archive/2026-10-13-first-live-round/research.md; audit L1, L2, L4): only these events and states and a room's
// id. The endpoint is public, so nothing free-form gets through: a message or any other field could carry a nick or a
// vote's target into the log. Server side; a screen imports only the types.
export const CLIENT_EVENTS = ["realtime_status", "refresh_failed", "island_crash"] as const;
// The channel's states other than SUBSCRIBED, and a failed refresh by HTTP class or the network.
export const CLIENT_STATES = ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED", "http_4xx", "http_5xx", "network"] as const;

export type ClientEventName = (typeof CLIENT_EVENTS)[number];
export type ClientState = (typeof CLIENT_STATES)[number];

export interface ClientEvent {
  event: ClientEventName;
  state?: ClientState;
  roomId?: string;
}

const KEYS: readonly string[] = ["event", "state", "roomId"];

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

// The report with only the listed keys and values, or the field that failed. An extra key fails as "keys", never by
// its name: the name comes from the request too.
export function parseClientEvent(value: unknown): ParseResult<ClientEvent> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, field: "root" };
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !KEYS.includes(key))) return { ok: false, field: "keys" };

  const { event, state, roomId } = record;
  if (!isOneOf(CLIENT_EVENTS, event)) return { ok: false, field: "event" };
  const report: ClientEvent = { event };
  if (state !== undefined) {
    if (!isOneOf(CLIENT_STATES, state)) return { ok: false, field: "state" };
    report.state = state;
  }
  if (roomId !== undefined) {
    if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) return { ok: false, field: "roomId" };
    report.roomId = roomId;
  }
  return { ok: true, value: report };
}
