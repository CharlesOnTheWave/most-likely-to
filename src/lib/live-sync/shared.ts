// Names and validation shared by the server, the demo island and the probe. No server imports, so safe in the browser.

export const LIVE_SYNC_TOPIC_PREFIX = "live-sync:";
export const BELL_EVENT = "bell";
// A player's emote to the whole room (S-16), payload { emote, nick }. As untrusted as the bell: anyone with the
// publishable key may send it on the public channel, so the screen shows only what parseEmoteMessage
// (src/lib/rooms/emotes.ts) takes. It changes nothing in the room's state, so it never makes a screen fetch.
export const EMOTE_EVENT = "emote";
// How often an open room screen (the lobby or a game in play) fetches its state on its own, and the slowest the limiter
// gets after bells that changed nothing. The bell is the fast path; the poll catches a missed bell, a dropped connection
// and a phone that slept. The E2E seed reads it to tell the bell from the poll.
export const LOBBY_POLL_MS = 15000;

const ROOM_ID_PATTERN = /^[a-z0-9-]{1,64}$/;

export function isValidRoomId(room: unknown): room is string {
  return typeof room === "string" && ROOM_ID_PATTERN.test(room);
}

export function isValidSeq(seq: unknown): seq is number {
  return typeof seq === "number" && Number.isSafeInteger(seq) && seq > 0;
}

export function topicFor(room: string): string {
  return `${LIVE_SYNC_TOPIC_PREFIX}${room}`;
}

export interface LiveSyncState {
  room: string;
  seq: number;
  question: string;
}
