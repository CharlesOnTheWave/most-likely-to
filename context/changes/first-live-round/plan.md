# Pierwsza runda na żywo (S-02) z testami anonimowości i reguł rundy (faza 2 planu testów) — plan implementacji

## Overview

S-02 z roadmapy, czyli gwiazda przewodnia gry: host klika „Zacznij grę”, wszyscy w pokoju widzą to samo pytanie z wybranych kategorii (18+ tylko tam, gdzie host je dołączył), każdy głosuje na jedną osobę z listy (także na siebie) albo się wstrzymuje, wszyscy widzą, kto już zagłosował, a po ostatnim głosie albo przewinięciu przez hosta widzą odsłonę: ile głosów dostała każda osoba.

Razem z S-02 idzie faza 2 planu testów (`context/foundation/test-plan.md` §3): ryzyka #1 (anonimowość) i #3 (reguły rundy). Testy bazy powstają **przed** kodem głosowania. Ta sama migracja domyka znane dziury F1 i F4, czyli kryteria akceptacji z roadmapy.

Dane wejściowe: `context/changes/first-live-round/research.md` (ustalenia, recenzja, decyzje Karola D1–D6 i decyzje techniczne T1–T9) oraz 4 odpowiedzi z wywiadu planu (tabela w „Implementation Approach”).

## Current State Analysis

Szczegóły i kotwice: `research.md` §1–§7. Najważniejsze:

- **Gra ma tylko lobby.** Stany pokoju to `lobby|closed` (`supabase/migrations/20261007122858_room_lobby.sql:25`). Nie ma tabeli głosów ani funkcji losującej. Pytania żyją tylko w `src/data/questions.ts` (216 pytań, 8 kategorii, flaga `adult`).
- **Host pisze do tabel bezpośrednio przez RLS** (granty `:59-61`, polityka `:73-76`). To znane dziury F1: 4 × `it.fails` w `tests/db/roles.test.ts:205-305`. `create_room` jest `security invoker` i z tych grantów korzysta (`:140, :180-189`).
- **Reguła nicku pomija selektory wariantu, znaczniki i 4 inne zakresy** (F4: 9 × `it.fails` przez `knownHole` w `tests/db/support/nick-pairs.ts:100-162`). Nie ma też limitu długości przed normalizacją.
- **Ekran pokoju (`src/components/room/RoomLobby.tsx`):**
  - nasłuchuje tylko w stanie `lobby` (:50);
  - każdy stan inny niż `closed` rysuje jak lobby (:135);
  - ignoruje stany błędu kanału (:100-102, audyt L1);
  - przy 404 przeładowuje stronę (:61-63, audyt L3);
  - rzutuje JSON bez sprawdzenia (:68, audyt L4).
- **Serwer zakłada `lobby|closed`:**
  - `parseLobby` (`src/lib/rooms/server.ts:126-140`, audyt P6);
  - `hostOpenRoomId` filtruje `lobby` (:161);
  - strona główna hosta (`src/pages/index.astro:20-32`);
  - `/j/<kod>` daje 410 przed sprawdzeniem „już w środku” (`src/pages/j/[token].astro:28-36`);
  - `MESSAGES` zna 8 kodów (`src/lib/rooms/errors.ts:3-21`, audyt G2).
- **Dzwonek:** Worker wysyła na publiczny temat `live-sync:<roomId>` sygnał bez danych, a ekran pobiera stan z bazy (`src/lib/rooms/server.ts:195-211`). Każdy z kluczem publishable może dzwonić, a ogranicznika nie ma (F2).
- **Testy bazy biegną tylko w CI**, kluczem publishable (`tests/db/support/env.ts:40-45`), więc nie widzą tego, co widzi twórca: `xmin`, katalogu ani publikacji. Ostatni przebieg: 53 testy, 40 zielonych i 13 oczekiwanych porażek. Pełne CI trwa ok. 3 min.
- **Stary kod serwera przeżyje nową bazę:** `parseLobby` ignoruje dodatkowe pola (:125-139), a stara sygnatura `create_room` zostaje. To podstawa kolejności wdrożenia „baza, potem kod”.

## Desired End State

1. **Runda na produkcji.** Host z co najmniej 2 gośćmi (min. 3 graczy, `prd.md:69, 76`) klika „Zacznij grę”. Każdy ekran pokazuje „Kto z nas najprawdopodobniej …?” z pytaniem wylosowanym z wybranych kategorii.
2. **Głosowanie.** Każdy gracz, także host, wybiera osobę albo „Wstrzymuję się” i potwierdza „Zagłosuj”. Głosu nie da się zmienić (D2). Wszyscy widzą, kto już zagłosował.
3. **Odsłona.** Po ostatnim głosie albo „Odsłoń wynik” hosta, w dowolnej chwili i bez progu (D3), każdy ekran pokazuje wszystkich graczy od największej liczby głosów (remis według kolejności dołączenia, zera przygaszone na dole) oraz „Wstrzymało się: N”.
4. **Po odsłonie** wynik zostaje. Host widzi „Kolejne pytania wkrótce” i „Nowa gra”.
5. **Urna, która znika (D1).**
   - W trakcie rundy stan „kto zagłosował” i liczniki żyją wyłącznie w tabelach nielogowanych w schemacie `private`, bez grantów i poza publikacją.
   - Przy odsłonie zostają same liczby na osobę.
   - Przy zamknięciu pokoju albo porzuceniu rundy nie zostaje nic.
   - Gra przerwana bez odsłony i bez nowej gry nie zostawia urny na dłużej: zadanie pg_cron co godzinę zamyka gry rozpoczęte ponad 12 h temu i kasuje ich urnę (plan-review F1).
   - Cel głosu jedzie tylko w treści POST. Żaden log ani odpowiedź nie zawiera celu.
   - Granica przyjęta przez Karola (twórca podglądający bazę na żywo albo włączający szersze logowanie) i skutek D3 są zapisane w PRD i AGENTS.md.
6. **F1 i F4 domknięte.** 4 + 9 testów „znana dziura → S-02” przechodzi bez znacznika. Pary FE0F z decyzji D5 (W2) są w tabeli par.
7. **Testy:**
   - nowe testy bazy #1 i #3 (Vitest, CI);
   - testy „widoku twórcy” (pgTAP w CI);
   - testy jednostkowe: losowanie, ogranicznik, logi, parser, komunikaty, kolejność wyniku;
   - E2E „3 graczy rozgrywa rundę”;
   - smoke z rundą i z krokiem „Ola”+FE0F.

   Wszystko zielone w CI i na produkcji.
8. **Ekran przy awarii kanału** pokazuje „Połączenie na żywo przerwane — odświeżam”, a Worker loguje filtrowane zgłoszenia z przeglądarki (D4).

Weryfikacja: Progress na dole, a na końcu ręczna runda Karola na laptopie, telefonie i w oknie incognito.

### Key Discoveries:

- Sygnatura `create_room` musi zostać zgodna, bo stary Worker podaje `p_link_token` (`src/lib/rooms/server.ts:61-71`). Parametr zostaje i jest ignorowany, a kod linku powstaje w SQL. Test H2a sprawdza skutek (`roles.test.ts:246-260`).
- `join_room` mapuje naruszenie unikalności po **nazwie** ograniczenia `players_room_nick_key` (migracja :253-256). Nowe ograniczenie na `nick_key` zachowuje tę nazwę.
- Tabele nielogowane nie mogą trafić do publikacji i nie piszą do WAL. Po awarii bazy są czyszczone (postgresql.org/docs/17: sql-createpublication, sql-createtable).
- Wiersze zapisane w jednej transakcji mają ten sam `xmin`, a właściciel go odczyta (`research.md` §3). Dlatego stan w toku jest kasowany, a nie zostawiany.
- Komunikat błędu Postgresa (`DETAIL`) może zawierać wartości wiersza w funkcji `security definer` (`research.md` §3). Dlatego wszystko sprawdzamy przed zapisem, a oczekiwane odmowy są danymi, nie wyjątkami.
- Astro `checkOrigin` nie chroni żądań JSON (`node_modules/astro/dist/core/app/origin-check.js:8-27`). Nowe endpointy JSON same sprawdzają `Origin`.
- `.claude/settings.json` nie pyta o `npx supabase test …`, a `supabase test db --linked` celowałby w produkcję (lessons.md, wpis 1).

## What We're NOT Doing

- **Następne pytanie, pominięcie rundy i koniec gry z potwierdzeniem** to S-03. W S-02 gra kończy się na odsłonie (wywiad: „Odsłona zostaje”).
- **Pokazanie własnego wyboru po odświeżeniu** to S-04. W S-02 ekran po przeładowaniu mówi tylko „Głos oddany”. Wybór żyje wyłącznie w pamięci ekranu, bez zapisu w telefonie, bo zapis koliduje z AGENTS.md.
- Wpuszczanie spóźnionych (S-08). Wejście po starcie dostaje `game_started`.
- Współhost (S-07), usuwanie graczy (S-09), reakcje i dane o pytaniach (S-11), pytania z ostatnich wieczorów (S-12), kasowanie gier (S-13).
- **Pomiar 2 s sondą na produkcji i E2E na czasy, zrywanie połączenia, dzwonki-podróbki** to faza 3 planu testów. W S-02 budżet sprawdza ręczna runda Karola.
- Linia logu z opóźnieniem odsłony (opcja z D4), Sentry ani inny tracker, prywatne kanały Realtime, Durable Objects.
- Usunięcie parametru `p_link_token` (późniejsza migracja) i usunięcie prototypu `/api/live-sync/ring` (zostaje dla sondy, T9).
- Docker lub Codespaces (D6: testy bazy w CI).
- Zmiany przypadków, które nie wynikają z S-02, w smoke logowania i E2E lobby.

## Implementation Approach

**Jeden PR, szkic do końca prac**, gałąź `first-live-round`, fazy jako commity. Kolejność:

1. **Faza 1: testy przed kodem.** Testy bazy i pgTAP opisują zachowanie z PRD i z decyzji. W CI świecą na czerwono dokładnie na nowych plikach. To dowód „błąd najpierw jako nieprzechodzący test” (CLAUDE.md).
2. **Faza 2: migracja.** Testy robią się zielone. Smoke i E2E w CI biegną przy tym jeszcze na **starym** kodzie serwera, co dowodzi, że `db push` przed scaleniem nie psuje produkcji.
3. **Fazy 3–4: serwer i ekrany.** Każdy czysty moduł powstaje test-first (`/10x-tdd`). Hooki odsyłają, gdy test jednostkowy jest czerwony na końcu tury, więc test i moduł powstają w tej samej turze.
4. **Faza 5: E2E i smoke z rundą.**
5. **Faza 6: przegląd i wdrożenie.** Najpierw baza, potem kod, scala Karol.

**Decyzje wejściowe** (`research.md`, sekcje „Decyzje do podjęcia” i „Decyzje techniczne”, oraz wywiad planu):

| Decyzja | Wybór | Źródło |
|---|---|---|
| Urna | Stan w toku w tabelach nielogowanych w `private`, przy odsłonie tylko liczby, przy porzuceniu nic. Granica „twórca na żywo” przyjęta. | D1 |
| Zmiana głosu | Nie, ekran z potwierdzeniem | D2 |
| Próg odsłony | Brak: liczby zawsze, także po 1 głosie (skutek zapisany w PRD) | D3 |
| Zgłoszenia z przeglądarki | Napis na ekranie + filtrowane zgłoszenia (widoczna karta, ponad 5 s bez kanału, limit na typ) | D4 |
| Emotki w nicku | W2: kolumna generowana `nick_key`, nick wyświetlany tak, jak wpisany | D5 |
| Testy bazy | CI | D6 |
| Ekran odsłony | Wszyscy gracze od największej liczby głosów, remis według kolejności dołączenia, zera przygaszone, „Wstrzymało się: N” | wywiad planu |
| Po odsłonie | Wynik zostaje, host widzi „Kolejne pytania wkrótce” i „Nowa gra” | wywiad planu |
| E2E | Jeden test „3 graczy rozgrywa rundę” w S-02 | wywiad planu |
| Smoke | Z rundą na produkcji (konto smoke + 2 gości) | wywiad planu |
| Minimum graczy | 3 (US-01: host + co najmniej 2 gości, host głosuje) | PRD `:69, :76` |

## Critical Implementation Details

- **Kolejność wdrożenia.**
  1. PR zielony.
  2. `npx supabase db push` (pytanie).
  3. Smoke na produkcji ze **starym** Workerem (pytanie).
  4. Scalenie przez Karola.
  5. Smoke na produkcji (pytanie).

  Działa to tylko dlatego, że sygnatura `create_room` zostaje, `room_lobby` jedynie dokłada klucz `round`, a gry w toku nie da się zacząć starym kodem. Nowy Worker przed migracją się zepsuje (brak `start_game`), więc nigdy nie scalać przed `db push`.
- **Niezmienniki urny (dotyczą każdej funkcji rundy):**
  - transakcja głosu zapisuje wyłącznie wiersz w `private.round_voters` i licznik w `private.ballot_boxes`, a po ostatnim głosie dodatkowo zamknięcie rundy (wyniki, faza, skasowanie stanu w toku);
  - żadnych kolumn czasu ani sekwencji w tabelach rundy;
  - wszystko sprawdzane przed zapisem, a odmowy wracają jako `{ok:false, reason}`, nigdy jako wyjątek z `DETAIL`;
  - żadna funkcja nie zwraca celu głosu, a liczby dopiero w fazie `revealed`;
  - Worker loguje tylko pola z listy, nigdy cel, nick, token ani `request.url`.
- **Kolejność blokad.** Każda funkcja rundy i `create_room` blokuje najpierw wiersz `rooms` (`for update`), potem rundę albo urnę, tak jak `join_room` (migracja :227-230). Zapobiega to zakleszczeniu i głosowi do pokoju, który właśnie się zamyka.
- **Znaki spoza BMP w klasach wyrażeń regularnych Postgresa** zapisujemy ucieczką `\U000E0100` (8 cyfr), nie dosłownie (`context/archive/2026-10-10-testing-lobby-foundation/research.md:133`). W źródłach TS niewidoczne znaki tylko jako `\u{…}` (test-plan §6.2).
- **CI w fazach 1–2.** Job `db` uruchamia pgTAP także wtedy, gdy Vitest padnie (`if: success() || failure()`). W fazie 1 widać dzięki temu oba czerwone zestawy w jednym przebiegu.

## Faza 1: Zasady i testy przed kodem

### Overview

Zapisuje kontrakt rundy w testach i dokumentach, zanim powstanie kod. Po tej fazie CI na szkicu PR świeci na czerwono dokładnie na nowych testach bazy i na asercjach rundy w pgTAP. Reszta (lint, `astro check`, unit, smoke, E2E i stare testy bazy) zostaje zielona.

### Changes Required:

#### 1. Gałąź, dokumenty planowania, szkic PR

**File**: `context/changes/first-live-round/*`, `context/foundation/test-plan.md` (§3), `context/foundation/roadmap.md`

**Intent**: Gałąź `first-live-round` z `main`. Commit dokumentów (`change.md`, `research.md`, `plan.md`, `plan-brief.md`, status fazy 2 i S-02), push gałęzi (pytanie), szkic PR do `main`.

**Contract**: PR w stanie draft. Opis wymienia fazy i kolejność wdrożenia z „Critical Implementation Details”.

#### 2. Granica anonimowości w PRD i AGENTS.md (D1, D3)

**File**: `context/foundation/prd.md` (NFR, wiersz `:143`), `AGENTS.md` (Hard Rules, pierwszy punkt; Testing)

**Intent**: Zdanie z PRD ma zostać prawdziwe po decyzjach D1 i D3. Agenci mają znać przyjętą granicę i sposób testowania widoku twórcy.

**Contract**:
- **PRD**, po zdaniu z `:143`, dopisek:
  > Gwarancja dotyczy stanu po rundzie, logów i każdej roli w grze; świadomie przyjęte (decyzje 2026-10-13 i 2026-10-14): twórca gry, który w trakcie rundy podgląda bazę (przy rundzie przerwanej bez odsłony najwyżej ok. 13 h od startu gry, zanim zadanie sprzątające ją zamknie) albo przed rundą włącza szersze logowanie lub zmienia kod, technicznie mógłby zobaczyć głos; odsłona liczb razem z jawną listą „kto już zagłosował” ujawnia głos, gdy zagłosowała jedna osoba albo wszyscy wskazali tę samą.
- **AGENTS.md, Hard Rules, punkt 1**, dopisek:
  > The in-progress state of a round lives only in unlogged `private` tables with no grants and is deleted at the reveal and whenever the round ends otherwise, including an hourly pg_cron sweep that closes games started more than 12 h ago; accepted boundary: the game's creator watching the database live (for a round abandoned without a reveal, up to about 13 h after the game started) or turning on extra logging (context/changes/first-live-round/research.md, D1; reviews/plan-review.md, F1).
- **AGENTS.md, Testing**, wiersz:
  > `supabase test db` (pgTAP, `supabase/tests/`): the creator's view of the database (catalog, grants, publication, leftover rows), CI job `db` only. Locally it needs Docker, and with `--linked` it would run against production, so the command asks first (`.claude/settings.json`).

#### 3. Reguła „ask” dla `supabase test`

**File**: `.claude/settings.json`

**Intent**: `supabase test db --linked` uruchomiłby testy na produkcyjnej bazie (lessons.md, wpis 1).

**Contract**: `permissions.ask` dostaje `Bash(npx supabase test*)` i `Bash(supabase test*)`. `npm run test:hooks` zostaje zielony (zmiana nie dotyka hooków).

#### 4. Kontrakt rundy dla testów (wspólny z fazą 2)

**File**: `tests/db/support/rounds.ts` (nowy)

**Intent**: Helpery, które wołają funkcje rundy tymi samymi drzwiami co gracze. Seedujące rzucają (tylko w `beforeAll`), a sondujące zwracają `{data, error}`, jak w `tests/db/support/rooms.ts`.

**Contract** (nazwy i kształty ustalone tu, implementuje je faza 2):
- `start_game(p_room_id uuid, p_question_id text) → jsonb`, wykonuje tylko `authenticated`. Zwraca `{ok:true}` albo `{ok:false, reason}`, gdzie `reason ∈ {room_unknown, room_closed, game_started, not_enough_players, invalid_question}`. Pokój innego hosta daje `room_unknown`.
- `cast_vote(p_room_id uuid, p_target text, p_player_token text default null) → jsonb`, wykonują `anon` i `authenticated`.
  - Głosujący: host przez `auth.uid()`, gość przez token, jak `room_lobby`.
  - `p_target` to nick z listy pokoju albo `null` (wstrzymanie się).
  - Zwraca `{ok:true}` bez niczego więcej albo `{ok:false, reason}`, gdzie `reason ∈ {room_unknown, room_closed, no_round, round_revealed, already_voted, unknown_target}`.
  - Zły format tokenu daje wyjątek `22023`, jak w `join_room`.
- `reveal_round(p_room_id uuid) → jsonb`, wykonuje tylko `authenticated`. Zwraca `{ok:true}` (także gdy runda już odsłonięta) albo `reason ∈ {room_unknown, room_closed, no_round}`.
- `room_lobby` zwraca dotychczasowe pola i dodatkowo klucz `round`, z **dokładnie** takim zbiorem kluczy:
  - w lobby: `null`;
  - przy głosowaniu: `{number, question_id, phase:"voting", voted:[nick…], me_voted}`, gdzie `voted` jest w kolejności miejsc, nie oddania;
  - po odsłonie: `{number, question_id, phase:"revealed", results:[{nick, votes}…], abstained, ballots}`, gdzie `results` obejmuje wszystkich uprawnionych, także z zerem, w kolejności miejsc.
- `room_link` dla gry w toku zwraca `{status:"started", room_id}`.
- `join_room` dla gry w toku zwraca `reason:"game_started"`.

#### 5. Testy reguł rundy (#3)

**File**: `tests/db/round-rules.test.ts` (nowy)

**Intent**: Reguły PRD sprawdzane drzwiami ról (klucz publishable, gość i host). Wyrocznia z PRD (FR-008, FR-009, US-01) i z decyzji, z ręcznie rozpisanym scenariuszem, nigdy liczona kodem.

**Contract**:
- **Hosty:** 2 konta. Drugi tylko do „nick z innego pokoju”.
- **Scenariusz główny:** Host, Ola, Bartek, Kuba. Głosy: Host→Ola, Ola→Ola (na siebie), Bartek→Ola, Kuba wstrzymuje się. Po 4. głosie runda jest odsłonięta sama, z wynikiem Ola 3, Host 0, Bartek 0, Kuba 0, `abstained` 1, `ballots` 4.
- **Przypadki:**
  - drugi głos tego samego gracza (ten sam token, czyli „po odświeżeniu”) daje `already_voted`, a liczby się nie zmieniają;
  - głos na nick spoza pokoju albo z pokoju drugiego hosta daje `unknown_target`;
  - przewinięcie po 1 głosie (osobny pokój) daje odsłonę z liczbami, bez progu (D3);
  - głos po odsłonie daje `round_revealed`;
  - drugie odsłonięcie daje `{ok:true}`, a wynik jest ten sam;
  - start przy 2 graczach daje `not_enough_players`, start drugi raz `game_started`, start w zamkniętym pokoju `room_closed`;
  - gość wołający `start_game` albo `reveal_round` dostaje `42501`;
  - inny host dostaje `room_unknown`;
  - głos w lobby daje `no_round`;
  - wejście po starcie daje `game_started`;
  - `room_link` pokoju w grze daje `started`;
  - nieprawidłowy format id pytania daje `invalid_question`;
  - kontrola pozytywna: zwykły głos daje `ok: true` (`toMatchObject`). Dokładny zbiór kluczy odpowiedzi sprawdza wyłącznie `round-anonymity.test.ts`, żeby próbny alarm (b) z fazy 5 zaświecił dokładnie jeden test.
- Warunki wstępne tylko w `beforeAll`. Bez `beforeEach`/`afterEach` (test-plan §6.2).

#### 6. Testy anonimowości przez drzwi ról (#1)

**File**: `tests/db/round-anonymity.test.ts` (nowy)

**Intent**: Żadna rola nie dostaje pary ani liczb przed odsłoną, a po rundzie nie zostaje nic do połączenia. Antywzorce z test-plan §2: „tylko kolumny tabeli” i rola, która omija uprawnienia.

**Contract**:
- **Host:** 1 konto.
- Odpowiedź `cast_vote` to dokładnie `{ok:true}`.
- `round` w trakcie głosowania ma dokładnie klucze z kontraktu (bez liczb), widziane jako gość i jako host.
- REST na `rounds`, `round_results`, `ballot_boxes`, `round_voters` (z prefiksem schematu i bez) daje odmowę: schemat `private` nie jest wystawiony. To strażnik zielony od pierwszego dnia (API wystawia dziś tylko `public` i `graphql_public`, `supabase/config.toml:13`): pilnuje, żeby żadna migracja nie wystawiła `private`. Nie seeduje rundy, więc nie zależy od `beforeAll` z funkcjami rundy.
- Po zamknięciu pokoju w trakcie rundy (`create_room` z potwierdzeniem) stary pokój zwraca `closed`, bez liczb.
- Odpowiedź z odmową (`already_voted`) nie zawiera celu ani `details`.

#### 7. Testy widoku twórcy (pgTAP) i krok CI

**File**: `supabase/tests/round_creator_view.test.sql` (nowy), `.github/workflows/ci.yml` (job `db`)

**Intent**: To, czego klucz publishable nie widzi: katalog, granty, publikacja i resztki po rundzie, widziane rolą właściciela (`postgres`) na jednorazowej bazie CI.

**Contract**:
- **Kontrola pozytywna, zielona od razu:** `player_secrets` bez `select` dla `anon`.
- **Tabele `private.ballot_boxes` i `private.round_voters`:** `relpersistence = 'u'`.
- **Każda tabela rundy** (`private.rounds`, `round_results`, `ballot_boxes`, `round_voters`):
  - bez uprawnień dla `anon`/`authenticated` (`has_table_privilege`);
  - poza `pg_publication_tables` dla `supabase_realtime`;
  - bez kolumn typu czas, `serial` ani `identity`.
- **`round_results`** nie ma kolumny głosującego (tylko `round_id`, `player_id` celu, `votes`).
- **Po rundzie** rozegranej funkcjami jako role (`set local role`, `request.jwt.claims`) i odsłoniętej: 0 wierszy w `ballot_boxes` i `round_voters` dla tej rundy.
- **Po rundzie porzuconej** przez `create_room` z potwierdzeniem: także 0.
- **Sprzątanie przerwanych gier** (plan-review F1), przez bezpośrednie wywołanie `private.close_stale_games()` bez czekania na harmonogram:
  - pokój `playing` z `started_at` cofniętym o ponad 12 h: status `closed`, 0 wierszy urny;
  - pokój `playing` rozpoczęty przed chwilą: bez zmian, urna nietknięta;
  - pokój `lobby` z `created_at` cofniętym o ponad 12 h: bez zmian;
  - w `cron.job` jest zadanie `close-stale-games` z harmonogramem `0 * * * *` i poleceniem `select private.close_stale_games()`.
- `authenticated` nie ma `usage` na schemacie `private`.
- **Pisanie asercji:** kontrola pozytywna pierwsza w pliku. Asercje rundy przez funkcje pgTAP, które przy brakującym obiekcie zwracają `not ok`, a nie błąd: `has_table`, `table_privs_are`, `hasnt_column`, `to_regclass(…)` zamiast rzutowania `::regclass`, wywołania funkcji rundy przez `lives_ok`. Dzięki temu w fazie 1 każda asercja raportuje się osobno, a plik nie kończy się na pierwszym brakującym obiekcie. `supabase test db` sam włącza i sprząta rozszerzenie `pgtap`.
- **CI:** krok `supabase test db` po Vitest, z `if: success() || failure()`.

#### 8. Gołe odwołania do dokumentów

**File**: `tests/db/roles.test.ts:15,30,123,275`, `tests/db/nicks.test.ts:7,56`, `tests/db/support/nick-pairs.ts:1,6,9`, `tests/db/support/print-nick-pairs.ts:3-4`, `context/foundation/roadmap.md:136,173`

**Intent**: Odwołania „research.md §…”, „(plan, Phase 3)” i stara ścieżka `context/changes/one-click-host-login/` wskazują pełne ścieżki w archiwum (`research.md`, „Open Questions”).

**Contract**: Treść testów bez zmian. Zmienia się tylko nazwa `describe` w `nicks.test.ts:56`, co trzeba odnotować w opisie PR.

### Success Criteria:

#### Automated Verification:

- Lokalnie zielone: `npm run lint`, `npx astro check`, `npm test`, `npm run test:hooks`, `npm run build`
- CI na szkicu PR: `ci`, `smoke` i `e2e` zielone
- CI `db`: stare 53 testy bez zmian (40 zielonych, 13 oczekiwanych porażek); testy z `round-rules.test.ts` i `round-anonymity.test.ts` czerwone z powodu wpisanego w opisie commita (brak funkcji rundy, widoczny w logu `--reporter=verbose`), poza strażnikami wypisanymi tam jako zielone od początku; krok pgTAP uruchomiony, kontrola pozytywna zielona, każda asercja rundy osobno `not ok`

#### Manual Verification:

- Karol akceptuje brzmienie dopisków w PRD i AGENTS.md

**Implementation Note**: Po tej fazie i zielonej automatycznej weryfikacji poczekaj na akceptację brzmienia przez Karola, zanim zaczniesz migrację.

---

## Faza 2: Baza: urna, stany gry, domknięcie F1/F4

### Overview

Jedna nowa migracja realizuje kontrakt z fazy 1. Testy rundy i pgTAP robią się zielone, a 13 znanych dziur traci znacznik. CI smoke i E2E przechodzą jeszcze na starym kodzie serwera.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/<timestamp>_first_live_round.sql` (przez `npx supabase migration new first_live_round`)

**Intent**: Stany gry, urna i ruchy hosta tylko przez funkcje. Do tego domknięcie F1 i F4. Konwencje z AGENTS.md:
- RLS na każdej nowej tabeli, `revoke all` i jawne granty;
- każda funkcja z `set search_path = ''`, nazwami ze schematem i najpierw `revoke execute`;
- właścicielem funkcji `security definer` jest `postgres`.

**Contract**:
- **Uprawnienia (F1):**
  - odebrać `insert` i `update` na `rooms` oraz `insert` na `players` roli `authenticated`; zdjąć polityki insert/update („Hosts open their rooms”, „Hosts update their rooms”, „Hosts join their open rooms”); polityki select zostają;
  - `create_room` jako `security definer` z tą samą sygnaturą: `p_link_token` przyjmowany i ignorowany, kod linku 22 znaki base64url z `extensions.gen_random_bytes(16)` (zgodny z checkiem :23 i `src/lib/rooms/tokens.ts:6`). Zmiana przez `create or replace`, bo zachowuje odebrane granty (`drop` + `create` przywróciłoby `execute` dla `public` i `anon`, a G2 przechodziłby z innego powodu), plus `alter function … owner to postgres`;
  - odebrać `authenticated` `usage` na `private` i `execute` na `normalize_nick`.
- **Nick (F4, D5 W2):**
  - `private.normalize_nick` (wyświetlanie) usuwa dodatkowo U+061C, U+180F, U+1BCA0–1BCA3 i U+1D173–1D17A;
  - nowa `private.nick_key(text)` (immutable) = `normalize_nick` + usunięcie U+FE00–FE0F, U+E0100–E01EF i U+E0000–E007F;
  - `players.nick_key` jako kolumna generowana `stored`. Kolejność w migracji: najpierw nowa `normalize_nick`, potem `nick_key` i kolumna, bo kolumna `stored` liczy się raz przy dodaniu i nie przelicza się po późniejszej zmianie funkcji;
  - ograniczenie `players_room_nick_key` przeniesione na `(room_id, nick_key)` pod **tą samą nazwą**;
  - `char_length(p_nick) > 100` daje `invalid_nick` przed normalizacją, w `join_room` i `create_room` (w `create_room` normalizacja przechodzi z `declare` do ciała).
- **Stany:**
  - check `status in ('lobby','playing','closed')`;
  - indeks `rooms_one_open_per_host` (ta sama nazwa) dla `status in ('lobby','playing')`;
  - `rooms.started_at timestamptz null`, ustawiane raz przez `start_game`. To czas startu gry, nie głosu, i leży w `rooms`, a nie w tabelach rundy. Liczy od niego sprzątanie przerwanych gier (#1b).
- **Tabele w `private`** (RLS, `revoke all`, bez grantów i polityk):
  - `rounds`: `id`, `room_id` → `rooms` cascade, `number`, `question_id` z checkiem formatu `^[a-z0-9-]+-[0-9]{3}$`, `phase in ('voting','revealed')`, `eligible uuid[]`, `abstained int null`, `ballots int null`; unikalne `(room_id, number)` i `(room_id, question_id)`;
  - `round_results`: `round_id`, `player_id`, `votes`; PK `(round_id, player_id)`;
  - `unlogged ballot_boxes`: `round_id` PK, `tally jsonb`, `abstained int`;
  - `unlogged round_voters`: `round_id`, `player_id`; PK `(round_id, player_id)`.
- **Funkcje rundy** zgodne z kontraktem fazy 1, z niezmiennikami urny i kolejnością blokad:
  - `start_game`: lista uprawnionych = gracze w pokoju w chwili startu; ustawia `status = 'playing'` i `started_at = now()`;
  - `cast_vote`: automatyczna odsłona, gdy liczba głosujących = liczba uprawnionych;
  - `reveal_round`;
  - prywatne `private.finish_round(round_id)`: wyniki dla wszystkich uprawnionych, `abstained` i `ballots`, faza `revealed`, skasowanie wierszy urny;
  - prywatne `private.drop_round_state(room_id)`.
- **Zmiany istniejących funkcji:**
  - `room_lobby` dokłada `round`;
  - `room_link` dla `playing` zwraca `started`;
  - `join_room` dla `playing` zwraca `game_started`;
  - `create_room` zamyka pokój w stanie `lobby` albo `playing` (to samo potwierdzenie przy gościach) i woła `drop_round_state`.
- **Granty:**
  - `start_game` i `reveal_round` → `authenticated`;
  - `cast_vote` → `anon` i `authenticated`;
  - pomocnicze bez grantów.
- **Nagłówek migracji** wymienia niezmienniki urny i odsyła do `research.md` D1.

#### 1b. Migracja sprzątająca przerwane gry (plan-review F1)

**File**: `supabase/migrations/<timestamp>_close_stale_games.sql` (przez `npx supabase migration new close_stale_games`, po migracji rundy)

**Intent**: Runda przerwana bez odsłony i bez nowej gry nie może zostawić urny na tygodnie. Osobny plik, żeby ewentualna odmowa rozszerzenia nie blokowała migracji rundy.

**Contract**:
- `create extension if not exists pg_cron with schema pg_catalog` (supabase.com/docs/guides/cron/install).
- `private.close_stale_games()`: `security definer`, właściciel `postgres`, `set search_path = ''`, bez grantów.
  - Blokuje najpierw wiersze `rooms` w stanie `playing` z `started_at < now() - interval '12 hours'` (`for update skip locked`, więc nie czeka na trwający głos), potem ustawia `status = 'closed'` i woła `private.drop_round_state`, tak jak `create_room`.
  - Odsłonięte wyniki (same liczby) zostają.
  - Nie rzuca wyjątków z danymi: historia zadań (`cron.job_run_details`) zapisuje treść błędu.
- `cron.schedule('close-stale-games', '0 * * * *', 'select private.close_stale_games()')`. Ta sama nazwa nadpisuje zadanie, więc ponowne uruchomienie migracji go nie dubluje.

#### 2. Testy po migracji

**File**: `tests/db/roles.test.ts`, `tests/db/support/nick-pairs.ts`, `tests/db/support/rooms.ts`

**Intent**: Kryteria akceptacji roadmapy i testy, które zmieniają się razem z kontraktem.

**Contract**:
- Zdjąć `it.fails` z H1, H2a, H2b i H3. Nazwy zostają bez prefiksu „znana dziura” (test-plan §6.2: zdjąć znacznik, nie usuwać testu).
- Pary 11–19: `knownHole: false`.
- Nowe pary z decyzji D5 (W2), oczekiwanie `nick_taken`: „Ola❤” vs „Ola❤️”, czarna flaga vs flaga Szkocji (sekwencja znaczników), „#” vs „#️”. Każda z polem `why` odsyłającym do D5.
- `seedRoom` czyta kod linku z `readOwnRoom` (już nie z generatora). Parametr `p_link_token` dalej wysyłany, bo sygnatura zostaje.
- Komentarz G2 (`roles.test.ts:157-160`) zaktualizowany: `create_room` jest już `definer`. Asercja `42501` z nazwą funkcji zostaje.

### Success Criteria:

#### Automated Verification:

- CI `db`: wszystkie testy zielone, 0 oczekiwanych porażek; testy F1 (4) i F4 (9) przechodzą bez znacznika
- CI `db`: krok pgTAP zielony
- CI `smoke` i `e2e` zielone na niezmienionym kodzie serwera (dowód kolejności wdrożenia)
- Lokalnie zielone: `npm run lint`, `npx astro check`, `npm test`, `npm run build`

#### Manual Verification:

- Przegląd migracji pod niezmienniki urny: żadna funkcja nie zapisuje w transakcji głosu nic poza wierszem głosującego i licznikiem, nie zwraca celu, nie ma kolumn czasu

**Implementation Note**: Po zielonym CI tej fazy kontynuuj; przegląd migracji to lista kontrolna implementującego, potwierdzona w opisie commita.

---

## Faza 3: Serwer rundy

### Overview

Worker obsługuje start, głos i odsłonę, podaje ekranom stan rundy z tekstem pytania i loguje tylko dozwolone pola. Domyka ścieżki, które zakładały lobby (P6, G2, L3, ekran hosta, `/j/`), i przyjmuje zgłoszenia z przeglądarki (D4). Każdy czysty moduł powstaje test-first.

### Changes Required:

#### 1. Logi z listą dozwolonych pól (T6)

**File**: `src/lib/log.ts` (nowy), `src/lib/rooms/server.ts`, `src/lib/live-sync/server.ts`, `tests/unit/log.test.ts` (nowy)

**Intent**: Jeden helper zamiast ręcznych `{status, code}`, z listą pól, które wolno zapisać (audyt §6 krok 2, P5, P6, L6).

**Contract**:
- Dozwolone pola: `op`, `route`, `step`, `roomId`, `status`, `code`, `errName`, `field`, `event`, `state`, `outcome`. Inne klucze są odrzucane.
- `logFailure`, `unexpectedShape` (z nazwą pola, które nie przeszło) i błąd dzwonka (z `roomId`) korzystają z helpera.
- Test jednostkowy: pola z listy przechodzą, a nick, token, cel i `url` są odcinane.

#### 2. Typy i parser stanu pokoju (P6, L4)

**File**: `src/lib/rooms/shared.ts`, `src/lib/rooms/server.ts`, `tests/unit/room-state.test.ts` (nowy)

**Intent**: Nowe stany przechodzą przez jeden parser, który mówi, które pole nie przeszło.

**Contract**:
- `RoomStatus = "lobby" | "playing" | "closed"`.
- `RoundState` to unia faz `voting`/`revealed` z kluczami z kontraktu fazy 1.
- `LobbyState` dostaje `round: RoundState | null`.
- Ekran dostaje `RoomView` = `LobbyState` z `round.question` (tekst), dołożonym przez Worker.
- Parser odrzuca brak pól i złe typy (zwraca nazwę pola). Test jednostkowy obejmuje każdą fazę, nieznany status i brak pola.

#### 3. Losowanie pytania (T3)

**File**: `src/lib/rounds/draw.ts` (nowy, tylko serwer), `tests/unit/draw.test.ts` (nowy)

**Intent**: Czysta funkcja z wstrzykiwanym losowaniem, z wyrocznią z PRD (FR-015, US-01).

**Contract**:
- `drawQuestion({categories, adultCategories}, random)` zwraca `QuestionId | null`.
- Tylko pytania z kategorii obecnych w `CATEGORIES` i wybranych przez hosta. Pytanie 18+ tylko z kategorii w `adultCategories`. Nieznane nazwy kategorii są pomijane (`review-fixes.md:16`). Pusta pula daje `null`.
- `questionText(id)`: tekst albo `null` dla nieznanego id.
- Test jednostkowy z ręcznie wybranymi przypadkami (także kategoria bez pytań 18+ zaznaczona jako 18+).

#### 4. Komunikaty odmów (G2)

**File**: `src/lib/rooms/errors.ts`, `tests/unit/room-errors.test.ts`

**Intent**: Każdy kod odmowy z funkcji rundy i z wejścia ma własny polski komunikat zamiast „Coś poszło nie tak”.

**Contract**:
- Nowe kody: `game_started`, `not_enough_players`, `no_questions`, `invalid_question`, `already_voted`, `round_revealed`, `unknown_target`, `no_round`.
- Eksportowana lista `ROUND_REFUSALS`.
- Test: każdy kod z listy ma tekst inny niż ogólny, bez przepisywania tekstów do asercji (test-plan §6.1).

#### 5. Helpery RPC i ścieżki hosta

**File**: `src/lib/rooms/server.ts`, `src/pages/index.astro`

**Intent**: Wywołania funkcji rundy tym samym `callRpc` (zawsze POST, cel w treści) i strona hosta widząca grę w toku.

**Contract**:
- `startGame`, `castVote`, `revealRound`; `roomLobby` z nowym parserem; `hostRoomCategories` (select przez RLS).
- `hostOpenRoomId` szuka `status in (lobby, playing)`, więc „Wróć do pokoju” i potwierdzenie zamknięcia działają przy grze w toku.
- Parser odpowiedzi `room_link` (`server.ts:14-15, 93-99`) przyjmuje `{status:"started", room_id}`. Dziś każdy stan spoza open/closed/unknown traktuje jako nieoczekiwany, więc `/j/` dałby 500.

#### 6. Endpointy rundy i stan

**File**: `src/pages/api/rooms/[id]/start.ts`, `vote.ts`, `reveal.ts` (nowe), `src/pages/api/rooms/[id]/lobby.ts`, wspólny `src/lib/rooms/json-route.ts` (nowy)

**Intent**: Akcje z ekranu przez `fetch` JSON (natychmiastowe potwierdzenie głosu, NFR `prd.md:139`) i stan z tekstem pytania.

**Contract**:
- Każdy endpoint `POST` wymaga `Content-Type: application/json` (inaczej 415) i `Origin` równego origin aplikacji (inaczej 403 z linią logu `{op, step:"origin"}`).
- **Kody:** sukces 200 `{ok:true}`; odmowa 409 `{error:<kod>}`; ktoś spoza pokoju 404; awaria 503/500.
- **`start`:** host. Pobiera kategorie, losuje, woła `start_game`, `no_questions` przy pustej puli.
- **`vote`:** `{target: string | null}`, gracz po ciasteczku albo host po sesji. Odpowiedź bez celu.
- **`reveal`:** host.
- Po każdej udanej akcji `ringLobby`. Jedna linia logu na próbę `{op, outcome, roomId}`.
- **`GET lobby`:**
  - zwraca `RoomView` z tekstem pytania;
  - nieznane id pytania daje tekst zastępczy i linię logu, nie 500;
  - przy `null` z `room_lobby` linia logu `{route, roomId, hasUser, hasPlayerCookie}` (L3).

#### 7. Strony `/r/` i `/j/`, wejście gościa

**File**: `src/pages/r/[id].astro`, `src/pages/j/[token].astro`, `src/pages/api/rooms/join.ts`

**Intent**: Gracz otwierający link z Discorda w trakcie gry wraca do pokoju, obcy dostaje czytelną odmowę.

**Contract**:
- `/r/` przekazuje `RoomView`; link tylko w lobby.
- `/j/` przy `started`: z ważnym ciasteczkiem przekierowanie 302 na `/r/<id>`, bez niego komunikat „Gra już trwa”.
- `join.ts` mapuje `game_started` na `?error=game_started`.

#### 8. Zgłoszenia z przeglądarki (D4, serwer)

**File**: `src/pages/api/client-events.ts` (nowy), `src/lib/client-events.ts` (nowy, walidator), `tests/unit/client-events.test.ts` (nowy)

**Intent**: Wąskie wejście na zdarzenia z ekranu, z polami wyłącznie z listy.

**Contract**:
- `POST` JSON `{event, state?, roomId?}`:
  - `event ∈ {realtime_status, refresh_failed, island_crash}`;
  - `state ∈ {CHANNEL_ERROR, TIMED_OUT, CLOSED, http_4xx, http_5xx, network}`;
  - `roomId` w formacie UUID.
- Poprawne: linia `{op:"client", event, state, roomId}`, odpowiedź 204. Inne: 400 bez logowania treści.
- Test jednostkowy walidatora (odrzuca dodatkowe pola i wartości spoza list).

### Success Criteria:

#### Automated Verification:

- Nowe testy jednostkowe zielone: `npm test` (log, room-state, draw, room-errors, client-events)
- `npm run lint`, `npx astro check`, `npm run build` zielone
- CI zielone (także `db` i pgTAP, `smoke` i `e2e` lobby)

#### Manual Verification:

- Przegląd: żaden nowy `console.*` poza helperem z listą pól; cel głosu nigdzie w URL ani w logu

**Implementation Note**: Kontynuuj po zielonym CI; przegląd logów potwierdź w opisie commita.

---

## Faza 4: Ekrany rundy

### Overview

Gracze widzą start, głosowanie, „kto już zagłosował”, odsłonę i stan przerwanego połączenia. Ekran pobiera stan przez ogranicznik i wysyła filtrowane zgłoszenia. Karol ocenia ekrany na zrzutach.

### Changes Required:

#### 1. Ogranicznik pobierania (T5, F2)

**File**: `src/lib/live-sync/limiter.ts` (nowy), `tests/unit/limiter.test.ts` (nowy)

**Intent**: Seria dzwonków daje ograniczoną liczbę pobrań, a ostatni dzwonek zawsze kończy się pobraniem (ryzyko #7, budżet 2 s).

**Contract**:
- Najwyżej jedno pobranie w locie i jedno „na koniec”, z odstępem ≥ 500 ms od startu do startu.
- Limit czasu pobrania 3 s, który zwalnia miejsce.
- Gdy stan po parserze jest taki sam jak przy poprzednim pobraniu (porównanie JSON, bo `room_lobby` nie zwraca wersji), odstęp się podwaja, do `LOBBY_POLL_MS`. Zmiana stanu wraca do 500 ms. Ogranicznik dostaje z zewnątrz tylko wynik „zmieniło się / nie”.
- Test jednostkowy z kontrolowanym czasem (vitest fake timers) obejmuje: serię 20 dzwonków, zawieszone pobranie, wycofanie przy niezmienionym stanie i pobranie po ostatnim dzwonku.

#### 2. Stan pokoju na żywo w ekranie

**File**: `src/components/room/useRoomState.ts` (nowy), `src/components/room/RoomLobby.tsx`, `src/components/room/RoomScreen.tsx` (nowy)

**Intent**: Jedno miejsce na kanał, odpytywanie i awarie, dla lobby i gry w toku (L1, L2, L3, L4).

**Contract**:
- Nasłuch w stanach `lobby` i `playing`.
- Pobranie przez ogranicznik i parser z fazy 3.
- `CHANNEL_ERROR`, `TIMED_OUT` i `CLOSED` dają napis „Połączenie na żywo przerwane — odświeżam”, odpytywanie co 5 s tylko w tym stanie i ponowną subskrypcję po `CLOSED`.
- Zgłoszenie do `/api/client-events` tylko przy widocznej karcie i ponad 5 s bez `SUBSCRIBED` albo po nieudanym pobraniu, najwyżej 3 na typ zdarzenia na stronę (D4).
- 404 dalej przeładowuje stronę, ale tylko raz na wejście.
- `RoomScreen` wybiera widok po stanie i fazie.

#### 3. Widoki

**File**: `src/components/room/RoomLobby.tsx`, `RoundVoting.tsx`, `RoundReveal.tsx`, `LiveBanner.tsx` (nowe), `src/lib/rooms/results.ts` (nowy), `tests/unit/results.test.ts` (nowy)

**Intent**: Ekrany z decyzji D2, D3 i wywiadu planu, na tokenach i komponentach `src/components/ui` (AGENTS.md, UI).

**Contract**:
- **Lobby hosta:** „Zacznij grę”, nieaktywne przy < 3 graczach, z podpowiedzią.
- **Głosowanie:**
  - „Kto z nas najprawdopodobniej {pytanie}?”;
  - wybór jednej osoby z listy (także siebie, ze znacznikiem „ty”) albo „Wstrzymuję się”, potem „Zagłosuj”;
  - po głosie „Głos oddany” z informacją, że nie da się go zmienić;
  - lista graczy ze znacznikiem „zagłosował(a)”;
  - host ma „Odsłoń wynik”;
  - po przeładowaniu: „Głos oddany” z `me_voted`, bez celu.
- **Odsłona:** wszyscy gracze od największej liczby głosów, remis według kolejności miejsc, zera przygaszone na dole, „Wstrzymało się: N”. Host widzi „Kolejne pytania wkrótce” i „Nowa gra” (link na `/`). Zmiana fazy ogłaszana przez `aria-live`.
- **Sortowanie:** czysta funkcja `sortResults` z testem jednostkowym (remisy, zera, wyrocznia rozpisana ręcznie).

#### 4. Strona stanów

**File**: `src/pages/dev/room-states.astro`

**Intent**: Wszystkie nowe stany do oceny na zrzutach (`scripts/ui-literals.mjs` obejmuje już `src/components/room/`).

**Contract**: Nowe sekcje:
- lobby hosta z „Zacznij grę” aktywnym i nieaktywnym;
- głosowanie gościa przed głosem i po głosie;
- głosowanie hosta z „Odsłoń wynik”;
- odsłona gościa i hosta, z zerami i wstrzymaniami;
- odsłona po 1 głosie;
- napis o przerwanym połączeniu;
- 20 graczy z długimi nickami i emotką.

### Success Criteria:

#### Automated Verification:

- `npm test` zielone (limiter, results)
- `npm run lint` (z kontrolą literałów UI), `npx astro check`, `npm run build` zielone
- CI zielone

#### Manual Verification:

- Karol ocenia zrzuty wszystkich nowych stanów `/dev/room-states` (telefon i komputer) i akceptuje albo zgłasza poprawki
- Fokus i czytnik ekranu: przyciski głosowania osiągalne klawiaturą, zmiana fazy ogłaszana

**Implementation Note**: Po zielonej weryfikacji automatycznej pokaż Karolowi zrzuty (headless Chrome, strona do oceny) i poczekaj na akceptację przed fazą 5.

---

## Faza 5: Test w przeglądarce i smoke z rundą

### Overview

Automatyczny dowód, że runda działa w prawdziwym buildzie w przeglądarce (CI) i na produkcji (smoke). Do tego próbne alarmy dla nowych strażników i aktualizacja planu testów.

### Changes Required:

#### 1. E2E „3 graczy rozgrywa rundę”

**File**: `tests/e2e/round.spec.ts` (nowy), `tests/e2e/support/round.ts` (nowy)

**Intent**: Ryzyko #2 i #3 na poziomie ekranów: wszyscy widzą to samo pytanie i tę samą odsłonę. Bez pomiaru czasu (test-plan §6.4: „No 2 s here”).

**Contract**:
- Host (`page`) i 2 gości (`newGuestContext`).
- Start, ten sam tekst pytania na 3 ekranach.
- Głosy: host→Gość A, Gość A→Gość A, Gość B wstrzymuje się.
- Na 3 ekranach odsłona: Gość A 2, pozostali 0, „Wstrzymało się: 1”.
- Nazwy elementów po roli i dostępnej nazwie.

#### 2. Kroki smoke

**File**: `scripts/smoke.mjs`

**Intent**: Runda i reguła nicku sprawdzane po każdym wdrożeniu na produkcji.

**Contract**:
- Helper `request` przyjmuje treść JSON.
- **W lobby:** „Ola”+U+FE0F daje `nick_taken` (`review-fixes.md:28`).
- **Kroki rundy:** host startuje; trzeci gość dostaje `game_started`; Ola, drugi gość i host głosują; stan pokoju pokazuje odsłonę z liczbami zgodnymi z głosami; głos po odsłonie daje 409 `round_revealed`; `/j/<kod>` z ciasteczkiem Oli przekierowuje do pokoju.
- Istniejące kroki zamknięcia pokoju działają na grze w toku.
- Opis kroków bez celów głosów w wydruku.
- `SMOKE_ROUND=0` pomija kroki rundy (smoke na produkcji ze starym Workerem, faza 6). W tej samej zmianie reguła `ask` `Bash(SMOKE_ROUND=* npm*smoke*)` w `.claude/settings.json` (lessons.md, wpis 1).

#### 3. Próbne alarmy (test-plan §6.2, break-check)

**File**: tymczasowe commity na gałęzi, cofnięte `git revert`

**Intent**: Dowód, że nowi strażnicy potrafią zaświecić na czerwono.

**Contract**:
- **(a)** Tymczasowa migracja zmienia `ballot_boxes` na logowaną. Ma zaświecić tylko asercja `relpersistence` w pgTAP.
- **(b)** `cast_vote` zwraca dodatkowo liczbę głosów celu. Ma zaświecić tylko test „odpowiedź to dokładnie `{ok:true}`” w `round-anonymity.test.ts`.
- Opis commita wymienia testy, które mają zaświecić. Po porównaniu `git revert`.
- Na końcu `git diff main...HEAD -- supabase/migrations` pokazuje tylko migrację rundy i migrację sprzątającą.

#### 4. Plan testów

**File**: `context/foundation/test-plan.md`

**Intent**: Cookbook i stos zgodne z tym, co powstało.

**Contract**:
- §4: wiersz pgTAP (CI, widok twórcy); liczba kroków smoke; E2E rundy.
- §5: bramka E2E rundy wymagana od teraz.
- §6.2: wyjątek pgTAP, konta na przebieg 10.
- §6.3: wzorzec testu anonimowości (dokładny zbiór kluczy, `private` niewystawiony, pgTAP: nielogowane, bez grantów, poza publikacją, brak resztek).
- §6.4: spec rundy.
- §6.5: kroki JSON.
- §6.6: notatka fazy 2.

### Success Criteria:

#### Automated Verification:

- CI `e2e` zielone z `round.spec.ts`
- CI `smoke` zielone z krokami rundy i FE0F
- Próbne alarmy (a) i (b) zaświeciły dokładnie przewidziane testy, a po `git revert` CI znów zielone
- `git diff main...HEAD -- supabase/migrations` zawiera wyłącznie migracje `*_first_live_round.sql` i `*_close_stale_games.sql`

#### Manual Verification:

- Wynik próbnych alarmów opisany w PR (który test, na czym zaświecił)

**Implementation Note**: Kontynuuj do fazy 6 po zielonym CI.

---

## Faza 6: Przegląd i wdrożenie

### Overview

Przegląd implementacji, a potem wdrożenie w kolejności „baza, smoke na starym kodzie, scalenie, smoke”. Na koniec ręczna runda Karola.

### Changes Required:

#### 1. Przegląd

**File**: `context/changes/first-live-round/reviews/impl-review.md`

**Intent**: `/10x-impl-review first-live-round` i triage z Karolem. Po poprawkach uruchomić lokalnie zmienione skrypty i przeklikać zmienione ekrany na `/dev/room-states` (lessons.md, wpis 3).

**Contract**: Każde ustalenie z decyzją (poprawione albo odłożone z powodem).

#### 2. Wdrożenie

**File**: — (polecenia)

**Intent**: Kolejność z „Critical Implementation Details”.

**Contract**:
1. PR „ready for review”, CI zielone.
2. `npx supabase db push` (pytanie), obie migracje. Jeśli padnie na `players_room_nick_key` (kolizja istniejących nicków) albo na `pg_cron`, zatrzymać się i zgłosić Karolowi.
3. `BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke` na starym Workerze (pytanie). Kroki rundy mają tu oczekiwaną porażkę, bo stary Worker nie ma endpointów. Liczy się, że kroki logowania i pokoju są zielone, więc to uruchomienie idzie z `SMOKE_ROUND=0`, które pomija kroki rundy (dodane w fazie 5).
4. Karol scala (`! gh pr merge <n> --merge`). Workers Builds wdraża.
5. Smoke na produkcji z rundą (pytanie).
6. Gałąź usunięta lokalnie i zdalnie.

#### 3. Notatki

**File**: `context/foundation/test-plan.md` (§3 faza 2 `complete`, §6.6), `context/foundation/roadmap.md`

**Intent**: Stan planu testów i roadmapy zgodny z produkcją. Archiwum robi `/10x-archive`.

**Contract**: §6.6 „Phase 2”: 2–3 linie (liczba testów, wynik próbnych alarmów, co pokazała ręczna runda).

### Success Criteria:

#### Automated Verification:

- `npx supabase db push` zakończone bez błędu
- Smoke na produkcji ze starym Workerem (`SMOKE_ROUND=0`) zielony
- Workers Builds po scaleniu zielone
- Smoke na produkcji z rundą zielony

#### Manual Verification:

- Karol rozgrywa rundę: laptop (host) + telefon + okno incognito
  - to samo pytanie na 3 ekranach
  - głos z potwierdzeniem
  - widać, kto zagłosował
  - odsłona od razu po 3. głosie, liczby zgodne
- W trakcie tej rundy: odświeżenie telefonu pokazuje „Głos oddany”; ponowne otwarcie linku z Discorda wraca do pokoju; czwarte okno bez ciasteczka dostaje „Gra już trwa”
- `/10x-impl-review` zakończone, ustalenia rozstrzygnięte z Karolem
- Dzień po wdrożeniu: panel Supabase (Integrations → Cron) pokazuje udane przebiegi `close-stale-games`

**Implementation Note**: Każde polecenie zmieniające stan zdalny (push, `db push`, smoke) wymaga pytania (AGENTS.md); scala wyłącznie Karol.

---

## Testing Strategy

### Unit Tests:

- **Logi:** lista dozwolonych pól, odcinanie reszty.
- **Parser stanu:** każda faza, nieznany status, brak pola.
- **Losowanie:** kategorie, 18+, nieznane kategorie, pusta pula.
- **Komunikaty odmów:** każdy kod ma własny tekst.
- **Walidator zgłoszeń:** listy wartości, dodatkowe pola.
- **Ogranicznik:** seria dzwonków, zawieszone pobranie, wycofanie, pobranie po ostatnim dzwonku.
- **Kolejność wyniku:** remisy według miejsc, zera.

### Integration Tests:

- **Vitest `db`, klucz publishable, jako gość i jako host:**
  - reguły rundy (#3): scenariusz Host/Ola/Bartek/Kuba i odmowy z fazy 1;
  - anonimowość (#1): dokładne zbiory kluczy, `private` niewystawiony, brak liczb przed odsłoną, porzucona runda;
  - F1 i F4 bez znaczników.
- **pgTAP, rola właściciela, CI:** nielogowane, bez grantów, poza publikacją, bez kolumn czasu, brak resztek po odsłonie i porzuceniu, sprzątanie gier rozpoczętych ponad 12 h temu, brak `usage` na `private`.
- **E2E:** 3 graczy, to samo pytanie, ta sama odsłona.
- **Smoke:** runda i FE0F na produkcji po wdrożeniu.

### Manual Testing Steps:

1. Laptop: zaloguj się, „Nowa gra”, skopiuj link.
2. Telefon i okno incognito: wejdź z linku z dwoma nickami. Host widzi 3 graczy, a „Zacznij grę” jest aktywne.
3. Zacznij grę. Na 3 ekranach to samo pytanie.
4. Zagłosuj z telefonu, odśwież telefon: „Głos oddany”. Na laptopie widać, że telefon zagłosował.
5. Zagłosuj z incognito, potem z laptopa. Odsłona od razu na 3 ekranach, liczby zgodne z głosami.
6. Otwórz link z Discorda na telefonie: wracasz do pokoju. Otwórz link w nowym oknie incognito: „Gra już trwa”.

## Performance Considerations

- **Budżet żądań** (rachunek z `research.md` §4: 20 ekranów, dzwonek na głos, 1 pobranie na dzwonek): ok. 520–620 żądań Workera na rundę i ok. 14 tys. na godzinę przy 20 rundach. Limit 100 tys. dziennie wystarcza na kilka wieczorów. Ogranicznik zmniejsza liczbę pobrań przy głosach w seriach i hamuje spam.
- **Budżet 2 s:** dzwonek (p95 ok. 0,2 s z F-01) + najwyżej 0,5 s odstępu + pobranie z bazy (niezmierzone z `room_lobby` i `getUser()` hosta). Sprawdza go ręczna runda. Pomiar sondą to faza 3 planu testów.
- **Urna:** jedna blokada pokoju na głos szereguje 20 równoczesnych głosów. Transakcje są krótkie, bez znaczenia przy tej skali.

## Migration Notes

- **Dane produkcyjne:**
  - kolumna generowana `nick_key` przelicza istniejące wiersze `players`; kolizja (dwa nicki o tym samym kluczu w jednym pokoju) przerwie migrację w całości, bez skutków, i wymaga decyzji Karola;
  - pokoje `lobby` i `closed` zostają bez zmian.
- **Wycofanie** przez nową migrację, nigdy edycję wgranej (AGENTS.md). Stary Worker działa z nową bazą tylko do pierwszej gry. Gdy istnieje pokój `playing`:
  - stary `parseLobby` (`src/lib/rooms/server.ts:129`) i parser `room_link` (`:93-99`) dają 500 na `/r/<id>` i `/j/<kod>`;
  - `hostOpenRoomId` (`:161`) nie widzi pokoju, więc formularz nie wyśle potwierdzenia zamknięcia i host nie założy nowej gry.

  Cofnięcie samego kodu (`wrangler rollback`, pytanie) jest więc bezpieczne tylko przed pierwszą grą. Później zostaje naprawa do przodu albo cofnięcie razem z nową migracją, która zamyka pokoje `playing` przez `private.drop_round_state`.
- **Po awarii bazy** tabele nielogowane są czyszczone. Runda w toku traci głosy, a gracze mogą zagłosować ponownie. To przyjęty koszt D1.
- **pg_cron** (plan-review F1) jest w obrazie bazy każdego projektu Supabase, ale żadna strona nie mówi wprost o planie darmowym. Gdyby `db push` odmówił rozszerzenia, migracja rundy jest już wgrana osobno: zatrzymać się i zgłosić Karolowi. Zadanie nie chroni projektu przed uśpieniem na planie darmowym i nie musi. Historia zadań rośnie o 24 wiersze na dobę, co przy tej skali nie wymaga sprzątania.

## References

- Research: `context/changes/first-live-round/research.md` (decyzje D1–D6, T1–T9, recenzja)
- Roadmapa S-02: `context/foundation/roadmap.md:127-137`
- Plan testów: `context/foundation/test-plan.md` §2 (#1, #3, #7), §3, §6.2–§6.6
- Audyt: `context/audits/observability/2026-10-11_guest-join-live-lobby.md` (L1, L3, L4, P6, G2, RC1)
- Wzorzec migracji i funkcji: `supabase/migrations/20261007122858_room_lobby.sql`
- Wzorzec testów bazy: `tests/db/roles.test.ts`, `tests/db/support/rooms.ts`
- Wzorzec E2E: `tests/e2e/seed.spec.ts`, `tests/e2e/support/room.ts`
- Wcześniejsze decyzje: `context/archive/2026-09-27-live-sync-spike/measurements.md:102-110`, `context/archive/2026-10-07-room-lobby/follow-ups/review-fixes.md:9-28`, `context/archive/2026-10-10-testing-lobby-foundation/research.md:242, 253-259`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Zasady i testy przed kodem

#### Automated

- [x] 1.1 Lokalnie zielone: `npm run lint`, `npx astro check`, `npm test`, `npm run test:hooks`, `npm run build` — ebcb9c5
- [x] 1.2 CI na szkicu PR: `ci`, `smoke` i `e2e` zielone — ebcb9c5
- [x] 1.3 CI `db`: stare 53 testy bez zmian (40 zielonych, 13 oczekiwanych porażek); testy z `round-rules.test.ts` i `round-anonymity.test.ts` czerwone z powodu wpisanego w opisie commita (brak funkcji rundy, widoczny w logu `--reporter=verbose`), poza strażnikami wypisanymi tam jako zielone od początku; krok pgTAP uruchomiony, kontrola pozytywna zielona, każda asercja rundy osobno `not ok` — ebcb9c5

#### Manual

- [x] 1.4 Karol akceptuje brzmienie dopisków w PRD i AGENTS.md — ebcb9c5

### Phase 2: Baza: urna, stany gry, domknięcie F1/F4

#### Automated

- [x] 2.1 CI `db`: wszystkie testy zielone, 0 oczekiwanych porażek; testy F1 (4) i F4 (9) przechodzą bez znacznika — 4fedd34
- [x] 2.2 CI `db`: krok pgTAP zielony — 4fedd34
- [x] 2.3 CI `smoke` i `e2e` zielone na niezmienionym kodzie serwera (dowód kolejności wdrożenia) — 4fedd34
- [x] 2.4 Lokalnie zielone: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — 4fedd34

#### Manual

- [x] 2.5 Przegląd migracji pod niezmienniki urny: żadna funkcja nie zapisuje w transakcji głosu nic poza wierszem głosującego i licznikiem, nie zwraca celu, nie ma kolumn czasu — 4fedd34

### Phase 3: Serwer rundy

#### Automated

- [x] 3.1 Nowe testy jednostkowe zielone: `npm test` (log, room-state, draw, room-errors, client-events) — 90e3b7c
- [x] 3.2 `npm run lint`, `npx astro check`, `npm run build` zielone — 90e3b7c
- [x] 3.3 CI zielone (także `db` i pgTAP, `smoke` i `e2e` lobby) — 90e3b7c

#### Manual

- [x] 3.4 Przegląd: żaden nowy `console.*` poza helperem z listą pól; cel głosu nigdzie w URL ani w logu — 90e3b7c

### Phase 4: Ekrany rundy

#### Automated

- [x] 4.1 `npm test` zielone (limiter, results) — b5a753e
- [x] 4.2 `npm run lint` (z kontrolą literałów UI), `npx astro check`, `npm run build` zielone — b5a753e
- [x] 4.3 CI zielone — b5a753e

#### Manual

- [x] 4.4 Karol ocenia zrzuty wszystkich nowych stanów `/dev/room-states` (telefon i komputer) i akceptuje albo zgłasza poprawki — b5a753e
- [x] 4.5 Fokus i czytnik ekranu: przyciski głosowania osiągalne klawiaturą, zmiana fazy ogłaszana — b5a753e

### Phase 5: Test w przeglądarce i smoke z rundą

#### Automated

- [x] 5.1 CI `e2e` zielone z `round.spec.ts`
- [x] 5.2 CI `smoke` zielone z krokami rundy i FE0F
- [ ] 5.3 Próbne alarmy (a) i (b) zaświeciły dokładnie przewidziane testy, a po `git revert` CI znów zielone
- [x] 5.4 `git diff main...HEAD -- supabase/migrations` zawiera wyłącznie migracje `*_first_live_round.sql` i `*_close_stale_games.sql`

#### Manual

- [ ] 5.5 Wynik próbnych alarmów opisany w PR (który test, na czym zaświecił)

### Phase 6: Przegląd i wdrożenie

#### Automated

- [ ] 6.1 `npx supabase db push` zakończone bez błędu
- [ ] 6.2 Smoke na produkcji ze starym Workerem (`SMOKE_ROUND=0`) zielony
- [ ] 6.3 Workers Builds po scaleniu zielone
- [ ] 6.4 Smoke na produkcji z rundą zielony

#### Manual

- [ ] 6.5 Karol rozgrywa rundę: laptop (host) + telefon + okno incognito
- [ ] 6.6 W trakcie tej rundy: odświeżenie telefonu pokazuje „Głos oddany”; ponowne otwarcie linku z Discorda wraca do pokoju; czwarte okno bez ciasteczka dostaje „Gra już trwa”
- [ ] 6.7 `/10x-impl-review` zakończone, ustalenia rozstrzygnięte z Karolem
- [ ] 6.8 Dzień po wdrożeniu: panel Supabase (Integrations → Cron) pokazuje udane przebiegi `close-stale-games`
