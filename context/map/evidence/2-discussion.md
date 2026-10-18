# Evidence: discussion

Źródła: `gh` (CharlesOnTheWave/most-likely-to, repo publiczne, tylko odczyt) + git. Okno: cała historia, 2026-09-25 .. 2026-10-18 (HEAD 785f859). Limity nie zadziałały: PR 9 z 9, issues 0, przebiegi CI 88 (wszystkie od 2026-09-26), komentarze inline w PR 0, komentarze pod PR/issues 2. Atrybucja wyłącznie przez `.work/file-capability.tsv` / `commits.tsv` / `changes.tsv`; liczone tylko commity `counted=yes` (154). Jeden człowiek w oknie (`CharlesOnTheWave`, jedyny autor, dwie nazwy w git), więc każda koncentracja to linia bazowa, nie ustalenie (false-signals 6). Surowe dane: `context/map/.work/discussion-*`.

## Buzz per capability

PR przypisane przez git: commity z gałęzi każdego merge'a (`git log P1..P2`), potem ich capability; PR liczy się dla każdej capability, którą dotknął jego commit. „Fix” = typ `fix` albo temat z `fix|napraw|poprawk|follow-up|review fix` (13 commitów). „Reverty” to wyłącznie cofnięcia celowych commitów TEMP (patrz Friction), więc są mechaniczne. „Ustalenia F” = liczba nagłówków `F<n>` w `reviews/plan-review.md` + `reviews/impl-review.md` zmian tej capability.

| Capability | PR (git) | Commity w PR / wszystkie | Zamknięte bez merge | Przegląd człowieka | Reverty (mech.) | Fix (w tym przekrojowe n_caps>3) | Otwarte bugi | Plany (zmiany w `context/archive/`) | Proza planów (zmiany plików) | Ustalenia F (plan / impl) | Znaczniki długu |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| host-signin | 4 (#1, #2, #5, #6) | 6 / 12 | 0 | 0 | 0 | 3 (1) | 0 | 2: ui-signin-contract, one-click-host-login | 47 (+54 zrzuty) | 13 / 13 | 0 |
| room-lobby | 6 (#1, #3, #5, #7, #8, #9) | 23 / 24 | 0 | 0 | 1 | 4 (3) | 0 | 2: room-lobby, testing-lobby-foundation (dzielone) | 30 + 18 dzielone | 6 / 5 + 8 dzielone | 0 |
| guest-join | 5 (#1, #3, #5, #7, #8) | 17 / 17 | 0 | 0 | 3 | 2 (2) | 0 | 2 dzielone (jak wyżej) + audyt obserwowalności | dzielone z room-lobby + audyt 1 | dzielone | 0 |
| round | 3 (#7, #8, #9) | 19 / 19 | 0 | 0 | 3 | 2 (1) | 0 | 1: first-live-round | 29 | 7 / 7 | 0 (1 mech.) |
| game-evening | 3 (#7, #8, #9) | 14 / 14 | 0 | 0 | 3 | 1 (1) | 0 | 1: full-game-evening (+ sprzątanie pg_cron z first-live-round) | 24 | brak / 9 | 0 |
| question-pool | 3 (#7, #8, #9), tylko poboczne | 3 / 6 | 0 | 0 | 0 | 1 (0) | 0 | 1: starter-question-base | 20 | 4 / 8 (+ `question-review.md`) | 0 |
| live-sync | 5 (#1, #5, #7, #8, #9) | 10 / 16 | 0 | 0 | 0 | 2 (1) | 0 | 1: live-sync-spike + audyt | 33 | 6 / 7 | 0 |
| room-screen | 4 (#1, #7, #8, #9) | 16 / 16 | 0 | 0 | 2 | 2 (1) | 0 | 1: room-wide-layout | 20 | brak / 5 | 0 |
| event-log | 2 (#7, #8) | 3 / 3 | 0 | 0 | 0 | 0 | 0 | 0 własnych (audyt; powstał w first-live-round) | 1 (audyt) | — | 0 |
| shared (bucket) | 5 (#1, #3, #7, #8, #9) | 11 / 18 | 0 | 0 | 0 | 3 (2) | 0 | 0 własnych (`theme.md` w ui-signin-contract) | — | — | 0 |
| platform (bucket) | 8 (#1–#5, #7–#9) | 20 / 34 | 0 | 0 | 1 | 4 (3) | 0 | testing-lobby-foundation (runner), `context/changes/bootstrap-verification/` | dokumenty fundamentu (niżej) | dzielone | 0 |
| docs (proza) | 9 | 48 / 121 | — | — | 0 | — | — | — | 348 | — | 0 |

- `evidence`: 9 PR, 9 scalonych, 0 zamkniętych bez merge. 0 recenzji (`reviews` puste we wszystkich 9), 0 komentarzy inline (`pulls/comments` = 0), 2 komentarze pod PR, oba od `cloudflare-workers-and-pages[bot]` (typ `Bot`, PR #1 i #2, status buildu). **Rund przeglądu przez człowieka innego niż autor: zero.** Mediany czasu przeglądu nie mają sensu.
- `evidence`: 0 issues w historii repo (`gh issue list --state all` = `[]`, `open_issues_count` 0, etykiety tylko domyślne GitHuba). Kolumna „Otwarte bugi” to wszędzie 0, bo trackera nikt nie używa, a nie dlatego, że błędów nie ma (patrz Unknowns).
- `evidence`: przez PR przeszło 77 ze 154 liczonych commitów. Wszystko przed 2026-10-07 szło prosto na `main` (cała praca live-sync-spike, starter-question-base, ui-signin-contract), stąd niższy udział PR w live-sync (10/16), question-pool (3/6), host-signin (6/12) i shared (11/18).
- `inference`: przegląd odbywa się w repo, w dokumentach `reviews/plan-review.md` (6 z 9 zmian) i `reviews/impl-review.md` (9 z 9), pisanych przez autora z agentem. Wszystkie 19 commitów, które dodały pliki review lub follow-up, mają trailer `Co-authored-by: Claude` (`evidence`). To jest rzeczywista „dyskusja” w tym repo, ale nie przegląd przez drugiego człowieka.

## Friction

**Reverty — 13, wszystkie mechaniczne (`evidence`).** `git log --format=%s | grep -ci '^revert'` daje 13 na całej historii (kontrakt podaje 14; zmierzone 13). Każdy z 13 cofa celowy commit tymczasowy: 12 to „break-check” / „próbny alarm” (autor psuje kod, żeby pokazać, że test albo alarm robi się czerwony), 1 to tymczasowe dwukrotne uruchomienie e2e na jednej bazie. 0 revertów prawdziwej pracy, 0 tematów `hotfix`.

| Capability | Pary TEMP → Revert | Co zepsuto celowo (z tematów) | Udział par w commitach capability |
| --- | --- | --- | --- |
| game-evening | 3 | `cast_vote` ignoruje numer pytania, pominięcie zostawia urnę, „Następne pytanie” bez dzwonka | 6/14 (43%) |
| guest-join | 3 | otwarte 3 uprawnienia, link ustawia ciasteczko gracza, brak dzwonka po wejściu gościa | 6/17 (35%) |
| round | 3 | urna logowana, głos zwraca liczbę, odsłona pokazuje liczby +1 | 6/19 (32%) |
| room-screen | 2 | przyciski hosta schowane pod 1024 px, pasek hosta bez sticky | 4/16 (25%) |
| room-lobby | 1 | kanał po ponownym dołączeniu nie odświeża listy | 2/24 (8%) |
| platform | 1 | e2e dwa razy z rzędu na jednej bazie | 2/34 (6%) |

**Czerwone CI — 15 z 88 przebiegów, wszystkie zaplanowane (`evidence`).** Każdy nieudany przebieg leży na gałęzi PR; dopasowanie `headSha` → temat: 12 to commity TEMP z tabeli wyżej, 3 to commity „najpierw test” (czerwone z założenia): `ebcb9c5c` „Zasady i testy przed kodem (p1)”, `5f3e40cd` „Testy przed kodem (p1)”, `f5f046b1` „Ustalenia przeglądu jako testy, przed poprawką (p6)”. `main`: 34/34 przebiegów zielonych. Nieplanowanych czerwonych przebiegów: 0.

**Drugie podejścia (`evidence` z tematów commitów i plików testów):**

1. **room-lobby + guest-join: znane dziury po wydaniu.** S-01 scalone 2026-10-08 (PR #1, „Baza na produkcji”, „Produkcja i telefony”). 2026-10-10 testing-lobby-foundation dopisuje testy, które ujawniają znane dziury F1 (host zapisuje poza regułami, `tests/db/roles.test.ts`) i F4 (nicki, `tests/db/nicks.test.ts`, dziewięć par) jako `test.fails` („znana dziura”). Domknięte 2026-10-14 w first-live-round p2 (`4fedd342` „domknięcie F1/F4”), na `main` z PR #7 2026-10-15. `inference`: przez około 5–7 dni na produkcji działało lobby ze znanymi dziurami w uprawnieniach i nickach. To najmocniejszy sygnał drugiego podejścia w repo.
2. **host-signin: trzy rundy poprawek w 7 dni, w trzech zmianach.** `337df5cb` (2026-10-04, poprawki po review ui-signin-contract) → `957bb6d3` (2026-10-08, poprawki po review one-click-host-login, prosto na `main` 8,5 h po scaleniu PR #2, który był otwarty 5 min; dotyka `src/pages/api/auth/callback.ts`, `src/lib/auth-errors.ts`, `src/lib/supabase.ts`, `scripts/smoke.mjs`) → `d4bff27a` (2026-10-11, PR #6: błędy Supabase Auth w middleware były gubione, poprawka po audycie obserwowalności). Do tego wymiana logowania: rejestracja e-mailem ze startera (`SignUpForm.tsx`, `api/auth/signup.ts`, `auth/signup.astro`, `auth/confirm-email.astro`) usunięta w `1bcdb9d9` (2026-10-07) na rzecz OAuth. Dwie zmiany planistyczne i 54 zrzuty ekranu, czyli najwięcej uwagi planistycznej ze wszystkich capability.
3. **round: błąd złapany przed merge'em.** Impl-review first-live-round F1 („po awarii bazy w trakcie rundy nowe głosy nie są liczone, a odsłona pokazuje same zera”) najpierw zamieniono w test (`f5f046b1`, CI czerwone z założenia), potem naprawiono (`236afc33`), wszystko na gałęzi PR #7. Jedna runda.
4. **Każda zmiana ma dokładnie jedną rundę poprawek po review.** 9 impl-review → 9 commitów „Poprawki z przeglądu…”. Żadna zmiana nie dostała drugiej rundy poprawek. 11 z 13 commitów „fix” to te rundy (plus follow-upy w dokumentach), 1 to test ustaleń review (`f5f046b1`), 1 to poprawka po audycie (`d4bff27a`). Brak commita, który naprawiałby incydent z produkcji (`evidence`: tematy; `unknown`: czy takie incydenty były).

**Pozostałe (`evidence`):** zamknięte bez merge'a 0; długo otwarte bugi 0 (brak issues). Czas otwarcia PR: #9 49,2 h, #1 23,5 h, #7 22,5 h, #3 19,6 h, #8 5,1 h, reszta < 1 h. `inference`: to czas pracy jedynego autora na gałęzi, nie czekanie na recenzję. Reguła „tylko przez PR” dla chronionych ścieżek weszła do AGENTS.md w `21a4deba` (2026-10-10). Od tego dnia 0 commitów prosto na `main` dotknęło chronionych ścieżek. Wcześniej tylko `bc5867c1` (2026-10-07, `.github/workflows/ci.yml`), jeszcze przed regułą.

## Planning attention

Zmiany planistyczne (`context/archive/<data>-<id>/`), zmiany plików prozy zliczone z `changes.tsv` (z `context/changes/<id>/` i `context/archive/*-<id>/` złożonymi razem; bez commita masowego `fe959b32`):

| Zmiana | Daty | Capability | Pliki (bez zrzutów) / zrzuty | Zmiany prozy (pliki / commity) | Ustalenia F plan / impl | Follow-ups | PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| live-sync-spike | 09-27 → 10-04 | live-sync | 8 / 0 | 33 / 10 | 6 / 7 | — | brak (na `main`) |
| starter-question-base | 09-27 | question-pool | 6 / 0 | 20 / 6 | 4 / 8 | — | brak (na `main`) |
| ui-signin-contract | 10-04 | host-signin (+ shared: paleta, tokeny) | 8 / 46 | 21 / 9 | 6 / 7 | — | brak (na `main`) |
| one-click-host-login | 10-04 → 10-08 | host-signin | 7 / 8 | 26 / 9 | 7 / 6 | — | #2 |
| room-lobby | 10-07 → 10-08 | room-lobby, guest-join | 8 / 0 | 30 / 11 | 6 / 5 | tak (19 linii listy) | #1 |
| testing-lobby-foundation | 10-10 → 10-11 | room-lobby, guest-join, platform | 5 / 0 | 18 / 8 | brak / 8 | — | #3 |
| first-live-round | 10-13 → 10-15 | round (+ game-evening: `close_stale_games`; tu powstał event-log) | 7 / 0 | 29 / 12 | 7 / 7 | tak (12) | #7 |
| full-game-evening | 10-15 | game-evening | 6 / 0 | 24 / 10 | brak / 9 | tak (12) | #8 |
| room-wide-layout | 10-15 → 10-18 | room-screen | 5 / 0 | 20 / 8 | brak / 5 | — | #9 |
| audyt `context/audits/observability/2026-10-11_guest-join-live-lobby.md` | 10-11 | guest-join, live-sync (lobby), event-log | 1 | 1 / 1 | — | — | #6 (poprawka w host-signin) |

- `evidence`: najwięcej planowania przyciąga **host-signin** (2 zmiany, 47 zmian prozy, 26 ustaleń F, 54 zrzuty), potem **room-lobby/guest-join** (2 zmiany dzielone + audyt, 48 zmian prozy), **live-sync** (33 + audyt) i **round** (29; to też największy PR: +8035/−371, 73 pliki). Bez własnej zmiany planistycznej: **event-log** (pliki `src/lib/log.ts`, `src/lib/client-events.ts`, `src/pages/api/client-events.ts` powstały w `90e3b7c` first-live-round p3, a motywacja jest w audycie) i **shared**. PR #4 (agent-hooks) i #5 (e2e-lobby) nie mają folderu zmiany.
- `evidence`: plan-review brakuje w trzech ostatnich zmianach od fazy testów: testing-lobby-foundation, full-game-evening, room-wide-layout. Impl-review jest w 9 z 9.
- `evidence`, ostatnie: od 2026-10-11 powstały audyt, first-live-round, full-game-evening i room-wide-layout. `context/changes/` na HEAD zawiera tylko `README.md` i `bootstrap-verification/` (z 2026-09-25), więc żadna zmiana nie jest w toku.
- Dokumenty fundamentu, commity według zakresu w temacie (`evidence`): `context/foundation/roadmap.md` 24 (6 `archive`, po 3 starter-question-base, room-lobby, live-sync-spike, full-game-evening), `context/foundation/test-plan.md` 21 (room-wide-layout 5, testing-lobby-foundation 4, first-live-round 4, full-game-evening 4), `AGENTS.md` 21, `CLAUDE.md` 16, `README.md` 12, `context/deployment/deploy-plan.md` 10 (one-click-host-login 4, room-lobby 2), `prd.md` 5, `lessons.md` 3, `infrastructure.md` 3, `tech-stack.md` 2, `test-stack.md` 2.
- `inference` tylko z nagłówków roadmapy (statusów nie czytano): przyszłe slice'y wskazują dalszą uwagę na S-04 „Powrót po odświeżeniu” (live-sync / room-screen), S-06, S-10 i S-12 (question-pool), S-07 „Współhost”, S-08 i S-09 (guest-join) oraz S-13 „Lista gier hosta i kasowanie” (room-lobby; AGENTS.md wiąże z S-13 sprzątanie pokoi po smoke).

## Debt markers

`rg -c 'TODO|FIXME|HACK|XXX'` na 436 śledzonych plikach z HEAD (bez noise), w podziale przez `file-capability.tsv` (`evidence`):

| Capability | Pliki | Linie | Znaczniki | Na 1000 linii |
| --- | --- | --- | --- | --- |
| host-signin | 22 | 878 | 0 | 0 |
| room-lobby | 13 | 1543 | 0 | 0 |
| guest-join | 7 | 684 | 0 | 0 |
| round | 17 | 3608 | 1 (mech.) | 0,28 → 0 |
| game-evening | 8 | 1286 | 0 | 0 |
| question-pool | 3 | 1018 | 0 | 0 |
| live-sync | 15 | 1378 | 0 | 0 |
| room-screen | 12 | 2621 | 0 | 0 |
| event-log | 5 | 348 | 0 | 0 |
| shared | 28 | 2033 | 0 | 0 |
| platform | 33 | 2441 | 0 | 0 |
| docs | 77 | 13506 | 0 | 0 |

- Jedyne trafienie, `supabase/migrations/20261014101922_first_live_round.sql:59`, to `\uXXXX` w komentarzu o zapisie znaków ucieczki, a nie znacznik długu (mechaniczne). Prawdziwych znaczników długu w kodzie: 0.
- Znane dziury (`it.fails` „znana dziura <F> → <zmiana>”): mechanizm istnieje (`tests/db/nicks.test.ts:80`), ale na HEAD żadna para nie ma `knownHole: true`. Historycznie były F1 (room-lobby) i F4 (guest-join), obie zamknięte 2026-10-14.
- `inference`: dług przenoszony jest w dokumentach, nie w komentarzach kodu. Follow-upy: `context/archive/2026-10-07-room-lobby/follow-ups/review-fixes.md` (sekcje „Dla S-02 (first-live-round)”, „Dla migracji, która rusza nicki (S-02 albo S-04)”), `context/archive/2026-10-13-first-live-round/follow-ups/review-fixes.md` („Na później (S-03 albo następny audyt obserwowalności)”), `context/archive/2026-10-15-full-game-evening/follow-ups/review-fixes.md` („Na później”). Liczby linii listy (19 / 12 / 12) są tylko przybliżeniem. Których pozycji już nie ma: `unknown`.

## Mechanical signals

1. **Pary TEMP → Revert (false-signals 12, test testu).** 26 ze 154 liczonych commitów (16,9%) to 13 par. Zawyżają liczbę commitów game-evening (43%), guest-join (35%), round (32%) i room-screen (25%). To dowód celowej dbałości o alarmy, nie tarcie. Przypisanie idzie po plikach, więc np. break-check „`cast_vote` ignoruje numer pytania” trafia do game-evening (migracja `alarm_a_*`), choć `cast_vote` należy do round.
2. **15 czerwonych przebiegów CI**: wszystkie zaplanowane (12 TEMP + 3 „najpierw test”). Nie liczyć jako niestabilności.
3. **Udział poprawek (false-signals 5, 12).** Commit „Poprawki z przeglądu” to stały krok procesu każdej zmiany, a nie objaw zepsutej capability. 4 z 13 commitów fix są przekrojowe (n_caps > 3: `8722b0e5`, `f5f046b1`, `5c920305`, `957bb6d3`) i rozlewają się na room-lobby (3 z 4 jego fixów pochodzą z cudzych zmian, własny jest jeden: `f6764a18`), platform, shared i guest-join.
4. **Atrybucja PR przekrojowa.** #7, #8 i #9 dotykają question-pool, event-log i shared po 1–5 plików, co jest rozlaniem z budowy round, game-evening i room-screen. Własna praca question-pool nigdy nie przeszła przez PR.
5. **Komentarze botów to nie przegląd (false-signals 7).** `cloudflare-workers-and-pages[bot]` na #1 i #2. Buildy gałęzi wyłączono w `9cf1bec8` (2026-10-08), potem komentarzy już nie ma.
6. **Dokumenty review pisane z agentem**: liczone jako dyskusja (uwaga planistyczna), nie jako przegląd człowieka.
7. **Linia bazowa jednej osoby (false-signals 6).** Autor sam scala swoje PR. Czas otwarcia PR to czas pracy, nie kolejka recenzji.
8. **Proza (false-signals 8).** 348 zmian plików prozy; wpisy w roadmapie przy zamykaniu zmian (6 × `chore(archive)`) i aktualizacje test-plan / AGENTS.md to księgowość procesu. Przypisano je wyżej do zmian, nie traktować `docs` jako gorącego obszaru.
9. **`\uXXXX`** w jedynym trafieniu znaczników.

## Unknowns

- **Tracker błędów nieużywany** (0 issues). Czy błędy z produkcji trafiają gdziekolwiek poza roadmapą i follow-upami: `unknown`. GitHub Projects (`has_projects: true`) nie sprawdzono (`gh project` wymaga zakresu `read:project`): `unknown`.
- **Dyskusja poza repo**: rozmowy z agentem i ustalenia poza GitHubem nie są wersjonowane: `unknown`. W repo widać tylko ich wynik (research / plan / review).
- **Błędy produkcyjne**: aplikacja loguje przez `logEvent` (`src/lib/log.ts`) na Cloudflare Workers (`inference` z celu wdrożenia), do tego Supabase. Logów Workers i Supabase ani historii wdrożeń Workers Builds (np. nieudane buildy, rollback) nie sprawdzano: poza zakresem, a `wrangler` jest zabroniony. Wnioski o „braku incydentów” opierają się tylko na tematach commitów.
- **Treść ustaleń review**: liczono tylko nagłówki `F<n>`, bez wag, statusu (naprawione / odłożone) i treści follow-upów.
- **Statusy slice'ów roadmapy** (Done / Parked): czytano tylko nagłówki.
- **Rozbieżność z kontraktem**: kontrakt podaje 14 tematów `Revert`, zmierzono 13 (13/13 mechaniczne).
- Żadne narzędzie nie wymagało instalacji.

## Documents per capability

Który dokument przeczytać, żeby zrozumieć, jak powstała dana capability (ścieżki z `git ls-files`, tytuły z nagłówków). `inference`: kolejność czytania to `plan-brief.md` (skrót) → `research.md` → `plan.md` → `reviews/impl-review.md` → `follow-ups/`.

- **host-signin**
  - `context/archive/2026-10-04-one-click-host-login/`: `plan-brief.md`, `research.md`, `plan.md`, `reviews/plan-review.md`, `reviews/impl-review.md`, `phone-test.md`, `change.md` (+ 8 zrzutów w `screens/`)
  - `context/archive/2026-10-04-ui-signin-contract/`: `plan-brief.md`, `research.md` („audyt UI ekranu logowania”), `plan.md`, `theme.md`, `ui-checks.md`, `reviews/plan-review.md`, `reviews/impl-review.md`, `change.md` (+ 46 zrzutów)
  - `context/deployment/deploy-plan.md` § „Logowanie przez dostawców (S-05, od 07.10.2026)”; `context/foundation/roadmap.md` § „S-05”; `context/foundation/prd.md` § „Dostęp i role”, „Access Control”
  - PR #6 bez folderu: `context/audits/observability/2026-10-11_guest-join-live-lobby.md`
- **room-lobby**
  - `context/archive/2026-10-07-room-lobby/`: `plan-brief.md`, `research.md`, `plan.md`, `reviews/plan-review.md`, `reviews/impl-review.md`, `follow-ups/review-fixes.md`, `phone-test.md`, `change.md`
  - `context/archive/2026-10-10-testing-lobby-foundation/`: `plan-brief.md`, `research.md`, `plan.md`, `reviews/impl-review.md`, `change.md` (role, znana dziura F1)
  - `context/foundation/roadmap.md` § „S-01”, „S-13”; `context/deployment/deploy-plan.md` § „Migracje Supabase (od 07.10.2026, S-01)”; `context/foundation/test-plan.md` § „2. Risk Map”, „6.2”; `context/foundation/prd.md` § „Pokój i rozgrywka”
- **guest-join**
  - te same dwa foldery co room-lobby (wejście z linku i nicki: room-lobby p3; nicki i znana dziura F4: testing-lobby-foundation p3)
  - `context/audits/observability/2026-10-11_guest-join-live-lobby.md` § „guest-join”
  - `context/foundation/test-plan.md` § „6.2”; `context/foundation/roadmap.md` § „S-08”, „S-09”
- **round**
  - `context/archive/2026-10-13-first-live-round/`: `plan-brief.md`, `research.md` (AGENTS.md odsyła do D1), `plan.md`, `reviews/plan-review.md` (AGENTS.md odsyła do F1), `reviews/impl-review.md`, `follow-ups/review-fixes.md`, `change.md`
  - `context/foundation/prd.md` § „US-01”, „Business Logic”, „Non-Goals”; `context/foundation/roadmap.md` § „S-02”
  - `context/foundation/test-plan.md` § „6.3 Adding an anonymity check”, „6.6”; `context/foundation/lessons.md` § „Pytania gry tylko po stronie serwera”
- **game-evening**
  - `context/archive/2026-10-15-full-game-evening/`: `plan-brief.md`, `research.md`, `plan.md`, `reviews/impl-review.md`, `follow-ups/review-fixes.md`, `change.md`
  - cogodzinne sprzątanie (`close_stale_games`, pg_cron) pochodzi z `context/archive/2026-10-13-first-live-round/plan.md`
  - `context/foundation/roadmap.md` § „S-03”
- **question-pool**
  - `context/archive/2026-09-27-starter-question-base/`: `plan-brief.md`, `plan.md`, `question-review.md`, `reviews/plan-review.md`, `reviews/impl-review.md`, `change.md`
  - `context/foundation/prd.md` § „Pula pytań”; `context/foundation/roadmap.md` § „F-02”, „S-06”; `context/foundation/lessons.md` § „Pytania gry tylko po stronie serwera”
- **live-sync**
  - `context/archive/2026-09-27-live-sync-spike/`: `plan-brief.md`, `research.md`, `external-research.md`, `measurements.md`, `plan.md`, `reviews/plan-review.md`, `reviews/impl-review.md`, `change.md`
  - `context/audits/observability/2026-10-11_guest-join-live-lobby.md` § „live-lobby”
  - `context/foundation/roadmap.md` § „F-01”, „S-04”; `context/foundation/test-plan.md` § „6.4 Adding an e2e multi-player test”; `context/foundation/test-stack.md` (PR #5); `README.md` § „Live-sync test page and probe”
- **room-screen**
  - `context/archive/2026-10-15-room-wide-layout/`: `plan-brief.md`, `research.md`, `plan.md`, `reviews/impl-review.md`, `change.md`
  - pierwszy ekran pokoju: `context/archive/2026-10-13-first-live-round/plan.md` (p4 „Ekrany rundy”); ekrany wieczoru: `context/archive/2026-10-15-full-game-evening/plan.md` (p4)
  - `AGENTS.md` § „UI”
- **event-log**
  - `context/audits/observability/2026-10-11_guest-join-live-lobby.md` (§ „4. Systemic root causes”, „6. Recommended fix order”)
  - `context/archive/2026-10-13-first-live-round/plan.md` (pliki event-log powstały w p3 „Serwer rundy”)
  - `AGENTS.md` § „Conventions” (zakaz połykania błędów, `logEvent`)
- **shared**
  - `context/archive/2026-10-04-ui-signin-contract/theme.md` („Paleta gry”) i `research.md`
  - wspólny serwer pokoju (`src/lib/rooms/server.ts`) powstał w room-lobby p2: `context/archive/2026-10-07-room-lobby/plan.md`
  - `context/foundation/tech-stack.md`; `AGENTS.md` § „UI”
- **platform**
  - `context/deployment/deploy-plan.md`, `context/foundation/infrastructure.md`, `context/foundation/tech-stack.md`, `context/changes/bootstrap-verification/verification.md`
  - `context/foundation/test-plan.md` § „3. Phased Rollout”, „5. Quality Gates”; `context/foundation/test-stack.md`
  - `context/archive/2026-10-10-testing-lobby-foundation/plan.md` (runner i potok testów, p1)
  - `context/foundation/lessons.md` § „Dopisuj regułę „ask” dla każdego skrótu do wdrożenia lub bazy”
  - PR #4 (hooki agenta) i #5 (e2e) bez folderu zmiany

## Commands

- `gh repo view CharlesOnTheWave/most-likely-to --json …`; `gh pr list --state all --limit 100 --json number,title,createdAt,mergedAt,closedAt,state,author,headRefName,additions,deletions,changedFiles,reviews,comments`
- `gh issue list --state all --limit 100 --json …`; `gh api repos/…/pulls/comments`, `…/issues/comments`, `…/labels`, `repos/…` (GET)
- `gh run list --limit 200 --json databaseId,workflowName,headBranch,event,conclusion,status,createdAt,headSha` + `git log -1 --format=%s <sha>` dla nieudanych
- `git -c core.quotepath=off log --merges …`; `git log --no-merges P1..P2` dla każdego merge'a PR → `.work/discussion-pr-commits.tsv`; skrypt node → `.work/discussion-pr-caps.tsv`
- `awk` na `.work/commits.tsv` / `.work/changes.tsv` → `discussion-fix-commits.tsv`, `discussion-percap-signals.tsv`, `discussion-prose-*.tsv`
- `git log --diff-filter=A|D …`, `git log -S'only through a PR' -- AGENTS.md`, `git log -S'test.fails' -- tests`
- `git ls-files context`; `rg -n '^#{1,4} '` na dokumentach planistycznych → `discussion-doc-headings.txt`; `rg -c '^#{2,4} +F[0-9]+'` → `discussion-review-findings.tsv`
- `rg -c 'TODO|FIXME|HACK|XXX'`, `rg -c 'test\.fails'`, `rg -c -i 'znana dziura'` + `wc -l` na plikach z HEAD → `discussion-markers.tsv`
