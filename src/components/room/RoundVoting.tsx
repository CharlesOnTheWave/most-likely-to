import React, { useState } from "react";
import { CircleCheck, Eye, Send, SkipForward } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, FieldLegend, FieldSet } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { endGameAction, HostActions, type HostActionsPreview } from "@/components/room/HostActions";
import type { ActionOutcome } from "@/components/room/room-actions";
import { RoundQuestion } from "@/components/room/RoundQuestion";
import type { LobbyPlayer, RoomView, RoundView } from "@/lib/rooms/shared";

type VotingRoundView = Extract<RoundView, { phase: "voting" }>;

// A vote as this screen remembers it: a nick, or null for an abstention. Only in the component's memory, until the
// page reloads (S-04 shows it after a reload, S-02 does not): never in storage, a cookie or the URL (AGENTS.md).
export interface MyVote {
  target: string | null;
}

// /dev/room-states only: the starting state of this round's screen; the real page never sets it.
export interface VotingPreview {
  // Chosen, not sent yet: a nick, or null for "Wstrzymuję się".
  choice?: string | null;
  // "Zagłosuj" pressed with nothing chosen.
  missingChoice?: boolean;
  myVote?: MyVote;
  voting?: boolean;
  voteError?: string | null;
}

interface Props {
  view: RoomView;
  round: VotingRoundView;
  // Unique ids when /dev/room-states renders several screens on one page; "" on the real page.
  idPrefix: string;
  titleAs: "h1" | "h2";
  refreshFailed: boolean;
  // The round's number goes with the vote, the skip and nothing else, so neither lands in a question this screen has
  // not shown (round_over).
  onVote: (target: string | null, round: number) => Promise<ActionOutcome>;
  onReveal: () => Promise<ActionOutcome>;
  onSkip: (round: number) => Promise<ActionOutcome>;
  onEnd: () => Promise<ActionOutcome>;
  preview?: VotingPreview;
  hostPreview?: HostActionsPreview;
}

// The radio button's value for an abstention; a player's radio carries the player's place in the list, so no nick can
// clash with it. The choice itself is kept as the nick.
const ABSTAIN = "abstain";

const ROW = "flex items-center gap-3 px-3";
// The row shows the choice and the keyboard focus of its radio (the radio itself has no outline of its own).
const CHOICE_ROW = `${ROW} has-[:checked]:bg-accent has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50`;
const RADIO = "accent-primary size-4 shrink-0 outline-none";

function PlayerBadges({ player, isMe, hasVoted }: { player: LobbyPlayer; isMe: boolean; hasVoted: boolean }) {
  return (
    <>
      {player.host && <Badge variant="secondary">host</Badge>}
      {isMe && <Badge variant="outline">ty</Badge>}
      {hasVoted && (
        <Badge variant="outline" className="text-muted-foreground">
          <CircleCheck />
          zagłosował(a)
        </Badge>
      )}
    </>
  );
}

// "Kto z nas najprawdopodobniej …?": one person from the list (oneself too) or "Wstrzymuję się", then "Zagłosuj". A
// vote is final (decision D2), so the screen says so before and after. Everyone sees who has voted, never for whom;
// the host can reveal the result at any time (decision D3), skip the question while it is voting (its votes are gone,
// the next question opens at once) and end the game (decisions D2 and D4 of context/changes/full-game-evening/
// research.md); skipping and ending ask first.
export default function RoundVoting({
  view,
  round,
  idPrefix,
  titleAs,
  refreshFailed,
  onVote,
  onReveal,
  onSkip,
  onEnd,
  preview,
  hostPreview,
}: Props) {
  // undefined: nothing chosen yet.
  const [choice, setChoice] = useState<string | null | undefined>(preview?.choice);
  const [missingChoice, setMissingChoice] = useState(preview?.missingChoice ?? false);
  const [myVote, setMyVote] = useState<MyVote | null>(preview?.myVote ?? null);
  const [voting, setVoting] = useState(preview?.voting ?? false);
  const [voteError, setVoteError] = useState<string | null>(preview?.voteError ?? null);
  const isHost = view.role === "host";
  // After a reload only the database knows: "Głos oddany", without the choice.
  const hasVoted = myVote !== null || round.me_voted;
  const voted = new Set(round.voted);
  const choiceErrorId = `${idPrefix}vote-choice-error`;
  const votedOf = `${String(round.voted.length)} z ${String(view.players.length)}`;

  async function vote(target: string | null) {
    setVoting(true);
    setVoteError(null);
    const outcome = await onVote(target, round.number);
    setVoting(false);
    if (outcome.ok) {
      // Confirmed on screen at once, from the answer (PRD NFR), before the new state arrives.
      setMyVote({ target });
      return;
    }
    setVoteError(outcome.message);
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (choice === undefined) {
      setMissingChoice(true);
      e.currentTarget.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
      return;
    }
    if (voting) return;
    void vote(choice);
  }

  function choose(next: string | null) {
    setChoice(next);
    setMissingChoice(false);
  }

  function describedBy(...ids: (string | false)[]): string | undefined {
    const list = ids.filter((id): id is string => id !== false);
    return list.length > 0 ? list.join(" ") : undefined;
  }

  // Who has voted so far, and the quiet note when the state could not be refreshed.
  const status = (
    <div className="text-muted-foreground flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
      <p>
        Zagłosowało: {round.voted.length} z {view.players.length}
      </p>
      <p aria-live="polite">{refreshFailed ? "Nie udało się odświeżyć stanu gry" : ""}</p>
    </div>
  );

  let hint = "Wybierz jedną osobę, także siebie, albo wstrzymaj się.";
  if (hasVoted) {
    hint = isHost
      ? "Wynik pokaże się, gdy zagłosują wszyscy."
      : "Wynik pokaże się, gdy zagłosują wszyscy albo gdy host go odsłoni.";
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <RoundQuestion question={round.question} titleAs={titleAs} />
        <p className="text-muted-foreground">{hint}</p>
      </div>

      {hasVoted ? (
        <>
          <Alert>
            <CircleCheck />
            <AlertTitle>Głos oddany</AlertTitle>
            <AlertDescription>
              {myVote && <p>{myVote.target === null ? "Wstrzymujesz się." : `Twój głos: ${myVote.target}.`}</p>}
              <p>Głosu nie da się zmienić.</p>
            </AlertDescription>
          </Alert>

          <section aria-labelledby={`${idPrefix}players-heading`} className="flex flex-col gap-3">
            <h2 id={`${idPrefix}players-heading`} className="text-sm font-medium">
              Gracze ({view.players.length})
            </h2>
            <ul className="divide-y rounded-md border">
              {view.players.map((player) => (
                <li key={player.nick} className={`${ROW} justify-between py-2.5`}>
                  <span className="min-w-0 wrap-anywhere">{player.nick}</span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    <PlayerBadges player={player} isMe={player.nick === view.me} hasVoted={voted.has(player.nick)} />
                  </span>
                </li>
              ))}
            </ul>
            {status}
          </section>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          <FieldSet className="min-w-0 gap-3">
            <FieldLegend variant="label">Twój głos</FieldLegend>
            <ul className="divide-y rounded-md border">
              {view.players.map((player, index) => {
                const id = `${idPrefix}vote-${index}`;
                const badgesId = `${id}-badges`;
                const isMe = player.nick === view.me;
                const hasBadges = player.host || isMe || voted.has(player.nick);
                return (
                  <li key={player.nick} className={CHOICE_ROW}>
                    <input
                      type="radio"
                      id={id}
                      name={`${idPrefix}vote`}
                      value={index}
                      checked={choice === player.nick}
                      onChange={() => {
                        choose(player.nick);
                      }}
                      aria-describedby={describedBy(hasBadges && badgesId, missingChoice && choiceErrorId)}
                      aria-invalid={missingChoice || undefined}
                      className={RADIO}
                    />
                    <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer py-2.5 wrap-anywhere">
                      {player.nick}
                    </label>
                    {hasBadges && (
                      <span id={badgesId} className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        <PlayerBadges player={player} isMe={isMe} hasVoted={voted.has(player.nick)} />
                      </span>
                    )}
                  </li>
                );
              })}
              <li className={CHOICE_ROW}>
                <input
                  type="radio"
                  id={`${idPrefix}vote-abstain`}
                  name={`${idPrefix}vote`}
                  value={ABSTAIN}
                  checked={choice === null}
                  onChange={() => {
                    choose(null);
                  }}
                  aria-describedby={describedBy(missingChoice && choiceErrorId)}
                  aria-invalid={missingChoice || undefined}
                  className={RADIO}
                />
                <label htmlFor={`${idPrefix}vote-abstain`} className="min-w-0 flex-1 cursor-pointer py-2.5">
                  Wstrzymuję się
                </label>
              </li>
            </ul>
            {missingChoice && <FieldError id={choiceErrorId}>Wybierz osobę albo „Wstrzymuję się”.</FieldError>}
            {status}
          </FieldSet>

          <ServerError message={voteError} />

          <div className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={voting}>
              {voting ? (
                <>
                  <Spinner aria-hidden="true" />
                  Wysyłanie…
                </>
              ) : (
                <>
                  <Send />
                  Zagłosuj
                </>
              )}
            </Button>
            <p className="text-muted-foreground text-sm">Głosu nie da się zmienić.</p>
          </div>
        </form>
      )}

      {isHost && (
        <HostActions
          actions={[
            // Two steps (decision D3, option b): the round reveals itself after the last vote, so this button exists
            // only while someone has not voted, and the first press always asks. No timer.
            {
              id: "reveal",
              label: "Odsłoń wynik",
              busyLabel: "Odsłanianie…",
              Icon: Eye,
              confirmText: `Na pewno odsłonić? Zagłosowało ${votedOf}`,
              variant: "secondary",
              run: onReveal,
            },
            {
              id: "skip",
              label: "Pomiń pytanie",
              busyLabel: "Pomijanie…",
              Icon: SkipForward,
              confirmText: `Na pewno pominąć? Głosy przepadną (zagłosowało ${votedOf})`,
              variant: "outline",
              run: () => onSkip(round.number),
            },
            endGameAction(onEnd),
          ]}
          note="Możesz odsłonić wynik w każdej chwili, także zanim zagłosują wszyscy."
          // From lg one line under the form, stuck to the window's bottom only once the host has voted: before, a bar
          // would cover "Zagłosuj".
          placement={hasVoted ? "bar" : "row"}
          preview={hostPreview}
        />
      )}
    </div>
  );
}
