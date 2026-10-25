import { logEvent } from "@/lib/log";
import { NICK_MAX_LENGTH, nickLength } from "@/lib/rooms/shared";

// The remembered nick (S-14, FR-024): the last nick the database took in this browser, which the join form and
// "Nowa gra" suggest in an empty field. Only the nick is ever stored, under one key: never a vote, its target, a token
// or anything else about the game (AGENTS.md, Hard Rules; roadmap S-14). Storage that refuses (private mode, blocked
// site data, a full quota) only means no suggestion: nothing here throws to the screen, and a failure leaves a log line
// with its step and the error's name, never the nick.

export const REMEMBERED_NICK_KEY = "mlt-nick";

// The only two calls the module makes, so a unit test can pass a fake in place of the browser's storage.
export type NickStorage = Pick<Storage, "getItem" | "setItem">;

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

// A nick the form would take, by the part of the nick rule a browser can apply (nickLength); the database has the
// final word. Anything else is neither written nor suggested.
function isNick(value: string): boolean {
  const length = nickLength(value);
  return length >= 1 && length <= NICK_MAX_LENGTH;
}

// The browser's storage, or null on the server and when even reaching it throws (blocked site data). The one line that
// reaches it; the rest of the module works on what this returns.
export function browserNickStorage(): NickStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch (error) {
    logEvent("warn", { op: "remembered_nick", step: "open", errName: errorName(error) });
    return null;
  }
}

// The remembered nick as it was stored, or null when there is none, when it is not a nick the form would take (edited
// by hand, left by an older rule) or when the storage refuses.
export function readRememberedNick(storage: NickStorage | null): string | null {
  if (storage === null) return null;
  let value: string | null;
  try {
    value = storage.getItem(REMEMBERED_NICK_KEY);
  } catch (error) {
    logEvent("warn", { op: "remembered_nick", step: "read", errName: errorName(error) });
    return null;
  }
  return value !== null && isNick(value) ? value : null;
}

// Remembers a nick the database took, with one write under the module's key and nothing else; a value the form would
// refuse is not written. A write the storage refuses leaves the old nick, never an error on the screen.
export function rememberNick(storage: NickStorage | null, nick: string): void {
  if (storage === null || !isNick(nick)) return;
  try {
    storage.setItem(REMEMBERED_NICK_KEY, nick);
  } catch (error) {
    logEvent("warn", { op: "remembered_nick", step: "write", errName: errorName(error) });
  }
}
