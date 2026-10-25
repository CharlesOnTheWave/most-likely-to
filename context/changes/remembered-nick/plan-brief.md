# Zapamiętany nick (S-14) — Plan Brief

> Full plan: `context/changes/remembered-nick/plan.md`
> Research: `context/changes/remembered-nick/research.md`

## What & Why

Ta sama przeglądarka podpowiada nick, którym gracz ostatnio wszedł do gry: gość ma go wpisanego przy następnym linku,
host w „Nowej grze”. To wygoda (FR-024, „miło mieć”), zdjęta z „Parked” decyzją hosta 2026-10-25. Z przeglądarki
pamiętamy wyłącznie nick, nigdy głos.

## Starting Point

Dwa formularze z polem nicku (`JoinForm`, `NewGameForm`) zawsze startują puste; jedynie „Poproś jeszcze raz” dostaje
nick od serwera. Gra nie zapisuje dziś nicku w przeglądarce; jedyny zapis to znacznik przeładowania w `useRoomState`.

## Desired End State

Gracz, który raz wszedł do gry w tej przeglądarce, następnym razem tylko klika „Dołącz” (albo „Poproś o wejście”), a
host „Załóż grę”; nick da się zmienić przed wejściem. Po odmowie „nick zajęty” pole jest puste jak dziś. W przeglądarce
leży tylko nick pod jednym kluczem.

## Key Decisions Made

| Decision           | Choice                                                          | Why (1 sentence)                                                | Source   |
| ------------------ | --------------------------------------------------------------- | --------------------------------------------------------------- | -------- |
| Kiedy zapisać      | Na ekranie pokoju, z `view.me` (nick przyjęty przez bazę)       | Nie zapamiętujemy nicku zajętego ani za długiego                | Research |
| Host i gość        | Jeden wspólny zapamiętany nick                                  | Host też jest graczem i zwykle gra tym samym nickiem            | Research |
| Po „nick zajęty”   | Puste pole, bez podpowiedzi                                     | Podpowiadanie zajętego nicku jeszcze raz by irytowało           | Research |
| Podglądy           | Bez podpowiedzi w podglądach + nowe stany „nick podpowiedziany” | Podglądy nie zależą od przeglądarki dewelopera                  | Research |
| Reguła D7          | S-14 teraz, dopisek o drugim wyjątku w planie D7                | D7 jeszcze nie działa; jeden dostęp w jednym module             | Research |
| Testy              | Test jednostkowy modułu + test E2E w CI                         | Moduł w `node` bez nowych zależności, E2E dowodzi przepływu     | Research |
| Kształt kodu       | Jeden moduł `src/lib/rooms/remembered-nick.ts`                  | Jedno miejsce dla klucza, reguły i obsługi zablokowanej pamięci | Plan     |
| Moment podpowiedzi | Efekt po zamontowaniu, tylko do pustego pola                    | Bez rozjazdu hydratacji i bez nadpisania szybkiego pisania      | Plan     |

## Scope

**In scope:**

- moduł z kluczem `mlt-nick`, regułą 1–20 znaków i bezpiecznym zapisem/odczytem; test jednostkowy;
- zapis na ekranie pokoju; podpowiedź w `JoinForm` (`join`, `request`) i `NewGameForm`; wyjątek po `nick_taken`;
- stany `new-remembered` i `join-remembered` w `/dev/room-states`, wiersz w słowniku, dopisek w planie D7;
- test E2E, PR, wdrożenie, przeklikanie.

**Out of scope:**

- zapis głosu, tokenu czy czegokolwiek poza nickiem; nick w adresie, ciasteczku albo logu;
- przycisk „zapomnij nick” i dopisek przy polu; zmiany w bazie, trasach API i smoke;
- wdrożenie reguły D7; poprawki `shape-notes.md`.

## Architecture / Approach

`RoomScreen` → `rememberNick(view.me)` → `localStorage["mlt-nick"]`. Po zamontowaniu `JoinForm`/`NewGameForm` →
`readRememberedNick()` → wpisanie do pustego pola. Strona `/j/[token]` przekazuje `suggestNick={errorCode !==
"nick_taken"}`; podglądy i „Poproś jeszcze raz” podpowiedzi nie dostają. Dostęp do `window.localStorage` w try/catch,
błędy przez `logEvent` bez danych gracza.

## Phases at a Glance

| Phase                          | What it delivers                                              | Key risk                                             |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------- |
| 1. Moduł i test jednostkowy    | Zapis/odczyt tylko nicku, odporny na zablokowaną pamięć       | Reguła długości rozjechana z formularzem             |
| 2. Ekrany, podglądy, dokumenty | Podpowiedź u gościa i hosta, wyjątek po „nick zajęty”, zrzuty | Podpowiedź nadpisze tekst wpisany tuż po załadowaniu |
| 3. E2E i wdrożenie             | Dowód w CI, PR, scalenie, sprawdzenie na telefonie            | Przeglądarka w Discordzie na iOS ma osobną pamięć    |

**Prerequisites:** S-01 gotowe; gałąź `remembered-nick` od `e87003c`; PRD FR-024 i roadmapa S-14 już w gałęzi.
**Estimated effort:** ok. 1–2 sesje w 3 fazach; bez migracji i bez `db push`.

## Open Risks & Assumptions

- Na iOS przeglądarka wbudowana w Discorda ma pamięć osobną od Safari, więc podpowiedź działa w tej przeglądarce, w której
  gracz otworzył link (FR-024 mówi „ta sama przeglądarka”).
- Na wspólnym laptopie czy telewizorze podpowiedź trafi do następnej osoby; zmienia ją, wpisując swój nick.

## Success Criteria (Summary)

- Drugi raz z tego samego telefonu gracz wchodzi jednym kliknięciem; host ma swój nick w „Nowej grze”.
- Po „nick zajęty” pole jest puste; w przeglądarce nie leży nic poza nickiem.
- CI zielone z nowym testem E2E; przeklikanie Karola na telefonie i laptopie.
