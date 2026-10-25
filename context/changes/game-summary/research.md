---
date: 2026-10-25T12:43:59+01:00
researcher: Claude (Opus 5.5) z Karolem
git_commit: f9ee390
branch: game-summary
repository: most-likely-to
topic: "S-15 / FR-022: skąd wziąć dane podsumowania wieczoru na ekranie końca gry i co je ogranicza"
tags: [research, codebase, game-summary, EveningEnd, room_lobby, round_results, FR-022, anonimowość]
status: complete
last_updated: 2026-10-25
last_updated_by: Claude (Opus 5.5)
---

# Research: podsumowanie wieczoru (S-15, FR-022)

**Date**: 2026-10-25T12:43:59+01:00
**Researcher**: Claude (Opus 5.5) z Karolem
**Git Commit**: f9ee390 (`origin/main`; roadmapa z S-15 i `change.md` niescommitowane na gałęzi)
**Branch**: game-summary
**Repository**: most-likely-to

## Research Question

Co dziś istnieje w bazie i w kodzie, gdy gra się kończy, skąd ekran „Koniec wieczoru” mógłby wziąć wyróżnienia
z całej gry (FR-022: „najwięcej głosów dziś”, „nikt dziś nie głosował na X”; bez punktów i bez rankingu między
wieczorami) i co ogranicza taki ekran: zasada „nigdy kto na kogo”, testy, przypadki brzegowe i wcześniejsze decyzje.

## Summary

- **Dane są w bazie.** Każda odsłona zapisuje w `private.round_results` jeden wiersz na każdego uprawnionego gracza
  (także z zerem): `round_id`, `player_id`, `votes`, bez kolumny głosującego
  (`supabase/migrations/20261014101922_first_live_round.sql:128-135,200-204`). Przy końcu gry nic tego nie kasuje:
  `end_game`, „Nowa gra” i godzinne sprzątanie wołają `private.drop_round_state`, które usuwa tylko urnę i prośby
  spóźnionych (`20261022132240_latecomer_admission.sql:65-84`). Komentarz przy `end_game` mówi to wprost:
  „revealed results (counts only) stay” (`20261015122252_full_game_evening.sql:205-206`).
- **Do ekranu dziś nie docierają.** `room_lobby` czyta rundę tylko przy `status = 'playing'` i tylko najnowszą
  (`20261024094002_question_list_review.sql:637-644`). Dla `closed` zwraca 7 kluczy (`status`, `role`, `me`,
  `players`, `round: null`, `requests`, `question_list`; `:703-718`), a parser w Workerze odrzuca rundę w zamkniętym
  pokoju i kopiuje tylko znane pola (`src/lib/rooms/shared.ts:258-271`). Wniosek: podsumowanie wymaga nowych danych
  z serwera (migracja), a nie samej zmiany ekranu.
- **Suma z gry nie łamie anonimowości.** Każda liczba w `round_results` jest tą samą liczbą, którą odsłona tej rundy
  już pokazała wszystkim w pokoju (`question_list_review.sql:682-700`: wynik to dokładnie `nick` i `votes`). Suma na
  gracza po odsłoniętych rundach jednej gry nie zawiera głosującego, więc nie tworzy pary „kto na kogo”.
- **Ekran końca jest jeden dla trzech dróg zamknięcia** („Zakończ grę”, „Nowa gra”, sprzątanie) i nie wie, którą
  przyszedł (`src/components/room/RoomScreen.tsx:55-57,156-157`). Po `closed` ekran przestaje odpytywać serwer
  (`useRoomState.ts:140,145`), więc podsumowanie musi przyjść w pierwszym stanie `closed` (fetch albo SSR).
- **Zmiana dotknie pilnowanych kontraktów:** dokładny zbiór kluczy `LOBBY_KEYS` (`tests/db/support/rounds.ts:105`,
  sprawdzany m.in. dla zamkniętego pokoju w `tests/db/round-anonymity.test.ts:316`), zasadę planu testów „po
  »Zakończ grę« tylko klucze lobby” (`context/foundation/test-plan.md:226`), pgTAP „`room_lobby` w dokładnie jednej
  wersji” (`supabase/tests/round_creator_view.test.sql:898-902`) i podgląd stanu w `/dev/room-states`.
- **Do decyzji Karola przed planem** (szczegóły w Open Questions): które wyróżnienia i ile, czy pokazać całą listę
  sum (ryzyko „tabeli wyników”), remisy, co ze spóźnionym bez żadnej uprawnionej rundy, ton „nikt nie głosował na X”.

## Detailed Findings

### 1. Co zostaje w bazie po odsłonie i po końcu gry

- `private.rounds`: jeden wiersz na rundę z `phase` (`voting`, `revealed`, od S-03 także `skipped`), `eligible`
  (`uuid[]` uprawnionych, zrzut z chwili otwarcia rundy) oraz `abstained` i `ballots`, ustawiane dopiero przy odsłonie
  (`first_live_round.sql:111-126`). `ballots` liczy wszystkich, którzy oddali głos, także wstrzymania się
  (`:196-198`).
- `private.round_results` (`first_live_round.sql:128-135`): klucz `(round_id, player_id)`, `votes >= 0`. `finish_round`
  wstawia wiersz dla każdego gracza z `eligible` z liczbą z urny albo `0` (`:200-204`), potem kasuje urnę
  (`:210-211`). Wyniki są po `player_id`, nick dochodzi złączeniem z `public.players`.
- Pominięcie: `skip_round` kasuje urnę i ustawia `phase = 'skipped'`; runda nie ma żadnych liczb
  (`full_game_evening.sql:195-197`, decyzja D3 w `context/archive/2026-10-15-full-game-evening/research.md:146`).
- Koniec gry: `end_game` ustawia `closed` i woła `drop_round_state` (`full_game_evening.sql:237-238`); runda
  przerwana w trakcie głosowania nie zostawia wierszy w `round_results`. To samo robią „Nowa gra” (`create_room`) i
  sprzątanie gier starszych niż 12 h (`20261014101925_close_stale_games.sql:6-7,32-33`). Żadna z tych dróg nie zapisuje,
  którą drogą pokój się zamknął.
- Usuwanie: tylko kaskady pokój → rundy → wyniki i gracz → wyniki (`20261007122858_room_lobby.sql:21,36`;
  `first_live_round.sql:114,131-132`). W sprawdzonych migracjach (7 plików w `supabase/migrations/`) żadna funkcja nie
  kasuje pokoju ani gracza; retencji nie ma (dryf D-06, `context/domain/domain-distillation.md:184`). Zaplanowane
  kasowanie gier hosta (S-13) skasuje też te wyniki kaskadą.
- Dostęp: tabele `private` nie mają grantów ani `usage` na schemacie dla ról API (`first_live_round.sql:160-161,797`).
  W sprawdzonych migracjach jedyna funkcja, która oddaje te liczby rolom API, to `room_lobby` (`security definer`, `grant … to anon, authenticated`,
  `question_list_review.sql:754`).

### 2. Jak stan pokoju dociera do ekranu

- Ścieżka: RPC `room_lobby` (`question_list_review.sql:556-731`) → `roomLobby()` (`src/lib/rooms/server.ts:219-235`)
  → `roomView()` (`server.ts:269-279`). Dwóch wywołujących: `GET /api/rooms/[id]/lobby`
  (`src/pages/api/rooms/[id]/lobby.ts:15-44`) i SSR strony `src/pages/r/[id].astro:23-51`. Rozszerzenie `room_lobby`
  trafi więc na obie drogi bez nowego endpointu.
- Typy: `LobbyState` (`shared.ts:87-95`) i `RoomView` (`shared.ts:117-121`). W `closed`: `round: null`,
  `requests: []`, `questionsLeft: null`, `questions: null`; `players` jest pełne (`room-states.astro:233-236`).
- Parser: przy `status !== 'playing'` niepusta runda to odmowa (`shared.ts:263-265`), a wynik buduje obiekt z
  wymienionych pól (`:265,270`), więc nowe pole z bazy bez zmiany parsera po cichu zniknie.
- Kto widzi zamknięty pokój: host (konto) i gość z ciasteczkiem pokoju, które żyje 24 h
  (`src/lib/rooms/tokens.ts:13,42`); `player_secrets` nie jest kasowane przy zamknięciu
  (`question_list_review.sql:596-608`). Stary link `/j/…` po końcu odpowiada 410 (`tests/e2e/game.spec.ts:173-176`).
- Tekst pytań jest tylko po stronie serwera (`context/foundation/lessons.md:12-17`); Worker dokleja go w `roomView()`
  (`server.ts:241-248,263-277`). Jeśli podsumowanie miałoby wymieniać pytania, tekst musi dokleić Worker.

### 3. Ekran „Koniec wieczoru” dziś

- `EveningEnd` (`RoomScreen.tsx:58-74`): ikona, tytuł „Koniec wieczoru” (h1, w podglądach h2), „Dzięki za grę!”,
  dla hosta przycisk-link „Nowa gra”, dla gościa „Chcesz zagrać jeszcze raz? Poproś hosta o nowy link.”. Komentarz
  `:55-57` mówi „No counts and no summary of the evening (FR-022 is parked)” i jest po tej zmianie do aktualizacji.
- Wybór widoku tylko po `view.status === "closed"` (`RoomScreen.tsx:156-157`).
- Szerokość: `roomColumn` daje dla `closed` `ROOM_NARROW` (512 px na każdej szerokości, `room-frame.ts:13,23`).
  Szersze kolumny to `ROUND_COLUMN` (`lg:max-w-3xl`, `:19`) i `LOBBY_COLUMN` (`:16`).
- Regiony: `EveningEnd` to jedna `<section>` bez `aria-labelledby`. Nazwy regionów „Gracze” (`RoomLobby.tsx:190-193`)
  i „Wynik” (`RoundReveal.tsx:134-141`) są zajęte; e2e szuka ich po roli (AGENTS.md, „## UI”), więc region
  podsumowania potrzebuje własnej nazwy.
- Komunikat dla czytnika ekranu przy końcu: „Koniec wieczoru.” (`src/lib/rooms/announce.ts:17`).

### 4. Klocki do ponownego użycia

- `sortResults` (`src/lib/rooms/results.ts:6-8`): najwięcej głosów pierwsze, remis w kolejności miejsc, zera na dole;
  zakłada wejście w kolejności miejsc (tak oddaje je `room_lobby`, `question_list_review.sql:691`).
- `chart.ts`: `resultViews`, `pieSlices`, `resultBars` i 20 tokenów kolorów wykresu (`chart.ts:12`).
- `RoundReveal.tsx:122-127,180-217`: pogrubiona najwyższa liczba, przygaszone zera, znaczek „ty”, tabela jako dane
  dostępne; wstrzymania jako „Wstrzymało się: N” (`:223`).
- Odmiana liczebników: w `src/` jest jedna pomocnicza funkcja, `playerCountLabel` (`shared.ts:367-369`), i daje
  „N graczy” dla każdego N ≠ 1 (więc „2 graczy”). Dla „głos / głosy / głosów” pomocnika nie ma.

### 5. Przypadki brzegowe, które podsumowanie musi obsłużyć

- **Gra bez żadnej odsłony** (pokój zamknięty z poczekalni przez „Nowa gra”, wszystkie rundy pominięte albo koniec w
  trakcie pierwszej rundy): brak wierszy w `round_results`, czyli nic do podsumowania. Podgląd zamkniętego pokoju bez
  gry już istnieje (`room-states.astro:609-647`).
- **Spóźniony** (S-08): po wpuszczeniu jest graczem (`latecomer_admission.sql:308-312`), ale w `eligible` dopiero od
  następnej otwartej rundy, i tylko na uprawnionych można głosować (`20261020205751_round_number_required.sql:186-189`).
  Brak wiersza w `round_results` znaczy „nie był uprawniony”, wiersz z `0` znaczy „był i nie dostał głosu”. „Nikt nie
  głosował na X” ma sens tylko dla graczy z co najmniej jedną uprawnioną odsłoniętą rundą; spóźniony wpuszczony w
  ostatniej rundzie nie ma żadnego wiersza.
- **Spóźniony widzi sumy rund sprzed swojego wejścia.** To same liczby, które reszta pokoju widziała na odsłonach; pary
  nie ma.
- **Remis** na szczycie i wszyscy z zerem poza jedną osobą: nie ma decyzji, jak to pokazać.
- **Przyjęty wyciek z PRD** (`context/foundation/prd.md:144`): przy jednym głosie albo gdy wszyscy wskażą tę samą osobę,
  liczby rundy zdradzają głos. Suma po kilku rundach niczego tu nie dokłada, bo to suma liczb już pokazanych.

### 6. Strażnicy anonimowości i testy, których dotknie zmiana

- `tests/db/support/rounds.ts:105`: `LOBBY_KEYS = ["me", "players", "question_list", "requests", "role", "round",
"status"]`, a komentarz `:102-103` mówi, że klucz spoza listy to możliwy wyciek „until a decision adds it here”.
  Sprawdzane `toEqual` w `round-anonymity.test.ts:152,277,316` (316 = pokój zamknięty).
- `context/foundation/test-plan.md:220-227`: pełne zbiory kluczy; `:226` dziś wymaga, by po „Zakończ grę” stan
  `closed` miał „tylko klucze lobby” dla gościa, który głosował, gościa, który nie, i hosta. Nowy klucz zmienia ten
  kontrakt, więc plan musi zaktualizować i test, i zdanie w planie testów.
- pgTAP `supabase/tests/round_creator_view.test.sql`: brak przywilejów ról API na tabelach rund (`:620-651`), żadna
  tabela `private` w publikacji Realtime (`:654-661`), `round_results` ma dokładnie trzy kolumny (`:676-679`),
  `room_lobby` w dokładnie jednej wersji (`:898-902`; `create or replace` z tą samą sygnaturą to spełnia, nowa sygnatura
  wymaga zmiany testu), pominięta i przerwana runda bez żadnej liczby (`:990-993,1024-1027`).
- `tests/db/game-rules.test.ts:353-354,432` używa `toMatchObject` dla zamkniętego pokoju, więc dodatkowy klucz tam
  przejdzie.
- Unit: fixture `CLOSED` w `tests/unit/room-state.test.ts:32-39` i testy parsera (`:153-168,182-205,243`); własne
  `closed()` w `tests/unit/announce.test.ts:99-110`.
- E2E: `eveningEnd()` szuka h1 „Koniec wieczoru” (`tests/e2e/support/round.ts:107-110`); `game.spec.ts:153-171`
  sprawdza koniec na trzech ekranach i że gość ma 0 linków „Nowa gra”. Scenariusz tego pliku ma jedną odsłoniętą rundę
  (pytanie 1: A na B, B się wstrzymuje, host głosuje ostatni, `game.spec.ts:70-71`), jedną pominiętą (pytanie 2,
  `:131-134`) i jedną przerwaną końcem gry (pytanie 3, `:153`): gotowa mieszanka przypadków na wyrocznię podsumowania
  (dokładne liczby rundy 1 są w `round.spec.ts`, do przepisania ręcznie w planie, `test-plan.md:142,167`).
- Podglądy: `closed()` w `room-states.astro:233-236` i stany 59/60 (`:1301-1320`); `end-host` w
  `room-window.astro:287-299`. Jeśli `RoomView` dostanie pole wymagane, każdy literał w obu stronach musi je dostać
  (`astro check`), tak jak przy `questionsLeft` i `questions`.
- `scripts/ui-literals.mjs:8-17` skanuje cały `src/components/room/`, więc nowy komponent tam jest objęty kontrolą tokenów
  bez dopisywania.

## Code References

- `supabase/migrations/20261014101922_first_live_round.sql:111-135` — `private.rounds` i `private.round_results`
- `supabase/migrations/20261014101922_first_live_round.sql:180-212` — `finish_round`: liczby dla wszystkich uprawnionych, potem kasowanie urny
- `supabase/migrations/20261015122252_full_game_evening.sql:205-240` — `end_game`: `closed` + `drop_round_state`, wyniki zostają
- `supabase/migrations/20261022132240_latecomer_admission.sql:65-84` — `drop_round_state`: urna i prośby, bez wyników
- `supabase/migrations/20261024094002_question_list_review.sql:637-718` — `room_lobby`: runda tylko przy `playing`, klucze odpowiedzi
- `src/lib/rooms/shared.ts:87-121,258-283` — `LobbyState`, `RoomView`, parser stanu
- `src/lib/rooms/server.ts:219-279` — `roomLobby()`, `roomView()`
- `src/components/room/RoomScreen.tsx:55-74,156-157` — `EveningEnd` i wybór widoku
- `src/components/room/useRoomState.ts:140,145` — koniec odpytywania przy `closed`
- `src/components/room/room-frame.ts:13-23` — szerokości, `closed` → `ROOM_NARROW`
- `src/lib/rooms/results.ts:6-8`, `src/lib/rooms/chart.ts` — sortowanie i widoki wyników odsłony
- `tests/db/support/rounds.ts:100-105`, `tests/db/round-anonymity.test.ts:152,277,316` — dokładne klucze stanu
- `supabase/tests/round_creator_view.test.sql:620-679,898-902` — pgTAP: granty, kolumny, jedna wersja `room_lobby`
- `tests/e2e/game.spec.ts:70-176`, `tests/e2e/support/round.ts:107-110` — scenariusz wieczoru i lokator końca
- `src/pages/dev/room-states.astro:233-236,609-647,1301-1320`, `src/pages/dev/room-window.astro:287-299` — podglądy

## Architecture Insights

- **Wzorzec „dzwonek + stan z serwera”** (F-01): wszystko, co gracz widzi, przychodzi z `room_lobby`; ekran nie liczy
  niczego z historii, bo jej nie ma po stronie przeglądarki. Podsumowanie pasuje do tego wzorca jako kolejna część
  stanu zamkniętego pokoju.
- **Dwie drogi danych** (wybór dla `/10x-plan`, obie z tym samym SQL-em sumującym `round_results.votes` po rundach
  `revealed` danego pokoju, złączonym z `players` po nick):
  - _Nowy klucz w `room_lobby`_ (np. `summary`, `null` poza `closed`): ta sama funkcja, te same granty, oba
    wywołujące (fetch i SSR) dostają go od razu; koszt: zmiana `LOBBY_KEYS`, zdania w `test-plan.md:226`, parsera i
    fixture'ów. `create or replace` z tą samą sygnaturą utrzymuje pgTAP „jedna wersja”.
  - _Osobne RPC_ tylko dla zamkniętego pokoju: `room_lobby` bez zmian, ale nowy publiczny endpoint `security definer`
    z kopią tych samych kontroli dostępu (host / token gościa), nowy wiersz w tabeli bramki RPC
    (`test-plan.md:145`), nowa trasa albo drugie wywołanie w `roomView()`.
- **Kontrakt dokładnych kluczy** jest celowym hamulcem: każdy nowy klucz w stanie wymaga decyzji zapisanej przy
  `LOBBY_KEYS` (`rounds.ts:102-103`). Podsumowanie z samymi `nick` + liczba spełnia regułę „wynik to dokładnie
  `nick` i `votes`” odsłony (`test-plan.md:224`).

## Historical Context (from prior changes)

- `context/archive/2026-10-13-first-live-round/research.md:277,288` — D1: przy odsłonie zapisujemy wyłącznie liczby na
  osobę. Nadal prawdziwe (`first_live_round.sql:128-135`).
- `context/archive/2026-10-13-first-live-round/plan.md:339` i `reviews/plan-review.md:30-47` — F1: sprzątanie starych
  gier kasuje urnę, „odsłonięte wyniki (same liczby) zostają”. Nadal prawdziwe (`close_stale_games.sql:6-7`).
- `context/archive/2026-10-15-full-game-evening/research.md:124-127,148-149` — D4: „Koniec wieczoru” bez punktów, bez
  podsumowania, bez liczby pytań; przyjęte skutki: ostatni wynik znika z ekranów przy końcu, a ten sam ekran widzą goście
  pokoju zamkniętego przez „Nową grę” i sprzątanie. Wszystkie trzy nadal prawdziwe (`RoomScreen.tsx:55-57,156-157`).
- `context/archive/2026-10-15-full-game-evening/research.md:201` — liczba zagranych pytań na ekranie końca: „wrócić przy
  S-13 albo FR-022”. Otwarte; dane są (`private.rounds` z `phase`).
- `context/archive/2026-10-15-full-game-evening/research.md:149` — FR-022 odłożone „wrócić po pierwszych wieczorach”;
  zdjęte z Parked 2026-10-25 decyzją Karola (roadmapa S-15).
- `context/changes/guest-vote-flow-analysis/research.md:191` — `parseLobbyState` po cichu pomija klucze spoza
  kontraktu. Nadal prawdziwe (`shared.ts:265,270`).

## Related Research

- `context/archive/2026-10-13-first-live-round/research.md` — anonimowość głosu, D1
- `context/archive/2026-10-15-full-game-evening/research.md` — koniec gry, D3, D4
- `context/archive/2026-10-22-latecomer-admission/` — `eligible` i spóźnieni
- `context/changes/guest-vote-flow-analysis/research.md` — przepływ głosu gościa i parser stanu

## Open Questions

Decyzje produktowe dla Karola (do `/10x-plan`, żadna nie blokuje planowania):

1. **Które wyróżnienia i ile?** PRD podaje dwa przykłady (`prd.md:134`). Dane pozwalają też na: liczbę odsłoniętych
   pytań, łączną liczbę wstrzymań się, pytanie z największą liczbą głosów na jedną osobę (wymaga tekstu pytania z Workera).
2. **Same wyróżnienia czy pełna lista sum?** Posortowana lista wszystkich graczy z sumami wygląda jak tabela wyników, a
   PRD mówi „dodatek, nie tabela wyników” (`prd.md:182`) i AGENTS.md zakazuje rankingów.
3. **Remis na szczycie:** wszyscy z remisu razem („Ola i Kuba: po 4 głosy”) czy inaczej?
4. **„Nikt dziś nie głosował na X”:** dla kogo (tylko gracze z co najmniej jedną uprawnioną odsłoniętą rundą), ilu naraz
   i jakim tonem (może być przykre; żaden dokument tego nie omawia).
5. **Gra bez odsłony:** zostaje dzisiejszy ekran bez podsumowania?
6. **Ten sam ekran po „Nowej grze” i sprzątaniu:** podsumowanie pokazuje się wszędzie, gdzie jest „Koniec wieczoru”
   (dane są te same), chyba że Karol chce inaczej.

Decyzja techniczna dla planu: nowy klucz w `room_lobby` czy osobne RPC (Architecture Insights).
