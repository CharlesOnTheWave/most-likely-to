---
date: 2026-10-13T10:48:50+02:00
researcher: Claude (Opus 5.5)
git_commit: 0a9b6a634a6b5248d0293bb4d333b308bd93894e
branch: main
repository: CharlesOnTheWave/most-likely-to
topic: "S-02 first-live-round + faza 2 planu testów: na czym stoi pierwsza runda (pytanie, anonimowy głos, odsłona) i jak ją bezpiecznie przetestować przed kodem"
tags: [research, s-02, first-live-round, anonymity, round-rules, supabase, realtime, test-plan-phase-2]
status: complete
last_updated: 2026-10-13
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Dopisane decyzje Karola D1–D6 (D3 bez progu)"
---

# Research: pierwsza runda na żywo (S-02) i faza 2 planu testów

**Date**: 2026-10-13T10:48:50+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 0a9b6a634a6b5248d0293bb4d333b308bd93894e
**Branch**: main
**Repository**: CharlesOnTheWave/most-likely-to

## Research Question

Wspólny folder roadmapy S-02 i fazy 2 planu testów (`change.md`). Zbadać, na czym stoi pierwsza runda:

- host klika „start”;
- wszyscy widzą to samo pytanie z wybranych kategorii (18+ tylko tam, gdzie host je dołączył);
- każdy głosuje na jedną osobę albo się wstrzymuje;
- widać, kto już zagłosował;
- po ostatnim głosie albo przewinięciu przez prowadzącego jest odsłona liczb.

Przy tym ugruntować ryzyka #1 (anonimowość) i #3 (reguły rundy) z `context/foundation/test-plan.md` §2, kryteria akceptacji F1/F4 z roadmapy i punkty audytu L1/L3/P6/G2/RC1. Decyzje ponad wiedzę właściciela przejść przez recenzję (adwokat diabła + krytyk).

## Summary

- **Gra ma dziś tylko lobby.** Baza zna dwa stany pokoju, `lobby` i `closed` (`supabase/migrations/20261007122858_room_lobby.sql:25`). Pytania żyją wyłącznie w kodzie (`src/data/questions.ts`, 216 pytań, 8 kategorii), nie w bazie. Nie istnieje żadna funkcja losująca pytanie do rundy ani żadna tabela głosów.
- **Większość założeń rundy jest już zapisana w archiwum.** Kanał na żywo niesie tylko dzwonek bez danych, stan zawsze pochodzi z bazy, a liczby pojawiają się dopiero przy odsłonie (`context/archive/2026-09-27-live-sync-spike/measurements.md:104-110`). Ogranicznik dzwonka ma kształt „jedno pobranie naraz + jedno na koniec” (`context/archive/2026-10-07-room-lobby/follow-ups/review-fixes.md:17-20`). Kryteria F1/F4 opisują testy `it.fails` (§5).
- **Anonimowość wobec twórcy gry to najtrudniejsza część.** Fakty sprawdzone w dokumentacji i kodzie źródłowym (§3):
  - wiersze zapisane w jednej transakcji mają ten sam `xmin`, a właściciel bazy go odczyta;
  - komunikat błędu Postgresa może zawierać wartości wiersza, wraca do wołającego i może trafić do logów;
  - logi Cloudflare i Supabase zapisują adres z parametrami, ale nie treść żądania;
  - darmowy plan Supabase nie ma kopii zapasowych.

  Rekomendacja po recenzji: „urna, która znika”. Stan głosowania siedzi w nielogowanych tabelach w schemacie `private`. Przy odsłonie zostają tylko liczby, a przy porzuceniu rundy nic. Granica, której nie da się domknąć: twórca podglądający bazę na żywo w trakcie rundy. Karol musi ją świadomie przyjąć, a PRD zapisze ją wprost (D1).
- **Recenzja poprawiła cztery rzeczy w moim szkicu:**
  1. Porzucona runda i odsłona po jednym głosie zdradzały parę (D1, D3).
  2. Ścieżki hosta zakładają stan `lobby` (`src/lib/rooms/server.ts:161`, `src/pages/index.astro:20-32`), więc nowy stan je psuje (T1).
  3. W3 nie przechodzi testów F4, a W1 w moim brzmieniu pomijał 4 zakresy znaków (D5).
  4. „Głos tylko w przeglądarce” był rekomendacją recenzenta, nie decyzją. Pozostaje otwarty w S-04.
- **Decyzje dla Karola:** 6 (D1–D6, sekcja „Decyzje do podjęcia”). Decyzje techniczne z uzasadnieniem: T1–T9. Plan ma zacząć od fazy testów #1/#3 (sekcja „Co testować najpierw”).

## Detailed Findings

### 1. Baza i role dziś

- **Tabele** (`supabase/migrations/20261007122858_room_lobby.sql:19-52`):
  - `rooms`: status `lobby|closed` (:25), kategorie i kategorie 18+ jako tablice tekstów (:26-27);
  - `players`: nick, `user_id` tylko dla hosta, `seat` jako kolejność dołączenia, bez znaczników czasu (:34-45);
  - `player_secrets`: sha256 tokenu gościa, bez grantów i bez polityk (:49-52).
- **Jeden otwarty pokój na hosta** pilnuje indeks warunkowy `where status = 'lobby'` (:32). Nowy stan gry musi do niego dojść, inaczej host mógłby otworzyć drugi pokój w trakcie rundy.
- **Host pisze bezpośrednio przez RLS.** Ma granty `select, insert` na `rooms`, `update (status)` na `rooms` i `select, insert` na `players` (:59-61). Polityka update sprawdza tylko `host_id` (:73-76). To są znane dziury F1 (§5.1). `create_room` jest `security invoker` (:140) i korzysta z tych grantów: zamyka stary pokój (:180), wstawia pokój (:184) i wiersz hosta (:188), woła `private.normalize_nick` przez grant `usage`/`execute` (:372-374).
- **Gość działa wyłącznie przez funkcje `security definer`:** `join_room`, `room_link` i `room_lobby` (:204-357), właściciel `postgres` (:362-364).
  - `join_room` blokuje wiersz pokoju `for update` (:227-230). Odmawia każdego stanu innego niż `lobby` kodem `room_closed` (:236-239) z komentarzem „S-02 decides about joining after the start”.
  - `room_link` zamienia każdy stan inny niż `lobby` na `closed` (:292-296).
  - `room_lobby` rozpoznaje hosta po `auth.uid()`, a gościa po hashu tokenu (:324-341). Zwraca `{status, role, me, players[{nick, host}]}` bez id graczy (:343-355).
- **Komunikat w migracji** (:5-6): Supabase przestaje dawać rolom API granty na nowe tabele w `public` dopiero 30.10.2026. Nowa tabela w `public` bez jawnego `revoke` byłaby więc do tego dnia otwarta. Schemat `private` istnieje (:14-15) i nie jest wystawiony w API (`supabase/config.toml:13`: `schemas = ["public", "graphql_public"]`).

### 2. Pytania i losowanie

- **Kształt** (`src/data/questions.ts`):
  - `CATEGORIES`: 8 kategorii `{id, name}` (:21-30);
  - `QuestionEntry` = `{category, text, adult}` (:34-38);
  - `QUESTIONS`: jeden literał, kluczem jest stałe id `<kategoria>-NNN` (:40, :716-718).
- **Reguły w nagłówku pliku** (:5-18): id nigdy się nie zmienia ani nie wraca, bo S-11 zapisze pod nim dane. Kategorii nie wolno wyprowadzać z id (:9-11). Ekran pokazuje „Kto z nas najprawdopodobniej {text}?”.
- **Liczebność** (raport badacza, liczona po tekście pliku): 216 pytań, 27 w każdej kategorii. W 7 kategoriach jest 20 zwykłych i 7 pytań 18+, a w `przyszlosc` 19 zwykłych i 8 pytań 18+.
- **Brak losowania.** Jedyny „losujący” to prototyp F-01 `stateFor` (`src/lib/live-sync/server.ts:28-34`): bierze zwykłe pytanie po `seq % n` i obsługuje gościnny `GET /api/live-sync/state`.
- **Kategorie od formularza do bazy:**
  - `NewGameForm.tsx` wysyła powtarzane pola `category` i `adult`;
  - `POST /api/rooms` sprawdza je z `CATEGORY_IDS` i odrzuca 18+ spoza wybranych (`src/pages/api/rooms/index.ts:26-31`);
  - baza sprawdza tylko kształt (migracja :158-162), więc host przez RPC/REST zapisze dowolne napisy. F1 obejmuje „zapisać dowolne nazwy kategorii” (`review-fixes.md:11`), a archiwum radzi „kategorie z bazy filtrować przez `CATEGORIES` przy losowaniu” (:16).
- **Zasada z lessons:** pytania importujemy tylko w kodzie serwera. Do przeglądarki trafia wyłącznie pytanie bieżącej rundy, jako zwykły tekst (`context/foundation/lessons.md:12-17`).
- **FR-015 „bez pytań z ostatnich wieczorów hosta”** należy do S-12 (`context/foundation/roadmap.md`, S-12 Outcome). W S-02 obowiązują kategorie i 18+ (`roadmap.md:129`). „Bez powtórek w grze” staje się realne w S-03, bo w S-02 jest jedna runda.

### 3. Anonimowość: kanały, którymi para mogłaby wyciec

Twarde zasady:
- AGENTS.md: „Never persist, log or return a pairing of voter and voted-for player, in any form”;
- PRD: „nigdy nie jest pokazywane ani możliwe do odzyskania, także przez hosta i twórcę gry” (`context/foundation/prd.md:143`), „ani razu, ani 200 razy” (:180).

| Kanał | Co zapisuje lub ujawnia | Źródło | Wniosek dla S-02 |
|---|---|---|---|
| Kanał Realtime (publiczny temat `live-sync:<roomId>`) | Każdy z kluczem publishable słucha i nadaje na publicznym kanale. Dziś płynie tylko dzwonek `{seq}` z Workera. | `src/lib/live-sync/server.ts:9-26`, `src/lib/rooms/server.ts:195-211`; supabase.com/docs/guides/realtime/settings („anyone holding your project's anon key can subscribe to and broadcast on any public channel”) | Kanał bez danych o głosach. Fałszywy dzwonek kosztuje tylko zbędne pobranie, co jest sprawą ryzyka #7. |
| Postgres Changes | Wysyła pełne wiersze. Nowe tabele nie trafiają do publikacji `supabase_realtime` same. Tabel nielogowanych nie da się dodać do publikacji. | postgresql.org/docs/17/sql-createpublication.html („Temporary tables, unlogged tables … cannot be part of a publication”); docs Supabase postgres-changes (raport krytyka) | Tabele głosów poza publikacją. Nielogowane z zasady nie mogą do niej trafić. |
| Logi Workera (Workers Logs, 100%, 3 dni na planie darmowym) | Linia wywołania z metodą i URL oraz status odpowiedzi; bez treści żądania i odpowiedzi; zapisuje `console.log`. Tail API maskuje `cookie` i `set-cookie`. Czy trwały magazyn zachowuje parametry adresu, nie sprawdzono. | developers.cloudflare.com/workers/observability/logs/workers-logs; workerd `src/workerd/api/trace.c++:382-398` (raport badacza) | Cel głosu tylko w treści POST, nigdy w adresie. Logujemy tylko pola z listy dozwolonych (T6). |
| Logi bramki Supabase (`edge_logs`, 1 dzień) | Ścieżka i parametry adresu, nagłówki z listy (bez cookie, apikey, authorization), podmiot JWT (host); bez treści. | supabase.com/docs/guides/observability/log-field-reference | `rpc()` tylko jako POST. `{get: true}` wkłada argumenty do adresu (`node_modules/@supabase/postgrest-js/src/PostgrestClient.ts:534-557`). Głos hosta zostawia w logu „host zagłosował o T”, bez celu. |
| Logi Postgresa | `log_statement = 'ddl'`. Błędna instrukcja trafia do logu z `$1` zamiast wartości (`log_parameter_max_length_on_error = 0`). | supabase/postgres `postgresql.conf.j2:461, 542, 545` (raport badacza) | Domyślnie wartości nie trafiają do logu. Właściciel może jednak włączyć szersze logowanie na przyszłość (`ALTER ROLE … SET log_statement`, pgaudit), co należy do granicy D1. |
| Komunikat błędu (`DETAIL`) | „Key (…)=(…) already exists” albo „Failing row contains (…)” zawiera wartości wiersza, gdy RLS nie działa dla bieżącej roli, np. w funkcji `security definer` właściciela `postgres`. Wraca do wołającego jako `details` i może trafić do `postgres_logs`. | Postgres `execMain.c` (`ExecBuildSlotValueDescription`), `nbtinsert.c`; `node_modules/@supabase/postgrest-js/src/PostgrestError.ts:19` | Najpierw sprawdzić, potem zapisać. Żadne ograniczenie nie może wypisać wiersza, w którym jest głosujący i cel. Worker loguje tylko status i kod (`src/lib/rooms/server.ts:24-30`). |
| `xmin` (numer transakcji wiersza) | Wiersze z jednej transakcji mają ten sam `xmin`. UPDATE nadaje nowej wersji `xmin` aktualizującego. Numery rosną globalnie. Właściciel czyta `xmin` zwykłym SELECT. Zapis w bloku `EXCEPTION` dostaje osobny, ale powiązany numer, więc nie chroni. | postgresql.org/docs/17/ddl-system-columns.html, /transaction-id.html, /subxacts.html | Wpis „zagłosował” i licznik zmienione w jednej transakcji łączą głosującego z celem dla każdego, kto czyta tabele (pułapka z `live-sync-spike/research.md:112-114`, teraz potwierdzona). |
| Martwe wersje wierszy, WAL | Niewidoczne w zwykłym SQL. `pageinspect` jest niedostępny (Supabase go pomija). `pg_walinspect` jest instalowalny, ale wymaga roli, której Supabase nie nadaje (prawdopodobnie, niesprawdzone). Tabela nielogowana nie pisze do WAL. | postgresql.org/docs/17/sql-createtable.html („not written to the write-ahead log … automatically truncated after a crash”); supabase/postgres `supautils.conf.j2:5, 10, 16` | Stan w trakcie rundy w tabeli nielogowanej nie zostawia historii w WAL ani w replikacji logicznej. Po awarii bazy runda w toku przepada. |
| Kopie zapasowe | Plan darmowy: brak kopii i PITR. Plany płatne: codzienne kopie fizyczne. | supabase.com/docs/guides/platform/backups, supabase.com/pricing | Dziś bez znaczenia. Przy przejściu na plan płatny kopia z połowy rundy złapałaby stan w toku, chyba że jest on nielogowany (WAL-G go nie zawiera; wniosek). |
| `pg_stat_statements` | Normalizuje stałe do `$n`. Domyślne `track = top` pomija instrukcje wewnątrz funkcji. | postgresql.org/docs/17/pgstatstatements.html (raport krytyka) | Nie jest kanałem wycieku. |
| Odpowiedź serwera | Dziś `room_lobby` zwraca same nicki (:343-355). | migracja | Funkcja głosu nie odsyła celu ani liczb. Stan rundy w trakcie głosowania zwraca tylko „kto zagłosował”, a liczby dopiero po odsłonie. |

**Wnioski z samej mechaniki odsłony (nie z kodu):**
- Liczby w odsłonie razem z listą „kto zagłosował” ujawniają głos, gdy zagłosowała 1 osoba (wszyscy wiedzą, na kogo). Przy 2 osobach każda zna głos drugiej. Tak samo w pokoju 2-osobowym. Jednomyślność ujawnia wszystkich, ale to cecha każdej odsłony liczb, którą PRD przyjmuje.
- Host może przewinąć w każdej chwili (`prd.md:103`), więc przypadek „1 głos” jest realny (D3).
- Porzucona runda (host zamyka pokój „Nową grą” w trakcie głosowania) zostawiłaby częściowy stan, np. „zagłosowała Ola” i „Bartek: 1”. Taki stan to para, której PRD nigdy nie pokazuje. Kasowanie gier jest dopiero w S-13 (`roadmap.md`, S-13).

### 4. Na żywo: dzwonek, odsłona i budżet żądań

- **Ścieżka dzwonka:**
  - nadaje tylko Worker, przez REST `httpSend`, po odpowiedzi (`waitUntil`) (`src/lib/rooms/server.ts:195-211`);
  - wywołania: po wejściu gościa (`src/pages/api/rooms/join.ts:48-49`) i po „Nowej grze” (`src/pages/api/rooms/index.ts:49-52`);
  - ładunek `{seq: Date.now()}`, ekran go ignoruje (`src/components/room/RoomLobby.tsx:97-99`);
  - kanał z domyślnymi ustawieniami: publiczny, bez `ack` i `self` (`node_modules/@supabase/realtime-js/src/RealtimeChannel.ts:375-380`).
- **Prototyp F-01** `POST /api/live-sync/ring` (`src/pages/api/live-sync/ring.ts:7-26`) pozwala każdemu zalogowanemu zadzwonić do dowolnego tematu. Został dla sondy (`src/pages/dev/live-sync.astro:7-9`).
- **Ekran (`RoomLobby.tsx`):**
  - pobiera stan po każdym dzwonku i po każdym `SUBSCRIBED` (:95-101);
  - co 15 s odpytuje, tylko przy widocznej karcie, i dodatkowo przy `visibilitychange` (:81-86);
  - ignoruje `CHANNEL_ERROR`, `TIMED_OUT` i `CLOSED` (:100-102, audyt L1);
  - nie ma limitu czasu na pobranie (:58);
  - przy 404 przeładowuje stronę (:61-63, audyt L3);
  - rzutuje JSON bez sprawdzenia (:68, audyt L4);
  - przy stanie innym niż `lobby` wyłącza efekt na żywo (:50), a każdy stan inny niż `closed` rysuje jak lobby (:135).
- **Pomiar F-01 na produkcji** (`measurements.md:23`): 20 klientów × 10 prób, dzwonek + pobranie p95 235 ms, 200/200 w 2 s.
  - Pobierany stan nie dotykał bazy, a gracze sondy nie mieli sesji. Czas z wywołaniem `room_lobby` i z `getUser()` hosta w middleware (`src/middleware.ts:8-14`) jest niezmierzony.
  - Lokalny `npm run dev` nie nadaje się do oceny budżetu 2 s (:44).
- **Budżet żądań** (rachunek badacza, założenia jawne): N = 20 ekranów, każdy głos dzwoni, każdy dzwonek daje 1 pobranie na ekran, odpytywanie co 15 s.
  - Runda ≈ 21 (start) + 20 × 21 (głosy) + odpytywanie ≈ 520–620 żądań Workera.
  - Godzina z 20 rundami ≈ 14 tys.
  - Limit planu darmowego to 100 tys. żądań dziennie na konto (błąd 1027). Pliki statyczne się nie liczą (developers.cloudflare.com/workers/static-assets/billing-and-limitations).
- **Fałszywe dzwonki:**
  - bez ogranicznika ok. 5 tys. dzwonków przy 20 ekranach wyczerpuje dzienny limit;
  - z ogranicznikiem 1 pobranie na sekundę na ekran pokój pod ciągłym spamem zjada limit w ok. 83 minuty;
  - Realtime planu darmowego: 100 wiadomości/s uśredniane w oknie do 60 s; dzwonek w pokoju 20 osób = 21 wiadomości (`context/archive/2026-09-27-live-sync-spike/external-research.md:40-60`).
- **Dwie wyceny tego samego ryzyka:** `infrastructure.md:196` ocenia przekroczenie 100 tys. jako „nierealne bez bota”, a F2 i ryzyko #7 jako średnie. Rozstrzyga ogranicznik z T5.

### 5. Kryteria akceptacji z roadmapy: znane dziury F1 i F4

#### 5.1 F1 (`tests/db/roles.test.ts:205-305`, 4 × `it.fails`)

| Test | Atak (rola, droga) | Wyrocznia | Co musi zmienić migracja |
|---|---|---|---|
| H1 :222-232 | Host przez REST: `update rooms set status='lobby'` na zamkniętym pokoju | `room_link` zwraca `closed` | Odebrać `update (status)` (:60) albo zawęzić politykę |
| H2a :246-260 | Host woła `create_room` z wybranym przez siebie kodem linku | `room_link(kod)` zwraca `unknown` | Kod linku generowany w SQL; parametr `p_link_token` ignorowany albo usunięty |
| H2b :262-272 | Host wstawia wiersz do `rooms` przez REST z własnym kodem | `unknown` | Odebrać `insert` na `rooms` (:59) |
| H3 :284-303 | Host wstawia do `players` nick „Ola\u{200B}”, potem gość wchodzi jako „Ola” | Najwyżej jeden z dwóch nicków | Odebrać `insert` na `players` (:61) albo wymusić regułę nicku na każdej drodze |

- **Sprzężenie:** po odebraniu grantów `create_room` musi zostać `security definer` (`context/archive/2026-10-10-testing-lobby-foundation/research.md:242`).
- **Testy, które zmieniają się razem z sygnaturą `create_room`:**
  - G2 (`roles.test.ts:161-172`) przy innej sygnaturze dostanie PGRST202 zamiast `42501`;
  - `seedRoom` (`tests/db/support/rooms.ts:45-55`, komentarz :45-47 to zapowiada);
  - komentarz G2 o `normalize_nick` (:157-160).
- **Bez zmian:** host zachowuje `select` przez RLS. Korzystają z niego `hostOpenRoomId` (`src/lib/rooms/server.ts:161`), `hostLinkToken` (:178) i `readOwnRoom` (`tests/db/support/rooms.ts:28`). H6, H8 i G1 dalej przechodzą.

#### 5.2 F4 (`tests/db/nicks.test.ts:54-84`, dane `tests/db/support/nick-pairs.ts:100-162`)

- **9 par** (11–19), wszystkie z oczekiwaniem `{ok:false, reason:"nick_taken"}` (`nicks.test.ts:47`). Brakujące znaki: U+FE00–FE0F, U+E0100–E01EF, znaczniki U+E0000–E007F, U+061C, U+180F, U+1BCA0–1BCA3 i U+1D173–1D17A. Do tego FE0F po emotce bez pary wariantu (para 19).
- **Rozjazd w źródłach:** `review-fixes.md:26` podaje znaczniki jako U+E0000–E007F, a to nie obejmuje U+E0100 z pary 13. Szerszy zakres jest w `testing-lobby-foundation/research.md:76`.
- **Strażnicy, którzy muszą zostać zieloni:**
  - pary 1–10 i 23 (`nick_taken`);
  - pary 20–22 („ola”, „Ola1”, „Óla”) wchodzą normalnie, co łapie zbyt gorliwą poprawkę;
  - 20 liter wchodzi, 21 dostaje `invalid_nick`, 10 000 liter dostaje `invalid_nick` jako dane, a nie awarię.
- **Limit długości przed normalizacją:** propozycja „odrzucić `char_length(p_nick) > 100`” w `join_room` i `create_room` (`review-fixes.md:28`). Próg celowo nie jest przypięty testem (`nicks.test.ts:86-88`).
- **Krok smoke dla „Ola”+U+FE0F** (`review-fixes.md:28`).
- **Pary bez decyzji** czekają na wybór Karola w sprawie FE0F (D5): „Ola❤” vs „Ola❤️”, flaga Szkocji vs czarna flaga, „#” vs „#️” (`nick-pairs.ts:9-11`, `testing-lobby-foundation/research.md:124-129, 253-259`).

### 6. Warstwa Workera i ekrany: co nowy stan pokoju psuje

Każde miejsce poniżej zakłada dziś `lobby|closed`. Wejście stanu gry bez ich zmiany daje błędy opisane w audycie (P6, G2, L3):

| Miejsce | Zachowanie przy nowym stanie | Źródło |
|---|---|---|
| `parseLobby` | odrzuca, więc `GET` lobby daje 500, a `/r/<id>` stronę błędu | `src/lib/rooms/server.ts:126-140` |
| `RoomStatus` | typ `"lobby" \| "closed"` z komentarzem „S-02 adds the game states” | `src/lib/rooms/shared.ts:5-6` |
| `hostOpenRoomId` i strona główna hosta | filtr `status = 'lobby'`, więc host z grą w toku nie widzi „Wróć do pokoju” ani potwierdzenia zamknięcia, a `create_room` odpowie `open_room_has_guests` bez ekranu potwierdzenia | `server.ts:161`, `src/pages/index.astro:20-32`, migracja :168-171 |
| `/j/<kod>` | sprawdzenie „zamknięte” idzie przed „już jesteś w środku”, więc gracz otwierający link z Discorda w trakcie rundy dostaje 410 | `src/pages/j/[token].astro:28-36` |
| `join.ts` | stan inny niż otwarty mapuje na `room_closed` | `src/pages/api/rooms/join.ts:26` |
| `MESSAGES` | 8 kodów; nowy kod daje „Coś poszło nie tak” (audyt G2) | `src/lib/rooms/errors.ts:3-21`, `tests/unit/room-errors.test.ts:7` |
| `RoomLobby` | efekt na żywo tylko dla `lobby`, a reszta rysuje się jak lobby | `RoomLobby.tsx:42, 50, 135` |
| `/dev/room-states` | tylko stany lobby i zamkniętego pokoju | `src/pages/dev/room-states.astro:225-335` |

- **Wzorzec akcji hosta:** formularz `POST` → trasa API sprawdza `locals.user` → helper z `callRpc` (zawsze POST, więc tokeny nie trafiają do adresu, `server.ts:32-48`) → 302 z `?error=` albo do pokoju → `ringLobby`.
- **Ochrona przed cudzym POST:** Astro 7 ma `checkOrigin: true`. Formularz z innego źródła dostaje 403. JSON przechodzi, a chroni go CORS i ciasteczka `SameSite=Lax` (`node_modules/astro/dist/core/app/origin-check.js:8-27`, `src/lib/rooms/tokens.ts:37`).
- **Tożsamość gracza:**
  - gość: ciasteczko `mlt_player_<roomId>` (httpOnly, `lax`, 24 h, `tokens.ts:28-41`);
  - host: sesja Supabase.

  Funkcja głosu musi rozpoznawać obu tak jak `room_lobby` (migracja :324-341).

### 7. Testy i pętla CI

- **Projekty Vitest:** `unit` (lokalnie i w CI), `db` (tylko CI) i `hooks` (`vitest.config.ts`).
- **Bezpiecznik testów bazy** przyjmuje tylko adres lokalny i klucz `sb_publishable_` (`tests/db/support/env.ts:40-45`). Testy bazy nie widzą więc tego, co widzi twórca: `xmin`, katalogu, publikacji ani surowych wierszy.
- **Ostatni przebieg `db`:** 53 testy, 40 zielonych i 13 oczekiwanych porażek (raport z `gh run view`).
- **Limit rejestracji:** 30 rejestracji i logowań na 5 minut z jednego IP (`supabase/config.toml:194`). Dziś przebieg zakłada 7 kont: `canary` 0, `roles` 6, `nicks` 1 (test-plan §6.2). „Około 10” to tylko robocza miara z archiwalnego planu (`testing-lobby-foundation/plan.md:121`).
- **Czas CI** z ostatnich 10 przebiegów (2026-10-11):
  - cały workflow: mediana 172 s (120–214 s);
  - job `db`: mediana 118 s (108–210 s), z czego `supabase start` 75–179 s, a same testy 1–3 s.
- **CI rusza tylko** na PR i na push do `main` (`.github/workflows/ci.yml:3-7`). `main` nie ma ochrony gałęzi (`gh api …/branches/main/protection` → 404), a Workers Builds wdraża `main` nawet przy czerwonym CI (AGENTS.md).
- **E2E:** helpery są związane z `/api/rooms/<id>/lobby` i z `LOBBY_POLL_MS` (`tests/e2e/support/room.ts:50-51`, `src/lib/live-sync/shared.ts:5-7`). E2E rundy należy do fazy 3 planu testów.
- **Smoke:** 23 kroki pokoju, żaden nie dotyczy rundy (`scripts/smoke.mjs:217-294`). Krok :286 (410 dla zamkniętego linku) pozostaje prawdziwy.

## Code References

- `supabase/migrations/20261007122858_room_lobby.sql:25,32` — stany pokoju i indeks jednego otwartego pokoju
- `supabase/migrations/20261007122858_room_lobby.sql:59-61,73-76` — granty i polityka hosta (F1)
- `supabase/migrations/20261007122858_room_lobby.sql:102-125` — `private.normalize_nick` (F4)
- `supabase/migrations/20261007122858_room_lobby.sql:131-198` — `create_room` (invoker, kod linku z Workera)
- `supabase/migrations/20261007122858_room_lobby.sql:204-266` — `join_room` (blokada wiersza, `room_closed` dla nie-lobby)
- `supabase/migrations/20261007122858_room_lobby.sql:302-357` — `room_lobby` (host przez `auth.uid()`, gość przez hash)
- `src/data/questions.ts:5-18,21-40` — reguły i kształt bazy pytań
- `src/lib/rooms/server.ts:24-30` — `logFailure` (tylko status i kod)
- `src/lib/rooms/server.ts:126-140` — `parseLobby` (P6)
- `src/lib/rooms/server.ts:157-170` — `hostOpenRoomId` z filtrem `lobby`
- `src/lib/rooms/server.ts:195-211` — `ringLobby`
- `src/lib/rooms/errors.ts:3-21` — `MESSAGES` (G2)
- `src/components/room/RoomLobby.tsx:50-102` — pobieranie, odpytywanie, kanał (L1, L3, L4)
- `src/pages/j/[token].astro:28-36` — 410 przed sprawdzeniem „już w środku”
- `src/pages/index.astro:20-32` — „Wróć do pokoju” i potwierdzenie zamknięcia
- `src/pages/api/live-sync/ring.ts:7-26` — prototypowy dzwonek dla każdego zalogowanego
- `tests/db/roles.test.ts:205-305` — znane dziury F1
- `tests/db/nicks.test.ts:54-84`, `tests/db/support/nick-pairs.ts:100-162` — znane dziury F4
- `tests/db/support/env.ts:40-45` — bezpiecznik: tylko lokalny adres i klucz publishable
- `.github/workflows/ci.yml:94` — job `db` bez Realtime

## Architecture Insights

- **Wszystko, co rola może zrobić, robi funkcja w bazie z kontrolami w środku.** Worker jest wygodną drogą, a nie strażnikiem: host i gość mogą wołać RPC bezpośrednio. Dlatego reguły rundy (jeden głos, cel z listy, przejścia stanów) muszą żyć w funkcjach `security definer`, a testy wchodzić tymi samymi drzwiami (test-plan §2 #4).
- **Dzwonek to podpowiedź, nie wiadomość.** Stan zawsze pochodzi z bazy. Dzięki temu publiczny kanał nie przenosi danych, ale każda podróbka kosztuje żądania (ryzyko #7).
- **Prywatność przez to, czego nie zapisujemy.** Lobby nie zapisuje czasu ani id w odpowiedziach, a logi mają tylko status i kod. Dla głosów potrzebny jest krok dalej: nie zostawiać nawet stanu pośredniego (D1).
- **Wdrożenie ma dwie niezależne ścieżki.** Kod idzie automatycznie po scaleniu, a migracja ręcznie (`supabase db push`, pytanie). Każda zmiana kontraktu (sygnatura `create_room`, nowy stan) wymaga kolejności, która nie psuje działającej produkcji (T8).

## Historical Context (from prior changes)

- `context/archive/2026-09-27-live-sync-spike/measurements.md:102-110`: wariant „publiczny kanał-dzwonek + stan z Workera” zostaje dla S-02. Stan tylko z bazy, w trakcie rundy tylko „kto już zagłosował”, a liczby przy odsłonie. Budżet 2 s mierzy sonda na produkcji. **Nadal obowiązuje.**
- `context/archive/2026-09-27-live-sync-spike/research.md:104-114`: model „flagi osobno, liczniki osobno, bez `created_at`, bez kolejnych id, poza publikacją, cel w treści POST” i niesprawdzona pułapka `xmin`. **Pułapka potwierdzona** (§3), a sam model zastępuje D1, bo flagi i liczniki zapisane razem dają się połączyć.
- `context/archive/2026-09-27-live-sync-spike/external-research.md:169`: „własny głos gracza trzymać tylko w jego przeglądarce” to **rekomendacja recenzenta, nie decyzja**. Roadmapa S-04 nadal ma to jako Unknown (właściciel Karol). Według recenzji D1 zapis celu w `localStorage` dosłownie koliduje z AGENTS.md („never persist … in any form”), więc S-04 potrzebuje jawnej decyzji i wyjątku w regule.
- `context/archive/2026-10-07-room-lobby/follow-ups/review-fixes.md:9-28`: F1 (granty hosta, kod linku w SQL, kategorie przez `CATEGORIES`), F2 (ogranicznik) i F4 (zakresy znaków, limit 100, krok smoke). **Obowiązuje**, z poprawką zakresu znaczników z §5.2.
- `context/archive/2026-10-10-testing-lobby-foundation/research.md:242, 253-259`: `create_room` jako `security definer` (opcja A) i warianty FE0F W1–W3. **Obowiązuje**, a W3 odpada (D5).
- `context/foundation/infrastructure.md:189, 195`: kanał niesie tylko dzwonek, Durable Objects dopiero wtedy, gdy Supabase zawiedzie. **Obowiązuje.**

## Related Research

- `context/archive/2026-09-27-live-sync-spike/research.md`, `external-research.md`, `measurements.md`
- `context/archive/2026-10-07-room-lobby/research.md`
- `context/archive/2026-10-10-testing-lobby-foundation/research.md`
- `context/audits/observability/2026-10-11_guest-join-live-lobby.md`

## Recenzja: adwokat diabła i krytyk (2026-10-13)

Dwóch niezależnych agentów tylko do odczytu, bez dostępu do mojego rozumowania. Adwokat atakował rekomendacje, krytyk sprawdzał fakty i szukał braków. Zarzuty rozstrzygające sprawdziłem u źródła: `tests/db/nicks.test.ts:47`, `nick-pairs.ts:100-110`, `src/lib/rooms/server.ts:161`, `src/pages/index.astro:20-32`, `review-fixes.md:9-28`, `supabase/config.toml:13, 194` oraz dokumentację Postgresa o tabelach nielogowanych i publikacjach.

**Co zmieniło się w moim szkicu:**
1. **Porzucona runda i odsłona po 1 głosie** zdradzały parę, a szkic tego nie łapał. Nowe w D1: kasowanie stanu przy porzuceniu. Nowa decyzja: D3.
2. **Tabela nielogowana w `private`** (pomysł adwokata). Stan w toku nie trafia do WAL, publikacji ani przyszłych kopii zapasowych, a schemat nie jest wystawiony w API. Weszło do rekomendacji D1.
3. **„Podgląd na żywo” to nie instrumentowanie.** Jedno odświeżenie edytora tabel w trakcie rundy wystarczy. Granica z D1 wymaga więc świadomej zgody Karola i dopisku w PRD, inaczej zdanie z `prd.md:143` przestaje być prawdziwe.
4. **D5: W3 nie przechodzi testów.** Wyrocznia oczekuje `nick_taken`, a W3 daje `invalid_nick`. W1 w moim brzmieniu („selektory i znaczniki”) pomijał U+061C, U+180F, U+1BCA0–1BCA3 i U+1D173–1D17A. W2 jest tańszy, niż pisałem: kolumna generowana i ograniczenie o tej samej nazwie (`players_room_nick_key`), więc obsługa w `join_room` (:253-256) się nie zmienia.
5. **Ścieżki hosta i ekrany zakładają `lobby`** (§6). Muszą się zmienić w tym samym PR, a kolejność wdrożenia musi chronić działającą produkcję (T8).
6. **Ogranicznik:**
   - zawieszone pobranie blokowałoby wszystko, stąd limit czasu;
   - odstęp 1 s jest za ciasny dla budżetu 2 s z pobraniem z bazy, stąd ≤ 500 ms;
   - spam trzeba hamować wycofaniem, gdy stan się nie zmienia (T5).
7. **Minimum graczy wynika z PRD**, nie jest pytaniem: US-01 „co najmniej 2 gości” (`prd.md:69`) plus głosujący host (`prd.md:76`).
8. **Faktów, w których się myliłem, nie było poza D5.** Limit rejestracji to 30 na 5 min, a „~10” to tylko robocza miara. Zakres czasu `supabase start` to 75–179 s.

**Odrzucone zarzuty:**
- **Codespaces jako pętla testów** (adwokat): działa bez instalacji, ale wymaga interaktywnego `gh auth refresh -s codespace` po stronie Karola, a konfiguracja kontenera jest niesprawdzona. Zostaje jako zapas w D6, nie domyślna droga.
- **„Limit 100 wiadomości/s w Realtime zerwie pokój przy 5 głosach/s”:** archiwum ustaliło z kodu Realtime, że limit jest uśredniany w oknie do 60 s (`external-research.md:40-60`). Seria 20 dzwonków w kilka sekund to ok. 420 wiadomości na minutę. Do sprawdzenia sondą, nie blokuje.

## Decyzje do podjęcia (Karol)

Każda ma rekomendację po recenzji. Odpowiedź Karola trafi tutaj (dopisek „Decyzja”) przed `/10x-plan`.

**Decyzja Karola (2026-10-13): „wszystko wg rekomendacji ale D3 …”.**
- D1: A (urna, która znika). Granica „twórca podglądający bazę na żywo w trakcie rundy albo włączający szersze logowanie” przyjęta. Do dopisania w PRD (NFR o anonimowości) i AGENTS.md.
- D2: głos ostateczny.
- D4: b (napis na ekranie + zgłoszenia z filtrem).
- D5: W2.
- D6: CI.
- D3: **bez progu** (doprecyzowane pytaniem: „scenariusz taki jak w filmie” = host przewija po 1 głosie i wszyscy widzą wynik). Odsłona zawsze pokazuje liczby, dosłownie według FR-009 (`prd.md:103`). Przyjęte ryzyko: przy 1 oddanym głosie (albo jednomyślności) widać, kto na kogo. To skutek odsłony liczb razem z jawną listą „kto zagłosował”, nie zapis pary. Do dopisania w PRD obok granicy z D1.

### D1. Gdzie trzymać głosy (urna)

| Opcja | Na czym polega | Wobec twórcy po rundzie | Koszt |
|---|---|---|---|
| **A. Urna, która znika (rekomendacja)** | W trakcie rundy tylko „kto zagłosował” i liczniki, w tabelach nielogowanych w `private`. Bez grantów, tylko przez funkcje, bez znaczników czasu, poza publikacją. Przy odsłonie zapisujemy wyłącznie liczby na osobę, a stan w toku kasujemy. Przy zamknięciu pokoju albo porzuceniu rundy kasujemy go bez zapisu. | Nic nie zostaje: ani wiersze, ani historia w WAL. | Mała: dwie tabele i kasowanie w trzech miejscach. Po awarii bazy runda w toku przepada. |
| B. Model z F-01 (flagi + liczniki, zwykłe tabele) | Jak dziś opisane w archiwum | Ostatni głosujący na każdą osobę daje się połączyć przez `xmin`, póki ktoś nie posprząta | Podobny, słabsza ochrona |
| C. Kartki w urnie | Wiersz na każdy głos bez głosującego | Każda para do połączenia przez `xmin` do czasu odsłony | Podobny, najsłabsza |
| D. Urna poza bazą (Durable Object) | Głosy w pamięci Workera do odsłony | Nic nie zostaje | Duży: nowa infrastruktura, rozłączenia przy każdym wdrożeniu (`external-research.md:166-167`) |

**Granica, której żadna opcja A–C nie zamyka (do świadomej akceptacji):**
- twórca gry, który w trakcie rundy podgląda tabele w panelu Supabase;
- twórca, który przed rundą włącza szersze logowanie albo zmienia kod.

Ochrona dotyczy stanu po rundzie, logów i wszystkich innych ról. Propozycja: dopisać to wprost do PRD (NFR o anonimowości) i AGENTS.md jako przyjęte ryzyko.

### D2. Czy oddany głos można zmienić

- **Rekomendacja:** nie, głos jest ostateczny.
- Urna z D1 nie wie, na kogo głosowałeś, więc nie umie odjąć starego głosu. Zmiana głosu wymagałaby zapamiętania pary.
- Ekran musi więc jasno potwierdzić wybór: wybór osoby, potem „Zagłosuj”.

### D3. Odsłona, gdy zagłosowało bardzo mało osób

- **Problem:** host może przewinąć w każdej chwili (FR-009). Gdy zagłosowała 1 osoba, wszyscy widzą, na kogo, bo lista „kto zagłosował” jest jawna.
- **Rekomendacja:** liczby pokazujemy, gdy oddano co najmniej 3 głosy (z wstrzymaniami), czyli tyle, ile wynosi minimum graczy. Poniżej ekran mówi „Za mało głosów, żeby pokazać wynik — inaczej byłoby wiadomo, kto na kogo”.
- **Alternatywy:**
  - próg 2: chroni tylko przed przypadkiem 1 głosu, bo dwie osoby znają nawzajem swoje głosy;
  - bez progu: dosłownie według PRD.

### D4. „Czarna skrzynka”: zgłaszanie awarii z telefonów

| Opcja | Na czym polega | Koszt i ryzyko |
|---|---|---|
| a. Bez zgłoszeń | Ekran sam widocznie obsługuje awarię: napis „Połączenie na żywo przerwane — odświeżam”, ponowne połączenie, częstsze pobieranie tylko wtedy, gdy kanał nie działa | Właściciel dowie się tylko od graczy |
| **b. a + zgłoszenia z filtrem (rekomendacja)** | Jak a. Do tego `POST` z polami wyłącznie z listy (zdarzenie, stan, id pokoju), wysyłany tylko gdy karta jest widoczna i kanał nie działa ponad 5 s albo pobranie stanu zawiodło. Limit na typ zdarzenia. | Pola z listy nie uniosą pary (#1). Żądań jest garść na wieczór (#7). Bez filtra byłby szum przy każdym zablokowaniu telefonu (zarzut adwokata). |
| c. Zewnętrzny tracker (Sentry) | Nowy dostawca | Poza tą lekcją, `/10x-infra-research` |

Opcjonalnie: linia w logu Workera z opóźnieniem odsłony. Ekran pyta o stan po odsłonie, a Worker liczy czas od chwili odsłony zapisanej w rundzie. To pierwszy pomiar 2 s na prawdziwych telefonach bez danych osobowych. Decyzja w planie.

### D5. Emotki w nicku (FE0F i znaczniki)

| Opcja | „Kasia❤” vs „Kasia❤️” | Co widzi gracz | Koszt |
|---|---|---|---|
| W1 | Ten sam nick | Zapisany nick traci niewidoczny znak, więc ❤️ może się pokazać jako czarne ❤, flaga Szkocji jako czarna flaga, a „1️⃣” może się rozjechać (wygląd na platformach niesprawdzony) | Najmniejszy |
| **W2 (rekomendacja)** | Ten sam nick | Nick wyświetla się tak, jak go wpisano; porównujemy po oczyszczeniu w kolumnie generowanej | Nieco większy. Przed `db push` trzeba sprawdzić, czy na produkcji nie ma już kolizji (jeśli jest, migracja się wycofa). |
| W3 (odrzucić nick z takim znakiem) | Odmowa | Klawiatury same dodają FE0F | Nie przechodzi testów F4 (oczekują `nick_taken`) |

Każda z opcji W1 i W2 traktuje flagę Anglii i Szkocji jako ten sam nick. To rzadki przypadek, który przyjmujemy.

### D6. Pętla testów bazy

- **Rekomendacja:** zostajemy przy CI, jak w decyzji B z M3L4. Jedna próba trwa ok. 3 minuty, a czekam ja, nie Karol.
- **Zapas:** GitHub Codespaces, z Dockerem w chmurze i bez instalacji lokalnie. Wymaga jednorazowego `gh auth refresh -s codespace` przez Karola, a konfiguracja jest niesprawdzona.
- **Docker na Windowsie:** ciężka instalacja. Do tego `.dev.vars` wskazuje na produkcję, więc lokalny przebieg potrzebuje osobnego pliku.

## Decyzje techniczne (z uzasadnieniem, do planu)

- **T1. Stany i ruchy hosta.**
  - Stany pokoju: `lobby` → `playing` → `closed`. Runda ma fazę `voting` → `revealed`.
  - Hostowi odbieramy `insert`/`update` na `rooms` i `insert` na `players`, co zamyka F1 H1, H2b i H3.
  - `create_room` jako `security definer` generuje kod linku w SQL (`extensions.gen_random_bytes`, base64url, 22 znaki, jak `tokens.ts:6` i check :23). Parametr `p_link_token` zostaje w sygnaturze, ale jest ignorowany: stary Worker działa dalej, a H2a przechodzi. Usunięcie parametru w późniejszej migracji. Unikać dwóch przeciążeń, bo grozi PGRST203.
  - Ruchy hosta tylko przez funkcje:
    - `start_game` (min. 3 graczy, z PRD);
    - `reveal_round` (w każdej chwili, idempotentnie).
  - Wszystkie funkcje rundy blokują najpierw wiersz pokoju, potem rundę, w tej samej kolejności co `join_room` i `create_room`.
  - Indeks jednego otwartego pokoju obejmuje `lobby` i `playing`. `create_room` zamyka też grę w toku, z tym samym potwierdzeniem przy gościach i kasując stan rundy (D1).
- **T2. Kto głosuje.**
  - Przy starcie rundy zapisujemy listę uprawnionych: gracze w pokoju, łącznie z hostem. Przygotowuje to S-08 (spóźnieni głosują od następnej rundy, `prd.md:90`) i S-09.
  - Wstrzymanie się liczy się jako oddany głos.
  - Automatyczna odsłona następuje, gdy zagłosowali wszyscy uprawnieni.
  - Głos po odsłonie jest odrzucany.
  - Cel głosu wskazujemy nickiem z bieżącej listy (`room_lobby` celowo nie zdradza id). Funkcja sprawdza, że to gracz tego pokoju.
- **T3. Losowanie pytania w Workerze.**
  - Czysta funkcja z testem jednostkowym: tylko wybrane kategorie, 18+ tylko tam, gdzie host je dołączył, osobny kod odmowy przy pustej puli. Wyrocznia z PRD.
  - Baza zapisuje id pytania rundy, sprawdza jego format i brak powtórki w grze.
  - Host wołający RPC z innym pytaniem nie zyskuje nic, czego nie mógłby zrobić legalnie: sam może zaznaczyć 18+ i każdą kategorię. Uwaga krytyka: FR-012 mówi o przeglądzie przed startem, więc to interpretacja, nie wprost PRD.
  - Worker musi przeżyć nieznane id, pokazując zastępczy tekst z logiem, bez 500 na cały pokój.
- **T4. Wejście po starcie.**
  - Nowy kod `game_started` z komunikatem (G2) i wpisem w teście `room-errors`.
  - `room_link` zwraca stan „trwa”.
  - Gracz z ważnym ciasteczkiem otwierający `/j/<kod>` trafia do pokoju zamiast na 410.
  - Prośba o wpuszczenie to S-08.
- **T5. Ogranicznik i obsługa kanału na ekranie.**
  - Najwyżej jedno pobranie w locie i jedno na koniec.
  - Odstęp od startu do startu ≤ 500 ms.
  - Limit czasu pobrania ok. 3 s, który zwalnia miejsce.
  - Gdy pobrany stan się nie zmienił, odstęp rośnie aż do odpytywania co 15 s. To hamuje spam, kosztem wolniejszej odsłony pod atakiem.
  - Częstsze odpytywanie tylko przy kanale w stanie innym niż `SUBSCRIBED`.
  - Ponowna subskrypcja po `CLOSED` (L1).
  - Test jednostkowy z kontrolowanym czasem (test-plan §2 #7).
- **T6. Logi.**
  - Wspólny helper z listą dozwolonych pól: `op`, wzorzec trasy, krok, `roomId`, `status`, `code`, `errName` (audyt §6 krok 2, P5, P6, L6).
  - Nigdy cel głosu, nick, token ani `request.url`.
  - Z błędu bazy zostaje SQLSTATE i nazwa ograniczenia, nigdy `details`. Zasada „nie gub przyczyny” z CLAUDE.md spełniona w tym zakresie.
  - Test jednostkowy helpera.
- **T7. Test „widoku twórcy” w CI.**
  - pgTAP przez `supabase test db` w jobie `db`, gdzie jest Docker (test-plan §4 odrzucił pgTAP tylko z powodu braku Dockera lokalnie). Alternatywa: `psql` z adresem z `supabase status`.
  - Sprawdza:
    - tabele głosów są nielogowane, w `private`, bez grantów dla `anon`/`authenticated` (`has_table_privilege`) i poza `supabase_realtime`;
    - nie mają kolumn czasu ani sekwencji;
    - po odsłonie i po zamknięciu pokoju nie zostaje stan w toku;
    - wyniki nie zawierają głosującego.
  - Wymaga zmiany test-plan §4 i §6.2 oraz reguły `ask`/`deny` dla `supabase test db --linked` (lessons.md, wpis 1).
- **T8. Kolejność wdrożenia:**
  1. PR zielony (także `db`).
  2. `npx supabase db push` (pytanie). Stary Worker działa z nową bazą, bo sygnatura `create_room` jest zgodna, a gry w toku nie da się zacząć starym kodem.
  3. Smoke na produkcji ze starym Workerem (pytanie).
  4. Scalenie przez Karola, które wdraża Workera.
  5. Smoke na produkcji.

  `parseLobby` i ścieżki hosta zmieniają się w tym samym PR co funkcje rundy.
- **T9. Prototyp `/api/live-sync/ring`.** Zostaje dla sondy, zgodnie z decyzją S-01. Sonda z prawdziwą rundą (pomiar 2 s z bazą) to faza 3 planu testów albo osobny krok za zgodą, bo pisze do produkcji.

## Co testować najpierw (faza 1 planu: testy przed kodem głosowania)

Wyrocznie pochodzą z PRD, roadmapy i decyzji D1–D6, nigdy z implementacji.

- **#1 anonimowość, integracja bazy** (Vitest, klucz publishable, gość i host, wzór `roles.test.ts`):
  - tabele głosów niedostępne przez REST, przy czym schemat `private` nie jest wystawiony;
  - odpowiedź funkcji głosu bez celu i bez liczb;
  - stan rundy w trakcie głosowania ma dokładnie zbiór kluczy z listy, bez liczb, a po odsłonie wyłącznie liczby na nick;
  - po zamknięciu pokoju w trakcie rundy nic z rundy nie wraca.
- **#1 widok twórcy, pgTAP w CI (T7):** katalog, publikacja, brak stanu w toku po rundzie.
- **#1 logi, unit:** helper logów przepuszcza tylko pola z listy. Żądanie głosu niesie cel w treści, nie w adresie.
- **#3 reguły, integracja bazy:**
  - jeden głos na gracza, także drugim wywołaniem tym samym tokenem, czyli „po odświeżeniu”;
  - głos na siebie i wstrzymanie się dozwolone;
  - głos tylko na nick z tego pokoju;
  - liczby w odsłonie równe oddanym głosom (scenariusz rozpisany ręcznie);
  - automatyczna odsłona po ostatnim uprawnionym;
  - przewinięcie hosta w każdej chwili, także po 1 głosie (D3: bez progu, liczby zawsze);
  - głos po odsłonie odrzucony;
  - gość nie zaczyna i nie odsłania;
  - host nie zaczyna drugi raz i nie odsłania w lobby;
  - start przy < 3 graczach odrzucony;
  - wejście po starcie daje `game_started`.
- **#3 losowanie, unit (T3):** kategorie, 18+, pusta pula.
- **#7 ogranicznik, unit z kontrolowanym czasem (T5).**
- **Kryteria akceptacji roadmapy:** zdjęcie znaczników z 4 testów F1 i 9 testów F4, poprawki G2 i `seedRoom`. Pary FE0F z D5 trafiają do tabeli par po decyzji.
- **Limit rejestracji:** jeden host na plik. Nowy plik rundy dokłada ok. 1–2 konta do dzisiejszych 7 przy limicie 30 na 5 min.

## Open Questions

- **Decyzje Karola:** D1–D6 podjęte 2026-10-13 (wyżej). Do planu: dopisek do PRD (NFR o anonimowości) i AGENTS.md o granicy z D1 i o skutku D3.
- **S-04, nie S-02:** pokazanie własnego głosu po odświeżeniu. Zapis w telefonie koliduje dosłownie z AGENTS.md. W S-02 ekran pokazuje „Zagłosowałeś” z bazy, a wybór osoby tylko do przeładowania strony (pamięć ekranu, bez zapisu).
- **Niesprawdzone:**
  - czy trwały magazyn Workers Logs trzyma parametry adresu i nagłówki;
  - czy `pg_walinspect` da się uruchomić rolą `postgres`;
  - czy PostgREST przepuszcza `select=xmin` (bez znaczenia, bo tabele nie mają grantów);
  - jak przeglądarki rysują „Ola”+U+FE0F (D5);
  - czas odsłony z pobraniem z bazy i `getUser()` hosta na produkcji (T9, faza 3).
- **Do zakresu planu:** czy S-02 ma mieć minimalny e2e „3 graczy rozgrywa rundę”, czy zostawia to fazie 3 planu testów (test-plan §3). Ekrany rundy na `/dev/room-states` i w `scripts/ui-literals.mjs`. Kroki smoke rundy piszą głosy do bazy produkcyjnej na koncie smoke.
- **Poprawki gołych odwołań przy PR** (`change.md`):
  - `research.md §…` w `tests/db/roles.test.ts:15,30,123,275`, `tests/db/nicks.test.ts:7,56` (nazwa `describe`), `tests/db/support/nick-pairs.ts:1,6,9` i `print-nick-pairs.ts:3-4` → `context/archive/2026-10-10-testing-lobby-foundation/research.md` albo `plan.md`;
  - `roadmap.md:173` → `context/archive/2026-10-04-one-click-host-login/research.md` (sekcja „Decyzja”, :50);
  - `roadmap.md:136` → `context/archive/2026-10-07-room-lobby/follow-ups/review-fixes.md`.
