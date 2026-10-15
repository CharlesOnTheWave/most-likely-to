import { afterRoundActions, HostActions, type HostActionsPreview } from "@/components/room/HostActions";
import type { ActionOutcome } from "@/components/room/room-actions";
import type { RoomView, SkippedRound } from "@/lib/rooms/shared";

interface Props {
  view: RoomView;
  round: SkippedRound;
  titleAs: "h1" | "h2";
  refreshFailed: boolean;
  onNext: (round: number) => Promise<ActionOutcome>;
  onEnd: () => Promise<ActionOutcome>;
  hostPreview?: HostActionsPreview;
}

// The latest round was skipped and no question was left to open after it (decision D2 of
// context/changes/full-game-evening/research.md: skipping the last question does not end the game by itself). Its
// votes are gone, so there is nothing to show but that. The host ends the game; "Następne pytanie" only if the Worker
// still sees a question left (questionsLeft true), e.g. after a deploy that added questions.
export default function RoundSkipped({
  view,
  round,
  titleAs: Title,
  refreshFailed,
  onNext,
  onEnd,
  hostPreview,
}: Props) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <Title className="text-2xl font-semibold text-balance">Host pominął pytanie.</Title>
        <p className="text-muted-foreground">Głosy z niego przepadły.</p>
        <p aria-live="polite" className="text-muted-foreground text-xs">
          {refreshFailed ? "Nie udało się odświeżyć stanu gry" : ""}
        </p>
      </section>

      {view.role === "host" && (
        <HostActions
          {...afterRoundActions(view.questionsLeft === true, () => onNext(round.number), onEnd)}
          preview={hostPreview}
        />
      )}
    </div>
  );
}
