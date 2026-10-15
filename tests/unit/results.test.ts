import { describe, expect, it } from "vitest";
import { sortResults } from "@/lib/rooms/results";
import type { RoundResult } from "@/lib/rooms/shared";

// The order of the reveal: every player, most votes first, a tie in seat order (the order room_lobby gives the results
// in), zeros at the bottom, also in seat order. Oracle: context/changes/first-live-round/plan.md, Desired End State 3
// and Faza 4 #3 (the plan's interview). Every expected order is written out by hand as a list of nicks.

function seats(...entries: [string, number][]): RoundResult[] {
  return entries.map(([nick, votes]) => ({ nick, votes }));
}

function nicks(results: RoundResult[]): string[] {
  return results.map((result) => result.nick);
}

describe("sortResults", () => {
  it("puts the most votes first", () => {
    const results = seats(["Ola", 1], ["Bartek", 3], ["Kuba", 0], ["Zosia", 2]);

    expect(nicks(sortResults(results))).toEqual(["Bartek", "Zosia", "Ola", "Kuba"]);
  });

  it("keeps each player's own count", () => {
    const results = seats(["Ola", 1], ["Bartek", 3], ["Kuba", 0]);

    expect(sortResults(results)).toEqual([
      { nick: "Bartek", votes: 3 },
      { nick: "Ola", votes: 1 },
      { nick: "Kuba", votes: 0 },
    ]);
  });

  it("orders a tie by seat", () => {
    const results = seats(["Ola", 2], ["Bartek", 1], ["Kuba", 2], ["Zosia", 1], ["Igor", 2]);

    expect(nicks(sortResults(results))).toEqual(["Ola", "Kuba", "Igor", "Bartek", "Zosia"]);
  });

  it("puts the zeros at the bottom, in seat order", () => {
    const results = seats(["Ola", 0], ["Bartek", 1], ["Kuba", 0], ["Zosia", 0], ["Igor", 3]);

    expect(nicks(sortResults(results))).toEqual(["Igor", "Bartek", "Ola", "Kuba", "Zosia"]);
  });

  // The scenario of tests/db/round-rules.test.ts: Host→Ola, Ola→Ola, Bartek→Ola, Kuba abstains.
  it("orders the main round of the database tests", () => {
    const results = seats(["Host", 0], ["Ola", 3], ["Bartek", 0], ["Kuba", 0]);

    expect(nicks(sortResults(results))).toEqual(["Ola", "Host", "Bartek", "Kuba"]);
  });

  // A reveal after a single vote (decision D3: no threshold).
  it("orders a reveal after one vote", () => {
    const results = seats(["Ola", 0], ["Bartek", 0], ["Kuba", 1]);

    expect(nicks(sortResults(results))).toEqual(["Kuba", "Ola", "Bartek"]);
  });

  it("leaves seat order when everyone abstained", () => {
    const results = seats(["Ola", 0], ["Bartek", 0], ["Kuba", 0]);

    expect(nicks(sortResults(results))).toEqual(["Ola", "Bartek", "Kuba"]);
  });

  it("gives an empty list for no results", () => {
    expect(sortResults([])).toEqual([]);
  });

  it("does not change the list it was given", () => {
    const results = seats(["Ola", 0], ["Bartek", 2], ["Kuba", 1]);

    sortResults(results);

    expect(nicks(results)).toEqual(["Ola", "Bartek", "Kuba"]);
  });
});
