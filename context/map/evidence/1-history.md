# Evidence: history

- **Okno:** cała historia, 2026-09-25 .. 2026-10-18 (HEAD `785f859`), bo pierwszy commit jest młodszy niż domyślne „12 months ago”.
- **Kubełki:** tydzień ISO: W39 (25–27.09), W40 (28.09–04.10), W41 (05–11.10), W42 (12–18.10).
- **Commity:** 155 bez merge'y (11 merge'y, czyli PR #1–#9 i 2 lokalne, pominięte przez `--no-merges`). Policzone: 154, bo wykluczony jest 1 commit masowy `fe959b32` (54 rename'y do `context/archive/`). Policzonych zmian plików jest 795: 447 w kodzie i 348 w prozie (`docs`). Szum (lock, media, pakiety kursu w `.claude/skills|prompts`) nie wchodzi do liczenia.
- **Ludzie:** 1 człowiek, `CharlesOnTheWave` (jedyny autor, dwie nazwy w git). Commitów, których autorem jest agent: 0. Trailer `Co-authored-by: Claude` ma 139 z 154 policzonych commitów. Każda koncentracja jest więc punktem odniesienia, a nie znaleziskiem (reguła 6).
- **Atrybucja:** tylko `context/map/.work/file-capability.tsv` i reguły liczenia z kontraktu. Dane surowe: `.work/history-metrics.tsv`, `.work/history-drivers.tsv`, `.work/history-breakcheck-shas.txt`.

## Activity per capability

`evidence`. Zmiana to plik w policzonym commicie. Commit liczy się raz dla każdej capability, którą dotyka. Kolumny „skoryg.” odejmują dwa źródła mechaniczne: scaffold `237a2970` (47 zmian kodu) oraz 13 par TEMP→Revert (26 commitów, każdy zmienia 1 plik, razem 26 zmian; zob. Mechanical signals).

| capability | zmiany | udział w kodzie | commity | z trailerem / bez | zmiany skoryg. | udział skoryg. | commity skoryg. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| host-signin | 65 | 14.5% | 12 | 12 / 0 | 51 | 13.6% | 11 |
| room-lobby | 42 | 9.4% | 24 | 23 / 1 | 39 | 10.4% | 21 |
| guest-join | 26 | 5.8% | 17 | 16 / 1 | 20 | 5.3% | 11 |
| round | 48 | 10.7% | 19 | 16 / 3 | 42 | 11.2% | 13 |
| game-evening | 21 | 4.7% | 14 | 11 / 3 | 15 | 4.0% | 8 |
| question-pool | 9 | 2.0% | 6 | 6 / 0 | 9 | 2.4% | 6 |
| live-sync | 28 | 6.3% | 16 | 16 / 0 | 28 | 7.5% | 16 |
| room-screen | 45 | 10.1% | 16 | 14 / 2 | 41 | 11.0% | 12 |
| event-log | 10 | 2.2% | 3 | 3 / 0 | 10 | 2.7% | 3 |
| shared (bucket) | 62 | 13.9% | 18 | 18 / 0 | 49 | 13.1% | 17 |
| platform (bucket) | 91 | 20.4% | 34 | 33 / 1 | 70 | 18.7% | 31 |
| **kod razem** | 447 | 100% | 84 commitów z kodem | 73 / 11 | 374 | 100% | — |
| docs (proza, nie rankingować) | 348 | 43.8% wszystkich | 121 | 117 / 4 | — | — | — |
| unmapped | 0 | 0.0% | 0 | — | 0 | 0.0% | 0 |

- **Unmapped:** 0% zmian (`evidence`). Kubełki shared i platform mają razem 34.3% zmian kodu (32.4% po korekcie).
- **Udział agenta** (`evidence`): commitów, których autorem jest agent, jest 0. Trailer agenta ma 139 ze 154 policzonych commitów (90.3%) i 73 z 84 commitów z kodem (86.9%). 11 commitów z kodem bez trailera to dokładnie 11 commitów `Revert "…"` z `git revert`. Pozostałe 4 commity bez trailera to `chore(archive)`, sama proza. Każdy niemechaniczny commit z kodem ma więc Claude jako współautora. To aktywność, nie osobny człowiek (reguła 7).
- **Ranking po korekcie** (`evidence` dla liczb, `inference` dla odczytu):
  - Po zmianach prowadzą host-signin (51), round (42), room-screen (41) i room-lobby (39).
  - Po commitach prowadzą room-lobby (21), live-sync (16), round (13) i room-screen (12).
  - host-signin ma dużo zmian w niewielu commitach (51 zmian w 11 commitach). To przepisanie ekranu logowania na tokeny (W40) i OAuth (W41), a od W42 nic się tam nie zmieniło.
  - Największym kubełkiem jest platform (70 zmian, 31 commitów): to narzędzia do wdrażania testów, CI i hooków.
- **Udział testów** (`evidence`): round ma 22 z 48 zmian w `tests/` i `supabase/tests/` (46%), guest-join 11 z 26, room-lobby 13 z 42, live-sync 7 z 28. Aktywność w rdzeniu gry jest w dużej części testowa: zmiany idą fazami „Testy przed kodem” (`inference` z tematów).

## Top files in top capabilities

`evidence`. „bc” to zmiany z par TEMP/Revert. „fix” to liczba commitów fix (heurystyka z sekcji Fix pressure), które dotknęły pliku. Każdą ścieżkę sprawdziłem przez `git cat-file -e HEAD:<path>`.

| capability | plik | zmiany | bc | fix | HEAD |
| --- | --- | --- | --- | --- | --- |
| host-signin | `src/pages/auth/signin.astro` | 5 | 0 | 0 | jest (1 zmiana ze scaffoldu) |
| host-signin | `src/components/auth/SignInCard.astro` | 4 | 0 | 1 | jest |
| host-signin | `src/components/auth/{FormField,ServerError,SignInForm}.tsx` | po 4 | 0 | 0 | są (po 1 ze scaffoldu) |
| host-signin | `src/components/auth/SignUpForm.tsx` | 4 | 0 | 0 | **usunięty** w `1bcdb9d9` (przeszłość) |
| round | `src/components/room/RoundReveal.tsx` | 5 | 2 | 0 | jest |
| round | `src/components/room/RoundVoting.tsx` | 4 | 0 | 0 | jest |
| round | `supabase/tests/round_creator_view.test.sql` | 4 | 0 | 1 | jest |
| round | `tests/db/{round-anonymity,round-rules}.test.ts`, `tests/db/support/rounds.ts` | po 4 | 0 | 0–1 | są |
| room-screen | `src/pages/r/[id].astro` | 7 | 0 | 0 | jest |
| room-screen | `src/components/room/HostActions.tsx` | 6 | **4** | 0 | jest (tylko 2 zmiany rzeczywiste) |
| room-screen | `src/pages/dev/room-states.astro` | 6 | 0 | 0 | jest |
| room-screen | `src/components/room/RoomScreen.tsx`, `tests/unit/room-state.test.ts` | po 5 | 0 | 0 | są |
| room-lobby | `src/components/room/RoomLobby.tsx` | **10** | 2 | 2 | jest |
| room-lobby | `src/pages/index.astro`, `tests/db/roles.test.ts` | po 5 | 0 | 0–1 | są |
| room-lobby | `src/pages/api/rooms/[id]/lobby.ts` | 3 | 0 | 0 | jest |
| live-sync | `scripts/live-sync-probe.mjs` | 4 | 0 | 1 | jest |
| live-sync | `src/lib/live-sync/{server,shared}.ts` | po 3 | 0 | 1 | są |
| guest-join | `src/pages/j/[token].astro` | 6 | 2 | 0 | jest |
| guest-join | `tests/db/nicks.test.ts` | 5 | 0 | 2 | jest |
| guest-join | `src/pages/api/rooms/join.ts` | 4 | 2 | 0 | jest |
| game-evening | `src/pages/api/rooms/[id]/next.ts` | 4 | 2 | 0 | jest |
| game-evening | `tests/e2e/game.spec.ts` | 3 | 0 | 1 | jest |
| shared | `src/lib/rooms/shared.ts`, `tests/unit/room-errors.test.ts` | po 6 | 0 | 0–1 | są |
| shared | `src/lib/rooms/server.ts` | 5 | 0 | 1 | jest |
| shared | `src/styles/global.css` | 5 | 0 | 0 | jest |
| platform | `.github/workflows/ci.yml` | **14** | 2 | 2 | jest |
| platform | `scripts/smoke.mjs` | 11 | 0 | 1 | jest |
| platform | `.claude/settings.json`, `package.json` | po 10 | 0 | 0–1 | są |

- **Rozkład wewnątrz capability** (`inference`): host-signin jest płaski, około 4–5 zmian na plik, bez jednego gorącego pliku. W room-lobby wyraźnie wyróżnia się jeden plik, `RoomLobby.tsx`. W platform dominują dwa pliki: `ci.yml` i `smoke.mjs`. Dwie usunięte migracje TEMP mają po 2 zmiany: `supabase/migrations/20261010115615_break_check_tmp.sql` (guest-join) i `…_alarm_a_cast_vote_ignores_round.sql` (game-evening). Opisują one przeszłość (reguła 11), więc nie wchodzą do tabeli.

## Trend

`evidence` dla liczb: commity, w nawiasie zmiany. Etykieta i kampania to `inference` z zakresów (`scope`) w tematach commitów.

| capability | W39 | W40 | W41 | W42 | etykieta | kampania |
| --- | --- | --- | --- | --- | --- | --- |
| host-signin | 1 (14) | 4 (23) | 7 (28) | 0 (0) | **fading** | W39 to scaffold, W40 `ui-signin-contract`, W41 `one-click-host-login`. Od 11.10 bez zmian. |
| room-lobby | 1 (1) | 0 | 13 (27) | 10 (14) | **rising** | W41 `room-lobby` (S-01) i `testing-lobby-foundation`. W42 dotykany przez `first-live-round` (6), `room-wide-layout` (2) i `full-game-evening` (2). |
| guest-join | 0 | 0 | 11 (15) | 6 (11) | **rising** | W41 `room-lobby` i testy nicków (`testing-lobby-foundation`). W42 `first-live-round`. |
| round | 0 | 0 | 0 | 19 (48) | **rising** (nowa) | W42 `first-live-round` (S-02, 14–15.10). |
| game-evening | 0 | 0 | 0 | 14 (21) | **rising** (nowa) | W42 `full-game-evening` (S-03, 15.10). 6 z 14 commitów to TEMP/Revert. |
| question-pool | 3 (3) | 0 | 0 | 3 (6) | **seasonal** | W39 `starter-question-base`. Aktywność W42 pochodzi tylko z 3 szerokich commitów faz (n_caps 8–9). |
| live-sync | 0 | 5 (11) | 4 (5) | 7 (12) | **constant** (od W40) | W40 `live-sync-spike` (F-01). Potem dotyka go każda funkcja. |
| room-screen | 0 | 0 | 3 (7) | 13 (38) | **rising** | W42 `room-wide-layout` oraz ekrany rundy i wieczoru. |
| event-log | 0 | 0 | 0 | 3 (10) | **seasonal** | Tylko 3 szerokie commity faz `first-live-round` i `full-game-evening`. |
| shared | 2 (14) | 4 (14) | 5 (11) | 7 (23) | **constant** | W39 scaffold i przeniesienie `cn()`. Później paleta i rdzeń serwera pokoju. |
| platform | 7 (26) | 5 (9) | 16 (46) | 6 (10) | **constant**, szczyt W41 | W41 to wdrażanie testów: `testing-lobby-foundation`, hooki agenta (M3L3), E2E (M3L4). |
| docs | 25 | 20 | 39 | 37 | constant | Proza, nie rankingować. |
| wszystkie / z kodem | 28 / 10 | 20 / 12 | 51 / 30 | 55 / 32 | rośnie | — |

- **Kampanie** (`evidence`, zakresy w tematach): W40 to `ui-signin-contract` (9) i `live-sync-spike` (8). W41 to `room-lobby` (10), `testing-lobby-foundation` (9) i `one-click-host-login` (8). W42 to `first-live-round` (15), `full-game-evening` (12) i `room-wide-layout` (9). Wszystkie te zmiany są już zamknięte w `context/archive/`. Ostatnie commity (18.10) to wyłącznie proza.
- **Zastrzeżenie** (`inference`): okno ma 3,5 tygodnia, czyli 4 kubełki. „Rising” znaczy tu „najnowsza kampania”, a nie trend długoterminowy.

## Fix pressure

**Heurystyka** (`evidence`): temat pasuje do `\bfix|napraw|poprawk|follow-ups|\bbug|hotfix|regression|broken|incident` (bez rozróżniania wielkości liter, bez commitów `Revert`). Reverty liczę osobno, jako tematy zaczynające się od `^Revert`. „TEMP” oznacza commit, który celowo psuje kod (`TEMP|temp:|TEMPORARY`). Commit liczy się dla każdej capability, którą dotyka. „Przekrojowy” znaczy n_caps > 3. W tematach nie ma odwołań do zgłoszeń z etykietą bug: jedyne `#` to „risk #2”, czyli numer ryzyka z planu testów.

| capability | commity | fix | udział fix | fix przekrojowe | reverty | TEMP | udział fix bez TEMP/Revert | fix wg zakresu zmiany |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| host-signin | 12 | 3 | 25% | 1 | 0 | 0 | 25% | 3 (2 przeglądowe + 1 defekt) |
| room-lobby | 24 | 4 | 17% | 3 | 1 | 1 | 18% | 1 |
| guest-join | 17 | 2 | 12% | 2 | 3 | 3 | 18% | 0 |
| round | 19 | 2 | 11% | 1 | 3 | 3 | 15% | 2 (1 defekt + 1 test przed poprawką) |
| game-evening | 14 | 1 | 7% | 1 | 3 | 3 | 12% | 1 |
| question-pool | 6 | 1 | 17% | 0 | 0 | 0 | 17% | 1 |
| live-sync | 16 | 2 | 12% | 1 | 0 | 0 | 12% | 1 |
| room-screen | 16 | 2 | 12% | 1 | 2 | 2 | 17% | 1 |
| event-log | 3 | 0 | 0% | 0 | 0 | 0 | 0% | 0 |
| shared | 18 | 3 | 17% | 2 | 0 | 0 | 17% | 0 |
| platform | 34 | 4 | 12% | 3 | 1 | 1 | 12% | 1 (`testing-lobby-foundation`) |
| docs | 121 | 11 | 9% | 4 | 0 | 0 | — | (proza) |

Kolumna „fix wg zakresu zmiany” przypisuje commit do capability, o której był (reguła 12), według identyfikatora zmiany w nawiasie.

**Co naprawdę jest w 11 commitach fix z kodem** (`evidence` z tematów i plików):

- **8 to „Poprawki z przeglądu implementacji / impl-review”**, dokładnie po jednym na każdą zmianę, która przeszła impl-review: `eec2d8d3` question-pool, `3746df6c` live-sync, `337df5cb` i `957bb6d3` host-signin, `f6764a18` room-lobby, `5c920305` testy lobby, `8e76b018` wieczór, `8722b0e5` szeroki układ. To krok workflow, a nie defekt (reguła 5, analogicznie).
- **2 to rzeczywiste defekty**, oba znalezione przed użytkownikami:
  - `236afc33` (round): „Głosy po awarii bazy liczą się w odsłonie (F1 z przeglądu)”. Zmienia `supabase/migrations/20261014101922_first_live_round.sql`. Poprzedza go test `f5f046b1`.
  - `d4bff27a` (host-signin): „log Supabase Auth failures in the middleware instead of dropping them”, czyli `src/middleware.ts`, `src/lib/auth-user.ts` i test. Ma ten sam znacznik czasu co audyt observability `89d6d154`.
- **1 to test przed poprawką:** `f5f046b1` „Ustalenia przeglądu jako testy, przed poprawką”. Pasuje do heurystyki przez słowo „poprawką”.
- W okresie nie ma tematów z `hotfix|incident|regression|broken|bug`.

**Reverty** (`evidence`):

- 13 tematów zaczyna się od `Revert`, wszystkie w W41–W42 i żaden nie jest przekrojowy (n_caps = 1).
- Każdy cofa celowy commit TEMP sprzed kilku minut. 12 z nich to break-check albo próbny alarm (test zostaje czerwony). 1 (`9f669fcb`) cofa eksperyment „run the e2e suite twice in a row on one database”, czyli test idempotencji.
- Rozkład: guest-join 3, round 3, game-evening 3, room-screen 2, room-lobby 1, platform 1.
- **Cofniętej rzeczywistej pracy: 0.**

**Reguła 5, infrastruktura i UI** (`evidence`): fixy platform (`3746df6c`, `957bb6d3`, `5c920305`, `f5f046b1`) to poprawki z przeglądu albo testy. W okresie nie ma ani jednego commitu typu „make CI green”. Fixy room-screen (`8e76b018` → `RoomErrorBoundary.tsx`, `8722b0e5` → `room-window.astro`) to również poprawki z przeglądu.

**Reguła 12, rozlanie** (`evidence`):

- 4 commity fix są przekrojowe.
- `8722b0e5` dotyczy room-screen i rozlewa się na game-evening oraz room-lobby.
- `957bb6d3` dotyczy host-signin i rozlewa się na platform (smoke) oraz shared (`src/lib/supabase.ts`).
- `5c920305` dotyczy infrastruktury testów i rozlewa się na guest-join, room-lobby i shared (pliki testów).
- `f5f046b1` dotyczy round i rozlewa się na guest-join, live-sync, platform i room-lobby.
- Udział fix 17% w room-lobby i shared to głównie takie rozlanie.

**Odczyt** (`inference`):

- Presja fix jest płaska, około 1 commit na zmianę, i mierzy liczbę zmian, a nie gęstość defektów.
- Jedynymi capability z defektem naprawionym w kodzie są round (liczenie głosów po awarii bazy, przy twardej regule anonimowości) i host-signin (połknięte błędy auth w middleware).

## Co-change between capabilities

**Populacja** (`evidence`): 148 commitów. To 154 policzone minus 6 z n_caps > 6: `77860b81`, `90e3b7cd`, `5f3e40cd`, `25074625`, `ba71ece1`, `519bf3f1`. Są to szerokie commity faz „Serwer”, „Ekrany”, „Testy przed kodem” i „Bramka”. Pary liczę między 11 capability kodu. Docs jest poza parami i opisany niżej jako korytarz. **Confidence** to wspólne commity podzielone przez commity mniej aktywnej strony w tej populacji.

| para | support | commity a / b | confidence | co ją napędza (pliki we wspólnych commitach) | odczyt |
| --- | --- | --- | --- | --- | --- |
| platform ~ room-lobby | 10 | 32 / 20 | 0.50 | `ci.yml` 5, `ui-literals.mjs` 3, `smoke.mjs` 3, `.claude/settings.json` 2 ↔ `RoomLobby.tsx` 4, testy e2e/db | mechaniczny korytarz (reguły 3 i 4) |
| platform ~ shared | 7 | 32 / 12 | 0.58 | `package.json` 4, `ci.yml` 3, `eslint.config.js` 2; w tym scaffold i przeniesienie `cn()` | mechaniczny |
| host-signin ~ platform | 6 | 11 / 32 | 0.55 | `smoke.mjs` 4, `package.json` 3, `.env.example` 2; w tym scaffold | mechaniczny (logowanie w smoke, env OAuth) |
| live-sync ~ platform | 6 | 11 / 32 | 0.55 | `live-sync-probe.mjs` ↔ `package.json`, `ci.yml`, `.env.example` | mechaniczny (narzędzia sondy) |
| guest-join ~ platform | 6 | 13 / 32 | 0.46 | `tests/db/nicks*` ↔ `ci.yml` 4 | mechaniczny (rozbudowa pakietu testów DB) |
| guest-join ~ room-lobby | 6 | 13 / 20 | 0.46 | `tests/db/nicks.test.ts`, `j/[token].astro` ↔ `tests/db/roles.test.ts`, `RoomLobby.tsx` | **domenowy** (`inference`: wspólne pokoje i gracze) |
| room-lobby ~ round | 6 | 20 / 14 | 0.43 | `RoomLobby.tsx`, `roles.test.ts` ↔ `round-rules.test.ts`, `RoundReveal/Voting.tsx`, widok twórcy w pgTAP | **domenowy** (`inference`: przejście z poczekalni do rundy) |
| live-sync ~ room-lobby | 5 | 11 / 20 | 0.45 | `src/lib/live-sync/shared.ts`, `lobby-connection-drop.spec.ts` ↔ `RoomLobby.tsx` | **runtime** (`inference`: lista graczy na żywo) |
| room-lobby ~ room-screen | 5 | 20 / 10 | 0.50 | `RoomLobby.tsx` 5 ↔ `src/pages/r/[id].astro` 4, `room-window.astro`, `AppHeader.astro` | **domenowy/UI** (`inference`: poczekalnia jako stan okna pokoju) |
| platform ~ round | 5 | 32 / 14 | 0.36 | `.claude/settings.json` 3, `smoke.mjs` 2, `ci.yml` 2 | mechaniczny |
| room-lobby ~ shared | 4 | 20 / 12 | 0.33 | — | słaby |
| pozostałe pary | 1–3 | — | 0.08–0.30 | — | słabe |

- **Korytarz docs** (`evidence`): commity, które oprócz kodu dotykają też prozy, to: host-signin 10 z 11, live-sync 10 z 11, shared 11 z 12, room-lobby 17 z 20, platform 27 z 32 i question-pool 3 z 3. Niżej są guest-join 7 z 13, round 7 z 14 i game-evening 4 z 10, bo jednoplikowe commity TEMP/Revert nie zawierają prozy. Workflow dopisuje Progress i plan przy każdej fazie (reguły 3 i 8), więc to nie jest sprzężenie.
- **Ślepe miejsca populacji** (`evidence` dla liczb, `inference` dla przyczyny): round ~ shared ma support 1, game-evening ma najwyżej 2 przy każdym partnerze, a event-log ma 0 commitów w populacji. Ich wspólna praca serwerowa leży w 6 odrzuconych szerokich commitach. Co-change zaniża więc sprzężenie w trójkącie round, game-evening i shared oraz z event-log.

## Hub files and freshness

**Huby w populacji co-change** (`evidence`): partnerzy to inne capability kodu widziane w co najmniej 2 commitach; docs nie liczę jako partnera. Dopisek „wszystkie” podaje commity w całej policzonej historii.

| plik | capability | commity | partnerzy ≥2 | co to jest | reguła / ocena |
| --- | --- | --- | --- | --- | --- |
| `.github/workflows/ci.yml` | platform | 13 (wszystkie: 14) | 6: room-lobby, guest-join, live-sync, shared, round, host-signin | potok CI; każdy nowy pakiet testów (db, e2e, hooki) dokłada job | mechaniczny (reguła 4: wspólna przyczyna to wdrażanie testów); 2 zmiany to TEMP/Revert |
| `scripts/smoke.mjs` | platform | 9 (11) | 6: host-signin, room-lobby, round, guest-join, shared, live-sync | smoke rozszerzany o każdą funkcję („smoke z rundą”, „smoke z wieczorem”) | korytarz workflow (reguła 3), pilnuje go job `smoke` w CI; `inference`: jeden skrypt koduje przepływy wszystkich capability |
| `src/components/room/RoomLobby.tsx` | room-lobby | 9 (10) | 6: room-screen, platform, live-sync, round, shared, guest-join | komponent poczekalni (kod) | **niemechaniczny**: dotykały go `room-lobby`, `first-live-round`, `room-wide-layout`, ustawianie E2E i break-check B2; najczęściej zmieniany plik kodu biznesowego |
| `src/pages/r/[id].astro` | room-screen | 4 (7) | 6: room-lobby, platform, round, live-sync, shared, guest-join | strona pokoju, przez którą wpięto każdy stan (poczekalnia, runda, wieczór) | `inference`: naturalny punkt składania stanów (wejście), a nie ukryty kontrakt |
| `package.json` | platform | 10 | 4: shared, live-sync, host-signin, room-lobby | zależności i skrypty | mechaniczny (reguły 4 i 7) |
| `scripts/ui-literals.mjs` | platform | 4 (5) | 3: room-screen, room-lobby, guest-join | ręczna lista widoków sprawdzanych lintem tokenów | korytarz z reguły w AGENTS.md; strażnikiem jest sam lint, ale tylko dla wpisanych plików (zob. Unknowns) |
| `tests/db/nicks.test.ts`, `tests/db/roles.test.ts`, `tests/db/round-rules.test.ts`, `tests/db/support/nick-pairs.ts` | guest-join / room-lobby / round | 3–5 | po 3 | pakiet testów DB rozbudowywany razem (fazy „testy przed kodem”) | korytarz workflow |
| `context/foundation/test-plan.md` (21 zmian), `AGENTS.md` (21), `README.md` (12), `context/foundation/roadmap.md` (24) | docs | — | 4–6 | proza | reguła 8: nie rankingować |

**Huby widoczne tylko przez szerokie commity** (`evidence`, reguła 12):

- `src/lib/rooms/shared.ts`: 6 commitów, z czego 5 ma n_caps > 6. W całej historii ma 9 partnerów, a w populacji co-change mniej niż 2.
- `tests/unit/room-errors.test.ts` (9 partnerów), `src/pages/dev/room-states.astro` (9) i `src/lib/rooms/errors.ts` (8) zachowują się tak samo.
- `inference`: to wspólny rdzeń serwera pokoju i podgląd stanów. Filtr co-change go ukrywa, a nie oczyszcza. Fan-in powinien potwierdzić agent struktury.

**Freshness** (`evidence`, `git cat-file -e HEAD:<path>` dla każdego nazwanego tu pliku). Wszystkie istnieją na HEAD z wyjątkiem:

- `src/components/auth/SignUpForm.tsx`: usunięty w `1bcdb9d9` („Ekran logowania i porządki”).
- Pięć migracji TEMP: `supabase/migrations/*_{break_check_tmp,break_check_logged_urn,break_check_vote_count,alarm_a_cast_vote_ignores_round,alarm_b_skip_keeps_urn}.sql`. Każdą usunął jej commit `Revert` (status `D`), a `git ls-files` nie znajduje żadnej z nich.
- `context/changes/first-live-round/plan.md`: przeniesiony do `context/archive/2026-10-13-first-live-round/plan.md`.
- To przeszłość (reguła 11) i nie są to gorące pliki.

## Mechanical signals

1. **13 par TEMP→Revert** (26 commitów, 26 zmian, po 1 pliku): to test testu, czyli celowe zepsucie kodu, żeby pokazać czerwony test lub alarm. Zawyżają zmiany w guest-join (6 z 26), round (6 z 48), game-evening (6 z 21), room-screen (4 z 45, w tym 4 z 6 zmian `HostActions.tsx`), room-lobby (2) i platform (2). Wyłączone z rankingu fix i revert. `inference`: przy okazji wskazują pliki, których strażnika udowodniono: `HostActions.tsx`, `next.ts`, `RoundReveal.tsx`, `RoomLobby.tsx`, `join.ts`, `j/[token].astro` i funkcje DB.
2. **Scaffold `237a2970`** (import startera, policzony zgodnie z kontraktem): 47 zmian kodu, w tym host-signin 14, shared 13, platform 19 i room-lobby 1. Bez niego host-signin spada z 65 do 51 zmian.
3. **Poprawki z przeglądu:** 8 z 11 commitów fix z kodem to jeden krok „Poprawki z impl-review” na zmianę. Udział fix mierzy workflow, a nie awaryjność (reguła 5, analogicznie).
4. **Pary z platform** (platform~room-lobby, ~shared, ~host-signin, ~live-sync, ~guest-join, ~round): napędzają je `ci.yml`, `smoke.mjs`, `package.json`, `.claude/settings.json`, `.env.example` i `ui-literals.mjs`. To korytarz workflow (reguły 3 i 4) i ma jedną wspólną przyczynę: wdrażanie testów oraz rozbudowę smoke. Liczyć ją raz.
5. **Korytarz docs i huby z prozy** (`test-plan.md`, `AGENTS.md`, `README.md`, `roadmap.md`, plany zmian): reguła 8.
6. **6 szerokich commitów faz** (n_caps 7–9): wypadają z co-change. Niosą całą aktywność event-log i całą aktywność question-pool z W42 (reguła 12).
7. **Trailer agenta** (139 ze 154): to aktywność, a nie osoba. 15 commitów bez trailera to 11 commitów `git revert` i 4 archiwizacje (reguła 7).
8. **Jeden człowiek w oknie:** każda koncentracja jest punktem odniesienia (reguła 6).
9. **Pliki usunięte i przeniesione** (sekcja freshness): reguła 11.
10. **Commit masowy `fe959b32`**: wykluczony przez kontrakt (54 rename'y archiwum).

## Unknowns

- **Migracje redefiniujące cudze funkcje:** `first_live_round.sql` odtwarza `create_room`, `join_room` i `room_lobby` (kontrakt), ale cały plik należy do round. Sprzężenie room-lobby/guest-join ~ round w bazie jest więc wyższe, niż pokazuje co-change. `unknown` co do skali.
- **Brak wygenerowanych typów DB:** `git ls-files` nie znajduje `database.types` ani podobnego pliku, jest tylko `src/env.d.ts`. Wywołania RPC w TS (`src/lib/rooms/*`, `src/pages/api/rooms/**`) i sygnatury funkcji SQL to więc prawdopodobnie ręcznie utrzymywane bliźniaki (`inference`). Co-change nie pokaże ich rozjazdu. Czy każdą formę pilnują `tests/db` i e2e w CI: `unknown` (do sprawdzenia przez agenta struktury lub testów).
- **Kontrakt zdarzeń live-sync** między serwerem (`src/lib/rooms/announce.ts`, `src/lib/live-sync/server.ts`) a klientem (`src/components/room/useRoomState.ts`, `RoomLobby.tsx`): para live-sync ~ room-screen ma support tylko 2. `unknown`, czy pilnuje go wspólny moduł.
- **Ręczna lista w `scripts/ui-literals.mjs`** i podgląd każdego nowego stanu w `/dev/room-states` (konwencje z AGENTS.md): brakującego wpisu co-change nie pokaże. Strażnik spoza listy: `unknown`.
- **Szerokie commity faz** (6) ukrywają sprzężenie rdzenia serwera (`src/lib/rooms/shared.ts`, `server.ts`, `errors.ts`) z round, game-evening, live-sync i event-log. Potrzebny graf importów (lane structure).
- **Edycja migracji w `236afc33`:** `first_live_round.sql` zmieniono dzień po jej utworzeniu (`4fedd342` → `236afc33`). Git nie mówi, czy była już wypchnięta przez `db push`. Reguła brzmi „nigdy nie edytuj wypchniętej migracji”. Temat wdrożenia na produkcję (`1ea3edf3`, p6) jest późniejszy, więc to `inference`: prawdopodobnie przed pierwszym push. Sprawdzić w `context/archive/2026-10-13-first-live-round/`.
- **Niezgodność z kontraktem:** kontrakt mówi o 14 tematach `Revert`, a ja liczę 13 (`^Revert`). 16 trafień daje samo słowo „revert”, bo 3 tematy TEMP zawierają „(revert before merge)”. Wszystkie 13 cofają celowe commity TEMP.
- **Zgłoszenia na forge** (etykieta bug) nie były sprawdzane, to lane discussion. W tematach nie ma odwołań do zgłoszeń.
- **Krótkie okno** (3,5 tygodnia, 4 kubełki): etykiety trendu są słabe. Nic nie wymagało instalacji. Przy większym repo warto użyć `code-maat` (sprzężenie czasowe w oknach przesuwnych); tu wystarczył Python na danych z `.work/`.

### Komendy

- `python -I history.py` (scratchpad) czyta `.work/commits.tsv`, `.work/changes.tsv` i `.work/file-capability.tsv`. Liczy aktywność, top pliki, trend, fix i revert, co-change oraz huby, a wynik zapisuje do `.work/history-metrics.tsv`.
- `python -I history2.py` liczy pliki commitów fix, pliki napędzające pary, huby kodu i tematy commitów przy hubach. Wynik trafia do `.work/history-drivers.tsv`.
- `awk` na `.work/commits.tsv` i `.work/changes.tsv`: trailer agenta w commitach z kodem, udział testów i migracji, zmiany z par TEMP/Revert (`.work/history-breakcheck-shas.txt`), liczba wierszy `^Revert` w `.work/subjects.txt`.
- `git -c core.quotepath=off log --merges --format='%h %s'` oraz `git -c core.quotepath=off log --format='%h %s' | grep -i revert`.
- `git -c core.quotepath=off cat-file -e HEAD:<path>` dla każdego nazwanego pliku oraz `git -c core.quotepath=off ls-files` (archiwum, migracje TEMP, typy DB).
- `git -c core.quotepath=off log --format='%h %aI %s' -- supabase/migrations/20261014101922_first_live_round.sql`.
