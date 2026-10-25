# Podsumowanie wieczoru (S-15, FR-022) — plan implementacji

## Overview

Gdy gra się kończy, ekran „Koniec wieczoru” pokazuje wszystkim graczom krótkie podsumowanie tej gry: do trzech osób z
największą sumą głosów, „Nikt dziś nie głosował na…” i liczbę odsłoniętych pytań. Liczby pochodzą wyłącznie z odsłon,
które ekipa już widziała: bez punktów, bez numerów miejsc, bez porównań z innymi wieczorami (PRD FR-022, §Non-Goals;
decyzje Karola z 2026-10-25, roadmapa S-15).

## Current State Analysis

- Liczby na osobę z każdej odsłony leżą w `private.round_results` (`round_id`, `player_id`, `votes`, bez głosującego)
  także po końcu gry; `end_game`, „Nowa gra” i sprzątanie kasują tylko urnę i prośby spóźnionych
  (`supabase/migrations/20261014101922_first_live_round.sql:128-135,200-204`,
  `20261022132240_latecomer_admission.sql:65-84`).
- `room_lobby` czyta rundę tylko przy `playing` i dla `closed` oddaje 7 kluczy bez liczb
  (`20261024094002_question_list_review.sql:637-644,703-718`). Parser Workera kopiuje tylko znane pola
  (`src/lib/rooms/shared.ts:251-283`).
- `EveningEnd` (`src/components/room/RoomScreen.tsx:55-74`) pokazuje tytuł, „Dzięki za grę!” i „Nowa gra” / prośbę o
  nowy link; ekran przestaje odpytywać serwer przy `closed` (`useRoomState.ts:140,145`), więc podsumowanie musi przyjść w
  pierwszym stanie `closed` (fetch albo SSR `src/pages/r/[id].astro:23-51`).
- Wzór do powtórzenia: lista pytań hosta. Baza oddaje surowe `question_list`, `parseLobbyState` je sprawdza, a
  `roomView()` zamienia je na to, co widać (`questions`), które sprawdza `parseRoomView`
  (`src/lib/rooms/server.ts:269-279`, `shared.ts:275-283,325-346`).
- Pilnowane kontrakty: `LOBBY_KEYS` (`tests/db/support/rounds.ts:105`, `round-anonymity.test.ts:152,277,316`),
  `test-plan.md:226` („po »Zakończ grę« tylko klucze lobby”), pgTAP „`room_lobby` w jednej wersji”
  (`supabase/tests/round_creator_view.test.sql:898-902`).
- Szczegóły i źródła: `context/changes/game-summary/research.md`.

## Desired End State

- Po końcu gry z co najmniej jedną odsłoną każdy gracz (host i goście) widzi pod „Dzięki za grę!” sekcję „Podsumowanie”:
  „Odsłoniliście dziś N pytań”, „Najwięcej głosów dziś” z 1–3 osobami (więcej tylko przy remisie na szczycie) i, gdy
  ktoś mógł dostać głos, a nie dostał, „Nikt dziś nie głosował na: …”.
- Gra zamknięta bez żadnej odsłony wygląda jak dziś.
- To samo widać po zamknięciu przez „Zakończ grę”, „Nową grę” i nocne sprzątanie.
- Do przeglądarki trafiają tylko nicki i liczby pokazane na ekranie; nigdzie nie ma pary „kto na kogo”.

Weryfikacja: testy bazy z ręczną wyrocznią (CI `db`), testy jednostkowe reguły wyboru, podglądy `/dev/room-states`,
test E2E wieczoru (CI `e2e`), przeklikanie na produkcji.

### Key Discoveries:

- `finish_round` wstawia wiersz tylko dla uprawnionych (zera też), więc gracz z wierszem w choć jednej odsłonie „mógł
  dostać głos”, a spóźniony wpuszczony po ostatniej odsłonie nie ma wierszy (`first_live_round.sql:200-204`,
  `20261020205751_round_number_required.sql:186-189`).
- Pominięta runda i runda przerwana końcem gry nie mają wierszy w `round_results`
  (`20261015122252_full_game_evening.sql:195-197`, `latecomer_admission.sql:65-84`).
- Każda zmiana `room_lobby` to `create or replace` z tą samą sygnaturą i powtórzonymi `owner` / `revoke` / `grant`
  (`question_list_review.sql:556,733-754`); stary Worker kopiuje tylko klucze swojego kontraktu, więc dodany klucz w bazie
  nie psuje kodu sprzed wdrożenia (`latecomer_admission.sql:31`).
- Test wieczoru E2E ma gotowy przypadek: pytanie 1 A→B, B się wstrzymuje, host→A; pytanie 2 pominięte; pytanie 3
  przerwane końcem gry (`tests/e2e/game.spec.ts:77-82,131-134,153`).

## What We're NOT Doing

- Punktów, numerów miejsc, medali, rankingu między wieczorami (PRD §Non-Goals, AGENTS.md).
- Pełnej listy sum wszystkich graczy (decyzja Karola: top 3, „nie dajemy 20 graczy”).
- Wyróżnień z pojedynczego pytania i tekstów pytań na ekranie końca; liczby wstrzymań się.
- Odróżniania na ekranie, którą drogą gra się zamknęła.
- Zmian w `round_results`, nowych tabel i nowego RPC; retencji danych (S-13).
- Zmiany szerokości ekranu końca (`ROOM_NARROW` zostaje) i komunikatu dla czytnika ekranu („Koniec wieczoru.”).

## Implementation Approach

Baza dokłada do stanu zamkniętego pokoju surowe sumy (`game_totals`): liczbę odsłoniętych rund i sumę głosów każdego
gracza, który miał wynik w co najmniej jednej odsłonie. Worker, jak przy liście pytań, zamienia je w `roomView()` na to,
co widać (`summary`: liczba pytań, top, lista zer), więc przeglądarka nie dostaje sum spoza ekranu. Regułę wyboru trzyma
jedna czysta funkcja z testem jednostkowym. Kolejność wdrożenia: migracja (`db push`), potem kod.

Reguła wyboru (decyzje Karola):

- Liczą się tylko rundy odsłonięte; pominięte i przerwane nie dają nikomu głosów i nie wchodzą do licznika pytań.
- Top: gracze z sumą > 0, grupowani po sumie malejąco. Najwyższa grupa zawsze w całości; każda następna dochodzi tylko,
  gdy cała mieści się w łącznym limicie 3 osób; pierwsza niemieszcząca się kończy listę. W grupie kolejność miejsc.
  Przykłady: 5, 4, 2, 2 → dwie osoby; 5, 3, 3 → trzy; 5, 4, 3, 3 → dwie; 4, 4, 4, 4 → cztery; wszyscy 0 → pusto.
- Zera: gracze z sumą 0 obecni w `game_totals` (czyli uprawnieni w co najmniej jednej odsłonie), w kolejności miejsc.
- Brak odsłon → `game_totals` i `summary` to `null`, ekran jak dziś.

## Critical Implementation Details

- **Kolejność wdrożenia**: nowy parser wymaga klucza `game_totals` (jak `question_list`, `shared.ts:273-283`), więc
  migracja musi być na produkcji przed scaleniem kodu (`context/deployment/deploy-plan.md`; baza, potem kod). Rozjazd
  psuje każde miejsce, które czyta `room_lobby` przez `roomLobby()`: `src/pages/r/[id].astro:50`,
  `src/pages/api/rooms/[id]/lobby.ts:43`, `src/pages/index.astro:26` (informacja hosta o otwartej grze),
  `src/pages/j/[token].astro:43` i `src/pages/api/rooms/join.ts:41` (wejście gościa). Kod bez klucza w bazie = goście
  nie wejdą do żadnego pokoju.
- **Bez kodu serwera w przeglądarce**: `src/lib/rooms/summary.ts` nie importuje nic poza typami z `shared.ts` (jak
  nagłówek `shared.ts:1-2`). Ekran importuje z niego tylko `plural`, `server.ts` importuje `gameSummary`, nigdy
  odwrotnie: `server.ts` ciągnie `@/data/questions` (cała baza pytań, z 18+), a jeden import w złą stronę wysłałby ją do
  każdego gracza (`context/foundation/lessons.md`, „Pytania gry tylko po stronie serwera”).
- **Kontrakt kluczy**: `game_totals` jest w odpowiedzi `room_lobby` w każdym statusie (`null` poza `closed`), więc
  `LOBBY_KEYS` dostaje ten klucz świadomą decyzją z komentarzem, a zdanie `test-plan.md:226` się zmienia.

## Faza 1: Podsumowanie w stanie pokoju (baza)

### Overview

Migracja dodaje `game_totals` do `room_lobby`; testy bazy pilnują sum, kluczy i anonimowości.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/<timestamp>_game_summary.sql` (przez `npx supabase migration new game_summary`)

**Intent**: Zamknięty pokój oddaje sumy z odsłon tej gry, z tymi samymi kontrolami dostępu co dziś (host albo token
gracza tego pokoju).

**Contract**: `create or replace function public.room_lobby(p_room_id uuid, p_player_token text default null)` z
dotychczasowym nagłówkiem (`language plpgsql stable security definer set search_path = ''`; żaden test go nie pilnuje)
i ciałem z `question_list_review.sql:556-731` plus klucz `game_totals`:

- `null`, gdy `status <> 'closed'` albo pokój nie ma rundy `phase = 'revealed'`;
- inaczej `{ "revealed": <liczba rund revealed tego pokoju>, "totals": [{ "nick", "votes" }] }`, gdzie `totals` to
  gracze z co najmniej jednym wierszem `round_results` w rundach tego pokoju, `votes` = suma ich `votes`, kolejność
  `players.seat`; zera zostają.

Komentarz nad funkcją dopisuje `game_totals` (tylko liczby na nick z odsłon, nigdy głosujący). Na końcu pliku, jak w
poprzednich migracjach: `alter function … owner to postgres`, `revoke execute … from public, anon, authenticated`,
`grant execute … to anon, authenticated`. Bez nowych tabel, grantów do tabel i zmian sygnatury.

#### 2. Kontrakt kluczy i plan testów

**File**: `tests/db/support/rounds.ts`, `context/foundation/test-plan.md`, `tests/unit/room-rpc-gate.test.ts`

**Intent**: Świadoma decyzja o nowym kluczu w miejscu, które jej wymaga.

**Contract**: `LOBBY_KEYS` z `game_totals` (posortowane), komentarz z uzasadnieniem (S-15: sumy z odsłon tylko w
zamkniętym pokoju), nowe `GAME_TOTALS_KEYS = ["revealed", "totals"]`; `totals` używa `RESULT_KEYS`. W `test-plan.md`
zdanie `:226` mówi „stan `closed` bez rundy, tylko klucze lobby z `game_totals`”, zdanie `:229` (porzucona runda) mówi
„żadnych liczb z przerwanej rundy (sumy wcześniejszych odsłon są w `game_totals`)”, i dopisany punkt §6 o sumach
(wyrocznia ręczna, pominięte i przerwane bez liczb, spóźniony bez odsłony nieobecny). Bramka RPC: komentarz wiersza
`room_lobby` (`room-rpc-gate.test.ts:61`) wskazuje nową migrację (§6.1; sygnatura bez zmian). Ręczna tabela sygnatur w
`context/changes/refactor-opportunities/plan.md` to osobna zmiana: tylko notka dla niej, bez edycji tutaj.

#### 3. Testy bazy

**File**: `tests/db/game-summary.test.ts` (nowy); istniejące `round-anonymity.test.ts` przez nowe `LOBBY_KEYS`

**Intent**: Dowód sum i granic z ręcznie policzoną wyrocznią (`test-plan.md:142,167`).

**Contract** (helpery z `tests/db/support/rounds.ts` i `rooms.ts`): host, Ola, Bartek; runda 1 odsłonięta (wyrocznia
w teście, np. Ola→Bartek, Bartek→Bartek, host się wstrzymuje); w trakcie rundy 2 wpuszczony Kuba; runda 2 odsłonięta;
runda 3 pominięta z oddanymi głosami na osobę, której suma by się od nich zmieniła; runda 4 (Kuba uprawniony) z głosem
na Kubę, przerwana `end_game` w trakcie głosowania. `endGame` i `admitLatecomer` to sondy `{ data, error }` bez wersji
`seed*`, więc `beforeAll` sprawdza warunek wstępny jak `round-anonymity.test.ts:296-299`; `EVENING_QUESTION_IDS` ma
dokładnie 4 id (`rounds.ts:94`). Asercje:

- w trakcie gry i w poczekalni `game_totals` to `null` (gość i host);
- po końcu `game_totals` ma dokładnie `GAME_TOTALS_KEYS`, `revealed: 2`, a `totals` dokładnie host, Ola, Bartek w
  kolejności miejsc z ręcznymi sumami (z zerem, jeśli wyrocznia je daje), bez Kuby; każdy wpis dokładnie `RESULT_KEYS`;
- to samo widzi gość i host;
- pokój zamknięty „Nową grą” w trakcie gry po odsłonie ma te same sumy, co po „Zakończ grę” (drugi pokój z jedną
  odsłoną i ręczną wyrocznią);
- pokój zamknięty „Nową grą” z poczekalni ma `game_totals: null`.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check`, `npm test`, `npm run build` przechodzą lokalnie
- `npx supabase db push --dry-run` pokazuje tylko nową migrację (za zgodą, nie z eduroam)
- CI na gałęzi: job `db` zielony (nowy plik testów, `round-anonymity.test.ts` z nowym `LOBBY_KEYS`, pgTAP bez zmian)

#### Manual Verification:

- Karol czyta w PR diff migracji: `game_totals` tylko przy `closed`, same `nick` i `votes`

**Implementation Note**: Testy bazy działają tylko w CI (`db`). Push gałęzi za zgodą Karola.

---

## Faza 2: Wybór wyróżnień i ekran końca

### Overview

Worker zamienia sumy na wyróżnienia, ekran „Koniec wieczoru” je pokazuje, podglądy i słownik nadążają.

### Changes Required:

#### 1. Typy i parsery

**File**: `src/lib/rooms/shared.ts`

**Intent**: Nowe pole stanu z bazy i nowe pole widoku, sprawdzane jak `question_list` i `questions`.

**Contract**: `GameTotals { revealed: number; totals: RoundResult[] }`; `LobbyState.game_totals: GameTotals | null`
(parsowane w `parseLobbyState`: brak klucza = odmowa `game_totals`; nie-`null` tylko przy `status === "closed"`,
`revealed` liczba całkowita ≥ 1, `totals` przez `parseResults` z prefiksem nazwy pola jako parametrem, bo dziś ma
wpisane `round.results.*` (`shared.ts:163-172`), kopiowane tylko znane klucze). `parseRoomState` i jego typ zdejmują
`question_list` i `game_totals`.
`GameSummary { revealed: number; top: RoundResult[]; unvoted: string[] }`; `RoomView` bez `question_list` i
`game_totals`, z `summary: GameSummary | null` (parsowane w `parseRoomView` tymi samymi regułami statusu).

#### 2. Reguła wyboru i odmiana liczebników

**File**: `src/lib/rooms/summary.ts` (nowy), `src/lib/rooms/server.ts`

**Intent**: Jedna czysta funkcja z regułą z „Implementation Approach”; `roomView()` woła ją dla `closed`.

**Contract**: `gameSummary(totals: GameTotals): GameSummary`; `plural(n, one, few, many)` dla „głos/głosy/głosów” i
„pytanie/pytania/pytań” (1 → one; n % 10 w 2–4 i n % 100 poza 12–14 → few; reszta → many). `roomView()` ustawia
`summary = game_totals === null ? null : gameSummary(game_totals)` i nie przepuszcza `game_totals`. `summary.ts` bez
importów poza typami z `shared.ts` („Critical Implementation Details”).

#### 3. Ekran

**File**: `src/components/room/RoomScreen.tsx` (albo nowy `src/components/room/GameSummary.tsx`)

**Intent**: Pod „Dzięki za grę!” sekcja „Podsumowanie”, gdy `view.summary !== null`; bez niej ekran jak dziś.

**Contract**: `<section aria-labelledby>` z nagłówkiem „Podsumowanie” (nazwa regionu różna od „Gracze” i „Wynik”):
„Odsłoniliście dziś N pytań”; „Najwięcej głosów dziś” jako lista `nick — N głosów` (bez numerów, znaczek „ty” jak w
odsłonie), tylko przy niepustym `top` (pusty, gdy we wszystkich odsłonach wszyscy się wstrzymali); „Nikt dziś nie
głosował na: A, B i C” tylko przy niepustym `unvoted`. Tylko tokeny, szerokość `ROOM_NARROW`,
tytuł „Koniec wieczoru” zostaje pierwszy w DOM. Komentarz nad `EveningEnd` (`:55-57`) mówi o podsumowaniu zamiast
„FR-022 is parked”. Ostateczne brzmienie napisów zatwierdza Karol na zrzutach.

#### 4. Podglądy

**File**: `src/pages/dev/room-states.astro`, `src/pages/dev/room-window.astro`

**Intent**: Nowe stany do oceny i literały z nowym polem.

**Contract**: `summary: null` w każdym literale `RoomView`; nowe stany końca: host z pełnym podsumowaniem (3 osoby i
zera), gość z remisem na szczycie (4 osoby po tyle samo), koniec bez zer, „wszyscy się wstrzymali” (bez bloku
„Najwięcej głosów dziś”), „duży pokój” (remis 6+ osób na szczycie i 8+ zer, do oceny długości list), koniec bez odsłon
(jak dziś); `end-host` w `/dev/room-window` z podsumowaniem. Literały do uzupełnienia: buildery `lobby`, `voting`,
`revealed`, `skipped`, `closed` i literały `:613-622`, `:633-642` w `room-states.astro`; buildery `voting`, `revealed`
i literały `:162,177,192,207,276,289` w `room-window.astro`.

#### 5. Testy jednostkowe i słownik

**File**: `tests/unit/summary.test.ts` (nowy), `tests/unit/room-state.test.ts`, `tests/unit/announce.test.ts`,
`context/domain/glossary.md`

**Intent**: Ręczna wyrocznia reguły i odmiany; parsery z nowym polem; nowe hasło.

**Contract**: przykłady z „Implementation Approach” jako osobne przypadki; spóźniony bez wpisu nie trafia do zer;
`plural` dla 1, 2, 4, 5, 12, 14, 22, 25. Parsery: `game_totals` / `summary` brak → odmowa, nie-`null` przy `playing` →
odmowa, zły kształt → odmowa z nazwą pola (`game_totals.totals.*`, nie `round.results.*`), poprawny zamknięty →
przyjęty. Nowe pole dostaje każdy fixture, nie tylko zamknięty: w `room-state.test.ts` wszystkie fixture'y stanu
(`:22-133`), lista brakujących pól (`:182`), helper `view()` (`:354-360`, dziś zdejmuje tylko `question_list`) i testy
„bez klucza spoza kontraktu” (`:325`, `:455`); w `announce.test.ts` pięć builderów (`:19,32,60,86,99`).
Słownik: wiersz „podsumowanie” (wyróżnienia z odsłon zamkniętej gry na ekranie końca; `game_totals`, `GameSummary`,
`summary`; nie „ranking”, „wyniki wieczoru”).

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi, w tym nowy `tests/unit/summary.test.ts`
- `npm run lint` (z `scripts/ui-literals.mjs`), `npx astro check`, `npm run build` przechodzą
- `npx prettier --check` dla zmienionych plików `.md`

#### Manual Verification:

- Karol ocenia zrzuty nowych stanów z `/dev/room-states` i `end-host` z `/dev/room-window` (laptop jako całe okno 1:1,
  telefon w prawdziwej wielkości), w tym brzmienie napisów

**Implementation Note**: Serwer dev tylko do podglądów `/dev/*` (`.dev.vars` wskazuje na produkcję); zatrzymać po
zrzutach. Po akceptacji zrzutów przejdź do fazy 3.

---

## Faza 3: Test E2E i wdrożenie

### Overview

Test wieczoru sprawdza podsumowanie na trzech ekranach; potem pełny cykl wdrożenia z migracją przed kodem.

### Changes Required:

#### 1. Test E2E

**File**: `tests/e2e/game.spec.ts`, `tests/e2e/support/round.ts`

**Intent**: Dowód z perspektywy gracza na gotowym scenariuszu (pytanie 1 odsłonięte, 2 pominięte, 3 przerwane).

**Contract**: helper `gameSummary(page)` (region „Podsumowanie” po roli i nazwie). Po „Zakończ grę” na ekranie hosta, A
i B: „Odsłoniliście dziś 1 pytanie”; „Najwięcej głosów dziś” dokładnie A i B po 1 głosie, w kolejności miejsc; „Nikt
dziś nie głosował na” host. Istniejące asercje końca zostają.

#### 2. Wdrożenie

**Intent**: Pełny cykl z pliku zasad, z migracją przed kodem.

**Contract**: push gałęzi (zgoda) → PR → zielone `ci`/`smoke`/`db`/`e2e` → `npx supabase db push --dry-run`, `db push`,
`migration list` (zgoda, nie z eduroam) → scalenie przez Karola → smoke na produkcji (zgoda) → przeklikanie.

### Success Criteria:

#### Automated Verification:

- `npx playwright test --list` pokazuje test wieczoru
- `npm test`, `npm run lint`, `npx astro check`, `npm run build` przechodzą
- CI na PR zielone: `ci`, `smoke`, `db`, `e2e`
- `npx supabase migration list` pokazuje nową migrację na produkcji przed scaleniem

#### Manual Verification:

- Smoke na produkcji zielony po scaleniu (za zgodą)
- Karol: krótka gra na telefonie i laptopie z co najmniej dwiema odsłonami, potem „Zakończ grę”; podsumowanie zgadza
  się z odsłonami na obu ekranach

**Implementation Note**: Push, `db push` i smoke tylko za zgodą Karola; scala wyłącznie Karol
(`! gh pr merge <n> --merge`).

---

## Testing Strategy

### Unit Tests:

- `gameSummary`: 5/4/2/2, 5/3/3, 5/4/3/3, 4/4/4/4, wszyscy 0, jedna osoba z głosami, zera w kolejności miejsc,
  spóźniony bez wpisu.
- `plural`: 1, 2, 4, 5, 12, 14, 22, 25.
- Parsery `parseLobbyState` i `parseRoomView`: obecność, status, kształt `game_totals` i `summary`.

### Integration Tests:

- Baza (CI `db`): sumy z dwóch odsłon, pominięta i przerwana runda (obie z oddanymi głosami) bez wpływu, spóźniony bez
  odsłony nieobecny, te same sumy po „Nowej grze” w trakcie gry, `null` w grze, w poczekalni i w pokoju zamkniętym bez
  odsłon, dokładne klucze dla gościa i hosta.
- E2E (CI `e2e`): podsumowanie na trzech ekranach po „Zakończ grę”.

### Manual Testing Steps:

1. `/dev/room-states`: stany końca z podsumowaniem, z remisem, bez zer, „wszyscy się wstrzymali”, „duży pokój” i bez
   odsłon (laptop i telefon).
2. Produkcja: gra z dwiema odsłonami i jednym pominięciem, „Zakończ grę”; sumy zgadzają się z odsłonami.
3. Odświeżenie strony zamkniętego pokoju pokazuje to samo podsumowanie (SSR).

## Performance Considerations

Jedno dodatkowe zapytanie sumujące w `room_lobby`, tylko przy `closed`; po `closed` ekran nie odpytuje serwera.

## Migration Notes

`create or replace` tej samej funkcji; stary Worker pomija nowy klucz. Kod wymaga klucza, więc `db push` przed scaleniem.
Wycofanie w odwrotnej kolejności: najpierw kod (`npx wrangler rollback`, za zgodą), dopiero potem poprzednia wersja
`room_lobby` w nowej migracji (bez edycji wypchniętej). Cofnięta baza przy nowym kodzie zablokowałaby wejście gościa i
ekrany pokoju (pięć miejsc z „Critical Implementation Details”).

## References

- Research: `context/changes/game-summary/research.md`
- PRD: `context/foundation/prd.md` (FR-022, §Non-Goals), roadmapa S-15
- Wzór „surowe w bazie, widok w Workerze”: `src/lib/rooms/server.ts:269-279`, `shared.ts:275-346`
- Decyzja D4 (ekran końca): `context/archive/2026-10-15-full-game-evening/research.md:124-127,148`
- Plan testów §6: `context/foundation/test-plan.md:142,167,220-227`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Podsumowanie w stanie pokoju (baza)

#### Automated

- [x] 1.1 `npm run lint`, `npx astro check`, `npm test`, `npm run build` przechodzą lokalnie
- [ ] 1.2 `npx supabase db push --dry-run` pokazuje tylko nową migrację (za zgodą, nie z eduroam)
- [ ] 1.3 CI na gałęzi: job `db` zielony (nowy plik testów, `round-anonymity.test.ts` z nowym `LOBBY_KEYS`, pgTAP bez zmian)

#### Manual

- [ ] 1.4 Karol czyta w PR diff migracji: `game_totals` tylko przy `closed`, same `nick` i `votes`

### Phase 2: Wybór wyróżnień i ekran końca

#### Automated

- [ ] 2.1 `npm test` przechodzi, w tym nowy `tests/unit/summary.test.ts`
- [ ] 2.2 `npm run lint` (z `scripts/ui-literals.mjs`), `npx astro check`, `npm run build` przechodzą
- [ ] 2.3 `npx prettier --check` dla zmienionych plików `.md`

#### Manual

- [ ] 2.4 Karol ocenia zrzuty nowych stanów z `/dev/room-states` i `end-host` z `/dev/room-window` (laptop jako całe okno 1:1, telefon w prawdziwej wielkości), w tym brzmienie napisów

### Phase 3: Test E2E i wdrożenie

#### Automated

- [ ] 3.1 `npx playwright test --list` pokazuje test wieczoru
- [ ] 3.2 `npm test`, `npm run lint`, `npx astro check`, `npm run build` przechodzą
- [ ] 3.3 CI na PR zielone: `ci`, `smoke`, `db`, `e2e`
- [ ] 3.4 `npx supabase migration list` pokazuje nową migrację na produkcji przed scaleniem

#### Manual

- [ ] 3.5 Smoke na produkcji zielony po scaleniu (za zgodą)
- [ ] 3.6 Karol: krótka gra na telefonie i laptopie z co najmniej dwiema odsłonami, potem „Zakończ grę”; podsumowanie zgadza się z odsłonami na obu ekranach
