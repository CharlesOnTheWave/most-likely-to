// Room errors travel in the URL only as codes; the page shows the Polish text from this map, so text typed into
// `?error=` never reaches the screen (same as src/lib/auth-errors.ts).
const MESSAGES: Record<string, string> = {
  invalid_nick: "Nick musi mieć od 1 do 20 znaków.",
  nick_taken:
    "Ten nick jest już zajęty. Jeśli to ty, a telefon cię nie pamięta (np. otworzyłeś link w innej przeglądarce), wpisz inny nick.",
  invalid_categories: "Wybierz co najmniej jedną kategorię.",
  open_room_has_guests:
    "W starym pokoju są już goście. Załóż grę jeszcze raz i potwierdź, że stary pokój ma zostać zamknięty.",
  try_again: "Nie udało się założyć gry. Spróbuj jeszcze raz.",
  room_closed: "Ta gra jest zamknięta. Poproś hosta o nowy link.",
  room_unknown: "Nie znamy tego linku. Sprawdź, czy skopiował się cały.",
  service_unavailable: "Serwer jest chwilowo niedostępny. Spróbuj za kilka minut.",
};

const GENERIC_MESSAGE = "Coś poszło nie tak. Spróbuj ponownie.";

export function roomErrorMessage(code: string | null): string | null {
  if (code === null) return null;
  return Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : GENERIC_MESSAGE;
}
