import type { RoundResult } from "@/lib/rooms/shared";

// The reveal's order (context/changes/first-live-round/plan.md, Desired End State 3): every player, most votes first,
// a tie in seat order and the zeros at the bottom, also in seat order. room_lobby gives the results in seat order, and
// Array.prototype.sort is stable, so sorting by votes alone keeps it within a tie. Safe in the browser.
export function sortResults(results: readonly RoundResult[]): RoundResult[] {
  return [...results].sort((a, b) => b.votes - a.votes);
}
