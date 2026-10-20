# Evidence: language in the documents

Agent: `docs-language` (10x-domain-distillation), 2026-10-20, HEAD `a4eb127`. Źródło: wyłącznie dokumenty z `context/domain/evidence/0-documents.md`; kodu (`src/`, `supabase/`, `tests/`) nie otwierano. Każde `path:line` sprawdzone w tej sesji. Etykiety: **E** = evidence (dosłownie w dokumencie), **I** = inference (mój wniosek z kilku miejsc), **U** = unknown.

Uwaga o źródłach z drugiej ręki: dokumenty w `context/archive/*/research.md`, `context/changes/guest-vote-flow-analysis/` i `context/changes/refactor-opportunities/` są pisane przez agentów i często opisują kod. Cytuję je jako **zapisane decyzje i słownictwo**, nie jako dowód o kodzie (zgodnie z `0-documents.md:21-22`, `:68`).

## Przeczytane dokumenty

**Requirements (w całości):** `context/foundation/prd.md` (202 wiersze), `context/foundation/shape-notes.md` (269).

**Reference:** `AGENTS.md` (Hard Rules `:3-14`, Conventions `:20`, UI `:50-51`); `README.md` (`:140-196`: auth routes, game routes, smoke). `CLAUDE.md` nie otwierany osobno: według `0-documents.md:26` to import `AGENTS.md` plus blok narzędzi kursu (nie produkt).

**Engineering (tylko reguły):** `context/foundation/lessons.md` (całość), `context/foundation/tech-stack.md` (całość), `context/foundation/test-stack.md` (całość), `context/foundation/test-plan.md` (§1 `:11-36`, §2 `:37-67`, §3 `:76-81`, §5 `:111-127`, §6.3 `:203-228`, §6.6 `:293-312`, §7 `:314-321`), `context/deployment/deploy-plan.md` (grep reguł + `:53-56`), `context/foundation/infrastructure.md` (grep reguł), `context/audits/observability/2026-10-11_guest-join-live-lobby.md` (nagłówki + wiersze z regułami).

**Narrative — próbka.** Tytuły przeczytane wszystkie: 68 plików `.md` w `context/archive/` i `context/changes/` (bez README) + `roadmap.md`.
- W całości (19): `context/foundation/roadmap.md`; 8 × `context/archive/*/change.md`; `context/changes/refactor-opportunities/change.md`; `context/changes/guest-vote-flow-analysis/change.md`; plan-briefy `2026-10-13-first-live-round`, `2026-10-15-full-game-evening`, `2026-10-07-room-lobby`, `2026-09-27-starter-question-base`, `2026-09-27-live-sync-spike`; 3 × `follow-ups/review-fixes.md` (room-lobby, first-live-round, full-game-evening).
- Częściowo (12): `first-live-round/research.md` (`:35-52`, `:69-109`, `:272-338`: decyzje D1–D6), `first-live-round/reviews/plan-review.md` (F1 `:30-48`), `first-live-round/plan.md` (grep etykiet ekranu), `full-game-evening/research.md` (`:34-64`, `:100-160`, `:198-201`: decyzje D1–D5), `full-game-evening/plan.md` (grep), `one-click-host-login/plan-brief.md` (`:1-60`), `testing-lobby-foundation/plan-brief.md` (`:1-60`), `room-wide-layout/plan-brief.md` (`:1-40`), `refactor-opportunities/plan-brief.md` (`:1-50`), `guest-vote-flow-analysis/research.md` (`:1-70`, `:159-183`, `:332-340`), `starter-question-base/question-review.md` (`:1-57`), `live-sync-spike/measurements.md` (`:98-110`).
- Tylko tytuł (37): pozostałe `plan.md`, `research.md`, `external-research.md`, wszystkie `reviews/impl-review.md`, pozostałe `reviews/plan-review.md`, `phone-test.md`, `theme.md`, `ui-checks.md`, cały folder `2026-10-04-ui-signin-contract` poza `change.md` (kontrakt UI ekranu logowania), `refactor-opportunities/{plan,research}.md` i `reviews/plan-review.md`, `context/changes/bootstrap-verification/verification.md` (log scaffoldu, bez nagłówka).

**Pominięte celowo:** zrzuty ekranu (`screens/*.png|jpg`, nie dokumenty), `context/map/`, `context/domain/` (poza inwentaryzacją), `.claude/`.

## Terms

Kolumna „Etyk.” = etykieta dowodu. Definicje to cytaty źródła; tam, gdzie źródło nie definiuje, wpisuję „brak definicji” i oznaczam I.

### Role

| term | warianty | kind | definicja (cytat) | źródła | Etyk. |
|---|---|---|---|---|---|
| Host | host, hości, „Hosts”, główna persona | role | „osoba organizująca wieczór dla swojej ekipy znajomych; dowolna ekipa, nie tylko ekipa autora” ; „Host jest właścicielem swoich gier: wybiera kategorie, przegląda i poprawia listę pytań na dany wieczór przed startem, ma minimalną listę swoich gier (pełna historia w v2) i prawo skasowania swoich danych.” | `context/foundation/prd.md:28`, `prd.md:159`, `prd.md:82` („host identity is tied to the e-mail”) | E |
| Host jako gracz | „Twój nick” w „Nowej grze” | role | „Host głosuje i jest graczem powiązanym z kontem od początku.” | `context/archive/2026-10-07-room-lobby/plan-brief.md:30` | E |
| Gość | guest, goście, guests, secondary persona | role | „uczestnik bez konta; wchodzi linkiem, wpisuje nick, głosuje, proponuje pytania.” ; „Tożsamość żyje w tej sesji.” | `prd.md:32`, `prd.md:161` | E |
| Współhost | co-host, „co-host role” | role | „gość, któremu host w pokoju nadaje uprawnienia prowadzenia: start i pominięcie rundy, zatwierdzanie propozycji (trafiają tylko do listy tej gry, więc nic trwałego nie psuje), wpuszczanie spóźnionych, usunięcie gracza z pokoju. Nie ma dostępu do panelu hosta. Cel: wieczór nie umiera, gdy host wyjdzie.” | `prd.md:160`, `prd.md:86` (FR-003), `context/foundation/roadmap.md:52` (S-07 `proposed`) | E |
| Twórca gry | game creator, operator, „the game's creator”, autor | role | „(operator) — buduje i kuratoruje wspólną bazę pytań z kategoriami, z której losują wszyscy hości; po każdym wieczorze weryfikuje nowe pytania (zatwierdzone propozycje gości i własne pytania hosta) i dołącza je do bazy albo odrzuca. Jedna osoba w MVP (autor).” | `prd.md:158`, `shape-notes.md:93` („rola dodana 2026-09-20 wraz z modelem puli”), `AGENTS.md:7` | E |
| Prowadzący | leader, „both leaders”, „przez prowadzącego” | role | brak definicji; używane dla host lub współhost: „Po zebraniu głosów albo gdy prowadzący przewinie: odsłona” ; „knock visible to both leaders everywhere” | `prd.md:62`, `prd.md:91`, `prd.md:150`, `roadmap.md:215` | I (zbiorcza nazwa host+współhost) |
| Gracz | player, players, „Gracze” (region ekranu) | role | brak definicji; „Player can vote for exactly one person from the nick list (including themselves) or abstain.” | `prd.md:101`, `AGENTS.md:50` | I (obejmuje hosta i gości: `room-lobby/plan-brief.md:30`) |
| Spóźniony | latecomer, „spóźnieni” | role | „Latecomer can request to join a started game with a chosen nick; the request is visible to host and co-host on every screen, including mid-vote; once admitted, the latecomer sees the current round and votes from the next one.” | `prd.md:90` (FR-020), `roadmap.md:53` (S-08 `proposed`) | E |
| Niezalogowany na trasie hosta | — | role | „(panel, tworzenie pokoju) → przekierowanie do logowania. Link do pokoju działa bez logowania.” | `prd.md:162` | E |
| Ekipa | crew, „ekipa znajomych”, „wszystkich ekip” | entity? | brak definicji; „Ekipa znajomych umawia się na godzinę na Discordzie” | `prd.md:22`, `prd.md:154` („ostatnich wieczorów tej ekipy”), `prd.md:124` („play data of all crews”) | I: termin bez tożsamości w dokumentach; patrz Conflicts C-11 |

### Gra, pokój, wieczór

| term | warianty | kind | definicja (cytat) | źródła | Etyk. |
|---|---|---|---|---|---|
| Gra | game, gry, „Nowa gra”, „past games” | entity | brak jednej definicji; „Host zakłada grę (logowanie → kategorie → link) w mniej niż 5 minut.” ; „Host can see a minimal list of their past games (date, number of questions, who played)” | `prd.md:37`, `prd.md:128` (FR-019), `prd.md:159` | E (użycie), I (definicja) |
| Pokój | room, rooms, `/r/<id>` | entity | „Host can create a room, choose question categories for the game (and, for each chosen category, whether to include its 18+ questions), and get a shareable room link.” ; „A host can have one open room at a time.” | `prd.md:94` (FR-005), `README.md:160`, `README.md:166` | E |
| Wieczór | evening, wieczory, „Pełny wieczór” | entity / thesis | brak definicji; „Następne pytanie. Po ostatnim: koniec wieczoru (bez punktacji).” | `prd.md:63`, `roadmap.md:48` (S-03), `prd.md:120` („host's recent evenings”) | I: w praktyce jedna gra (patrz M-01) |
| Sesja | session | entity (wariant gry) | „Pytanie pochodzi tylko z wybranych kategorii (...) i nie powtórzyło się w tej sesji” | `prd.md:74` | I (= gra; FR-015 mówi „within a game”, `prd.md:120`) |
| Poczekalnia | lobby, `lobby` | state | brak definicji; „Gość otwiera link na telefonie, wpisuje nick i trafia do poczekalni, a wszyscy widzą listę graczy na żywo” | `room-lobby/plan-brief.md:8`, `README.md:164` („Lobby state (`status`, `role`, `me`, `players`)”) | E |
| Stany pokoju | `lobby`, `playing`, `closed` | state | „**Stany pokoju:** `lobby`, `playing`, `closed` (...). Host ma najwyżej jeden pokój w stanie `lobby` albo `playing` (...). Z `closed` nic nie wychodzi.” | `context/archive/2026-10-15-full-game-evening/research.md:54` | E (opis kodu z drugiej ręki) |
| Link do pokoju | room link, „Guest link”, `/j/<kod>`, „kod linku”, `p_link_token` (`room-lobby/follow-ups/review-fixes.md:10`) | value | „Link \| `/j/<22 znaki>` osobno od `/r/<uuid>` i tematu kanału \| S-09 wymieni link bez zmiany pokoju.” | `room-lobby/plan-brief.md:41`, `README.md:159`, `prd.md:88` (FR-004) | E |
| Stan linku | `open`, `started`, `closed`, `unknown` | state | „zwraca `{status: open\|started, room_id}` albo `{status: closed\|unknown}`” ; „`started` → 409, `closed` → 410, `open` → `JoinForm`” | `context/changes/guest-vote-flow-analysis/research.md:65`, `:67` | E (analiza kodu, agent) |
| Nick | nicki, „lista nicków”, „Twój nick” | value | „Guest can join a room via its link by entering a nick, without an account; the room rejects a duplicate nick.” ; „„Ola” ≠ „ola”, niewidoczne różnice się nie liczą (spacje, znaki niewidoczne, NFC), 1–20 znaków” | `prd.md:84` (FR-002), `room-lobby/plan-brief.md:29`, `README.md:166` | E |
| Miejsce | `seat` | value | „`seat` (1, 2, 3…) zamiast godziny wejścia \| O gościu zostaje tylko nick, jak chce PRD.” | `room-lobby/plan-brief.md:39` | E |
| Tożsamość gościa | ciasteczko `mlt_player_<roomId>`, token | value | „Ciasteczko httpOnly na 24 h, w bazie tylko `sha256` w tabeli bez uprawnień” | `room-lobby/plan-brief.md:34`, `README.md:166` | E |
| Tożsamość hosta | e-mail | value | „O hoście aplikacja przechowuje wyłącznie adres e-mail z logowania (tożsamość), bez innych danych osobowych.” | `prd.md:144`, `prd.md:82` | E |
| Panel hosta / lista własnych gier | host panel, „minimal list of their past games” | entity (widok) | „panel hosta: lista własnych gier i kasowanie pojedynczych” | `prd.md:174`, `prd.md:128`, `roadmap.md:58` (S-13 `proposed`) | E |

### Runda i głos

| term | warianty | kind | definicja (cytat) | źródła | Etyk. |
|---|---|---|---|---|---|
| Runda | round, rundy, „runda na żywo” | entity | brak osobnej definicji; reguła: „Aplikacja prowadzi rundę na żywo: pokazuje wszystkim to samo pytanie w tej samej chwili, zbiera od każdego jeden anonimowy głos i odsłania wynik w momencie, gdy zagłosuje ostatnia osoba (albo prowadzący przewinie)” | `prd.md:150`, `prd.md:67-77` (US-01) | E (reguła), I (definicja: jedna runda = jedno pytanie) |
| Fazy rundy | `voting`, `revealed`, `skipped` | state | „`private.rounds` (logowana) z fazą `voting` albo `revealed`” ; „Ślad pominięcia \| Runda `skipped` bez liczb, urna usunięta” | `full-game-evening/research.md:59`, `full-game-evening/plan-brief.md:24` | E (opis kodu z drugiej ręki) |
| Start | „start”, „Zacznij grę”, start the game | operation / event | „Host widzi, jak goście dołączają; klika „start".” ; „Host klika „Zacznij grę”” | `prd.md:58`, `prd.md:97` (FR-006), `first-live-round/plan-brief.md:8` | E |
| Głos | vote, głosy, „oddany głos”, „Zagłosuj” | entity / event | „Wejściem są lista nicków w pokoju i głosy graczy (jeden głos na osobę z listy albo wstrzymanie się; głos na siebie dozwolony).” | `prd.md:152`, `prd.md:101` (FR-008) | E |
| Wstrzymanie się | abstain, „Wstrzymuję się”, „Wstrzymało się: N”, `abstained`, „(albo pomija)” | operation | „abstain kept as an explicit choice” ; „wybiera osobę albo „Wstrzymuję się” i potwierdza „Zagłosuj”” | `prd.md:102`, `prd.md:61`, `context/archive/2026-10-13-first-live-round/plan.md:37` | E |
| Głos na siebie | self-vote, „także siebie” | policy | „self-vote explicitly allowed (it is part of the fun)” | `prd.md:102`, `roadmap.md:129` | E |
| Kto już zagłosował | „who has already voted”, „na kogo się czeka”, `voted`, `me_voted` | value | „Players see who has already voted (never for whom — votes are anonymous)” | `prd.md:103` (FR-009), `prd.md:152`, `guest-vote-flow-analysis/research.md:163` | E |
| Uprawnieni | eligible, „lista uprawnionych” | value | „`start_game`: lista uprawnionych = gracze w pokoju w chwili startu” ; „`cast_vote`: automatyczna odsłona, gdy liczba głosujących = liczba uprawnionych” | `first-live-round/plan.md:313-314` | E (plan), brak w PRD |
| Przewinięcie | „advances the round”, „przewinie”, „przewinięcie przez prowadzącego”, „Odsłoń wynik” | operation | „reveal happens when everyone has voted or whenever host or co-host advances the round (players who did not vote simply do not vote)” | `prd.md:103`, `prd.md:62`, `prd.md:139`, `first-live-round/plan.md:38` | E; patrz M-05 |
| Odsłona | reveal, „Odsłoń wynik”, „Wynik”, „Wynik odsłonięty.”, `revealed` | event / state | „Wyjściem jest odsłona „ile głosów na kogo" (nigdy „kto na kogo") i przejście do następnego pytania.” ; „(...) and shows how many votes each person received” | `prd.md:152`, `prd.md:103`, `AGENTS.md:50` („Wynik”) | E |
| Ekran odsłony (kolejność) | remis, „zera przygaszone” | policy (prezentacja) | „Wszyscy gracze od największej liczby głosów, remis według kolejności dołączenia, zera przygaszone, „Wstrzymało się: N”” | `first-live-round/plan-brief.md:34` | E |
| Urna | ballot box, „urna, która znika”, `ballot_boxes`, `round_voters`, „kartki w urnie” | entity (stan w toku) | „W trakcie rundy stan „kto zagłosował” i liczniki żyją w urnie, która znika: przy odsłonie zostają same liczby, a przy porzuceniu rundy nic.” ; „To baza twórcy, jak komisja stojąca nad urną” | `first-live-round/plan-brief.md:18`, `:25`, `first-live-round/research.md:288` | E |
| Porzucona / przerwana runda | abandoned round, „runda przerwana bez odsłony” | state | „Runda przerwana bez „Nowej gry” zostawia urnę na tygodnie” (problem) → „zadanie pg_cron co godzinę zamyka gry rozpoczęte ponad 12 h temu” | `first-live-round/reviews/plan-review.md:30`, `:37`, `prd.md:143` | E |
| Pominięcie | skip, „Pomiń pytanie”, „skip the current round”, „pominięta runda” | operation | „a skipped question discards its votes without points and does not count toward question quality” | `prd.md:97` (FR-006), `full-game-evening/research.md:145-146` | E; patrz M-03 |
| Notka po pominięciu | `after_skip` | value | „Na każdym ekranie rundy po pominięciu, z flagi w bazie” | `full-game-evening/plan-brief.md:28` | E |
| Następne pytanie | „Następne pytanie”, next | operation | „Następne pytanie. Po ostatnim: koniec wieczoru (bez punktacji).” ; „„Następne pytanie” (jedno kliknięcie)” | `prd.md:63`, `full-game-evening/plan-brief.md:16` | E |
| Numer pytania / rundy | `round`, `p_round`, „numer pytania” | value | „Numer pytania w głosie, pominięciu i „Następnym” \| Tak; inny numer to odmowa `round_over`” | `full-game-evening/plan-brief.md:27`, `full-game-evening/research.md:153` („Numer rundy w głosie”) | E |
| Spóźniony głos | `round_over` | event | „a vote sent from the question before gets `round_over`” | `README.md:195` | E |
| Zakończenie gry | „end the game”, „Zakończ grę”, „koniec gry” | operation | „ending the game requires a confirmation” ; „„Zakończ grę” z drugim kliknięciem → `closed`, urna usunięta, „Koniec wieczoru” dla wszystkich” | `prd.md:97`, `full-game-evening/research.md:147` | E |
| Koniec wieczoru | end of evening, „Dzięki za grę!” | event / state (ekran) | „Na końcu „Koniec wieczoru” i „Dzięki za grę!”, host ma „Nowa gra”, gość prośbę o nowy link.” | `full-game-evening/plan-brief.md:16`, `prd.md:63` | E |
| „Kto na kogo” | „who voted for whom”, „pairing of voter and voted-for player”, „para głosujący↔cel” | policy (pojęcie zakazane) | „Żadnej odsłony ani zapisu „kto na kogo głosował", w jakiejkolwiek formie” | `prd.md:180`, `AGENTS.md:7` | E |
| Dzwonek | bell, `{ seq }`, „kanał-dzwonek”, „tablica” (stan) | event (techniczny, nazwany w dokumentach) | „publiczny kanał Supabase Realtime niesie tylko sygnał „coś się zmieniło” (dzwonek), a stan przeglądarka pobiera z serwera” | `roadmap.md:86`, `context/archive/2026-09-27-live-sync-spike/plan-brief.md:8` | E |
| Sprzątanie gier | „hourly pg_cron sweep”, `close_stale_games`, „nocne sprzątanie” | event | „an hourly pg_cron sweep that closes games started more than 12 h ago” | `AGENTS.md:7`, `full-game-evening/research.md:127` | E |

### Pytania

| term | warianty | kind | definicja (cytat) | źródła | Etyk. |
|---|---|---|---|---|---|
| Pytanie | question, pytania, „Kto z nas najprawdopodobniej…” | entity | „Na ekranie pytanie brzmi: „Kto z nas najprawdopodobniej {tekst}?”.” ; „Identyfikator pytania \| `<kategoria>-<NNN>`, niezmienny i nigdy nieużywany ponownie” | `starter-question-base/question-review.md:5`, `starter-question-base/plan-brief.md:29` | E |
| Kategoria | category, kategorie, `CATEGORIES` | value | „Na co dzień, Imprezy, Przyszłość, Wpadki i obciach, Gry i internet, Podróże i przygody, Sport i wyzwania, Praca i szkoła” | `starter-question-base/plan-brief.md:22`, `prd.md:94` | E |
| Pytania 18+ | 18+ flag, `adult`, „18+ osobno w każdej” | value (znacznik) | „every question carries an 18+ flag, and the host decides per chosen category whether its 18+ questions are included.” | `prd.md:96`, `roadmap.md:46` | E |
| Wspólna baza pytań | shared base, „baza”, „baza startowa”, „Baza startowa pytań” | entity | „wspólna baza pytań z kategoriami, kuratorowana przez twórcę gry; z niej losowana jest lista pytań na daną grę.” | `prd.md:112`, `roadmap.md:100` (F-02) | E |
| Lista pytań gry | „game's question list”, „drawn question list”, „lista pytań na daną grę” | entity | „Lista należy do tej jednej gry — host nie ma trwałej puli własnej w panelu.” | `prd.md:112`, `prd.md:114` (FR-012) | E |
| Pula | pool, „pula pytań”, „Model puli”, „po wyczerpaniu puli” | entity / value | wiele znaczeń — patrz M-04 | `prd.md:112`, `prd.md:83`, `full-game-evening/research.md:112` | E |
| Przegląd listy pytań | review, „start now” | operation | „Host can optionally review the drawn question list before starting the game (remove questions, draw more from the base, edit wording, add own questions); the default path is "start now" without reviewing” | `prd.md:114` (FR-012), `roadmap.md:51` (S-06 `proposed`) | E |
| Propozycja pytania | proposal, „propozycje gości”, „proposed questions” | entity | „Guest can propose questions from the room link during the evening, up to a per-guest limit per game (number to be set).” | `prd.md:116` (FR-013), `prd.md:118` (FR-014), `roadmap.md:55` (S-10 `proposed`) | E |
| Własne pytania hosta | „host's own additions or edits”, „pytania dopisane przez hosta” | entity | „pytania dopisane przez hosta żyją w tej grze, a potem trafiają do weryfikacji twórcy” | `prd.md:159`, `prd.md:130` | E |
| Weryfikacja nowych pytań | „review”, „set aside for review”, „na warsztat” | operation | „in v1 the app sets new questions aside for review and the creator adds them to the base the same way the starting base is built (outside the UI); the in-app panel is v2.” | `prd.md:131` (FR-021), `prd.md:154` | E |
| Status pytania w przeglądzie | `propozycja`, `fajne`, `do poprawy`, `usunięte` | state | „Statusy: `propozycja` (czeka na ocenę), `fajne`, `do poprawy` (nowa wersja trafia do nowego wiersza), `usunięte`.” | `starter-question-base/question-review.md:6` | E |
| Dobór pytań uczący się | „learning question selection”, „Reguła pomocnicza”, losowanie | policy | „Kolejne pytanie pochodzi z kategorii wybranych przez hosta, nie powtarza się w tej grze ani z ostatnich wieczorów tej ekipy, a częściej padają pytania, które dobrze zagrały u wszystkich ekip” | `prd.md:154`, `prd.md:120` (FR-015), `prd.md:124` (FR-017) | E |
| Wynik jakości | quality score, „jakość pytania” | measure | „Question selection prefers questions with a higher quality score computed from play data of all crews” | `prd.md:124`, `prd.md:200` (Open Q6) | E |
| Dane o rozgrywce | play data, „per-question play data”, „zbiorcze dane o pytaniach”, „anonymous per-question aggregates” | measure | „vote distribution (how concentrated), skips, post-round reactions, and removals from a game list by a host before start” | `prd.md:122` (FR-016), `prd.md:128`, `roadmap.md:242` | E |
| Reakcja | reaction, „kciuk w górę lub w dół”, „thumb up / down” | event | „Player can react to the question (thumb up / down) with a single tap on the reveal screen” | `prd.md:126` (FR-018) | E |
| Próg „za mało zagrań” | play-count threshold | measure | „a question with too few plays to be judged is drawn as neutral (or slightly favoured) until it has enough plays” | `prd.md:124`, `prd.md:200` | E (wartość: U) |

### Pozostałe operacje i dodatki

| term | warianty | kind | definicja (cytat) | źródła | Etyk. |
|---|---|---|---|---|---|
| Usunięcie gracza | remove player, „nowy link” | operation | „Host or co-host can remove a player from the room; after removal the room gets a new link and the old one stops working.” | `prd.md:88` (FR-004), `roadmap.md:54` | E |
| Wpuszczanie spóźnionych | admit, „knock”, „prośba o wejście” | operation / event | „Resolution: amended — knock visible to both leaders everywhere; entry from the next round.” | `prd.md:91`, `roadmap.md:203` | E |
| Nadanie / odebranie współhosta | grant / revoke | operation | „Host can grant and revoke the co-host role to a guest in the room.” | `prd.md:86`, `prd.md:173` | E |
| Zatwierdzanie propozycji | approve / reject | operation | „Host or co-host can approve or reject proposed questions; approved ones enter this game's question list.” | `prd.md:118` | E |
| Kasowanie gry | delete | operation | „deletion removes everything tied to nicks (players, votes, results), while anonymous per-question aggregates stay in the shared base” | `prd.md:128` | E |
| Powrót po odświeżeniu | rejoin, „reclaiming a nick”, „wraca na swój nick” | operation | „Player who refreshes the page or reconnects returns to their nick and the current round state, including a vote already cast; reclaiming a nick requires verification that it is the same person.” | `prd.md:105` (FR-011), `roadmap.md:153` (S-04 `proposed`) | E |
| Nowa gra | „Nowa gra”, `create_room`, „zakładanie gry” | operation | „Druga „Nowa gra” zamyka stary pokój, a jego link mówi, że gra jest zamknięta.” | `room-lobby/plan-brief.md:22`, `README.md:162` | E |
| Logowanie jednym kliknięciem | „one click”, Discord, Google | operation | „Host can sign in with one click via an external provider, without registration or password” ; „Discord (główny) + Google (zapasowy)” | `prd.md:82`, `one-click-host-login/plan-brief.md:22` | E |
| Podsumowanie wieczoru | end-of-evening summary | entity (nice-to-have) | „highlights such as "most voted tonight" and "nobody voted for X tonight"; no points and no ranking across evenings” | `prd.md:134` (FR-022), `roadmap.md:324` (Parked) | E |
| Emotka / gif | emoji or gif reaction | event (nice-to-have) | „Player can send an emoji or gif reaction visible to the room during the evening” | `prd.md:135` (FR-023), `roadmap.md:325` | E |
| Nick przypięty w przeglądarce | „browser-pinned nick” | value (v2) | „nick „przypięty" w przeglądarce, żeby ten sam telefon proponował ten sam nick następnym razem” | `prd.md:163` | E |
| Zgłoszenie z przeglądarki | „czarna skrzynka”, client events | event (operacyjny) | „Ekran sam widocznie obsługuje awarię (...) Do tego `POST` z polami wyłącznie z listy (zdarzenie, stan, id pokoju)” | `first-live-round/research.md:317-318` | E |

### Tezy i miary produktu

| term | warianty | kind | definicja (cytat) | źródła | Etyk. |
|---|---|---|---|---|---|
| Runda na żywo (reguła główna) | live round | thesis | „tak żeby rozmowa o wyniku działa się od razu na Discordzie, a nie tydzień później po zebraniu ankiet” | `prd.md:150`, `roadmap.md:27` | E |
| Hipoteza hosta | insight hypothesis | thesis | „to, czego brakuje, to wspólna runda na żywo (...), pula pytań z kategoriami i własnymi pytaniami ekipy, która zostaje między wieczorami, oraz dobór pytań uczący się z rozgrywki” | `prd.md:24`, `roadmap.md:34` | E |
| Gwiazda przewodnia | north star | thesis | „najmniejszy element od początku do końca, którego działanie potwierdza hipotezę gry” (S-02) | `roadmap.md:38` | E |
| Dotychczasowa forma | Google Forms, ankieta | thesis | „kumpel wysyła link do ankiety, każdy wypełnia ją w swoim czasie, po tygodniu ekipa zbiera się i czyta odpowiedzi” | `prd.md:22`, `prd.md:152` | E |
| Kryteria sukcesu | „< 5 minut”, „co najmniej 10 pytań”, „< 30 sekund” | measure | „Host zakłada grę (...) w mniej niż 5 minut.” ; „Ekipa rozgrywa co najmniej 10 pytań w jednym wieczorze bez awarii” ; „Gość dołącza w mniej niż 30 sekund bez instrukcji.” | `prd.md:37-38`, `prd.md:47` | E |
| NFR czasu i skali | „2 s”, „10 s”, „20 graczy”, „około stu użytkowników” | measure | „odsłona pojawia się u każdego gracza w pokoju w ciągu 2 s od ostatniego głosu albo przewinięcia przez prowadzącego” ; „Pokój z 20 graczami głosującymi równocześnie zachowuje się tak samo jak pokój z 3 graczami (brak limitu graczy; 20 to poziom, na którym to sprawdzamy).” | `prd.md:139`, `prd.md:141-142`, `prd.md:191` | E |

## Lifecycles

### L-01 Gra / pokój

- **Utworzenie → `lobby`** — host, zalogowany: „Host can create a room, choose question categories (...) and get a shareable room link” (`prd.md:94`); „Zalogowany host na `/` zakłada grę i trafia na `/r/<id>` z linkiem `/j/<kod>`” (`room-lobby/plan-brief.md:19`). Warunek: „Kategorie \| Wszystkie zaznaczone, 18+ wyłączone, minimum jedna” (`room-lobby/plan-brief.md:32`). Skutek uboczny: „Creates a room (signed-in host only) and closes the host's previous one; asks first (`confirm_close=1`) when that room has guests” (`README.md:162`). E
- **Dołączanie gości (w `lobby`)** — gość przez link: „Adds a guest to a room in the lobby” (`README.md:163`). E
- **`lobby` → `playing` (start)** — host (PRD: także współhost, `prd.md:97`): „`start_game` (host): `lobby` → `playing`, runda 1, uprawnieni = gracze w pokoju, co najmniej 3” (`full-game-evening/research.md:57`, opis kodu); PRD: „co najmniej 2 gości dołączyło nickiem” (`prd.md:69`). E
- **`playing` → `closed`** — trzy drogi: (a) „Zakończ grę” z potwierdzeniem (`full-game-evening/research.md:147`); (b) „Nowa gra” hosta zamyka poprzedni pokój (`README.md:162`); (c) „an hourly pg_cron sweep that closes games started more than 12 h ago” (`AGENTS.md:7`). `lobby` → `closed` przez „Nowa gra” (`room-lobby/plan-brief.md:22`). E
- **Stan końcowy:** „Z `closed` nic nie wychodzi.” (`full-game-evening/research.md:54`). E
- **Brakujące przejścia (opisane w PRD, niezbudowane według roadmapy):** zmiana linku po usunięciu gracza (FR-004, `prd.md:88`; S-09 `proposed`, `roadmap.md:54`); wpuszczenie spóźnionego do `playing` (FR-020, `prd.md:90`; S-08 `proposed`); skasowanie gry przez hosta (FR-019, `prd.md:128`; S-13 `proposed`). Dziś spóźniony „gets `game_started`” (`README.md:194`). E
- **Nierozstrzygnięte:** czy skasowanie (FR-019) dotyczy tylko `closed`, czy też otwartej gry — dokumenty milczą. U

### L-02 Runda

- **Otwarcie (`voting`)** — przy starcie (runda 1) i przy „Następne pytanie” / „Pomiń pytanie”: „Worker przy każdym „Następne pytanie” i „Pomiń” podaje pulę w losowej kolejności, baza bierze pierwsze niezagrane” (`full-game-evening/research.md:144`). E
- **`voting` → `revealed`** — automatycznie po ostatnim głosie uprawnionych („automatyczna odsłona, gdy liczba głosujących = liczba uprawnionych”, `first-live-round/plan.md:314`) albo przez prowadzącego w dowolnej chwili, bez progu („D3: **bez progu** (...) Odsłona zawsze pokazuje liczby”, `first-live-round/research.md:282`). E
- **`voting` → `skipped`** — prowadzący, „tylko w trakcie głosowania, z drugim kliknięciem, od razu następne pytanie” (`full-game-evening/research.md:145`); „pominięta runda zostaje jako wiersz `skipped` bez liczb” (`:146`). E
- **`revealed` → (następna runda)** — „Po odsłonie host widzi „Następne pytanie” i „Zakończ grę”” (`full-game-evening/research.md:124`). E
- **Koniec rundy przez koniec gry** — „Zakończ grę” w trakcie głosowania i po odsłonie (`full-game-evening/research.md:124`); „ostatni wynik znika z ekranów przy końcu” (`:126`). E
- **Wyczerpanie pytań** — „„ostatnie pytanie” to wyczerpana pula (19–216 pytań), więc w praktyce wieczór kończy host. Gdy pula się wyczerpie, „Następne pytanie” odpowiada `no_questions”` (`full-game-evening/research.md:112`). E
- **Brakujące:** reakcje po odsłonie (FR-018, S-11 `proposed`); wpływ usuniętego w trakcie rundy gracza na głosy — „Votes on/by a removed player mid-round: rule not decided” (`prd.md:89`, Open Q3 `prd.md:197`). U

### L-03 Głos (i urna)

- **Oddanie** — każdy uprawniony gracz, raz: „Głosowanie. Każdy gracz, także host, wybiera osobę albo „Wstrzymuję się” i potwierdza „Zagłosuj”. Głosu nie da się zmienić (D2).” (`first-live-round/plan.md:37`). Warunek: runda w `voting` i numer zgodny z bieżącym („inny numer to odmowa `round_over`”, `full-game-evening/plan-brief.md:27`). E
- **W toku** — w urnie, bez pary: „W trakcie rundy tylko „kto zagłosował” i liczniki, w tabelach nielogowanych w `private`.” (`first-live-round/research.md:288`). E
- **Przy odsłonie** — „Przy odsłonie zapisujemy wyłącznie liczby na osobę, a stan w toku kasujemy.” (`first-live-round/research.md:288`). E
- **Przy pominięciu / końcu / porzuceniu / sprzątaniu** — urna usuwana bez zapisu liczb (`full-game-evening/plan-brief.md:24`, `:25`; `AGENTS.md:7`; `first-live-round/plan-brief.md:26`). E
- **Po odświeżeniu** — PRD wymaga, by gracz widział „swój oddany głos” (`prd.md:75`); stan dziś według analizy: ekran wie, że gracz zagłosował, „ale **nie wie, na kogo**” (`guest-vote-flow-analysis/research.md:42-43`). Sprzeczność otwarta (C-08). E
- **Brakujące:** zmiana głosu — świadomie wykluczona (D2, `first-live-round/research.md:278`, `:301-302`).

### L-04 Gracz (gość)

- **Wejście** — link → nick → w pokoju: „Gość otwiera link na telefonie, wpisuje nick, jest w pokoju.” (`prd.md:59`). Warunek: pokój w `lobby`, nick wolny (`README.md:163`, `prd.md:84`). Samo otwarcie linku nie tworzy gracza: „A GET changes nothing” (`README.md:159`). E
- **Powrót** — przez ciasteczko 24 h (`room-lobby/plan-brief.md:34`); po utracie ciasteczka „Odzyskania miejsca w kodzie nie ma.” (`guest-vote-flow-analysis/research.md:172-173`, analiza kodu). PRD wymaga weryfikacji tożsamości przy odzyskaniu nicku (`prd.md:105`), mechanizm „downstream choice” (`prd.md:106`). E / U (mechanizm)
- **Brakujące:** nadanie/odebranie współhosta (FR-003), usunięcie (FR-004), prośba spóźnionego i wpuszczenie (FR-020), kasowanie danych gracza przy skasowaniu gry (FR-019). Wszystkie `proposed` w `roadmap.md:52-58`. E

### L-05 Pytanie i propozycja

- **Pytanie w bazie (F-02):** `propozycja` → `fajne` / `do poprawy` (nowa wersja w nowym wierszu) / `usunięte`; do pliku gry trafiają „wyłącznie wiersze ze statusem `fajne`” (`starter-question-base/question-review.md:3`, `:6`). Id niezmienne i niewracające (`starter-question-base/plan-brief.md:29`). E
- **Wycofanie z doboru:** „a question that keeps being skipped, removed, or voted nonsensically stops being drawn and is set aside for the game creator to rework” (`prd.md:124`); progi nieustalone (`prd.md:200`). E / U (progi)
- **Propozycja gościa:** zgłoszona (do limitu, `prd.md:116`) → zatwierdzona lub odrzucona przez host/współhost (`prd.md:118`) → w liście tej gry → po grze do weryfikacji twórcy (`shape-notes.md:48`; `prd.md:130`) → do bazy pod kategorią albo odrzucona (`prd.md:130`). Niezbudowane: S-10 `proposed`. „Gdzie czekają zatwierdzone propozycje na przegląd twórcy gry, skoro w v1 odbywa się on poza aplikacją” — otwarte (`roadmap.md:236`). E / U

## Rules

ID tylko lokalne dla tego pliku. „Zakres”: *policy* = reguła produktu, *entity* = jednego bytu. Bez oceny egzekwowania.

| ID | Reguła (cytat) | Wiąże | Zakres | Źródło | Etyk. |
|---|---|---|---|---|---|
| R-01 | „Żadnej odsłony ani zapisu „kto na kogo głosował", w jakiejkolwiek formie — trwała zasada gry, nie „na później"; aplikacja nie ma zbierać, że gość X głosował na gościa Y, ani razu, ani 200 razy.” | głos, odsłona, gracz | policy | `prd.md:180`; `AGENTS.md:7` („Never persist, log or return a pairing of voter and voted-for player, in any form.”); `roadmap.md:312` | E |
| R-02 | „„kto na kogo głosował" nigdy nie jest pokazywane ani możliwe do odzyskania, także przez hosta i twórcę gry. Gwarancja dotyczy stanu po rundzie, logów i każdej roli w grze” + przyjęte granice (twórca na żywo ≤ ok. 13 h; szersze logowanie; 1 głos lub jednomyślność) | głos, twórca gry, host | policy | `prd.md:143` | E |
| R-03 | „The in-progress state of a round lives only in unlogged `private` tables with no grants and is deleted at the reveal and whenever the round ends otherwise” | runda, urna | entity (runda) | `AGENTS.md:7`; `first-live-round/plan-brief.md:18` | E |
| R-04 | „W trakcie rundy widać, kto już zagłosował, ale nigdy na kogo” ; „w trakcie rundy tylko „kto już zagłosował”, liczby dopiero przy odsłonie” | runda, głos, odsłona | entity (runda) | `prd.md:77`; `live-sync-spike/measurements.md:107` | E |
| R-05 | „Dzwonek może nadać każdy, kto zna nazwę kanału, więc stan pochodzi wyłącznie z bazy, nigdy z treści dzwonka.” ; „Kanał niesie tylko dzwonek `{ seq }`” | dzwonek, stan pokoju | policy | `roadmap.md:86`; `context/foundation/infrastructure.md:189` | E |
| R-06 | „Do not add points, leaderboards or round timers; they are PRD Non-Goals.” ; „Bez punktów i rankingu między wieczorami” | gra, runda | policy | `AGENTS.md:8`; `prd.md:181`; `prd.md:108` (FR-010 usunięte) | E |
| R-07 | „Przy 3 graczach odsłona następuje natychmiast po trzecim głosie; nie ma timera” | runda, odsłona | entity (runda) | `prd.md:76`; `prd.md:100` | E |
| R-08 | „Player can vote for exactly one person from the nick list (including themselves) or abstain.” | głos, gracz, nick | entity (głos) | `prd.md:101`; `prd.md:152` | E |
| R-09 | „D2: głos ostateczny.” ; „Zmiana głosu wymagałaby zapamiętania pary.” | głos | entity (głos) | `first-live-round/research.md:278`, `:302` | E |
| R-10 | „reveal happens when everyone has voted or whenever host or co-host advances the round (players who did not vote simply do not vote)” ; bez progu liczby głosów | odsłona, prowadzący | entity (runda) | `prd.md:103`; `first-live-round/research.md:282` | E |
| R-11 | „Pytanie pochodzi tylko z wybranych kategorii (pytania 18+ tylko z tych, w których host je dołączył) i nie powtórzyło się w tej sesji” | pytanie, kategoria, 18+, gra | entity (gra) | `prd.md:74`; `prd.md:120` | E |
| R-12 | „without questions played on the host's recent evenings” / „ani z ostatnich wieczorów tej ekipy” | dobór, host / ekipa | policy | `prd.md:120`; `prd.md:154` — patrz C-11 | E |
| R-13 | „a skipped question discards its votes without points and does not count toward question quality” ; pominięcie „tylko w trakcie głosowania” ; „głosy pominiętej rundy przepadają całkowicie” | pominięcie, głos, wynik jakości | entity (runda) | `prd.md:97`; `full-game-evening/research.md:145-146` | E |
| R-14 | „ending the game requires a confirmation” ; „pominięcie ostatniego pytania nie zamyka gry samo” | zakończenie gry | entity (gra) | `prd.md:97`; `full-game-evening/research.md:116` | E |
| R-15 | „the room rejects a duplicate nick” ; „Nicks are case-sensitive ("Ola" and "ola" are two players), but invisible differences (extra spaces, zero-width characters) do not count.” ; „1–20 znaków” | nick, pokój | entity (pokój) | `prd.md:84`; `README.md:166`; `room-lobby/plan-brief.md:29` | E |
| R-16 | „reclaiming a nick requires verification that it is the same person” | nick, gracz | entity (gracz) | `prd.md:105` | E |
| R-17 | „Gracz, który odświeży stronę albo straci połączenie, jest z powrotem w bieżącej rundzie na swoim nicku w mniej niż 10 s, bez pomocy hosta.” | gracz, runda | policy (NFR) | `prd.md:142`; `prd.md:46` | E |
| R-18 | „after removal the room gets a new link and the old one stops working” | usunięcie gracza, link | entity (pokój) | `prd.md:88` | E |
| R-19 | „once admitted, the latecomer sees the current round and votes from the next one” | spóźniony, runda | entity (gracz) | `prd.md:90` | E |
| R-20 | Uprawnienia ról — tabela możliwości: m.in. „nadanie / odebranie roli współhosta \| – \| ✓ \| – \| –” ; współhost „Nie ma dostępu do panelu hosta.” | host, współhost, gość, twórca gry | policy | `prd.md:165-175`; `prd.md:160` | E |
| R-21 | „approvals land only in this game's list, nothing permanent; the shared base is gated separately by the game creator” | propozycja, lista pytań, wspólna baza | policy | `prd.md:87`; `prd.md:118` | E |
| R-22 | „up to a per-guest limit per game (number to be set)” | propozycja, gość | entity (gra) | `prd.md:116`; Open Q4 `prd.md:198` („około 3”) | E (liczba: U) |
| R-23 | „the reaction is optional and never blocks the host from advancing” | reakcja | entity (runda) | `prd.md:126` | E |
| R-24 | „deletion removes everything tied to nicks (players, votes, results), while anonymous per-question aggregates stay in the shared base” ; „Dane o pytaniu muszą być wyłącznie zbiorcze (rozkład głosów, nigdy „kto na kogo”)” | kasowanie gry, dane o rozgrywce | policy | `prd.md:128`; `roadmap.md:249` | E |
| R-25 | „O gościu nie zostaje nic poza nickiem i głosami; host może skasować historię.” ; „O hoście aplikacja przechowuje wyłącznie adres e-mail z logowania” | gość, host | policy | `prd.md:48`; `prd.md:143-144` | E |
| R-26 | „Lista należy do tej jednej gry — host nie ma trwałej puli własnej w panelu.” | lista pytań, host | policy | `prd.md:112` | E |
| R-27 | „jedna osoba (twórca gry) weryfikuje pytania; żadnych ról moderatorów, zgłoszeń, banów” | twórca gry, pytanie | policy | `prd.md:185` | E |
| R-28 | „Niezalogowany na trasie hosta (panel, tworzenie pokoju) → przekierowanie do logowania. Link do pokoju działa bez logowania.” | host, link | policy | `prd.md:162` | E |
| R-29 | „A host can have one open room at a time.” ; „Najwyżej jeden otwarty; „Nowa gra” zamyka stary, przy gościach pyta” | host, pokój | entity (host) | `README.md:166`; `room-lobby/plan-brief.md:31` | E |
| R-30 | „A GET changes nothing, because Discord fetches the link for its preview” ; „samo otwarcie linku (podgląd Discorda) nie tworzy gracza ani ciasteczka” | link, gracz | entity (link) | `README.md:159`; `context/foundation/test-plan.md:67` | E |
| R-31 | „host nie otworzy zamkniętego pokoju, nie wybierze kodu linku, nie zapisze sobie nicku z pominięciem reguły nicku, nie dotknie cudzego pokoju; gość nie zadziała w cudzym pokoju ani jako inny gracz” | host, gość, pokój, link | policy | `test-plan.md:65` | E |
| R-32 | „Pytania importujemy tylko w kodzie serwera. Do przeglądarki trafia tylko to, co dana osoba ma teraz zobaczyć” | pytanie | policy | `context/foundation/lessons.md:16` | E |
| R-33 | „Identyfikator pytania \| `<kategoria>-<NNN>`, niezmienny i nigdy nieużywany ponownie” ; „Tylko końcówka po „Kto z nas najprawdopodobniej”, max 90 znaków” | pytanie | entity (pytanie) | `starter-question-base/plan-brief.md:29`, `:26` | E |
| R-34 | „Bez wersji angielskiej w v1 — gra i baza pytań są po polsku” | gra, pytanie | policy | `prd.md:187` | E |
| R-35 | „Głos i akcje hosta niosą numer pytania, więc nic nie trafia do pytania, którego ktoś nie widział.” | głos, prowadzący, runda | entity (runda) | `full-game-evening/plan-brief.md:16` | E |
| R-36 | Logi: „nigdy argumenty RPC, nick, token gracza, kod linku ani `request.url`; od S-02 nigdy nic, co łączy głosującego z celem głosu” ; „log it through `logEvent` (...: allowed fields only, never an error message or player data)” | logi, nick, głos | policy | `context/audits/observability/2026-10-11_guest-join-live-lobby.md:120`; `AGENTS.md:20` | E |
| R-37 | „czyli mechaniczna osłona zasady „głos nigdzie się nie zapisuje”” (w przeglądarce) | głos | policy | `context/changes/refactor-opportunities/plan-brief.md:10-11` | E |
| R-38 | „Keep "Confirm email" ON (...) it reopens account takeover through OAuth.” | tożsamość hosta | policy | `AGENTS.md:14`; `README.md:140` | E |
| R-39 | Start wymaga min. 3 graczy: „Host z co najmniej 2 gośćmi (min. 3 graczy, `prd.md:69, 76`)” | start, gracz | entity (gra) | `first-live-round/plan.md:36`; `prd.md:69` | E (plan) / I (PRD mówi tylko o warunku US-01) |
| R-40 | „a question with too few plays to be judged is drawn as neutral (or slightly favoured) until it has enough plays” | dobór, pytanie | policy | `prd.md:124`; `prd.md:154` („Nowe pytanie dostaje szansę, zanim zostanie ocenione.”) | E |

## Multiple meanings

| ID | Słowo | Znaczenie A (cytat) | Znaczenie B (cytat) | Wniosek | Etyk. |
|---|---|---|---|---|---|
| M-01 | **gra / pokój / wieczór / sesja** | „Host zakłada grę (logowanie → kategorie → link)” (`prd.md:37`); „Host can create a room” (`prd.md:94`) | „Następne pytanie. Po ostatnim: koniec wieczoru” (`prd.md:63`); „nie powtórzyło się w tej sesji” (`prd.md:74`); „Koniec gry \| Stan `closed`” — koniec gry = stan pokoju (`full-game-evening/plan-brief.md:25`) | Cztery słowa na jeden byt w praktyce; żaden dokument nie mówi, czy gra i pokój to to samo. „Wieczór” bywa też wieczorem ekipy niezależnie od gry („ostatnich wieczorów tej ekipy”, `prd.md:154`). | I |
| M-02 | **gra** (produkt vs instancja) | produkt: „zagrać w „Kto z nas najprawdopodobniej…"” (`prd.md:22`), „Twórca gry” (`prd.md:158`), „Bez innych mini-gier — jedna gra” (`prd.md:183`) | instancja: „lista własnych gier” (`prd.md:174`), „Host jest właścicielem swoich gier” (`prd.md:159`) | „Twórca gry” = twórca produktu, nie gospodarz jednej gry (tym jest host). Łatwo pomylić. | I |
| M-03 | **pomijać / pominięcie** | gracz wstrzymuje się: „Każdy wskazuje osobę z listy nicków (albo pomija).” (`prd.md:61`); gość „Może głosować, pomijać, proponować pytania.” (`prd.md:161`); „głosowanie, pomijanie, propozycja pytania” dla wszystkich ról (`prd.md:170`) | prowadzący pomija rundę: „skip the current round” (`prd.md:97`), „start i pominięcie rundy” (`prd.md:160`); sygnał jakości: „skips” (`prd.md:122`), „Pytanie, które jest stale pomijane” (`prd.md:154`) | Ta sama rodzina słów na wstrzymanie się gracza (FR-008 „abstain”) i na pominięcie rundy przez prowadzącego (FR-006 „skip”). Granica: pominięcie pytania to sygnał jakości, wstrzymanie się nie (FR-016 wylicza „skips”, nie „abstains”). | E (cytaty), I (granica) |
| M-04 | **pula** | model całości: „Model puli: wspólna baza pytań (...); z niej losowana jest lista pytań na daną grę” (`prd.md:112`) | własna pula hosta (przed modelem puli): „locks the host out of their own pool” (`prd.md:83`), „the host's permanent pool” (`prd.md:87`); pozostali kandydaci jednej gry: „Gdy pula się wyczerpie, „Następne pytanie” odpowiada `no_questions`” (`full-game-evening/research.md:112`) | Trzy znaczenia; po S-03 „pula” w dokumentach technicznych to pytania z wybranych kategorii, których jeszcze nie zagrano w tej grze. | E |
| M-05 | **przewinąć / advance** | wymuszenie odsłony: „gdy wszyscy zagłosują (albo host przewinie), wszyscy widzą odsłonę” (`prd.md:71`), „whenever host or co-host advances the round” (`prd.md:103`); w UI „Odsłoń wynik” (`first-live-round/plan.md:38`) | przejście do następnego pytania po odsłonie: „the reaction is optional and never blocks the host from advancing” (`prd.md:126`) | „Advance” w FR-009 = odsłoń teraz, w FR-018 = następne pytanie. | I |
| M-06 | **wynik** | rezultat odsłony: „odsłania wynik w momencie, gdy zagłosuje ostatnia osoba” (`prd.md:150`); region „Wynik” (`AGENTS.md:50`) | ocena pytania: „z jakich sygnałów FR-016 liczy się wynik jakości” (`prd.md:200`) | Dwa różne pojęcia (liczby głosów w rundzie vs quality score pytania). | E |
| M-07 | **host** (persona vs gracz) | właściciel gier, konto e-mail (`prd.md:159`, `prd.md:144`) | gracz z nickiem, który głosuje: „Host głosuje i jest graczem powiązanym z kontem od początku.” (`room-lobby/plan-brief.md:30`) | PRD rozróżnia „host” i „gość”, ale nie mówi wprost, że host jest graczem; decyzja S-01 to dopowiada. | E |
| M-08 | **`closed` / „Koniec wieczoru”** | koniec gry przez „Zakończ grę” (`full-game-evening/research.md:147`) | „„Koniec wieczoru” zobaczą też goście pokoju zamkniętego przez „Nową grę” hosta i przez nocne sprzątanie” (`full-game-evening/research.md:127`) | Jeden stan i jeden ekran dla trzech przyczyn zamknięcia (świadomie przyjęte). | E |
| M-09 | **twórca gry** (kurator vs właściciel bazy) | kurator bazy pytań (`prd.md:158`) | właściciel bazy danych, który może ją podglądać: „the game's creator watching the database live” (`AGENTS.md:7`); „To baza twórcy, jak komisja stojąca nad urną” (`first-live-round/plan-brief.md:25`) | Ta sama osoba w dwóch rolach: biznesowej (kuracja) i operatorskiej (dostęp do bazy). Granica anonimowości wiąże się z drugą. | I |
| M-10 | **sesja** | gra: „nie powtórzyło się w tej sesji” (`prd.md:74`); „Każda sesja zbiera dane o pytaniach” (`shape-notes.md:63`) | czas życia tożsamości gościa: „Tożsamość żyje w tej sesji.” (`prd.md:161`), konkretnie ciasteczko 24 h (`room-lobby/plan-brief.md:34`) | Dwa znaczenia; drugie ma inny czas życia niż gra (24 h vs do `closed` lub 12 h). | I |
| M-11 | **link** (link pokoju vs pokój) | „get a shareable room link” (`prd.md:94`), „after removal the room gets a new link” (`prd.md:88`) | „Link \| `/j/<22 znaki>` osobno od `/r/<uuid>` (...) S-09 wymieni link bez zmiany pokoju.” (`room-lobby/plan-brief.md:41`) | Link ma własną tożsamość, krótszą niż pokój. | E |

## Conflicting statements

Nowsze = według daty w dokumencie lub kolejności folderów. Synteza ma porównywać kod z nowszym.

| ID | Starsze | Nowsze | Uwagi | Etyk. |
|---|---|---|---|---|
| C-01 | Timer: „po zebraniu głosów lub upływie czasu następuje odsłona” (`shape-notes.md:61`, seed 2026-09-19); „Po zebraniu głosów lub upływie czasu: odsłona” (`shape-notes.md:137`, sekcja „MVP flow (v1, locked)”) | „no round timer; reveal when all voted or host/co-host advances at will” (`shape-notes.md:37-38`); „Po zebraniu głosów albo gdy prowadzący przewinie” (`prd.md:62`, 2026-09-20); „nie ma timera” (`prd.md:76`); `AGENTS.md:8` | `shape-notes.md:137` jest sprzeczne nawet z frontmatterem tego samego pliku. Obowiązuje: bez timera. | E |
| C-02 | Punkty: „odsłona (kto ile głosów dostał), punkty, następne pytanie” (`shape-notes.md:61`); „z odsłoną, punktami i rozmową” (`shape-notes.md:75`) | „FR-010: *removed 2026-09-19 — no scoring*” (`shape-notes.md:170`); „z odsłoną i rozmową” (`prd.md:22`); `prd.md:181` | Obowiązuje: bez punktów. | E |
| C-03 | Własna pula hosta: „Host dodaje własne pytania w panelu” (`shape-notes.md:63`); „host zarządza pokojem, pulą i historią” (`shape-notes.md:65`); ślad w FR-001: „locks the host out of their own pool” (`prd.md:83`) | „question pool model (Open Question 4, resolved 2026-09-20)” (`shape-notes.md:47-48`); „host nie ma trwałej puli własnej w panelu” (`prd.md:112`) | `prd.md:83` zachował stare sformułowanie w kontrargumencie. | E |
| C-04 | Dane o pytaniu z „czas do głosu” (`shape-notes.md:63`) | „time to vote dropped from v1” (`prd.md:123`) | — | E |
| C-05 | FR-005 bez 18+ (`shape-notes.md:160`); AC bez 18+ (`shape-notes.md:210`) | „Amendment 2026-09-27 (F-02 planning, game creator's decision): every question carries an 18+ flag” (`prd.md:96`); AC z 18+ (`prd.md:74`) | — | E |
| C-06 | NFR anonimowości bez wyjątków (`shape-notes.md:229`) | z przyjętymi granicami: „świadomie przyjęte (decyzje 2026-10-13 i 2026-10-14)” (`prd.md:143`); D1, D3 (`first-live-round/research.md:277`, `:282`); `AGENTS.md:7` | Obowiązuje wersja PRD z granicami. | E |
| C-07 | Budżet odsłony: „w ciągu 2 s od ostatniego głosu” (`prd.md:139`) | kryterium F-01: „95% w 2 s, max 5 s (...) luźniej niż `prd.md:139`, więc zapisane świadomie” (`live-sync-spike/plan-brief.md:29`); `roadmap.md:44`; ale „Spełniona jest nawet dosłowna wersja z `prd.md:139` (...) Czy zaostrzyć kryterium, rozstrzyga S-02.” (`live-sync-spike/measurements.md:98`) | Nowsze dokumenty nie mówią, czy S-02 zaostrzyło kryterium; pomiar 2 s to faza 3 planu testów, „not started” (`test-plan.md:80`). | E / U (rozstrzygnięcie) |
| C-08 | FR-011 i US-01 AC: powrót „including a vote already cast” (`prd.md:105`), „widzi bieżące pytanie i swój oddany głos” (`prd.md:75`) | „Never persist, log or return a pairing of voter and voted-for player, in any form.” (`AGENTS.md:7`); „głos nigdzie się nie zapisuje” (`refactor-opportunities/plan-brief.md:10-11`); roadmapa sama to nazywa: „Przywracanie głosu ściera się z zasadą, że „kto na kogo” nigdy nie jest do odzyskania” (`roadmap.md:161`) | Nierozstrzygnięte; „Rozstrzyga plan S-04 i właściciel produktu” (`guest-vote-flow-analysis/research.md:334-336`). | E |
| C-09 | „Host can sign in with one click (...) without registration or password” (`prd.md:82`); „Host — loguje się bez rejestracji i hasła” (`prd.md:159`) | „Logowanie hasłem \| Zostaje dla istniejących kont; rejestracja znika” (`one-click-host-login/plan-brief.md:24`, decyzja 2026-10-06); „Sign-in with Discord, Google or email and password” (`README.md:148`); rejestracja w Parked (`roadmap.md:328`) | PRD nie ma poprawki do FR-001 (sprawdzone `prd.md:82-83`). FR-001 mówi „can”, więc to raczej rozszerzenie niż sprzeczność; `prd.md:159` brzmi kategorycznie. | E / I |
| C-10 | „Bez czatu głosowego i tekstowego w aplikacji” (`prd.md:186`) | „Karol 2026-10-15 zmienił zdanie: wcześniej „bez czatu tekstowego”” (`roadmap.md:319`, Parked) | Nowsza zmiana zdania jest odłożona; roadmapa wymaga najpierw zmiany PRD. Obowiązuje PRD. | E |
| C-11 | (ten sam dokument) FR-015: „without questions played on the host's recent evenings” (`prd.md:120`); S-12: „z ostatnich wieczorów tego hosta” (`roadmap.md:254`) | Business Logic: „ani z ostatnich wieczorów tej ekipy” (`prd.md:154`); Open Q5: „których ta ekipa jeszcze nie grała” (`prd.md:199`) | Host czy ekipa — nierozstrzygnięte; „ekipa” nie ma tożsamości w dokumentach. Niezbudowane (S-12 `proposed`). | E / U |
| C-12 | Koniec po ostatnim pytaniu: „Po ostatnim: koniec wieczoru” (`prd.md:63`); S-03: „po ostatnim pytaniu ekipa widzi koniec wieczoru bez punktacji” (`roadmap.md:141`) | „„ostatnie pytanie” to wyczerpana pula (...), więc w praktyce wieczór kończy host” (`full-game-evening/research.md:112`); „przy wyczerpanej puli „Pytania się skończyły” + „Zakończ grę”, bez samoczynnego końca” (`:145`, decyzja 2026-10-15) | Obowiązuje: koniec tylko przez „Zakończ grę”. | E |
| C-13 | Pominięcie: „skip the current round” bez ograniczenia fazy (`prd.md:97`) | „„Pomiń pytanie” tylko w trakcie głosowania” (`full-game-evening/research.md:145`, 2026-10-15) | Zawężenie, nie odwrócenie. | E |
| C-14 | Po odsłonie S-02: „Wynik zostaje, host widzi „Kolejne pytania wkrótce” i „Nowa gra”” (`first-live-round/plan-brief.md:35`) | S-03: „Po odsłonie host widzi „Następne pytanie” i „Zakończ grę” zamiast „Kolejne pytania wkrótce” i „Nowa gra”” (`full-game-evening/research.md:124`) | Zastąpione. | E |
| C-15 | Uprawnienia współhosta w opisie roli: „start i pominięcie rundy, zatwierdzanie propozycji (...), wpuszczanie spóźnionych, usunięcie gracza” — bez kończenia gry (`prd.md:160`) | FR-006: „Host or co-host can start the game, skip the current round, and end the game” (`prd.md:97`); tabela: „start / pominięcie rundy, zakończenie gry \| – \| ✓ \| ✓ \| –” (`prd.md:169`) | Ten sam dokument; FR i tabela dają współhostowi koniec gry. | E |

## Unknowns

- U-01: Liczba propozycji na gościa (`prd.md:198`), progi i wagi jakości (`prd.md:200`), zachowanie po wyczerpaniu świeżych pytań (`prd.md:199`), głosy usuniętego gracza (`prd.md:197`) — otwarte pytania PRD, właściciel: host. E (otwarte)
- U-02: Mechanizm weryfikacji przy odzyskaniu nicku: „verification mechanism is a downstream choice” (`prd.md:106`); roadmapa pyta o pamięć głosu tylko na urządzeniu (`roadmap.md:160`). E (otwarte)
- U-03: Czy lista uprawnionych do głosu zmienia się między rundami (np. po wpuszczeniu spóźnionego, FR-020 „votes from the next one”, `prd.md:90`). Dokumenty mówią tylko o liście ustalanej „w chwili startu” (`first-live-round/plan.md:313`). Przeszukano: S-02 plan (grep „uprawnion”), S-03 research §1, D1–D5. U
- U-04: Czy guardrail „O gościu nie zostaje nic poza nickiem i głosami” (`prd.md:48`) obejmuje przechowywany skrót tokenu i `seat` (`README.md:166`; `room-lobby/plan-brief.md:39`, gdzie `seat` uzasadniono tym samym guardrailem) i co znaczy „głosami”, skoro po rundzie zostają tylko liczby (`first-live-round/research.md:288`). I/U
- U-05: Jak długo żyją zamknięte pokoje i gracze przed S-13: „nothing can close or delete a room or a guest until S-13” (`context/foundation/test-stack.md:29`) — przy czym gry zamyka już sprzątanie (`AGENTS.md:7`), więc „close” w test-stack jest nieaktualne albo dotyczy kasowania. I
- U-06: „ruch w czasie rzeczywistym” poza zakresem w seedzie (`shape-notes.md:67`) — nie wiem, czy to ruch fizyczny/gra akcji, czy „real-time” w sensie technicznym (wtedy sprzeczne z rundą na żywo). Nie wraca w PRD. U
- U-07: Czy usunięcie gracza (FR-004) wpływa na listę nicków w odsłonie i na dane o rozgrywce — brak w dokumentach poza Open Q3. U
- U-08: „Ekipa” jako byt (tożsamość, przynależność) — brak definicji w PRD, shape-notes, roadmapie i briefach (przeszukane: grep „ekip” w `prd.md`, `roadmap.md`, `shape-notes.md`). U

## Commands

- `Read` (Read tool): `agent-docs-language.md`, `0-sources.md`, `0-documents.md`, `prd.md`, `shape-notes.md`, `roadmap.md`
- `wc -l` i `find … | xargs wc -l` po dokumentach
- `cat -n` / `awk 'NR>=… && NR<=…'` / `sed -n` na wybranych zakresach (AGENTS, README, lessons, tech-stack, test-stack, test-plan, change.md, plan-briefy, research, follow-ups)
- `grep -n` (nagłówki, reguły, etykiety ekranu, „ostatnich wieczorów”, „Wynik”) w deploy-plan, infrastructure, audycie obserwowalności, test-plan, planach S-02/S-03
- pętla `for f in $(find context/archive context/changes -name "*.md")` z `grep -m1 '^# '` (tytuły wszystkich plików narracyjnych)
