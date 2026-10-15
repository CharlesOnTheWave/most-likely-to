// Room errors travel only as codes: in the URL (`?error=`) after a form, in the JSON answer of a round's action. The
// screen shows the Polish text from this map, so text typed into `?error=` never reaches the screen (same as
// src/lib/auth-errors.ts).

// The refusals of the game's actions (start, vote, reveal, next, skip, end) and of joining a game in play, each with
// its own text (audit G2). tests/unit/room-errors.test.ts checks this list against the plans.
export const ROUND_REFUSALS = [
  "game_started",
  "not_enough_players",
  "no_questions",
  "invalid_question",
  "already_voted",
  "round_revealed",
  "unknown_target",
  "no_round",
  "round_over",
  "round_in_progress",
] as const;

export type RoundRefusal = (typeof ROUND_REFUSALS)[number];

const MESSAGES: Record<string, string> = {
  invalid_nick: "Nick musi mieć od 1 do 20 znaków.",
  nick_taken:
    "Ten nick jest już zajęty. Jeśli to ty, a telefon cię nie pamięta (np. link otwarty w innej przeglądarce), wpisz inny nick.",
  invalid_categories: "Wybierz co najmniej jedną kategorię.",
  open_room_has_guests:
    "W starym pokoju są już goście. Załóż grę jeszcze raz i potwierdź, że stary pokój ma zostać zamknięty.",
  try_again: "Nie udało się założyć gry. Spróbuj jeszcze raz.",
  room_closed: "Ta gra jest zamknięta. Poproś hosta o nowy link.",
  room_unknown: "Nie znamy tego linku. Sprawdź, czy skopiował się cały.",
  service_unavailable: "Serwer jest chwilowo niedostępny. Spróbuj za kilka minut.",
  game_started: "Gra już trwa. Do rozpoczętej gry nie można dołączyć.",
  not_enough_players: "Do gry potrzeba co najmniej 3 graczy.",
  no_questions: "W wybranych kategoriach nie ma pytań. Załóż nową grę z innymi kategoriami.",
  invalid_question: "Nie udało się wylosować pytania. Spróbuj jeszcze raz.",
  already_voted: "Twój głos jest już oddany. Nie da się go zmienić.",
  round_revealed: "Wynik jest już odsłonięty. Głosowanie się skończyło.",
  unknown_target: "Tej osoby nie ma w grze. Wybierz kogoś z listy.",
  no_round: "Teraz nie trwa żadna runda.",
  round_over: "To pytanie już się zmieniło.",
  round_in_progress: "Głosowanie jeszcze trwa. Najpierw odsłoń wynik.",
};

const GENERIC_MESSAGE = "Coś poszło nie tak. Spróbuj ponownie.";

export function roomErrorMessage(code: string | null): string | null {
  if (code === null) return null;
  return Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : GENERIC_MESSAGE;
}
