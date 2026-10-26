import { SLICE_DOTS } from "@/components/room/chart-colors";
import { seatColors } from "@/lib/rooms/chart";
import { EMOTES, type EmoteId, type EmoteMessage } from "@/lib/rooms/emotes";
import type { LobbyPlayer } from "@/lib/rooms/shared";
import { cn } from "@/lib/utils";

// An emote on the screen: the message from the room's channel, with a key of this screen's own.
export interface ShownEmote extends EmoteMessage {
  key: number;
}

// The bubbles stack up from the bottom right, the newest at the bottom, next to EmoteBar (Karol's pick of 2026-10-26):
// below lg above the bar fixed to the window's bottom, from lg in the window's corner, from xl left of the bar upright
// at the window's right edge. In a frame of /dev/room-states, in the frame's corner.
const IN_WINDOW = "fixed right-4 bottom-20 lg:bottom-4 xl:right-20";
const IN_FRAME = "absolute right-4 bottom-4";

const CHARS = new Map<EmoteId, { char: string; label: string }>(
  EMOTES.map(({ id, char, label }) => [id, { char, label }]),
);

interface Props {
  shown: readonly ShownEmote[];
  // The room's players, for each nick's colour (seatColors), as on the lists of players.
  players: readonly LobbyPlayer[];
  // /dev/room-states: inside the screen's frame, so several screens on one page keep their bubbles apart; everywhere
  // else over the page, at the window's edge.
  inFrame: boolean;
}

// The emotes the room's players sent (S-16, PRD FR-023), each for EMOTE_SHOW_MS (RoomScreen takes it away): the
// player's dot in their colour for the whole game, the nick and the emote, at most EMOTE_MAX_SHOWN at once. Over the
// page and never in its way: no pointer events, so a tap goes through to the button under a bubble, and hidden from a
// screen reader, which hears the newest one as "<nick>: <emote's name>" instead. A bubble slides in only when the
// player's system allows motion; with reduced motion it is just there.
export default function EmoteBubbles({ shown, players, inFrame }: Props) {
  const colors = seatColors(players);
  const newest = shown.at(-1);
  const newestLabel = newest === undefined ? undefined : CHARS.get(newest.emote)?.label;
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {newest && newestLabel ? `${newest.nick}: ${newestLabel}` : ""}
      </p>
      <div
        aria-hidden="true"
        className={cn("pointer-events-none z-20 flex flex-col items-end gap-2", inFrame ? IN_FRAME : IN_WINDOW)}
      >
        {shown.map(({ key, nick, emote }) => {
          const color = colors.get(nick);
          return (
            <div
              key={key}
              className={cn(
                "bg-card text-card-foreground flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-md",
                "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2",
              )}
            >
              <span className={cn("size-2.5 shrink-0 rounded-full", color !== undefined && SLICE_DOTS[color])} />
              <span className="min-w-0 break-words">{nick}</span>
              <span className="text-lg leading-none">{CHARS.get(emote)?.char}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
