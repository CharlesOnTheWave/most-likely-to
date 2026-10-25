<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Podsumowanie wieczoru (S-15, FR-022)

- **Plan**: `context/changes/game-summary/plan.md`
- **Mode**: Deep
- **Date**: 2026-10-25
- **Verdict**: REVISE → SOUND po poprawkach (triage 2026-10-25: 7/7 FIXED)
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

Grounding: 11/11 paths ✓ (2 new files absent as planned), 8/8 symbols ✓ (`LOBBY_KEYS`, `RESULT_KEYS`, `parseLobbyState`,
`parseRoomView`, `parseResults`, `roomView`, `EveningEnd`, `room_lobby`), brief↔plan ✓, Progress↔Phase ✓ (3/3 phases,
14/14 steps). Subagent checks: pgTAP needs no change (only `versions_of`, `round_creator_view.test.sql:898-902`); self-vote
allowed (`20261020205751_round_number_required.sql:203-210`); `skip_round` opens the next round with the current
players as `eligible` (`question_list_review.sql:534-536`); E2E totals = revealed 1, host 0, A 1, B 1
(`tests/e2e/game.spec.ts:78-82,132-134,154`); the first `closed` view always comes from `/lobby` or SSR, never from a
Realtime payload (`useRoomState.ts:183-222`, `RoomScreen.tsx:122-131`); smoke has no exact-key check on `/lobby`.

## Findings

### F1 — `summary.ts` może wciągnąć bazę pytań do przeglądarki

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Faza 2 #2 (`src/lib/rooms/summary.ts`) i #3 (ekran)
- **Detail**: Ekran potrzebuje `plural` w przeglądarce, a `gameSummary` woła `server.ts`. Plan nie mówi, że
  `summary.ts` ma zostać bez importów serwera. `server.ts` importuje `@/lib/live-sync/server` i `@/lib/rounds/draw`,
  które ładują całe `QUESTIONS` z `@/data/questions` (z pytaniami 18+); jeden import w złą stronę wysyła bazę pytań do
  każdego gracza. To powtórka reguły z `lessons.md` („Pytania gry tylko po stronie serwera”).
- **Fix**: W kontrakcie Fazy 2 #2 dopisać: „`summary.ts` bez importów poza typami z `shared.ts` (jak nagłówek
  `shared.ts:1-2`); ekran importuje z niego tylko `plural`, `server.ts` importuje `gameSummary`, nigdy odwrotnie”.
- **Decision**: FIXED (Fix in plan)

### F2 — Kolejność wdrożenia i wycofania dotyczy pięciu miejsc, nie tylko ekranu pokoju

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details, Migration Notes; brief „Open Risks”
- **Detail**: `parseLobbyState` (przez `roomLobby()`) czytają: `src/pages/r/[id].astro:50`,
  `src/pages/api/rooms/[id]/lobby.ts:43`, `src/pages/index.astro:26` (informacja o otwartej grze hosta),
  `src/pages/j/[token].astro:43` i `src/pages/api/rooms/join.ts:41` (wejście gościa). Kod bez klucza `game_totals` w
  bazie odmawia wszędzie: goście nie wejdą do żadnego pokoju, a strona główna po cichu zgubi informację o otwartej grze.
  Brief mówi tylko „zepsułby ekrany pokoju”. Migration Notes opisuje wycofanie bazy („poprzednia wersja `room_lobby` w
  nowej migracji”), ale nie kolejność: cofnięta baza przy nowym kodzie daje ten sam skutek.
- **Fix A ⭐ Recommended**: Zostawić ścisły parser (jak `question_list`); w Critical Implementation Details i Migration
  Notes wymienić pięć miejsc i dopisać „wycofanie: najpierw kod (`npx wrangler rollback`, za zgodą), potem migracja
  przywracająca poprzednią `room_lobby`”.
  - Strength: Ten sam wzór co S-06 (`shared.ts:273-283`); rozjazd bazy i Workera daje log z nazwą pola, nie cichy brak.
  - Tradeoff: Wdrożenie dalej zależy od kolejności (z domu albo przez hotspot, przed scaleniem).
  - Confidence: HIGH — tak przeszły S-03, S-08 i S-06.
  - Blind spot: None significant.
- **Fix B**: Parser przyjmuje brak klucza `game_totals` jako `null` (ekran jak dziś).
  - Strength: Każda kolejność wdrożenia i wycofania jest bezpieczna.
  - Tradeoff: Łamie wzór „baza bez klucza = odmowa”; zgubiony klucz po cichu chowa podsumowanie (wyłapią go tylko testy
    `db` i `e2e`).
  - Confidence: MED — zmienia przypadek testu „brak klucza → odmowa” w planie.
  - Blind spot: Czy inne miejsca kodu polegają na tym, że parser odmawia brakującego pola.
- **Decision**: FIXED (Fix A)

### F3 — Pusty „top” i bardzo długie listy bez decyzji na ekranie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 2 #3 (ekran) i #4 (podglądy)
- **Detail**: Reguła daje `top = []`, gdy we wszystkich odsłonach wszyscy się wstrzymali (to możliwe: wstrzymanie się to
  głos, odsłona przychodzi po ostatnim), a kontrakt ekranu zawsze pokazuje „Najwięcej głosów dziś”, więc wyszedłby pusty
  nagłówek. Lista nie ma górnej granicy: po jednej odsłonie w pokoju 6 osób, gdzie każdy wskazał kogoś innego, „Najwięcej
  głosów dziś” to cały pokój; w pokoju 20 osób „Nikt dziś nie głosował na” może mieć kilkanaście nicków. Żaden stan
  podglądu tego nie pokazuje, więc Karol nie zobaczy tego na zrzutach.
- **Fix**: W Fazie 2 #3: „pusty `top` → bez bloku »Najwięcej głosów dziś«”. W #4 dwa stany więcej: „wszyscy się
  wstrzymali” i „duży pokój” (remis 6+ osób na szczycie i 8+ zer), do oceny na zrzutach.
- **Decision**: FIXED (Fix in plan)

### F4 — Test bazy nie sprawdza naprawdę przerwanej rundy

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 1 #3 (`tests/db/game-summary.test.ts`)
- **Detail**: Runda 3 ma „oddane głosy”, ale runda 4 (przerwana `end_game`) nie. Bez głosu na Kubę w rundzie 4 test
  „Kuby nie ma w sumach” przeszedłby nawet wtedy, gdyby przerwana runda się liczyła. Dla wykonawcy: `endGame` i
  `admitLatecomer` są tylko sondami `{ data, error }` (bez wersji `seed*`), więc `beforeAll` musi sprawdzić warunek
  wstępny jak `round-anonymity.test.ts:296-299`; `EVENING_QUESTION_IDS` ma dokładnie 4 id (`rounds.ts:94`), tyle, ile
  trzeba.
- **Fix**: W scenariuszu: „w rundzie 4 głos na Kubę przed `end_game`; w rundzie 3 głosy na osobę, której suma by się
  zmieniła”.
- **Decision**: FIXED (Fix in plan)

### F5 — `test-plan.md:229` też przestaje być prawdą

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 #2
- **Detail**: Plan zmienia `:226`, ale `:229` mówi: „pokój zamknięty w trakcie rundy (»Nowa gra«) zwraca `closed` i
  żadnych liczb”. Po zmianie taki pokój z wcześniejszymi odsłonami odda sumy w `game_totals`. Desired End State obiecuje
  podsumowanie także po „Nowej grze”, a test bazy sprawdza tylko „Nową grę” z poczekalni (`null`).
- **Fix**: `:229` → „żadnych liczb z przerwanej rundy (sumy wcześniejszych odsłon są w `game_totals`)”; w teście bazy
  przypadek „Nowa gra” w trakcie gry po odsłonie → te same `game_totals` co po „Zakończ grę”.
- **Decision**: FIXED (Fix in plan)

### F6 — Niepełna lista miejsc do zmiany przy nowym polu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 #2, Faza 2 #1 i #5
- **Detail**: Plan wymienia tylko fixture'y `CLOSED` i `closed()`. Parser odmówi każdego stanu bez `game_totals`, więc
  zmiana dotyczy też: wszystkich fixture'ów stanu w `tests/unit/room-state.test.ts:22-133`, listy brakujących pól `:182`,
  helpera `view()` `:354-360` (zdejmuje tylko `question_list`), testów „bez klucza spoza kontraktu” `:325,455`; pięciu
  builderów w `tests/unit/announce.test.ts:19,32,60,86,99`. `parseResults` ma wpisane nazwy pól `round.results.*`
  (`shared.ts:163-172`), więc użyte dla `totals` poda złe pole w logu i w teście „odmowa z nazwą pola”. Komentarz
  `tests/unit/room-rpc-gate.test.ts:61` wskazuje `room_lobby` w starej migracji (`test-plan.md` §6.1: wiersz bramki RPC
  zmienia się razem z migracją); to samo dotyczy tabeli sygnatur w `context/changes/refactor-opportunities/plan.md`.
- **Fix**: Dopisać te pliki do Fazy 2 #1 i #5 (`parseResults` z prefiksem nazwy pola) i komentarz bramki RPC do Fazy 1
  #2.
- **Decision**: FIXED (Fix in plan)

### F7 — Nagłówek funkcji w migracji nie jest pilnowany przez żaden test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 #1
- **Detail**: Kontrakt mówi „z dotychczasowym ciałem”, a `security definer` i `set search_path = ''` stoją w nagłówku,
  poza ciałem (`question_list_review.sql:556-562`). pgTAP nie sprawdza ich dla `room_lobby` (`function_facts` nie jest
  dla niej wołane), a brak `set search_path = ''` nie wywróci żadnego testu (AGENTS.md wymaga go w każdej funkcji).
- **Fix**: W kontrakcie migracji: „nagłówek bez zmian: `language plpgsql stable security definer set search_path = ''`”.
- **Decision**: FIXED (Fix in plan)
