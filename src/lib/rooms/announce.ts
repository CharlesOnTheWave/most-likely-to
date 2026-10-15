import { questionSentence, type RoomView } from "@/lib/rooms/shared";

// What the room screen tells a screen reader when the game moves on, and when it shows the note after a skip, worked
// out from the room's state alone (context/changes/full-game-evening/plan.md, Faza 4 #1). No DOM, so the unit tests
// check it; RoomScreen sets its live region from here. The same words for the host and every guest.

// Changes with the room's status, the round's phase and its number, and with nothing else: a vote changes who has
// voted, never this key, so a vote is not announced as a new question.
export function announcementKey(view: RoomView): string {
  return `${view.status}:${view.round?.phase ?? ""}:${String(view.round?.number ?? "")}`;
}

// The sentence for the state the key points at; "" in the lobby, which the player sees for themselves. The first
// question starts the game; every later one says its number, and the one after a skip says the skip first, so a screen
// that slept through the skip still hears it.
export function announcement(view: RoomView): string {
  if (view.status === "closed") return "Koniec wieczoru.";
  const { round } = view;
  if (round === null) return "";
  if (round.phase === "skipped") return "Host pominął pytanie.";
  if (round.phase === "revealed") return "Wynik odsłonięty.";

  const sentence = questionSentence(round.question);
  if (round.after_skip) return `Host pominął poprzednie pytanie. Pytanie ${String(round.number)}. ${sentence}`;
  if (round.number === 1) return `Gra się zaczęła. ${sentence}`;
  return `Pytanie ${String(round.number)}. ${sentence}`;
}

// "Host pominął poprzednie pytanie. Głosy z niego przepadły." above the question, for the whole round that opened after
// a skip. The database says so (after_skip), not the screen's memory: a screen that slept through a reveal would take
// an ordinary "Następne pytanie" for a skip.
export function skipNotice(view: RoomView): boolean {
  return view.status === "playing" && view.round?.phase === "voting" && view.round.after_skip;
}
