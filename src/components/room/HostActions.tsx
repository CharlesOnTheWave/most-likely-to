import { useRef, useState } from "react";
import { ArrowRight, Flag, type LucideIcon } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ActionOutcome } from "@/components/room/room-actions";

// The host's buttons that move the game on: "Odsłoń wynik", "Pomiń pytanie", "Zakończ grę", "Następne pytanie". An
// action that takes something away (votes, the evening) asks first: the same button turns into the question and acts
// on the second press, with "Anuluj" next to it, so the focus stays where it was (the pattern of "Odsłoń wynik" from
// S-02). One question at a time; while one action is on its way every button waits, still focusable (aria-disabled,
// not disabled), so the keyboard's place is not lost while the new state is on its way or when the action is refused.

export type HostActionId = "reveal" | "skip" | "end" | "next";

export interface HostAction {
  id: HostActionId;
  label: string;
  busyLabel: string;
  Icon: LucideIcon;
  // The question on the second press; without it the first press acts.
  confirmText?: string;
  variant: "default" | "secondary" | "outline";
  run: () => Promise<ActionOutcome>;
}

// "Zakończ grę" while voting, after a reveal and after the last question was skipped: the room closes for everyone
// (decision D4), so it always asks.
export function endGameAction(run: () => Promise<ActionOutcome>): HostAction {
  return {
    id: "end",
    label: "Zakończ grę",
    busyLabel: "Kończenie gry…",
    Icon: Flag,
    confirmText: "Na pewno zakończyć grę? Wszyscy zobaczą koniec wieczoru",
    variant: "outline",
    run,
  };
}

// "Następne pytanie" after a reveal: one press, nothing is lost.
export function nextQuestionAction(run: () => Promise<ActionOutcome>): HostAction {
  return {
    id: "next",
    label: "Następne pytanie",
    busyLabel: "Wczytywanie pytania…",
    Icon: ArrowRight,
    variant: "default",
    run,
  };
}

// The host's buttons once no round is voting (RoundReveal, RoundSkipped): "Następne pytanie" while the game's pool has
// a question left, otherwise the sentence that it ran out, and "Zakończ grę" either way. The game never ends by itself.
export function afterRoundActions(
  questionsLeft: boolean,
  onNext: () => Promise<ActionOutcome>,
  onEnd: () => Promise<ActionOutcome>,
): { actions: HostAction[]; note?: string } {
  if (!questionsLeft) {
    return { actions: [endGameAction(onEnd)], note: "Pytania z wybranych kategorii się skończyły." };
  }
  return { actions: [nextQuestionAction(onNext), endGameAction(onEnd)] };
}

// /dev/room-states only: the starting state of the host's buttons; the real page never sets it.
export interface HostActionsPreview {
  confirming?: HostActionId;
  busy?: HostActionId;
  error?: string | null;
}

interface Props {
  actions: HostAction[];
  // A quiet line under the buttons, e.g. when the questions ran out.
  note?: string;
  preview?: HostActionsPreview;
}

export function HostActions({ actions, note, preview }: Props) {
  const [confirming, setConfirming] = useState<HostActionId | null>(preview?.confirming ?? null);
  const [busy, setBusy] = useState<HostActionId | null>(preview?.busy ?? null);
  const [error, setError] = useState<string | null>(preview?.error ?? null);
  const buttons = useRef(new Map<HostActionId, HTMLButtonElement>());
  const asking = actions.find((action) => action.id === confirming && busy === null);

  async function run(action: HostAction) {
    setBusy(action.id);
    setError(null);
    const outcome = await action.run();
    // Accepted: the button stays busy until the new state arrives and this view goes away.
    if (!outcome.ok) {
      setBusy(null);
      setConfirming(null);
      setError(outcome.message);
    }
  }

  function press(action: HostAction) {
    if (busy !== null) return;
    if (action.confirmText !== undefined && confirming !== action.id) {
      setError(null);
      setConfirming(action.id);
      return;
    }
    void run(action);
  }

  function cancel(id: HostActionId) {
    setConfirming(null);
    buttons.current.get(id)?.focus();
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-6">
      {actions.map((action) => {
        const isAsking = asking?.id === action.id;
        const isBusy = busy === action.id;
        const { Icon } = action;
        return (
          <div key={action.id} className="flex flex-col gap-2 sm:flex-row">
            <Button
              ref={(node) => {
                if (node) buttons.current.set(action.id, node);
                else buttons.current.delete(action.id);
              }}
              type="button"
              variant={isAsking ? "default" : action.variant}
              aria-disabled={busy !== null || undefined}
              // The question may wrap on a phone ("Głosy przepadną (zagłosowało 12 z 20)"); busy looks as disabled.
              className="h-auto min-h-9 py-2 text-center whitespace-normal aria-disabled:cursor-default aria-disabled:opacity-50 sm:flex-1"
              onClick={() => {
                press(action);
              }}
            >
              {isBusy ? (
                <>
                  <Spinner aria-hidden="true" />
                  {action.busyLabel}
                </>
              ) : (
                <>
                  <Icon />
                  {isAsking ? action.confirmText : action.label}
                </>
              )}
            </Button>
            {isAsking && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  cancel(action.id);
                }}
              >
                Anuluj
              </Button>
            )}
          </div>
        );
      })}
      {note && <p className="text-muted-foreground text-sm">{note}</p>}
      {/* A screen reader may not read a focused button again when its name changes; this says the question. */}
      <p aria-live="polite" className="sr-only">
        {asking?.confirmText ?? ""}
      </p>
      <ServerError message={error} />
    </div>
  );
}
