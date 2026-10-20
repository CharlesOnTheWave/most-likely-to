---
artifact: domain-distillation
created: 2026-10-20
repo_root: C:\Users\karol\10xdevs
code_scope: .
head: a4eb127
dirty: none
path_alias: none
documents: 2 requirements, 13 narrative (68 plików; 19 przeczytanych w całości, 12 częściowo), 3 reference, 7 engineering
previous: none
evidence: context/domain/evidence/
glossary: context/domain/glossary.md
---

# Destylacja domeny: Most Likely To

Skróty migracji używane niżej: `M1` = `supabase/migrations/20261007122858_room_lobby.sql`, `M2` = `supabase/migrations/20261014101922_first_live_round.sql`, `M3` = `supabase/migrations/20261014101925_close_stale_games.sql`, `M4` = `supabase/migrations/20261015122252_full_game_evening.sql`. Dla funkcji SQL obowiązuje najnowsza definicja.

## Summary

Domena to imprezowa gra „Kto z nas najprawdopodobniej…”. Wszyscy widzą to samo pytanie, każdy oddaje jeden anonimowy głos, a wynik odsłania się po ostatnim głosie. Rdzeniem (Core) jest **runda na żywo** z anonimowym głosem i odsłoną. Wokół niej są dwie poddomeny Supporting („pokój i gracze”, „pytania”) i trzy Generic (logowanie hosta, transport na żywo, logi). Kod nie ma warstwy domenowej: reguły rundy i pokoju żyją w funkcjach SQL `security definer` z blokadą wiersza pokoju. W praktyce to one są agregatem-strażnikiem, a prawie wszystkie niezmienniki Core mają status **enforced**. Z 12 terminów Core żadnego nie brakuje w kodzie. Z 27 terminów Supporting brakuje 8 i wszystkie należą do zaplanowanych, niezbudowanych slice'ów S-04 i S-07…S-13. Wyjątek to „ekipa”, która nie ma tożsamości ani w dokumentach, ani w kodzie. Najsilniejszy rozjazd (D-01): PRD każe po odświeżeniu pokazać graczowi jego oddany głos (FR-011, US-01), a twarda zasada z AGENTS.md zabrania zwracać parę „kto na kogo”. Kod trzyma się zasady, więc wymaganie zostaje niespełnione. To jest #1 rankingu, bo S-04 zrobiony dosłownie złamałby jedyną trwałą zasadę gry.

Rozjazdy według strony naprawy: kod 4, dokumenty 2, decyzja 3. Otwartych pytań: 8.

## Changes since the previous run

Pierwszy przebieg, brak poprzedniego raportu.

## Ubiquitous language

### Core: runda na żywo

| id | term | kind | definition (quoted) | source | in code (path:line) | other names in code |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | Runda | entity | „pokazuje wszystkim to samo pytanie w tej samej chwili, zbiera od każdego jeden anonimowy głos i odsłania wynik w momencie, gdy zagłosuje ostatnia osoba” | `context/foundation/prd.md:150` | `private.rounds` `M2:112`; `RoundState` `src/lib/rooms/shared.ts:50` | w UI „pytanie”: „Pytanie N.” `src/lib/rooms/announce.ts:26`, „Następne pytanie” |
| T-02 | Głos | entity (ukryte) | „jeden głos na osobę z listy albo wstrzymanie się; głos na siebie dozwolony” | `prd.md:152` | brak rekordu z założenia: `cast_vote` `M4:255`, `private.round_voters` `M2:149`, `private.ballot_boxes.tally` `M2:141-143` | `vote`, „Zagłosuj”, „Twój głos” |
| T-03 | Wstrzymanie się | operation | „abstain kept as an explicit choice” | `prd.md:102` | `abstained` `M2:144`; `p_target` = null `M4:369-370` | `"abstain"` `src/components/room/RoundVoting.tsx:52`, „Wstrzymuję się” |
| T-04 | Kto już zagłosował | value | „Players see who has already voted (never for whom — votes are anonymous)” | `prd.md:103` | `VotingRound.voted`, `me_voted` `shared.ts:24-25` | „zagłosował(a)” |
| T-05 | Uprawnieni do głosu | value (ukryte) | „lista uprawnionych = gracze w pokoju w chwili startu” | `context/archive/2026-10-13-first-live-round/plan.md:313` | `rounds.eligible` `M2:120` | brak w TS i UI; ekran liczy „X z Y” od liczby graczy (`RoundVoting.tsx:143`) |
| T-06 | Odsłona | event / state | „Wyjściem jest odsłona „ile głosów na kogo" (nigdy „kto na kogo")” | `prd.md:152` | `phase = 'revealed'`; `private.finish_round` `M2:182`; `reveal_round` `M2:723` | „Odsłoń wynik”, „Wynik odsłonięty.” |
| T-07 | Przewinięcie (odsłona na żądanie) | operation | „whenever host or co-host advances the round” | `prd.md:103` | `reveal_round`, tylko host: `M2:721-722` | „Odsłoń wynik”; wariant współhosta **missing in code** (T-21) |
| T-08 | Wynik | value | „shows how many votes each person received” | `prd.md:103` | `private.round_results` `M2:130-135`; `RoundResult` `shared.ts:29` | „Wynik”, „Koło/Paski” |
| T-09 | Urna | entity (stan w toku) | „W trakcie rundy stan „kto zagłosował” i liczniki żyją w urnie, która znika” | `context/archive/2026-10-13-first-live-round/plan-brief.md:18` | `private.ballot_boxes` `M2:141` (+ `round_voters`) | „the urn” tylko w komentarzach |
| T-10 | Pominięcie pytania | operation | „a skipped question discards its votes without points and does not count toward question quality” | `prd.md:97` | `skip_round` `M4:140`; `phase = 'skipped'` | „Pomiń pytanie”, „Host pominął pytanie.” |
| T-11 | Następne pytanie | operation | „Następne pytanie. Po ostatnim: koniec wieczoru (bez punktacji).” | `prd.md:63` | `next_round` `M4:79` | „Następne pytanie” |
| T-12 | Numer pytania | value | „Numer pytania w głosie, pominięciu i „Następnym”” | `context/archive/2026-10-15-full-game-evening/plan-brief.md:27` | `rounds.number`; `p_round` `M4:259`; pole `round` `src/lib/rooms/json-route.ts:112` | „Pytanie N.” |

### Supporting: pokój i gracze

| id | term | kind | definition (quoted) | source | in code (path:line) or **missing in code** | other names in code |
| --- | --- | --- | --- | --- | --- | --- |
| T-13 | Gra | entity (ukryte) | „Host zakłada grę (logowanie → kategorie → link) w mniej niż 5 minut.” | `prd.md:37` | bez własnego typu: `rooms.status = 'playing'` + `started_at` `M2:51`, `:590`; `start_game`, `end_game` | „Nowa gra”, „Zacznij grę”, „Zakończ grę” (zob. B-01) |
| T-14 | Pokój | entity | „Host can create a room, choose question categories for the game (...) and get a shareable room link.” | `prd.md:94` | `public.rooms` `M1:19`; `create_room` `M2:220` | „Twój pokój” |
| T-15 | Wieczór | thesis / ekran | „Po ostatnim: koniec wieczoru” | `prd.md:63` | tylko UI: `EveningEnd` `src/components/room/RoomScreen.tsx:55` | „Koniec wieczoru”, „Dzięki za grę!” |
| T-16 | Poczekalnia | state | „trafia do poczekalni, a wszyscy widzą listę graczy na żywo” | `context/archive/2026-10-07-room-lobby/plan-brief.md:8` | `status = 'lobby'` `M1:25` | „w poczekalni” (zob. B-02) |
| T-17 | Host | role | „osoba organizująca wieczór dla swojej ekipy znajomych” | `prd.md:28` | `rooms.host_id` `M1:21`; `role: "host"` `shared.ts:55` | „osoba prowadząca” `src/components/auth/SignInCard.astro:25` |
| T-18 | Gość | role | „uczestnik bez konta; wchodzi linkiem, wpisuje nick, głosuje, proponuje pytania.” | `prd.md:32` | `players.user_id is null` `M2:271`; `role: "guest"` `shared.ts:55` | „Goście grają bez konta.” |
| T-19 | Gracz | role | brak definicji; „Player can vote for exactly one person from the nick list (including themselves) or abstain.” | `prd.md:101` | `public.players` `M1:34`; `LobbyPlayer` `shared.ts:11` | „Gracze (N)”; `newPlayerToken` robi token gościa (`src/lib/rooms/tokens.ts:27`) |
| T-20 | Prowadzący | role (host lub współhost) | brak definicji; „Po zebraniu głosów albo gdy prowadzący przewinie: odsłona” | `prd.md:62` | tylko host; brak osobnego pojęcia | „osoba prowadząca” = host |
| T-21 | Współhost | role | „gość, któremu host w pokoju nadaje uprawnienia prowadzenia” | `prd.md:160` | **missing in code** | — |
| T-22 | Spóźniony | role | „Latecomer can request to join a started game with a chosen nick” | `prd.md:90` | **missing in code** (tylko komentarze „S-08 decides about late players” `src/pages/api/rooms/join.ts:39`, `M2:341`; dziś odmowa `game_started`) | — |
| T-23 | Twórca gry | role (operator) | „buduje i kuratoruje wspólną bazę pytań z kategoriami” | `prd.md:158` | poza aplikacją z założenia („outside the UI”, `prd.md:131`); w kodzie tylko komentarze, np. `src/data/questions.ts:2` | „creator”, „owner” w komentarzach (zob. B-07) |
| T-24 | Nick | value | „the room rejects a duplicate nick” | `prd.md:84` | `players.nick` `M1:37`; `nick_key` `M2:103` | „Twój nick” |
| T-25 | Link do pokoju | value | „get a shareable room link” | `prd.md:94` | `rooms.link_token` `M1:23`; trasa `/j/[token]` | „kod linku” (komentarze, log `op: "link_code"`), pole `link`, „Link dla graczy” |
| T-26 | Miejsce (`seat`) | value | „`seat` (1, 2, 3…) zamiast godziny wejścia” | `room-lobby/plan-brief.md:39` | `players.seat` `M1:41` (brak w TS; tylko kolejność tablic) | — |
| T-27 | Tożsamość gościa | value (ukryte) | „Ciasteczko httpOnly na 24 h, w bazie tylko `sha256` w tabeli bez uprawnień” | `room-lobby/plan-brief.md:34` | token `tokens.ts:11`, `:27`; ciasteczko `mlt_player_<roomId>` `tokens.ts:31-33`; `player_secrets.token_hash` `M1:51`; żaden typ ich nie łączy | — |
| T-28 | Powrót po odświeżeniu | operation | „returns to their nick and the current round state, including a vote already cast; reclaiming a nick requires verification” | `prd.md:105` | częściowo: ponowne wejście z ciasteczkiem `join.ts:29-37`, `src/pages/j/[token].astro:35-41`; odzyskanie nicku bez ciasteczka **missing in code** | — |
| T-29 | Usunięcie gracza | operation | „Host or co-host can remove a player from the room; after removal the room gets a new link” | `prd.md:88` | **missing in code** | — |
| T-30 | Lista własnych gier i kasowanie gry | entity / operation | „Host can see a minimal list of their past games (...) and delete any of them” | `prd.md:128` | **missing in code** (`/dashboard` to pozostałość startera, `src/pages/dashboard.astro:7-16`) | — |
| T-31 | Ekipa | entity? | brak definicji; „ani z ostatnich wieczorów tej ekipy” | `prd.md:154` | **missing in code**; brak tożsamości także w dokumentach (Q-06) | — |

### Supporting: pytania

| id | term | kind | definition (quoted) | source | in code (path:line) or **missing in code** | other names in code |
| --- | --- | --- | --- | --- | --- | --- |
| T-32 | Pytanie | entity | „Identyfikator pytania \| `<kategoria>-<NNN>`, niezmienny i nigdy nieużywany ponownie” | `context/archive/2026-09-27-starter-question-base/plan-brief.md:29` | `QUESTIONS`, `QuestionId` `src/data/questions.ts:40`, `:718`; `rounds.question_id` `M2:117` | `question` = id, końcówka zdania albo pełne zdanie (zob. kod) |
| T-33 | Kategoria | value | „choose question categories for the game” | `prd.md:94` | `CATEGORIES` `questions.ts:21`; `rooms.categories` `M1:26` | „Kategorie pytań” |
| T-34 | Pytania 18+ | value | „every question carries an 18+ flag, and the host decides per chosen category whether its 18+ questions are included” | `prd.md:96` | `adult` (`questions.ts`); `rooms.adult_categories` `M1:27` | „18+” |
| T-35 | Wspólna baza pytań | entity | „wspólna baza pytań z kategoriami, kuratorowana przez twórcę gry” | `prd.md:112` | `src/data/questions.ts` („Shared question base”, `:2`) | — |
| T-36 | Lista pytań gry | entity | „Lista należy do tej jednej gry” | `prd.md:112` | brak bytu: pula liczona w locie `poolFrom` `src/lib/rounds/draw.ts:25`, kandydaci `p_candidates` `M4:38`; przegląd listy (FR-012) **missing in code** | „pula” (zob. B-05) |
| T-37 | Propozycja pytania | entity | „Guest can propose questions from the room link during the evening, up to a per-guest limit” | `prd.md:116` | **missing in code** | — |
| T-38 | Reakcja i dane o rozgrywce | event / measure | „vote distribution (how concentrated), skips, post-round reactions, and removals” | `prd.md:122` | **missing in code** | — |
| T-39 | Dobór uczący się | policy | „częściej padają pytania, które dobrze zagrały u wszystkich ekip” | `prd.md:154` | **missing in code**: dziś losowanie bez wag `shuffledPool` `draw.ts:54-65` | — |

**Liczby.** Dowody zawierają ok. 80 wierszy terminów w `evidence/1-docs-language.md` i 20 pojęć w `evidence/2-code-language.md`. Tabele mają 39 terminów (Core i Supporting). Generic liczone tylko zbiorczo: 4 obszary (logowanie hosta przez Discord, Google i hasło; dzwonek i odpytywanie stanu; zgłoszenia z ekranu; logi). **Missing in code:** 0 z 12 Core; 8 z 27 Supporting (role 2: T-21, T-22; operacje 2: T-29, T-30; byty i miary 3: T-31, T-37, T-38; polityka 1: T-39) plus 2 częściowe (T-28, T-36). Tezy (runda na żywo, hipoteza hosta, gwiazda przewodnia) są wymienione w dowodach, nie liczone.

**Zakres wyszukiwań dla „missing in code”.** Przeszukane `src/` (bez `src/pages/dev`) i `supabase/migrations/`, wzorce: `co.?host|cohost|współhost|co_host` (0), `latecomer|late.?player|spóźnion|admit|knock` (5 trafień, tylko komentarze o S-08), `kick|ban|remove_player` (0), `proposal|propos|propozycj` (0), `reaction|thumb|kciuk|reakcj` (0 domenowych), `quality|jakość|play.?data|weight` (0 domenowych), `crew|ekip|team` (0), `reclaim|odzysk` (0), `delete.?game|kasuj|skasuj|history` (0), `review_list|own.?question|własne pyt` (0).

**Pojęcia tylko w kodzie:**
- `lobby` jako cały stan pokoju (`room_lobby` `M4:403`, `GET …/lobby`): *searched in docs*, dokumenty znają tylko stan przed startem.
- Kody odmów `no_round`, `round_over`, `room_unknown` z kilkoma sytuacjami każdy (`src/lib/rooms/errors.ts:7-43`): *not in the docs sample*.
- `ballots`, czyli liczba oddanych kart, parsowana, ale nigdzie niepokazywana (`shared.ts:151`): *not in the docs sample*.
- `/dashboard`, strona startera bez linków (`src/middleware.ts:5`): *not in the docs sample*.

## Multiple meanings and context boundaries

| id | word | meaning A (context, source) | meaning B (context, source) | suggested names |
| --- | --- | --- | --- | --- |
| B-01 | gra / pokój / wieczór / sesja | pokój jako miejsce z linkiem, od założenia do zamknięcia (`prd.md:94`; `public.rooms` `M1:19`) | rozgrywka od startu do końca (`prd.md:37`; `start_game`, `end_game`); „wieczór” jako ekran końcowy (`prd.md:63`) albo seria wieczorów ekipy (`prd.md:154`) | **pokój** = byt i link; **gra** = pokój w stanie `playing`; **wieczór** tylko w tekstach UI |
| B-02 | lobby | stan przed startem (`room-lobby/plan-brief.md:8`; `status = 'lobby'` `M1:25`) | cały stan pokoju w każdym statusie, także z rundą (`room_lobby` `M4:403`, `LobbyState.round` `shared.ts:53-59`) | **poczekalnia** dla stanu; **stan pokoju** dla odpowiedzi `room_lobby` |
| B-03 | pomijać | gracz wstrzymuje się: „Każdy wskazuje osobę z listy nicków (albo pomija)” (`prd.md:61`) | prowadzący pomija rundę: „skip the current round” (`prd.md:97`) | **wstrzymać się** (gracz) vs **pominąć pytanie** (prowadzący); kod już rozdziela (`abstain` / `skip`) |
| B-04 | przewinąć / advance | odsłona na żądanie (`prd.md:103`) | przejście do następnego pytania (`prd.md:126`) | **odsłonić** (`reveal_round`) vs **następne pytanie** (`next_round`) |
| B-05 | pula | model: baza wspólna i lista gry (`prd.md:112`) | dawna własna pula hosta (`prd.md:83`); niezagrane pytania z wybranych kategorii (`full-game-evening/research.md:112`; `poolFrom` `draw.ts:25`) | **wspólna baza**, **lista pytań gry**, **pozostałe pytania** |
| B-06 | wynik | liczby głosów w rundzie (`prd.md:150`) | ocena pytania „wynik jakości” (`prd.md:200`) | **wynik** (runda) vs **ocena pytania** |
| B-07 | twórca / creator | operator, który kuratoruje bazę i ma bazę danych (`prd.md:158`; `AGENTS.md:7`; komentarze `questions.ts:2`) | host, który „zakłada grę” (`create_room`, „Załóż grę” `src/components/room/NewGameForm.tsx:219`) | **twórca gry** tylko dla operatora; host **zakłada grę** |
| B-08 | sesja | gra: „nie powtórzyło się w tej sesji” (`prd.md:74`) | czas życia tożsamości gościa: „Tożsamość żyje w tej sesji.” (`prd.md:161`); ciasteczko 24 h (`tokens.ts:13`) | **gra** vs **ciasteczko gościa** |
| B-09 | host | właściciel konta i gier (`prd.md:159`) | gracz z nickiem, który głosuje (`room-lobby/plan-brief.md:30`; miejsce 1 `M2:292-293`) | **host** (rola) i **gracz** (ktoś w rundzie, także host) |
| B-10 | `no_questions` | pusta pula przy starcie (`src/pages/api/rooms/[id]/start.ts:29-30`) | wyczerpana pula przy `next_round` (`M4:128-131`) | dwa kody albo dwa teksty; dziś jeden tekst pasuje tylko do A (D-04) |

## Subdomains

| subdomain | class | concepts | why (goal quote, or description and usage) |
| --- | --- | --- | --- |
| Runda na żywo (głos, odsłona, anonimowość) | **Core** | T-01…T-12, R-01…R-09, R-21 | „Ekipa rozgrywa co najmniej 10 pytań w jednym wieczorze bez awarii i bez sięgania po Google Forms.” (`prd.md:38`); „Runda przeżywa odświeżenie strony i wypadnięcie gracza” (`prd.md:46`); północna gwiazda to S-02 (`roadmap.md:38`) |
| Pokój i gracze (zakładanie, dołączanie, role, powrót) | Supporting | T-13…T-31, R-11, R-12, R-16…R-20 | „Gość dołącza w mniej niż 30 sekund bez instrukcji.” (`prd.md:47`); potrzebne, ale przewaga produktu leży w rundzie |
| Pytania (baza, kategorie, 18+, lista gry, dobór) | Supporting | T-32…T-39, R-14, R-22 | PRD sam nazywa dobór „Reguła pomocnicza” (`prd.md:154`); „Po 3 wieczorach pytania są zauważalnie lepsze” to cel drugorzędny (`prd.md:42`) |
| Logowanie hosta | Generic | Discord, Google, hasło (`src/pages/api/auth/*`) | rozwiązywane wszędzie tak samo; dostawca Supabase Auth |
| Transport na żywo (dzwonek, odpytywanie) | Generic | `ringRoom`, `BELL_EVENT`, limiter (`src/lib/live-sync/*`) | technika, nie reguła gry: „stan przeglądarka pobiera z serwera” (`roadmap.md:86`) |
| Logi i zgłoszenia z ekranu | Generic | `logEvent` (`src/lib/log.ts`), `CLIENT_EVENTS` (`src/lib/client-events.ts:8`) | operacyjne; wiąże je polityka anonimowości (R-08, R-13) |

## Invariants and policies

### Runda (Core, kandydat na agregat)

Tożsamość `rounds.id`, cykl `voting → revealed | skipped`. Strażnikiem są funkcje SQL `cast_vote`, `reveal_round`, `next_round`, `skip_round`, `end_game`, każda w jednej transakcji z blokadą wiersza pokoju (`M2:14-16`, np. `M4:285-288`). Role API nie mają grantów zapisu (`M2:33-34`, `:160-161`).

| id | candidate | invariant (quoted) | source | status | guarded at | gap |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Runda | „D2: głos ostateczny.” | `first-live-round/research.md:278` | enforced | `already_voted` `M4:348-351`; klucz `(round_id, player_id)` `M2:149-153` | po awarii bazy tabela `unlogged` jest czyszczona i można zagłosować ponownie; przyjęty koszt: „To przyjęty koszt D1.” (`first-live-round/plan.md:770`) |
| R-02 | Runda | „Player can vote for exactly one person from the nick list (including themselves) or abstain.” | `prd.md:101` | enforced | `unknown_target` dla celu spoza `eligible` `M4:353-361` | — |
| R-03 | Runda | „reveal happens when everyone has voted or whenever host or co-host advances the round” | `prd.md:103` | enforced | auto-odsłona `M4:381-388`; `reveal_round` bez progu `M2:721-767` | wariant współhosta niezbudowany (S-07) |
| R-04 | Runda | „W trakcie rundy widać, kto już zagłosował, ale nigdy na kogo” | `prd.md:77` | enforced | `room_lobby` `M4:461-501`; parser kopiuje tylko klucze kontraktu `shared.ts:119-129` | — |
| R-05 | Runda | „Głos i akcje hosta niosą numer pytania, więc nic nie trafia do pytania, którego ktoś nie widział.” | `full-game-evening/plan-brief.md:16` | declared | `round_over` tylko gdy numer podany `M4:328-331`; Worker przyjmuje ciało bez `round` (`json-route.ts:113`) | furtka miała być tymczasowa: „Stary ekran wysyła głos bez numeru (przyjęty)” (`full-game-evening/plan-brief.md:60`), zamknięcie odłożone jako F2 (`context/archive/2026-10-15-full-game-evening/reviews/impl-review.md:70-78`, `follow-ups/review-fixes.md:7`); „Odsłoń wynik” nie niesie numeru wcale (`reveal_round(p_room_id uuid)` `M2:723`); test `tests/db/game-rules.test.ts:154` utrwala furtkę (D-09, Q-02) |
| R-06 | Runda | „„Pomiń pytanie” tylko w trakcie głosowania” (D2) | `full-game-evening/research.md:145` | enforced | `skip_round` `M4:181-199` | — |
| R-07 | Runda | „bez samoczynnego końca”; koniec przez „Zakończ grę” | `full-game-evening/research.md:145` | enforced | wyczerpana pula → `no_questions` bez zamknięcia `M4:128-131`; `end_game` `M4:207-242` | tekst odmowy w rzadkim przypadku (D-04) |

### Polityki produktu

| id | candidate | invariant (quoted) | source | status | guarded at | gap |
| --- | --- | --- | --- | --- | --- | --- |
| R-08 | Anonimowość | „Żadnej odsłony ani zapisu „kto na kogo głosował", w jakiejkolwiek formie” | `prd.md:180`; `AGENTS.md:7` | enforced | schemat bez pary `M2:141-153`; tabele `unlogged` bez grantów `M2:141`, `:149`, `:155-161`; odpowiedź tylko `{ok: true}` `M4:390`; lista pól logu `src/lib/log.ts:13-27`; cel głosu tylko w pamięci ekranu `RoundVoting.tsx:16-20` | przyjęte granice z `prd.md:143`: obserwator bazy na żywo; odsłona przy jednym głosie (`tests/db/round-rules.test.ts:280`) |
| R-09 | Urna znika | „The in-progress state of a round lives only in unlogged `private` tables with no grants and is deleted at the reveal and whenever the round ends otherwise” | `AGENTS.md:7` | enforced | `finish_round` `M2:210-211`; `skip_round` `M4:195-196`; `drop_round_state` `M2:166-178`; sprzątanie co godzinę `M3:17-42` | czy zadanie `close-stale-games` działa na produkcji: Q-07 |
| R-10 | Bez punktów i timera | „Do not add points, leaderboards or round timers; they are PRD Non-Goals.” | `AGENTS.md:8` | enforced | brak mechanizmu; wyszukiwanie `timer\|countdown\|score\|points\|leaderboard` w `src/` i migracjach: tylko `setTimeout` UI `RoomLobby.tsx:48` i komentarz „No timer.” `RoundVoting.tsx:275` | — |
| R-11 | Minimalizacja danych gościa | „O gościu nie zostaje nic poza nickiem i głosami” | `prd.md:48` | declared | „Nothing about a guest is kept but the nick” `M1:38` | zostają też `seat` (`M1:41`) i `player_secrets.token_hash` bez terminu (`M1:49-52`); Q-05 |
| R-12 | Prawo do skasowania | „host może skasować historię” | `prd.md:48`; FR-019 `prd.md:128` | ignored | brak; jedyne usuwanie dotyczy urn (`M2:171-177`); wyszukiwanie `delete.?game\|kasuj\|skasuj\|history` w `src/` i migracjach: 0 | S-13 `proposed` (`roadmap.md:58`) |
| R-13 | Logi | „log it through `logEvent` (`src/lib/log.ts`: allowed fields only, never an error message or player data)” | `AGENTS.md:20` | contradicted | `logEvent` z listą pól `log.ts:13-27` | `code: error.message` w `src/lib/live-sync/server.ts:22-27`; `console.error` w 5 miejscach logowania hosta (D-02, D-03) |
| R-14 | Baza pytań na serwerze | „Pytania importujemy tylko w kodzie serwera. Do przeglądarki trafia tylko to, co dana osoba ma teraz zobaczyć” | `context/foundation/lessons.md:16` | enforced | `draw.ts:3-5`; tekst bieżącego pytania `src/lib/rooms/server.ts:192-205` | — |
| R-15 | Dzwonek | „stan pochodzi wyłącznie z bazy, nigdy z treści dzwonka” | `roadmap.md:86` | enforced | dzwonek tylko wyzwala pobranie `useRoomState.ts:286-288`; limiter `src/lib/live-sync/limiter.ts:4-16` | kanał publiczny z założenia; autoryzacja kanału na produkcji nieznana |

### Pokój i gra (Supporting, kandydat na agregat)

| id | candidate | invariant (quoted) | source | status | guarded at | gap |
| --- | --- | --- | --- | --- | --- | --- |
| R-16 | Pokój | „A host can have one open room at a time.” | `README.md:166` | enforced | indeks częściowy `M2:46-47`; zamknięcie poprzedniego `M2:264-280`, pytanie przy gościach `M2:270-274` | — |
| R-17 | Gra | „co najmniej 2 gości dołączyło nickiem” (z hostem: 3 graczy) | `prd.md:69` | enforced | `not_enough_players` `M2:576-582` | — |
| R-18 | Pokój | „Z `closed` nic nie wychodzi.” | `full-game-evening/research.md:54` | enforced | `check (status in …)` `M2:42-43`; brak grantu `update` `M2:33-34` | poczekalnia nie wygasa nigdy (`M3:29`); kod tylko, bez reguły w dokumentach |
| R-19 | Nick | „the room rejects a duplicate nick” (wielkość liter się liczy, niewidoczne różnice nie) | `prd.md:84`; `README.md:166` | enforced | `M1:37`; `nick_key` i `unique` `M2:90-107` | — |
| R-20 | Link | „A GET changes nothing, because Discord fetches the link for its preview” | `README.md:159` | enforced | `src/pages/j/[token].astro:12-13`; dołączenie tylko przez POST `join.ts:9` | — |
| R-21 | Gracz (Core, guardrail rundy) | „returns to their nick and the current round state, including a vote already cast; reclaiming a nick requires verification that it is the same person” | `prd.md:105`; AC `prd.md:75` | declared | powrót z ciasteczkiem `join.ts:29-37`, `[token].astro:35-41`; ekran wie tylko `me_voted` (`shared.ts:25`) | cel głosu ginie przy przeładowaniu (`RoundVoting.tsx:16-20`); odzyskanie nicku bez ciasteczka niezbudowane; wymóg ściera się z R-08 (D-01, Q-01) |

### Lista pytań gry (Supporting, pojęcie ukryte)

| id | candidate | invariant (quoted) | source | status | guarded at | gap |
| --- | --- | --- | --- | --- | --- | --- |
| R-22 | Lista pytań gry | „Pytanie pochodzi tylko z wybranych kategorii (pytania 18+ tylko z tych, w których host je dołączył) i nie powtórzyło się w tej sesji” | `prd.md:74` | declared | bez powtórek: `unique (room_id, question_id)` `M2:124-125`; kategorie i 18+ tylko w Workerze `draw.ts:23-33`, `src/pages/api/rooms/index.ts:26-31` | baza sprawdza tylko format id (`M2:117`, `:572-574`); host może przez bezpośrednie RPC podać inne id; kod to przyznaje (`draw.ts:7-8`); D-05, Q-04 |

**Reguły tylko w kodzie** (wiedza, której nikt nie zapisał):
- poczekalnia nie wygasa nigdy (`M3:29`; pgTAP `supabase/tests/round_creator_view.test.sql:774-778`);
- hash tokenu gościa żyje bez terminu, ciasteczko 24 h (`M1:49-52`, `tokens.ts:13`);
- akcje gry przyjmują tylko JSON z własnego originu, do 4096 B (`json-route.ts:11-41`);
- `reveal_round` na pominiętej rundzie to cichy `ok` (`M2:763-767`);
- dołączenie zapisuje gracza przed ciasteczkiem, więc zgubiona odpowiedź zostawia zajęty nick (`join.ts:44-53`);
- brak limitu tempa zakładania i dołączania (wyszukiwanie `rate|limit` w `src/` i migracjach: nic). Brak limitu graczy jest zgodny z `prd.md:141`.

## Model vs code drift

| id | the documents say (newest) | the code does | evidence (path:line) | consequence | fix |
| --- | --- | --- | --- | --- | --- |
| D-01 | Gracz po odświeżeniu „widzi bieżące pytanie i swój oddany głos” (`prd.md:75`; FR-011 `prd.md:105`); równocześnie „Never persist, log or return a pairing of voter and voted-for player, in any form.” (`AGENTS.md:7`), a roadmapa sama pisze, że to się ściera (`roadmap.md:161`) | po przeładowaniu ekran wie tylko, że gracz zagłosował; cel istnieje wyłącznie w pamięci komponentu („S-04 shows it after a reload, S-02 does not”) | `src/components/room/RoundVoting.tsx:16-20`; `shared.ts:24-25` | kryterium US-01 niespełnione; dosłowne spełnienie złamałoby R-08 | decision (Q-01) |
| D-02 | „never an error message” w logu (`AGENTS.md:20`) | błąd dzwonka zapisuje tekst błędu Realtime jako `code`, świadomie (komentarz powołuje się na audyt L6) | `src/lib/live-sync/server.ts:19-27`; `context/audits/observability/2026-10-11_guest-join-live-lobby.md:91` | AGENTS.md nie zna wyjątku, więc następny agent może go „naprawić” albo powielić | decision (Q-03) |
| D-03 | catch loguje „through `logEvent` (...: allowed fields only)” (`AGENTS.md:20`) | 5 miejsc w logowaniu hosta pisze `console.error` z ręcznie dobranymi polami | `src/lib/auth-user.ts:16`; `src/pages/api/auth/callback.ts:28`, `:47`; `src/pages/api/auth/oauth.ts:42`; `src/pages/api/auth/signin.ts:26` | logi auth omijają listę pól; dziś bez danych gracza (tylko name/status/code) | code |
| D-04 | przy wyczerpanej puli „„Pytania się skończyły” + „Zakończ grę”, bez samoczynnego końca” (`full-game-evening/research.md:145`) | gdy Worker nie umiał policzyć pozostałych pytań (`questionsLeft = null`), host widzi „Następne pytanie”, a odmowa `no_questions` pokazuje „W wybranych kategoriach nie ma pytań. Załóż nową grę z innymi kategoriami.” | `src/components/room/RoundReveal.tsx:232-233`; `src/lib/rooms/errors.ts:35`; `M4:128-131` | mylący tekst w rzadkim przypadku (inference, nieuruchamiane) | code |
| D-05 | „Pytanie pochodzi tylko z wybranych kategorii (pytania 18+ tylko z tych, w których host je dołączył)” (`prd.md:74`) | baza przyjmie każde id o poprawnym formacie; kategorie i 18+ sprawdza tylko Worker | `M2:117`, `:572-574`; `src/lib/rounds/draw.ts:7-8` | host omijający Workera może zagrać we własnym pokoju pytanie spoza wyboru, także 18+ | decision (Q-04) |
| D-06 | „host może skasować historię” (`prd.md:48`); „deletion removes everything tied to nicks (players, votes, results)” (`prd.md:128`) | nic nie usuwa pokoi, graczy, wyników ani hashy tokenów | jedyne usuwanie: urny `M2:171-177`; sprzątanie tylko zamyka (`M3:29-33`) | dane gości rosną bez końca; obietnica z PRD niespełniona do S-13 | code (S-13) |
| D-07 | „Host can sign in with one click via an external provider, without registration or password” (`prd.md:82`); „loguje się bez rejestracji i hasła” (`prd.md:159`) | logowanie hasłem działa dla istniejących kont | `src/pages/api/auth/signin.ts:6-31`; decyzja „Zostaje dla istniejących kont” `context/archive/2026-10-04-one-click-host-login/plan-brief.md:24` | PRD opisuje stan sprzed decyzji | docs |
| D-09 | „Głos i akcje hosta niosą numer pytania, więc nic nie trafia do pytania, którego ktoś nie widział.” (`full-game-evening/plan-brief.md:16`); zamknięcie furtki po oknie wdrożenia: „nowa migracja z obowiązkowym `p_round` w `cast_vote` i z `p_round` w `reveal_round`” (`full-game-evening/reviews/impl-review.md:77`, decyzja DEFERRED `:78`); „Nigdy test, który zapisuje dziurę jako dozwolone zachowanie.” (`context/foundation/test-plan.md:173`) | głos bez numeru trafia do najnowszej rundy, odsłona nie przyjmuje numeru, a test oczekuje `ok: true` dla głosu bez numeru | `M4:252-259`, `:328-331`; `M2:723`; `src/lib/rooms/json-route.ts:109-116`; `tests/db/game-rules.test.ts:154` | spóźniony ekran (np. drugi ekran hosta) może odsłonić albo zagłosować w rundzie, której nie pokazał | code |
| D-08 | „Następne pytanie. Po ostatnim: koniec wieczoru” (`prd.md:63`) | wyczerpana pula nie kończy gry; kończy tylko „Zakończ grę” | `M4:128-131`; decyzja D2 `full-game-evening/research.md:145` | PRD sugeruje samoczynny koniec | docs |

## Stale documents

- `context/foundation/shape-notes.md:61`, `:137` (odsłona „po upływie czasu”) zastąpione przez `prd.md:62`, `:76` (bez timera).
- `shape-notes.md:61`, `:75` (punkty) zastąpione przez `prd.md:181` (bez punktów).
- `prd.md:83` („their own pool”) zastąpione przez `prd.md:112` (model puli).
- `prd.md:82`, `:159` (bez hasła) zastąpione przez `one-click-host-login/plan-brief.md:24` (D-07).
- `prd.md:63` i `roadmap.md:141` (koniec po ostatnim pytaniu) zastąpione przez `full-game-evening/research.md:145` (D-08).
- `prd.md:97` (pominięcie bez ograniczenia fazy) zawężone przez `full-game-evening/research.md:145`.
- `context/foundation/test-stack.md:29` („nothing can close … a room … until S-13”) jest nieaktualne wobec sprzątania co godzinę (`AGENTS.md:7`, `M3:42`).
- Ten sam dokument przeczy sam sobie: współhost kończy grę według `prd.md:97` i `:169`, a według opisu roli `prd.md:160` nie (Q-08).

## Ranking

| # | candidate | kind | subdomain | status | related IDs | reason | done when |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Powrót gracza z oddanym głosem | aggregate (gracz w rundzie) | Core | declared | R-21, R-08, D-01, Q-01, T-28 | przesunięty w górę (powód niżej) | FR-011 i US-01 w `prd.md` nie wymagają niczego, czego zabrania `AGENTS.md:7` (albo AGENTS.md zapisuje wyjątek), a test stanu pokoju po odświeżeniu potwierdza, że odpowiedź serwera nie zawiera celu głosu |
| 2 | Logi poza listą pól | policy | Generic (wiąże Core przez R-08) | contradicted | R-13, D-02, D-03, Q-03 | jedyna reguła, której kod wprost przeczy | `rg -n "console\.(error\|warn\|log)" src` zwraca tylko `src/lib/log.ts`, a żadne pole `code` w `logEvent` nie pochodzi z `error.message`, albo `AGENTS.md:20` wymienia wyjątek dzwonka |
| 3 | Prawo hosta do skasowania historii | policy | Supporting | ignored | R-12, R-11, D-06, Q-05 | obietnica prywatności z guardrailu PRD bez żadnego strażnika | po skasowaniu gry przez hosta zapytanie o jej pokój, graczy, wyniki i hashe tokenów zwraca 0 wierszy, a zbiorcze dane o pytaniach zostają |
| 4 | Ruch w rundzie, której gracz nie widział (głos i odsłona bez numeru) | aggregate (runda) | Core | declared | R-05, D-09, Q-02 | tymczasowa furtka bez daty zamknięcia (F2 odłożone), utrwalona testem wbrew `test-plan.md:173`; niezależnie wybrana jako #1 w `02-invariant-aggregate-refactor.md` | głos i „Odsłoń wynik” bez numeru pytania albo z numerem innej rundy dostają odmowę (test `tests/db/game-rules.test.ts:154` odwrócony) |
| 5 | Pytania spoza wybranych kategorii przez RPC | aggregate (lista pytań gry) | Supporting | declared | R-22, D-05, Q-04 | ominąć może tylko host we własnym pokoju | `start_game` i `next_round` z id pytania spoza kategorii pokoju dostają odmowę, albo decyzja Q-04, że to dozwolone, jest zapisana |
| 6 | Co zostaje o gościu | policy | Supporting | declared | R-11, Q-05 | `seat` i hash tokenu poza „nickiem i głosami” | lista danych gościa trzymanych po grze zgadza się z `prd.md:48` w brzmieniu po decyzji Q-05 |

**#1:** Przesunięty z miejsca 3 z powodu zasięgu szkód. S-04 zrobiony dosłownie według FR-011 zapisałby parę „kto na kogo” i złamał R-08, jedyną trwałą zasadę gry (`prd.md:180`). Pozycja 2 dotyczy logów bez danych gracza.
Dzisiaj kod stoi po stronie zasady: cel głosu żyje tylko w pamięci ekranu (`RoundVoting.tsx:16-20`). Dlatego wymaganie z US-01 (`prd.md:75`) jest niespełnione, a roadmapa przyznaje konflikt (`roadmap.md:161`).
To decyzja właściciela przed planem S-04, a nie refaktor. Bez niej każdy agent, który dostanie FR-011, dostanie też sprzeczne polecenia.

## Questions

| id | question | who can answer | unblocks |
| --- | --- | --- | --- |
| Q-01 | Czy po odświeżeniu gracz ma znów widzieć, na kogo zagłosował (FR-011, US-01)? Jeśli tak, to czy wyłącznie z pamięci własnego telefonu, jak sugeruje `roadmap.md:160`, bez niczego na serwerze? | właściciel produktu | D-01, R-21, S-04 |
| Q-02 | Czy okno wdrożenia S-03 (ekrany wczytane przed 2026-10-15) jest zamknięte, żeby F2 mogło wejść, i czy odsłona pominiętej rundy ma odpowiadać odmową zamiast cichego `ok` (`M2:763-767`)? | właściciel produktu / operator | R-05, D-09 |
| Q-03 | Czy zapis tekstu błędu Realtime jako `code` (audyt L6) to zaakceptowany wyjątek od `AGENTS.md:20`? | operator | D-02, R-13 |
| Q-04 | Czy host może we własnym pokoju zagrać pytanie spoza wybranych kategorii przez bezpośrednie RPC, czy baza ma to blokować? | właściciel produktu | D-05, R-22 |
| Q-05 | Czy numer miejsca (`seat`) i hash tokenu gościa mieszczą się w „nic poza nickiem i głosami” (`prd.md:48`)? Jak długo mają żyć zamknięte pokoje i ich gracze? | właściciel produktu | R-11, R-12, D-06 |
| Q-06 | Wykluczanie pytań z „ostatnich wieczorów” ma dotyczyć hosta (`prd.md:120`) czy ekipy (`prd.md:154`)? „Ekipa” nie ma tożsamości ani w dokumentach, ani w kodzie. | właściciel produktu | T-31, S-12 |
| Q-07 | Czy na produkcji „Confirm email” jest włączone (`AGENTS.md:14`; lokalnie `enable_confirmations = false`, `supabase/config.toml:215`) i czy zadanie `close-stale-games` się wykonuje? | operator (panel Supabase) | R-09 |
| Q-08 | Czy współhost może kończyć grę (`prd.md:97`, `:169`), czy nie (`prd.md:160`)? | właściciel produktu | T-21, S-07 |

## Unknowns and limitations

- **Narracja w próbce.** 68 plików: 19 przeczytanych w całości, 12 częściowo, 37 tylko po tytule. Dwie otwarte zmiany (`guest-vote-flow-analysis`, `refactor-opportunities`) to analizy pisane przez agentów, więc ich opis kodu jest z drugiej ręki.
- **Spis źródeł wykluczył `src/lib/live-sync/**` jako prototyp, ale produkt z niego korzysta** (`src/lib/rooms/server.ts:2`, `useRoomState.ts:5-6`). Agenci kodu przeczytali `server.ts`, `shared.ts` i `limiter.ts` tam, gdzie zależała od nich reguła. Spis poprawiony po przebiegu.
- Ciała testów (`tests/unit`, `tests/e2e`) sprawdzone tylko po tytułach. Wnętrze `useRoomState.ts` i treść 216 pytań przejrzane w próbce.
- Ustawienia produkcyjnego projektu Supabase (Auth, autoryzacja kanału Realtime, działanie pg_cron) są poza repo; dotyczy ich Q-07.
- Domyślne `checkOrigin` w Astro 7 dla tras formularzy niezweryfikowane (opiera się na komentarzu `json-route.ts:26-27`).
- Budżet odsłony 2 s (`prd.md:139`) i luźniejsze kryterium F-01 nie dają się ocenić z kodu (C-07 w `evidence/1-docs-language.md`).
- Stan na `head` a4eb127. Raport jest mapą, a nie projektem. Projekt agregatu i ACL to osobne dokumenty `context/domain/02-…` i `03-…`.
