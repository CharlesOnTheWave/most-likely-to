import { format } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { browserNickStorage, readRememberedNick, rememberNick, type NickStorage } from "@/lib/rooms/remembered-nick";

// S-14 (FR-024): the same browser suggests the nick its player last joined with. The browser keeps only that nick,
// never a vote or its target (roadmap S-14, Risk; AGENTS.md, Hard Rules), so remembering a nick is exactly one setItem
// of the nick under the planned key and nothing else (context/changes/remembered-nick/plan.md, Faza 1 #1). A value is
// written or suggested only when the form would take it: 1 to 20 characters as the database counts them, an emoji as
// one (invalid_nick, supabase/migrations/20261014101922_first_live_round.sql:355-359). Storage that refuses (blocked
// site data, a full quota) never throws to the screen, and its log line carries the step and the error's name, never
// the nick. Every expected value is written out by hand; nothing here is counted with nickLength.

const KEY = "mlt-nick";

// Counted by hand in characters: ł and ń are one each, and so is 🎉, though it is two UTF-16 units, so a limit checked
// on String.length would wrongly refuse TWENTY_WITH_EMOJI.
const TWENTY = "Bartłomiej z Gdańska";
const TWENTY_WITH_EMOJI = "Bartłomiej z Gdańsk🎉";
const VALID_NICKS = ["Ola", TWENTY, TWENTY_WITH_EMOJI];
// Empty, only spaces, only whitespace of any kind, and one character over the limit, also with the emoji.
const INVALID_NICKS = ["", "   ", " \t\n ", "Bartłomiej z Gdańska!", "Bartłomiej z Gdańska🎉"];

interface FakeStorage extends NickStorage {
  // Every setItem call in order, as [key, value].
  writes: [string, string][];
}

function fakeStorage(stored: Record<string, string> = {}): FakeStorage {
  const entries = new Map(Object.entries(stored));
  const writes: [string, string][] = [];
  return {
    writes,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      writes.push([key, value]);
      entries.set(key, value);
    },
  };
}

// Storage whose every call throws, as a browser's does. The nick sits in the error's message, which must never reach
// the log.
function refusingStorage(name: string): NickStorage {
  const refuse = (): never => {
    throw Object.assign(new Error(`storage refused ${TWENTY}`), { name });
  };
  return { getItem: refuse, setItem: refuse };
}

let consoleWarn: MockInstance<typeof console.warn>;

beforeEach(() => {
  consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  consoleWarn.mockRestore();
});

function logged(): string {
  return consoleWarn.mock.calls.map((call) => format(...call)).join("\n");
}

describe("readRememberedNick", () => {
  it("gives null when nothing is remembered", () => {
    expect(readRememberedNick(fakeStorage())).toBeNull();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it.each(VALID_NICKS)("gives back the remembered nick %j as it was stored", (nick) => {
    expect(readRememberedNick(fakeStorage({ [KEY]: nick }))).toBe(nick);
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it.each(INVALID_NICKS)("gives null for the remembered value %j, which the form would refuse", (value) => {
    expect(readRememberedNick(fakeStorage({ [KEY]: value }))).toBeNull();
  });

  it("gives null when the storage refuses, and logs the step without the nick", () => {
    expect(readRememberedNick(refusingStorage("SecurityError"))).toBeNull();
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(consoleWarn.mock.calls[0]).toContainEqual({ op: "remembered_nick", step: "read", errName: "SecurityError" });
    expect(logged()).not.toContain(TWENTY);
  });

  it("gives null without a storage", () => {
    expect(readRememberedNick(null)).toBeNull();
  });
});

describe("rememberNick", () => {
  it.each(VALID_NICKS)("writes %j once under the key and nothing else", (nick) => {
    const storage = fakeStorage();

    rememberNick(storage, nick);

    expect(storage.writes).toEqual([[KEY, nick]]);
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it.each(INVALID_NICKS)("writes nothing for %j, which the form would refuse", (value) => {
    const storage = fakeStorage();

    rememberNick(storage, value);

    expect(storage.writes).toEqual([]);
  });

  it("does not throw when the storage refuses, and logs the step without the nick", () => {
    expect(() => {
      rememberNick(refusingStorage("QuotaExceededError"), TWENTY);
    }).not.toThrow();
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(consoleWarn.mock.calls[0]).toContainEqual({
      op: "remembered_nick",
      step: "write",
      errName: "QuotaExceededError",
    });
    expect(logged()).not.toContain(TWENTY);
  });

  it("does not throw without a storage", () => {
    expect(() => {
      rememberNick(null, TWENTY);
    }).not.toThrow();
  });
});

describe("remembered nick round trip", () => {
  it.each(VALID_NICKS)("reads back %j from the same storage after remembering it", (nick) => {
    const storage = fakeStorage();

    rememberNick(storage, nick);

    expect(readRememberedNick(storage)).toBe(nick);
  });
});

describe("browserNickStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The unit tests run in node (vitest.config.ts), with no window, as in a server render.
  it("gives no storage and logs nothing outside the browser", () => {
    expect(browserNickStorage()).toBeNull();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  // A browser in private mode or with blocked site data throws on merely reaching its storage.
  it("gives no storage when reaching it throws, and logs the step without the nick", () => {
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw Object.assign(new Error(`storage refused ${TWENTY}`), { name: "SecurityError" });
      },
    });

    expect(browserNickStorage()).toBeNull();
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(consoleWarn.mock.calls[0]).toContainEqual({ op: "remembered_nick", step: "open", errName: "SecurityError" });
    expect(logged()).not.toContain(TWENTY);
  });
});
