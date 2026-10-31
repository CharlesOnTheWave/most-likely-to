---
date: 2026-10-27T10:48:08+0100
researcher: Claude (Opus 5.5) z Karolem
git_commit: 9e4a209
branch: co-host-role
repository: most-likely-to
topic: "S-07 współhost: kto dziś może wykonać ruch prowadzącego i co trzeba zmienić, żeby mógł go wykonać gość z rolą współhosta"
tags: [research, co-host, rooms, room_lobby, host-actions, join-requests, rpc-grants]
status: complete
last_updated: 2026-10-27
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Decyzje Karola 1–6 i projekt techniczny do planu (sekcja na końcu)"
---

# Research: S-07 współhost

**Date**: 2026-10-27T10:48:08+0100
**Researcher**: Claude (Opus 5.5) z Karolem
**Git Commit**: 9e4a209 (main po PR #28; PR #29 z poprawkami przeglądów jeszcze niescalony)
**Branch**: co-host-role
**Repository**: most-likely-to

## Research Question

Host (zalogowany) nadaje i odbiera rolę współhosta graczowi w pokoju (`context/foundation/roadmap.md`, S-07; PRD
FR-003, FR-006, FR-009, FR-020). Jak baza, Worker i ekrany pokoju decydują dziś, kto może wykonać ruch prowadzącego, co
musi się zmienić, żeby wykonał go gość z rolą współhosta, i co dokumenty już o współhoście rozstrzygnęły.

## Summary

- **Dziś żaden ruch prowadzącego nie przyjmuje gościa.** Każda funkcja ruchu blokuje wiersz pokoju i odrzuca każdego,
  kto nie jest `rooms.host_id` (`v_user <> v_host → room_unknown`, np.
  `supabase/migrations/20261026074427_question_play_data.sql:286-294`), a wykonać ją może tylko rola `authenticated`
  (`:630-632`; `end_game` w `20261015122252_full_game_evening.sql:541`, `reveal_round` w `*_round_number_required.sql:313`,
  `admit/reject_latecomer` w `20261022132240_latecomer_admission.sql:538-539`). Gość nie ma konta, więc współhost musi
  wołać te funkcje jako `anon` z tokenem gracza.
- **Trasy Workera dla tych ruchów czytają tylko sesję** (`start.ts:19`, `reveal.ts:26`, `next.ts:30`, `skip.ts:27`,
  `end.ts:19`, `admit.ts:26`, `reject.ts:25` w `src/pages/api/rooms/[id]/`). Wzór „sesja albo ciasteczko gracza, rolę
  rozstrzyga baza” już istnieje w `vote.ts:39-47`, `react.ts:39-47`, `emote.ts:30-42`.
- **Druga bramka w Workerze:** start, następne i pominięcie najpierw czytają kategorie pokoju przez RLS
  (`hostRoomCategories`, `src/lib/rooms/server.ts:512-532`), a liczba pozostałych pytań (`hostQuestionsLeft`,
  `server.ts:295-303`) zwraca `null` dla roli innej niż `host`. Gość nie widzi wiersza `rooms`, więc bez innej drogi do
  kategorii współhost nie wylosuje kolejnego pytania.
- **Stan ekranu (`room_lobby`) zna tylko role `host` i `guest`**, a parser Workera odrzuca każdą inną wartość
  (`src/lib/rooms/shared.ts:302`). Nowa wartość roli zepsułaby wdrożonego Workera między `db push` a wdrożeniem kodu;
  dodatkowy klucz przechodzi. Prośby spóźnionych (`requests`) i lista pytań (`question_list`) idą dziś tylko do hosta.
- **Ekrany:** kontrolki prowadzącego (pasek `HostActions`, „Zacznij grę”, `JoinRequests`, przyciski pominiętego
  pytania) pokazują się dla `view.role === "host"`; zmiana roli dotrze bez przeładowania przez dzwonek i odświeżenie
  (`useRoomState.ts:296-298`, `:222-238`).
- **Gdy host wychodzi, gra dziś staje:** brak wykrywania obecności; host jest na liście uprawnionych do głosu, więc
  runda czeka na jego głos albo na „Odsłoń wynik”, a po odsłonie nikt nie ma przycisków (`RoundReveal.tsx:199`).
- **Dokumenty rozstrzygają uprawnienia** (PRD „Access Control”, `context/foundation/prd.md:157-174`): współhost
  startuje, odsłania, przechodzi dalej, pomija, kończy grę i wpuszcza spóźnionych; nie widzi listy pytań gry, nie tworzy
  pokoju, nie nadaje roli. Otwarte dla Karola: ilu współhostów, czy współhost widzi link, kogo można zrobić współhostem,
  słowa na ekranie, jak wygląda nadawanie roli.

## Detailed Findings

### Baza: tożsamość i uprawnienia

- **Rola pochodzi wyłącznie z `rooms.host_id`.** `players` ma klucz `id uuid`, kolumny `room_id`, `nick`, `user_id`
  (ustawione tylko u hosta), `seat`; unikalne `(room_id, nick_key)`, `(room_id, user_id)`, `(room_id, seat)`
  (`20261007…_room_lobby.sql:34`, `20261014101922_first_live_round.sql:103-107`). Gość ma wiersz w `player_secrets`
  (`token_hash bytea`, bez grantów i polityk, `room_lobby.sql:49`).
- **Funkcje ruchu prowadzącego, które według PRD musi móc wywołać współhost** (najnowsze definicje):
  - `start_game(uuid, text)` — `question_play_data.sql:269`, kontrola `:292`, grant `:630`;
  - `reveal_round(uuid, integer default null)` — `*_round_number_required.sql:238`, `:259`, `:313`;
  - `next_round(uuid, integer, text[])` — `question_play_data.sql:357`, `:377`, `:631`;
  - `skip_round(uuid, integer, text[])` — `question_play_data.sql:423`, `:444`, `:632`;
  - `end_game(uuid)` — `full_game_evening.sql:207`, `:225`, `:541`;
  - `admit_latecomer(uuid, text)` i `reject_latecomer(uuid, text)` — `latecomer_admission.sql:265/333`, `:288/352`,
    `:538-539`.
- **Zostają tylko dla hosta:** `create_room` (`first_live_round.sql:220`, `:799`) i pięć funkcji listy pytań S-06
  (`*_question_list_review.sql:104-360`, granty `:748-752`).
- **Wzór sprawdzenia gościa do powtórzenia** (`cast_vote`, `*_round_number_required.sql:110-135`; `react_round`,
  `question_play_data.sql:530-560`): token spoza `^[A-Za-z0-9_-]{43}$` → 22023; najpierw gałąź hosta po `auth.uid()`;
  inaczej gracz przez `player_secrets.token_hash = sha256(token)` w tym pokoju; brak gracza → `room_unknown`.
- **Zmiana sygnatury:** dodanie `p_player_token text default null` wymaga `drop function` + `create function` w tej
  samej migracji (tak robiły `full_game_evening.sql:248` i `round_number_required.sql:231`); `create or replace` z
  nową listą argumentów zostawiłby drugą wersję, a pgTAP sprawdza dokładnie jedną. Domyślny `null` zachowuje wywołania
  starego Workera, więc migracja może wejść przed kodem (kolejność „najpierw baza”, `context/deployment/deploy-plan.md`).
- **Grant dla `anon`** robi z tych funkcji publiczne punkty wejścia: wszystkie kontrole muszą zostać w środku (AGENTS.md,
  konwencje migracji). Flagę współhosta czytać bez blokowania wiersza gracza; zasada „najpierw wiersz pokoju”
  (`first_live_round.sql:14-16`).
- **Miejsce flagi** (do decyzji w planie): kolumna `players.cohost boolean default false` (host już czyta `players`
  przez RLS, `room_lobby.sql:78`; znika razem z graczem i pokojem; pozwala na kilku współhostów) albo
  `rooms.cohost_player_id` (dokładnie jeden) albo osobna tabela bez grantów jak `join_requests`.
- **Sprzątanie i anonimowość:** flaga to rola, nie stan rundy; zamknięty pokój odrzuca każdy ruch, więc nie wymaga
  sprzątania w `drop_round_state` (`question_play_data.sql:243`). Flaga nie dotyka głosów. Odsłona i następne pytanie
  wykonane przez współhosta biegną w jego transakcji tak samo jak dziś hosta; komentarz „the host's move”
  (`question_play_data.sql:25-27`) i zdanie o kciukach w AGENTS.md (PR #29) trzeba uogólnić na prowadzącego.

### Worker: trasy i dane dla współhosta

- **Trasy tylko z sesją** (ciasteczka nie czytają): `start.ts:19`, `reveal.ts:26`, `next.ts:30`, `skip.ts:27`,
  `end.ts:19`, `admit.ts:26`, `reject.ts:25`, a także `question-*.ts` (te zostają). Trasa nadania/odebrania roli: tylko
  sesja i `bodyNick` jak `admit.ts`, z dzwonkiem `ringLobby` (`server.ts:543-556`).
- **Kategorie i pozostałe pytania:** `hostRoomCategories` czyta `rooms` przez RLS (`server.ts:512-532`); wywołują ją
  `start.ts:25-27`, `next.ts:36-38`, `skip.ts:33-35` i `hostQuestionsLeft` (`server.ts:295-303`, tylko gdy
  `role === "host"`). Dla współhosta te dane musi dać baza, np. `room_lobby` z kluczem, który Worker odcina przed
  wysłaniem do przeglądarki (jak dziś `question_list`/`game_totals`, `server.ts:275`). Lekcja „Pytania gry tylko po
  stronie serwera” (`context/foundation/lessons.md:12-17`) obowiązuje: kandydaci `p_candidates` liczą się w Workerze.
- **Odmowa dla odebranej roli:** dziś byłoby to `404 not_found` → ogólne „Coś poszło nie tak” (`errors.ts:77-80`);
  osobny kod 409 wymaga wpisu w `ROUND_REFUSALS`/`MESSAGES` (`errors.ts:10-29`) i w `tests/unit/room-errors.test.ts`.

### room_lobby i widok ekranu

- `room_lobby` zwraca `role` `'host'|'guest'` (`20261025122918_game_summary.sql:83-98`), `me`, `players: [{nick, host}]`
  w kolejności miejsc (`:229-235`), `requests` tylko hostowi (`:103-107`), `question_list` tylko hostowi (`:110`),
  `game_totals` wszystkim. Parser: `shared.ts:179-189` (gracze: tylko `nick` i `host`), `:302` (rola).
- Testy bazy przypinają dokładne zbiory kluczy `LOBBY_KEYS` i `PLAYER_KEYS` (`tests/db/support/rounds.ts:124-125`),
  używane w `round-anonymity`, `game-summary`, `reactions`; nowy klucz zmienia te zbiory.
- Bezpieczna droga na okno wdrożenia: zostawić `role` bez nowej wartości i dodać klucz (np. `cohost` u gracza i/lub
  na górze widoku); `requests` dawać także współhostowi (FR-020).

### Ekrany pokoju

| Miejsce                                                                                                                                                               | Współhost?                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `RoomLobby.tsx:150-178` „Zacznij grę”                                                                                                                                 | tak                                                                                                        |
| `RoomLobby.tsx:121-148` link dla graczy (z RLS, `[id].astro:45`)                                                                                                      | otwarte pytanie                                                                                            |
| `RoomLobby.tsx:180-189` lista pytań gry                                                                                                                               | nie (S-06, tylko host)                                                                                     |
| `RoomLobby.tsx:114-117` tytuł i „Czekamy, aż host zacznie.”                                                                                                           | własny tekst                                                                                               |
| `RoomLobby.tsx:218`, `RoundVoting.tsx:62-75` znaczki `host`/`ty`                                                                                                      | „ty” liczyć od prawdziwego hosta                                                                           |
| `RoundVoting.tsx:104`, `:206-208`, `:329-360` pasek i podpowiedź prowadzącego                                                                                         | tak                                                                                                        |
| `room-frame.ts:36` szeroka kolumna głosowania prowadzącego                                                                                                            | tak                                                                                                        |
| `RoundReveal.tsx:96`, `:199-207` pasek po odsłonie                                                                                                                    | tak                                                                                                        |
| `RoundSkipped.tsx:31`, `:38-43`                                                                                                                                       | tak (z `questionsLeft: null` tylko „Zakończ grę”)                                                          |
| `RoomScreen.tsx:295-298` `JoinRequests`                                                                                                                               | tak (baza musi wysłać `requests`)                                                                          |
| `RoomScreen.tsx:94-101` „Nowa gra”                                                                                                                                    | nie                                                                                                        |
| teksty „Host pominął…” (`announce.ts:20,24`, `RoomScreen.tsx:303`), „Host wpuścił cię” (`RoundVoting.tsx:219`), „Czekasz, aż host cię wpuści” (`JoinWaiting.tsx:224`) | słowa do decyzji; e2e szukają ich dosłownie (`tests/e2e/support/round.ts:109-111`, `latecomer.spec.ts:24`) |

- **Listy „Gracze”:** w poczekalni `RoomLobby.tsx:193-224` (wiersz `li` `:206`, kropka `:210-213`, znaczki `:216-219`);
  w głosowaniu `RoundVoting.tsx:164-199`, ale ta sekcja pokazuje się dopiero po własnym głosie albo spóźnionemu
  (`:212-237`), wcześniej jest tylko lista wyboru z wierszami-etykietami radia (`:243-274`), gdzie przycisk nie pasuje.
  Odsłona, pominięte i koniec nie mają listy graczy. e2e znajduje region `/^Gracze/` i wiersz po nicku
  (`tests/e2e/support/room.ts:79-84`). W `src/components/ui` nie ma menu rozwijanego.
- **Fokus po ruchu** zależy od akcji, nie roli (`RoomScreen.tsx:111`, `:186-197`), więc współhost dostaje go bez
  zmian; `HostActions` nie ma logiki ról. Zmiana roli nie zmienia `announcementKey` (`announce.ts:9-11`), więc
  ogłoszenie „jesteś współhostem” wymaga osobnego tekstu w regionie na żywo.

### Gdy host wychodzi

- Brak obecności/heartbeatu w `src` (grep „presence”, „online”, „heartbeat” bez trafień). Kanał niesie tylko dzwonek i
  emotki.
- Głosowanie: host jest wśród uprawnionych, a runda odsłania się sama dopiero po głosie każdego z nich
  (`*_round_number_required.sql:219-220`), więc bez hosta czeka na „Odsłoń wynik” prowadzącego; po odsłonie nikt nie ma
  przycisków; spóźnieni czekają; poczekalnia stoi. Sprzątanie co godzinę zamyka tylko gry `playing` starsze niż 12 h
  (`20261014…_close_stale_games.sql:29,42`).
- „Nowa gra” hosta zamyka jego otwarty pokój (`first_live_round.sql:262-283`), także wieczór prowadzony przez
  współhosta.

### Podgląd i testy

- `/dev/room-states` (budowniczowie biorą `"host"|"guest"`, `room-states.astro:158-262`; `withRequests` `:290`) i
  `/dev/room-window` (`AppHeader signedIn` na sztywno `:368`): nowe stany współhosta (poczekalnia, głosowanie przed i po
  głosie, odsłona, pominięte, z prośbami) i stan hosta z kontrolką roli.
- e2e: `openRoom`, `newGuestContext`, `joinRoom` (`tests/e2e/support/room.ts:30-76`); pomocniki ruchów biorą stronę
  (`support/round.ts:20,84,91,99`), więc działają ze stroną współhosta.
- Baza: pgTAP `supabase/tests/round_creator_view.test.sql` przypina grant `authenticated` dla start/next/skip/end/
  reveal/admit/reject (`:871-896`, `:967-972`) i dokładne sygnatury (`:903-925`, `:979-998`, `:1032-1062`), `plan(264)`;
  `tests/db/round-rules.test.ts:231-243` i `latecomers.test.ts:396-402` oczekują dziś `42501` dla `anon`;
  `tests/unit/room-rpc-gate.test.ts` przypina sygnatury (`:33-120`, `:349`). Rejestracje kont testowych: 15 z 30 na
  przebieg (`context/foundation/test-plan.md:188`); współhost to gość, więc nie zużywa kont.
- Smoke: per-gracz `act()` (`scripts/smoke.mjs:266-270`), kroki rundy `:319-372`; krok „host nadaje rolę Oli” i jeden
  ruch Oli jako współhosta mieszczą się tam.

## Code References

- `supabase/migrations/20261026074427_question_play_data.sql:269-294,357-377,423-444,630-632` — start/next/skip i granty
- `supabase/migrations/20261015122252_full_game_evening.sql:207-225,541` — `end_game`
- `supabase/migrations/20261022132240_latecomer_admission.sql:265-352,538-539` — wpuszczanie i odrzucanie spóźnionych
- `supabase/migrations/20261025122918_game_summary.sql:46-235` — `room_lobby` (rola, gracze, prośby, lista pytań)
- `src/lib/rooms/server.ts:275,295-303,512-532,543-556` — odcinanie kluczy, pozostałe pytania, kategorie, dzwonek
- `src/lib/rooms/shared.ts:14-17,100,179-189,302` — `LobbyPlayer`, `role`, parser
- `src/pages/api/rooms/[id]/{start,reveal,next,skip,end,admit,reject}.ts` — trasy tylko z sesją
- `src/pages/api/rooms/[id]/{vote,react,emote}.ts` — wzór „sesja albo token”
- `src/components/room/{RoomLobby,RoundVoting,RoundReveal,RoundSkipped,RoomScreen,JoinRequests,HostActions}.tsx`
- `tests/db/support/rounds.ts:124-125,179-289`, `supabase/tests/round_creator_view.test.sql`, `tests/unit/room-rpc-gate.test.ts`

## Architecture Insights

- Rolę rozstrzyga baza, nie Worker: trasa przekazuje sesję i/lub token, funkcja `security definer` decyduje. Współhost
  wpasowuje się w ten wzór przez opcjonalny token w funkcjach ruchu i grant dla `anon`.
- Dane, których gość nie widzi (kategorie, lista pytań), Worker bierze dziś przez RLS hosta albo z `room_lobby` i odcina
  przed przeglądarką. Współhost potrzebuje kategorii i liczby pozostałych pytań tą drugą drogą.
- Okno wdrożenia (baza przed kodem) wymusza zmiany addytywne: domyślne argumenty, nowe klucze zamiast nowych wartości.

## Historical Context (from prior changes)

- `context/archive/2026-10-22-latecomer-admission/plan.md:39,96,309` i `plan-brief.md:8,22,39` — S-08 zrobione tylko z
  hostem; „S-07 dopisze współhosta do wpuszczania spóźnionych” (`roadmap.md:202`). Follow-upy S-08 przy następnej
  zmianie tych plików: F4 (wyszarzony wiersz w `JoinRequests.tsx`), F1 (testy `request_join` w `tests/db`)
  (`context/archive/2026-10-22-latecomer-admission/follow-ups/review-fixes.md`).
- `context/archive/2026-10-15-full-game-evening/plan.md:48` — „Współhost: S-07. Następne, pomiń i koniec może tylko host.”
- `context/archive/2026-10-24-question-list-review/research.md:181`, `plan.md:38` — lista pytań gry tylko dla hosta.
- `context/domain/02-invariant-aggregate-refactor.md:29-34,642,743` — propozycja agregatu „Gra” z jedną funkcją
  `game_require_leader` przed S-07 (decyzja 0.2), nigdy nie zbudowana ani rozstrzygnięta
  (`context/archive/2026-10-22-latecomer-admission/research.md:120`); kontrola hosta jest dziś skopiowana w 7 funkcjach
  wymienionych wyżej. Wyścig dwóch prowadzących jest stępiony numerem pytania w każdym ruchu (`round_over`,
  `context/archive/2026-10-21-deferred-review-fixes/plan.md:7`).
- `context/domain/glossary.md:40-41,43` — „prowadzący” = host albo (później) współhost; „współhost” _missing in code_;
  prośba o wejście mówi „host wpuszcza”. `context/domain/domain-distillation.md:41,56-60,131,198,226` — T-07, T-17,
  T-20, T-21, R-03, Q-08.

## Related Research

- `context/archive/2026-10-22-latecomer-admission/research.md`
- `context/archive/2026-10-15-full-game-evening/research.md`
- `context/archive/2026-10-07-room-lobby/research.md`

## Open Questions

Decyzje produktowe dla Karola (do planu):

1. **Ilu współhostów naraz?** Jeden albo kilku (dokumenty nic nie proponują).
2. **Kogo można zrobić współhostem?** Każdego gościa, także wpuszczonego spóźnionego (PRD mówi „gość”, roadmapa „gracz”).
3. **Czy współhost kończy grę?** Tak według FR-006, tabeli PRD i S-03 (`prd.md:97,170`); opis roli (`prd.md:161`) tego
   nie wymienia (Q-08 w `domain-distillation.md:198`).
4. **Czy współhost widzi „Link dla graczy”?** Brak decyzji; dziś tylko host (`RoomLobby.tsx:121`).
5. **Gdzie host nadaje/odbiera rolę i jak to wygląda** (lista „Gracze” w poczekalni i w głosowaniu po głosie; znaczek
   „współhost”); słowa na ekranach („host” czy „prowadzący”) — wybór na zrzutach.
6. **Host, który wyszedł, dalej jest uprawniony do głosu** — rundy czekają na „Odsłoń wynik” prowadzącego. Przyjąć to w
   S-07, czy odłożyć do S-09 (usunięcie gracza)?
7. **Agregat „Gra” (decyzja 0.2) przed S-07?** Wspólna funkcja sprawdzająca prowadzącego zamiast siódmej kopii warunku.

Decyzje techniczne (do planu, bez Karola): miejsce flagi, kształt nowego klucza w `room_lobby`, droga kategorii dla
współhosta, kod odmowy dla odebranej roli.

## Decyzje do planu (2026-10-27, `/10x-plan` przerwany przed strukturą faz)

Złożoność: wysoka, potwierdzona przez Karola; budżet pytań (1, link) wykorzystany. Przy wznowieniu `/10x-plan` nie
pytać ponownie o nic z tej sekcji: zostaje akceptacja faz i zapis planu.

**Produktowe (Karol):**

1. Współhostów może być dowolnie wielu.
2. Współhostem może zostać każdy gość w pokoju, także wpuszczony spóźniony; host nie.
3. Współhost kończy grę, z tym samym „Na pewno?” co host.
4. **Link dla graczy zostaje tylko u hosta** (zastępuje wcześniejsze „tak”). Korekta faktu: link widać tylko w
   poczekalni (`src/pages/r/[id].astro:42-48`), w trakcie gry nie widzi go nikt, także host; spóźnionym ekipa podsyła
   link z czatu.
5. Host nadaje i odbiera rolę przyciskiem przy nicku na liście „Gracze” (poczekalnia; w głosowaniu po własnym głosie),
   przy nicku znaczek „współhost”. Teksty „Prowadzący…” zamiast „Host…”: pominięcie pytania, wpuszczenie, oczekiwanie
   spóźnionego, „Czekamy, aż prowadzący zacznie.”. Wygląd Karol wybiera na zrzutach.
6. Host, który wyszedł, dalej jest uprawniony do głosu: zostaje do S-09; w S-07 współhost odsłania wynik.

**Techniczne (do planu):**

- `players.cohost boolean not null default false` z `check (not cohost or user_id is null)`; bez nowych grantów, zmiana
  tylko przez funkcję. Host dziś ma `select, insert` na `players` (`room_lobby.sql:61`), check blokuje wstawienie
  współhosta tą drogą.
- Wspólna kontrola (decyzja 7): `private.leader_refusal(p_room_id uuid, p_host uuid, p_player_token text) returns text`:
  `null` dla prowadzącego (host po `auth.uid()`, współhost po tokenie), `not_leader` dla gracza pokoju bez roli,
  `room_unknown` dla reszty; 22023 na token w złym formacie (jak `cast_vote`); bez grantów, właściciel `postgres`,
  wołana po blokadzie wiersza pokoju.
- Siedem funkcji ruchu: `drop function` + `create function` z `p_player_token text default null` na końcu, grant
  `anon, authenticated`, helper w miejscu warunku `v_user <> v_host`.
- `public.set_cohost(p_room_id uuid, p_nick text, p_cohost boolean)`: tylko host (`authenticated`), blokada pokoju,
  odmowy `room_unknown`, `room_closed`, `player_unknown` (nick spoza pokoju albo nick hosta), ponowne ustawienie tej
  samej wartości to `ok`.
- `room_lobby`: gracz `{nick, host, cohost}`; `requests` dla prowadzących; nowy klucz `leader_draw` tylko dla
  prowadzących (`categories`, `adult_categories`, `list_entries`, `list_base_count`), `null` dla reszty;
  `question_list` dalej tylko host; `role` bez nowej wartości. Stary Worker kopiuje tylko znane klucze (`parsePlayers`
  i `parseRoomState` w `src/lib/rooms/shared.ts`), więc migracja wchodzi przed kodem.
- Worker: trasy start/reveal/next/skip/end/admit/reject „sesja albo ciasteczko gracza” jak `vote.ts:39-47`;
  start/next/skip biorą kategorie z `leader_draw` (przez `room_lobby`) zamiast `hostRoomCategories`; pozostałe pytania
  liczone z `leader_draw` bez osobnego zapytania (`questionsLeft` w `src/lib/rounds/draw.ts:88` potrzebuje tylko liczb);
  `roomView` odcina `leader_draw` i dodaje `leader: boolean`; nowa trasa `POST /api/rooms/[id]/cohost` (sesja,
  `{nick, cohost}`, dzwonek); odmowy `not_leader` i `player_unknown` w `errors.ts` (409, z tekstem).
- Ekrany: kontrolki prowadzącego według `view.leader`; tylko host: lista pytań gry, „Nowa gra”, link, przycisk roli;
  ogłoszenie w regionie na żywo przy nadaniu i odebraniu roli; podglądy w `/dev/room-states` i `/dev/room-window`.
- Testy: nowy `tests/db/cohost.test.ts`; poprawki `round-rules.test.ts:231-243`, `latecomers.test.ts:396-402`,
  `LOBBY_KEYS`/`PLAYER_KEYS`, pgTAP (granty, sygnatury, `plan(264)`), `room-rpc-gate`, `room-errors`, `room-state`;
  e2e `cohost.spec.ts` i zmienione teksty; krok współhosta w smoke. Follow-upy S-08: F1 (testy `request_join`), F4
  (wyszarzony wiersz `JoinRequests.tsx`).
- Dokumenty: glosariusz (prowadzący, współhost, prośba o wejście), zdanie o kciukach w AGENTS.md („the host's next
  move” → prowadzącego).

**Szkic faz (jeszcze niezatwierdzony):** 1. Baza i jej testy; 2. Worker; 3. Ekrany (warianty → wybór Karola na
zrzutach → wykonanie); 4. E2E, smoke, dokumenty. Wdrożenie: `npx supabase db push` przed scaleniem kodu, nie z
eduroam, za zgodą.
