# Evidence: language in the code

**Zakres:** całe repo (`.`) według `context/domain/evidence/0-sources.md`, z jego wykluczeniami. Nie czytałem `context/` (poza `0-sources.md`), `AGENTS.md`, `CLAUDE.md`, `README.md`, `.claude/` (poza opisem tego agenta), `.dev.vars`, `.env*`.

**Pokryte warstwy:**
- persistence: wszystkie 4 migracje `supabase/migrations/*.sql`, przeczytane w całości; cytuję najnowszą wersję każdej funkcji;
- domain types: `src/lib/rooms/*.ts`, `src/lib/rounds/draw.ts`, `src/data/questions.ts` (nagłówek, `CATEGORIES`, typy, próbka wpisów), `src/lib/client-events.ts`, `src/lib/log.ts`;
- operations: `src/lib/rooms/server.ts`, `src/components/room/room-actions.ts`;
- entry points: `src/pages/**` bez `dev/` i `api/live-sync/`, `src/middleware.ts`, harmonogram pg_cron;
- UI: `src/components/room/**`, `src/components/auth/**` (tylko etykiety);
- tests: tylko nazwy `describe`/`it`/`test` z `tests/db`, `tests/e2e` i `tests/unit` oraz nagłówek `supabase/tests/round_creator_view.test.sql`.

**Próbkowane, nie pokryte:** treść 216 pytań w `src/data/questions.ts` (przeczytałem nagłówek, kategorie i kilka wpisów), wnętrze `useRoomState.ts` (tylko nazwy), ciała testów, `src/lib/live-sync/**` (przeczytane tylko `shared.ts` i `server.ts`, żeby oddzielić kod spike'a od kodu produktu: produkt go importuje, zob. „Unknowns”).

**Wzorce wyszukiwania:** `create|alter … table|function|policy|index`, `cron.schedule`, `set status|phase`, `.update(|.insert(|.delete(`, polskie literały w JSX/TS, `ballot|abstain|wstrzym`, `creator|owner`, `live-sync`, nazwy testów.

Tag `comment` oznacza ustalenie oparte tylko na komentarzu w kodzie, a nie na identyfikatorze, schemacie ani etykiecie.

## Concepts and their names across layers

| concept | persistence | domain type | operations | entry points | UI | user-facing label (language) |
| --- | --- | --- | --- | --- | --- | --- |
| **Room / game** | `public.rooms` `supabase/migrations/20261007122858_room_lobby.sql:19`; `started_at` `…20261014101922_first_live_round.sql:51` | `RoomStatus` `src/lib/rooms/shared.ts:9`; `CreateRoomResult` `src/lib/rooms/server.ts:22` | `create_room` `first_live_round.sql:220`; `start_game` `first_live_round.sql:540`; `end_game` `…20261015122252_full_game_evening.sql:207`; `createRoom`/`startGame`/`endGame` `server.ts:111,234,301` | `POST /api/rooms` `src/pages/api/rooms/index.ts:15`; `/r/[id]` `src/pages/r/[id].astro:23`; `…/start` `start.ts:13`; `…/end` `end.ts:13` | `RoomScreen` `src/components/room/RoomScreen.tsx:219`; `RoomCard`, `OpenRoomNotice` | „Nowa gra” `src/pages/index.astro:45`, „Załóż grę” `NewGameForm.tsx:219`, „Twój pokój” `RoomLobby.tsx:88`, „Wróć do pokoju” `OpenRoomNotice.astro:24`, „Zacznij grę” `RoomLobby.tsx:141`, „Zakończ grę” `HostActions.tsx:33` (pl) |
| **Evening** (cała rozegrana gra) | nazwa migracji `20261015122252_full_game_evening.sql` | — | — | — | `EveningEnd` `RoomScreen.tsx:55` | „Koniec wieczoru” `RoomScreen.tsx:59`, „Dzięki za grę!” `:60`, „Wszyscy zobaczą koniec wieczoru” `HostActions.tsx:36` (pl) |
| **Lobby** (poczekalnia przed startem) | `status = 'lobby'` `room_lobby.sql:25` | `RoomStatus` `"lobby"` `shared.ts:9` | `room_lobby` (zwraca cały stan, zob. niżej) | `GET /api/rooms/[id]/lobby` `lobby.ts:15` | `RoomLobby` `src/components/room/RoomLobby.tsx:35` | „w poczekalni” `OpenRoomNotice.astro:20`, „Czekamy, aż host zacznie.” `RoomLobby.tsx:91` (pl) |
| **Host** | `rooms.host_id` `room_lobby.sql:21`; `players.user_id` („Set only for the host”, `room_lobby.sql:38-39`); polityki `"Hosts read their rooms"` `room_lobby.sql:65`, `"Hosts read players in their rooms"` `:78` | `role: "host"` `shared.ts:55`; `LobbyPlayer.host` `shared.ts:13`; `context.locals.user` `src/middleware.ts:11` | `hostOpenRoomId`/`hostLinkToken`/`hostRoomCategories`/`hostQuestionsLeft` `server.ts:307,323,341,214`; `readUser` („The signed-in host”) `src/lib/auth-user.ts:8-12` | `/auth/signin` `src/pages/auth/signin.astro:13` | `HostActions` `HostActions.tsx:15`; odznaka `host` `RoundVoting.tsx:62` | „host” `RoundVoting.tsx:62`; „Konto ma tylko osoba prowadząca.” `src/components/auth/SignInCard.astro:25` (pl) |
| **Guest** | `public.player_secrets` (`token_hash`) `room_lobby.sql:49-52`; gość = `players.user_id is null` `first_live_round.sql:271` | `role: "guest"` `shared.ts:55` | `join_room` `first_live_round.sql:308`; `joinRoom` `server.ts:152`; `newPlayerToken` `src/lib/rooms/tokens.ts:27`; ciasteczko `mlt_player_<roomId>` `tokens.ts:31-33` | `POST /api/rooms/join` `join.ts:9`; `/j/[token]` `src/pages/j/[token].astro:25` | `JoinForm` | „Goście grają bez konta.” `SignInCard.astro:25`; „W starym pokoju są już goście.” `src/lib/rooms/errors.ts:28` (pl) |
| **Player** | `public.players` `room_lobby.sql:34`; `seat` `:41` | `LobbyPlayer` `shared.ts:11`; `MIN_PLAYERS = 3` `shared.ts:6` | `playerCountLabel` `shared.ts:209` | — | listy w `RoomLobby.tsx:159`, `RoundVoting.tsx:176` | „Gracze (N)” `RoomLobby.tsx:159`; „1 gracz”/„N graczy” `shared.ts:210`; „Gracz” `RoundReveal.tsx:172`; „ty” `RoundVoting.tsx:63` (pl) |
| **Nick** | `players.nick` `room_lobby.sql:37`; `players.nick_key` `first_live_round.sql:103`; `private.normalize_nick` `first_live_round.sql:60`; `private.nick_key` `:90`; `players_room_nick_key` `:107` | `NICK_MAX_LENGTH = 20` `shared.ts:4`; `LobbyState.me` `shared.ts:56` | `nickLength` `shared.ts:205` | pole formularza `nick` `index.ts:22`, `join.ts:13` | `NewGameForm`, `JoinForm` | „Twój nick” `NewGameForm.tsx:119`; „Ten nick jest już zajęty.” `errors.ts:25` (pl) |
| **Link (kod zaproszenia)** | `rooms.link_token` `room_lobby.sql:23` | `LINK_TOKEN_PATTERN` `tokens.ts:6`; `RoomLinkResult` `server.ts:25` | `room_link` `first_live_round.sql:384`; `roomLink`, `hostLinkToken` `server.ts:136,323`; `newLinkToken` `tokens.ts:22` | `/j/[token]` (parametr `token`); pole formularza `link` `join.ts:12` | `linkUrl` `RoomScreen.tsx:38` | „Link dla graczy” `RoomLobby.tsx:98`; „Nie znamy tego linku.” `errors.ts:31` (pl) |
| **Category / 18+** | `rooms.categories`, `rooms.adult_categories` `room_lobby.sql:26-27` | `CATEGORIES`, `CategoryId` `src/data/questions.ts:21,32`; `QuestionSelection` `src/lib/rounds/draw.ts:10` | `hostRoomCategories` `server.ts:341`; `poolFrom` `draw.ts:25` | pola formularza `category`, `adult` `index.ts:23-24` | `NewGameForm` | „Kategorie pytań” `NewGameForm.tsx:143`; „18+” `NewGameForm.tsx:178`; „Pytania 18+ włączasz osobno w każdej kategorii.” `:144` (pl) |
| **Question** | `rounds.question_id` (format `<category-id>-<NNN>`) `first_live_round.sql:117`; `rounds_room_question_key` `:125` | `QUESTIONS`, `QuestionEntry`, `QuestionId` `questions.ts:40,34,718`; `QuestionBase` `draw.ts:16`; `RoundView.question` `shared.ts:65` | `drawQuestion`, `shuffledQuestions`, `questionPool`, `questionText` `draw.ts:67,71,77,83`; `questionSentence` `shared.ts:215` | — | `RoundQuestion` `RoundQuestion.tsx:11` | „Kto z nas najprawdopodobniej {text}?” `shared.ts:216`; „Następne pytanie” `HostActions.tsx:46`; „Pomiń pytanie” `RoundVoting.tsx:287` (pl) |
| **Round** | `private.rounds` `first_live_round.sql:112` (`number`, `phase`, `eligible`) | `RoundState`, `VotingRound`, `RevealedRound`, `SkippedRound` `shared.ts:50,20,35,45`; `RoundView` `:65` | `next_round` `full_game_evening.sql:79`; `private.open_next_round` `:38`; `nextRound` `server.ts:268` | `POST …/next` `next.ts:16`; pole body `round` `json-route.ts:112` | `RoundVoting`, `RoundReveal`, `RoundSkipped` | „Pytanie N.” `src/lib/rooms/announce.ts:26`; „Teraz nie trwa żadna runda.” `errors.ts:40` (pl). Słowo „runda” pada w tekstach dla gracza tylko w tym komunikacie odmowy (evidence: `grep -rniE rund src` poza `src/pages/dev` i komentarzami dało jeszcze tylko treść pytania `questions.ts:320`) |
| **Vote / ballot** | brak tabeli głosów; `private.round_voters` (kto głosował, bez celu) `first_live_round.sql:149`; `private.ballot_boxes.tally` (liczniki per id celu) `:141-143` | `VotingRound.voted`, `me_voted` `shared.ts:24-25` | `cast_vote` `full_game_evening.sql:255`; `castVote` `server.ts:243`; `voteTarget` `vote.ts:10` | `POST …/vote` `vote.ts:24`; body `{target, round}` `RoomScreen.tsx:124` | `RoundVoting` `RoundVoting.tsx:79` | „Zagłosuj” `RoundVoting.tsx:262`, „Twój głos” `:194`, „Głos oddany” `:167`, „Głosu nie da się zmienić.” `:170`, „zagłosował(a)” `:67`, „Zagłosowało: X z Y” `:143` (pl) |
| **Target** (na kogo głos) | `p_target` (nick) `full_game_evening.sql:257`; dopasowanie `p.nick = p_target` `:356` | `MyVote.target` (RoundVoting) | `castVote(target…)` `server.ts:246` | body `target` `vote.ts:14` | — | „Tej osoby nie ma w grze.” `errors.ts:39`; „Twój głos: {nick}.” `RoundVoting.tsx:169` (pl) |
| **Abstention** | `ballot_boxes.abstained` `first_live_round.sql:144`; `rounds.abstained` `:122` | `RevealedRound.abstained` `shared.ts:40` | `p_target` null = wstrzymanie się `full_game_evening.sql:369-370` | `target: null` `vote.ts:9` | `ABSTAIN = "abstain"` `RoundVoting.tsx:52` | „Wstrzymuję się” `RoundVoting.tsx:242`; „Wstrzymało się: N” `RoundReveal.tsx:223` (pl) |
| **Reveal / result** | `private.round_results` (`votes`) `first_live_round.sql:130-135`; `rounds.ballots` `:123`; `phase = 'revealed'` | `RoundResult` `shared.ts:29`; `RevealedRound.results` `:39`; `ResultView = "pie" \| "bars"` `src/lib/rooms/chart.ts:9`; `PieSlice`, `ResultBar` `chart.ts:22,69` | `reveal_round` `first_live_round.sql:723`; `private.finish_round` `:182`; `revealRound` `server.ts:260`; `sortResults` `src/lib/rooms/results.ts:6` | `POST …/reveal` `reveal.ts:11` | `RoundReveal` | „Odsłoń wynik” `RoundVoting.tsx:278`; „Wynik” `RoundReveal.tsx:140`; „Koło”/„Paski” `:78-79`; „Głosy” `:175`; „Wynik odsłonięty.” `announce.ts:21` (pl) |
| **Skip** | `phase = 'skipped'` `full_game_evening.sql:29,197` | `SkippedRound` `shared.ts:45`; `VotingRound.after_skip` `:26` | `skip_round` `full_game_evening.sql:140`; `skipRound` `server.ts:285`; `skipNotice` `announce.ts:32` | `POST …/skip` `skip.ts:15` | `RoundSkipped` `RoundSkipped.tsx:31` | „Pomiń pytanie” `RoundVoting.tsx:287`; „Host pominął pytanie.” `RoundSkipped.tsx:31`; „Głosy z niego przepadły.” `:32` (pl) |
| **Closing a room** | `status = 'closed'`; `private.drop_round_state` `first_live_round.sql:166`; `private.close_stale_games` `close_stale_games.sql:17`; zadanie cron `'close-stale-games'` `close_stale_games.sql:42` | `CreateRoomResult.closedRoomId` `server.ts:22` | `create_room(p_confirm_close)` `first_live_round.sql:225`; `end_game` | pole formularza `confirm_close` `index.ts:43`; zadanie pg_cron co godzinę | `EveningEnd` | „Zamknij stary pokój i załóż grę” `NewGameForm.tsx:204`; „Ta gra jest zamknięta.” `errors.ts:30`; „Ta gra już się skończyła.” `src/pages/j/[token].astro:76` (pl) |
| **Bell / live sync** | — (Supabase Realtime, temat `live-sync:<roomId>`) `src/lib/live-sync/shared.ts:3,20` | `BELL_EVENT = "bell"` `live-sync/shared.ts:4`; `LOBBY_POLL_MS` `:8`; `LiveConfig` `useRoomState.ts:19` | `ringLobby` `server.ts:368` → `ringRoom` `live-sync/server.ts:12` | zdarzenie Realtime `bell` | `LiveBanner` | „Połączenie na żywo przerwane — odświeżam” `LiveBanner.tsx:4` (pl) |
| **Refusal codes** | `{ok:false, reason}` w każdej funkcji, np. `full_game_evening.sql:100` | `ROUND_REFUSALS`, `RoundRefusal` `errors.ts:7,20`; `RoomFailure` `server.ts:13` | `roomErrorMessage` `errors.ts:47`; `actionAnswer` `json-route.ts:130` | `?error=<code>` `index.ts:46`; JSON `{error: code}` | `ServerError` | mapa komunikatów `errors.ts:22-43` (pl) |
| **Client report** (zgłoszenie z ekranu) | — | `CLIENT_EVENTS = ["realtime_status","refresh_failed","island_crash"]` `src/lib/client-events.ts:8` | `reportClientEvent` `useRoomState.ts:68` | `POST /api/client-events` `src/pages/api/client-events.ts:13` | `RoomErrorBoundary` | „Odśwież stronę” `RoomErrorBoundary.tsx:78` (pl) |

Nazwa produktu: „Most Likely To” `src/components/room/AppHeader.astro:29,32`, `src/layouts/Layout.astro:10`; po polsku „Kto z nas najprawdopodobniej…?” `src/components/room/Landing.astro:14` (evidence).

## One concept, many names

- **Pokój = gra = wieczór (evidence).** Tabela ma tylko jedno pojęcie: `public.rooms` (`room_lobby.sql:19`). Operacje i etykiety mówią jednak o „grze” w trzech postaciach. W kodzie: `start_game` `first_live_round.sql:540`, `end_game` `full_game_evening.sql:207`, `close_stale_games` `close_stale_games.sql:17`. W formularzu: „Nowa gra”, „Załóż grę”, choć to `create_room` (`NewGameForm.tsx:219`, `index.ts:38`). Przy końcu: „wieczór” (`EveningEnd` `RoomScreen.tsx:55`, „Koniec wieczoru”). Ten sam stan `closed` ma w UI cztery teksty: „Ta gra jest zamknięta.” (`errors.ts:30`), „Ta gra już się skończyła.” (`[token].astro:76`), „gra się skończyła” (`NewGameForm.tsx:198`), „Koniec wieczoru” (`RoomScreen.tsx:59`).
- **Runda = pytanie (evidence).** Tabela i typy mówią `rounds`/`RoundState`, a host widzi „Następne pytanie” → `next_round` (`HostActions.tsx:46`, `server.ts:268`) i „Pomiń pytanie” → `skip_round`. Komunikat o nowej rundzie brzmi „Pytanie N.” (`announce.ts:26`). Pole body `round` opisano jako „The number of the question on the player's screen” (`json-route.ts:109`, `comment`).
- **Urna (evidence + `comment`).** W schemacie urna to `private.ballot_boxes` z kolumną `tally` (`first_live_round.sql:141-143`). W komentarzach nazywa się „the urn” (`first_live_round.sql:137`, `full_game_evening.sql:7`; `comment`). W UI nie ma żadnej etykiety.
- **Host (evidence).** W schemacie host to `host_id` (`room_lobby.sql:21`) albo `user_id` na swoim wierszu gracza (`:39`). W SQL i TS ma rolę `'host'` (`full_game_evening.sql:434`, `shared.ts:55`). W Workerze występuje jako `locals.user` (`middleware.ts:11`). W UI to „host” (`RoundVoting.tsx:62`) albo „osoba prowadząca” (`SignInCard.astro:25`).
- **Kod linku (evidence).** W kolumnie i funkcjach to `link_token` (`room_lobby.sql:23`). W komentarzach i nazwach operacji logu to „link code” (`server.ts:322` w `comment`, `op: "link_code"` `server.ts:330`, `first_live_round.sql:383` w `comment`). W trasie to parametr `[token]` (`src/pages/j/[token].astro`), w formularzu pole `link` (`join.ts:12`), a w UI „Link dla graczy”.
- **Stan pokoju vs stan linku (evidence).** `rooms.status` przyjmuje `lobby|playing|closed` (`first_live_round.sql:43`). `room_link` tłumaczy te wartości na `open|started|closed|unknown` (`first_live_round.sql:395-416`). Słownik linku idzie dalej do `RoomLinkResult` (`server.ts:25-30`) i do `Page.kind` strony `/j` (`[token].astro:17-23`). `playing` ma też w UI etykietę „Gra w toku” (`OpenRoomNotice.astro:20`).
- **Zakończenie rundy przez odsłonięcie (evidence).** Ten sam krok występuje pod nazwą `reveal_round` (akcja hosta, `first_live_round.sql:723`) i `private.finish_round` (wywoływana też automatycznie po ostatnim głosie, `full_game_evening.sql:386-388`). Faza nazywa się `revealed`, a w UI to „Odsłoń wynik” i „Wynik odsłonięty.”.
- **Odświeżenie stanu (evidence).** Ta sama czynność ma nazwy `ringLobby` (`server.ts:368`) i `ringRoom` (`live-sync/server.ts:12`). Zdarzenie Realtime nazywa się `bell` (`live-sync/shared.ts:4`). W UI to „Połączenie na żywo” (`LiveBanner.tsx:4`).
- **Wstrzymanie się (evidence).** W kontrakcie wstrzymanie się to `p_target` równe null (`full_game_evening.sql:369`) i `target: null` w body (`vote.ts:9`). W bazie są to kolumny `abstained`, w UI wartość radia `"abstain"` (`RoundVoting.tsx:52`) i etykieta „Wstrzymuję się”.
- **Uprawnieni do głosu (evidence).** W bazie to `rounds.eligible` (`first_live_round.sql:120`) i `v_eligible`. Ekran liczy jednak „Zagłosowało: X z Y” od `view.players.length` (`RoundVoting.tsx:143`), bo kontrakt `room_lobby` nie zwraca `eligible` (`full_game_evening.sql:463-480`). `inference`: obie liczby są równe tylko dlatego, że w trakcie gry nikt nie dołącza (`first_live_round.sql:342-344`).

## One name, many concepts

- **`lobby` (evidence).** (a) Stan przed startem: `status = 'lobby'` (`room_lobby.sql:25`), `RoomLobby` (`RoomLobby.tsx:35`), „w poczekalni”. (b) Cały stan pokoju w każdym statusie, także z rundą w toku: RPC `room_lobby` (`full_game_evening.sql:403`), typ `LobbyState` z polem `round` (`shared.ts:53-59`), endpoint `GET /api/rooms/[id]/lobby`, który zwraca `RoomView` (`lobby.ts:43`), `ringLobby` po głosie (`vote.ts:48`), `Page.kind: "lobby"` dla każdego stanu `/r/[id]` (`[id].astro:19,49`) i `LOBBY_POLL_MS`, które dotyczy też gry w toku (`live-sync/shared.ts:5-8`, `comment`).
- **`round` (evidence).** W tych samych funkcjach SQL `p_round integer` to numer rundy (`full_game_evening.sql:259`), a `v_round uuid` to id rundy (`:271`). W TS `round` to obiekt `RoundState` (`shared.ts:58`) albo numer w body (`json-route.ts:112`).
- **`ballot…` (evidence).** `ballot_boxes` to urna w toku (`first_live_round.sql:141`). `rounds.ballots` to liczba osób, które oddały głos (głos na kogoś albo wstrzymanie się), ustawiana przy odsłonięciu (`first_live_round.sql:196-207`).
- **`no_questions` (evidence).** (a) Przy starcie: pula wybranych kategorii jest pusta. Kod ustawia go Worker, nie baza (`start.ts:29-30`). (b) Przy `next_round`: wszystkie pytania puli zostały już zagrane (`full_game_evening.sql:128-131`). Mapa komunikatów zna tylko znaczenie (a): „W wybranych kategoriach nie ma pytań. Załóż nową grę z innymi kategoriami.” (`errors.ts:35`). Znaczenie (b) ma w UI osobne zdanie: „Pytania z wybranych kategorii się skończyły.” (`HostActions.tsx:62`).
- **`no_round` (evidence).** Ten kod oznacza kilka różnych sytuacji: pokój w lobby (`full_game_evening.sql:314-316`), brak wiersza rundy (`:324-326`), głosującego spoza `eligible` (`:344-346`) i `end_game` poza grą (`:233-235`). Komunikat dla wszystkich brzmi „Teraz nie trwa żadna runda.” (`errors.ts:40`).
- **`round_over` (evidence).** Oznacza (a) numer rundy z ekranu inny niż bieżący (`full_game_evening.sql:120-121,182-183,329-330`) albo (b) rundę pominiętą lub niegłosowaną (`:191-193,338-340`).
- **`room_unknown` (evidence).** Celowo jeden kod obejmuje: nieznany link (`first_live_round.sql:326-339`), pokój innego hosta (`full_game_evening.sql:98-101`), osobę spoza pokoju (`:305-308`) i brak sesji lub ciasteczka (`OUTSIDE_ROOM` `json-route.ts:20`). Przy odpowiedzi HTTP zmienia się w `not_found` (`json-route.ts:137`).
- **`question` (evidence).** (a) `question_id` (`first_live_round.sql:117`). (b) Końcówka zdania po „Kto z nas najprawdopodobniej”: `QuestionEntry.text` (`questions.ts:14-16`, `comment`) i `RoundView.question` (`shared.ts:65`). (c) Pełne zdanie w spike'u: `LiveSyncState.question` (`live-sync/server.ts:39`).
- **`owner` / `creator` (`comment`).** (a) Właściciel funkcji `postgres` (`first_live_round.sql:773-780`). (b) Właściciel projektu, czyli osoba czytająca logi: „the owner's logs” (`RoomErrorBoundary.tsx:22`, `useRoomState.ts:64`). (c) „the game creator curates it” (`questions.ts:2`). (d) Test pgTAP „The creator's view … what the database owner can read” (`supabase/tests/round_creator_view.test.sql:1`). `inference`: „creator” to nie host gry, tylko operator projektu.
- **`status` (evidence).** Słowo nazywa trzy różne zbiory wartości: `rooms.status` (`lobby|playing|closed`), status linku z `room_link` (`open|started|closed|unknown`) i `ClientState` (`client-events.ts:10`).

## Implicit concepts

- **Gra (game) nie ma własnej tabeli ani typu (evidence).** Gra to `rooms.status = 'playing'` z `rooms.started_at` (`first_live_round.sql:51,590`). Indeks `rooms_one_open_per_host` (`first_live_round.sql:47`) sprawia, że host ma najwyżej jedną otwartą grę.
- **Głos nie istnieje jako rekord (evidence + `comment`).** Głos zostawia tylko dwa ślady: wiersz `round_voters` bez celu i inkrementację w `ballot_boxes.tally` (`full_game_evening.sql:363-379`). `round_voters.player_id` celowo nie ma klucza obcego (`first_live_round.sql:147-151`; uzasadnienie w `comment`).
- **Pula pytań i kandydaci (evidence).** Pula nie ma typu. W kodzie to `QuestionId[]` z `poolFrom` (`draw.ts:25`) i `p_candidates text[]` (`full_game_evening.sql:38`). Liczbę pozostałych pytań wylicza się arytmetycznie: `questionPool(...).length > round.number` (`server.ts:223`).
- **Seat (kolejność dołączenia) (evidence).** Kolumna `players.seat` (`room_lobby.sql:41`) nie ma pola w TS. Kolejność tablic `players`, `voted` i `results` jest jedynym nośnikiem tej informacji (`full_game_evening.sql:468,492,510`; `results.ts:3-6` w `comment`).
- **Uprawnieni (`eligible`) (evidence).** Tylko `uuid[]` w `rounds` (`first_live_round.sql:120`). Kolumna nie ma typu w TS ani etykiety w UI.
- **Ja (`me`) (evidence).** Tożsamość oglądającego to sam nick: `LobbyState.me: string` (`shared.ts:56`). UI porównuje `player.nick === view.me` (`RoomLobby.tsx:171`, `RoundReveal.tsx:210`).
- **Tożsamość gościa (evidence).** Gość istnieje jako trzy luźne elementy: 43-znakowy token (`PLAYER_TOKEN_PATTERN` `tokens.ts:11`), ciasteczko per pokój (`tokens.ts:31-33`) i hash `player_secrets.token_hash` (`room_lobby.sql:51`). Żaden typ ich nie łączy.
- **Późny gracz („late players”) (`comment`).** Występuje tylko jako zapowiedź „S-08 decides about late players” (`first_live_round.sql:341`, `join.ts:39`). Dziś kod go odrzuca: `game_started`.
- **Kontrola wersji ekranu (evidence).** Ochrona przed spóźnionym ekranem nie ma osobnego pojęcia. To numer rundy w body i kod `round_over` (`json-route.ts:109-116`).

## States and transitions

**`rooms.status`**: `lobby | playing | closed`. Constraint `first_live_round.sql:43`, typ TS `shared.ts:9`. Komentarz z diagramem: „lobby → playing (start_game) → closed ("Zakończ grę", "Nowa gra" or the sweep of abandoned games)” (`shared.ts:8`). Każde przejście zapisuje funkcja SQL (evidence):

| przejście | gdzie zapisane |
| --- | --- |
| tworzenie z `lobby` | domyślna wartość kolumny `room_lobby.sql:25`, insert w `first_live_round.sql:283` |
| `lobby → playing` | `update … set status = 'playing', started_at = now()` `first_live_round.sql:590` (`start_game`) |
| `lobby\|playing → closed` przez „Nowa gra” | `first_live_round.sql:276` (`create_room`) |
| `playing → closed` przez „Zakończ grę” | `full_game_evening.sql:237` (`end_game`) |
| `playing → closed` po 12 h | `close_stale_games.sql:29-32`, cron `'0 * * * *'` `close_stale_games.sql:42` |

**`rounds.phase`**: `voting | revealed | skipped`. Constraint `full_game_evening.sql:29`, typy `shared.ts:23,38,47`. Przejścia (evidence):

| przejście | gdzie zapisane |
| --- | --- |
| powstanie w `voting` | wartość domyślna `first_live_round.sql:118`; insert w `start_game` `:584` i w `open_next_round` `full_game_evening.sql:65` |
| `voting → revealed` | `first_live_round.sql:206-207` (`finish_round`), wywoływane z `reveal_round` `:763-764` i z `cast_vote` po ostatnim głosie `full_game_evening.sql:386-388` |
| `voting → skipped` | `full_game_evening.sql:197` (`skip_round`) |

Bieżąca runda to „latest round”, czyli `order by r.number desc limit 1`. Ta sama kwerenda powtarza się w `room_lobby`, `cast_vote`, `reveal_round`, `next_round` i `skip_round` (`full_game_evening.sql:455-458,318-322,108-112,170-174`, `first_live_round.sql:752-756`).

**Stan widoku po stronie ekranu** (evidence): `RoomContent` wybiera widok z `status` i `round.phase` w kolejności `closed → EveningEnd`, `round === null → RoomLobby`, `skipped → RoundSkipped`, `voting → RoundVoting`, w pozostałych przypadkach `RoundReveal` (`RoomScreen.tsx:131-193`). Ten sam wybór powtarza `roomColumn` (`room-frame.ts:22-28`). Klucz ogłoszeń to `status:phase:number` (`announce.ts:9-11`).

**Stan linku** `open | started | closed | unknown` (`first_live_round.sql:395-416`) przekłada się na `Page.kind` i statusy HTTP: 302 dla `inside`, 404 dla `unknown`, 409 dla `started`, 410 dla `closed` (`[token].astro:48-59`).

**Akcje** (evidence): `RoomAction = "start" | "vote" | "reveal" | "next" | "skip" | "end"` (`room-actions.ts:11`). Akcje hosta zawężone są do `HostActionId = "reveal" | "skip" | "end" | "next"` (`HostActions.tsx:15`).

## Where business logic lives

**Ogólnie (evidence):** w kodzie nie ma warstwy domenowej. Nie ma klas, encji ani metod na typach. Typy w `src/lib/rooms/shared.ts` to kontrakty odpowiedzi RPC z parserami (`shared.ts:75-201`). Reguły gry siedzą głównie w funkcjach SQL `security definer`. Worker robi losowanie, pulę pytań, mapowanie błędów i HTTP. W TS nie znalazłem żadnego bezpośredniego zapisu do tabel: wyszukiwanie `.update(|.insert(|.delete(|.upsert(` w `src/` poza live-sync dało tylko trafienie niezwiązane z bazą (`HostActions.tsx:147`). Odczyty przez RLS są trzy (`server.ts:311,328,343`).

| reguła | warstwa | miejsce |
| --- | --- | --- |
| Start: host, status `lobby`, minimum 3 graczy, ustalenie `eligible` | DB | `first_live_round.sql:553-590`; UI tylko informuje (`MIN_PLAYERS` `shared.ts:5-6`, `RoomLobby.tsx:147-148`) |
| Głos: jeden na rundę, ostateczny, cel z `eligible`, numer rundy, auto-odsłonięcie po ostatnim głosie | DB | `full_game_evening.sql:255-392` |
| Odsłonięcie w dowolnej chwili i idempotentne | DB | `first_live_round.sql:721-769` |
| Następne pytanie i pominięcie: kolejność, brak powtórek, `round_over` | DB | `full_game_evening.sql:38-203` |
| Kolejność kandydatów | Worker | `shuffledPool` `draw.ts:54-65` |
| Koniec gry, „Nowa gra” zamyka stary pokój, sprzątanie po 12 h | DB | `full_game_evening.sql:207-242`; `first_live_round.sql:264-280`; `close_stale_games.sql:17-42` |
| Reguła nicka (normalizacja, 1–20 znaków, unikalność `nick_key`) | DB | `first_live_round.sql:60-107,350-359` |
| To samo po stronie przeglądarki, tylko przybliżenie | UI | `nickLength` `shared.ts:203-207`, `NewGameForm.tsx:53-55`, `JoinForm.tsx:28-29` |
| Kategorie i 18+: filtr id względem bazy pytań | route handler | `src/pages/api/rooms/index.ts:26-31` |
| Kategorie i 18+: pula pytań | Worker | `draw.ts:25-33` |
| Kategorie i 18+: kształt danych | DB | `first_live_round.sql:254-258`, constraint `room_lobby.sql:27` |
| Losowanie pierwszego pytania | Worker | `drawQuestion` `draw.ts:67`, `start.ts:29`; baza sprawdza tylko format id (`first_live_round.sql:572`) |
| Czy zostały pytania | Worker | `hostQuestionsLeft` `server.ts:214-224` |
| Ponowne wejście istniejącego gracza zamiast drugiego dołączenia | route handler + page | `join.ts:29-37`, `[token].astro:35-41` |
| Uprawnienia (host przez `auth.uid()`, gość przez hash tokenu) | DB | np. `full_game_evening.sql:294-308`; RLS `room_lobby.sql:65-83` |
| Uprawnienia: wczesne wyjście „outside room” | route handler | `json-route.ts:18-20` |
| Anonimowość: strukturalnie | DB | tabele `unlogged`, brak FK, brak kolumn czasu (`first_live_round.sql:137-153`) |
| Anonimowość: lista dozwolonych pól logu | Worker | `LOG_FIELDS` `src/lib/log.ts:13-27` |
| Anonimowość: parser kopiujący tylko klucze kontraktu | Worker / UI | `shared.ts:119-128` |
| Kolejność wyniku i wykresy | lib bezpieczny dla przeglądarki | `results.ts:6-8`, `chart.ts:16-81` |
| Ogłoszenia dla czytnika ekranu | lib | `announce.ts:9-34` |
| Komunikaty odmów | lib (mapa) | `errors.ts:22-43` |

## Unknowns

- **Spike `live-sync` jest częścią produktu (evidence).** `0-sources.md` wyklucza `src/lib/live-sync/**` jako „an early technical spike”, ale kod produktu importuje z niego `ringRoom` (`server.ts:2`), `BELL_EVENT`, `LOBBY_POLL_MS`, `topicFor` (`useRoomState.ts:6`) i `createFetchLimiter` (`useRoomState.ts:5`). Kanał produktu nosi nazwę spike'a: `live-sync:<roomId>`. W produkcie `seq` dzwonka to `Date.now()` (`server.ts:369`). Nie sprawdzałem, czy reszta spike'a (`limiter.ts`) zawiera reguły domenowe.
- **`/dashboard` to pozostałość startera (`inference`).** Strona po angielsku („Dashboard”, „Welcome”, „This page is only for authenticated users.” `src/pages/dashboard.astro:7-16`) jest jedyną trasą w `PROTECTED_ROUTES` (`middleware.ts:5`). `grep -rn dashboard src` poza `src/pages/dev` znalazł tylko `middleware.ts:5`: żaden ekran produktu do niej nie linkuje.
- **Wskaźnik `ballots` (evidence).** Jest parsowany (`shared.ts:151`), ale żaden komponent produktu go nie wyświetla. Wyszukiwanie `ballots` w `src/components` i `src/pages` poza `dev/` nic nie znalazło. Nie wiem, czy to celowe.
- **Brakujące w kodzie znaczenie `no_questions` (b).** Mapa komunikatów nie ma tekstu dla wyczerpanej puli po `next_round`. Ekran pokazałby tekst „W wybranych kategoriach nie ma pytań…” (`errors.ts:35`), jeśli `questionsLeft` było `null`, a host kliknął „Następne pytanie” (`RoundReveal.tsx:233` przekazuje `view.questionsLeft !== false`). To `inference` z kodu; nie uruchamiałem tego.
- **Nazwy celów `S-01…S-13`, `FR-0xx`, `US-01`, `D1–D5`, `T1`, `F1`, `F4`, `H1–H8`, `G1–G3` (`comment`).** Występują w komentarzach i nazwach testów jako odwołania do dokumentów. Nie rozwijałem ich, bo dokumentów nie czytałem.
- **Pytania 18+.** Kod oznacza je tylko flagą `adult: true` (58 z 216 wpisów według `grep`). Zasady treści są wyłącznie w komentarzu (`questions.ts:17`, `comment`).

## Commands run

- `git ls-files | grep -vE …` (lista plików w zakresie, z wykluczeniami z `0-sources.md`)
- `wc -l` na głównych plikach kodu
- `grep -nEi 'create|alter|drop … table|function|policy|index …|cron.schedule' supabase/migrations/*.sql`
- odczyt w całości 4 migracji, `src/lib/rooms/*.ts`, `src/lib/rounds/draw.ts`, tras `src/pages/api/rooms/**`, stron `index`, `dashboard`, `j/[token]`, `r/[id]`, `middleware.ts`, `RoomScreen.tsx`, `room-actions.ts`, `room-frame.ts`, `client-events.ts`, `auth-errors.ts`, `auth-user.ts`, `live-sync/shared.ts`, `live-sync/server.ts`
- `sed -n` na fragmentach `questions.ts`, `HostActions.tsx`, `RoundVoting.tsx`, `RoundReveal.tsx`, `NewGameForm.tsx`, `Landing.astro`, `AppHeader.astro`, `log.ts`, `round_creator_view.test.sql`
- `grep -nE` po polskich literałach w `src/components/room/*` i `src/components/auth/*`
- `grep -rnE 'ballot|abstain|wstrzym'`, `grep -rnE 'live-sync'`, `grep -nE "set (status|phase)"`, `grep -rnE '\.update\(|\.insert\(|\.delete\(|\.upsert\('`, `grep -rnEi 'creator|owner'`
- `grep -rnhoE '(describe|it|test)("…'` w `tests/db`, `tests/e2e` i `tests/unit`
