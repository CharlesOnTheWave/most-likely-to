// One colour per player for the whole game, from the place at the table (seatColors in src/lib/rooms/chart.ts; the
// colours are --chart-1 … --chart-20 in src/styles/global.css), never from the place in a result: the player's slice
// on the reveal's pie (RoundReveal) and on the end of the evening's (GameSummary), and the dot next to the nick on the
// lists of players ("Gracze"), in the reveal's table and in the summary's legend. FILLS colour the slices, DOTS the
// dots. Full class names: Tailwind generates only the classes it finds written out.
export const SLICE_FILLS = [
  "fill-chart-1",
  "fill-chart-2",
  "fill-chart-3",
  "fill-chart-4",
  "fill-chart-5",
  "fill-chart-6",
  "fill-chart-7",
  "fill-chart-8",
  "fill-chart-9",
  "fill-chart-10",
  "fill-chart-11",
  "fill-chart-12",
  "fill-chart-13",
  "fill-chart-14",
  "fill-chart-15",
  "fill-chart-16",
  "fill-chart-17",
  "fill-chart-18",
  "fill-chart-19",
  "fill-chart-20",
];
export const SLICE_DOTS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
  "bg-chart-8",
  "bg-chart-9",
  "bg-chart-10",
  "bg-chart-11",
  "bg-chart-12",
  "bg-chart-13",
  "bg-chart-14",
  "bg-chart-15",
  "bg-chart-16",
  "bg-chart-17",
  "bg-chart-18",
  "bg-chart-19",
  "bg-chart-20",
];
