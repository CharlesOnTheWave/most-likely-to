# Wpuszczanie spóźnionych (S-08): plan implementacji

## Overview

Spóźniony otwiera link do trwającej gry i prosi o wejście z wybranym nickiem. Host widzi prośbę na każdym ekranie gry, także w trakcie głosowania, i klika „Wpuść” albo „Odrzuć”. Wpuszczony od razu widzi bieżącą rundę, a głosuje od następnego pytania. S-08 z roadmapy (`context/foundation/roadmap.md:201-211`, FR-020 w `context/foundation/prd.md:90-91`); na razie wpuszcza sam host, współhosta dopisze S-07 (decyzja Karola z 2026-10-22).

## Current State Analysis

Szczegóły i kotwice: `context/changes/latecomer-admission/research.md`.

- Spóźniony nie wejdzie dziś w żaden sposób: odmawia strona linku (`src/pages/j/[token].astro:41`, 409), Worker (`src/pages/api/rooms/join.ts:41`) i baza (`public.join_room`, `supabase/migrations/20261014101922_first_live_round.sql:341-344`).
- Głosowanie od następnej rundy baza już wymusza: lista uprawnionych to zdjęcie graczy przy otwarciu rundy (`start_game` `first_live_round.sql:576-585`, `private.open_next_round` `20261020205751_round_number_required.sql:66-73`), a `cast_vote` odmawia głosującemu i celowi spoza listy (`round_number_required.sql:175-193`) i liczy automatyczną odsłonę do `cardinality(eligible)` (`:214-225`).
- Ekran o uprawnionych nie wie nic. `room_lobby` (`20261015122252_full_game_evening.sql:403-526`) zwraca wszystkich graczy bez znacznika, a `RoundVoting` liczy „Zagłosowało X z `players.length`” (`src/components/room/RoundVoting.tsx:103,143`), pokazuje formularz każdemu, kto nie zagłosował (`:100,163`), i wszystkich graczy jako kandydatów (`:196`). `RoundReveal` czyta `round.results`, które mają tylko uprawnionych (`first_live_round.sql:201-204`), więc odsłony nie trzeba zmieniać.
- Tożsamość gościa to token w ciasteczku `mlt_player_<roomId>` i jego hash w `public.player_secrets`; `room_lobby` uznaje za gracza każdego, czyj hash tam jest (`full_game_evening.sql:438-449`). Strona `/r/[id]` dla kogoś spoza pokoju daje 404 (`src/pages/r/[id].astro:31-39,54-55`).
- Zamknięcie pokoju (koniec gry `full_game_evening.sql:237-238`, „Nowa gra” w `create_room` `first_live_round.sql:276-278`, godzinne `private.close_stale_games` `20261014101925_close_stale_games.sql:32-33`) zawsze woła `private.drop_round_state` (`first_live_round.sql:166-178`). To jedyne miejsce, które sprząta stan gry przy zamknięciu.
- Odświeżanie na żywo: Worker po akcji woła `ringLobby` (`src/lib/rooms/server.ts:369-382`), ekran pobiera wtedy `GET /api/rooms/<id>/lobby` (`src/components/room/useRoomState.ts:183,281-320`), z zapasem co 15 s. Temat `live-sync:<roomId>` jest publiczny. `createFetchLimiter` (`src/lib/live-sync/limiter.ts:38`) jest ogólny; `useRoomState` jest przywiązany do stanu pokoju.

## Desired End State

- Ktoś, kto otworzy link do gry w toku i nie jest w pokoju, widzi formularz „Poproś o wejście” z nickiem. Po wysłaniu widzi „Czekasz, aż host Cię wpuści”, bez treści pytania. Ekran sam się odświeża na dzwonek i co 15 s.
- Host na każdym ekranie gry (głosowanie przed i po swoim głosie, odsłona, pominięta runda, potwierdzenia) widzi nad treścią listę próśb: każdy nick w osobnym wierszu z „Wpuść” i „Odrzuć”. Goście listy nie widzą.
- Po „Wpuść” spóźniony trafia do `/r/<id>`. W bieżącej rundzie widzi pytanie i notkę „Zagłosujesz od następnego pytania” zamiast formularza. Na liście „Gracze” jest z szarym dopiskiem „od następnego pytania”, bez znaczka głosu; licznik „Zagłosowało X z Y” go nie liczy i nie da się na niego zagłosować. Od następnego pytania gra jak każdy.
- Po „Odrzuć” spóźniony widzi „Host Cię nie wpuścił” i może poprosić jeszcze raz (formularz z jego ostatnim nickiem). „Odrzuć” działa bez potwierdzenia.
- Najwyżej 5 próśb czeka naraz; szósta dostaje `requests_full`. Nick prośby podlega tym samym zasadom co przy wejściu i jest zajęty, gdy ma go gracz albo inna oczekująca prośba (`nick_taken`).
- Prośba czeka do decyzji hosta albo do zamknięcia pokoju; przy końcu gry, „Nowej grze” i sprzątaniu po 12 h prośby znikają, a czekający widzi „Gra się skończyła”.
- `join_room` dalej odmawia `game_started`: do gry w toku wchodzi się tylko przez prośbę.
- Sprawdzenie: CI zielone (w tym `db`, pgTAP, `e2e`, `smoke`), smoke na produkcji, przeklikanie Karola na telefonie i laptopie.

### Key Discoveries:

- Zdjęcie uprawnionych przy otwarciu rundy przygotowano pod S-08 (`context/archive/2026-10-13-first-live-round/research.md:351`); funkcji rundy nie trzeba zmieniać.
- Prośba nie może mieć wiersza w `players` ani `player_secrets` przed wpuszczeniem, bo `room_lobby` od razu wpuściłby ją do pokoju (`full_game_evening.sql:438-449`).
- Parsery stanu kopiują tylko klucze z kontraktu (`src/lib/rooms/shared.ts:119-121,166-201`), więc stary Worker zignoruje nowe pola bazy; nowy Worker na starej bazie by się wyłożył. Kolejność wdrożenia: baza, potem kod.
- Tabele w `private` muszą przejść pętlę pgTAP po całym schemacie (bez grantów, poza publikacją, bez kolumn czasu, `serial` i `identity`, `context/foundation/test-plan.md:227`); prośby nie są stanem rundy i trafiają do `public`, jak `player_secrets`.
- Testy bazy liczą dokładne zbiory kluczy (`LOBBY_KEYS`, `VOTING_ROUND_KEYS` w `tests/db/support/rounds.ts:61-70`).

## What We're NOT Doing

- Współhost i wpuszczanie przez współhosta (S-07).
- Powrót na stary nick po utracie ciasteczka (S-04). Kto stracił ciasteczko, może poprosić o wejście pod nowym nickiem; jego stary nick zostaje uprawniony w bieżącej rundzie.
- Wygasanie próśb po czasie, potwierdzenie przed „Odrzuć”, blokada odrzuconych.
- Prośby w poczekalni: przed startem gość wchodzi jak dziś, bez hosta.
- Powiadomienia poza ekranem gry (dźwięk, wibracja, push) i zmiany w nagłówku `AppHeader.astro`.
- Agregat „Gra” z `context/domain/02-invariant-aggregate-refactor.md` (decyzja 6).
- Zmiany w `cast_vote`, `start_game`, `private.open_next_round`, `finish_round` i `join_room`.

## Implementation Approach

- **Faza 1:** migracja i jej testy. Nowa tabela próśb dostępna tylko przez funkcje, 4 nowe funkcje, `room_lobby` z prośbami i uprawnionymi, sprzątanie w `drop_round_state`. Stary Worker działa dalej. Testy bazy i pgTAP idą w CI na draft PR (pierwszy push za zgodą), z próbnym alarmem.
- **Faza 2:** Worker i strona linku: prośba z `/j/…`, ekran czekania z odświeżaniem, trasy „Wpuść” i „Odrzuć”, typy, parsery i kody odmów, a razem z surowymi parserami nowe pola w próbkach, podglądy strony linku i krok smoke o wejściu do gry w toku.
- **Faza 3:** ekrany gry: lista próśb u hosta, głosowanie liczy uprawnionych, podglądy ekranów gry, E2E i kroki smoke wpuszczenia.
- **Faza 4:** wdrożenie według `context/deployment/deploy-plan.md`: zielone CI, `db push`, scalenie przez Karola, smoke na produkcji, przeklikanie.

Jedna gałąź `latecomer-admission`, jeden PR (zmiany w `supabase/migrations/`, `src/lib/rooms/`, `src/pages/api/rooms/`, `src/pages/j/`, `tests/` tylko przez PR z zielonym `db`, AGENTS.md).

## Critical Implementation Details

- **Token prośby jest przyszłym tokenem gracza.** Prośba trzyma hash tokenu z ciasteczka `mlt_player_<roomId>`; „Wpuść” przenosi ten hash do `player_secrets`. Przeglądarka spóźnionego nie dostaje nowego ciasteczka, a `/j/<link>` po wpuszczeniu sam przekieruje do `/r/<id>` (`[token].astro:48-50`). Przed wpuszczeniem nic nie trafia do `player_secrets`.
- **Kolejność wdrożenia:** `db push` przed scaleniem kodu. Nowy parser wymaga `requests` i `round.eligible`, których stara baza nie zwraca.
- **Blokada wiersza pokoju** (`for update`) w każdej nowej funkcji zapisu, jak w `join_room`: prośby, wpuszczenia i start rundy idą po kolei, więc limit 5 i kolizje nicków są liczone bez wyścigów.

## Faza 1: Baza

### Overview

Migracja z tabelą próśb, czterema funkcjami, rozszerzonym `room_lobby` i sprzątaniem, plus testy bazy i pgTAP. Bez zmian w Workerze i ekranach.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/<timestamp>_latecomer_admission.sql` (nowy, `npx supabase migration new latecomer_admission`)

**Intent**: Prośby o wejście jako osobny byt z cyklem pending → (wpuszczona i usunięta | rejected → znów pending), widoczny tylko dla hosta i dla właściciela tokenu, sprzątany przy każdym zamknięciu pokoju.

**Contract**:

- **Tabela `public.join_requests`:**
  - kolumny: `id uuid` (klucz, `gen_random_uuid()`), `room_id uuid` (do `rooms`, `on delete cascade`), `nick text` (1-20 jak w `players`), `nick_key text generated always as (private.nick_key(nick)) stored`, `token_hash bytea` (unikalny), `status text` (`pending` | `rejected`), `created_at timestamptz default now()` (kolejność na liście hosta);
  - unikalny indeks częściowy (`room_id`, `nick_key`) `where status = 'pending'`;
  - RLS włączone, `revoke all … from public, anon, authenticated`, bez grantów i bez polityk (tabela tylko przez funkcje, AGENTS.md).
- **`public.request_join(p_link_token text, p_nick text, p_player_token text) returns jsonb`**, `security definer`, właściciel `postgres`, `search_path = ''`, `execute` dla `anon` i `authenticated` (publiczny punkt wejścia, wszystkie sprawdzenia w środku). Kolejność jak w `join_room` (`first_live_round.sql:308-381`):
  1. zły format tokenu (`^[A-Za-z0-9_-]{43}$`) → wyjątek 22023;
  2. zły format linku albo nieznany pokój → `room_unknown`; blokada wiersza pokoju `for update`;
  3. pokój w `lobby` → `room_open`; `closed` → `room_closed`;
  4. token jest już graczem tego pokoju (`player_secrets`) → `{ok: true}` bez zmian;
  5. nick: ponad 100 znaków surowych → `invalid_nick`, po `normalize_nick` 1-20 znaków i niepusty `nick_key`;
  6. token ma już oczekującą prośbę w tym pokoju → `{ok: true}` bez zmian;
  7. `nick_key` zajęty przez gracza tego pokoju albo przez inną oczekującą prośbę → `nick_taken`;
  8. 5 oczekujących próśb w pokoju → `requests_full`;
  9. token ma odrzuconą prośbę → ta prośba wraca do `pending` z nowym nickiem; inaczej nowy wiersz `pending`. Odpowiedź `{ok: true}`.
- **`public.join_request_state(p_room_id uuid, p_player_token text) returns jsonb`**, definer, `anon` i `authenticated`. Bez zapisu. `{state: "admitted"}` gdy hash tokenu jest graczem pokoju; `{state: "pending" | "rejected", nick}` dla prośby; `{state: "closed"}` gdy pokój zamknięty; w pozostałych przypadkach (zły format, nieznany pokój lub token) `{state: "none"}`. Nigdy pytania, graczy ani innych próśb.
- **`public.admit_latecomer(p_room_id uuid, p_nick text) returns jsonb`**, definer, tylko `authenticated`. Blokada pokoju, `auth.uid() = host_id` inaczej `room_unknown` (jak `skip_round`, `full_game_evening.sql:154-164`); pokój nie w `playing` albo brak oczekującej prośby o `nick_key = private.nick_key(p_nick)` → `request_unknown`. Dopisuje gracza (`seat = max(seat)+1`, nick z prośby), `player_secrets(token_hash)` z prośby, usuwa prośbę. Naruszenie `players_room_nick_key` → `latecomer_nick_taken` (przypadek tylko obronny: blokada i sprawdzenia `request_join` go wykluczają; `nick_taken` ma tekst dla osoby wchodzącej, nie dla hosta). `{ok: true}`.
- **`public.reject_latecomer(p_room_id uuid, p_nick text) returns jsonb`**, definer, tylko `authenticated`. Te same sprawdzenia co `admit_latecomer`; ustawia `status = 'rejected'`. `{ok: true}`.
- **`public.room_lobby`** (`create or replace`, ta sama sygnatura i granty): dwa nowe klucze.
  - na górze `requests`: dla hosta nicki oczekujących próśb w kolejności `created_at`, dla gościa `[]`;
  - w rundzie w fazie `voting`: `eligible`, nicki uprawnionych w kolejności miejsc. Fazy `revealed` i `skipped` bez zmian.
- **`private.drop_round_state(uuid)`** (`create or replace`): dodatkowo usuwa prośby pokoju; komentarz mówi, że to sprzątanie wszystkiego, co gra w toku trzyma poza graczami.
- Komentarze o „nikt nie dołącza do gry w toku” w nowych i zmienianych funkcjach mówią, jak jest teraz (spóźniony wchodzi przez prośbę, uprawnieni zostają ze zdjęcia przy otwarciu rundy).

#### 2. Testy bazy

**File**: `tests/db/latecomers.test.ts` (nowy), `tests/db/support/rounds.ts`, `tests/db/round-anonymity.test.ts`, `tests/db/round-rules.test.ts`, `context/foundation/test-plan.md`

**Intent**: Wyrocznia z FR-020 i decyzji Karola 1-6, przez REST/RPC jako gość, spóźniony (anon z tokenem) i host, z pominięciem Workera (`context/foundation/test-plan.md:66`, §6).

**Contract**:

- jeden host na plik (`newHost()`, `tests/db/support/clients.ts:33-46`; budżet logowań 12 z 30, `test-plan.md:184-187`), wzorzec pliku jak `tests/db/game-rules.test.ts:39-56`; lista kont w `test-plan.md:184` dostaje `latecomers 1` (razem 12);
- eksporty w `rounds.ts`: `requestJoin`, `joinRequestState`, `admitLatecomer`, `rejectLatecomer` obok `joinRoom` (`:93-162`); `LOBBY_KEYS` + `requests`, `VOTING_ROUND_KEYS` + `eligible` (`:61-70`);
- przypadki (każda odmowa konkretnym kodem, `test-plan.md:169-172`; kontrola pozytywna w pliku, `:173`):
  - prośba w trakcie głosowania → `{ok: true}`; stan `pending` z nickiem; host widzi `requests: [nick]`, gość `requests: []`;
  - `join_room` w grze w toku dalej `game_started` (istniejący test `round-rules.test.ts:183-188` zostaje);
  - nick zajęty przez gracza i przez oczekującą prośbę → `nick_taken`; po odrzuceniu ten nick jest wolny;
  - szósta oczekująca prośba → `requests_full`;
  - prośba do pokoju w poczekalni → `room_open`, do zamkniętego → `room_closed`;
  - „Odrzuć” → stan `rejected`; ponowna prośba z tym samym tokenem → `pending` z nowym nickiem;
  - „Wpuść” w trakcie głosowania → stan `admitted`, `room_lobby` z tokenem spóźnionego działa; `eligible` bez niego; jego głos → `no_round`; głos na niego → `unknown_target`; po głosach pierwotnie uprawnionych runda odsłania się sama;
  - następne pytanie: spóźniony jest w `eligible` i jego głos przechodzi;
  - `admit_latecomer`/`reject_latecomer` od gościa jako anon → odmowa uprawnień (42501); dla nicku bez oczekującej prośby → `request_unknown`;
  - po „Zakończ grę” stan prośby `closed`, a host nie widzi próśb;
- `round-anonymity.test.ts` sprawdza nowe zbiory kluczy;
- `round-rules.test.ts`, który już ma `hostA` i `hostB` (`:51`): `admit_latecomer`/`reject_latecomer` od obcego hosta → `room_unknown` (bez drugiego konta w `latecomers.test.ts`); komentarz „Late players wait for S-08” przy `:183` mówi, że do gry w toku wchodzi się przez prośbę.

#### 3. pgTAP: widok twórcy

**File**: `supabase/tests/round_creator_view.test.sql`

**Intent**: Katalog, granty i brak resztek dla nowej tabeli i funkcji.

**Contract**:

- `join_requests`: `table_privs_are` puste dla `anon` i `authenticated`, RLS włączone, poza publikacją `supabase_realtime` (obok kontroli `player_secrets`, `:471-475`);
- `function_facts` (`:423-450`) dla 4 nowych funkcji: `request_join` i `join_request_state` z `execute: anon, authenticated`, `admit_latecomer` i `reject_latecomer` z `execute: authenticated`; wszystkie `security definer | owner postgres | search_path=""`; każda w dokładnie jednej wersji;
- brak resztek: 0 wierszy `join_requests` pokoju po „Nowa gra” (`:635-647`), po `end_game` (`:680-705`) i po `close_stale_games` (`:730-806`), z prośbą `pending` i `rejected` założoną przed zamknięciem;
- `plan(107)` podniesione do nowej liczby.

#### 4. Próbny alarm

**File**: tymczasowy commit na gałęzi (`test-plan.md` §6.2 „Break-check”, `:192-196`)

**Intent**: Dowód, że nowe strażniki prywatności (gość nie widzi cudzych próśb) i sprzątania (prośby znikają przy zamknięciu) potrafią zaświecić na czerwono.

**Contract**: tymczasowa migracja: `room_lobby` daje gościowi listę próśb, a `drop_round_state` nie usuwa próśb. Opis commita wymienia przewidziane czerwone: w `latecomers.test.ts` test „host widzi `requests: [nick]`, gość `requests: []`” i test „po „Zakończ grę” … host nie widzi próśb”, w pgTAP 3 asercje resztek `join_requests`; reszta zielona. Push za zgodą, porównanie z listą, `git revert`, push, CI znów zielone. Wynik dopisany w `test-plan.md` §6.2 jak poprzednie próbne alarmy.

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- `npx prettier --check` dla nowych i zmienionych plików `.md` przechodzi
- Draft PR do `main` (push za zgodą Karola): CI zielone we wszystkich jobach, w `db` nowe testy `latecomers.test.ts` i nowe asercje pgTAP przechodzą
- Próbny alarm: tymczasowy commit zapala tylko przewidziane testy `latecomers.test.ts` i 3 asercje resztek pgTAP; po `git revert` CI zielone

#### Manual Verification:

- Karol czyta streszczenie migracji (tabela, 4 funkcje, co widzi host, co spóźniony) i je akceptuje

**Implementation Note**: Pierwszy push dopiero po zgodzie Karola; gałąź z upstreamem `origin/latecomer-admission`, nigdy `main`.

---

## Faza 2: Strona linku i serwer gry

### Overview

Prośba z `/j/<link>`, ekran czekania z odświeżaniem, „Poproś jeszcze raz”, trasy „Wpuść”/„Odrzuć”, typy, parsery i kody odmów. Razem z surowymi parserami: nowe pola we wszystkich próbkach stanu, podglądy strony linku i krok smoke o wejściu do gry w toku, żeby bramka tej fazy była zielona.

### Changes Required:

#### 1. Typy i parsery stanu

**File**: `src/lib/rooms/shared.ts`

**Intent**: Ekran zna prośby (host) i uprawnionych w rundzie głosowania.

**Contract**: `LobbyState.requests: string[]`; `VotingRound.eligible: string[]` (`:20-27,53-59`); parsery (`:119-121,166-201`) wymagają obu pól i kopiują je; typ stanu prośby `JoinRequestState = {state: "pending" | "rejected"; nick: string} | {state: "admitted" | "closed" | "none"}` z parserem.

#### 2. Wywołania bazy

**File**: `src/lib/rooms/server.ts`

**Intent**: Cienkie wrappery RPC jak `joinRoom` (`:152-169`).

**Contract**: `requestJoin(client, linkToken, nick, playerToken)`, `joinRequestState(client, roomId, playerToken)`, `admitLatecomer(client, roomId, nick)`, `rejectLatecomer(client, roomId, nick)`; odmowy jako `{ok: false, reason}` jak dziś.

#### 3. Kody i teksty odmów

**File**: `src/lib/rooms/errors.ts`, `tests/unit/room-errors.test.ts`

**Intent**: Każda nowa odmowa ma własny tekst; `game_started` przestaje mówić „nie można dołączyć”.

**Contract**:

- nowe kody w `MESSAGES` (`:27-49`): `requests_full` („Na wejście czeka już 5 osób. Spróbuj za chwilę.”), `room_open` („Gra jeszcze się nie zaczęła. Odśwież stronę i dołącz.”), `request_unknown` („Tej prośby już nie ma.”), `latecomer_nick_taken` („Ten nick ma już ktoś w grze. Odrzuć prośbę, a spóźniony poprosi pod innym nickiem.”);
- `game_started`: „Gra już trwa.” Ten kod dostaje też host przy drugim „Start” (`start_game`, `first_live_round.sql:569`), więc tekst pasuje obu stronom; spóźnionemu formularz prośby pod spodem mówi, że host musi go wpuścić;
- `request_unknown` i `latecomer_nick_taken` w `ROUND_REFUSALS` (`:7-19`), bo to odmowy akcji hosta;
- test `room-errors` z ręcznymi listami (`:8-35`) zaktualizowany: `requests_full` i `room_open` w `GUEST_REFUSALS`, kody hosta w liście odmów rundy.

#### 4. Prośba z formularza

**File**: `src/pages/api/rooms/join.ts`

**Intent**: Dla gry w toku formularz składa prośbę zamiast odmowy.

**Contract**: po sprawdzeniu „już w pokoju” (`:32-37`), gdy `roomLink` mówi `started`: token z ciasteczka `mlt_player_<roomId>` tylko, gdy pasuje do `PLAYER_TOKEN_PATTERN` (`src/lib/rooms/tokens.ts:11`, jak `vote.ts:39-41`; `request_join` na inny format rzuca 22023, czyli 500), inaczej nowy `newPlayerToken()`; `requestJoin`; przy `ok` ustawia ciasteczko (jak `:53`), `ringLobby` i przekierowuje jawnie `context.redirect(url, 303)` na `/j/<link>` (reszta `join.ts` daje 302); odmowa → `backToLink(reason)`. Ścieżka poczekalni bez zmian.

#### 5. Stan prośby

**File**: `src/pages/api/rooms/[id]/request.ts` (nowy)

**Intent**: Ekran czekania pyta o swój stan.

**Contract**: `GET`, id zgodne z `UUID_PATTERN`, token z ciasteczka (bez ciasteczka `{state: "none"}`), `joinRequestState`, odpowiedź JSON `JoinRequestState`; błąd bazy → 503/500 jak `lobby.ts`; bez pytań i nicków innych osób.

#### 6. Trasy hosta

**File**: `src/pages/api/rooms/[id]/admit.ts`, `src/pages/api/rooms/[id]/reject.ts` (nowe), `src/components/room/room-actions.ts`

**Intent**: „Wpuść” i „Odrzuć” jak inne akcje hosta.

**Contract**: wzorzec `skip.ts:15-40`: `refuseForeignPost`, `UUID_PATTERN`, `readJsonBody` z polem `nick` (tekst, inaczej 400 `invalid_body`), `locals.user` (inaczej `OUTSIDE_ROOM`), RPC, `ringLobby` przy sukcesie, `actionAnswer` (`request_unknown` → 409). `RoomAction` (`room-actions.ts:11`) + `admit`, `reject` z nickiem w ciele.

#### 7. Strona linku i ekran czekania

**File**: `src/pages/j/[token].astro`, `src/components/room/JoinWaiting.tsx` (nowy), `src/components/room/JoinForm.tsx`

**Intent**: Gra w toku pokazuje formularz prośby, a po wysłaniu ekran czekania, który sam przechodzi do pokoju.

**Contract**:

- `loadPage` (`:25-43`): rodzaj strony `started` (`:21`) dostaje `roomId`; dla `started` i osoby spoza pokoju stan prośby z ciasteczka (`joinRequestState`):
  - `none` → formularz prośby (200): tytuł i opis mówią, że host musi wpuścić;
  - `pending` → wyspa `JoinWaiting` z nickiem, `roomId`, `getPublicSupabaseConfig()` (`src/lib/supabase.ts:27-32`, tylko dla Realtime, AGENTS.md);
  - `rejected` → „Host Cię nie wpuścił.” i formularz prośby z poprzednim nickiem („Poproś jeszcze raz”);
  - `admitted` → 302 do `/r/<id>` (jak `inside`).
- `JoinWaiting`: tekst „Czekasz, aż host Cię wpuści” z nickiem, bez pytania. Własny mały efekt, `useRoomState` bez zmian (ekran pokoju działa na produkcji; jego subskrypcja jest spleciona z jego stanem w jednym efekcie, `useRoomState.ts:144-340`):
  - kanał dzwonka `live-sync:<roomId>` jak w `useRoomState.ts:281-320`;
  - `createFetchLimiter` (`src/lib/live-sync/limiter.ts:38`) z `fetchState` = `GET /api/rooms/<id>/request`;
  - własny timer co `LOBBY_POLL_MS`, bo limiter sam nie odpytuje (timer pokoju: `useRoomState.ts:236-245`);
  - `admitted` → przejście do `/r/<id>`; `rejected` i `none` → przeładowanie `/j/<link>`; `closed` → „Gra się skończyła.”; po `admitted` i `closed` kanał i timer stop;
  - błąd odświeżenia → tekst jak w pokoju („Nie udało się odświeżyć stanu gry”) i zgłoszenie `refresh_failed` przez `reportClientEvent` (`useRoomState.ts:68`), bez przekierowania.
- `JoinForm` przyjmuje wariant „prośba” (tekst przycisku „Poproś o wejście”, podpowiedź) i nick początkowy.

#### 8. Testy jednostkowe

**File**: `tests/unit/room-state.test.ts`, nowe testy parsera stanu prośby

**Intent**: Parsery odrzucają odpowiedź bez `requests` albo `eligible` i nie przepuszczają obcych kluczy.

**Contract**: przypadki obok `:61,196`.

#### 9. Próbki stanu i podglądy strony linku

**File**: `src/pages/dev/room-states.astro`, `src/pages/dev/room-window.astro`, `tests/unit/announce.test.ts`

**Intent**: Surowe typy z #1 nie wywracają `npx astro check`, a nowe stany strony linku mają podgląd (AGENTS.md, UI).

**Contract**:

- każda próbka `RoomView` i rundy głosowania dostaje `requests: []` i `eligible` (wszyscy gracze): `room-states.astro:106-181,484-489,502-507`, `room-window.astro:70-105,121-185`, `announce.test.ts:18-80`;
- w `room-states` nowe sekcje strony linku: formularz prośby, czekanie, odrzucenie z „Poproś jeszcze raz”, „Gra się skończyła”.

#### 10. Smoke i dokumenty

**File**: `scripts/smoke.mjs`, `context/foundation/test-plan.md`, `README.md`, komentarze w `src/lib/rooms/server.ts`, `src/pages/j/[token].astro`, `src/pages/api/rooms/join.ts`, `src/pages/r/[id].astro`, `src/lib/rooms/errors.ts`

**Intent**: Job `smoke` zielony po zmianie `join.ts`, a dokumenty i komentarze mówią, jak jest teraz.

**Contract**:

- krok „a new guest cannot join a game in play” (`smoke.mjs:283`) oczekuje złożenia prośby (303 na `/j/<link>`, ciasteczko `mlt_player_<roomId>`) i nazywa się tak, jak sprawdza; prośba „Kuba” czeka do końca wieczoru i znika przy zamknięciu;
- `test-plan.md:99`: opis („odmowa wejścia po starcie”) i liczba kroków;
- `README.md`: `:164-167` (wejście, klucze stanu, funkcje `security definer`), `:195` (krok smoke), tabela tras z `request`, `admit`, `reject`;
- komentarze o „S-08 decides about late players” i „nikt nie dołącza do gry w toku”: `server.ts:23-24`, `[token].astro:12-16`, `join.ts:6-8,39-40`, `r/[id].astro:42`, `errors.ts:5-6`.

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- `npx prettier --check README.md context/foundation/test-plan.md` przechodzi
- Push na gałąź PR (za zgodą): CI zielone we wszystkich jobach (`ci`, `smoke`, `db`, `e2e`)

#### Manual Verification:

- Karol ocenia zrzuty `/dev/room-states` dla formularza prośby, ekranu czekania i odrzucenia (strona HTML „Co oceniasz”, telefon w prawdziwej wielkości)

**Implementation Note**: Serwer dev tylko do podglądów `/dev/*`, zatrzymać po pracy (`npx astro dev stop`).

---

## Faza 3: Ekrany gry

### Overview

Lista próśb nad treścią ekranu hosta, głosowanie liczy uprawnionych, dopisek „od następnego pytania”, podglądy, E2E i kroki smoke.

### Changes Required:

#### 1. Lista próśb u hosta

**File**: `src/components/room/JoinRequests.tsx` (nowy), `src/components/room/RoomScreen.tsx`

**Intent**: Host widzi każdą prośbę na każdym ekranie gry i rozstrzyga ją jednym dotknięciem (FR-020, scenariusz 21:30).

**Contract**:

- renderowana w opakowaniu `RoomScreen.tsx:197-215`, po `LiveBanner`, przed notką o pominięciu, poza `contentRef` (nie zabiera fokusu po ruchu hosta, `:104`); tylko gdy `role === "host"`, `status === "playing"` i `requests` niepuste;
- jeden region `<section aria-label="Proszą o wejście">` z widocznym podpisem bez elementu nagłówka, żeby tytuł widoku został pierwszym nagłówkiem (AGENTS.md, UI); świadomie przed tytułem w DOM, jak `LiveBanner` i notka o pominięciu; każdy nick w osobnym wierszu z przyciskami „Wpuść” i „Odrzuć” (shadcn, klasy ról z `src/styles/global.css`); w trakcie akcji przyciski wiersza wyłączone; odmowa → tekst z `roomErrorMessage`; po akcji `refresh()` jak inne akcje (`RoomScreen.tsx:111-122`);
- nowa prośba ogłaszana czytnikowi ekranu przez istniejący region ogłoszeń (`announce.ts`) albo `aria-live="polite"` listy, bez podwójnego ogłoszenia;
- szerokość z `roomColumn(view)`, bez nowych wartości arbitralnych.

#### 2. Głosowanie liczy uprawnionych

**File**: `src/components/room/RoundVoting.tsx`

**Intent**: Wpuszczony w trakcie rundy nie dostaje formularza, nie jest kandydatem i nie psuje licznika.

**Contract**:

- `Y` w „Zagłosowało X z Y” i w tekstach potwierdzeń (`:103,143,281,290`) = liczba `round.eligible`;
- kandydaci (`:196`) = gracze z `round.eligible`, w kolejności miejsc;
- gdy `view.me` nie jest w `eligible`: zamiast formularza notka „Zagłosujesz od następnego pytania” (podpowiedzi `:149-154` dotyczą tylko uprawnionych);
- lista „Gracze (N)” (`:176-179`) pokazuje wszystkich graczy; nieuprawnieni z szarym dopiskiem „od następnego pytania”, bez znaczka głosu.

#### 3. Podglądy

**File**: `src/pages/dev/room-states.astro`, `src/pages/dev/room-window.astro`

**Intent**: Każdy nowy stan ma podgląd (AGENTS.md, UI).

**Contract**: w `room-states` nowe sekcje: host w głosowaniu z 2 prośbami, host w odsłonie z 1 prośbą, gość wpuszczony w trakcie głosowania (notka i dopisek); w `room-window` próbka hosta w głosowaniu z prośbami (`SAMPLES`, `:109-187`). Pola `requests` i `eligible` w próbkach i podglądy strony linku są już z fazy 2 #9.

#### 4. E2E

**File**: `tests/e2e/latecomer.spec.ts` (nowy)

**Intent**: Cała droga spóźnionego w przeglądarkach kilku graczy (wzorzec `round.spec.ts`, `game.spec.ts`, pomocnicy `tests/e2e/support/room.ts`, `support/round.ts`).

**Contract**: host i 2 goście, start; spóźniony otwiera link w trakcie głosowania, prosi, widzi ekran czekania; host widzi prośbę bez przeładowania i wpuszcza; spóźniony jest w pokoju z notką „Zagłosujesz od następnego pytania”, a licznik u gości dalej „z 3”; runda kończy się odsłoną po 3 głosach; następne pytanie: spóźniony głosuje, licznik „z 4”. Drugi spóźniony: odrzucony, widzi „Host Cię nie wpuścił”, prosi jeszcze raz i znów jest na liście hosta. Projekt `chromium`.

#### 5. Smoke

**File**: `scripts/smoke.mjs`, `context/foundation/test-plan.md`, `README.md`

**Intent**: HTTP-owe sprawdzenie prośby, wpuszczenia i odrzucenia na prawdziwym serwerze (CI i produkcja).

**Contract**: po kroku prośby z fazy 2 #10 nowa grupa kroków w rundzie: stan prośby `pending`, host widzi nick w `requests`, „Wpuść”, stan `admitted`, stan pokoju spóźnionego bez niego w `eligible`, druga prośba odrzucona i stan `rejected`; prośby znikają przy zamknięciu w `closingSteps`. Liczba i opis kroków w `test-plan.md:99` oraz opis w `README.md:195` zaktualizowane.

#### 6. Słownik

**File**: `context/domain/glossary.md`

**Intent**: Nowe słowo w kodzie ma termin.

**Contract**: wiersz „prośba o wejście” (spóźniony prosi o wejście do trwającej gry, host wpuszcza albo odrzuca; w kodzie `join_requests`, `request_join`, `admit_latecomer`, `reject_latecomer`); „spóźniony” i „uprawnieni” dostają nazwy w kodzie (`join_requests`; `round.eligible` w stanie pokoju).

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- `npx prettier --check context/domain/glossary.md context/foundation/test-plan.md` przechodzi
- Push na gałąź PR (za zgodą): CI zielone we wszystkich jobach, w `e2e` `latecomer.spec.ts`, w `smoke` nowe kroki

#### Manual Verification:

- Karol ocenia zrzuty: host z prośbami w głosowaniu i odsłonie (laptop jako całe okno 1:1 i telefon), wpuszczony z notką i dopiskiem

---

## Faza 4: Wdrożenie

### Overview

Baza, potem kod (`context/deployment/deploy-plan.md`), smoke na produkcji i przeklikanie.

### Changes Required:

#### 1. Baza na produkcji

**Intent**: Migracja na produkcji przed scaleniem kodu.

**Contract**: PR gotowy do przeglądu (nie draft), CI zielone; `npx supabase db push --dry-run`, `npx supabase db push`, `npx supabase migration list` (każde za zgodą, nie z eduroam); Advisors → Security: ostrzeżenia 0028/0029 dla `request_join` i `join_request_state` są zamierzone, jak dla `join_room`; `deploy-plan.md` („Wgrane migracje”) dostaje wpis.

#### 2. Scalenie i sprawdzenie

**Intent**: Kod na produkcji i dowód, że działa.

**Contract**: scala Karol (`! gh pr merge <n> --merge`); `BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke` (za zgodą); przeklikanie Karola.

### Success Criteria:

#### Automated Verification:

- `npx supabase migration list` pokazuje nową migrację lokalnie i zdalnie
- Smoke na produkcji zielony

#### Manual Verification:

- Karol scala PR
- Karol przeklikuje na telefonie i laptopie: spóźniony prosi w trakcie głosowania, host wpuszcza, wpuszczony głosuje od następnego pytania; drugi spóźniony odrzucony i prosi jeszcze raz

---

## Testing Strategy

### Unit Tests:

- Parsery stanu pokoju (`requests`, `eligible`) i stanu prośby, teksty odmów (`room-errors`).

### Integration Tests:

- `tests/db/latecomers.test.ts`: zasady prośby, limitu, nicków, wpuszczenia, odrzucenia, uprawnionych i sprzątania przez RPC (CI `db`).
- pgTAP: katalog, granty, wersje funkcji, brak resztek po zamknięciu (CI `db`).
- E2E `latecomer.spec.ts` (CI `e2e`), smoke (CI i produkcja).

### Manual Testing Steps:

1. Zrzuty podglądów do oceny (fazy 2 i 3).
2. Na produkcji: gra z 3 osobami, czwarta otwiera link w trakcie głosowania i prosi.
3. Host wpuszcza; wpuszczony widzi notkę; licznik nie rośnie; runda odsłania się po 3 głosach.
4. Następne pytanie: wpuszczony głosuje.
5. Piąta osoba prosi, host odrzuca, ona prosi jeszcze raz; host kończy grę, czekający widzi „Gra się skończyła”.

## Performance Considerations

Jedna mała tabela, prośby najwyżej 5 naraz na pokój, odczyt po unikalnym indeksie. `room_lobby` dokłada dwa małe agregaty. Ekran czekania odpytuje co 15 s jak pokój.

## Migration Notes

- Migracja jest addytywna: stary Worker ignoruje nowe klucze `room_lobby`, więc `db push` przed scaleniem nie psuje produkcji.
- Wycofanie kodu: revert PR. Wycofanie bazy: nowa migracja (pushowanej migracji nie edytujemy). Prośby same znikają przy zamknięciu pokoju.

## References

- Research: `context/changes/latecomer-admission/research.md`
- Roadmapa: `context/foundation/roadmap.md:201-211`; PRD FR-020 `context/foundation/prd.md:90-91`
- Wzorce: `join_room` `supabase/migrations/20261014101922_first_live_round.sql:308-381`, `skip_round` `20261015122252_full_game_evening.sql:154-200`, trasa `src/pages/api/rooms/[id]/skip.ts:15-40`, `useRoomState.ts:273-320`
- Zasady testów: `context/foundation/test-plan.md` §6; wdrożenie: `context/deployment/deploy-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza

#### Automated

- [x] 1.1 Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — 682d5a5
- [x] 1.2 `npx prettier --check` dla nowych i zmienionych plików `.md` przechodzi — 682d5a5
- [x] 1.3 Draft PR do `main` (push za zgodą Karola): CI zielone we wszystkich jobach, w `db` nowe testy `latecomers.test.ts` i nowe asercje pgTAP przechodzą — 682d5a5
- [x] 1.4 Próbny alarm: tymczasowy commit zapala tylko przewidziane testy `latecomers.test.ts` i 3 asercje resztek pgTAP; po `git revert` CI zielone — 75831a4

#### Manual

- [x] 1.5 Karol czyta streszczenie migracji (tabela, 4 funkcje, co widzi host, co spóźniony) i je akceptuje — 682d5a5

### Phase 2: Strona linku i serwer gry

#### Automated

- [x] 2.1 Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — 295beca
- [x] 2.2 `npx prettier --check README.md context/foundation/test-plan.md` przechodzi — 295beca
- [x] 2.3 Push na gałąź PR (za zgodą): CI zielone we wszystkich jobach (`ci`, `smoke`, `db`, `e2e`) — 295beca

#### Manual

- [x] 2.4 Karol ocenia zrzuty `/dev/room-states` dla formularza prośby, ekranu czekania i odrzucenia (strona HTML „Co oceniasz”, telefon w prawdziwej wielkości) — 295beca

### Phase 3: Ekrany gry

#### Automated

- [x] 3.1 Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- [x] 3.2 `npx prettier --check context/domain/glossary.md context/foundation/test-plan.md` przechodzi
- [ ] 3.3 Push na gałąź PR (za zgodą): CI zielone we wszystkich jobach, w `e2e` `latecomer.spec.ts`, w `smoke` nowe kroki

#### Manual

- [x] 3.4 Karol ocenia zrzuty: host z prośbami w głosowaniu i odsłonie (laptop jako całe okno 1:1 i telefon), wpuszczony z notką i dopiskiem

### Phase 4: Wdrożenie

#### Automated

- [ ] 4.1 `npx supabase migration list` pokazuje nową migrację lokalnie i zdalnie
- [ ] 4.2 Smoke na produkcji zielony

#### Manual

- [ ] 4.3 Karol scala PR
- [ ] 4.4 Karol przeklikuje na telefonie i laptopie: spóźniony prosi w trakcie głosowania, host wpuszcza, wpuszczony głosuje od następnego pytania; drugi spóźniony odrzucony i prosi jeszcze raz
