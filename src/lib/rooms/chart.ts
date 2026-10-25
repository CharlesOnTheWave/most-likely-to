import { sortResults } from "@/lib/rooms/results";
import type { RoundResult } from "@/lib/rooms/shared";

// The reveal's two views (Karol's decision after the screenshot review of Faza 4,
// context/archive/2026-10-13-first-live-round): "Koło", a pie with one slice per player who got votes, and "Paski", a
// bar behind each row of the result's table. The table is the accessible data in both; these are only shapes for the
// eye. Safe in the browser.

export type ResultView = "pie" | "bars";

// At most this many slices: the pie has as many colours (--chart-1 … --chart-20 in src/styles/global.css).
export const MAX_PIE_SLICES = 20;

// The toggle shows only when 1 to MAX_PIE_SLICES players got votes, and then the pie is the default. With nobody
// (everyone abstained) there is nothing to cut, and with more there are not enough colours: only the bars.
export function resultViews(results: readonly RoundResult[]): { toggle: boolean; initial: ResultView } {
  const withVotes = results.filter((result) => result.votes > 0).length;
  if (withVotes === 0 || withVotes > MAX_PIE_SLICES) return { toggle: false, initial: "bars" };
  return { toggle: true, initial: "pie" };
}

export interface PieSlice {
  nick: string;
  votes: number;
  // Degrees from 12 o'clock, clockwise.
  startAngle: number;
  endAngle: number;
}

// One slice per player with votes, in the reveal's order (sortResults).
export function pieSlices(results: readonly RoundResult[]): PieSlice[] {
  return slicesInOrder(sortResults(results));
}

// One slice per part with votes, in the order given: the reveal's players (pieSlices), or the top of the end of the
// evening and its one slice for everyone else (GameSummary). The last slice ends exactly at 360°, so the shares never
// leave a gap or an overlap from rounding.
export function slicesInOrder(parts: readonly RoundResult[]): PieSlice[] {
  const voted = parts.filter((part) => part.votes > 0);
  const total = voted.reduce((sum, part) => sum + part.votes, 0);
  let angle = 0;
  return voted.map(({ nick, votes }, index) => {
    const startAngle = angle;
    angle = index === voted.length - 1 ? 360 : angle + (votes / total) * 360;
    return { nick, votes, startAngle, endAngle: angle };
  });
}

function round(value: number): number {
  // Three decimals are plenty for a viewBox of 100, and they hide floating-point noise (sin 180° is 1.2e-16).
  return Math.round(value * 1000) / 1000 || 0;
}

function point(angle: number, center: number, radius: number): string {
  const radians = (angle * Math.PI) / 180;
  return `${round(center + radius * Math.sin(radians))} ${round(center - radius * Math.cos(radians))}`;
}

// The SVG path of a slice around (center, center), or null for the full circle: an arc whose ends meet draws nothing,
// so the screen draws a circle instead.
export function slicePath(
  slice: Pick<PieSlice, "startAngle" | "endAngle">,
  center: number,
  radius: number,
): string | null {
  const sweep = slice.endAngle - slice.startAngle;
  if (sweep >= 360) return null;
  const largeArc = sweep > 180 ? 1 : 0;
  return (
    `M ${round(center)} ${round(center)} L ${point(slice.startAngle, center, radius)} ` +
    `A ${round(radius)} ${round(radius)} 0 ${largeArc} 1 ${point(slice.endAngle, center, radius)} Z`
  );
}

export interface ResultBar {
  nick: string;
  votes: number;
  // 0–100: the votes relative to the top count, which is a full bar.
  percent: number;
}

// Every player in the reveal's order, each with the length of the bar behind its row; no bar when nobody got a vote.
export function resultBars(results: readonly RoundResult[]): ResultBar[] {
  const sorted = sortResults(results);
  const top = sorted[0]?.votes ?? 0;
  return sorted.map(({ nick, votes }) => ({ nick, votes, percent: top > 0 ? (votes / top) * 100 : 0 }));
}
