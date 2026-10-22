import { useEffect, useRef, useState } from "react";
import { Check, Copy, Play } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { ActionOutcome } from "@/components/room/room-actions";
import { MIN_PLAYERS, type RoomView } from "@/lib/rooms/shared";

// /dev/room-states only: the starting state of this lobby; the real page never sets it.
export interface LobbyPreview {
  copied?: boolean;
  starting?: boolean;
  startError?: string | null;
}

interface Props {
  view: RoomView;
  // Unique ids when /dev/room-states renders several screens on one page; "" on the real page.
  idPrefix: string;
  titleAs: "h1" | "h2";
  // Only the host gets the link to share.
  linkUrl?: string | null;
  refreshFailed: boolean;
  // "Zacznij grę": the screen sends it and looks again (src/components/room/RoomScreen.tsx).
  onStart: () => Promise<ActionOutcome>;
  preview?: LobbyPreview;
}

const COPIED_MS = 2000;

// The lobby: the host's link and "Zacznij grę", the list of players for everyone. RoomScreen keeps the state live.
export default function RoomLobby({ view, idPrefix, titleAs: Title, linkUrl, refreshFailed, onStart, preview }: Props) {
  const [copied, setCopied] = useState(preview?.copied ?? false);
  // After "Zacznij grę" was accepted the button stays busy until the game's state arrives and this view goes away.
  const [starting, setStarting] = useState(preview?.starting ?? false);
  const [startError, setStartError] = useState<string | null>(preview?.startError ?? null);
  const linkRef = useRef<HTMLInputElement>(null);
  const isPreview = Boolean(preview);
  const isHost = view.role === "host";
  const canStart = view.players.length >= MIN_PLAYERS;
  const startHintId = `${idPrefix}start-hint`;

  useEffect(() => {
    if (!copied || isPreview) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
    }, COPIED_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [copied, isPreview]);

  async function copyLink() {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
    } catch {
      // No clipboard (plain http on a LAN address, an old or in-app browser, permission denied): select the link so
      // the host can copy it by hand.
      linkRef.current?.focus();
      linkRef.current?.select();
    }
  }

  async function start() {
    setStarting(true);
    setStartError(null);
    const outcome = await onStart();
    if (!outcome.ok) {
      setStarting(false);
      setStartError(outcome.message);
    }
  }

  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-3 lg:items-start lg:gap-x-12">
      {/* From lg two columns: the game (title first in the DOM, where the focus goes after a host's move) and the
          players. The game's group stays in view while a long list of players scrolls the page, so the host keeps the
          link and "Zacznij grę" on screen; a sticky grid item moves only within its row, so only the shorter column
          can stick. Below lg the group is display: contents, so its blocks stand in one column as on a phone. */}
      <div className="contents lg:sticky lg:top-6 lg:col-span-2 lg:flex lg:flex-col lg:gap-8">
        <div className="flex flex-col gap-2">
          <Title className="text-2xl font-semibold break-words">
            {isHost ? "Twój pokój" : `Jesteś w grze jako ${view.me}`}
          </Title>
          <p className="text-muted-foreground">
            {isHost ? "Wklej link na Discordzie. Kto go otworzy, wpisze nick i dołączy." : "Czekamy, aż host zacznie."}
          </p>
        </div>

        {isHost &&
          (linkUrl ? (
            <div className="flex flex-col gap-3">
              <Label htmlFor={`${idPrefix}room-link`}>Link dla graczy</Label>
              <div className="flex gap-2">
                <Input
                  ref={linkRef}
                  id={`${idPrefix}room-link`}
                  readOnly
                  value={linkUrl}
                  onFocus={(e) => {
                    e.currentTarget.select();
                  }}
                />
                <Button type="button" variant="secondary" onClick={() => void copyLink()}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Skopiowano" : "Kopiuj"}
                </Button>
              </div>
              <p aria-live="polite" className="sr-only">
                {copied ? "Link skopiowany" : ""}
              </p>
            </div>
          ) : (
            <p role="alert" className="text-destructive text-sm">
              Nie udało się pobrać linku. Odśwież stronę.
            </p>
          ))}

        {isHost && (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              className="w-full"
              disabled={!canStart || starting}
              aria-describedby={startHintId}
              onClick={() => void start()}
            >
              {starting ? (
                <>
                  <Spinner aria-hidden="true" />
                  Zaczynamy…
                </>
              ) : (
                <>
                  <Play />
                  Zacznij grę
                </>
              )}
            </Button>
            <p id={startHintId} className="text-muted-foreground text-sm">
              {canStart
                ? "Po starcie nowi gracze wejdą tylko wtedy, gdy ich wpuścisz."
                : `Grę zaczniesz, gdy będzie was co najmniej ${MIN_PLAYERS}.`}
            </p>
            <ServerError message={startError} />
          </div>
        )}
      </div>

      {/* From lg the column next to the game. */}
      <section aria-labelledby={`${idPrefix}players-heading`} className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={`${idPrefix}players-heading`} className="text-sm font-medium">
            Gracze ({view.players.length})
          </h2>
          <p aria-live="polite" className="text-muted-foreground text-xs">
            {refreshFailed ? "Nie udało się odświeżyć listy" : ""}
          </p>
        </div>
        <ul className="divide-y rounded-md border">
          {view.players.map((player) => (
            <li key={player.nick} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0 break-words">{player.nick}</span>
              <span className="flex shrink-0 gap-1.5">
                {player.host && <Badge variant="secondary">host</Badge>}
                {!isHost && player.nick === view.me && <Badge variant="outline">ty</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
