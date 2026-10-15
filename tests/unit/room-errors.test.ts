import { describe, expect, it } from "vitest";
import { ROUND_REFUSALS, roomErrorMessage } from "@/lib/rooms/errors";

// Every refusal on a guest's way in (src/pages/api/rooms/join.ts) and of a game's action (start, vote, reveal, next,
// skip, end) must say what went wrong. A code renamed on one side would leave the player with the generic "something
// went wrong" (test-plan #6; audit G2). The Polish texts are not copied here: the test checks that each refusal has its
// own text, not what the text says.
const GUEST_REFUSALS = [
  "invalid_nick",
  "nick_taken",
  "room_closed",
  "room_unknown",
  "service_unavailable",
  "game_started",
];

// The round's codes as the plans list them (context/archive/2026-10-13-first-live-round/plan.md, Faza 3 #4, and
// context/changes/full-game-evening/plan.md, Faza 3 #4: round_over for a question that changed under the screen,
// round_in_progress for "Następne pytanie" while the round is voting), written out by hand: a code dropped from
// ROUND_REFUSALS would otherwise drop out of this test too.
const PLANNED_ROUND_REFUSALS = [
  "game_started",
  "not_enough_players",
  "no_questions",
  "invalid_question",
  "already_voted",
  "round_revealed",
  "unknown_target",
  "no_round",
  "round_over",
  "round_in_progress",
];

const ALL_REFUSALS = [...new Set([...GUEST_REFUSALS, ...PLANNED_ROUND_REFUSALS])];

// Codes come from ?error= in the URL or from a JSON answer, so anything can arrive. "constructor" is on
// Object.prototype: a lookup that is not an own-property check would find it.
const UNKNOWN_CODES = ["no_such_code", "constructor"];

describe("roomErrorMessage", () => {
  const generic = roomErrorMessage(UNKNOWN_CODES[0]);

  it.each(UNKNOWN_CODES)("gives the unknown code %s the one generic text", (code) => {
    const message = roomErrorMessage(code);

    expect(message).toBeTypeOf("string");
    expect(message).not.toBe("");
    expect(message).toBe(generic);
  });

  it.each(ALL_REFUSALS)("gives the refusal %s its own text, not the generic one", (code) => {
    const message = roomErrorMessage(code);

    expect(message).toBeTypeOf("string");
    expect(message).not.toBe(generic);
  });

  it("gives every refusal a different text", () => {
    const messages = new Set(ALL_REFUSALS.map((code) => roomErrorMessage(code)));

    expect(messages.size).toBe(ALL_REFUSALS.length);
  });

  it("gives no text when there is no code", () => {
    expect(roomErrorMessage(null)).toBeNull();
  });
});

describe("ROUND_REFUSALS", () => {
  it("lists exactly the round's codes from the plan", () => {
    expect([...ROUND_REFUSALS].sort()).toEqual([...PLANNED_ROUND_REFUSALS].sort());
  });

  it.each(PLANNED_ROUND_REFUSALS)("gives the listed code %s its own text", (code) => {
    expect(roomErrorMessage(code)).not.toBe(roomErrorMessage(UNKNOWN_CODES[0]));
  });
});
