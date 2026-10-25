import type { RoomView } from "@/lib/rooms/shared";

// The widths of the room page /r/[id] in one place (AGENTS.md, "## UI"): the page's frame with its header, and the
// column of each state inside it. Below lg (1024 px) every room screen is one column of 512 px (max-w-lg), as on a
// phone; the wider classes start at lg: and come from Tailwind's default scale, never an arbitrary value. Whole class
// names only: Tailwind generates just the classes it finds written out, never one put together from parts.

// The page's frame: <main> of /r/[id] and the inner box of its header (AppHeader with wide).
export const ROOM_FRAME = "max-w-lg lg:max-w-6xl";

// A screen centred in 512 px at every width: a guest's vote, the skipped last question, the end of the evening without
// a chart, the crash screen and the room pages' messages.
export const ROOM_NARROW = "mx-auto w-full max-w-lg";

// The lobby in two columns across the whole frame.
const LOBBY_COLUMN = "mx-auto w-full max-w-lg lg:max-w-6xl";
// The host's vote (before and after their own vote) and every reveal: the pie next to the table, the host's buttons in
// one line.
const ROUND_COLUMN = "mx-auto w-full max-w-lg lg:max-w-3xl";

// The end of the evening with the summary's chart, in two halves across the whole frame (endInHalves).
const END_HALVES_COLUMN = "mx-auto w-full max-w-lg lg:max-w-6xl";

// The end of the evening whose summary has a chart, because someone got a vote (S-15): from lg two halves, the title,
// the counts, the nicks with none and the next step on the left, the chart on the right (Karol's choice "Dwie połowy"
// after the screenshots, 2026-10-25). Without a chart (no reveal, or everyone abstained) one narrow column.
export function endInHalves(view: RoomView): boolean {
  return view.status === "closed" && view.summary !== null && view.summary.top.length > 0;
}

// The column of the state the room screen shows, chosen as RoomScreen chooses its view.
export function roomColumn(view: RoomView): string {
  if (view.status === "closed") return endInHalves(view) ? END_HALVES_COLUMN : ROOM_NARROW;
  if (view.round === null) return LOBBY_COLUMN;
  if (view.round.phase === "revealed") return ROUND_COLUMN;
  if (view.round.phase === "voting" && view.role === "host") return ROUND_COLUMN;
  return ROOM_NARROW;
}
