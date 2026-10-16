import { useCallback, useEffect, useRef, useState } from "react";
import { PartyPopper, Plus, SkipForward } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import type { HostActionsPreview } from "@/components/room/HostActions";
import { LiveBanner } from "@/components/room/LiveBanner";
import RoomLobby, { type LobbyPreview } from "@/components/room/RoomLobby";
import { RoomErrorBoundary } from "@/components/room/RoomErrorBoundary";
import { roomColumn } from "@/components/room/room-frame";
import { sendRoomAction, type ActionOutcome, type RoomAction } from "@/components/room/room-actions";
import RoundReveal from "@/components/room/RoundReveal";
import RoundSkipped from "@/components/room/RoundSkipped";
import RoundVoting, { type VotingPreview } from "@/components/room/RoundVoting";
import { useRoomState, type LiveConfig, type LivePreview } from "@/components/room/useRoomState";
import { announcement, announcementKey, skipNotice } from "@/lib/rooms/announce";
import type { ResultView } from "@/lib/rooms/chart";
import type { RoomView } from "@/lib/rooms/shared";
import { cn } from "@/lib/utils";

// Starting state for the dev previews (/dev/room-states with several screens on one page, /dev/room-window with one);
// the real page never sets it. With a preview the screen makes no network call at all: no fetch, no channel, no
// report, and its actions only answer "ok" (a vote shows "Głos oddany"; the host's actions stay busy, as they do until
// the new state arrives).
export interface ScreenPreview extends LivePreview, LobbyPreview, VotingPreview {
  idPrefix: string;
  // The reveal as if the player had picked this view with the toggle.
  resultView?: ResultView;
  // The host's buttons of the voting, the reveal or the skipped last question.
  host?: HostActionsPreview;
  // The screen throws once it is in the browser, to show RoomErrorBoundary's screen.
  crash?: boolean;
}

interface Props {
  roomId: string;
  initial: RoomView;
  // Only the host gets the link to share, and only in the lobby.
  linkUrl?: string | null;
  realtime?: LiveConfig | null;
  preview?: ScreenPreview;
}

// /dev/room-states: throws after the first render in the browser, so the server's render of the page still works
// (an error boundary catches nothing on the server).
function PreviewCrash() {
  useEffect(() => {
    throw new Error("Preview crash");
  }, []);
  return null;
}

// "Koniec wieczoru" for everyone once the room is closed: "Zakończ grę", "Nowa gra" or the sweep of abandoned games
// (decision D4 of context/changes/full-game-evening/research.md). No counts and no summary of the evening (FR-022 is
// parked).
function EveningEnd({ view, titleAs: Title }: { view: RoomView; titleAs: "h1" | "h2" }) {
  return (
    <section className="flex flex-col items-center gap-4 py-12 text-center">
      <PartyPopper aria-hidden="true" className="text-muted-foreground size-10" />
      <Title className="text-2xl font-semibold text-balance">Koniec wieczoru</Title>
      <p className="text-lg">Dzięki za grę!</p>
      {view.role === "host" ? (
        <a href="/" className={buttonVariants()}>
          <Plus />
          Nowa gra
        </a>
      ) : (
        <p className="text-muted-foreground">Chcesz zagrać jeszcze raz? Poproś hosta o nowy link.</p>
      )}
    </section>
  );
}

// The host's moves that replace the whole view; after them the focus goes to the new view's heading.
const VIEW_CHANGING: readonly RoomAction[] = ["start", "reveal", "next", "skip", "end"];

// The room's screen for its host or a player: the lobby, the round's voting, its reveal, a skipped last question or
// the end of the evening, chosen by the room's status and the round's phase. useRoomState keeps the state live; the
// actions go to the game's endpoints and then look again at once, without waiting for the bell.
function RoomContent({ roomId, initial, linkUrl, realtime, preview }: Props) {
  const { view, refreshFailed, liveBroken, refresh } = useRoomState({ roomId, initial, realtime, preview });
  const isPreview = Boolean(preview);
  const idPrefix = preview ? `${preview.idPrefix}-` : "";
  // The states page has its own h1, so there the screen's title is an h2 (as titleAs in SignInCard.astro).
  const titleAs = isPreview ? "h2" : "h1";
  const key = announcementKey(view);
  // Adjusting state while rendering (react.dev, "You Might Not Need an Effect"): a new question, phase or status sets
  // the announcement (src/lib/rooms/announce.ts); never on the first render.
  const [shownKey, setShownKey] = useState(key);
  const [announced, setAnnounced] = useState("");
  // "Koło" or "Paski" as this player picked it; null until they do. Here and not in RoundReveal, so the pick survives
  // the next round while the page lives. Never sent anywhere or stored.
  const [resultView, setResultView] = useState<ResultView | null>(preview?.resultView ?? null);
  if (key !== shownKey) {
    setShownKey(key);
    setAnnounced(announcement(view));
  }
  const contentRef = useRef<HTMLDivElement>(null);
  // The view the host's move started from, until another view replaces it: the pressed button goes away with its view,
  // so the focus goes to the new heading instead of the page's start. Other players' focus is never moved.
  const movedFrom = useRef<string | null>(null);
  useEffect(() => {
    if (movedFrom.current === null || movedFrom.current === key) return;
    movedFrom.current = null;
    const heading = contentRef.current?.querySelector<HTMLElement>("h1, h2");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.classList.add("outline-none");
    heading.focus();
  }, [key]);

  const act = useCallback(
    async (action: RoomAction, body: unknown): Promise<ActionOutcome> => {
      if (isPreview) return { ok: true };
      if (VIEW_CHANGING.includes(action)) movedFrom.current = key;
      const outcome = await sendRoomAction(roomId, action, body);
      if (!outcome.ok) movedFrom.current = null;
      // Accepted or refused, the room's state may have moved on (a refused vote: already cast, already revealed).
      refresh();
      return outcome;
    },
    [isPreview, roomId, refresh, key],
  );
  const start = useCallback(() => act("start", {}), [act]);
  const vote = useCallback((target: string | null, round: number) => act("vote", { target, round }), [act]);
  const reveal = useCallback(() => act("reveal", {}), [act]);
  const next = useCallback((round: number) => act("next", { round }), [act]);
  const skip = useCallback((round: number) => act("skip", { round }), [act]);
  const end = useCallback(() => act("end", {}), [act]);

  let content;
  if (view.status === "closed") {
    content = <EveningEnd view={view} titleAs={titleAs} />;
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
  } else if (view.round.phase === "skipped") {
    content = (
      <RoundSkipped
        // Each round starts with fresh buttons.
        key={view.round.number}
        view={view}
        round={view.round}
        titleAs={titleAs}
        refreshFailed={refreshFailed}
        onNext={next}
        onEnd={end}
        hostPreview={preview?.host}
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
        onSkip={skip}
        onEnd={end}
        preview={preview}
        hostPreview={preview?.host}
      />
    );
  } else {
    content = (
      <RoundReveal
        key={view.round.number}
        view={view}
        round={view.round}
        idPrefix={idPrefix}
        titleAs={titleAs}
        refreshFailed={refreshFailed}
        chosenView={resultView}
        onChooseView={setResultView}
        onNext={next}
        onEnd={end}
        hostPreview={preview?.host}
      />
    );
  }

  // The state's column in the page's frame (src/components/room/room-frame.ts), so the banner and the note after a skip
  // are as wide as the view under them.
  return (
    <div className={cn("flex flex-col gap-6", roomColumn(view))}>
      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
      {view.status !== "closed" && <LiveBanner broken={liveBroken} />}
      {skipNotice(view) && (
        // Not a live region: the announcement above already says the skip with the new question.
        <Alert role="note">
          <SkipForward />
          <AlertTitle>Host pominął poprzednie pytanie.</AlertTitle>
          <AlertDescription>Głosy z niego przepadły.</AlertDescription>
        </Alert>
      )}
      {preview?.crash && <PreviewCrash />}
      <div ref={contentRef} className="contents">
        {content}
      </div>
    </div>
  );
}

export default function RoomScreen(props: Props) {
  return (
    <RoomErrorBoundary roomId={props.roomId} titleAs={props.preview ? "h2" : "h1"} isPreview={Boolean(props.preview)}>
      <RoomContent {...props} />
    </RoomErrorBoundary>
  );
}
