import { useEffect, useRef, useState } from "react";
import { createClient, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BELL_EVENT, topicFor } from "@/lib/live-sync/shared";
import type { LobbyState } from "@/lib/rooms/shared";

// Starting state for /dev/room-states, which renders several lobbies on one page; the real page never sets it.
interface Preview {
  idPrefix: string;
  copied?: boolean;
  refreshFailed?: boolean;
}

interface Props {
  // The room's channel and lobby state for the live list.
  roomId: string;
  initial: LobbyState;
  // Only the host gets the link to share.
  linkUrl?: string | null;
  // URL and publishable key, only for the room's Realtime channel. Without them (CI runs without Realtime) the list
  // only polls.
  realtime?: { supabaseUrl: string; supabaseKey: string } | null;
  preview?: Preview;
}

const COPIED_MS = 2000;
// The bell is the fast path; polling catches a missed bell, a dropped connection and a phone that slept.
const POLL_MS = 15000;

export default function RoomLobby({ roomId, initial, linkUrl, realtime, preview }: Props) {
  const [lobby, setLobby] = useState(initial);
  const [refreshFailed, setRefreshFailed] = useState(preview?.refreshFailed ?? false);
  const [copied, setCopied] = useState(preview?.copied ?? false);
  const linkRef = useRef<HTMLInputElement>(null);
  const isPreview = Boolean(preview);
  const idPrefix = preview ? `${preview.idPrefix}-` : "";
  // The states page has its own h1, so there the lobby title is an h2 (as titleAs in SignInCard.astro).
  const Title = isPreview ? "h2" : "h1";
  const isHost = lobby.role === "host";
  const isOpen = lobby.status === "lobby";
  const supabaseUrl = realtime?.supabaseUrl;
  const supabaseKey = realtime?.supabaseKey;

  // The live list. The database (room_lobby through /api/rooms/<id>/lobby) is the only source of truth; a bell on the
  // room's channel only says "check", and so does every (re)subscription, because bells sent while the connection was
  // down are lost. A closed room never opens again, so its screen stops listening.
  useEffect(() => {
    if (isPreview || !isOpen) return;
    let sent = 0;
    let shown = 0;
    let active = true;

    async function refresh() {
      const request = ++sent;
      try {
        const res = await fetch(`/api/rooms/${roomId}/lobby`, { cache: "no-store" });
        // A 404 is final (the guest's cookie expired, the host signed out in another tab): the page runs the same
        // room_lobby check, so after a reload it says "Nie jesteś w tym pokoju" instead of retrying every 15 s.
        if (res.status === 404 && active) {
          window.location.reload();
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const next = (await res.json()) as LobbyState;
        // A slower answer to an older request must not overwrite a newer list.
        if (!active || request < shown) return;
        shown = request;
        setLobby(next);
        setRefreshFailed(false);
      } catch {
        // The list stays as it was; only a quiet note says it may be out of date.
        if (!active || request < shown) return;
        setRefreshFailed(true);
      }
    }

    function refreshIfVisible() {
      if (document.visibilityState === "visible") void refresh();
    }

    const timer = window.setInterval(refreshIfVisible, POLL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);

    // Realtime only: this client never signs in, the host's session lives in server-side cookies.
    const supabase =
      supabaseUrl && supabaseKey
        ? createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          })
        : null;
    const channel = supabase
      ?.channel(topicFor(roomId))
      .on("broadcast", { event: BELL_EVENT }, () => {
        void refresh();
      })
      .subscribe((state) => {
        if (state === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) void refresh();
      });

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [isPreview, isOpen, roomId, supabaseUrl, supabaseKey]);

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
        <Title className="text-2xl font-semibold text-balance">Ta gra jest zamknięta.</Title>
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
        <Title className="text-2xl font-semibold break-words">
          {isHost ? "Twój pokój" : `Jesteś w grze jako ${lobby.me}`}
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

      <section aria-labelledby={`${idPrefix}players-heading`} className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={`${idPrefix}players-heading`} className="text-sm font-medium">
            Gracze ({lobby.players.length})
          </h2>
          <p aria-live="polite" className="text-muted-foreground text-xs">
            {refreshFailed ? "Nie udało się odświeżyć listy" : ""}
          </p>
        </div>
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
