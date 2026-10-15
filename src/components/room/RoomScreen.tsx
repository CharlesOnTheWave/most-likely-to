import { useCallback, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { LiveBanner } from "@/components/room/LiveBanner";
import RoomLobby, { type LobbyPreview } from "@/components/room/RoomLobby";
import { sendRoomAction, type ActionOutcome, type RoomAction } from "@/components/room/room-actions";
import { questionSentence } from "@/components/room/RoundQuestion";
import RoundReveal from "@/components/room/RoundReveal";
import RoundVoting, { type VotingPreview } from "@/components/room/RoundVoting";
import { useRoomState, type LiveConfig, type LivePreview } from "@/components/room/useRoomState";
import type { ResultView } from "@/lib/rooms/chart";
import type { RoomView } from "@/lib/rooms/shared";

// Starting state for /dev/room-states, which renders several screens on one page; the real page never sets it. With
// a preview the screen makes no network call at all: no fetch, no channel, no report, and its actions only answer
// "ok" (a vote shows "Głos oddany"; start and reveal stay busy, as they do until the new state arrives).
export interface ScreenPreview extends LivePreview, LobbyPreview, VotingPreview {
  idPrefix: string;
  // The reveal as if the player had picked this view with the toggle.
  resultView?: ResultView;
}

interface Props {
  roomId: string;
  initial: RoomView;
  // Only the host gets the link to share, and only in the lobby.
  linkUrl?: string | null;
  realtime?: LiveConfig | null;
  preview?: ScreenPreview;
}

type Phase = "lobby" | "voting" | "revealed" | "closed";

function phaseOf(view: RoomView): Phase {
  if (view.status === "closed") return "closed";
  if (view.round === null) return "lobby";
  return view.round.phase;
}

// What the one live region says when the phase changes while the screen is open (never on the first render).
function announcement(view: RoomView): string {
  if (view.status === "closed") return "Ta gra jest zamknięta.";
  if (view.round?.phase === "voting") return `Gra się zaczęła. ${questionSentence(view.round.question)}`;
  if (view.round?.phase === "revealed") return "Wynik odsłonięty.";
  return "";
}

// The room's screen for its host or a player: the lobby, the round's voting, its reveal or the closed room, chosen by
// the room's status and the round's phase. useRoomState keeps the state live; the actions go to the round's endpoints
// and then look again at once, without waiting for the bell.
export default function RoomScreen({ roomId, initial, linkUrl, realtime, preview }: Props) {
  const { view, refreshFailed, liveBroken, refresh } = useRoomState({ roomId, initial, realtime, preview });
  const isPreview = Boolean(preview);
  const idPrefix = preview ? `${preview.idPrefix}-` : "";
  // The states page has its own h1, so there the screen's title is an h2 (as titleAs in SignInCard.astro).
  const titleAs = isPreview ? "h2" : "h1";
  const phase = phaseOf(view);
  // Adjusting state while rendering (react.dev, "You Might Not Need an Effect"): a new phase sets the announcement.
  const [shownPhase, setShownPhase] = useState(phase);
  const [announced, setAnnounced] = useState("");
  // "Koło" or "Paski" as this player picked it; null until they do. Here and not in RoundReveal, so the pick survives
  // the next round (S-03) while the page lives. Never sent anywhere or stored.
  const [resultView, setResultView] = useState<ResultView | null>(preview?.resultView ?? null);
  if (phase !== shownPhase) {
    setShownPhase(phase);
    setAnnounced(announcement(view));
  }

  const act = useCallback(
    async (action: RoomAction, body: unknown): Promise<ActionOutcome> => {
      if (isPreview) return { ok: true };
      const outcome = await sendRoomAction(roomId, action, body);
      // Accepted or refused, the room's state may have moved on (a refused vote: already cast, already revealed).
      refresh();
      return outcome;
    },
    [isPreview, roomId, refresh],
  );
  const start = useCallback(() => act("start", {}), [act]);
  const vote = useCallback((target: string | null) => act("vote", { target }), [act]);
  const reveal = useCallback(() => act("reveal", {}), [act]);

  let content;
  if (view.status === "closed") {
    const Title = titleAs;
    content = (
      <section className="flex flex-col items-center gap-4 py-12 text-center">
        <Title className="text-2xl font-semibold text-balance">Ta gra jest zamknięta.</Title>
        {view.role === "host" ? (
          <a href="/" className={buttonVariants()}>
            Załóż nową grę
          </a>
        ) : (
          <p className="text-muted-foreground">Poproś hosta o nowy link.</p>
        )}
      </section>
    );
  } else if (view.round === null) {
    content = (
      <RoomLobby
        view={view}
        idPrefix={idPrefix}
        titleAs={titleAs}
        linkUrl={linkUrl}
        refreshFailed={refreshFailed}
        onStart={start}
        preview={preview}
      />
    );
  } else if (view.round.phase === "voting") {
    content = (
      <RoundVoting
        // A new round starts with a fresh choice.
        key={view.round.number}
        view={view}
        round={view.round}
        idPrefix={idPrefix}
        titleAs={titleAs}
        refreshFailed={refreshFailed}
        onVote={vote}
        onReveal={reveal}
        preview={preview}
      />
    );
  } else {
    content = (
      <RoundReveal
        view={view}
        round={view.round}
        idPrefix={idPrefix}
        titleAs={titleAs}
        refreshFailed={refreshFailed}
        chosenView={resultView}
        onChooseView={setResultView}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
      {view.status !== "closed" && <LiveBanner broken={liveBroken} />}
      {content}
    </div>
  );
}
