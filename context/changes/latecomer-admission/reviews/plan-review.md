<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Wpuszczanie spóźnionych (S-08)

- **Plan**: context/changes/latecomer-admission/plan.md
- **Mode**: Deep
- **Date**: 2026-10-22
- **Verdict**: REVISE (po poprawkach: SOUND)
- **Findings**: 1 critical, 4 warnings, 3 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | WARNING |
| Plan Completeness     | FAIL    |

## Grounding

Grounding: 22/22 paths ✓, 7/7 symbols ✓, brief↔plan ✓

Potwierdzone w kodzie:

- `private.drop_round_state` wołają tylko trzy zamknięcia pokoju (`first_live_round.sql:278`, `full_game_evening.sql:238`, `close_stale_games.sql:33`), nie odsłona, więc prośby nie znikną przy każdej odsłonie;
- ciasteczka `mlt_player_<roomId>` nic nie kasuje; nieznany token (oczekująca prośba) każde miejsce traktuje jak osobę spoza pokoju, a po wpuszczeniu `[token].astro:37-40,48-50` przekieruje do `/r/<id>`;
- `players.length` jako „kto głosuje” liczy tylko `RoundVoting.tsx`, a lista linii w planie jest pełna; `RoundReveal`, `announce.ts`, `HostActions` i reszta nie wymagają zmian;
- pgTAP nie ma przeglądu całego schematu `public` (`tables_are`, `functions_are`), `plan(107)` jest aktualne, a trzy sekcje zamknięcia da się zasilić prośbą po `host_starts`;
- `actionAnswer` zamienia każdy nieznany powód na 409, więc `request_unknown` i `nick_taken` nie potrzebują wpisu w `statusFor`;
- `ui-literals.mjs` czyta cały `src/components/room`, więc nowe komponenty są sprawdzane bez dopisywania;
- „spóźniony” i „uprawnieni” już są w `context/domain/glossary.md:19,41`.

## Findings

### F1 — Faza 2 nie przejdzie własnej bramki

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2 (kryteria 2.1-2.3) vs Faza 3 #3 i #5
- **Detail**: Faza 2 robi parsery i typy surowymi (`requests`, `eligible`) i zmienia `join.ts`, ale to, co od tego zależy, plan odkłada do fazy 3.
  - Krok smoke „a new guest cannot join a game in play” (`scripts/smoke.mjs:283`) oczekuje 302 na `?error=game_started`; po fazie 2 dostanie 303 i prośbę, więc job `smoke` będzie czerwony (kryterium 2.2).
  - Próbki w `src/pages/dev/room-states.astro` (`:106-181`, `:484-489`, `:502-507`), `src/pages/dev/room-window.astro` (`:70-105`, `:121-185`) i `tests/unit/announce.test.ts:18-80` (pliku nie ma w planie) budują `RoomView` bez nowych pól, więc `npx astro check` będzie czerwony (kryterium 2.1).
  - Kryterium ręczne 2.3 ocenia podglądy strony linku w `/dev/room-states`, które powstają dopiero w fazie 3 #3.
- **Fix**: Przenieść do fazy 2: zmianę kroku smoke `:283` (z liczbą kroków w `test-plan.md:99`), pola `requests`/`eligible` w próbkach obu stron `/dev` i w `tests/unit/announce.test.ts` oraz podglądy strony linku (formularz prośby, czekanie, odrzucenie, „Gra się skończyła”). W fazie 3 zostają podglądy ekranów gry, E2E i kroki smoke dla wpuszczenia.
- **Decision**: FIXED

### F2 — Ekran czekania: odświeżanie niedookreślone

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Faza 2 #7 (`JoinWaiting`)
- **Detail**: Plan każe subskrybować dzwonek „jak w `useRoomState.ts:273-320`” i odpytywać przez `createFetchLimiter`, a wydzielenie wspólnego kodu zostawia na „tylko wtedy, gdy nie zmienia jego zachowania”.
  - `subscribe()` żyje w jednym efekcie (`useRoomState.ts:144-340`) razem z jego stanem (`active`, `channel`, `broken`, `resubscribes`), `schedulePoll`, `armReport` i stałym adresem `/lobby` (`:183`), więc wydzielenie zmienia ekran pokoju tuż przed wieczorem.
  - `createFetchLimiter` sam nie odpytuje; 15 s liczy timer w `useRoomState` (`:236-245`).
  - Plan nie mówi, co ekran czekania robi przy stanie `none`, a rodzaj strony `started` (`[token].astro:21`) nie niesie `roomId`.
- **Fix A ⭐ Recommended**: `JoinWaiting` dostaje własny mały efekt (kanał `live-sync:<roomId>`, `createFetchLimiter`, własny timer co `LOBBY_POLL_MS`, zatrzymanie po `admitted`/`closed`), bez ruszania `useRoomState`; `none` traktuje jak `rejected` (przeładowanie `/j/<link>`); rodzaj strony `started` dostaje `roomId`.
  - Strength: ekran pokoju, który działa na produkcji, zostaje nietknięty; ryzyko pętli przeładowań zamknięte w jednym pliku.
  - Tradeoff: ok. 40 linii podobnych do `useRoomState` (dwa miejsca z subskrypcją).
  - Confidence: HIGH — `limiter.ts:38` jest ogólny i przyjmuje dowolne `fetchState`.
  - Blind spot: zgłaszanie `realtime_status` z ekranu czekania (czy chcemy je, czy tylko cichy zapas 15 s).
- **Fix B**: Wydzielić z `useRoomState` wspólny hook dzwonka i odpytywania, użyć go w obu miejscach.
  - Strength: jedna implementacja subskrypcji i ponownego łączenia.
  - Tradeoff: refaktor ekranu pokoju w zmianie, która go nie potrzebuje; E2E `lobby-connection-drop` i `game.spec.ts` muszą to złapać.
  - Confidence: MEDIUM — efekt splata 6 zmiennych stanu z logiką 404 i przeładowania.
  - Blind spot: zachowanie po zerwaniu połączenia w ekranie pokoju.
- **Decision**: FIXED (Fix A)

### F3 — Ciasteczko w złym formacie da błąd 500

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 2 #4 (`join.ts`)
- **Detail**: Plan bierze „token z ważnego ciasteczka”, ale nie mówi, co znaczy „ważne”. Dziś `join.ts:32` przekazuje surową wartość, a jedyna kontrola formatu jest w `vote.ts:39-41` (`PLAYER_TOKEN_PATTERN`, `tokens.ts:11`). `request_join` na token w złym formacie rzuca 22023, co Worker zamienia na `unexpected` (`server.ts:57-63`).
- **Fix**: W `join.ts` dla gry w toku użyć ciasteczka tylko, gdy pasuje do `PLAYER_TOKEN_PATTERN` (jak `vote.ts:39-41`), inaczej `newPlayerToken()`; przekierowanie 303 jawnie (`context.redirect(url, 303)`), bo reszta `join.ts` daje 302.
- **Decision**: FIXED

### F4 — Teksty wspólnych kodów trafią do hosta

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 2 #3 (`errors.ts`) i #6 (trasy hosta)
- **Detail**: `game_started` zwraca też `start_game` przy drugim „Start” (`first_live_round.sql:569`; kod w `ROUND_REFUSALS`, tekst przez `room-actions.ts:26`), więc host przy podwójnym starcie zobaczy „Poproś hosta o wpuszczenie”. `admit_latecomer` może zwrócić `nick_taken`, którego tekst (`errors.ts:29-30`, „Jeśli to ty, a telefon cię nie pamięta…”) jest pisany do osoby wchodzącej.
- **Fix**: `game_started` z tekstem pasującym obu stronom („Gra już trwa.”; strona linku i tak pokazuje formularz prośby), a `admit_latecomer` przy kolizji nicku zwraca własny kod z tekstem dla hosta (albo `request_unknown`, bo ten przypadek jest tylko obronny).
- **Decision**: FIXED

### F5 — Test „inny zalogowany” łamie „jeden host na plik”

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 #2 (testy bazy)
- **Detail**: Przypadek „`admit_latecomer`/`reject_latecomer` od innego zalogowanego niż host → `room_unknown`” wymaga drugiego konta w `latecomers.test.ts`, a plan zakłada jednego hosta na plik i budżet 12 z 30 (`test-plan.md:184-187`). Lista kont w `test-plan.md:184` (dziś 11) nie jest w planie do aktualizacji.
- **Fix**: Przypadek obcego hosta dopisać do `tests/db/round-rules.test.ts`, który już ma `hostA` i `hostB` (`:51`); w `test-plan.md:184` dopisać `latecomers 1` (razem 12).
- **Decision**: FIXED

### F6 — Nieaktualne README, test-plan i komentarze

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Fazy 2 i 3 (pliki do zmiany)
- **Detail**: Po zmianie przestaną się zgadzać:
  - `README.md:164-167` (wejście tylko do poczekalni, klucze stanu, „trzy funkcje security definer”), `:195` (smoke: spóźniony dostaje `game_started`) i tabela tras bez `request`, `admit`, `reject`;
  - opis w `test-plan.md:99` („odmowa wejścia po starcie”), nie tylko liczba kroków;
  - komentarze „S-08 decides about late players” i podobne: `server.ts:23-24`, `[token].astro:12-16`, `join.ts:6-8,39-40`, `r/[id].astro:42`, `errors.ts:5-6`, `round-rules.test.ts:183` („Late players wait for S-08”).
- **Fix**: Dopisać te pliki do faz, w których zmienia się zachowanie (faza 2: `join.ts`, `[token].astro`, README tras i smoke; faza 3: reszta README).
- **Decision**: FIXED

### F7 — Lista próśb przed tytułem widoku

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Faza 3 #1 (`JoinRequests`)
- **Detail**: AGENTS.md (UI): „w widoku pokoju tytuł jest pierwszy w DOM”. Plan stawia listę z nagłówkiem („Proszą o wejście”) przed `contentRef`, czyli przed tytułem widoku, i nie mówi, jaki to element. Nagłówek `h2` przed `h1` widoku psuje kolejność nagłówków w czytniku ekranu. `LiveBanner` i notka o pominięciu stoją tam już dziś, ale to komunikaty bez nagłówka.
- **Fix**: Lista jako `<section aria-label="Proszą o wejście">` z widocznym podpisem bez elementu nagłówka (jak notka `Alert`), żeby tytuł widoku został pierwszym nagłówkiem; zapisać w planie, że to świadome miejsce przed tytułem (jak `LiveBanner`).
- **Decision**: FIXED

### F8 — Brak próbnego alarmu dla nowych strażników

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 1 (testy bazy i pgTAP)
- **Detail**: `test-plan.md:192` i poprzednie zmiany (S-03, room-wide-layout) dowodzą próbnym alarmem, że nowy strażnik potrafi zaświecić na czerwono. Tu nowe strażniki pilnują prywatności (gość nie widzi cudzych próśb) i sprzątania (prośby znikają przy zamknięciu), a plan nie ma próby.
- **Fix**: W fazie 1 jeden tymczasowy commit na gałęzi: `room_lobby` daje gościowi listę próśb i `drop_round_state` nie usuwa próśb; przewidziane czerwone tylko odpowiednie testy `latecomers.test.ts` i 3 asercje resztek pgTAP; potem `git revert` i zielone CI.
- **Decision**: FIXED
