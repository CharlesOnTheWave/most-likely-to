# Pełny wieczór (S-03) Implementation Plan

## Overview

S-03 zamienia jedną rundę z S-02 w wieczór. Host dostaje „Następne pytanie”, „Pomiń pytanie” i „Zakończ grę”, pytania nie powtarzają się w grze, a na końcu wszyscy widzą „Koniec wieczoru”, bez punktów i podsumowania. Przy okazji głos dostaje numer pytania, żeby spóźniony ekran nie oddał głosu do pytania, którego gracz nie widział.

W zakresie są też dwa follow-upy z przeglądu S-02: F4 (granica błędów ekranu pokoju) i F6 (limit treści żądania przed jej przeczytaniem). F7 (czytnik ekranu) sprawdza Karol w ręcznej rundzie fazy 6.

## Current State Analysis

Pełne ustalenia z kotwicami: `context/changes/full-game-evening/research.md`. Najważniejsze:

- **Baza** (`supabase/migrations/20261014101922_first_live_round.sql`):
  - `private.rounds` ma `number` i klucze `(room_id, number)`, `(room_id, question_id)` (`:112-126`), więc schemat dopuszcza wiele rund i już blokuje powtórkę pytania;
  - `start_game` otwiera tylko rundę 1 i tylko z `lobby` (`:540-594`);
  - `cast_vote(uuid, text, text default null)` (`:599`) głosuje w najnowszej rundzie pokoju (`:655-659`), odmawia tylko fazie `revealed` (`:663-665`) i zakłada urnę od nowa (`:694`);
  - faza rundy to `voting` albo `revealed` (`:117`); `room_lobby` czyta rundę tylko przy `playing` (`:474-481`), a każda faza inna niż `voting` wpada do gałęzi wyników (`:499-516`);
  - stany pokoju `lobby | playing | closed` (`:43`), jeden otwarty pokój hosta (`:47`); sprzątanie nocne tylko `playing` (`supabase/migrations/20261014101925_close_stale_games.sql:29`).
- **Worker:** pytanie losuje `drawFrom` bez wykluczeń (`src/lib/rounds/draw.ts:25-48`), w `start.ts:29`. Głos niesie tylko `{target}` (`src/pages/api/rooms/[id]/vote.ts:29-31`). Wzór akcji hosta: `reveal.ts` (`refuseForeignPost`, `callRpc`, dzwonek po `ok`, `actionAnswer`).
- **Ekrany:** po odsłonie host widzi „Kolejne pytania wkrótce.” i „Nowa gra” (`src/components/room/RoundReveal.tsx:215-223`); zamknięta gra to „Ta gra jest zamknięta.” (`RoomScreen.tsx:83-95`); ogłoszenie `aria-live` tylko przy zmianie nazwy fazy, „Gra się zaczęła.” dla każdej fazy `voting` (`RoomScreen.tsx:40-66`); `RoundVoting` ma `key={round.number}`, więc pamięć „Twój głos” startuje od nowa przy każdym pytaniu.
- **Testy:** pomocnicy pgTAP zapamiętują id rund tylko przy starcie (`supabase/tests/round_creator_view.test.sql:111-123`), więc `urn_rows` (`:164-181`) nie widzi rund 2+; dokładne zbiory kluczy w `tests/db/support/rounds.ts:32-38`; testy jednostkowe biegną w środowisku `node` bez DOM (`vitest.config.ts`).

## Desired End State

1. Po odsłonie host klika „Następne pytanie” (jedno kliknięcie). Wszystkie ekrany pokazują nowe pytanie z wybranych kategorii (18+ tylko tam, gdzie host je włączył), którego w tej grze jeszcze nie było, z pustym formularzem głosu.
2. W trakcie głosowania host może „Pomiń pytanie” (drugie kliknięcie: „Na pewno pominąć? Głosy przepadną (zagłosowało N z M)” + „Anuluj”). Głosy rundy przepadają bez śladu, od razu pojawia się następne pytanie, a wszystkie ekrany tej nowej rundy (także telefon, który był uśpiony) pokazują notkę „Host pominął poprzednie pytanie. Głosy z niego przepadły.”.
3. W trakcie głosowania i po odsłonie host może „Zakończ grę” (drugie kliknięcie: „Na pewno zakończyć grę? Wszyscy zobaczą koniec wieczoru” + „Anuluj”). Wszyscy widzą „Koniec wieczoru” i „Dzięki za grę!”; host ma „Nowa gra”, gość „Chcesz zagrać jeszcze raz? Poproś hosta o nowy link.”.
4. Gdy pula pytań się wyczerpie, host po odsłonie (albo po pominięciu ostatniego pytania) widzi „Pytania z wybranych kategorii się skończyły.” i tylko „Zakończ grę”. Gra nie kończy się sama.
5. Głos, pominięcie i „Następne pytanie” niosą numer pytania. Głos albo akcja hosta z nieaktualnym numerem dostaje odmowę, więc nic nie trafia do pytania, którego ktoś nie widział, a podwójne kliknięcie nie przeskoczy dwóch pytań.
6. Po pominięciu i po końcu gry w trakcie głosowania nie zostaje urna ani żadna liczba głosów (ryzyko #1).
7. Czytnik ekranu słyszy numer każdego nowego pytania, pominięcie i koniec wieczoru.
8. F4: wysypany ekran pokoju pokazuje „Coś się popsuło — odśwież stronę.” i zgłasza `island_crash`. F6: za duża treść żądania dostaje 400 przed przeczytaniem.

Weryfikacja: CI (`ci`, `db`, `smoke`, `e2e`) zielone, trzy próbne alarmy trafiły dokładnie, smoke na produkcji, ręczny wieczór Karola z czytnikiem.

### Key Discoveries:

- Klucz `(room_id, question_id)` (`:125`) już blokuje powtórkę; funkcja bazy musi jednak sprawdzić to przed zapisem, bo błąd 23505 niósłby wartości wiersza w DETAIL (komentarz `:11-12`).
- `cast_vote` na rundzie w nowej fazie przyjąłby głos, założył urnę od nowa i przy komplecie odsłonił liczby (`finish_round`, `:206-208`). Odmowa każdej fazy innej niż `voting` jest warunkiem koniecznym fazy `skipped`.
- Numer najnowszej rundy to liczba zagranych pytań (numery 1..N, każda runda z innym pytaniem), więc Worker policzy „czy zostały pytania” jako `rozmiar puli > number`, bez nowej funkcji bazy.
- Parser stanu odrzuca nieznaną fazę (`src/lib/rooms/shared.ts:137`), więc stary Worker na nowej bazie działa, dopóki nikt nie pominie pytania (a stary Worker nie ma jak).

## What We're NOT Doing

- **Podsumowanie wieczoru** („najwięcej głosów dziś”, FR-022): w Parked roadmapy. Ekran końca nie pokazuje liczb ani liczby zagranych pytań.
- **Lista pytań przed startem i jej przegląd:** S-06. S-03 nie zapisuje listy; Worker przy każdym „Następne pytanie” podaje pulę w losowej kolejności (D1 W-B).
- **Dane o jakości pytań** (pominięcia, reakcje): S-11. Wiersz pominiętej rundy zostaje tylko dla numeracji i bezpiecznika „bez powtórek”.
- **Współhost:** S-07. Następne, pomiń i koniec może tylko host.
- **Bez pytań z ostatnich wieczorów hosta:** S-12.
- **Nowy stan pokoju** (np. `finished`): koniec gry to `closed` (D4).
- **Pomiar 2 s, zerwane połączenie w rundzie, sonda na produkcji:** faza 3 planu testów, najlepiej z S-04 (D5).
- **Punkty, rankingi, minutniki:** PRD Non-Goals.
- **Zmiana `start_game`:** zostaje bez zmian (okno wdrożenia).

## Implementation Approach

**Jeden PR, szkic do końca prac**, gałąź `full-game-evening`, fazy jako commity, jak w S-02:

1. **Faza 1: testy przed kodem.** Testy bazy i pgTAP opisują zachowanie z PRD i decyzji; w CI świecą na czerwono wyłącznie z powodu brakujących funkcji i zachowań.
2. **Faza 2: migracja.** Testy bazy zielone; smoke i e2e w CI biegną na starym kodzie Workera, co dowodzi, że `db push` przed scaleniem nie psuje produkcji.
3. **Fazy 3–4: serwer i ekrany.** Czyste moduły test-first w tej samej turze (hooki odsyłają przy czerwonym teście jednostkowym).
4. **Faza 5: e2e kilku pytań, smoke z grą, próbne alarmy.**
5. **Faza 6: przegląd i wdrożenie** „baza, potem kod”; scala Karol.

**Decyzje wejściowe:**

| Decyzja | Wybór | Źródło |
|---|---|---|
| Skąd kolejne pytanie | Worker podaje pulę w losowej kolejności, baza bierze pierwsze niezagrane; bez nowej tabeli, `start_game` bez zmian | research D1 (W-B) |
| Pominięcie | Tylko w trakcie głosowania, drugie kliknięcie, od razu następne pytanie; ostatnie pytanie nie kończy gry samo | research D2 |
| Ślad pominięcia | Wiersz rundy `skipped` bez liczb, urna usunięta | research D3 |
| Koniec gry | `closed` + usunięcie urny, „Koniec wieczoru” dla wszystkich | research D4 |
| Faza 3 planu testów | Osobno; S-03 niesie ryzyka #1, #3, #4, e2e bez pomiaru czasu, szacunek #7 | research D5 |
| Notka po pominięciu | „Host pominął poprzednie pytanie. Głosy z niego przepadły.” na każdym ekranie rundy po pominięciu; baza mówi, że poprzednia runda była pominięta (`after_skip`), bo ekran, który przespał odsłonę, wziąłby zwykłe „Następne pytanie” za pominięcie | wywiad planu (sposób poprawiony przy pisaniu planu) |
| Ekran końca | „Koniec wieczoru” + „Dzięki za grę!”; host „Nowa gra”; gość „Chcesz zagrać jeszcze raz? Poproś hosta o nowy link.” | wywiad planu |
| Potwierdzenia | Pełne zdania: „Na pewno pominąć? Głosy przepadną (zagłosowało N z M)”, „Na pewno zakończyć grę? Wszyscy zobaczą koniec wieczoru”, obok „Anuluj” | wywiad planu |
| „Następne pytanie” | Jedno kliknięcie; po wyczerpaniu puli zamiast niego „Pytania z wybranych kategorii się skończyły.” | wywiad planu |
| Próbne alarmy | Trzy: spóźniony głos, urna po pominięciu, sygnał po „Następne pytanie” | wywiad planu |

## Critical Implementation Details

- **Kolejność wdrożenia** (jak S-02): PR zielony → `npx supabase db push` (pytanie) → smoke na produkcji ze **starym** Workerem z `SMOKE_GAME=0` (pytanie) → scalenie przez Karola → smoke pełny (pytanie). Działa, bo `start_game` się nie zmienia, `cast_vote` przyjmuje stare argumenty, a stary Worker nie potrafi pominąć pytania, więc faza `skipped` nie pojawi się przed scaleniem. Nowy Worker przed migracją się zepsuje (brak funkcji), więc nigdy nie scalać przed `db push`.
- **Jedna wersja `cast_vote`.** Migracja usuwa `cast_vote(uuid, text, text)` i tworzy `cast_vote(p_room_id uuid, p_target text, p_player_token text default null, p_round integer default null)` w tej samej transakcji, z właścicielem `postgres` i grantem jak dotąd (`anon`, `authenticated`). Dwie wersje obok siebie byłyby furtką (stara przyjęłaby głos do pominiętej rundy) i mogłyby dać niejednoznaczne wywołanie w PostgREST. Test fazy 1 woła `cast_vote` bez `p_round` (tak woła stary Worker); jeśli w CI nie przejdzie, zatrzymać się i zgłosić, zanim powstanie reszta.
- **Niezmienniki funkcji gry** (next, skip, end, vote):
  - najpierw blokada wiersza `rooms` (`for update`), potem runda i urna (kolejność z `start_game` i `cast_vote`);
  - wszystko sprawdzane przed zapisem; odmowy jako `{ok:false, reason}`, nigdy wyjątek z DETAIL;
  - pominięcie usuwa wiersze urny rundy i ustawia `phase='skipped'` w tej samej transakcji, w której otwiera następną rundę;
  - głos trafia tylko do rundy w fazie `voting`, która jest najnowsza, a gdy podano `p_round`, ma ten numer;
  - żadna funkcja nie zwraca celu głosu ani liczb poza fazą `revealed`; żadnych kolumn czasu, sekwencji ani `identity` w tabelach rundy.
- **Numer, który widział host.** `next_round` i `skip_round` przyjmują numer najnowszej rundy z ekranu hosta; inny numer to `round_over`. Dzięki temu podwójne kliknięcie i ponowione żądanie nie pominą pytania, którego nikt nie widział.
- **pgTAP najpierw naprawia pomocników** (`urn_rows` czyta rundy pokoju w chwili wywołania), dopiero potem dostaje nowe asercje urny. W odwrotnej kolejności „0 wierszy urny w rundzie 2” byłoby zielone bez względu na kod.

## Faza 1: Testy przed kodem

### Overview

Gałąź `full-game-evening`, szkic PR. Testy bazy (Vitest `db`) i pgTAP opisują zasady wieczoru z PRD i decyzji, z oczekiwaniami rozpisanymi ręcznie. W CI czerwone są wyłącznie nowe testy, z powodu brakujących funkcji (`PGRST202`) albo brakującego zachowania. Testy jednostkowe powstają w fazach 3–4 razem z modułami (test-first w tej samej turze).

### Changes Required:

#### 1. Dokumenty zmiany

**File**: `context/changes/full-game-evening/{change.md,research.md,plan.md,plan-brief.md}`, `context/foundation/roadmap.md`

**Intent**: Pierwszy commit gałęzi z dokumentami S-03 (jak `06c7921` w S-02).

**Contract**: Roadmapa S-03 `planning` → `/10x-implement` przestawi na `in-progress`.

#### 2. Pomocnicy testów bazy

**File**: `tests/db/support/rounds.ts`

**Intent**: Wywołania nowych funkcji drzwiami ról i zbiór kluczy pominiętej rundy, żeby testy zasad i anonimowości miały wspólny słownik.

**Contract**:
- `nextRound(client, roomId, round, candidates)`, `skipRound(client, roomId, round, candidates)`, `endGame(client, roomId)` zwracają `{ data, error }`; `seedNextRound`, `seedSkipRound` rzucają (tylko `beforeAll`);
- `castVote` przyjmuje opcjonalny `round`; brak `round` = wywołanie bez `p_round` (jak stary Worker);
- `SKIPPED_ROUND_KEYS = ["number", "phase"]`; `VOTING_ROUND_KEYS` dostaje `after_skip`; stałe id pytań do scenariuszy (co najmniej 4, z jednej kategorii, zapisane wprost).

#### 3. Zasady wieczoru (ryzyko #3)

**File**: `tests/db/game-rules.test.ts` (nowy; jeden host, budżet rejestracji 10 → 11 z 30)

**Intent**: Scenariusz Host/Ola/Bartek rozpisany ręcznie: kolejne pytania, pominięcie, koniec, spóźnione głosy.

**Contract** (oczekiwania wpisane w teście, nigdy liczone):
- runda 1 (`Q1`), odsłona; `next_round(1, [Q1, Q2])` otwiera rundę 2 z `Q2` (Q1 zagrane); stan: runda 2, `voting`, `after_skip` false, `me_voted` false u Oli, która głosowała w rundzie 1;
- głos z `round: 1` w rundzie 2 → `round_over`; głos bez `round` w rundzie 2 → `{ ok: true }` (okno wdrożenia);
- `next_round` w trakcie głosowania → `round_in_progress`; `next_round(1, …)` przy rundzie 2 → `round_over`;
- `skip_round(2, [Q1, Q2, Q3])` → runda 3 z `Q3`, `after_skip` true; głos z `round: 2` → `round_over`; drugie `skip_round(2, …)` → `round_over` (nie pomija rundy 3);
- `skip_round` po odsłonie → `round_revealed`;
- `next_round` / `skip_round` z samymi zagranymi kandydatami → odpowiednio `no_questions` (bez nowej rundy) i `{ ok: true }` z najnowszą rundą `skipped` (stan: dokładnie `SKIPPED_ROUND_KEYS`); głos bez `round` na pominiętą rundę → `round_over`;
- `end_game` w trakcie głosowania → `{ ok: true }`; stan `closed`, `round` null; `room_link` `closed`; `join_room` `room_closed`; ponowne `end_game` → `room_closed`; `next_round` → `room_closed`;
- `end_game` / `next_round` / `skip_round` w `lobby` → `no_round`.

#### 4. Odmowy ról (ryzyko #4)

**File**: `tests/db/round-rules.test.ts`

**Intent**: Gość i obcy host nie zrobią next/skip/end, sprawdzone drzwiami REST/RPC.

**Contract**: `anon` → `42501` z nazwą funkcji w komunikacie (wzór G2); host B w pokoju A → `room_unknown`; istniejący host B i pokój B (`:44-48`), 0 nowych kont. Stary test `:169-173` (drugie `start_game` → `game_started`) zostaje.

#### 5. Anonimowość po pominięciu i końcu (ryzyko #1)

**File**: `tests/db/round-anonymity.test.ts`

**Intent**: Pominięta i zakończona runda nie zostawia liczb w żadnej odpowiedzi.

**Contract**: po `skip_round` z wyczerpaną pulą stan pokoju ma rundę z dokładnie `SKIPPED_ROUND_KEYS`, widziany jako gość, który głosował, gość, który nie, i host; po `end_game` w trakcie głosowania stan bez rundy; `cast_vote` z `p_round` odpowiada dokładnie `{ ok: true }` (`keysOf`, `toEqual`).

#### 6. Widok twórcy (pgTAP)

**File**: `supabase/tests/round_creator_view.test.sql`

**Intent**: Najpierw pomocnicy liczący wszystkie rundy pokoju, potem nowe asercje urny i katalogu.

**Contract**:
- `urn_rows` czyta id rund pokoju w chwili wywołania; `results_of` i `round_phase` liczą wskazaną rundę, nie wszystkie;
- 0 wierszy urny po: pominięciu rundy 2, końcu gry w trakcie głosowania rundy 2, sprzątaniu gry rozpoczętej ponad 12 h temu, która jest w rundzie 2;
- pętla po wszystkich tabelach schematu `private`: brak uprawnień `anon`/`authenticated`, poza publikacją, bez kolumn czasu, `serial`, `identity`;
- `next_round`, `skip_round`, `end_game`: właściciel `postgres`, `search_path=''`, `execute` tylko dla `authenticated`; `cast_vote` istnieje w dokładnie jednej wersji (4 argumenty);
- `plan(N)` podbite; kontrola pozytywna pierwsza; asercje przez funkcje, które przy brakującym obiekcie dają `not ok`.

#### 7. Stare ścieżki w testach

**File**: `tests/db/*`, `tests/db/support/*`, `tests/unit/*` (12 miejsc w 10 plikach), `supabase/tests/round_creator_view.test.sql:4`

**Intent**: `context/changes/first-live-round/` → `context/archive/2026-10-13-first-live-round/`.

**Contract**: tylko komentarze.

### Success Criteria:

#### Automated Verification:

- Lokalna bramka zielona: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- CI `db`: czerwone wyłącznie nowe testy S-03 (lista w opisie commita), testy S-02 zielone, pgTAP dochodzi do końca pliku (`not ok`, nie przerwanie)
- CI `ci`, `smoke`, `e2e` zielone

#### Manual Verification:

- Karol przejrzał po ludzku listę nowych strażników (nazwy testów w opisie PR)

**Implementation Note**: Push gałęzi i szkic PR za zgodą Karola (AGENTS.md: `tests/` i `supabase/` tylko przez PR).

---

## Faza 2: Baza: kolejne pytania, pominięcie, koniec gry

### Overview

Jedna nowa migracja (`npx supabase migration new full_game_evening < /dev/null`). Testy bazy z fazy 1 robią się zielone; smoke i e2e w CI dalej biegną na starym kodzie Workera.

### Changes Required:

#### 1. Faza `skipped` i otwieranie rundy

**File**: `supabase/migrations/<timestamp>_full_game_evening.sql`

**Intent**: Runda może być pominięta; jedno miejsce otwiera kolejną rundę z kandydatów.

**Contract**:
- `private.rounds.phase` dopuszcza `voting | revealed | skipped` (zamiana ograniczenia);
- `private.open_next_round(p_room_id uuid, p_number integer, p_candidates text[]) returns boolean` (bez grantów): pierwszy kandydat w poprawnym formacie, którego nie ma w rundach pokoju (`exists` przed `insert`), runda `p_number`, uprawnieni = gracze w pokoju w kolejności miejsc, pusta urna; `false`, gdy nie ma kandydata.

#### 2. Funkcje hosta

**File**: ta sama migracja

**Intent**: Następne pytanie, pominięcie i koniec gry jako publiczne wejścia hosta z wszystkimi sprawdzeniami w środku.

**Contract** (każda: `security definer`, właściciel `postgres`, `search_path=''`, `revoke` od `public, anon, authenticated`, `grant execute` tylko `authenticated`; obcy pokój albo brak sesji → `room_unknown`; `closed` → `room_closed`; `lobby` → `no_round`):
- `public.next_round(p_room_id uuid, p_round integer, p_candidates text[]) returns jsonb`: najnowsza runda musi mieć numer `p_round` (inaczej `round_over`) i fazę `revealed` albo `skipped` (`voting` → `round_in_progress`); brak kandydata → `no_questions`; sukces `{ ok: true }`;
- `public.skip_round(p_room_id uuid, p_round integer, p_candidates text[]) returns jsonb`: najnowsza runda o numerze `p_round` (inaczej `round_over`) w fazie `voting` (`revealed` → `round_revealed`, `skipped` → `round_over`); usuwa jej wiersze urny, ustawia `skipped`, potem próbuje otworzyć następną; `{ ok: true }` także wtedy, gdy kandydatów zabrakło;
- `public.end_game(p_room_id uuid) returns jsonb`: tylko `playing`; `private.drop_round_state`, `status='closed'`; `{ ok: true }`.

#### 3. Głos z numerem pytania

**File**: ta sama migracja

**Intent**: Głos nie trafi do pytania, którego gracz nie widział, ani do rundy pominiętej.

**Contract**: `drop function public.cast_vote(uuid, text, text)`; nowa `cast_vote(p_room_id uuid, p_target text, p_player_token text default null, p_round integer default null)`: najnowsza runda w fazie `revealed` → `round_revealed`, `skipped` → `round_over`, `p_round` podany i różny od numeru najnowszej → `round_over`; reszta jak dotąd (odpowiedź dokładnie `{ ok: true }`); właściciel, `revoke` i `grant` (`anon`, `authenticated`) jak w `:779-804`.

#### 4. Stan dla ekranów

**File**: ta sama migracja

**Intent**: `room_lobby` rozpoznaje pominiętą rundę, nie pokazuje jej jako odsłoniętej i mówi, że runda w toku przyszła po pominięciu.

**Contract**: `create or replace function public.room_lobby`: faza `skipped` → `{ number, phase }`; gałąź `voting` dostaje `after_skip` (runda `number − 1` istnieje i ma fazę `skipped`); gałąź `revealed` bez zmian. Pominięcie to informacja jawna dla wszystkich, bez związku z czyimkolwiek głosem.

### Success Criteria:

#### Automated Verification:

- CI `db`: Vitest i pgTAP zielone w całości (S-02 i S-03)
- CI `smoke` i `e2e` zielone na starym kodzie Workera
- `git diff main...HEAD -- supabase/migrations` zawiera wyłącznie `*_full_game_evening.sql`

**Implementation Note**: Migracji nie wgrywać (`db push` dopiero w fazie 6).

---

## Faza 3: Serwer wieczoru

### Overview

Trzy nowe akcje hosta, tasowanie puli, numer pytania w głosie, informacja „czy zostały pytania” dla hosta, nowe kody odmów i F6. Każdy czysty moduł test-first (`/10x-tdd`).

### Changes Required:

#### 1. Pula w losowej kolejności

**File**: `src/lib/rounds/draw.ts`, `tests/unit/draw.test.ts`

**Intent**: Worker podaje bazie całą pulę gry w losowej kolejności; to samo filtrowanie kategorii i 18+ co `drawFrom`.

**Contract**: `shuffledPool(base, selection, random): Id[]` (Fisher–Yates na wstrzykniętym `random`) i `questionPool(selection)` / rozmiar puli dla hosta; `drawFrom` korzysta z tego samego filtra. Test na ręcznym `BASE` (`:19-29`): zbiór wyniku równy ręcznie wypisanej puli, kolejność zależy od `random`, pusta pula → `[]`; komentarz `:25` zaktualizowany.

#### 2. Wywołania bazy i widok hosta

**File**: `src/lib/rooms/server.ts`, `src/lib/rooms/shared.ts`, `tests/unit/room-state.test.ts`

**Intent**: Opakowania nowych funkcji; parser zna fazę `skipped`; host wie, czy zostały pytania.

**Contract**:
- `nextRound`, `skipRound`, `endGame` przez `callRpc` → `actionResult`; `castVote(…, round?)` przekazuje `p_round` tylko, gdy podany;
- `RoundState` dostaje wariant `{ number, phase: "skipped" }`, a wariant `voting` pole `after_skip`; nieznana faza dalej `fail`;
- `RoomView` hosta dostaje `questionsLeft: boolean | null`: przy najnowszej rundzie `revealed` albo `skipped` Worker czyta kategorie przez RLS hosta (`hostRoomCategories`) i liczy `rozmiar puli > round.number`; w pozostałych stanach i dla gościa `null`;
- testy parsera: `skipped` z dokładnymi kluczami, `skipped` z liczbami → `fail`.

#### 3. Akcje hosta

**File**: `src/pages/api/rooms/[id]/next.ts`, `skip.ts`, `end.ts` (nowe), `src/pages/api/rooms/[id]/vote.ts`

**Intent**: Wzór `reveal.ts`; next i skip niosą numer pytania, głos też.

**Contract**:
- `POST /api/rooms/[id]/next` i `/skip`: treść `{ round: integer ≥ 1 }` przez `readJsonBody` (inaczej `invalid_body`), tylko sesja hosta, kandydaci z `shuffledPool(…, Math.random)`, dzwonek po `ok`, odpowiedź Workera `{ ok: true }`;
- `POST /api/rooms/[id]/end`: bez treści, tylko host, dzwonek po `ok`;
- `/vote`: treść `{ target, round? }`; brak `round` przyjęty (ekran załadowany przed wdrożeniem), zły `round` → `invalid_body`.

#### 4. Kody odmów

**File**: `src/lib/rooms/errors.ts`, `tests/unit/room-errors.test.ts`

**Intent**: Każdy nowy kod ma własny tekst dla gracza.

**Contract**: `ROUND_REFUSALS` += `round_over`, `round_in_progress`; teksty w `MESSAGES` (np. „To pytanie już się zmieniło.”); ręczna lista w teście (`:19-28`) zaktualizowana.

#### 5. F6: limit treści przed przeczytaniem

**File**: `src/lib/rooms/json-route.ts`, test jednostkowy obok istniejących

**Intent**: Za duża treść dostaje odmowę, zanim Worker ją przeczyta.

**Contract**: `Content-Length` większy niż `MAX_BODY_LENGTH` (`:12`) → 400 `invalid_body` bez czytania; treść bez nagłówka czytana strumieniem z limitem 4096 bajtów; test: nagłówek 5000 → `invalid_body`, treść 5000 bajtów bez nagłówka → `invalid_body`, poprawny JSON → przyjęty.

#### 6. Komentarze i stare ścieżki w `src/`

**File**: `src/lib/rooms/json-route.ts:5`, `src/lib/rooms/server.ts:17`, pliki `src/` z `context/changes/first-live-round/`

**Intent**: Listy akcji w komentarzach i ścieżki do archiwum aktualne.

**Contract**: tylko komentarze.

### Success Criteria:

#### Automated Verification:

- `npm test` zielone z nowymi testami (pula, parser, kody odmów, F6)
- Lokalna bramka zielona: `npm run lint`, `npx astro check`, `npm run build`
- CI zielone (`ci`, `db`, `smoke`, `e2e`)

---

## Faza 4: Ekrany wieczoru

### Overview

Przyciski hosta z potwierdzeniami, notka po pominięciu, „Koniec wieczoru”, ogłoszenia z numerem pytania, granica błędów (F4), stany na `/dev/room-states` i zrzuty do oceny Karola.

### Changes Required:

#### 1. Ogłoszenia i notka po pominięciu (czyste funkcje)

**File**: nowy moduł w `src/lib/rooms/` (np. `announce.ts`), test w `tests/unit/`

**Intent**: Co ogłasza czytnik i kiedy pokazać notkę, liczone ze stanu, testowalne bez DOM.

**Contract**: `announcement(view)` zależy od statusu, fazy **i numeru** rundy: pierwsze pytanie „Gra się zaczęła. …”, kolejne „Pytanie N. …”, runda z `after_skip` „Host pominął poprzednie pytanie. Pytanie N. …”, odsłona „Wynik odsłonięty.”, pominięta ostatnia runda „Host pominął pytanie.”, koniec „Koniec wieczoru.”; `skipNotice(view)` prawdziwe dla rundy `voting` z `after_skip`. Testy sprawdzają zachowanie (różny tekst dla różnych numerów, własny tekst dla pominięcia i końca, notka tylko przy `after_skip`), bez przepisywania polskich zdań (test-plan §6.1).

#### 2. Akcje i ekran pokoju

**File**: `src/components/room/room-actions.ts`, `src/components/room/RoomScreen.tsx`

**Intent**: Nowe akcje z numerem pytania; ogłoszenie i notka z modułu 1; ekran końca wieczoru zamiast „Ta gra jest zamknięta.”.

**Contract**:
- `RoomAction` += `next`, `skip`, `end`; akcja może nieść treść `{ round }`;
- region `aria-live` ustawiany przy zmianie klucza `status:phase:number`;
- notka po pominięciu nad pytaniem przez całą rundę z `after_skip`;
- `closed`: „Koniec wieczoru”, „Dzięki za grę!”, host „Nowa gra” (link `/`), gość „Chcesz zagrać jeszcze raz? Poproś hosta o nowy link.”.

#### 3. Przyciski hosta

**File**: `src/components/room/RoundVoting.tsx`, `src/components/room/RoundReveal.tsx`, nowy widok pominiętej ostatniej rundy (np. `RoundSkipped.tsx`)

**Intent**: Host prowadzi wieczór; każda akcja, która coś zabiera, pyta drugi raz.

**Contract**:
- głosowanie: „Odsłoń wynik” bez zmian, „Pomiń pytanie” → „Na pewno pominąć? Głosy przepadną (zagłosowało N z M)” + „Anuluj”, „Zakończ grę” → „Na pewno zakończyć grę? Wszyscy zobaczą koniec wieczoru” + „Anuluj”; wzór dwóch kroków i `aria-live` z `RoundVoting` (`:296-335`);
- głos wysyła `round` bieżącego pytania;
- odsłona (host): „Następne pytanie” (jedno kliknięcie) i „Zakończ grę” (z potwierdzeniem) zamiast „Kolejne pytania wkrótce.” i „Nowa gra” (`:215-223`); `questionsLeft === false` → „Pytania z wybranych kategorii się skończyły.” i tylko „Zakończ grę”;
- najnowsza runda `skipped` (pula wyczerpana): wszyscy „Host pominął pytanie.”; host dodatkowo tekst o wyczerpanych pytaniach i „Zakończ grę”;
- przyciski z tokenów i komponentów `src/components/ui` (AGENTS.md UI).

#### 4. F4: granica błędów

**File**: nowy `src/components/room/RoomErrorBoundary.tsx`, `src/components/room/useRoomState.ts`, `RoomScreen.tsx`

**Intent**: Wysypany ekran mówi graczowi, co zrobić, i zostawia ślad w logach.

**Contract**: komponent klasowy wokół treści `RoomScreen`; `componentDidCatch` zgłasza `{ event: "island_crash", roomId }` przez `reportClientEvent` (wyniesiona i eksportowana z `useRoomState.ts:67-91`, z jej limitem i warunkiem widocznej karty); zastępczy ekran „Coś się popsuło — odśwież stronę.” z przyciskiem odświeżenia. Sprawdzane na `/dev/room-states` (stan z celowo wysypanym dzieckiem) i ręcznie, bo testy jednostkowe nie mają DOM.

#### 5. Strona linku i podglądy

**File**: `src/pages/j/[token].astro`, `src/pages/dev/room-states.astro`, `scripts/ui-literals.mjs`

**Intent**: Tekst zamkniętej gry na stronie linku zgodny z końcem wieczoru; wszystkie nowe stany do obejrzenia.

**Contract**: strona linku dla `closed`: „Ta gra już się skończyła.” + „Poproś hosta o nowy link.” (status 410 bez zmian); podglądy: głosowanie hosta (zwykłe, „Na pewno pominąć?”, „Na pewno zakończyć?”), runda 2 z notką po pominięciu (gość), odsłona hosta z „Następne pytanie” i z wyczerpaną pulą, pominięta ostatnia runda (host i gość), koniec wieczoru (host i gość), ekran po wysypaniu; nowe pliki widoków na liście `scripts/ui-literals.mjs`.

### Success Criteria:

#### Automated Verification:

- Lokalna bramka zielona z testami ogłoszeń i notki: `npm run lint` (z literałami UI), `npx astro check`, `npm test`, `npm run build`
- CI zielone (`ci`, `db`, `smoke`, `e2e`)

#### Manual Verification:

- Zrzuty nowych stanów z `/dev/room-states` ocenione przez Karola (laptop jako całe okno, telefon w prawdziwej wielkości)
- Klawiatura: „Pomiń pytanie”, „Zakończ grę”, „Następne pytanie” i „Anuluj” osiągalne, fokus po potwierdzeniu nie ginie; regiony `aria-live` mają teksty z numerem pytania, pominięciem i końcem (czytnik w fazie 6)

**Implementation Note**: Po fazie 4 przerwa na ocenę zrzutów przez Karola.

---

## Faza 5: Test w przeglądarce, smoke z wieczorem, próbne alarmy

### Overview

E2E 3 graczy przez kilka pytań, kroki smoke z przełącznikiem na okno wdrożenia, trzy próbne alarmy z revertami, dokumenty planu testów.

### Changes Required:

#### 1. E2E wieczoru

**File**: `tests/e2e/game.spec.ts` (nowy), `tests/e2e/support/round.ts`

**Intent**: To samo, co widzą gracze przy kolejnym pytaniu, pominięciu i końcu, na 3 ekranach.

**Contract**:
- kroki w `support/round.ts`: `nextQuestion`, `skipQuestion` (z drugim kliknięciem), `endGame` (z drugim kliknięciem), lokatory notki po pominięciu i ekranu „Koniec wieczoru”;
- scenariusz: runda 1 → odsłona → „Następne pytanie”: 3 ekrany mają to samo pytanie, inne niż w rundzie 1, formularz głosu pusty → gość A głosuje → host pomija: 3 ekrany mają to samo nowe pytanie, inne niż dwa poprzednie, ekran A pokazuje notkę → „Zakończ grę”: 3 ekrany „Koniec wieczoru”, host ma „Nowa gra”;
- przejście na cudzym ekranie w `ROUND_UPDATE_MS` (10 s, mniej niż odpytywanie 15 s); `test.slow()`; bez pomiaru 2 s.

#### 2. Smoke z wieczorem

**File**: `scripts/smoke.mjs`, `.claude/settings.json`, `README.md`

**Intent**: Produkcja po wdrożeniu przechodzi kolejne pytanie, spóźniony głos, pominięcie i koniec gry; okno wdrożenia ma przełącznik.

**Contract**:
- `gameSteps()` po krokach rundy: „Następne pytanie” (runda 2), głos Oli w rundzie 2 → `{"ok":true}`, głos z `round: 1` → `{"error":"round_over"}`, pominięcie rundy 2, stan rundy 3 `voting` bez głosu Oli, „Zakończ grę”, stan `closed` dla hosta i Oli, link 410;
- `SMOKE_GAME=0` pomija dokładnie kroki S-03 (`SKIP`), a końcowe kroki zamknięcia pokoju z gośćmi biegną jak dziś; przy krokach S-03 końcowe kroki sprawdzają stan po „Zakończ grę” (nowy pokój bez potwierdzenia); `SMOKE_ROUND=0` pomija też kroki S-03;
- nazwy kroków bez celu głosu (test-plan §6.5);
- reguła `ask` dla `Bash(SMOKE_GAME=* npm*smoke*)` w `.claude/settings.json` (lessons.md, wpis 1); sekcja smoke w README z nowym przełącznikiem;
- stare ścieżki `scripts/smoke.mjs:9, 174, 254, 319` → archiwum.

#### 3. Próbne alarmy

**File**: tymczasowe commity na gałęzi (test-plan §6.2 „Break-check”)

**Intent**: Każdy nowy strażnik udowadnia, że umie zaświecić na czerwono.

**Contract**: osobno, każdy z `git revert` i zielonym CI po nim:
- (a) tymczasowa migracja: `cast_vote` ignoruje `p_round` → czerwony tylko test spóźnionego głosu w `game-rules.test.ts`;
- (b) tymczasowa migracja: `skip_round` nie usuwa wierszy urny → czerwona tylko asercja pgTAP „0 wierszy urny po pominięciu”;
- (c) `next.ts` bez dzwonka → czerwony tylko `game.spec.ts` (gość nie widzi nowego pytania w 10 s);
- inny czerwony test albo zielony przewidziany = zatrzymać się i wyjaśnić; nigdy `db push` tymczasowej migracji.

#### 4. Plan testów

**File**: `context/foundation/test-plan.md`

**Intent**: Przepisy i liczby zgodne ze stanem po S-03.

**Contract**: §4 (liczba kroków smoke, wiersz e2e z `game.spec.ts`), §6.2 (pomocnicy next/skip/end, wyniki alarmów (a) i (b), budżet rejestracji 11), §6.3 (klucze pominiętej rundy, koniec gry), §6.4 (`game.spec.ts`, alarm (c)), §6.5 (`SMOKE_GAME`).

### Success Criteria:

#### Automated Verification:

- CI `e2e` zielone z `game.spec.ts`
- CI `smoke` zielone z krokami S-03
- Próbne alarmy (a), (b) i (c) zaświeciły dokładnie przewidziane testy, a po `git revert` CI znów zielone
- `git diff main...HEAD -- supabase/migrations` zawiera wyłącznie `*_full_game_evening.sql`

#### Manual Verification:

- Wynik próbnych alarmów opisany w PR (który test, na czym zaświecił)

---

## Faza 6: Przegląd i wdrożenie

### Overview

Przegląd implementacji, wdrożenie „baza, smoke na starym kodzie, scalenie, smoke”, ręczny wieczór Karola z czytnikiem ekranu.

### Changes Required:

#### 1. Przegląd

**File**: `context/changes/full-game-evening/reviews/impl-review.md`

**Intent**: `/10x-impl-review full-game-evening` i triage z Karolem; po poprawkach uruchomić zmienione skrypty i przeklikać zmienione ekrany (lessons.md, wpis 3).

**Contract**: każde ustalenie z decyzją (poprawione albo odłożone z powodem).

#### 2. Wdrożenie

**File**: — (polecenia)

**Intent**: Kolejność z „Critical Implementation Details”.

**Contract**:
1. PR „ready for review”, CI zielone.
2. `npx supabase db push` (pytanie; nie z eduroam).
3. `SMOKE_GAME=0 BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke` na starym Workerze (pytanie).
4. Karol scala (`! gh pr merge <n> --merge`); Workers Builds wdraża.
5. Smoke na produkcji pełny (pytanie).
6. Gałąź usunięta lokalnie i zdalnie.

#### 3. Notatki

**File**: `context/changes/full-game-evening/change.md` (Notes), `context/foundation/test-plan.md` §6.6

**Intent**: Wynik ręcznego wieczoru i F7 zapisane; archiwum robi `/10x-archive`.

**Contract**: 2–3 linie: liczba testów, wynik alarmów, co pokazał wieczór i czytnik.

### Success Criteria:

#### Automated Verification:

- `npx supabase db push` zakończone bez błędu
- Smoke na produkcji ze starym Workerem (`SMOKE_GAME=0`) zielony
- Workers Builds po scaleniu zielone
- Smoke na produkcji pełny zielony

#### Manual Verification:

- Karol rozgrywa wieczór (laptop host + telefon + incognito), co najmniej 3 pytania: odsłona → „Następne pytanie” z nowym pytaniem na 3 ekranach; pominięcie w trakcie głosowania z notką na telefonie, który zagłosował; „Zakończ grę” → „Koniec wieczoru” na 3 ekranach
- Czytnik ekranu na telefonie (TalkBack albo VoiceOver): słychać nowe pytanie z numerem, pominięcie, odsłonę i koniec wieczoru; tabela wyniku czytelna (F7)
- `/10x-impl-review` zakończone, ustalenia rozstrzygnięte z Karolem

**Implementation Note**: Każde polecenie zmieniające stan zdalny (push, `db push`, smoke) wymaga pytania (AGENTS.md); scala wyłącznie Karol.

---

## Testing Strategy

### Unit Tests:

- **Pula:** kategorie, 18+, nieznane kategorie, pusta pula, kolejność zależna od `random`.
- **Parser stanu:** faza `skipped` z dokładnymi kluczami, `skipped` z liczbami odrzucone, `questionsLeft`.
- **Kody odmów:** `round_over`, `round_in_progress` z własnym tekstem.
- **F6:** nagłówek ponad limit, treść ponad limit bez nagłówka, poprawna treść.
- **Ogłoszenia i notka:** numer pytania zmienia ogłoszenie, pominięcie i koniec mają własne, notka tylko przy `after_skip`.
- **Parser stanu:** `after_skip` w rundzie `voting`.

### Integration Tests:

- **Vitest `db`, klucz publishable, jako gość i jako host:** scenariusz wieczoru (#3), odmowy ról (#4), dokładne klucze po pominięciu i końcu (#1), wywołanie `cast_vote` bez `p_round`.
- **pgTAP:** pomocnicy liczący wszystkie rundy, 0 wierszy urny po pominięciu, końcu i sprzątaniu w rundzie 2, pętla po tabelach `private`, właściciel i granty nowych funkcji, jedna wersja `cast_vote`.
- **E2E:** 3 graczy: następne pytanie, pominięcie z notką, koniec wieczoru.
- **Smoke:** kolejne pytanie, spóźniony głos, pominięcie, koniec gry na produkcji.

### Manual Testing Steps:

1. Laptop: „Nowa gra”, link do telefonu i okna incognito, 3 graczy, „Zacznij grę”.
2. Wszyscy głosują: odsłona. Host: „Następne pytanie”; na 3 ekranach nowe pytanie, formularze puste.
3. Telefon głosuje. Host: „Pomiń pytanie” → „Na pewno pominąć? …” → potwierdź. Na telefonie notka, na 3 ekranach kolejne pytanie.
4. Host: „Zakończ grę” → „Na pewno zakończyć grę? …” → potwierdź. Na 3 ekranach „Koniec wieczoru”; host ma „Nowa gra”, gość prośbę o nowy link.
5. Powtórzyć kroki 2–4 z włączonym czytnikiem na telefonie (F7).
6. Otworzyć stary link po końcu: „Ta gra już się skończyła.”.

## Performance Considerations

- **Budżet żądań (ryzyko #7, rachunek, nie pomiar):** S-02 liczył ok. 520–620 żądań Workera na rundę przy 20 ekranach (`context/archive/2026-10-13-first-live-round/plan.md:756`); odpytywanie co 15 s to 4 800 żądań na godzinę przy 20 ekranach. Wieczór 3 h z 20 rundami: ok. 20 × 570 + 3 × 4 800 ≈ 26 tys. przy limicie 100 tys. dziennie na konto (`context/foundation/infrastructure.md:49`). Dwa takie wieczory jednego dnia to ponad połowa limitu; pomiar należy do fazy 3 planu testów.
- **`questionsLeft`:** jedno dodatkowe zapytanie hosta (kategorie przez RLS) przy pobraniu stanu, tylko gdy najnowsza runda jest `revealed` albo `skipped`; goście bez zmian.
- **Blokada pokoju** szereguje głosy i akcje hosta; transakcje krótkie, bez znaczenia przy tej skali.

## Migration Notes

- **Dane produkcyjne:** rundy `voting` i `revealed` bez zmian; ograniczenie fazy tylko się poszerza. Gra w toku w chwili wdrożenia (runda 1 z S-02) przechodzi do „Następnego pytania” jak nowa.
- **Wycofanie kodu** (`wrangler rollback`, pytanie) jest bezpieczne, dopóki żadna gra nie ma rundy `skipped`: stary parser odrzuca tę fazę (`src/lib/rooms/shared.ts:137`), więc ekrany takiej gry pokazałyby błąd odświeżania. Później naprawa do przodu albo nowa migracja zamykająca pokoje `playing` przez `private.drop_round_state`.
- **Wycofanie bazy** wyłącznie nową migracją, nigdy edycją wgranej (AGENTS.md).

## References

- Research: `context/changes/full-game-evening/research.md` (D1–D5, T1–T7, recenzja adwokat/krytyk, decyzje Karola)
- Roadmapa S-03: `context/foundation/roadmap.md`, sekcja „S-03: Pełny wieczór”
- PRD: FR-006, FR-015, kryterium „co najmniej 10 pytań” (`context/foundation/prd.md:38, :97, :120`)
- Plan testów: `context/foundation/test-plan.md` §2 (#1, #3, #4, #7), §6.1–§6.5
- Follow-upy S-02: `context/archive/2026-10-13-first-live-round/follow-ups/review-fixes.md` (F4, F6, F7)
- Wzorce: migracja `supabase/migrations/20261014101922_first_live_round.sql` (`start_game`, `reveal_round`, granty `:774-805`), akcja `src/pages/api/rooms/[id]/reveal.ts`, potwierdzenie `src/components/room/RoundVoting.tsx:296-335`, testy `tests/db/round-rules.test.ts`, `tests/e2e/round.spec.ts`, smoke `roundSteps()` w `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Testy przed kodem

#### Automated

- [x] 1.1 Lokalna bramka zielona: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — 5f3e40c
- [x] 1.2 CI `db`: czerwone wyłącznie nowe testy S-03 (lista w opisie commita), testy S-02 zielone, pgTAP dochodzi do końca pliku (`not ok`, nie przerwanie) — 5f3e40c
- [x] 1.3 CI `ci`, `smoke`, `e2e` zielone — 5f3e40c

#### Manual

- [x] 1.4 Karol przejrzał po ludzku listę nowych strażników (nazwy testów w opisie PR) — 5f3e40c

### Phase 2: Baza: kolejne pytania, pominięcie, koniec gry

#### Automated

- [x] 2.1 CI `db`: Vitest i pgTAP zielone w całości (S-02 i S-03) — ecb290d
- [x] 2.2 CI `smoke` i `e2e` zielone na starym kodzie Workera — ecb290d
- [x] 2.3 `git diff main...HEAD -- supabase/migrations` zawiera wyłącznie `*_full_game_evening.sql` — ecb290d

### Phase 3: Serwer wieczoru

#### Automated

- [x] 3.1 `npm test` zielone z nowymi testami (pula, parser, kody odmów, F6) — 2507462
- [x] 3.2 Lokalna bramka zielona: `npm run lint`, `npx astro check`, `npm run build` — 2507462
- [x] 3.3 CI zielone (`ci`, `db`, `smoke`, `e2e`) — 2507462

### Phase 4: Ekrany wieczoru

#### Automated

- [x] 4.1 Lokalna bramka zielona z testami ogłoszeń i notki: `npm run lint` (z literałami UI), `npx astro check`, `npm test`, `npm run build`
- [ ] 4.2 CI zielone (`ci`, `db`, `smoke`, `e2e`)

#### Manual

- [x] 4.3 Zrzuty nowych stanów z `/dev/room-states` ocenione przez Karola (laptop jako całe okno, telefon w prawdziwej wielkości)
- [x] 4.4 Klawiatura: „Pomiń pytanie”, „Zakończ grę”, „Następne pytanie” i „Anuluj” osiągalne, fokus po potwierdzeniu nie ginie; regiony `aria-live` mają teksty z numerem pytania, pominięciem i końcem (czytnik w fazie 6)

### Phase 5: Test w przeglądarce, smoke z wieczorem, próbne alarmy

#### Automated

- [ ] 5.1 CI `e2e` zielone z `game.spec.ts`
- [ ] 5.2 CI `smoke` zielone z krokami S-03
- [ ] 5.3 Próbne alarmy (a), (b) i (c) zaświeciły dokładnie przewidziane testy, a po `git revert` CI znów zielone
- [ ] 5.4 `git diff main...HEAD -- supabase/migrations` zawiera wyłącznie `*_full_game_evening.sql`

#### Manual

- [ ] 5.5 Wynik próbnych alarmów opisany w PR (który test, na czym zaświecił)

### Phase 6: Przegląd i wdrożenie

#### Automated

- [ ] 6.1 `npx supabase db push` zakończone bez błędu
- [ ] 6.2 Smoke na produkcji ze starym Workerem (`SMOKE_GAME=0`) zielony
- [ ] 6.3 Workers Builds po scaleniu zielone
- [ ] 6.4 Smoke na produkcji pełny zielony

#### Manual

- [ ] 6.5 Karol rozgrywa wieczór (laptop host + telefon + incognito), co najmniej 3 pytania: odsłona → „Następne pytanie” z nowym pytaniem na 3 ekranach; pominięcie w trakcie głosowania z notką na telefonie, który zagłosował; „Zakończ grę” → „Koniec wieczoru” na 3 ekranach
- [ ] 6.6 Czytnik ekranu na telefonie (TalkBack albo VoiceOver): słychać nowe pytanie z numerem, pominięcie, odsłonę i koniec wieczoru; tabela wyniku czytelna (F7)
- [ ] 6.7 `/10x-impl-review` zakończone, ustalenia rozstrzygnięte z Karolem
