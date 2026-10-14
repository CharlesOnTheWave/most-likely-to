import { ChartBarDecreasing, ChartPie, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { RoundQuestion } from "@/components/room/RoundQuestion";
import { pieSlices, resultBars, resultViews, slicePath, type PieSlice, type ResultView } from "@/lib/rooms/chart";
import type { RoomView, RoundView } from "@/lib/rooms/shared";
import { cn } from "@/lib/utils";

type RevealedRoundView = Extract<RoundView, { phase: "revealed" }>;

interface Props {
  view: RoomView;
  round: RevealedRoundView;
  // Unique ids when /dev/room-states renders several screens on one page; "" on the real page.
  idPrefix: string;
  titleAs: "h1" | "h2";
  refreshFailed: boolean;
  // The view this player picked with the toggle, or null for the default. Kept by RoomScreen, so it survives the
  // next round while the page lives; never sent anywhere or stored.
  chosenView: ResultView | null;
  onChooseView: (next: ResultView) => void;
}

// One colour per slice, in the slices' order (src/styles/global.css, --chart-1 … --chart-20). Full class names:
// Tailwind generates only the classes it finds written out.
const SLICE_FILLS = [
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
const SLICE_DOTS = [
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

const VIEW_OPTIONS: { view: ResultView; label: string; Icon: typeof ChartPie }[] = [
  { view: "pie", label: "Koło", Icon: ChartPie },
  { view: "bars", label: "Paski", Icon: ChartBarDecreasing },
];

// The pie for the eye only (the table below holds the data): slices from 12 o'clock clockwise, each edged in the
// page's background so neighbours stay apart; one player with every vote is a plain circle.
function ResultPie({ slices }: { slices: PieSlice[] }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="mx-auto size-48 sm:size-56">
      {slices.map((slice, index) => {
        const path = slicePath(slice, 50, 48);
        return path === null ? (
          <circle key={slice.nick} cx="50" cy="50" r="48" className={SLICE_FILLS[index]} />
        ) : (
          <path
            key={slice.nick}
            d={path}
            strokeLinejoin="round"
            className={cn(SLICE_FILLS[index], "stroke-background stroke-2")}
          />
        );
      })}
    </svg>
  );
}

// The reveal (PRD FR-009; decision D3: always the counts, also after one vote): every player, most votes first, a tie
// in seat order, zeros dimmed at the bottom (sortResults), and how many abstained. Only counts per person, never who
// voted for whom. "Koło" or "Paski" changes only this player's screen. The result stays; S-03 brings the next
// question, so the host gets "Nowa gra" for now.
export default function RoundReveal({
  view,
  round,
  idPrefix,
  titleAs,
  refreshFailed,
  chosenView,
  onChooseView,
}: Props) {
  const rows = resultBars(round.results);
  const top = rows[0]?.votes ?? 0;
  const slices = pieSlices(round.results);
  const sliceIndex = new Map(slices.map((slice, index) => [slice.nick, index]));
  const { toggle, initial } = resultViews(round.results);
  const shown: ResultView = toggle ? (chosenView ?? initial) : "bars";
  const isHost = view.role === "host";

  return (
    <div className="flex flex-col gap-8">
      <RoundQuestion question={round.question} titleAs={titleAs} />

      <section aria-labelledby={`${idPrefix}results-heading`} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${idPrefix}results-heading`} className="text-sm font-medium">
            Wynik
          </h2>
          {toggle && (
            <div role="group" aria-label="Widok wyniku" className="inline-flex gap-0.5 rounded-md border p-0.5">
              {VIEW_OPTIONS.map(({ view: option, label, Icon }) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={shown === option ? "secondary" : "ghost"}
                  aria-pressed={shown === option}
                  className={cn(shown !== option && "text-muted-foreground")}
                  onClick={() => {
                    onChooseView(option);
                  }}
                >
                  <Icon />
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {shown === "pie" && <ResultPie slices={slices} />}

        <div className="overflow-hidden rounded-md border">
          <table className="w-full">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Gracz
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Głosy
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const isTop = top > 0 && row.votes === top;
                const dot = sliceIndex.get(row.nick);
                return (
                  <tr key={row.nick} className={cn(row.votes === 0 && "text-muted-foreground")}>
                    <td className="relative px-3 py-2.5">
                      {shown === "bars" && row.percent > 0 && (
                        // Behind the nick, as long as its votes relative to the top count; low opacity keeps the text
                        // readable on it.
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-y-1 left-0 rounded-r-sm",
                            isTop ? "bg-primary/35" : "bg-primary/20",
                          )}
                          style={{ width: `${row.percent}%` }}
                        />
                      )}
                      <span className="relative flex items-center gap-x-2">
                        {shown === "pie" && (
                          // The slice's colour; a row without votes keeps the space, so the nicks stay aligned. Outside
                          // the wrapping span, so a long nick wraps next to its dot instead of pushing it onto a line
                          // of its own.
                          <span
                            aria-hidden="true"
                            className={cn("size-2.5 shrink-0 rounded-full", dot !== undefined && SLICE_DOTS[dot])}
                          />
                        )}
                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={cn("min-w-0 wrap-anywhere", isTop && "font-semibold")}>{row.nick}</span>
                          {row.nick === view.me && <Badge variant="outline">ty</Badge>}
                        </span>
                      </span>
                    </td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", isTop && "font-semibold")}>
                      {row.votes + 1}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-muted-foreground text-sm">Wstrzymało się: {round.abstained}</p>
          <p aria-live="polite" className="text-muted-foreground text-xs">
            {refreshFailed ? "Nie udało się odświeżyć stanu gry" : ""}
          </p>
        </div>
      </section>

      {isHost && (
        <div className="flex flex-col gap-3 border-t pt-6">
          <p className="text-muted-foreground text-sm">Kolejne pytania wkrótce.</p>
          <a href="/" className={buttonVariants({ variant: "secondary" })}>
            <Plus />
            Nowa gra
          </a>
        </div>
      )}
    </div>
  );
}
