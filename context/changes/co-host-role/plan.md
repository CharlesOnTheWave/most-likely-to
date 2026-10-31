# Współhost (S-07): plan implementacji

## Overview

Host nadaje i odbiera rolę współhosta graczowi w pokoju przyciskiem przy jego nicku. Współhost prowadzi grę jak host: zaczyna grę, odsłania wynik, przechodzi do następnego pytania, pomija pytanie, wpuszcza i odrzuca spóźnionych i kończy grę. Wieczór trwa dalej, gdy host wyjdzie. S-07 z roadmapy (`context/foundation/roadmap.md:193-202`; PRD FR-003, FR-006, FR-020, „Access Control” `context/foundation/prd.md:157-174`). Na S-07 czekają S-09 (usunięcie gracza, nowy link) i S-10 (propozycje pytań).

## Current State Analysis

Szczegóły i kotwice: `context/changes/co-host-role/research.md`.

- Każda funkcja ruchu prowadzącego blokuje wiersz pokoju i odrzuca każdego, kto nie jest `rooms.host_id` (`v_user <> v_host → room_unknown`). Wykonać ją może tylko rola `authenticated`, a gość nie ma konta. Najnowsze definicje: `start_game`, `next_round`, `skip_round` w `supabase/migrations/20261026074427_question_play_data.sql`, `reveal_round` w `20261020205751_round_number_required.sql`, `end_game` w `20261015122252_full_game_evening.sql`, `admit_latecomer` i `reject_latecomer` w `20261022132240_latecomer_admission.sql`, a `room_lobby` w `20261025122918_game_summary.sql`.
- Trasy ruchów (`src/pages/api/rooms/[id]/{start,reveal,next,skip,end,admit,reject}.ts`) czytają tylko sesję. Wzór „sesja albo ciasteczko gracza, rolę rozstrzyga baza” jest już w `vote.ts:39-47`, `react.ts` i `emote.ts`.
- Start, następne pytanie i pominięcie biorą kategorie pokoju przez RLS hosta (`hostRoomCategories`, `src/lib/rooms/server.ts:512-532`; `next.ts:36-38`). Liczba pozostałych pytań (`hostQuestionsLeft`, `server.ts:295-303`) liczy się tylko dla `role === "host"` i z `question_list`, którą dostaje tylko host. Gość nie widzi wiersza `rooms`.
- `room_lobby` zna role `host` i `guest`, gracza jako `{nick, host}`, a `requests` dostaje tylko host. Parser Workera odrzuca każdą inną rolę (`src/lib/rooms/shared.ts:302`) i kopiuje tylko klucze z kontraktu (`parsePlayers` `:179-189`, `parseRoomState` `:296-318`).
- Kontrolki prowadzącego na ekranach (`HostActions`, „Zacznij grę”, `JoinRequests`, przyciski pominiętego pytania, szeroka kolumna w `room-frame.ts:36`) pokazują się dla `view.role === "host"`.
- Gdy host wyjdzie, gra staje. Obecności nikt nie wykrywa, a host dalej jest wśród uprawnionych do głosu, więc runda czeka na „Odsłoń wynik”. Po odsłonie nikt nie ma przycisków.

## Desired End State

- Host widzi na liście „Gracze” (w poczekalni, a w głosowaniu po własnym głosie) przy nicku każdego gościa przycisk nadania albo odebrania roli. Przy nicku współhosta wszyscy widzą znaczek „współhost”. Nadawać i odbierać rolę może tylko host. Współhostem może zostać każdy gość, także wpuszczony spóźniony, i współhostów może być dowolnie wielu.
- Współhost ma te same kontrolki prowadzącego co host: „Zacznij grę”, pasek i podpowiedź prowadzącego w głosowaniu, „Odsłoń wynik”, „Następne pytanie”, „Pomiń pytanie”, „Zakończ grę” (z tym samym „Na pewno?”) i prośby spóźnionych z „Wpuść” i „Odrzuć”. Nie widzi listy pytań gry, linku dla graczy ani „Nowej gry” i nie nadaje roli.
- Nadanie i odebranie roli dociera do ekranów bez przeładowania (dzwonek i 15 s odpytywania). Współhost słyszy i widzi ogłoszenie w regionie na żywo. Ruch po odebraniu roli dostaje odmowę z własnym tekstem (`not_leader`).
- Teksty mówią „prowadzący” tam, gdzie ruch może wykonać host albo współhost: „Prowadzący pominął…”, „Prowadzący wpuścił cię…”, „Czekasz, aż prowadzący cię wpuści”, „Czekamy, aż prowadzący zacznie.”.
- Host, który wyszedł, dalej jest uprawniony do głosu, więc rundę odsłania współhost („Odsłoń wynik”). To zostaje do S-09.
- Sprawdzenie: CI zielone (`ci`, `smoke`, `db` z pgTAP, `e2e`), smoke na produkcji, przeklikanie Karola z ekipą.

### Key Discoveries:

- Domyślny `p_player_token text default null` na końcu listy argumentów zachowuje wywołania starego Workera (nazwane argumenty PostgREST). Zmiana listy argumentów wymaga `drop function` + `create function` w tej samej migracji, bo `create or replace` zostawiłby drugą wersję (wzór `full_game_evening.sql:248`, `round_number_required.sql:231`), a pgTAP przypina dokładnie jedną.
- Wzór sprawdzenia gościa do powtórzenia w kontroli prowadzącego: `cast_vote` (`round_number_required.sql:110-135`) i `react_round` (`question_play_data.sql:530-560`). Token spoza `^[A-Za-z0-9_-]{43}$` daje 22023. Najpierw gałąź hosta po `auth.uid()`, potem gracz przez `player_secrets.token_hash = sha256(token)` w tym pokoju.
- `questionsLeft` (`src/lib/rounds/draw.ts:88`) potrzebuje tylko rozmiaru puli i dwóch liczb listy (`base_count`, liczba wpisów), a nie treści listy. Współhostowi wystarczą więc kategorie i te dwie liczby.
- Host ma dziś `select, insert` na `players` przez RLS, bez `update` (`20261007122858_room_lobby.sql:61`). Kolumna z `check (not cohost or user_id is null)` i brak `update` sprawiają, że rolę zmienia tylko funkcja.
- Testy bazy przypinają dokładne zbiory kluczy `LOBBY_KEYS` i `PLAYER_KEYS` (`tests/db/support/rounds.ts:124-125`), a `round-rules.test.ts:231-243` i `latecomers.test.ts:396-402` oczekują dziś `42501` dla `anon` na ruchach prowadzącego.
- CI `smoke` biegnie na lokalnym Supabase z migracjami gałęzi (`.github/workflows/ci.yml`), więc PR jest zielony przed `db push`. Smoke na produkcji dopiero po wgraniu bazy.

## What We're NOT Doing

- Wykrywanie, że host wyszedł, samoczynne przekazanie roli, wyłączenie nieobecnego hosta z głosowania (S-09).
- Ochrona wieczoru współhosta przed „Nową grą” hosta. `create_room` zamyka otwarty pokój hosta (`first_live_round.sql:262-279`, przy gościach z potwierdzeniem), także ten, który prowadzi współhost. Zostaje świadomie, do S-09 albo później.
- Usuwanie gracza i nowy link (S-09), propozycje pytań (S-10), wybór koloru przez gracza (następny wycinek).
- Nowa wartość `role` w stanie pokoju: zostaje `host`/`guest`, prowadzenie niesie osobny klucz.
- Dla współhosta: lista pytań gry (S-06), link dla graczy, „Nowa gra”, nadawanie roli, panel hosta.
- Pełny agregat „Gra” z `context/domain/02-invariant-aggregate-refactor.md`. Z decyzji 7 robimy tylko wspólną funkcję kontroli prowadzącego.
- Zmiany w `cast_vote`, `react_round`, `join_room`, `request_join`, `create_room`, funkcjach listy pytań, `private.drop_round_state` i `close_stale_games`.
- Powiadomienia poza ekranem gry, zmiany w `AppHeader.astro`.
- Sprawdzanie puli pytań w bazie. Pulę (kategorie, 18+ tylko z wybranych, FR-005) sprawdza tylko Worker (`poolFrom`, `src/lib/rounds/draw.ts:26-33`), a `start_game`, `next_round` i `skip_round` sprawdzają tylko format id. Po grancie `anon` współhost może ją obejść, wołając RPC sam z tokenem z ciasteczka (dziś może to tylko host we własnym pokoju). Znana dziura F1 z `reviews/plan-review.md`, przypięta testem `test.fails` w `cohost.test.ts`.

## Implementation Approach

- **Faza 1:** migracja i jej testy. `players.cohost`, `private.leader_refusal`, siedem funkcji ruchu z opcjonalnym tokenem i grantem `anon`, `public.set_cohost`, `room_lobby` z `cohost`, `requests` i `leader_draw` dla prowadzących. Stary Worker działa dalej. Testy bazy i pgTAP idą na draft PR, z próbnym alarmem. Dokumenty z nazwami (słownik, AGENTS.md, PRD) idą razem z bazą.
- **Faza 2:** Worker. Trasy ruchów przyjmują sesję albo ciasteczko, losowanie i pozostałe pytania biorą dane z `leader_draw`, `RoomView.leader`, nowa trasa `cohost`, odmowy `not_leader` i `player_unknown`, testy jednostkowe i krok smoke.
- **Faza 3:** ekrany. Najpierw warianty przycisku roli i znaczka na zrzutach, Karol wybiera. Potem kontrolki według `view.leader`, teksty „prowadzący”, ogłoszenie roli, podglądy, E2E i follow-up F4 z S-08.
- **Faza 4:** wdrożenie według `context/deployment/deploy-plan.md`: zielone CI, `db push`, scalenie przez Karola, smoke na produkcji, przeklikanie.

Jedna gałąź `co-host-role`, jeden PR. Zmiany w `supabase/migrations/`, `src/lib/rooms/`, `src/pages/api/rooms/`, `src/pages/j/`, `src/pages/r/` i `tests/` idą tylko przez PR z zielonym `db` (AGENTS.md).

## Critical Implementation Details

- **Kopiuj najnowsze definicje.** Każdą z siedmiu funkcji i `room_lobby` odtwórz z ostatniej migracji, która ją definiuje (lista w Current State Analysis; sprawdź jeszcze raz `grep -ln "function public.<name>(" supabase/migrations/*.sql`). Zmień tylko kontrolę hosta na `private.leader_refusal` (w `room_lobby`: role, prośby i `leader_draw`). Starsza kopia cofnęłaby po cichu F2, kciuki S-11 albo sumy S-15. Komentarze w nowej migracji mówią „prowadzący” (z wpisanej migracji `question_play_data.sql:25-27` nie poprawiamy).
- **Kolejność w funkcji ruchu:** najpierw blokada wiersza pokoju (`for update`), potem `leader_refusal`. Flaga współhosta jest czytana bez blokowania wiersza gracza (`first_live_round.sql:14-16`). `set_cohost` też blokuje wiersz pokoju, więc nadanie, odebranie i ruch idą po kolei: ruch po odebraniu roli dostaje `not_leader`.
- **Kolejność wdrożenia:** `db push` przed scaleniem kodu. Nowy parser wymaga `players[].cohost` i `leader_draw`, których stara baza nie zwraca. Stary Worker ich nie skopiuje, więc migracja wchodzi bezpiecznie przed kodem.
- **`leader_draw` nigdy do przeglądarki.** `roomView` go odcina tak jak `question_list` i `game_totals`, a do przeglądarki idzie tylko `leader: boolean` (lekcja „Pytania gry tylko po stronie serwera”, `context/foundation/lessons.md:12-17`). Znaczki „host” i „ty” liczą się dalej z `players[].host` i `me`, nigdy z `leader`.

## Faza 1: Baza

### Overview

Rola współhosta w bazie, siedem ruchów prowadzącego otwartych dla współhosta z tokenem, nadawanie i odbieranie roli oraz stan pokoju dla prowadzących. Testy bazy, pgTAP i próbny alarm na draft PR.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/<timestamp>_co_host_role.sql` (przez `npx supabase migration new co_host_role`)

**Intent**: Dać współhostowi, który nie ma konta, te same ruchy co hostowi, z decyzją w bazie, i zostawić stary Worker działający do wdrożenia kodu.

**Contract**:

- `public.players.cohost boolean not null default false` z `check (not cohost or user_id is null)`. Bez nowych grantów i polityk.
- `private.leader_refusal(p_room_id uuid, p_host uuid, p_player_token text) returns text`. Zwraca `null` dla prowadzącego (host po `auth.uid() = p_host` albo gracz pokoju z `cohost` po `sha256(token)` w `player_secrets`), `'not_leader'` dla gracza pokoju bez roli, `'room_unknown'` dla reszty. Token w złym formacie daje 22023 jak w `cast_vote`. `set search_path = ''`, bez grantów, właściciel `postgres`, wołana po blokadzie wiersza pokoju.
- `start_game`, `reveal_round`, `next_round`, `skip_round`, `end_game`, `admit_latecomer`, `reject_latecomer`: `drop function` + `create function` z dotychczasowymi argumentami i `p_player_token text default null` na końcu. W miejscu warunku `v_user <> v_host` odmowa z `leader_refusal`. `revoke execute … from public, anon, authenticated`, potem `grant execute … to anon, authenticated`. Wszystkie kontrole zostają w środku (publiczny punkt wejścia).
- `public.set_cohost(p_room_id uuid, p_nick text, p_cohost boolean) returns jsonb`, `security definer`, grant tylko `authenticated`. Tylko host pokoju, blokada wiersza pokoju. Odpowiedź `{ok: true}` albo odmowy: `room_unknown` (nie host), `room_closed`, `player_unknown` (nick spoza pokoju albo nick hosta; nick dopasowany po `nick_key` jak w `admit_latecomer`). Ta sama wartość drugi raz to `ok`. Działa w poczekalni i w trakcie gry.
- `room_lobby` (`create or replace`, lista argumentów bez zmian): gracz to `{nick, host, cohost}`. `requests` dostaje każdy prowadzący, a nie-prowadzący `[]`. Nowy klucz `leader_draw`: prowadzącemu `{categories: text[], adult_categories: text[], list_entries: integer, list_base_count: integer}` (liczba wpisów listy niewykreślonych i `base_count` listy, oba 0 bez listy), reszcie `null`. `question_list` dalej tylko host, `role` bez nowej wartości.

#### 2. Testy bazy

**File**: `tests/db/cohost.test.ts` (nowy), `tests/db/support/rounds.ts`, `tests/db/round-rules.test.ts`, `tests/db/latecomers.test.ts`

**Intent**: Dowieść z wyroczni PRD i decyzji Karola, kto prowadzi, kto nie i co widzi w stanie pokoju. Przed pisaniem `context/foundation/test-plan.md` §6.

**Contract**:

- `cohost.test.ts`, jeden host na plik, pokój z Olą, Kubą i wpuszczonym spóźnionym:
  - kontrola pozytywna: `set_cohost` daje dokładnie `{ok: true}`, a stan pokoju Oli ma u niej `cohost: true`, `leader_draw` z kategoriami pokoju i `requests`;
  - Ola jako `anon` z tokenem wykonuje start, odsłonę, następne pytanie, pominięcie, wpuszczenie, odrzucenie i koniec, każdy z dokładnie `{ok: true}`;
  - Kuba bez roli na każdym ruchu dostaje `not_leader`, `anon` bez tokenu i token z innego pokoju `room_unknown`, a token w złym formacie 22023;
  - po odebraniu roli Ola dostaje `not_leader`;
  - odmowy `set_cohost`: `anon` 42501, nick hosta i nieznany nick `player_unknown`, zamknięty pokój `room_closed` (drugi pokój przez `seedRoom(host, { confirmClose: true })`, jak `reactions.test.ts:121-127`); ta sama wartość drugi raz to `ok`;
  - współhostem może zostać wpuszczony spóźniony;
  - Kuba ma `leader_draw: null` i `requests: []`, a Ola `question_list: null`;
  - host nie zmieni `cohost` przez REST (brak `update`, wstawienie z `cohost: true` odrzucone);
  - `test.fails` „znana dziura F1 → pula w bazie”: `next_round` Oli z id pytania 18+ spoza wyboru hosta oczekuje odmowy (wyrocznia FR-005; warunki wstępne w `beforeAll`, `test-plan.md` §6.2). Zmiany naprawczej nie ma jeszcze w roadmapie.
- `support/rounds.ts`: pomocniki ruchów przyjmują opcjonalny token gracza, nowy `setCohost`, a `LOBBY_KEYS` + `leader_draw` i `PLAYER_KEYS` + `cohost`.
- `round-rules.test.ts:231-243`, `latecomers.test.ts:396-402`: zamiast `42501` dla `anon` odmowy z nowej reguły (`room_unknown` bez tokenu, `not_leader` dla gościa bez roli).
- `round-rules.test.ts`: `set_cohost` obcego hosta (`hostB`, `:63`) w pokoju `hostA` daje `room_unknown`. Tu, a nie w `cohost.test.ts`, bo ten plik ma już dwa konta (`test-plan.md` §6.2: jeden host na plik).
- Follow-up F1 z S-08 (`context/archive/2026-10-22-latecomer-admission/follow-ups/review-fixes.md`) w `latecomers.test.ts`: `request_join` z tokenem w złym formacie daje 22023, a sześć równoległych próśb daje dokładnie 5 × `ok` i 1 × `requests_full`.

#### 3. Widok twórcy (pgTAP)

**File**: `supabase/tests/round_creator_view.test.sql`

**Intent**: Przypiąć to, czego klucz publishable nie widzi: granty, wersje funkcji, kolumnę i kontrolę.

**Contract**: granty `anon, authenticated` dla siedmiu funkcji (zamiast samego `authenticated`, `:871-896`, `:967-972`), dokładne nowe sygnatury (`:903-925`, `:979-998`, `:1032-1062`). `set_cohost` tylko `authenticated`. `private.leader_refusal` bez grantów, z `search_path=''` i właścicielem `postgres`. Kolumna `players.cohost` z `check`. `plan(N)` zaktualizowany.

#### 4. Dokumenty z nazwami

**File**: `context/domain/glossary.md`, `AGENTS.md`, `context/foundation/prd.md`, `context/foundation/test-plan.md`

**Intent**: Nazwy z kodu w słowniku przed kodem Workera i ekranów, a reguły zgodne z decyzjami Karola.

**Contract**:

- słownik:
  - „prowadzący” = host albo współhost (`leader`, `leader_refusal`, `leader_draw`, `RoomView.leader`);
  - „współhost” (`players.cohost`, `set_cohost`);
  - „prośba o wejście”: wpuszcza i odrzuca prowadzący, `requests` dla prowadzących.
- AGENTS.md, Hard Rules, zdanie o kciukach: „until the host's next move” zmienia się na „until the leader's (host's or co-host's) next move”.
- PRD `:161`: współhost odsłania, przechodzi dalej i kończy grę (decyzja 3), może ich być wielu (decyzja 1), a link dla graczy widzi tylko host (decyzja 4). Tabela `:166-174` zgodna z tym.
- `test-plan.md` §6.2: nowy plik `cohost.test.ts` na liście wzorów, rejestracje 16 na przebieg (`cohost` 1), a po próbnym alarmie wpis o nim w punkcie „Break-check”.

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- `npx prettier --check` dla nowych i zmienionych plików `.md` przechodzi
- Draft PR do `main` (push za zgodą Karola): CI zielone we wszystkich jobach, w `db` nowe testy `cohost.test.ts` i nowe asercje pgTAP przechodzą
- Próbny alarm: tymczasowy commit zapala tylko przewidziane testy; po `git revert` CI zielone

#### Manual Verification:

- Karol czyta streszczenie migracji (kolumna, kontrola prowadzącego, 7 ruchów, nadawanie roli, co widzi współhost) i je akceptuje

**Implementation Note**: Próbny alarm według `test-plan.md` §6.2 „Break-check”. Jeden tymczasowy commit z dwoma uszkodzeniami, jak w S-08, bo każde zapala inne testy: (a) `leader_refusal` przepuszcza każdego gracza pokoju, (b) `room_lobby` daje `leader_draw` każdemu graczowi. Opis commita wymienia z nazwy każdy test, który ma zaświecić. Tymczasowej migracji nigdy nie wgrywamy, a na końcu `git diff main...HEAD -- supabase/migrations` pokazuje tylko migrację zmiany. Po fazie pauza na akceptację Karola.

---

## Faza 2: Serwer gry

### Overview

Trasy ruchów przyjmują hosta albo gościa z ciasteczkiem, a rolę rozstrzyga baza. Losowanie i pozostałe pytania biorą dane z `leader_draw`, widok pokoju dostaje `leader`, dochodzą trasa nadania roli, odmowy i krok smoke.

### Changes Required:

#### 1. Typy i parsery stanu

**File**: `src/lib/rooms/shared.ts`; literały tych typów: `src/pages/dev/room-states.astro`, `src/pages/dev/room-window.astro`, `tests/unit/announce.test.ts`, `tests/unit/chart.test.ts`, fikstury `tests/unit/room-state.test.ts`

**Intent**: Stan pokoju niesie rolę współhosta i dane losowania prowadzącego, a widok przeglądarki dostaje tylko to, czy osoba prowadzi.

**Contract**: `LobbyPlayer.cohost: boolean`. `LobbyState.leader_draw: LeaderDraw | null`, tylko w Workerze, z parserem wymagającym klucza. `RoomView` pomija `leader_draw` (w `Omit` obok `question_list` i `game_totals`) i ma `leader: boolean`. `parseRoomView` wymaga `leader`, a `players[].cohost` przechodzi przez oba parsery. `role` bez zmian. Typowane literały (`tsconfig.json` obejmuje `**/*`) i fikstury testów dostają już w tej fazie domyślne pola (`cohost: false`, `leader` = `role === "host"`), żeby przeszły `npx astro check` i `npm test`. Nowe stany współhosta dochodzą w fazie 3.

#### 2. Funkcje bazy w Workerze

**File**: `src/lib/rooms/server.ts`, `src/lib/rounds/draw.ts`

**Intent**: Jedna droga dla hosta i współhosta. Kategorie i pozostałe pytania biorą się z `room_lobby`, a nie z RLS hosta.

**Contract**:

- opakowania `startGame`, `revealRound`, `nextRound`, `skipRound`, `endGame`, `admitLatecomer`, `rejectLatecomer` przyjmują `playerToken: string | null` i wysyłają `p_player_token`;
- nowe `setCohost(supabase, roomId, nick, cohost)`;
- funkcja czytająca `leader_draw` przez `room_lobby` dla tras start, next i skip. `null` przy graczu pokoju daje `not_leader`, a brak pokoju `OUTSIDE_ROOM`;
- `roomView` odcina `leader_draw` i ustawia `leader` (host albo gracz `me` z `cohost`);
- pozostałe pytania liczy funkcja synchroniczna z `leader_draw` w miejsce `hostQuestionsLeft`. `questionsLeft` w `draw.ts` bierze dwie liczby listy zamiast całej listy;
- `hostRoomCategories` znika, jeśli nic go już nie woła (sprawdź `grep`, także `src/pages/r/[id].astro` i `/dev`).

#### 3. Trasy

**File**: `src/pages/api/rooms/[id]/{start,reveal,next,skip,end,admit,reject}.ts`, nowe `src/pages/api/rooms/[id]/cohost.ts`, trasa stanu pokoju i `src/pages/r/[id].astro`

**Intent**: Ruch prowadzącego może przyjść z sesji hosta albo z ciasteczka gracza. Host nadaje i odbiera rolę jedną trasą.

**Contract**:

- siedem tras jak `vote.ts:39-47`: ciasteczko w innym formacie liczy się jako brak, a bez sesji i bez ciasteczka odpowiedź to `OUTSIDE_ROOM`;
- `POST /api/rooms/[id]/cohost`: tylko sesja, ciało `{nick: string, cohost: boolean}` (`bodyNick` jak w `admit.ts`, `invalid_body` na inne), odpowiedź `{ok: true}` albo `{error: code}`, dzwonek po sukcesie;
- trasa stanu pokoju i strona `/r/[id]` liczą pozostałe pytania nową funkcją.

#### 4. Odmowy

**File**: `src/lib/rooms/errors.ts`

**Intent**: Odebrana rola i znikający gracz mają własny tekst zamiast „Coś poszło nie tak”.

**Contract**: `not_leader` i `player_unknown` w `ROUND_REFUSALS` (409) i `MESSAGES`. Propozycje tekstów: `not_leader` „Nie jesteś już współhostem.”, `player_unknown` „Tego gracza nie ma w pokoju.”.

#### 5. Testy jednostkowe i smoke

**File**: `tests/unit/room-state.test.ts`, `tests/unit/room-rpc-gate.test.ts`, `tests/unit/room-errors.test.ts`, testy `draw` i `json-route` (jeśli przypinają zmienione kształty), `scripts/smoke.mjs`

**Intent**: Przypiąć nowy kontrakt i przejść ruch współhosta przez prawdziwy Worker.

**Contract**:

- `room-state`:
  - `cohost` przechodzi;
  - `leader` jest prawdą dla hosta i współhosta, a fałszem dla gościa bez roli;
  - widok nigdy nie ma `leader_draw`;
  - parser odrzuca brak `leader_draw` i brak `cohost`.
- `room-rpc-gate`: zmienione wiersze siedmiu funkcji i nowy `set_cohost` z `plik:linia` nowej migracji, plus przypadek akcji z tokenem gracza (`test-plan.md` §6.1).
- `room-errors`: dwa nowe kody mają tekst inny niż ogólny.
- smoke:
  - host nadaje rolę Oli;
  - Ola (ciasteczko) wykonuje jeden ruch prowadzącego i dostaje 200;
  - host odbiera rolę;
  - następny ruch Oli dostaje 409 `not_leader`.

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- CI na PR zielone we wszystkich jobach, w tym nowe kroki smoke współhosta

#### Manual Verification:

- Nowa trasa `cohost` i jeden ruch współhosta przeklikane raz na serwerze dev przez API (lessons.md, wpis 3)

**Implementation Note**: Faza 2 bez zmian ekranów: kontrolki dalej według `role`, więc współhost ma prawo w Workerze, ale jeszcze nie ma przycisków. Po fazie pauza na akceptację Karola.

---

## Faza 3: Ekrany

### Overview

Najpierw warianty wyglądu do wyboru Karola, potem kontrolki prowadzącego u współhosta, teksty „prowadzący”, ogłoszenie roli, podglądy i E2E.

### Changes Required:

#### 1. Warianty do wyboru

**File**: `/dev/room-states` (tymczasowe stany wariantów), strona HTML z „Co oceniasz” w scratchpadzie

**Intent**: Wygląd przycisku roli i znaczka „współhost” to decyzja Karola (pamięć: wygląd ekranu = decyzja Karola).

**Contract**:

- 2–3 warianty przycisku nadania i odebrania roli przy nicku na liście „Gracze”, w poczekalni i w głosowaniu po głosie hosta, ze znaczkiem „współhost”;
- zrzuty: laptop jako całe okno gry 1:1, telefon w prawdziwej wielkości, headless Chrome przez Playwright z `channel: "chrome"`, ukryty `astro-dev-toolbar`;
- strona otwarta w Chrome Karola, a wybór zapisany w Progress (3.x);
- komponenty tylko z `src/components/ui` (brak menu rozwijanego, więc przycisk, a nowy komponent przez `npx shadcn@latest add`) i kolory tylko z tokenów.

#### 2. Kontrolki według prowadzącego

**File**: `src/components/room/{RoomLobby,RoundVoting,RoundReveal,RoundSkipped,RoomScreen,JoinRequests}.tsx`, `src/components/room/room-frame.ts`

**Intent**: Współhost dostaje kontrolki prowadzącego, a host zachowuje swoje rzeczy tylko dla siebie.

**Contract**:

- według `view.leader`: „Zacznij grę”, pasek i podpowiedź prowadzącego w głosowaniu, szeroka kolumna, pasek po odsłonie, przyciski pominiętego pytania, `JoinRequests`;
- tylko host (`role === "host"`): lista pytań gry, link dla graczy, „Nowa gra”, przycisk roli (wybrany wariant);
- znaczek „współhost” widzą wszyscy;
- znaczki „host” i „ty” bez zmian.

#### 3. Teksty i ogłoszenie roli

**File**: `src/components/room/announce.ts`, `RoomScreen.tsx`, `RoundVoting.tsx`, `JoinWaiting.tsx`, `RoomLobby.tsx`

**Intent**: Słowa pasują do tego, że ruch może wykonać host albo współhost, a współhost dowiaduje się o roli bez patrzenia na listę.

**Contract**:

- „Prowadzący pominął…” (`announce.ts:20,24`, `RoomScreen.tsx:303`), „Prowadzący wpuścił cię…” (`RoundVoting.tsx:219`), „Czekasz, aż prowadzący cię wpuści” (`JoinWaiting.tsx:224`), „Czekamy, aż prowadzący zacznie.” (`RoomLobby.tsx:114-117`);
- ogłoszenie w regionie na żywo, gdy `leader` współhosta zmienia się między odświeżeniami, osobno od `announcementKey`. Propozycje: „Jesteś współhostem: możesz prowadzić grę.” i „Nie jesteś już współhostem.”, do akceptacji Karola na zrzutach.

#### 4. Follow-up F4 z S-08

**File**: `src/components/room/JoinRequests.tsx`

**Intent**: Wiersz prośby nie zostaje wyszarzony, gdy odrzucony poprosi jeszcze raz pod tym samym nickiem przed odświeżeniem prowadzącego.

**Contract**: stan „czeka” wiersza zdjęty po odświeżonej liście, która dalej ma jego nick (licznik odświeżeń jako prop albo część klucza). Przypadek w podglądzie albo w E2E (`review-fixes.md`, F4).

#### 5. Podglądy

**File**: `src/pages/dev/room-states.astro`, `src/pages/dev/room-window.astro`

**Intent**: Każdy nowy stan ma podgląd (AGENTS.md, UI).

**Contract**:

- `/dev/room-states`:
  - współhost w poczekalni, w głosowaniu przed i po głosie, po odsłonie, przy pominiętym pytaniu i z prośbami;
  - host z przyciskiem roli i znaczkiem;
  - stan z ogłoszeniem roli.
- `/dev/room-window`: okno współhosta (nagłówek gościa, pasek prowadzącego).
- Budowniczowie stanów przyjmują `cohost` i `leader`.

#### 6. E2E

**File**: `tests/e2e/cohost.spec.ts` (nowy), `tests/e2e/support/round.ts:109-111`, `tests/e2e/latecomer.spec.ts:24`, pomocniki w `tests/e2e/support/room.ts`

**Intent**: Dowieść w przeglądarce, że wieczór trwa bez hosta, a odebranie roli działa bez przeładowania.

**Contract**:

- zmienione teksty w pomocnikach i `latecomer.spec.ts`;
- scenariusz „współhost prowadzi bez hosta”:
  - host nadaje rolę Oli w poczekalni, Ola widzi znaczek i „Zacznij grę”, Kuba nie;
  - Ola zaczyna, strona hosta zamknięta;
  - po głosach Oli i Kuby Ola odsłania wynik i przechodzi dalej;
  - spóźniony prosi, Ola wpuszcza;
  - Ola kończy grę z „Na pewno?”.
- scenariusz „odebranie roli”: host odbiera rolę w głosowaniu po swoim głosie, pasek Oli znika bez przeładowania, ogłoszenie się pokazuje.
- Pułapka: do „gaśnie, ale fokusowalny” `not.toHaveAttribute("disabled")`, nie `toBeEnabled()`.

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- `npx playwright test --list` pokazuje `cohost.spec.ts`
- CI na PR zielone we wszystkich jobach, w `e2e` nowe scenariusze `cohost.spec.ts` przechodzą

#### Manual Verification:

- Karol wybiera wariant przycisku roli i znaczka na zrzutach
- Karol ocenia zrzuty gotowych stanów (współhost w poczekalni, w głosowaniu, po odsłonie; host z przyciskiem roli; ogłoszenie) na laptopie i telefonie

**Implementation Note**: Najpierw warianty i wybór Karola (3.4), dopiero potem kontrolki. Po fazie pauza na akceptację Karola.

---

## Faza 4: Wdrożenie

### Overview

Baza, potem kod (`context/deployment/deploy-plan.md`), smoke na produkcji i przeklikanie z ekipą.

### Changes Required:

#### 1. Baza na produkcji

**Intent**: Migracja na produkcji przed scaleniem kodu.

**Contract**:

- PR gotowy do przeglądu (nie draft), CI zielone;
- `npx supabase db push --dry-run`, `npx supabase db push`, `npx supabase migration list`, każde za zgodą i nie z eduroam;
- Advisors → Security: nowe ostrzeżenia dla siedmiu funkcji przyznanych `anon` są zamierzone, jak dla `join_room`;
- `deploy-plan.md` („Wgrane migracje”) dostaje wpis.

#### 2. Scalenie i sprawdzenie

**Intent**: Kod na produkcji i dowód, że działa.

**Contract**: scala Karol (`! gh pr merge <n> --merge`). Potem `BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke` (za zgodą) i przeklikanie Karola.

### Success Criteria:

#### Automated Verification:

- `npx supabase migration list` pokazuje nową migrację lokalnie i zdalnie
- Smoke na produkcji zielony

#### Manual Verification:

- Karol scala PR
- Karol z ekipą: host nadaje rolę, wychodzi, współhost odsłania, przechodzi dalej, wpuszcza spóźnionego i kończy grę; host odbiera rolę innemu współhostowi

---

## Testing Strategy

### Unit Tests:

- Parsery stanu (`cohost`, `leader_draw`, `leader`; widok bez `leader_draw`), bramka RPC (sygnatury z tokenem, `set_cohost`), odmowy (`not_leader`, `player_unknown`), `questionsLeft` z liczb.

### Integration Tests:

- `tests/db/cohost.test.ts`: kto prowadzi, kto nie, odmowy, nadawanie i odbieranie, stan pokoju prowadzącego i gościa (CI `db`).
- Poprawione oczekiwania dla `anon` w `round-rules` i `latecomers`, F1 w `latecomers`.
- pgTAP: granty, sygnatury, kolumna, kontrola (CI `db`).
- E2E `cohost.spec.ts` (CI `e2e`), smoke (CI i produkcja).

### Manual Testing Steps:

1. Zrzuty wariantów i gotowych stanów (faza 3).
2. Na produkcji: gra z 3–4 osobami, host nadaje rolę jednej z nich w poczekalni.
3. Współhost zaczyna. Host zamyka kartę. Po głosach reszty współhost odsłania wynik i przechodzi dalej.
4. Spóźniony prosi, współhost wpuszcza. Współhost pomija pytanie.
5. Host wraca i odbiera rolę drugiemu współhostowi. Jego pasek znika bez przeładowania. Pierwszy współhost kończy grę z „Na pewno?”.

## Performance Considerations

Start, następne i pominięcie wołają `room_lobby` zamiast jednego odczytu `rooms` przez RLS, czyli jedno wywołanie więcej na ruch. `room_lobby` i tak biegnie przy każdym odświeżeniu. `leader_refusal` to jeden odczyt po unikalnym `token_hash`.

## Migration Notes

- Migracja jest addytywna dla starego Workera: domyślny `p_player_token`, nowe klucze w `room_lobby` (ignorowane przez stare parsery), a nowy grant `anon` bez tokenu kończy się `room_unknown`. `db push` przed scaleniem nie psuje produkcji.
- Wycofanie kodu: revert PR. Wycofanie bazy: nowa migracja (pushowanej nie edytujemy). Flagi `cohost` nie wymagają sprzątania: zamknięty pokój odrzuca każdy ruch.

## References

- Research i decyzje Karola: `context/changes/co-host-role/research.md` (sekcja „Decyzje do planu”)
- Roadmapa: `context/foundation/roadmap.md:193-202`; PRD `context/foundation/prd.md:97,157-174`
- Wzorce: `cast_vote` `supabase/migrations/20261020205751_round_number_required.sql:110-135`, `admit_latecomer` `20261022132240_latecomer_admission.sql:265-352`, trasa `src/pages/api/rooms/[id]/vote.ts:39-47`, `admit.ts`, `roomView` `src/lib/rooms/server.ts:274-285`
- Poprzednia zmiana z tym samym układem faz: `context/archive/2026-10-22-latecomer-admission/plan.md`
- Zasady testów: `context/foundation/test-plan.md` §6; wdrożenie: `context/deployment/deploy-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza

#### Automated

- [x] 1.1 Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — 7f5c39a
- [x] 1.2 `npx prettier --check` dla nowych i zmienionych plików `.md` przechodzi — 7f5c39a
- [x] 1.3 Draft PR do `main` (push za zgodą Karola): CI zielone we wszystkich jobach, w `db` nowe testy `cohost.test.ts` i nowe asercje pgTAP przechodzą — PR #30, b9f51a7
- [x] 1.4 Próbny alarm: tymczasowy commit zapala tylko przewidziane testy; po `git revert` CI zielone — cef16f2, revert 8698d49 (smoke raz powtórzony: port 54322 zajęty na runnerze)

#### Manual

- [x] 1.5 Karol czyta streszczenie migracji (kolumna, kontrola prowadzącego, 7 ruchów, nadawanie roli, co widzi współhost) i je akceptuje — 2026-10-28

### Phase 2: Serwer gry

#### Automated

- [x] 2.1 Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — 8c34573
- [x] 2.2 CI na PR zielone we wszystkich jobach, w tym nowe kroki smoke współhosta — PR #30, d33d94d

#### Manual

- [ ] 2.3 Nowa trasa `cohost` i jeden ruch współhosta przeklikane raz na serwerze dev przez API (lessons.md, wpis 3)

### Phase 3: Ekrany

#### Automated

- [x] 3.1 Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — eb86c2d
- [x] 3.2 `npx playwright test --list` pokazuje `cohost.spec.ts` — eb86c2d
- [ ] 3.3 CI na PR zielone we wszystkich jobach, w `e2e` nowe scenariusze `cohost.spec.ts` przechodzą

#### Manual

- [x] 3.4 Karol wybiera wariant przycisku roli i znaczka na zrzutach — wariant 3 „Przełącznik” (pigułka „+ współhost” / „✓ współhost”), 2026-10-29
- [x] 3.5 Karol ocenia zrzuty gotowych stanów (współhost w poczekalni, w głosowaniu, po odsłonie; host z przyciskiem roli; ogłoszenie) na laptopie i telefonie — 2026-10-29 (ekrany i ogłoszenia OK, podtytuł „Jesteś współhostem: możesz zacząć grę.” zostaje)

### Phase 4: Wdrożenie

#### Automated

- [ ] 4.1 `npx supabase migration list` pokazuje nową migrację lokalnie i zdalnie
- [ ] 4.2 Smoke na produkcji zielony

#### Manual

- [ ] 4.3 Karol scala PR
- [ ] 4.4 Karol z ekipą: host nadaje rolę, wychodzi, współhost odsłania, przechodzi dalej, wpuszcza spóźnionego i kończy grę; host odbiera rolę innemu współhostowi
