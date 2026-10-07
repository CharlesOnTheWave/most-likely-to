import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LobbyState } from "@/lib/rooms/shared";

// Starting state for /dev/room-states, which renders several lobbies on one page; the real page never sets it.
interface Preview {
  idPrefix: string;
  copied?: boolean;
}

interface Props {
  // The room's channel and lobby state for the live list.
  roomId: string;
  initial: LobbyState;
  // Only the host gets the link to share.
  linkUrl?: string | null;
  preview?: Preview;
}

const COPIED_MS = 2000;

export default function RoomLobby({ initial, linkUrl, preview }: Props) {
  const lobby = initial;
  const [copied, setCopied] = useState(preview?.copied ?? false);
  const linkRef = useRef<HTMLInputElement>(null);
  const isPreview = Boolean(preview);
  const idPrefix = preview ? `${preview.idPrefix}-` : "";
  const isHost = lobby.role === "host";

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

  if (lobby.status === "closed") {
    return (
      <section className="flex flex-col items-center gap-4 py-12 text-center">
        <h1 className="text-2xl font-semibold text-balance">Ta gra jest zamknięta.</h1>
        {isHost ? (
          <a href="/" className={buttonVariants()}>
            Załóż nową grę
          </a>
        ) : (
          <p className="text-muted-foreground">Poproś hosta o nowy link.</p>
        )}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold break-words">
          {isHost ? "Twój pokój" : `Jesteś w grze jako ${lobby.me}`}
        </h1>
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

      <section aria-labelledby={`${idPrefix}players-heading`} className="flex flex-col gap-3">
        <h2 id={`${idPrefix}players-heading`} className="text-sm font-medium">
          Gracze ({lobby.players.length})
        </h2>
        <ul className="divide-y rounded-md border">
          {lobby.players.map((player) => (
            <li key={player.nick} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0 break-words">{player.nick}</span>
              <span className="flex shrink-0 gap-1.5">
                {player.host && <Badge variant="secondary">host</Badge>}
                {!isHost && player.nick === lobby.me && <Badge variant="outline">ty</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
