---
date: 2026-10-22T12:38:01Z
researcher: Claude (Opus 5.5) z Karolem
git_commit: dafe6db
branch: latecomer-admission
repository: CharlesOnTheWave/most-likely-to
topic: "S-08: spóźniony prosi o wejście do trwającej gry, host wpuszcza, wpuszczony głosuje od następnej rundy (FR-020)"
tags: [research, rooms, join, live-sync, rounds, eligible, latecomer]
status: complete
last_updated: 2026-10-22
last_updated_by: Claude (Opus 5.5)
---

# Research: wpuszczanie spóźnionych (S-08)

**Date**: 2026-10-22T12:38:01Z
**Researcher**: Claude (Opus 5.5) z Karolem
**Git Commit**: dafe6db (`origin/main` 8a5e6a2 + przestawienie roadmapy)
**Branch**: latecomer-admission
**Repository**: CharlesOnTheWave/most-likely-to

## Research Question

S-08 z roadmapy (`context/foundation/roadmap.md:201-211`, FR-020 w `context/foundation/prd.md:90-91`): spóźniony prosi o wejście do trwającej gry z wybranym nickiem, prośba jest widoczna dla prowadzącego na każdym ekranie, także w trakcie głosowania, a wpuszczony widzi bieżącą rundę i głosuje od następnej. Decyzja Karola z 2026-10-22: na razie wpuszcza sam host, współhosta dopisze S-07 (`roadmap.md:198`).

Do ustalenia: jak dziś działa wejście do pokoju i odmowa w trakcie gry, gdzie żyje stan pokoju i jak dociera do ekranów, kto głosuje w rundzie, jakie zasady i wcześniejsze decyzje musi uszanować plan oraz co zostaje do decyzji Karola.

## Summary

- **Dziś spóźniony nie wejdzie w żaden sposób.** Odmowa `game_started` jest w trzech miejscach: na stronie linku (`src/pages/j/[token].astro:41`, 409 „Gra już trwa”), w Workerze (`src/pages/api/rooms/join.ts:41`) i w funkcji bazy `public.join_room` (`supabase/migrations/20261014101922_first_live_round.sql:341-344`, komentarz „S-08 decides about late players”). Gracz, który już jest w pokoju (host albo gość z ciasteczkiem tego pokoju), wraca do niego bez odmowy (`join.ts:32-37`).
- **„Głosuje od następnej rundy” baza już wymusza.** Lista uprawnionych to zdjęcie graczy w chwili otwarcia rundy: `start_game` (`first_live_round.sql:576-585`) i `private.open_next_round` (`20261020205751_round_number_required.sql:66-73`). `cast_vote` odmawia głosującemu spoza listy (`no_round`, `round_number_required.sql:175-179`) i celowi spoza listy (`unknown_target`, `:186-193`), a automatyczna odsłona liczy do `cardinality(eligible)` (`:214-225`). Gracz dodany w trakcie rundy zagłosuje więc dopiero w następnej, bez zmian w tych funkcjach.
- **Ekran o uprawnionych nie wie nic.** `room_lobby` zwraca wszystkich graczy bez znacznika uprawnienia (`20261015122252_full_game_evening.sql:510-518`), a `RoundVoting` liczy „Zagłosowało X z `players.length`” (`src/components/room/RoundVoting.tsx:103,143`), pokazuje formularz każdemu, kto nie zagłosował (`:100`), i wszystkich graczy jako kandydatów (`:196`). Po wpuszczeniu w trakcie rundy: licznik pokaże o jedną osobę za dużo, wpuszczony zobaczy formularz i dostanie „Teraz nie trwa żadna runda.” (`src/lib/rooms/errors.ts:45`), a pozostali zobaczą go jako kandydata, którego baza odrzuci (`unknown_target`). Plan musi dać ekranowi informację o uprawnionych.
- **Prośba nie może być wierszem `players` ani mieć sekretu w `player_secrets`.** `room_lobby` uznaje za gracza każdego, kogo hash tokenu jest w `player_secrets` dla gracza tego pokoju (`full_game_evening.sql:438-449`). Taki wiersz od razu wpuściłby osobę do pokoju i do kolejnej rundy.
- **Odświeżanie na żywo jest gotowe do użycia.** Worker po udanej akcji dzwoni dzwonkiem (`ringLobby`, `src/lib/rooms/server.ts:369-382` → broadcast `bell` na temacie `live-sync:<roomId>`, `src/lib/live-sync/server.ts:12-32`), a ekran pobiera wtedy `GET /api/rooms/<id>/lobby` (`src/components/room/useRoomState.ts:183,281-320`), z zapasowym odpytywaniem co 15 s (`src/lib/live-sync/shared.ts:8`). Baza nie ma triggerów ani publikacji. Prośba i wpuszczenie to nowe akcje Workera, które zadzwonią tak samo.
- **Na pasek prośby „na każdym ekranie” jest gotowe miejsce:** opakowanie w `RoomScreen.tsx:197-215`, gdzie już stoją `LiveBanner` i notka o pominięciu, nad widokiem i poza `contentRef`, więc nie zabiera fokusu po ruchu hosta (`:104`).
- **Decyzje Karola przed planem:** co z prośbą zignorowaną albo obcą (odrzucanie, wygasanie, limit oczekujących), kolizja nicku prośby z graczem i z inną prośbą, co widzi spóźniony w czasie czekania i co widzi wpuszczony w bieżącej rundzie. Szczegóły w Open Questions.

## Detailed Findings

### Wejście do pokoju dziś

- **Strona linku** `src/pages/j/[token].astro:25-56`: woła `room_link`. Kto ma sesję albo ciasteczko tego pokoju i `room_lobby` go zna, idzie do `/r/<id>` (`:37-40`, `:48-50`). Pozostałym gra w toku daje 409 z tekstem „Gra już trwa” (`:41-42`, `:53-56`, `:73-75`).
- **`room_link`** (`first_live_round.sql:384-421`) dla gry w toku zwraca `{"status":"started","room_id":…}` (`:410-413`), więc strona spóźnionego zna id pokoju, a tym samym temat dzwonka `live-sync:<roomId>`.
- **POST `join.ts`**: sprawdza format linku, woła `roomLink` (`:24`), wpuszcza z powrotem gracza z pokoju (`:32-37`), w grze w toku odmawia `game_started` (`:41`), dla nowego gościa tworzy token `newPlayerToken()` (32 losowe bajty, 43 znaki, `src/lib/rooms/tokens.ts:27`), woła `join_room` (`src/lib/rooms/server.ts:152-169`), ustawia ciasteczko `mlt_player_<roomId>` (httpOnly, `sameSite` lax, 24 h, `tokens.ts:31-45`; `join.ts:53`), dzwoni (`:55`) i przekierowuje.
- **`public.join_room`** (`first_live_round.sql:308-381`, `security definer`, właściciel `postgres` `:775`, grant dla `anon` i `authenticated` `:800`), w tej kolejności:
  1. format tokenu, inaczej wyjątek 22023 (`:320-322`);
  2. format linku i blokada wiersza pokoju `for update` (`:331-335`);
  3. status `playing` → `game_started` (`:341-344`), inny niż `lobby` → `room_closed` (`:346-348`);
  4. nick: ponad 100 znaków surowych → `invalid_nick`, po `normalize_nick` 1-20 znaków i niepusty `nick_key` (`:351-359`);
  5. miejsce = `max(seat)+1` (`:361-365`);
  6. zajęty `nick_key` (unikalny indeks `players_room_nick_key`) → `nick_taken` (`:366-373`);
  7. zapis `player_secrets(token_hash = sha256(token))` (`:376-377`).
- **Limity:** brak limitu graczy w pokoju (PRD `prd.md:141`, `context/domain/domain-distillation.md:173`), brak limitu tempa wejść (limity Supabase Auth w `supabase/config.toml:184-194` nie dotyczą `join_room`). `join.ts` przyjmuje formularz bez limitu rozmiaru ciała; limit 4 KB dotyczy tras JSON (`src/lib/rooms/json-route.ts:12`).

### Tabele

- `public.rooms` (`20261007122858_room_lobby.sql:19-30`, `first_live_round.sql:42-51`): `id`, `host_id`, `link_token`, `status` (`lobby`/`playing`/`closed`), `categories`, `adult_categories`, `created_at`, `started_at`.
- `public.players` (`room_lobby.sql:34-45`, `first_live_round.sql:103-107`): `id`, `room_id`, `nick` (1-20), `user_id` (tylko host), `seat`, generowany `nick_key`; unikalne (`room_id`, `nick_key`), (`room_id`, `user_id`), (`room_id`, `seat`). Brak kolumny statusu.
- `public.player_secrets` (`room_lobby.sql:49-52`): `player_id`, unikalny `token_hash`; bez grantów i polityk.
- Schemat `private` (`first_live_round.sql:112-161`): `rounds` (z `eligible uuid[]`), `round_results`, nielogowane `ballot_boxes` i `round_voters`; RLS, wszystko odebrane, `usage` na schemacie odebrane (`:797`).
- `authenticated` ma tylko `select` na `rooms` i `players` przez polityki hosta; każdy zapis idzie przez funkcje `security definer` (`first_live_round.sql:33-38`, `room_lobby.sql:65-83`).

### Akcje hosta

- Przeglądarka wysyła JSON POST do `src/pages/api/rooms/[id]/{start,skip,next,reveal,end}.ts`. Każda trasa: `refuseForeignPost` (Content-Type i Origin, `json-route.ts:30-41`), id pokoju zgodne z `UUID_PATTERN`, wymagane `context.locals.user` (np. `start.ts:159`).
- Rozstrzyga funkcja bazy: blokada wiersza pokoju i `auth.uid() = rooms.host_id`, inaczej `room_unknown`: `start_game` (`first_live_round.sql:553-562`), `next_round`, `skip_round`, `end_game` (`full_game_evening.sql:91-101`, `:154-164`, `:218-228`), `reveal_round` (`round_number_required.sql`, sprawdzone tylko wyszukiwaniem). Granty tylko dla `authenticated` (`first_live_round.sql:803`, `full_game_evening.sql:539-541`, `round_number_required.sql:313`).
- Odmowy wracają jako `{ok:false, reason}`, a `actionAnswer` zamienia je na 409/404 (`json-route.ts:120-140`).

### Uprawnieni i głosowanie

- Zdjęcie uprawnionych przy otwarciu rundy: `start_game` (`first_live_round.sql:576-585`), `private.open_next_round` (`round_number_required.sql:66-73`), także dla rundy otwartej po `skip_round`.
- `cast_vote` (`round_number_required.sql:87-232`): głosujący spoza `eligible` → `no_round` (`:175-179`, komentarz o S-08 `:172-174`), cel spoza `eligible` → `unknown_target` (`:186-193`), odsłona po głosie ostatniego uprawnionego (`:214-225`). `finish_round` zapisuje wyniki tylko uprawnionych (`first_live_round.sql:200-206`).
- Komentarze zakładające, że „nikt nie dołącza do gry w toku”, zestarzeją się: `round_number_required.sql:31-32`, `:172-174`, `full_game_evening.sql:34-36`, `first_live_round.sql:341`.

### Stan pokoju i ekran

- Kształt: `LobbyState {status, role, me, players[{nick,host}], round}` (`src/lib/rooms/shared.ts:53-59`), `RoomView` dodaje `questionsLeft` i `round.question` (`:65-73`). Budowany w SQL przez `public.room_lobby` (`full_game_evening.sql:403-526`: host po `auth.uid()`, gość po hashu tokenu `:437-449`) i w Workerze (`roomView`, `hostQuestionsLeft`, `server.ts:196-225`).
- Precedens pola tylko dla hosta: `questionsLeft` jest niepuste tylko dla hosta (`server.ts:196-225`).
- Nowe pole wymaga zmiany razem: funkcji SQL, parsera, który kopiuje tylko klucze z kontraktu (`shared.ts:119-121`, `:166-201`), typów i testów z dokładnym zbiorem kluczy (`LOBBY_KEYS` w `tests/db/support/rounds.ts:61`, użyte w `tests/db/round-anonymity.test.ts:142,266,305`).
- Ekrany hosta w grze wybiera `RoomScreen.tsx:130-193` według `status` i `round.phase`: `RoundVoting` (przyciski odsłony, pominięcia i końca, `RoundVoting.tsx:271-301`), `RoundReveal` („Następne pytanie” albo notka o końcu pytań, `RoundReveal.tsx:230-238`, `HostActions.tsx:55-65`), `RoundSkipped` (`RoundSkipped.tsx:38-43`); potwierdzenia są stanami `HostActions` (`HostActions.tsx:94-123`). `EveningEnd` dotyczy pokoju `closed` (`RoomScreen.tsx:55-71`).
- Nagłówek `AppHeader.astro` jest statyczny, poza wyspą. Szerokości kolumn z `roomColumn()` (`src/components/room/room-frame.ts:22-28`).
- Podglądy: `/dev/room-window` (`src/pages/dev/room-window.astro:118-187`, m.in. `vote-host-before`, `reveal-host`, `skipped-host`), `/dev/room-states` (sekcje „Gra: głosowanie” `:587`, „odsłona” `:760`, „wieczór” `:894`, „Połączenie na żywo” `:1094`).

### Testy, które dotyczą zmiany

- `tests/db/round-rules.test.ts:183-188`: „a new guest joining after the start gets game_started” (komentarz „Late players wait for S-08”). Wyrocznia zmienia się z decyzji właściciela, nie z implementacji (`context/foundation/test-plan.md:166`).
- `tests/db/round-rules.test.ts:190` (`room_link` mówi `started`), `tests/db/roles.test.ts:178` (G3: `room_lobby` z tokenem gościa), `tests/db/round-anonymity.test.ts` (dokładne zbiory kluczy), `tests/unit/room-state.test.ts:61,196` (parsery).
- E2E: `tests/e2e/seed.spec.ts:8` (host widzi nowego gościa bez przeładowania), `round.spec.ts:18`, `game.spec.ts:31`, `lobby-connection-drop.spec.ts:10`; pomocnicy `tests/e2e/support/room.ts:65` (`joinRoom`), `support/realtime.ts:15`.

## Code References

- `src/pages/j/[token].astro:25-56` — strona linku, odmowa „Gra już trwa” (409)
- `src/pages/api/rooms/join.ts:24-55` — wejście gościa, odmowa `game_started`, ciasteczko, dzwonek
- `supabase/migrations/20261014101922_first_live_round.sql:308-381` — `join_room`
- `supabase/migrations/20261014101922_first_live_round.sql:384-421` — `room_link` (zwraca `room_id` dla `started`)
- `supabase/migrations/20261015122252_full_game_evening.sql:403-526` — `room_lobby` (najnowsza wersja)
- `supabase/migrations/20261020205751_round_number_required.sql:39-85` — `private.open_next_round` (zdjęcie uprawnionych)
- `supabase/migrations/20261020205751_round_number_required.sql:87-232` — `cast_vote`
- `src/lib/rooms/server.ts:152-169,196-225,369-382` — `joinRoom`, `roomView`, `ringLobby`
- `src/lib/live-sync/server.ts:12-32` — `ringRoom` (broadcast `bell`)
- `src/components/room/useRoomState.ts:183,281-320` — odbiór dzwonka i pobranie stanu
- `src/components/room/RoomScreen.tsx:197-215` — miejsce na pasek nad każdym widokiem
- `src/components/room/RoundVoting.tsx:100,103,143,196` — formularz, licznik i kandydaci liczone z wszystkich graczy
- `src/lib/rooms/errors.ts:8,38,45` — kody i teksty odmów

## Architecture Insights

- Każda akcja to trasa Workera (strażnik `refuseForeignPost`, sesja albo ciasteczko) plus jedna funkcja `security definer` z blokadą wiersza pokoju i pełnym sprawdzeniem w środku. Funkcja z grantem dla `anon` jest publicznym punktem wejścia z pominięciem Workera (AGENTS.md), więc prośba spóźnionego musi mieć wszystkie sprawdzenia w bazie.
- Tożsamość gościa to token w ciasteczku i jego hash w `player_secrets`; nie ma osobnej funkcji powrotu. Prośba potrzebuje własnego tokenu, żeby przeglądarka spóźnionego mogła sprawdzać, czy już ją wpuszczono, i żeby wpuszczenie zamieniło go na token gracza bez nowego logowania.
- Dzwonek jest pusty (bez danych), a stan zawsze przychodzi z serwera. Prośba widoczna tylko dla hosta mieści się w tym modelu jako pole stanu zależne od roli, jak `questionsLeft`.
- Tabele w `private` muszą przejść pętlę pgTAP po całym schemacie: bez grantów, poza publikacją, bez kolumn czasu, `serial` i `identity` (`test-plan.md:227`, sprawdzane w `supabase/tests/round_creator_view.test.sql`). Tabela próśb z czasem złożenia (np. do wygasania) nie zmieści się w `private`; tabela w `public` bez grantów (jak `player_secrets`) potrzebuje RLS i odbiorów zgodnie z AGENTS.md.
- Sprzątanie: stan gry znika przy odsłonie, końcu gry, zamknięciu starego pokoju przy „Nowa gra” i w godzinnym `close_stale_games` (AGENTS.md, `20261014101925_close_stale_games.sql:42`). Prośby powinny znikać w tych samych miejscach.

## Historical Context (from prior changes)

- FR-020 i jego uzasadnienie (scenariusz „21:30, host patrzy w pytanie, a spóźniony pisze na Discordzie”): `context/foundation/prd.md:90-91`, `context/foundation/shape-notes.md:156-157`. Wpuszczanie chroni też przed wyciekiem linku: `prd.md:85`, `shape-notes.md:151`. Wpuszczanie to uprawnienie prowadzącego, nie gościa: `prd.md:160`, `:172`.
- Zdjęcie uprawnionych przy otwarciu rundy przygotowano z myślą o S-08: `context/archive/2026-10-13-first-live-round/research.md:351`; „Prośba o wpuszczenie to S-08”: tamże `:365`. Odroczenia do S-08: `context/archive/2026-10-07-room-lobby/plan.md:57`, `research.md:44,74,264`; `context/archive/2026-10-13-first-live-round/plan.md:74`, `plan-brief.md:58`, `reviews/impl-review.md:68`.
- Na zalany pokój po wycieku linku lekarstwem jest „Nowa gra”: `context/archive/2026-10-07-room-lobby/plan.md:61`.
- Licznik „X z Y” liczy graczy, nie uprawnionych, i zgadza się tylko dlatego, że nikt nie dołącza w trakcie gry: `context/domain/evidence/2-code-language.md:57`, `context/domain/domain-distillation.md:39`.
- Propozycja agregatu „Gra” (`context/domain/02-invariant-aggregate-refactor.md:29-34,155,168`) mówi, że zwraca się przy S-07, S-08 i S-09; Karol nie odpowiedział na jej pytania tak/nie.
- Miejsce prośby na ekranie: w `context/archive/2026-10-15-room-wide-layout/research.md:212` był pomysł panelu bocznego, nie decyzja.

## Related Research

- `context/archive/2026-10-13-first-live-round/research.md` — runda na żywo, uprawnieni, prywatność głosów
- `context/archive/2026-10-07-room-lobby/research.md` — wejście gości, tokeny, nicki
- `context/changes/guest-vote-flow-analysis/research.md` — nowy kod odmowy wymaga wpisu w `MESSAGES` i testu `room-errors` (`:192`)

## Open Questions

Decyzje produktowe (Karol), z moją propozycją:

1. **Zignorowana lub obca prośba.** PRD mówi tylko o wpuszczeniu. Propozycja: host ma „Wpuść” i „Odrzuć”, prośba czeka do decyzji albo do końca gry, bez wygasania po czasie. Bez „Odrzuć” obca osoba z wyciekniętego linku wisiałaby na pasku do końca wieczoru.
2. **Limit oczekujących.** Brak limitu graczy jest decyzją PRD, ale pasek z dziesiątkami próśb zasłoniłby grę. Propozycja: niewielki limit naraz (np. 5) z osobnym kodem odmowy.
3. **Nick prośby.** Propozycja: te same zasady co przy wejściu (1-20 znaków po normalizacji), zajęty, gdy ma go gracz albo inna oczekująca prośba (`nick_taken`).
4. **Co widzi spóźniony w czasie czekania.** Propozycja: ekran „Czekasz, aż host Cię wpuści” bez treści pytania (pytania tylko dla tych, którzy mają je teraz widzieć, `context/foundation/lessons.md:16`), z odświeżaniem na dzwonek; po odrzuceniu jasny tekst, po końcu gry ekran końca.
5. **Co widzi wpuszczony w bieżącej rundzie.** PRD: widzi bieżącą rundę, głosuje od następnej. Propozycja: pytanie i notka „Zagłosujesz od następnego pytania” zamiast formularza; nie jest kandydatem w tej rundzie; licznik „X z Y” liczy uprawnionych.
6. **Agregat „Gra” najpierw?** Propozycja: nie przed wieczorem; S-08 zmienia uprawnionych tylko w ekranie, a baza już robi to dobrze.

Do ustalenia w planie (technicznie):

- gdzie trzymać prośby (tabela w `public` bez grantów vs. `private`, ograniczenie pętli pgTAP) i jak sprzątać je przy końcu gry, „Nowa gra” i `close_stale_games`;
- jak ekran dostaje informację o uprawnionych (np. lista nicków uprawnionych w `round` albo `me_eligible` plus liczba) i ile to zmienia w kontrakcie `LOBBY_KEYS`;
- czy prośba w grze idzie przez istniejący `join.ts` i `join_room` (zmiana zachowania dla `playing`), czy przez osobną trasę i funkcję;
- osoba, która w trakcie gry straciła ciasteczko, wejdzie przez prośbę tylko pod nowym nickiem, a jej stary nick zostaje uprawniony w bieżącej rundzie, więc ta runda nie odsłoni się sama (`context/domain/evidence/3-code-rules.md:94`); pełny powrót na stary nick to S-04.
