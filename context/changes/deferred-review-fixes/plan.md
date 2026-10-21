# Odłożone poprawki z przeglądów (F2, F3, F5): plan implementacji

## Overview

Jeden PR przed pierwszym prawdziwym wieczorem z ekipą zamyka trzy poprawki odłożone w przeglądach S-02 i S-03:

- **F2**: głos i „Odsłoń wynik” trafiają tylko w pytanie, które nadawca ma na ekranie. Bez numeru pytania albo z innym numerem baza odmawia `round_over`, tak jak dziś przy „Następne” i „Pomiń”.
- **F3**: lista kandydatów do następnej rundy ma górny limit, a filtr formatu id dostaje test.
- **F5**: gdy w rzadkiej awarii host kliknie „Następne pytanie” po ostatnim pytaniu, zobaczy właściwą radę zamiast „Załóż nową grę”.

F4 (granica błędów ekranu) zrobiła już S-03 (`research.md`, sekcja F4), więc tu jej nie ma.

## Current State Analysis

Szczegóły i kotwice: `context/changes/deferred-review-fixes/research.md`.

- **Głos bez numeru przechodzi.** Wpada do najnowszej rundy. Baza sprawdza numer tylko wtedy, gdy go dostanie (`full_game_evening.sql:329`). Worker przepuszcza `null` z `bodyRound` (`json-route.ts:112-116`, `vote.ts:34-37`) i pomija wtedy `p_round` (`server.ts:243-257`).
- **Odsłona nie zna numeru.** Nie zna go baza (`first_live_round.sql:723`), Worker (`reveal.ts:22`, `server.ts:260-263`) ani ekran (`RoomScreen.tsx:125`, `RoundVoting.tsx:43, 283`). Drugi, nieodświeżony ekran hosta może więc odsłonić pytanie, którego nie pokazał.
- **Odsłona pominiętej rundy odpowiada `ok`** i niczego nie zmienia (`first_live_round.sql:763-767`).
- **Wzór do skopiowania:** `next_round` i `skip_round` odmawiają `round_over` przy `p_round is null or p_round <> v_number` (`full_game_evening.sql:120, :182`).
- **Testy utrwalają dziurę.** `game-rules.test.ts:150-154` sprawdza, że głos bez numeru dostaje `ok: true`. Bez numeru wołają też pomocnicy Vitest (`rounds.ts:96-115`, seedy `:171, :179`), pgTAP (`round_creator_view.test.sql:162-213`) i smoke (`smoke.mjs:272-274, 282`).
- **`private.open_next_round` nie ma limitu długości listy** (`full_game_evening.sql:38-73`). Filtr formatu jest w `:50`, ale żaden test nie podaje złego ani pustego kandydata.
- **`no_questions` z `next_round`** pokazuje tekst startu gry (`errors.ts:35`). Zwykła ścieżka już działa: po ostatnim pytaniu host widzi tylko „Zakończ grę” i notkę (`HostActions.tsx:56-65`). Tekst startu wyskakuje tylko wtedy, gdy Worker nie odczytał kategorii (`questionsLeft === null`, `server.ts:214-224`, `RoundReveal.tsx:232-233`).

## Desired End State

- **Głos.**
  - Bez numeru pytania: przez Workera 400 `invalid_body`, przez bazę wprost `round_over`.
  - Z numerem innym niż najnowsza runda: `round_over`.
  - W każdej z tych odmów stan i urna zostają bez zmian.
- **„Odsłoń wynik”.**
  - Bez numeru: przez Workera 400 `invalid_body`, przez bazę `round_over`.
  - Ze starym numerem: `round_over`, a bieżąca runda dalej głosuje z nietkniętymi głosami.
  - Na pominiętej rundzie: `round_over`.
  - Druga odsłona tej samej rundy: nadal `ok` (D3).
  - Ekran wysyła numer rundy z przyciskiem.
- **Kandydaci.**
  - Lista dłuższa niż 1000 kończy `next_round` i `skip_round` błędem `22023` i niczego nie zapisuje.
  - Zły format i `null` w liście są pomijane: wygrywa następny poprawny kandydat.
  - Same złe wartości dają `no_questions` bez błędu.
- **„Następne pytanie”, gdy pytania się skończyły:** odpowiedź 409 `questions_ran_out` z tekstem „Pytań już nie ma. Możesz zakończyć grę.”. `no_questions` przy starcie gry zostaje bez zmian.
- **Weryfikacja:**
  - CI zielone we wszystkich jobach (`ci`, `smoke`, `db`, `e2e`);
  - smoke na produkcji zielony z 4 nowymi krokami (3 odmowy F2 i udana odsłona z numerem);
  - ręczne sprawdzenie Karola na telefonie i laptopie.

### Key Discoveries:

- `p_round` w `cast_vote` stoi po `p_player_token text default null` (`full_game_evening.sql:255-260`), więc w Postgresie musi mieć default. Numer jest obowiązkowy przez odmowę w ciele funkcji, a nie przez brak defaultu. To samo w `next_round` i `skip_round`.
- Zmiana listy argumentów `reveal_round` wymaga `drop` i `create` w jednej migracji. Inaczej zostają dwie wersje (lekcja T1, `full_game_evening.sql:246-248`).
- `skip_round` kasuje urnę, zanim wywoła `open_next_round` (`full_game_evening.sql:195-199`). Wyjątek w pomocniku wycofuje całą transakcję, także to kasowanie.
- Precedens wyjątku dla zniekształconego wejścia od klienta, który woła bazę wprost: `raise exception 'invalid player token' using errcode = '22023'` (`full_game_evening.sql:280`).
- CI rusza tylko na PR do `main` i na push do `main` (`.github/workflows/ci.yml:3-7`). Testy bazy biegną tylko w CI.
- Po odmowie ekran sam odświeża stan (`RoomScreen.tsx:115-118`), a `round_over` ma już tekst „To pytanie już się zmieniło.” (`errors.ts:41`).

## What We're NOT Doing

- Agregat-strażnik „Gra” (fazy 3–5 z `context/domain/02-invariant-aggregate-refactor.md`). Ta zmiana tylko wyrównuje głos i odsłonę do wzoru `next_round`/`skip_round`.
- Wdrożenie trójfazowe 2a/2b/2c z przerwą 13 h. Decyzja: jeden PR, krótkie okno.
- F6 (zrobione w S-03), F7 (czytnik ekranu sprawdza Karol na wieczorze) i F4 (zrobione w S-03).
- Zmiany w `next_round`/`skip_round` poza tym, co wynika z `open_next_round` (sygnatury i ciała bez zmian).
- Zmiany w tym, jak ekran pokazuje notkę „Pytania z wybranych kategorii się skończyły.”, i czyszczenie błędu w `HostActions`.
- Nowe testy E2E. Przycisk „Odsłoń wynik” sprawdzają typy, smoke (trasa z numerem) i ręczne sprawdzenie Karola na produkcji.
- Smoke na produkcji w oknie między `db push` a scaleniem. Stary Worker dotyka tylko funkcji, których ta migracja nie zmienia, poza odsłoną. Scalamy zaraz po `db push`.
- Implementacja strażnika K1 z `refactor-opportunities`. Tu poprawiamy tylko jego planowaną wyrocznię.

## Implementation Approach

Najpierw testy z docelową wyrocznią.

- **Testy przed kodem.** Push gałęzi i draft PR pokazują w CI, że nowe testy bazy są czerwone dokładnie tam, gdzie jest dziura. Nie używamy znaczników `it.fails`. Testy odsłony z numerem dostają dziś od PostgREST błąd `PGRST202`, a `test-plan.md:176-181` zabrania liczyć taki błąd jako oczekiwaną porażkę. Tak samo robiła S-03 (`test-plan.md:306`, `rounds.ts:9-10`).
- **Faza 2:** jedna migracja (`cast_vote`, `reveal_round`, `open_next_round`) oraz Worker, ekran, pomocnicy testów, pgTAP i smoke na numerach. CI całe zielone.
- **Faza 3:** F5 osobno, bo dotyczy tylko Workera i tekstów.
- **Faza 4:** wdrożenie według zasady „baza, potem kod”, bez przerwy między `db push` a scaleniem.

## Critical Implementation Details

- **Kolejność w fazie 1.**
  - Seedy (`seedVote`, `seedReveal`) i pgTAP zostają bez numeru do fazy 2. Seed odsłony z `p_round` rzuciłby w `beforeAll` i zamaskował wszystkie testy pliku.
  - Zmiany smoke też czekają do fazy 2. Ze starym Workerem odsłona `{}` odsłoniłaby rundę 1 przed głosami, a kolejne kroki posypałyby się kaskadą.
- **Okno wdrożenia (faza 4).** Między `db push` a końcem wdrożenia Workera:
  - „Odsłoń wynik” odpowiada „To pytanie już się zmieniło.”, a rundę dalej odsłania ostatni głos;
  - głosy działają, bo ekran wysyła numer od S-03 (`RoomScreen.tsx:124`), a stary `castVote` go przekazuje.
  - Ekran wczytany przed wdrożeniem pokaże przy odsłonie tekst ogólny, dopóki ktoś go nie odświeży.
  - `db push` tylko wtedy, gdy nikt nie gra, i nigdy nie scalać przed `db push`.

## Faza 1: Testy przed migracją

### Overview

Testy bazy z wyrocznią F2 i F3 powstają przed migracją. CI na draft PR ma być czerwone dokładnie na przypadkach, które łapią dziurę, i zielone wszędzie indziej.

### Changes Required:

#### 1. Pomocnicy testów bazy

**File**: `tests/db/support/rounds.ts`

**Intent**: Probe odsłony może wysłać numer pytania, a probe kolejnej rundy może wysłać `null` w liście kandydatów. Seedy zostają bez zmian (patrz Critical Implementation Details).

**Contract**:

- `revealRound(client, roomId, round?: number)` dokłada `p_round` tylko wtedy, gdy podano `round`, tak jak `castVote`;
- `nextRound` i `skipRound` przyjmują `candidates: (string | null)[]`;
- komentarz kontraktu (`:18-26`) zostaje do fazy 2.

#### 2. Wyrocznia F2 i F3 w testach reguł gry

**File**: `tests/db/game-rules.test.ts`

**Intent**: Test, który utrwala dziurę (`:150-154`), dostaje wyrocznię `round_over`. Dochodzą przypadki niezmiennika z `02-invariant-aggregate-refactor.md` §5.3 i testy filtra oraz limitu kandydatów. Wszystkie dochodzą w istniejących opisach pliku (jeden host, warunki wstępne w `beforeAll`), bez nowych kont (limit rejestracji, `test-plan.md` §6). Wieczór gra się raz, krok po kroku, w `beforeAll` (`:84-134`), więc każda próba stoi tam, gdzie jej dzisiejszy skutek nie zmienia wyniku następnych kroków.

**Contract**: przypadki, nazwane po angielsku jak reszta pliku, z asercjami `toMatchObject` na `{ error, data }`, każdy w podanym miejscu:

- I2, runda 2 (`:98`): głos bez numeru, gdy runda głosuje, daje `{ error: null, data: { ok: false, reason: "round_over" } }`. To przeróbka `:150-154` z nową nazwą.
- I8 z I15, runda 2 zaraz po I2, przed `nextWhileVoting` (`:99`): odsłona z numerem 1 daje `round_over`. Stan sprawdza istniejący odczyt `hostRound2View` (`:102`, test `:166-171`): runda 2 nadal `voting`, `voted` bez zmian.
- Odsłona bez numeru, runda 3 po głosie Oli (`:115`), tuż przed seedem odsłony (`:116`), z odczytem stanu pomiędzy: `round_over`, a runda 3 nadal `voting` z `voted: ["Ola"]`. Dziś ta próba odsłania rundę 3 tak jak seed zaraz po niej, więc dalszy wieczór się nie zmienia.
- I9, po `skipLastQuestion` (`:126`): odsłona z numerem 4 (najnowsza runda, pominięta) daje `round_over`.
- I7 i I10, po `endGame` (`:132`): głos z numerem 4 i odsłona z numerem 4 dają `room_closed`.
- F3, filtr, runda 3 po odsłonie, przed `nextWithNoneLeft` (`:121`): `next_round(3, ["NA-CO-DZIEN-001", null])` daje `{ error: null, data: { ok: false, reason: "no_questions" } }`. Przypadek pozytywny zastępuje kandydatów `nextToLastQuestion` (`:123`): `["NA-CO-DZIEN-001", null, Q4]` daje `ok`, a istniejący odczyt `olaRound4View` pokazuje rundę 4 z `Q4`.
- F3, limit (kandydaci: 1001 razy `Q1`, czyli poprawny format i pytanie już zagrane):
  - `next_round`, w tym samym miejscu co filtr: `error.code === "22023"`, a odczyt stanu po nim to nadal runda 3 `revealed`. Limit siedzi w `open_next_round`, więc działa dopiero po sprawdzeniach `next_round` (`full_game_evening.sql:119-131`); przy rundzie w `voting` odpowiedź to `round_in_progress`.
  - `skip_round`, w opisie „the host ends the game while round 1 is voting” (`:318-326`), między `seedVote` a `endGame`, z odczytem stanu: `22023`, a runda 1 nadal `voting` z `voted: ["Ola"]`, bo transakcja cofa kasowanie urny. W wieczorze nie ma na to miejsca: przed `endGame` (`:132`) najnowsza runda jest już pominięta, a `skip_round` odpowiada wtedy `round_over`, zanim dojdzie do limitu.
- L4 i L5 (odsłona z bieżącym numerem, druga odsłona) tu nie dochodzą: są już w `round-rules.test.ts:255-294`, a faza 2 dodaje tam numer.

Dzisiejsze skutki prób:

- Na dzisiejszej bazie limit `next_round` odpowie `no_questions` i niczego nie zapisze. Limit `skip_round` pominie rundę 1, a `endGame` zamknie grę tak samo.
- Dziś głos I2 trafia do urny (`:98`), a po migracji już nie. W fazie 2 Ola dostaje zaraz po I2 głos z numerem 2, żeby `hostRound2View` (`voted: ["Ola"]`) i reszta rundy 2 zostały bez zmian. Oczekiwania wywodzimy z wyroczni, nie z dzisiejszego zachowania.

Oczekiwany wynik na dzisiejszej bazie:

- czerwone:
  - I2;
  - odsłona bez numeru: odpowiedź i odczyt stanu, bo dziś odsłania;
  - I8, I9 i odsłona w zamkniętej grze (`PGRST202`);
  - oba limity: `next_round` dostaje dziś `no_questions`, a `skip_round` dostaje `ok`, więc odczyt stanu pokazuje rundę pominiętą;
- zielone: oba przypadki filtra F3, głos w zamkniętej grze, odczyt stanu po I8 i po limicie `next_round` oraz wszystkie dotychczasowe testy pliku.

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- Push gałęzi i draft PR (za zgodą Karola); w CI joby `ci`, `smoke` i `e2e` zielone
- W CI job `db`: czerwone dokładnie przypadki wymienione wyżej jako czerwone, reszta Vitest i cały pgTAP zielone

#### Manual Verification:

- Karol przyjmuje do wiadomości czerwony `db` na draft PR jako dowód dziury (bez scalania)

**Implementation Note**: Po tej fazie zatrzymaj się i pokaż Karolowi listę czerwonych testów z CI, zanim ruszy faza 2.

---

## Faza 2: Migracja, Worker i ekran (F2 + F3)

### Overview

Jedna migracja wprowadza numer obowiązkowy w głosie i odsłonie, odmowę dla odsłony pominiętej rundy i limit kandydatów. Worker, ekran, pomocnicy testów, pgTAP, smoke i opisy w `test-plan.md` przechodzą na numery.

### Changes Required:

#### 1. Migracja

**File**: nowy plik z `npx supabase migration new round_number_required` (`supabase/migrations/*_round_number_required.sql`)

**Intent**: Wyrównać głos i odsłonę do reguły „ruch trafia w rundę, którą widzisz” i postawić limit listy kandydatów. Nagłówek migracji wymienia niezmienniki i kolejność wdrożenia, tak jak `full_game_evening.sql:4-21`.

**Contract**:

- **`public.cast_vote`**: `create or replace` z tą samą sygnaturą `(p_room_id uuid, p_target text, p_player_token text default null, p_round integer default null)` i pełnym ciałem z `full_game_evening.sql:255-392`.
  - Jedyna zmiana w logice: sprawdzenie numeru w tym samym miejscu co dziś (`:329`) brzmi `p_round is null or p_round <> v_number` i daje `round_over`.
  - Komentarz funkcji bez zdania o Workerze sprzed S-03.
  - Właściciel `postgres`, `revoke execute … from public, anon, authenticated`, `grant execute … to anon, authenticated`.
- **`public.reveal_round`**: `drop function public.reveal_round(uuid);` i `create function public.reveal_round(p_room_id uuid, p_round integer default null)` w tej samej migracji.
  - Kolejność sprawdzeń:
    1. blokada wiersza pokoju;
    2. nie host: `room_unknown`;
    3. zamknięty: `room_closed`;
    4. poczekalnia albo brak rundy: `no_round`;
    5. `p_round is null or p_round <> v_number`: `round_over`;
    6. `voting`: `private.finish_round`;
    7. `revealed`: `ok` bez zmian (D3);
    8. inna faza (`skipped`): `round_over`.
  - `security definer`, `set search_path = ''`, właściciel `postgres`, revoke od public, anon, authenticated, grant tylko dla `authenticated`.
  - `default null` zostaje celowo: wywołanie starego Workera bez numeru w oknie wdrożenia dostaje nazwaną odmowę zamiast `PGRST202`.
- **`private.open_next_round`**: `create or replace` z tą samą sygnaturą i ciałem z `full_game_evening.sql:38-73`.
  - Pierwsza instrukcja: przy `coalesce(cardinality(p_candidates), 0) > 1000` rzuca `raise exception 'too many candidates' using errcode = '22023'`. Komunikat bez wartości z listy.
  - Komentarz wyjaśnia, dlaczego wyjątek, a nie odmowa: zniekształcone wejście od klienta wołającego bazę wprost, jak zły token gościa. Gra wysyła najwyżej 216 id, a wyjątek cofa też kasowanie urny w `skip_round`.
  - Bez grantów, właściciel `postgres`, `revoke all … from public, anon, authenticated`.

#### 2. Worker

**Files**: `src/lib/rooms/json-route.ts`, `src/pages/api/rooms/[id]/vote.ts`, `src/pages/api/rooms/[id]/reveal.ts`, `src/lib/rooms/server.ts`

**Intent**: Każdy ruch rundy (głos, odsłona, następne, pominięcie) wymaga numeru pytania w treści żądania. Bez numeru Worker odpowiada 400 `invalid_body`, zanim zawoła bazę.

**Contract**:

- `bodyRound(body): number | undefined`: brak klucza `round`, treść, która nie jest obiektem, i zła wartość dają `undefined`. Komentarz bez „a vote takes either”. `next.ts` i `skip.ts` już sprawdzają `typeof round !== "number"`.
- `vote.ts`: `typeof round !== "number"` daje `invalid_body`. Komentarz `:21-23` bez ekranu sprzed S-03.
- `reveal.ts`: czyta treść przez `readJsonBody` i `bodyRound` w tym samym miejscu co `next.ts:23-26` (po sprawdzeniu id pokoju, przed sesją). Bez numeru: `invalid_body`. Potem `revealRound(supabase, roomId, round)`. Komentarz trasy mówi o numerze.
- `server.ts`:
  - `castVote(supabase, roomId, target, playerToken, round: number)` zawsze wysyła `p_round`;
  - `revealRound(supabase, roomId, round: number)` wysyła `{ p_room_id, p_round }`;
  - komentarze `:241-242` i nad `revealRound` bez okna S-03.

#### 3. Ekran

**Files**: `src/components/room/RoomScreen.tsx`, `src/components/room/RoundVoting.tsx`, `src/components/room/room-actions.ts`

**Intent**: „Odsłoń wynik” wysyła numer rundy, którą host ma na ekranie, tak jak głos i pominięcie.

**Contract**:

- `RoomScreen.tsx:125`: `reveal = (round: number) => act("reveal", { round })`;
- `RoundVoting`: `onReveal: (round: number) => Promise<ActionOutcome>`, przycisk woła `onReveal(round.number)`, komentarz `:40-41` wymienia też odsłonę;
- `room-actions.ts:6-7`: komentarz o akcjach z `{round}` obejmuje też odsłonę.

#### 4. Pomocnicy i testy bazy na numerach

**Files**: `tests/db/support/rounds.ts`, `tests/db/game-rules.test.ts`, `tests/db/round-rules.test.ts`, `tests/db/round-anonymity.test.ts`

**Intent**: Zwykłe wywołania głosu i odsłony w testach wysyłają numer rundy, tak jak robi to prawdziwy ekran. Bez numeru wołają już tylko probe, które sprawdzają odmowę.

**Contract**:

- `rounds.ts`:
  - `seedVote(…, round: number)` i `seedReveal(…, round: number)` mają obowiązkowy numer;
  - `castVote(…, round?)` i `revealRound(…, round?)` zostają z opcjonalnym numerem, tylko dla probe odmowy;
  - komentarz kontraktu (`:18-26`) opisuje nowe odpowiedzi: brak albo inny numer daje `round_over`, odsłona `skipped` daje `round_over`, a sygnatura to `reveal_round(p_room_id uuid, p_round integer default null)`.
- Miejsca bez numeru z tabeli w `research.md` (sekcja „F2: testy, smoke i dokumenty”) dostają numer rundy: `game-rules.test.ts:91-92, 116, 128, 273, 324`, `round-rules.test.ts:85-99, 204, 213, 255, 258, 259, 317, 323`, `round-anonymity.test.ts:100-102, 152, 183, 238, 284`.
  - Wyjątki: `round-rules.test.ts:87` (anon bez tokenu, `room_unknown`) i przypadki odmowy z fazy 1.
  - Oczekiwane wyniki się nie zmieniają.
  - `round-rules.test.ts:213` nadal oczekuje `42501` z nazwą `reveal_round` w komunikacie.
- `game-rules.test.ts`: zaraz po I2 dochodzi głos Oli z numerem 2 (faza 1, „Dzisiejsze skutki prób”).

#### 5. pgTAP

**File**: `supabase/tests/round_creator_view.test.sql`

**Intent**: Widok twórcy pilnuje, że `reveal_round` istnieje w jednej wersji, z `p_round` i z właściwymi uprawnieniami. Pomocnicy rundy grają z numerem.

**Contract**:

- `host_reveals`, `guest_votes` i `host_votes` (`:162-213`) przyjmują numer rundy i przekazują go jako `p_round`. Wszystkie wywołania (`:605-740`) podają numer. Komentarz `:193-194` jest poprawiony.
- Nowe `select is(pg_temp.function_facts('public.reveal_round(uuid, integer)'), 'security definer | owner postgres | search_path="" | execute: authenticated', …)`.
- Nowe „`reveal_round` exists in exactly one version, the one with p_round” na wzór `:586-596`.
- `plan(105)` zmienia się na `plan(107)`.

#### 6. Testy jednostkowe

**File**: `tests/unit/json-route.test.ts`

**Intent**: Testy `bodyRound` opisują nową regułę.

**Contract**: przypadek „gives null when $body has no round” (`:109-114`) zmienia się na `undefined`, a komentarz `:96-98` traci zdanie o głosie sprzed S-03.

#### 7. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Głosy kroków S-02 wysyłają numer. Trzy nowe kroki potwierdzają na produkcji odmowy F2, a czwarty pokazuje, że udana odsłona z numerem przechodzi przez Workera (kontrola pozytywna: gdyby trasa odmawiała zawsze, same odmowy też by przeszły).

**Contract**:

- `roundSteps`:
  - głosy Oli, drugiego gościa i hosta dostają `round: 1`;
  - zaraz po „host starts the game”, przed głosami, dochodzą dwa kroki: „a vote without a question number is refused” (`act("vote", { target: null }, olaJar)`, `{ status: 400, body: /^\{"error":"invalid_body"\}$/ }`) i „a reveal without a question number is refused” (`act("reveal", {}, hostJar)`, to samo 400).
- `gameSteps`: po „host opens the next question” dochodzi krok „a reveal sent from question 1 is refused at question 2” (`act("reveal", { round: 1 }, hostJar)`, `{ status: 409, body: /^\{"error":"round_over"\}$/ }`). Następny krok (Ola głosuje w pytaniu 2) potwierdza, że runda 2 dalej głosuje.
- `gameSteps`: po „question 3 is open after the skip”, przed „host ends the game”, dochodzi krok „host reveals question 3 with its number” (`act("reveal", { round: 3 }, hostJar)`, `{ status: 200, body: ACCEPTED }`). Koniec gry po odsłonie działa jak dziś.
- Komentarze nagłówka i `roundSteps` bez zdania o głosowaniu bez numeru.

#### 8. Plan testów

**File**: `context/foundation/test-plan.md`

**Intent**: Opisy pomocników, znanych dziur, widoku twórcy i smoke odpowiadają nowemu stanowi.

**Contract**:

- `:163`: `castVote(…, round?)` bez `round` służy tylko do probe odmowy, a seedy wymagają numeru;
- `:172`: dopisek, że F2 domknęła `deferred-review-fixes`;
- `:226`: `reveal_round` też w dokładnie jednej wersji (z `p_round`);
- `:287`: smoke głosuje z numerem i ma 3 kroki odmów F2 oraz krok udanej odsłony z numerem.

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`, a do tego `npx prettier --check context/foundation/test-plan.md`
- Push gałęzi (za zgodą); CI na PR zielone we wszystkich jobach: `ci`, `smoke` (z 4 nowymi krokami), `db` (Vitest z przypadkami z fazy 1 i pgTAP z `plan(107)`), `e2e`
- `git diff --stat origin/main -- supabase/migrations` pokazuje tylko jeden nowy plik migracji

#### Manual Verification:

- Karol czyta streszczenie migracji (co odmawia, w jakiej kolejności) i akceptuje przed `db push` w fazie 4

**Implementation Note**: Po tej fazie i zielonym CI zatrzymaj się na potwierdzenie Karola przed fazą 3.

---

## Faza 3: F5, pytania skończyły się w trakcie gry

### Overview

Trasa „Następne pytanie” zamienia `no_questions` z bazy na własny kod z właściwą radą. Start gry zachowuje swój tekst.

### Changes Required:

#### 1. Kod i tekst

**File**: `src/lib/rooms/errors.ts`

**Intent**: Nowa odmowa ma własny tekst, który mówi hostowi, co dalej.

**Contract**: `questions_ran_out` w `ROUND_REFUSALS` i w `MESSAGES` z tekstem „Pytań już nie ma. Możesz zakończyć grę.”.

#### 2. Trasa

**File**: `src/pages/api/rooms/[id]/next.ts`

**Intent**: Gdy `next_round` odpowie `no_questions`, trasa odpowiada `questions_ran_out`. Rada „Załóż nową grę” zamknęłaby trwającą grę.

**Contract**: wynik `{ ok: false, reason: "no_questions" }` z `nextRound` przechodzi do `actionAnswer` jako `{ ok: false, reason: "questions_ran_out" }`, czyli 409 i linia logu `outcome: "questions_ran_out"`. Komentarz trasy wyjaśnia, dlaczego.

#### 3. Komentarze o `no_questions`

**Files**: `src/lib/rooms/server.ts`, `src/components/room/RoundReveal.tsx`

**Intent**: Komentarze mówią, co host dostaje po zmianie.

**Contract**: komentarz `hostQuestionsLeft` (`server.ts:207-213`) i komentarz przy `afterRoundActions` (`RoundReveal.tsx:232`) mówią, że trasa odpowiada `questions_ran_out`.

#### 4. Test listy kodów

**File**: `tests/unit/room-errors.test.ts`

**Intent**: Ręczna lista planowanych kodów obejmuje nowy kod.

**Contract**: `questions_ran_out` w `PLANNED_ROUND_REFUSALS` (`:21-32`). Komentarz nad listą cytuje ten plan (`context/changes/deferred-review-fixes/plan.md`, Faza 3).

#### 5. Podgląd

**File**: `src/pages/dev/room-states.astro`

**Intent**: Karol widzi nowy tekst bez sieci, w stanie, w jakim host go zobaczy: po odświeżeniu, obok notki o skończonych pytaniach.

**Contract**: nowa sekcja obok `evening-next-error` (55) i `evening-no-questions` (56) z kolejnym wolnym numerem i własnym `idPrefix`. Treść: `revealed(…, QUESTION, false)` i `preview.host.error: roomErrorMessage("questions_ran_out")`.

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test` (w tym `room-errors.test.ts` z nowym kodem), `npm run build`
- Push gałęzi (za zgodą); CI na PR zielone we wszystkich jobach

#### Manual Verification:

- Karol ocenia zrzut nowego podglądu (strona „Co oceniasz”, laptop jako całe okno 1:1, telefon w prawdziwej wielkości)

**Implementation Note**: Po tej fazie zatrzymaj się na ocenę zrzutu przed fazą 4.

---

## Faza 4: Dokumenty i wdrożenie

### Overview

Notka o F2 w planie K1. Potem wdrożenie według zasady „baza, potem kod”: `db push`, od razu scalenie przez Karola, smoke na produkcji i ręczne sprawdzenie.

### Changes Required:

#### 1. Wyrocznia K1 w planie strażnika nazw RPC

**Files**: `context/changes/refactor-opportunities/plan.md`, `context/changes/refactor-opportunities/plan-brief.md`

**Intent**: Gdy przyjdzie punkt 6 kolejki, plan K1 ma wiedzieć, co zmieniła F2, i przeliczyć swoje liczby od stanu z tamtej chwili. Przed K1 wejdą jeszcze inne zmiany (S-08, S-06), które też dodadzą kroki smoke, więc liczenie teraz by się zestarzało.

**Contract**: jedna notka (cytat Markdown) na górze obu plików, pod tytułem: „Po `deferred-review-fixes`:”

- `reveal_round(p_room_id, p_round default null)`: brak numeru albo inny numer daje `round_over`, tak jak w `cast_vote`;
- przypadek „`castVote` bez numeru pytania” (`:130, :311`) odpada, bo Worker odmawia 400 przed bazą;
- krok smoke K1 (`:277`) wysyła numer pytania: `act("reveal", { round: <numer> }, hostJar)`;
- smoke ma nowe kroki tej zmiany, więc liczby przypadków i kroków smoke przelicz przy starcie K1, z `smoke.mjs` i z testu.

Treści, tytułów Progress ani kryteriów planu K1 nie zmieniamy (`progress-format.md`: tytuły są stałe).

#### 2. Wdrożenie

**Intent**: Migracja trafia na produkcję tuż przed Workerem, gdy nikt nie gra.

**Contract**: kroki z cyklu Karola (`C:\Users\karol\Desktop\10xdevs-gra.md`, krok 4–5):

1. PR z draft na gotowy, CI zielone;
2. `npx supabase db push --dry-run` (za zgodą) pokazuje tylko nową migrację;
3. `npx supabase db push` (za zgodą, nie z eduroam);
4. `npx supabase migration list` pokazuje ją po obu stronach;
5. Karol scala od razu (`! gh pr merge <n> --merge`);
6. po wdrożeniu Workers Build pełny smoke na produkcji (za zgodą): `BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke`.

### Success Criteria:

#### Automated Verification:

- `npx prettier --check context/changes/refactor-opportunities/plan.md context/changes/refactor-opportunities/plan-brief.md` przechodzi po notce w planie K1 (`npm run lint` nie czyta Markdownu)
- `npx supabase db push --dry-run` pokazuje dokładnie jedną nową migrację `*_round_number_required.sql`
- `npx supabase migration list` po `db push` pokazuje tę migrację lokalnie i zdalnie
- Smoke na produkcji zielony, z 4 nowymi krokami (3 odmowy F2 i udana odsłona)

#### Manual Verification:

- Karol potwierdza przed `db push`, że nikt nie gra
- Karol na telefonie i laptopie: gra z 3 graczami; w trakcie głosowania host klika „Odsłoń wynik” i wynik się odsłania; potem „Następne pytanie”, głos, „Pomiń pytanie”, odświeżenie karty i „Zakończ grę” działają jak wcześniej

**Implementation Note**: Każdy krok wdrożenia ze zgodą czeka na Karola. Scala wyłącznie Karol.

---

## Testing Strategy

### Unit Tests:

- `tests/unit/json-route.test.ts`: `bodyRound` daje `undefined` bez klucza `round`, dla treści, która nie jest obiektem, i dla złej wartości, a w pozostałych przypadkach liczbę.
- `tests/unit/room-errors.test.ts`: `questions_ran_out` na liście kodów, z własnym tekstem różnym od pozostałych.

### Integration Tests:

- Vitest bazy (`tests/db/game-rules.test.ts`): przypadki I2, I7, I8, I9, I10, I15, odsłona bez numeru oraz F3 (filtr i limit) z fazy 1. L4 i L5 pokrywa `round-rules.test.ts:255-294` z numerem z fazy 2. Wyrocznie pochodzą z `02-invariant-aggregate-refactor.md` §5.3 i z decyzji Karola, nie z implementacji.
- pgTAP: jedna wersja i uprawnienia `reveal_round(uuid, integer)`. Istniejąca runda i wieczór grane z numerem.
- Smoke (CI z lokalnym Supabase i produkcja): 3 kroki odmów F2 i udana odsłona z numerem.

### Manual Testing Steps:

1. `/dev/room-states`: nowy podgląd „Następne pytanie”, gdy pytania się skończyły (zrzut do oceny).
2. Produkcja, telefon i laptop: „Odsłoń wynik” w trakcie głosowania.
3. Produkcja: reszta ruchów gry bez zmian (następne, pominięcie, koniec, odświeżenie).

## Migration Notes

- Dane się nie zmieniają. Migracja podmienia trzy funkcje, a `reveal_round` dostaje nową sygnaturę.
- Wycofanie przed `db push`: revert w PR.
- Po `db push` domyślnie naprawiamy do przodu: nowy PR z poprawką, z zielonym CI.
- Sam `npx wrangler rollback` (domyślne lekarstwo z `deploy-plan.md:16`) stawia stary Worker na nowej bazie. „Odsłoń wynik” odpowiada wtedy „To pytanie już się zmieniło.”, ale gra działa dalej i wynik odsłania ostatni głos. To dopuszczalne tylko na chwilę, do naprawy.
- Samo cofnięcie bazy przy nowym Workerze psuje odsłonę mocniej: `reveal_round(uuid)` nie zna `p_round`, więc PostgREST odpowiada `PGRST202`, a Worker 5xx.
- Pełne wycofanie to oba kroki razem: nowa migracja przywracająca poprzednie ciała (kopie z `first_live_round.sql:721-769`, `full_game_evening.sql:38-73, 255-392`, z `drop` wersji z `p_round`) przez PR z zielonym CI, nigdy edycja wypchniętej migracji, i do tego `npx wrangler rollback` za zgodą.

## References

- Research: `context/changes/deferred-review-fixes/research.md`
- Źródła poprawek: `context/archive/2026-10-15-full-game-evening/follow-ups/review-fixes.md` (F2, F3, F5), `context/archive/2026-10-13-first-live-round/follow-ups/review-fixes.md` (F4, F6, F7)
- Niezmiennik i przypadki testowe: `context/domain/02-invariant-aggregate-refactor.md` §3, §5.3
- Wzór numeru obowiązkowego: `supabase/migrations/20261015122252_full_game_evening.sql:119-122, 181-184`
- Kolejność wdrożenia z migracją: `context/archive/2026-10-15-full-game-evening/plan.md:82-83`
- Zasady testów: `context/foundation/test-plan.md` §6

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Testy przed migracją

#### Automated

- [x] 1.1 Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — 04192d1
- [x] 1.2 Push gałęzi i draft PR (za zgodą Karola); w CI joby `ci`, `smoke` i `e2e` zielone — 04192d1
- [x] 1.3 W CI job `db`: czerwone dokładnie przypadki wymienione wyżej jako czerwone, reszta Vitest i cały pgTAP zielone — 04192d1

#### Manual

- [x] 1.4 Karol przyjmuje do wiadomości czerwony `db` na draft PR jako dowód dziury (bez scalania) — 04192d1

### Phase 2: Migracja, Worker i ekran (F2 + F3)

#### Automated

- [x] 2.1 Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`, a do tego `npx prettier --check context/foundation/test-plan.md` — d75f4f8
- [x] 2.2 Push gałęzi (za zgodą); CI na PR zielone we wszystkich jobach: `ci`, `smoke` (z 4 nowymi krokami), `db` (Vitest z przypadkami z fazy 1 i pgTAP z `plan(107)`), `e2e` — d75f4f8
- [x] 2.3 `git diff --stat origin/main -- supabase/migrations` pokazuje tylko jeden nowy plik migracji — d75f4f8

#### Manual

- [x] 2.4 Karol czyta streszczenie migracji (co odmawia, w jakiej kolejności) i akceptuje przed `db push` w fazie 4 — d75f4f8

### Phase 3: F5, pytania skończyły się w trakcie gry

#### Automated

- [x] 3.1 Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test` (w tym `room-errors.test.ts` z nowym kodem), `npm run build`
- [ ] 3.2 Push gałęzi (za zgodą); CI na PR zielone we wszystkich jobach

#### Manual

- [x] 3.3 Karol ocenia zrzut nowego podglądu (strona „Co oceniasz”, laptop jako całe okno 1:1, telefon w prawdziwej wielkości)

### Phase 4: Dokumenty i wdrożenie

#### Automated

- [ ] 4.1 `npx prettier --check context/changes/refactor-opportunities/plan.md context/changes/refactor-opportunities/plan-brief.md` przechodzi po notce w planie K1 (`npm run lint` nie czyta Markdownu)
- [ ] 4.2 `npx supabase db push --dry-run` pokazuje dokładnie jedną nową migrację `*_round_number_required.sql`
- [ ] 4.3 `npx supabase migration list` po `db push` pokazuje tę migrację lokalnie i zdalnie
- [ ] 4.4 Smoke na produkcji zielony, z 4 nowymi krokami (3 odmowy F2 i udana odsłona)

#### Manual

- [ ] 4.5 Karol potwierdza przed `db push`, że nikt nie gra
- [ ] 4.6 Karol na telefonie i laptopie: gra z 3 graczami; w trakcie głosowania host klika „Odsłoń wynik” i wynik się odsłania; potem „Następne pytanie”, głos, „Pomiń pytanie”, odświeżenie karty i „Zakończ grę” działają jak wcześniej
