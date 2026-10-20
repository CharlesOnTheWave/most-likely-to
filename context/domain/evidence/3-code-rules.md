# Evidence: rules guarded in the code

Zakres: całe repo (jedna aplikacja), wykluczenia wg `context/domain/evidence/0-sources.md`. Jedyny agent reguł.
Head: a4eb127.

Przeszukane warstwy:

- **baza**: 4 migracje w `supabase/migrations/` (tabele, CHECK/UNIQUE/FK, kolumna generowana, indeks częściowy, RLS,
  granty, funkcje `security definer`, pg_cron). Dla każdej funkcji cytuję najnowszą definicję: `start_game` i
  `reveal_round` z `*_first_live_round.sql` (później nie były zmieniane), `cast_vote` i `room_lobby` z
  `*_full_game_evening.sql`, `create_room`, `join_room`, `room_link` i `normalize_nick` z `*_first_live_round.sql`
  (wersje z `*_room_lobby.sql` zostały zastąpione), oraz `supabase/config.toml`;
- **Worker / aplikacja**: `src/lib/**`, `src/middleware.ts`;
- **wejścia**: `src/pages/**/*.ts`, `src/pages/**/*.astro`;
- **UI**: `src/components/room/**`, `src/components/auth/**` (tylko pod kątem reguł biznesowych);
- **testy**: tylko do potwierdzenia, że strażnik działa (tytuły testów i fragmenty `supabase/tests/round_creator_view.test.sql`).

Czytane spoza zakresu, wyłącznie żeby rozstrzygnąć regułę, którą cytuję: `src/lib/live-sync/server.ts`,
`limiter.ts`, `shared.ts` (importuje je kod produktu: `src/lib/rooms/server.ts:2`,
`src/components/room/useRoomState.ts:5-6`), `astro.config.mjs` (brak nadpisania `security`), grep po
`wrangler.jsonc` (szukanie triggerów cron).

Wzorce wyszukiwania: `raise exception`, `'reason', '…'`, `for update`, `check (`, `unique`, `grant`/`revoke`,
`create policy`, `security definer`, `cron.schedule`, `delete from`, `set status`, `context.redirect`,
`actionAnswer`, `refuseForeignPost`, `disabled=`, `aria-disabled`, `confirmText`, `console.*`, `rate|limit|MAX_`.

Nie objęte: szczegóły testów `tests/unit/**`, `tests/e2e/**` (sprawdzone tylko tytuły testów `tests/db/**`);
konfiguracja produkcyjnego projektu Supabase (w repo jest tylko lokalny `config.toml`).

Skala ścisłości użyta niżej (doprecyzowana pod ten stos):

- **hard (data)**: CHECK/UNIQUE/FK/kolumna generowana odrzuca naruszenie przy każdym zapisującym; „hard (data:
  granty/RLS)” oznacza, że każdą rolę API (`anon`, `authenticated`) zatrzymuje brak grantu albo polityka, a obejść to
  może tylko właściciel (`postgres`);
- **hard (app-SQL)**: reguła żyje w ciele funkcji `security definer`, a role API nie mają grantów zapisu do tabel
  (`supabase/migrations/20261014101922_first_live_round.sql:33-34`, `:160-161`, `:797`), więc każdy zapis z API przez
  nią przechodzi; sam magazyn danych przyjąłby naruszenie od właściciela;
- **hard (app-Worker)**: każdy znaleziony zapis w Workerze przechodzi przez kontrolę, ale bezpośrednie RPC z kluczem
  publishable by ją ominęło;
- **soft / client-only**: jak w opisie agenta.

Skróty ścieżek: `M1` = `supabase/migrations/20261007122858_room_lobby.sql`, `M2` =
`supabase/migrations/20261014101922_first_live_round.sql`, `M3` = `supabase/migrations/20261014101925_close_stale_games.sql`,
`M4` = `supabase/migrations/20261015122252_full_game_evening.sql`.

## Guarded rules

Kolumna „reguła” to moje sformułowanie (**inference**); cytaty i lokalizacje to **evidence**.

### A. Pokój i host

| reguła | gdzie strzeżona (warstwa: path:line) | ścieżki objęte | ścisłość | obsługa porażki |
| --- | --- | --- | --- | --- |
| Grę zakłada tylko zalogowany host. | DB: `create_room` → `'not_signed_in'` (`M2:239-241`); `grant execute … create_room … to authenticated` (`M2:799`), anon odrzucony (test `tests/db/roles.test.ts:163`). Worker: `if (!context.locals.user) return context.redirect("/auth/signin")` (`src/pages/api/rooms/index.ts:16-18`). UI: formularz tylko dla `user`, inaczej `<Landing />` (`src/pages/index.astro:41-53`). | jedyny zapis pokoju: `create_room` | hard (data: granty) | named error (`not_signed_in`), w Workerze redirect na logowanie |
| Host ma najwyżej jeden otwarty pokój (lobby albo gra w toku); „Nowa gra” zamyka poprzedni. | DB: `create unique index rooms_one_open_per_host on public.rooms (host_id) where status in ('lobby', 'playing')` (`M2:46-47`); `create_room` blokuje i zamyka otwarty pokój (`M2:264-280`). Worker polega na tym: `hostOpenRoomId` `.limit(1).maybeSingle()` (`src/lib/rooms/server.ts:306-311`). | `create_room` | hard (data) | dwa równoczesne „Załóż grę” → `unique_violation` → `'try_again'` (`M2:294-297`), named error |
| Zamknięcie starego pokoju z gośćmi wymaga potwierdzenia hosta. | DB: `if not coalesce(p_confirm_close, false) and exists (… p.user_id is null)` → `'open_room_has_guests'` (`M2:270-274`). Worker: `confirmClose: form?.get("confirm_close") === "1"` (`src/pages/api/rooms/index.ts:43`). UI: pytanie w formularzu (`src/components/room/NewGameForm.tsx:103-108`, `:190-216`); `roomToClose` tylko gdy są goście (`src/pages/index.astro:35`). | `create_room` | hard (app-SQL) | named error |
| Kod linku robi baza: 22 znaki base64url, unikalny; host go nie wybiera. | DB: `link_token text not null unique check (link_token ~ '^[A-Za-z0-9_-]{22}$')` (`M1:23`); generowanie `translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_')` (`M2:282-290`); „p_link_token is ignored: the code is made here” (`M2:219`). Brak grantu insert dla hosta (`M2:33-36`); test „create_room does not take a link code the host picked” (`tests/db/roles.test.ts:248`). | `create_room` | format i unikalność: hard (data); „robi baza”: hard (app-SQL) | kolizja kodu → ten sam `unique_violation` → `try_again` (`M2:294-297`) (inference) |
| Status pokoju: `lobby` → `playing` → `closed`; zamknięty pokój nigdy nie wraca. | DB: `check (status in ('lobby', 'playing', 'closed'))` (`M2:42-43`); rola API nie ma `update` (`M2:33-34`, polityka update usunięta `M2:37`). Jedyne przejścia: `set status = 'playing'` (`M2:590`, tylko z lobby: `M2:564-570`), `set status = 'closed'` (`M2:276`, `M3:32`, `M4:237`); grep `set status` po 4 migracjach nie znalazł przejścia z `closed`. Test „the host cannot reopen a closed room over REST” (`tests/db/roles.test.ts:224`). | wszystkie funkcje + cron | hard (data: granty) + hard (app-SQL) dla kierunku przejść | named error (`room_closed`, `game_started`) |
| Tylko host pokoju wykonuje ruchy gry (start, odsłonięcie, następne, pominięcie, koniec); cudzy pokój wygląda jak nieistniejący. | DB: `if v_host is null or v_user is null or v_user <> v_host then … 'room_unknown'` w `start_game` (`M2:559-562`), `reveal_round` (`M2:742-745`), `next_round` (`M4:98-101`), `skip_round` (`M4:160-163`), `end_game` (`M4:224-227`); granty tylko dla `authenticated` (`M2:803`, `:805`; `M4:539-541`). Worker: `if (!context.locals.user) return actionAnswer(OP, roomId, OUTSIDE_ROOM)` (`src/pages/api/rooms/[id]/start.ts:19`, `reveal.ts:17`, `end.ts:19`, `next.ts:28`, `skip.ts:27`), a start/next/skip dodatkowo czytają pokój przez RLS (`start.ts:24-27`, `next.ts:33-36`, `skip.ts:32-35`). UI: przyciski tylko gdy `isHost` (`RoomLobby.tsx:124`, `RoundVoting.tsx:271`, `RoundReveal.tsx:230`, `RoundSkipped.tsx:38`). | 5 funkcji hosta | hard (app-SQL) | named error `room_unknown` → 404 `not_found` (`src/lib/rooms/json-route.ts:118-119`, `:137`) |

### B. Gracz, nick, dołączanie

| reguła | gdzie strzeżona | ścieżki objęte | ścisłość | obsługa porażki |
| --- | --- | --- | --- | --- |
| Nick ma 1–20 znaków po normalizacji. | DB: `nick text not null check (char_length(nick) between 1 and 20)` (`M1:37`); `create_room` (`M2:249-252`) i `join_room` (`M2:356-359`) liczą długość po `private.normalize_nick` (`M2:60-84`). Limit 100 znaków przed regexami (`M2:244-246`, `:351-353`). UI: `nickLength` (`src/lib/rooms/shared.ts:203-207`), `NICK_MAX_LENGTH = 20` (`shared.ts:4`), błędy pól (`NewGameForm.tsx:49-56`, `JoinForm.tsx:26-31`); Worker celowo nie sprawdza: „The nick rule lives in the database” (`src/pages/api/rooms/index.ts:20`, `join.ts:10`). | `create_room`, `join_room` | długość: hard (data); normalizacja: hard (app-SQL) | named error `invalid_nick` |
| To, co wygląda tak samo, jest tym samym nickiem w pokoju (bez selektorów wariantów i tagów, NFC, białe znaki, niewidoczne znaki); wielkość liter się liczy. | DB: `nick_key text generated always as (private.nick_key(nick)) stored` (`M2:103`), `unique (room_id, nick_key)` (`M2:106-107`); `private.nick_key` (`M2:90-99`); nick pusty po usunięciu selektorów → `invalid_nick` (`M2:250`, `:357`); „Case counts ("Ola" and "ola" are two nicks)” (`M1:97-98`). | `join_room` (host jest pierwszy, kolizja niemożliwa) | hard (data) | `join_room` mapuje naruszenie `players_room_nick_key` na `'nick_taken'` (`M2:367-374`), named error; inne naruszenie unikalności → `raise` (`M2:373`), generic error |
| Dołączyć można tylko do pokoju w lobby; gra w toku nie przyjmuje nikogo nowego. | DB: `join_room` → `'game_started'` / `'room_closed'` (`M2:341-348`), blokada wiersza pokoju porządkuje to względem `start_game` (`M2:330-335`, `:553-557`). Worker: `if (room.status === "started") return backToLink("game_started")` (`src/pages/api/rooms/join.ts:41`); strona linku: 409 dla `started` (`src/pages/j/[token].astro:42`, `:53-54`). UI: link pokazywany hostowi tylko w lobby (`src/pages/r/[id].astro:42-47`), podpowiedź „Po starcie nikt nowy już nie dołączy.” (`RoomLobby.tsx:147`). | `join_room` | hard (app-SQL) | named error |
| Gracz już obecny w pokoju (host albo gość z ciasteczkiem) wraca do pokoju zamiast drugiego wejścia, także po starcie. | Worker: `join.ts:29-37`; strona: `src/pages/j/[token].astro:35-41`. | `POST /api/rooms/join`, `GET /j/<code>` | soft (inference): po stronie bazy nic nie łączy przeglądarki z graczem poza tokenem, więc gość bez ciasteczka może dołączyć jeszcze raz pod innym nickiem; komunikat `nick_taken` to przewiduje (`src/lib/rooms/errors.ts:24-25`) | redirect do pokoju |
| Kolejność miejsc: host ma miejsce 1, goście kolejne numery; miejsca w pokoju się nie powtarzają. | DB: `unique (room_id, seat)` (`M1:44`); host `seat` 1 (`M2:292-293`); gość `coalesce(max(p.seat), 0) + 1` pod blokadą pokoju (`M2:330-335`, `:362-366`). | `create_room`, `join_room` | unikalność: hard (data); numeracja: hard (app-SQL) | brak osobnego kodu (inference: naruszenie `players_room_seat_key` → `raise`, `M2:373`, generic error) |
| Jeden użytkownik-host to najwyżej jeden gracz w pokoju; konto ma tylko host, o gościu nie zostaje nic poza nickiem. | DB: `unique (room_id, user_id)` (`M1:43`); „Set only for the host. Nothing about a guest is kept but the nick” (`M1:38`); `join_room` wstawia gracza bez `user_id` (`M2:362`). | `create_room`, `join_room` | hard (data) dla unikalności; „tylko host ma `user_id`”: hard (app-SQL) (brak CHECK wiążącego `players.user_id` z `rooms.host_id`) | — |
| Tożsamość gościa to losowy token 32 B w ciasteczku httpOnly; baza trzyma tylko sha256 i nikt go nie odczyta. | DB: `player_secrets` bez grantów i polityk (`M1:47-52`, `:58`); zapis `sha256(convert_to(p_player_token, 'UTF8'))` (`M2:376-377`); format tokenu `'^[A-Za-z0-9_-]{43}$'` (`M2:322-324`, `M4:279-281`). Worker: `newPlayerToken` (`src/lib/rooms/tokens.ts:26-29`), ciasteczko `httpOnly`, `sameSite: "lax"`, 24 h (`tokens.ts:13`, `:37-45`); cookie innego kształtu traktowane jak brak (`src/pages/api/rooms/[id]/vote.ts:39-41`). Test „a host reading player_secrets gets 42501” (`tests/db/roles.test.ts:106`). | `join_room`, `room_lobby`, `cast_vote` | hard (data: granty) | zły format tokenu → `raise exception 'invalid player token' using errcode = '22023'` (`M2:323`, `M4:280`), generic error |
| Brak limitu liczby graczy w pokoju (żaden strażnik nie znaleziony). | Szukane: `join_room` (`M2:308-381`), `src/pages/api/rooms/join.ts`, grep `MAX_PLAYERS|max_players|limit` w `src/` i `supabase/migrations/`; nic. Jedyny pokrewny limit to wygląd wykresu: `MAX_PIE_SLICES = 20` (`src/lib/rooms/chart.ts:11-12`). | — | unknown (nie znaleziono w przeszukanym zakresie) | — |

### C. Start gry

| reguła | gdzie strzeżona | ścieżki objęte | ścisłość | obsługa porażki |
| --- | --- | --- | --- | --- |
| Gra startuje tylko z lobby i przy co najmniej 3 graczach (host się liczy). | DB: `start_game`: `'room_closed'` / `'game_started'` (`M2:564-570`), `if coalesce(cardinality(v_eligible), 0) < 3 then … 'not_enough_players'` (`M2:576-582`). Stała w kodzie: `MIN_PLAYERS = 3` z komentarzem „start_game has the final word; the screen only says it” (`src/lib/rooms/shared.ts:5-6`). UI: `disabled={!canStart \|\| starting}` (`src/components/room/RoomLobby.tsx:43`, `:129`). | `start_game` | hard (app-SQL); UI to tylko podpowiedź | named error |
| Kto głosuje w rundzie, ustala się przy jej otwarciu: wszyscy gracze w pokoju w tej chwili, w kolejności miejsc. | DB: `eligible uuid[] not null check (cardinality(eligible) >= 1)` (`M2:120`); `start_game` (`M2:576-578`, `:584-586`); `open_next_round` (`M4:61-67`). | `start_game`, `next_round`, `skip_round` | hard (app-SQL); niepustość: hard (data) | — |
| Czas startu gry zapisuje się raz, przy starcie (od niego liczy sprzątanie). | DB: `started_at timestamptz` (`M2:51`), `set status = 'playing', started_at = now()` (`M2:590`). | `start_game` | hard (app-SQL) | — |

### D. Głosowanie

Wszystkie wiersze: `cast_vote` w `M4:255-392`, wejście Workera `src/pages/api/rooms/[id]/vote.ts`.

| reguła | gdzie strzeżona | ścieżki objęte | ścisłość | obsługa porażki |
| --- | --- | --- | --- | --- |
| Głosuje tylko gracz tego pokoju: host po sesji, gość po tokenie; ktoś spoza pokoju nic się nie dowiaduje. | DB: `M4:294-308` („Someone who is not in this room learns nothing about it.”). Worker: `if (!context.locals.user && !playerToken) return actionAnswer(OP, roomId, OUTSIDE_ROOM)` (`vote.ts:42`). | `cast_vote` (granty `anon, authenticated`: `M4:542`) | hard (app-SQL) | `room_unknown` → 404 |
| Głos tylko w otwartej, najnowszej rundzie gry w toku. | DB: `'room_closed'` / `'no_round'` (`M4:310-316`), najnowsza runda `order by r.number desc limit 1` (`M4:318-326`), `'round_revealed'` (`M4:333-335`), runda pominięta → `'round_over'` (`M4:337-340`). | `cast_vote` | hard (app-SQL) | named error |
| Głos trafia tylko w pytanie, które gracz widział (numer rundy z ekranu). | DB: `if p_round is not null and p_round <> v_number then … 'round_over'` (`M4:328-331`). Worker: `bodyRound` (`src/lib/rooms/json-route.ts:109-116`), przekazanie tylko gdy jest (`src/lib/rooms/server.ts:253`). UI: wysyła `{ target, round }` (`src/components/room/RoomScreen.tsx:124`). | `cast_vote` | **soft**: `p_round` jest opcjonalny (`M4:259`), a Worker przyjmuje ciało bez `round` (`json-route.ts:113` zwraca `null`) | named error `round_over` |
| Głosuje tylko ktoś uprawniony w tej rundzie (był w pokoju przy jej otwarciu). | DB: `if not (v_voter = any (v_eligible)) then … 'no_round'` (`M4:344-346`). | `cast_vote` | hard (app-SQL) | named error (kod ogólny `no_round`) |
| Jeden głos na gracza w rundzie; głosu nie da się zmienić. | DB: sprawdzenie przed zapisem → `'already_voted'` (`M4:348-351`), klucz `primary key (round_id, player_id)` jako zabezpieczenie (`M2:149-153`); żadna funkcja nie zmienia ani nie usuwa pojedynczego głosu (grep `delete from` po migracjach: tylko całe urny, `M2:171-177`, `:210-211`, `M4:195-196`). UI: po głosie formularz znika, „Głosu nie da się zmienić.” (`src/components/room/RoundVoting.tsx:163-172`, `:266`); wybór tylko w pamięci komponentu (`RoundVoting.tsx:16-20`). | `cast_vote` | hard (data) + hard (app-SQL), **z wyjątkiem awarii**: tabela `round_voters` jest `unlogged` (`M2:149`), więc crash ją czyści i gracz może zagłosować ponownie (test: „after the crash, Ola, whose vote it lost, votes again”, `supabase/tests/round_creator_view.test.sql:687-698`) | named error `already_voted` |
| Cel głosu to gracz uprawniony w tej rundzie (siebie też można) albo wstrzymanie się (`null`). | DB: `where p.room_id = p_room_id and p.nick = p_target and p.id = any (v_eligible)` → `'unknown_target'` (`M4:353-361`). Worker: `target` musi być stringiem albo `null` (`vote.ts:9-16`). UI: lista graczy + „Wstrzymuję się” (`RoundVoting.tsx:196-244`), podpowiedź „także siebie” (`RoundVoting.tsx:149`). Głos na siebie przyjmowany (test `tests/db/round-rules.test.ts:111`). | `cast_vote` | hard (app-SQL) | named error / `invalid_body` 400 |
| Ostatni uprawniony głos sam odsłania rundę. | DB: `if v_voters >= cardinality(v_eligible) then perform private.finish_round(v_round)` (`M4:381-388`). | `cast_vote` | hard (app-SQL) | — (inference: gracz, który zgubił ciasteczko w trakcie gry, nie wróci, bo `join_room` odmawia `game_started`, `M2:341-344`, więc runda nie odsłoni się sama; host odsłania ręcznie) |

### E. Odsłonięcie, następne pytanie, pominięcie, koniec gry

| reguła | gdzie strzeżona | ścieżki objęte | ścisłość | obsługa porażki |
| --- | --- | --- | --- | --- |
| Host odsłania wynik w dowolnej chwili, bez progu głosów; drugie odsłonięcie nic nie zmienia. | DB: „at any time and with no threshold” (`M2:721-722`); `if v_phase = 'voting' then perform private.finish_round` i zawsze `ok` (`M2:763-767`). UI: pytanie „Na pewno odsłonić? Zagłosowało …” (`RoundVoting.tsx:276-284`). | `reveal_round` | hard (app-SQL) | `ok: true` także dla rundy już odsłoniętej i **pominiętej** (`M2:763-767`; inference: odsłonięcie pominiętej rundy jest cichym no-op) |
| Wynik to liczba głosów dla każdego uprawnionego gracza (zera też), liczba wstrzymań i oddanych kart; urna znika w tej samej transakcji. | DB: `private.finish_round` (`M2:182-213`): wyniki dla `p.id = any (r.eligible)` (`M2:200-204`), `abstained`, `ballots` (`M2:206-208`), usunięcie urny (`M2:210-211`); `votes integer not null check (votes >= 0)` (`M2:133`). | `cast_vote`, `reveal_round` | hard (app-SQL); nieujemność: hard (data) | — |
| „Następne pytanie” tylko po odsłonięciu albo pominięciu najnowszej rundy, z numerem tej rundy z ekranu hosta. | DB: `next_round`: `'no_round'` (`M4:115-117`), `if p_round is null or p_round <> v_number then … 'round_over'` (`M4:119-122`), `'round_in_progress'` (`M4:124-126`). Worker wymaga numeru: `if (typeof round !== "number") … "invalid_body"` (`src/pages/api/rooms/[id]/next.ts:25-26`). UI: `afterRoundActions` (`src/components/room/HostActions.tsx:54-65`); blokada podwójnego kliknięcia `if (busy !== null) return` (`HostActions.tsx:112-113`). | `next_round` | hard (app-SQL) | named error |
| W grze żadne pytanie nie pada dwa razy; po wyczerpaniu puli gra trwa, aż host ją zakończy. | DB: `open_next_round` wybiera pierwszego kandydata o poprawnym formacie, którego nie było w pokoju (`M4:48-59`); `unique (room_id, question_id)` i `unique (room_id, number)` (`M2:124-125`); brak kandydata → `'no_questions'` (`M4:128-131`). Worker: `shuffledQuestions` z puli pokoju (`src/lib/rounds/draw.ts:51-73`); `hostQuestionsLeft` (`src/lib/rooms/server.ts:214-224`). UI: „Pytania z wybranych kategorii się skończyły.” zamiast „Następne pytanie” (`HostActions.tsx:61-63`). | `next_round`, `skip_round` | hard (data) | named error `no_questions` |
| „Pomiń pytanie” tylko w trakcie głosowania w najnowszej rundzie; głosy przepadają, runda zostaje jako `skipped` bez liczb, następne pytanie otwiera się w tej samej transakcji. | DB: `check (phase in ('voting', 'revealed', 'skipped'))` (`M4:28-29`); `skip_round`: `'round_over'` dla innego numeru (`M4:181-184`), `'round_revealed'` (`M4:186-189`), `'round_over'` dla nie-głosowania (`M4:191-193`), zapisy (`M4:195-199`). Worker wymaga numeru (`skip.ts:24-25`). UI: pytanie „Na pewno pominąć? Głosy przepadną …” (`RoundVoting.tsx:285-293`). | `skip_round` | hard (app-SQL); faza: hard (data) | named error; brak następnego pytania → mimo to `ok: true` (`M4:199-201`), runda pominięta zostaje ostatnią |
| W pokoju naraz głosuje się najwyżej w jednej rundzie. | DB: brak constraintu; pilnują funkcje: `next_round` odmawia przy `voting` (`M4:124-126`), `skip_round` ustawia `skipped` przed otwarciem następnej (`M4:197-199`), `start_game` tylko z lobby (`M2:568-570`). | `start_game`, `next_round`, `skip_round` | hard (app-SQL) (inference) | — |
| „Zakończ grę” tylko podczas gry w toku: zamyka pokój dla wszystkich i usuwa urnę rundy w toku; odsłonięte wyniki zostają. | DB: `end_game` (`M4:207-242`): lobby → `'no_round'` (`M4:233-235`), `set status = 'closed'` + `drop_round_state` (`M4:237-238`); `drop_round_state` (`M2:166-178`). UI: zawsze z pytaniem „Na pewno zakończyć grę? …” (`HostActions.tsx:28-40`). | `end_game` | hard (app-SQL) | named error. Pokoju w lobby nie da się zakończyć `end_game`; zamyka go tylko następne `create_room` (`M2:264-280`) |

### F. Anonimowość głosów i widoczność

| reguła | gdzie strzeżona | ścieżki objęte | ścisłość | obsługa porażki |
| --- | --- | --- | --- | --- |
| Nigdzie nie powstaje para „kto → na kogo”: urna liczy głosy per cel bez głosującego, lista głosujących nie ma celu. | DB: `ballot_boxes (round_id, tally jsonb, abstained)` bez głosującego (`M2:141-145`); `round_voters (round_id, player_id)` bez celu i bez FK do `players` (`M2:147-153`); brak kolumn czasu i sekwencji w tabelach rund (`M2:10`, `:111-153`; pgTAP `round_creator_view.test.sql:521-526`). | `cast_vote`, `finish_round` | hard (data) dla schematu (inference: nie ma kolumny, w której para mogłaby siedzieć) | — |
| Stan rundy w toku jest poza zasięgiem API, poza WAL i publikacją Realtime. | DB: `create unlogged table` (`M2:141`, `:149`); RLS bez polityk (`M2:155-158`); `revoke all … from public, anon, authenticated` (`M2:160-161`); `revoke usage on schema private …` (`M2:797`); pgTAP: tabele `private` poza `supabase_realtime` (`round_creator_view.test.sql:513-518`, `:550`); test REST `PGRST106` (`tests/db/round-anonymity.test.ts:63`). | wszystkie | hard (data: granty/RLS) | — |
| Stan rundy w toku znika przy odsłonięciu i przy każdym innym końcu rundy. | DB: `finish_round` (`M2:210-211`), `skip_round` (`M4:195-196`), `drop_round_state` wołane przez `create_room` (`M2:277-278`), `end_game` (`M4:238`), `close_stale_games` (`M3:33`). | wszystkie końce rundy, które znalazłem | hard (app-SQL) | — |
| Odpowiedź na głos to dokładnie `{ok: true}`; odmowa to dane `{ok: false, reason}`, nigdy wyjątek ze szczegółami wiersza. | DB: `return jsonb_build_object('ok', true)` (`M4:390`); zasada w nagłówku (`M2:11-12`, `M4:15`); `open_next_round` sprawdza powtórkę przed insertem, „so a repeat is never a 23505 with the row's values in DETAIL” (`M4:33-37`). Worker: odpowiedź `{ ok: true }` bez echa (`src/lib/rooms/json-route.ts:130-138`). Test: „cast_vote answers exactly { ok: true }” (`tests/db/round-anonymity.test.ts:118`). | `cast_vote` + akcje | hard (app-SQL) | wyjątki tylko dla złego tokenu (`M4:280`) |
| W trakcie głosowania widać, kto już zagłosował (w kolejności miejsc), nigdy jak i nigdy liczby; liczby dopiero po odsłonięciu; po pominięciu tylko numer i faza. | DB: `room_lobby` (`M4:461-501`), „Who has voted, in seat order: never the order of voting.” (`M4:462`), pominięta: `jsonb_build_object('number', v_number, 'phase', v_phase)` (`M4:481-483`). Klient: parser kopiuje tylko klucze kontraktu (`src/lib/rooms/shared.ts:119-121`), a pominiętą rundę z dodatkowym kluczem odrzuca (`shared.ts:126-129`). | `room_lobby` → `GET /api/rooms/<id>/lobby`, `/r/<id>` | hard (app-SQL); klient: obrona w głąb | stan odrzucony → `refreshFailed` + log pola (`src/components/room/useRoomState.ts:206-213`) |
| Pokój i jego graczy widzi tylko host (RLS) albo gracz z tokenem tego pokoju (funkcja); obcy i nieistniejący pokój dostają tę samą odpowiedź. | DB: polityki select (`M1:65-67`, `:78-83`), `grant select … to authenticated` (`M2:34`); `room_lobby` zwraca `null` (`M4:429-450`). Worker: 404 dla obu (`src/pages/api/rooms/[id]/lobby.ts:31-41`, `src/pages/r/[id].astro:31-40`); `OUTSIDE_ROOM` (`json-route.ts:18-20`). Test G3 (`tests/db/roles.test.ts:178-186`). | odczyty | hard (data: RLS) + hard (app-SQL) | 404 `not_found` |
| Kod linku widzi tylko host i tylko w lobby. | DB: odczyt przez RLS (`src/lib/rooms/server.ts:322-337`); `room_lobby` nie zwraca kodu (`M4:396-397`). Strona: `if (result.lobby.role === "host" && result.lobby.status === "lobby")` (`src/pages/r/[id].astro:42-47`). | `/r/<id>` | hard (data: RLS) dla „tylko host”; „tylko w lobby”: hard (app-Worker) | — |
| Kanał Realtime pokoju niczego nie decyduje: dzwonek mówi tylko „sprawdź”, stan bierze się z bazy, a seria dzwonków kosztuje ograniczoną liczbę zapytań. | Komentarz: „The room's channel is public, so anyone who knows the room's id can ring its bell” (`src/lib/live-sync/limiter.ts:4-6`); dzwonek → `limiter.bell()` (`useRoomState.ts:286-288`); limiter (`limiter.ts:9-16`, `:38-133`). Do przeglądarki idzie tylko klucz `sb_publishable_` (`src/lib/supabase.ts:25-32`). | klient | client-only (z założenia: kanał publiczny) | — |
| Pełna baza pytań (z 18+) zostaje na serwerze; ekran dostaje tylko tekst bieżącego pytania. | Worker: `draw.ts:3-5`; `roomView` dokłada tekst bieżącej rundy (`src/lib/rooms/server.ts:192-205`); strona przekazuje tylko `id` i `name` kategorii (`src/pages/index.astro:8-9`, `:16`). | `/`, `/r/<id>`, `GET …/lobby` | hard (app-Worker) | nieznane id → `question: null` + log (`server.ts:199-203`), logs and continues |
| Cel głosu nie trafia do URL, logu, odpowiedzi ani pamięci urządzenia. | Worker: zawsze POST, „rpc(…, { get: true }) would put the arguments … into the URL” (`server.ts:80-82`); logi tylko z listy pól (`src/lib/log.ts:13-27`, `:38-50`); `logFailure` bez argumentów (`server.ts:55-63`). Klient: `myVote` tylko w stanie komponentu (`RoundVoting.tsx:16-20`, `:95`); `room-actions.ts:7-9`. | `vote`, logi | hard (app-Worker) dla logów przez `logEvent`; patrz „Writers that work against a guard” | — |

### G. Pytania i kategorie

| reguła | gdzie strzeżona | ścieżki objęte | ścisłość | obsługa porażki |
| --- | --- | --- | --- | --- |
| Pokój ma co najmniej jedną kategorię, a 18+ tylko w wybranych kategoriach. | DB: `check (cardinality(categories) >= 1)`, `check (adult_categories <@ categories)` (`M1:26-27`); `create_room` dodatkowo odrzuca `null` w tablicy (`M2:254-258`). Worker: `picked.size === 0` → `invalid_categories` (`src/pages/api/rooms/index.ts:26-28`). UI: co najmniej jedna kategoria (`NewGameForm.tsx:57-59`), checkbox 18+ wyłączony, gdy kategoria wyłączona (`NewGameForm.tsx:166-172`). | `create_room` | hard (data) | named error `invalid_categories`; Worker po cichu odrzuca 18+ spoza wybranych (`index.ts:29-31`) |
| Kategorie muszą istnieć w bazie pytań. | Worker: `[...picked].some((id) => !CATEGORY_IDS.includes(id))` → `invalid_categories` (`index.ts:26-28`); losowanie pomija nieznane nazwy (`src/lib/rounds/draw.ts:7-9`, `:25-28`). Baza sprawdza tylko kształt (`draw.ts:7-8`, `server.ts:339-341`). | `POST /api/rooms` | **soft**: bezpośrednie RPC `create_room` z kluczem publishable i sesją hosta przyjmie dowolną nazwę | named error w Workerze; w losowaniu silently corrects (nieznane kategorie pominięte) |
| Pytania rundy pochodzą z wybranych kategorii, 18+ tylko tam, gdzie host je włączył. | Worker: `poolFrom` (`draw.ts:23-33`) dla `start` (`start.ts:29`), `next` (`next.ts:38`), `skip` (`skip.ts:37`). DB sprawdza tylko format id: `check (question_id ~ '^[a-z0-9-]+-[0-9]{3}$')` (`M2:117`), `M2:572-574`, `M4:50`. | `start_game`, `next_round`, `skip_round` | **soft**: host wołający RPC bezpośrednio może podać dowolne id o poprawnym formacie (inference; ominąć może tylko host własnego pokoju) | nieznane id: runda trwa, `question: null`, log `unknown_question` (`server.ts:196-205`), logs and continues |
| Pusta pula (np. same 18+ wyłączone) nie startuje gry. | Worker: `if (!questionId) return actionAnswer(OP, roomId, { ok: false, reason: "no_questions" })` (`start.ts:29-30`). | `POST …/start` | hard (app-Worker) (w bazie brak, `start_game` przyjmie każde id o dobrym formacie) | named error |

### H. Wejścia HTTP, logowanie, logi

| reguła | gdzie strzeżona | ścieżki objęte | ścisłość | obsługa porażki |
| --- | --- | --- | --- | --- |
| Akcje gry przyjmują tylko JSON z własnego originu, w limicie 4096 B. | Worker: `refuseForeignPost` (`src/lib/rooms/json-route.ts:26-41`), `MAX_BODY_LENGTH = 4096` i `readJsonRequest` (`json-route.ts:11-12`, `:71-103`), `UUID_PATTERN` (`src/lib/rooms/tokens.ts:8`), `MAX_ROUND` (`json-route.ts:14-16`). | `…/start`, `vote`, `reveal`, `next`, `skip`, `end`, `/api/client-events` | hard (app-Worker) | 415 / 403 / 400 z kodem, log `warn` |
| Formularze (`/api/rooms`, `/api/rooms/join`, `/api/auth/*`) są chronione przed cross-site POST przez `checkOrigin` Astro. | Komentarz: „Astro's checkOrigin stops a cross-site POST only for form content types” (`json-route.ts:26-27`); `astro.config.mjs:10-23` nie nadpisuje `security`. | formularze | inference (zależy od domyślnej wartości Astro 7, niezweryfikowanej w tej sesji) | — |
| GET linku niczego nie zmienia (podgląd Discorda). | „A GET changes nothing, because Discord fetches the link for its preview” (`src/pages/j/[token].astro:12-13`); dołączenie tylko przez POST (`src/pages/api/rooms/join.ts:9`). | `/j/<code>` | hard (app-Worker) | — |
| Logowanie hosta tylko przez włączonych dostawców; Google zawsze pyta o konto; zalogowany host nie wraca na ekrany logowania. | Worker: `PROVIDERS = ["discord", "google"]` (`src/pages/api/auth/oauth.ts:6-12`, `:21-23`), `prompt: "select_account"` (`oauth.ts:35-36`); `middleware.ts:16-26`; rejestracja hasłem usunięta: `signup.ts:3-5` (logowanie hasłem zostaje: `src/pages/api/auth/signin.ts:6-31`). Wylogowanie `scope: "local"` (`signout.ts:7-8`). Chronione trasy middleware: tylko `/dashboard` (`middleware.ts:5`, `:28-32`); trasy pokoju sprawdzają sesję same (sekcja A). | auth | hard (app-Worker); ustawienia projektu Supabase: unknown | named error code w URL (`src/lib/auth-errors.ts:6-41`) |
| Raporty z ekranu gracza przyjmowane tylko z zamkniętej listy zdarzeń, stanów i id pokoju. | Worker: `CLIENT_EVENTS`, `CLIENT_STATES`, `parseClientEvent` (`src/lib/client-events.ts:8-10`, `:29-46`). Klient: najwyżej 3 raporty na zdarzenie i tylko z widocznej karty (`useRoomState.ts:42-45`, `:68-72`). | `/api/client-events` | hard (app-Worker) dla treści; limit: client-only | 400 `invalid_event` + log pola |
| Linie logu Workera mają tylko pola z listy, wartości proste, max 200 znaków. | `LOG_FIELDS` i `allowedFields` (`src/lib/log.ts:13-27`, `:34-50`). | wszystkie wywołania `logEvent` | soft: 5 miejsc loguje przez `console.error` z pominięciem listy (sekcja niżej) | — |

## Soft and client-only rules

- **Głos tylko w widzianym pytaniu** (soft). Ominięcie: `POST /api/rooms/<id>/vote` z `{"target": "<nick>"}` bez `round`
  → `bodyRound` zwraca `null` (`src/lib/rooms/json-route.ts:113`), `castVote` nie wysyła `p_round`
  (`src/lib/rooms/server.ts:253`), `cast_vote` z `p_round default null` (`M4:259`) pomija kontrolę (`M4:329`). Komentarz
  podaje powód: zgodność z ekranem sprzed S-03 (`M4:252-253`; `src/pages/api/rooms/[id]/vote.ts:21-23`). Test potwierdza,
  że to działa: „a vote with no question number in round 2 gets ok: true” (`tests/db/game-rules.test.ts:154`).
  Pozostałe odmowy (`round_revealed`, runda `skipped` → `round_over`) obowiązują dalej (`M4:333-340`, test
  `tests/db/game-rules.test.ts:272`).
- **Kategorie z bazy pytań** (soft). Ominięcie: RPC `create_room` z sesją hosta i nazwą spoza `CATEGORIES`; baza
  sprawdza tylko kształt (`M1:26-27`, `M2:254-258`); kod przyznaje to wprost: „a host can store any name over RPC”
  (`src/lib/rounds/draw.ts:7-8`).
- **Pytania z wybranych kategorii i 18+ tylko tam, gdzie włączone** (soft). Ominięcie (inference): host z własną sesją
  woła `start_game` / `next_round` / `skip_round` bezpośrednio z dowolnym id pasującym do `'^[a-z0-9-]+-[0-9]{3}$'`
  (`M2:572-574`, `M4:50`). Sesja żyje w ciasteczkach httpOnly (`src/lib/supabase.ts:10-11`), więc wymaga to ręcznego
  wyjęcia tokenu. Ominąć może tylko host własnego pokoju; gość nie ma grantu do tych funkcji (`M2:803`, `M4:539-540`).
- **Ponowne wejście zamiast drugiego gracza** (soft, inference): w bazie gracza z przeglądarką łączy tylko token
  (`M2:376-377`); bez ciasteczka gość może dołączyć jeszcze raz pod innym nickiem w lobby.
- **Client-only z założenia** (stan żyje w kliencie): pamięć własnego głosu (`RoundVoting.tsx:16-20`), widok
  „Koło/Paski” (`RoundReveal.tsx:20-22`), flaga przeładowania w `sessionStorage` (`useRoomState.ts:49-51`, `:96-114`),
  limiter zapytań przy publicznym kanale (`src/lib/live-sync/limiter.ts:1-16`), limit raportów (`useRoomState.ts:42-45`).
- **UI powtarza regułę bazy, baza ma ostatnie słowo** (nie jest to luka, za to są to duplikaty stałych, które mogą się
  rozjechać): `MIN_PLAYERS = 3` (`src/lib/rooms/shared.ts:6`) i literał `< 3` (`M2:580`); `NICK_MAX_LENGTH = 20`
  (`shared.ts:4`) i `between 1 and 20` (`M1:37`, `M2:250`, `:357`); wzorzec kodu linku (`tokens.ts:6`, `M1:23`,
  `M2:326`); wzorzec tokenu gracza (`tokens.ts:11`, `M4:279`); wzorzec id pytania (`server.ts:190`, `M2:117`, `M4:50`).
  `nickLength` stosuje tylko część reguły nicku: „the part of the nick rule a browser can apply” (`shared.ts:203-207`).

## Writers that work against a guard

- **Lista pól logu omijana**: `src/lib/log.ts:1-12` mówi „The Worker's only way to write a log line” i
  „errName: an error's name, never its message”. Mimo to:
  - `src/lib/live-sync/server.ts:22-27` loguje `code: error instanceof Error ? error.message : undefined` (komunikat
    błędu Realtime jako `code`; komentarz `:19-21` uzasadnia, że nie ma w nim klucza ani danych żądania);
  - `console.error` z ręcznie dobranymi polami, z pominięciem `allowedFields`: `src/lib/auth-user.ts:16`,
    `src/pages/api/auth/callback.ts:28`, `:47`, `src/pages/api/auth/oauth.ts:42`, `src/pages/api/auth/signin.ts:26`.
    Każdy loguje tylko name/status/code albo zsanityzowane kody (`callback.ts:11-16`), więc (inference) to niespójność
    kanału, a nie wyciek.
- **Martwy parametr**: Worker dalej generuje i wysyła kod linku (`src/pages/api/rooms/index.ts:40`,
  `src/lib/rooms/server.ts:117`), a `create_room` go ignoruje (`M2:217-219`; „a later migration drops the parameter”,
  `M2:18-20`). Nie działa przeciw strażnikowi; to pozostałość, która może kogoś zmylić (inference).
- **Właściciel `postgres`** omija granty i RLS z definicji. pgTAP robi to celowo (np. `update public.rooms set started_at …`,
  `supabase/tests/round_creator_view.test.sql:714-719`). Reguły „hard (app-SQL)” nie mają po stronie danych żadnego
  zabezpieczenia przed takim zapisem (inference).
- Nie znalazłem w kodzie produktu resetów ani tylnych drzwi do tabel pokoju (grep `.insert(`, `.update(`, `.delete(`,
  `.upsert(` w `src/` dał 0 trafień poza `Map.delete` w `HostActions.tsx:147`).

## Failure handling

- **Named errors (większość)**: każda funkcja gry zwraca `{ok: false, reason}`. Lista kodów rund: `ROUND_REFUSALS`
  (`src/lib/rooms/errors.ts:7-18`), teksty (`errors.ts:22-43`), nieznany kod → tekst ogólny (`errors.ts:45-50`).
  Mapowanie na HTTP: `room_unknown` 404, `invalid_body` 400, `service_unavailable` 503, `unexpected` 500, reszta 409
  (`json-route.ts:118-124`). Formularze: kod w `?error=` (`index.ts:46`, `join.ts:17`).
- **Generic error**: zły token gracza → `raise exception … errcode = '22023'` (`M2:323`, `M4:280`); inne naruszenie
  unikalności w `join_room` → `raise` (`M2:373`); błąd RPC/sieci → `logFailure` → `service_unavailable` / `unexpected`
  (`src/lib/rooms/server.ts:55-98`).
- **Logs and continues** (ustalenia):
  - dzwonek po akcji: porażka tylko logowana, bo gracze odpytują co 15 s (`server.ts:365-381`, `live-sync/server.ts:18-28`);
  - nieznane id pytania: runda trwa z `question: null` (`server.ts:196-205`);
  - błąd Auth w `readUser`: host widzi stronę jak gość, z logiem (`src/lib/auth-user.ts:8-19`);
  - strona główna: gdy odczyt otwartego pokoju zawiedzie, formularz i tak się pokazuje bez pytania o zamknięcie
    (`src/pages/index.astro:18-32`), a pytanie wymusza potem `create_room` (`M2:270-274`); przy `!supabase` (`:23`)
    bez logu;
  - `hostQuestionsLeft` → `null` przy porażce (`server.ts:221-222`); ekrany rozchodzą się celowo
    (`server.ts:209-213`, `RoundReveal.tsx:232-233`, `RoundSkipped.tsx:40`).
- **Swallowed silently**: kopiowanie linku bez schowka zaznacza pole bez logu (`RoomLobby.tsx:56-67`), czysto UI.
  Ciasteczko gracza w złym formacie liczone jak brak (`vote.ts:39-41`), co kończy się 404 `not_found`.
- **Silently corrects** (ustalenia):
  - Worker odrzuca 18+ spoza wybranych kategorii „without a word” (`src/pages/api/rooms/index.ts:29-31`);
  - losowanie pomija nieznane nazwy kategorii (`draw.ts:26-28`);
  - formularz, który nie jest formularzem, traktowany jak puste pola (`index.ts:20-21`, `join.ts:10-11`), co i tak kończy
    się nazwanym błędem;
  - po awarii bazy pusta urna zakładana jest na nowo przy pierwszym głosie, a głosy sprzed awarii przepadają bez
    sygnału (`M4:365-367`; pgTAP `round_creator_view.test.sql:685-705`); przy okazji znika ochrona „jeden głos”
    (sekcja D).
- **`reveal_round` na rundzie pominiętej** odpowiada `ok: true` i nic nie robi (`M2:763-767`) (inference: cichy no-op;
  UI nie pokazuje wtedy przycisku, `RoundSkipped.tsx:38-43`).

## Atomicity

Każda funkcja SQL wywołana przez RPC to jedna transakcja (inference: zwykłe zachowanie PostgREST/Postgres dla
pojedynczego wywołania; w kodzie nie ma `commit` w funkcjach). W każdej funkcji rundy najpierw blokowany jest wiersz
pokoju `for update` (`M2:14-16` i np. `M4:93-96`, `:155-158`, `:219-222`, `:285-288`).

| operacja | zapisy | wspólna transakcja? | cytat |
| --- | --- | --- | --- |
| „Nowa gra” | zamknięcie starego pokoju, usunięcie stanu jego rundy, nowy pokój, host jako gracz 1 | tak; wewnętrzny blok z `exception` cofa także zamknięcie starego pokoju | `M2:260-298` („One block, so a unique_violation below also undoes closing the old room…”) |
| Dołączenie | gracz + hash tokenu | tak (jedna funkcja) | `M2:361-377` |
| Dołączenie, cały przepływ | `join_room` (commit), potem ciasteczko w odpowiedzi | **nie**: jeśli odpowiedź się zgubi, gracz istnieje bez ciasteczka i jego nick jest zajęty (inference); komunikat `nick_taken` to przewiduje | `src/pages/api/rooms/join.ts:44-53`, `src/lib/rooms/errors.ts:24-25` |
| Start gry | runda 1, urna, status `playing` + `started_at` | tak | `M2:584-590` |
| Głos | wiersz głosującego, urna, ewentualnie odsłonięcie (wyniki, faza, usunięcie urny) | tak | `M4:363-388`, `M2:182-213` |
| Następne pytanie | nowa runda + urna | tak | `M4:129`, `:65-69` |
| Pominięcie | usunięcie urny, faza `skipped`, następna runda | tak | `M4:195-199` |
| Koniec gry / sprzątanie | status `closed` + usunięcie urny | tak (sprzątanie: jedna transakcja na całe uruchomienie pętli) | `M4:237-238`, `M3:26-34` |
| Akcja Workera + dzwonek | commit w bazie, potem dzwonek Realtime | nie, z założenia: dzwonek tylko podpowiada, a polling go nadrabia | `server.ts:365-381` |
| Start/następne/pominięcie w Workerze | odczyt kategorii przez RLS, potem RPC | dwa wywołania (inference: bez wyścigu, bo kategorii nie zmienia żadna funkcja i nie ma grantu `update`, `M2:33-34`) | `start.ts:25-32`, `next.ts:34-38` |

## Scheduled and asynchronous work

| reguła zależna od czasu | wyzwalacz | handler | dochodzi? |
| --- | --- | --- | --- |
| Gra rozpoczęta ponad 12 h temu zostaje zamknięta, a stan jej rundy usunięty. | `select cron.schedule('close-stale-games', '0 * * * *', 'select private.close_stale_games()')` (`M3:42`), rozszerzenie `pg_cron` (`M3:12`) | `private.close_stale_games` (`M3:17-36`): `status = 'playing' and r.started_at < now() - interval '12 hours'`, `for update skip locked` | tak w kodzie: pgTAP sprawdza wiersz `cron.job` (`supabase/tests/round_creator_view.test.sql:780-784`) i sam efekt (`:708-778`). Czy job działa w produkcji: unknown |
| Pokój zablokowany przez trwający głos jest pomijany i zamykany godzinę później. | jw. | `for update skip locked` (`M3:30`), komentarz `M3:14-16` | tak (inference ze składni) |
| Pokój w **lobby** nie wygasa nigdy. | brak | sprzątanie dotyczy tylko `playing` (`M3:29`); pgTAP: „the sweep leaves alone a lobby created 13 hours ago” (`round_creator_view.test.sql:774-778`) | ustalenie: link do starego lobby działa, dopóki host nie założy nowej gry (`M2:264-280`) albo nie skończy (`end_game` w lobby odmawia, `M4:233-235`) |
| Ciasteczko gościa wygasa po 24 h. | `maxAge` w przeglądarce (`src/lib/rooms/tokens.ts:13`, `:35-45`) | — | hash tokenu w `player_secrets` nie ma terminu ani sprzątania (`M1:49-52`; grep `delete from` nie znalazł usuwania) (inference: token odtworzony ręcznie działa dalej) |
| Retencja pokoi, graczy, rund i wyników | brak harmonogramu | jedyne usuwanie: urny (`M2:171-177`, `:210-211`, `M4:195-196`) i kaskady od `auth.users` (`M1:21`, `:39`) | ustalenie (inference): zamknięte pokoje, nicki, `round_results` (liczby per gracz) i hashe tokenów zostają bezterminowo |
| Odpytywanie stanu co 15 s (co 5 s przy zerwanym kanale), dzwonek z limitem 5 s | timery w przeglądarce (`src/lib/live-sync/shared.ts:5-8`, `useRoomState.ts:40-41`, `:236-245`); `RING_TIMEOUT_MS` (`live-sync/server.ts:9-10`) | `fetchState` → `GET /api/rooms/<id>/lobby` | tak; zamknięty pokój przestaje słuchać (`useRoomState.ts:140`, `:145`) |
| Crony po stronie Workera | grep `cron|trigger|queue|scheduled|durable` w `wrangler.jsonc` i handlerów `scheduled` w `src/`: 0 trafień | — | brak triggera i brak handlera; spójne |

## Unknowns

- **Ustawienia produkcyjnego projektu Supabase**: w repo jest tylko lokalny `supabase/config.toml` (`enable_signup = true`
  `:173`, `[auth.email] enable_signup = true` `:208`, `enable_confirmations = false` `:215`, limity Auth `:184-198`,
  `auto_expose_new_tables = false` `:22`). Wartości produkcyjne nieznane.
- **Autoryzacja kanału Realtime**: kod zakłada kanał publiczny (`limiter.ts:4-5`); czy projekt wymusza kanały prywatne,
  nie da się ustalić z kodu.
- **Domyślne `checkOrigin` w Astro 7** dla tras formularzy: oparte na komentarzu (`json-route.ts:26-27`), niezweryfikowane.
- **Anonimowość przy odsłonięciu z jedną kartą** (inference): odsłonięcie jest dozwolone „with no threshold”
  (`M2:721`), a lista `voted` jest publiczna w trakcie rundy (`M4:467-472`). Po odsłonięciu przy jednym głosie
  liczby pokazują, na kogo zagłosowała jedyna osoba z listy (test pokazuje taki wynik: „the reveal shows the counts at
  once: Ola 1, the rest 0, 1 ballot”, `tests/db/round-rules.test.ts:280`). Ekran ostrzega tylko liczbą głosów
  (`RoundVoting.tsx:281`). Kod tego nie blokuje; czy to świadoma decyzja, kod nie mówi (patrz dokumenty).
- **Obserwator bazy na żywo** (inference): głosy w pokoju idą po kolei pod blokadą pokoju (`M4:283-288`), a wiersz
  głosującego i licznik celu zmieniają się w tej samej transakcji (`M4:363-379`). Właściciel bazy, który czyta
  `private.round_voters` i `private.ballot_boxes` między głosami, może połączyć jedno z drugim. Role API tego nie mogą
  (sekcja F).
- **Zachowanie przy usunięciu konta hosta** (kaskada `on delete cascade`, `M1:21`, `:39`): nie badałem.
- Testów `tests/unit/**` i `tests/e2e/**` nie czytałem szczegółowo; w `tests/` i `supabase/tests/` nie ma aktywnych
  `test.fails` („znana dziura”) (grep: tylko historyczne odniesienia w `tests/db/nicks.test.ts:12-22`,
  `tests/db/roles.test.ts:21`, `:207`).

## Commands run

- `git ls-files` z filtrem wykluczeń; `wc -l` po plikach kodu
- `cat -n` / Read: 4 migracje, `src/lib/rooms/*.ts`, `src/lib/rounds/draw.ts`, `src/lib/*.ts`, `src/middleware.ts`,
  `src/pages/api/**`, `src/pages/{j,r}/*.astro`, `src/pages/index.astro`, `src/pages/auth/*`,
  `src/components/room/*.tsx|ts|astro`, `src/lib/live-sync/{server,limiter,shared}.ts`, `astro.config.mjs`,
  fragmenty `supabase/tests/round_creator_view.test.sql` (`:672-789`)
- `grep -v` komentarzy w `supabase/config.toml`
- grep: `test.fails|znana dziura`, tytuły testów w `tests/db/*.test.ts`, asercje pgTAP, `close_stale|cron.`,
  `publication`, `delete from|on delete|drop_round_state`, `.insert(|.update(|.delete(|.upsert(`, `set status`,
  `console.*`, `rate.limit|MAX_PLAYERS|limit [0-9]`, `cron|trigger|queue|scheduled|durable` w `wrangler.jsonc`, importy
  `live-sync` w kodzie produktu
