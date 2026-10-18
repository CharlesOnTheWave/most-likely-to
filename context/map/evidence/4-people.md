# Evidence: people

- **Ludzie w oknie: 1** — `CharlesOnTheWave` (jedyny autor, dwie nazwy w git: nazwa z lokalnego configu na wszystkich 155 commitach bez merge'y oraz `CharlesOnTheWave` na 9 merge'ach PR zrobionych w UI GitHuba). `evidence`: obie nazwy mają ten sam adres autora w historii HEAD (porównane prywatnie, surowe dane w `.work/people-shortlog-*.txt`); `.mailmap` nie istnieje, więc tożsamości połączyłem ręcznie.
- **Baseline: zespół jednoosobowy** (false-signals, reguła 6). Każda statystyka koncentracji poniżej to baseline, nie znalezisko; nie używam języka „bus factor”.
- **Okno:** cała historia, 2026-09-25 .. 2026-10-18 (tygodnie ISO W39–W42). Liczone 154 commity (155 bez merge'y minus 1 masowy `fe959b32`, przenosiny archiwum), 795 zmian plików bez szumu, 0 nieprzypisanych. Atrybucja wyłącznie z `.work/file-capability.tsv`.
- **Filtry:** boty 0, commity, których autorem jest agent: 0. 139 commitów ma trailer `Co-authored-by: Claude` — to commity człowieka i liczą się w pełni (jako aktywność i jako ludzie). Merge'e są poza liczeniem (`--no-merges`).
- **Mechaniczne:** lokalny ref `refs/original/refs/heads/main` (kopia zapasowa po `git filter-branch`) zawiera 11 commitów spoza HEAD z 2026-09-25..26 tego samego autora; nie jest liczony. 13 rewertów to cofnięcia celowych `TEMP` / break-check / „próbny alarm” (test testu), nie cofnięta praca.

## People per capability

Zakres: wszystkie capabilities o krytyczności high lub medium (11 z 12; `docs` ma low). Top 5 wg liczonych zmian kodu (platform 91, host-signin 65, shared 62, round 48, room-screen 45) już się w nim mieści. `docs` (348 zmian) to proza, nie aktywność kodu (reguła zliczania), więc podaję ją tylko na końcu jako kontekst.

| Capability | Dlaczego w zakresie | Zmiany / commity | Ludzie | Okres aktywności (tygodnie) |
| --- | --- | --- | --- | --- |
| host-signin | high: tożsamość, sesje, OAuth, publiczne wejście | 65 / 12 | CharlesOnTheWave | 2026-10-04..10-11 (W40:4, W41:7); plus 09-25 ze scaffoldu |
| room-lobby | high: dane użytkowników, RLS, inne capabilities zależą od pokoi | 42 / 24 | CharlesOnTheWave | 2026-10-07..10-16 (W41:13, W42:10); plus 09-25 ze scaffoldu (`index.astro`) |
| guest-join | high: publiczne wejście `anon`, sekret gracza | 26 / 17 | CharlesOnTheWave | 2026-10-07..10-15 (W41:11, W42:6) |
| round | high: główna wartość, anonimowe głosy | 48 / 19 | CharlesOnTheWave | 2026-10-14..10-16 (W42:19) |
| game-evening | high: cały wieczór, usuwanie stanu, pg_cron | 21 / 14 | CharlesOnTheWave | 2026-10-14..10-16 (W42:14) |
| question-pool | medium: treść gry, dane statyczne | 9 / 6 | CharlesOnTheWave | 2026-09-27 (W39:3); potem tylko commity przekrojowe W42:3 |
| live-sync | high: Realtime, od niego zależy lobby i runda | 28 / 16 | CharlesOnTheWave | 2026-10-04..10-16 (W40:5, W41:4, W42:7) |
| room-screen | medium: to, co widzą gracze | 45 / 16 | CharlesOnTheWave | 2026-10-07..10-16 (W41:3, W42:13) |
| event-log | medium: publiczny endpoint, ochrona prywatności w logach | 10 / 3 | CharlesOnTheWave | 2026-10-14..10-15 (W42:3) |
| shared (bucket) | high: każda trasa pokoju zależy od niego w runtime | 62 / 18 | CharlesOnTheWave | 2026-09-25..10-16 (W39:2, W40:4, W41:5, W42:7) |
| platform (bucket) | high: push na `main` = produkcja | 91 / 34 | CharlesOnTheWave | 2026-09-25..10-16 (W39:7, W40:5, W41:16, W42:6) |
| docs (proza, kontekst) | low, poza rankingiem | 348 / 121 | CharlesOnTheWave | 2026-09-25..10-18 (W39:25, W40:20, W41:39, W42:37) |

Grupy tematów jednej osoby per capability (`inference` z tematów commitów, change id w zakresie i najczęściej zmienianych ścieżek; liczby to `evidence` z `.work/people-paths.tsv` i `.work/people-topics.tsv`):

- **host-signin:** (1) ekran logowania na tokenach, stany i błędy (`ui-signin-contract` p2/p4/p5 + poprawki z impl-review, 2026-10-04); (2) logowanie przez dostawcę OAuth (Discord, Google) i usunięcie rejestracji e-mailem: `SignUpForm.tsx`, `signup.astro`, `confirm-email.astro`, `api/auth/signup.ts` skasowane w `1bcdb9d9` (`one-click-host-login` p2/p3, PR #2, 2026-10-07..08); (3) logowanie awarii Supabase Auth w middleware (`d4bff27a`, PR #6, 2026-10-11). Najczęściej: `src/pages/auth/signin.astro` (5), `src/lib/auth-errors.ts` (4).
- **room-lobby:** (1) baza pokoju na produkcji, nowa gra i link (`room-lobby` p1/p2, PR #1); (2) lista graczy na żywo i fokus błędu serwera (p3/p5); (3) testy ról i „znane dziury F1” (`testing-lobby-foundation` p2/p4, PR #3); (4) E2E poczekalni i zerwanego połączenia, break-check B2 (PR #5). Najczęściej: `RoomLobby.tsx` (10), `tests/db/roles.test.ts` (5). 16 z 24 commitów to commity przekrojowe (n_caps > 3), głównie redefinicje w `first-live-round` (6) i `full-game-evening` (2).
- **guest-join:** (1) wejście z linku `/j/<token>` i ciasteczko gracza (`room-lobby` p2–p4, PR #1); (2) nicki: normalizacja i pary nicków (`tests/db/nicks.test.ts` 5, `nick-pairs.ts` 4; `testing-lobby-foundation` p3, PR #3); (3) uprawnienia `anon` sprawdzone break-checkami („otwiera 3 uprawnienia”, „link ustawia ciasteczko gracza”, PR #3); (4) dzwonek po dołączeniu gościa (break-check B1, PR #5); (5) redefinicja `join_room` w `first-live-round` (4 commity).
- **round:** (1) urna i stany gry w bazie, serwer i ekrany rundy (`first-live-round` p2–p4, PR #7); (2) anonimowość głosu: `tests/db/round-anonymity.test.ts`, pgTAP `supabase/tests/round_creator_view.test.sql`, break-checki „urna logowana”, „głos zwraca liczbę”, „odsłona +1”; (3) poprawka F1 „Głosy po awarii bazy liczą się w odsłonie” (`236afc33`); (4) dalsze zmiany w `full-game-evening` (4) i `room-wide-layout` (2). Najczęściej: `RoundReveal.tsx` (5).
- **game-evening:** (1) kolejne pytanie, pominięcie, koniec gry: baza, serwer, ekrany, E2E `game.spec.ts` i smoke (`full-game-evening` p2–p5, PR #8); (2) break-checki „`cast_vote` ignoruje numer pytania”, „pominięcie zostawia urnę”, „Następne pytanie bez dzwonka” (2 tymczasowe migracje, dziś skasowane: historia, której już nie ma); (3) zamykanie porzuconych gier pg_cron w `first-live-round` p2 (PR #7). Najczęściej: `src/pages/api/rooms/[id]/next.ts` (4).
- **question-pool:** (1) szkielet bazy pytań, pytania w kodzie, losowanie, poprawki z impl-review (`starter-question-base` p1/p3, 2026-09-27, prosto na `main`, bez PR); (2) potem już tylko w commitach przekrojowych (n_caps 8–9). Pliki: `src/data/questions.ts`, `src/lib/rounds/draw.ts`, `tests/unit/draw.test.ts` (po 3).
- **live-sync:** (1) spike: dzwonek i tablica (serwer), strona demo, sonda i pomiar, limiter, produkcja na telefonie (`live-sync-spike` p1–p5, 2026-10-04, prosto na `main`); (2) lista na żywo w lobby i zerwane połączenie (E2E `lobby-connection-drop.spec.ts`, PR #5); (3) odświeżanie stanu rundy i wieczoru (PR #7, #8). Najczęściej: `scripts/live-sync-probe.mjs` (4).
- **room-screen:** (1) stany pokoju do oceny i `/dev/room-states` (`room-lobby` p4, PR #1); (2) ekrany wieczoru i poprawki z przeglądu (`full-game-evening` p4/p6, PR #8); (3) szeroki układ: układ M, bramka i test telefonu, próbne alarmy paska hosta (sticky, przyciski pod 1024 px), poprawki z przeglądu (`room-wide-layout` p1–p3, PR #9). Najczęściej: `src/pages/r/[id].astro` (7), `HostActions.tsx` (6), `room-states.astro` (6).
- **event-log:** jedna grupa: lista dozwolonych pól dla `logEvent` i zdarzeń z przeglądarki. Pliki powstały w `90e3b7cd` (`first-live-round` p3, PR #7) i zmieniły się w `full-game-evening` p1/p3 (PR #8). Capability nie ma żadnego commitu tylko dla siebie: wszystkie 3 commity są przekrojowe (n_caps 8–9). `evidence`.
- **shared:** (1) scaffold i przeniesienie `cn()` do pakietu `cn` (2026-09-25); (2) tokeny, tryb ciemny, paleta gry, klocki shadcn (`ui-signin-contract` p1/p3/p4, prosto na `main`); (3) wspólny serwer pokoju `src/lib/rooms/{shared,server,errors,json-route}.ts` z testami jednostkowymi (`room-lobby` p2, `testing-lobby-foundation`, `first-live-round`, `full-game-evening`). Najczęściej: `src/lib/rooms/shared.ts` (6), `tests/unit/room-errors.test.ts` (6).
- **platform:** (1) CI: `.github/workflows/ci.yml` (14), stała wersja CLI Supabase, job `e2e` (PR #3, #5); (2) smoke rozszerzany przy każdej funkcji: `scripts/smoke.mjs` (11); (3) uprawnienia i hooki agenta: `.claude/settings.json` (10), PR #4; (4) decyzja o Cloudflare Workers i pierwszy deploy (2026-09-26, prosto na `main`); (5) skan literałów UI `scripts/ui-literals.mjs` (5).

## Concentration

**Mały zespół: koncentracja jest baseline'em** (`humans_in_window` = 1). `evidence`:

- Każda capability z tabeli (11 kodowych i `docs`) ma 100% commitów od jednej osoby. Okno obejmuje całą historię, więc „tylko jedna osoba kiedykolwiek ją dotknęła” dotyczy **wszystkich** capabilities, a nie wybranych.
- Forge (`gh`, odczyt): jeden collaborator (`CharlesOnTheWave`, admin). 9 PR (#1–#9) ma tego samego autora i **0 recenzji**. Jedyne komentarze to status bota `cloudflare-workers-and-pages` na #1 i #2 (automatyka, nie review: false-signals, reguła 7). Brak `CODEOWNERS` (404 w trzech standardowych miejscach, brak w `git ls-files`). `main` nie jest chroniony („Branch not protected”) i nie ma rulesetów.
- Żadna capability nie wyróżnia się na tle zespołu, bo zespół to jedna osoba. Tej liczby nie wolno przenosić do rankingu ryzyka.

## Agent co-authorship

Kontekst, nie filtr. „Z trailerem” = `Co-authored-by: Claude` (warianty: „Claude Opus 5.5 (1M context)” 70, „Claude Opus 5.5” 69). `evidence` z `.work/commits.tsv` i `.work/git-log.txt`.

| Capability | Commity | Z trailerem | Bez | Udział | Co jest „bez” |
| --- | --- | --- | --- | --- | --- |
| host-signin | 12 | 12 | 0 | 100% | — |
| room-lobby | 24 | 23 | 1 | 96% | `git revert` break-checka B2 |
| guest-join | 17 | 16 | 1 | 94% | `git revert` break-checka B1 |
| round | 19 | 16 | 3 | 84% | 3× `git revert` break-checków (a/b/c) |
| game-evening | 14 | 11 | 3 | 79% | 3× `git revert` break-checków (a/b/c) |
| question-pool | 6 | 6 | 0 | 100% | — |
| live-sync | 16 | 16 | 0 | 100% | — |
| room-screen | 16 | 14 | 2 | 88% | 2× `git revert` próbnego alarmu |
| event-log | 3 | 3 | 0 | 100% | — |
| shared | 18 | 18 | 0 | 100% | — |
| platform | 34 | 33 | 1 | 97% | `git revert` tymczasowego podwójnego E2E |
| docs | 121 | 117 | 4 | 97% | 4× `chore(archive): close …` |
| **razem (liczone)** | **154** | **139** | **15** | **90.3%** | 11 rewertów + 4 zamknięcia archiwum |

- Wszystkie 155 bez merge'y: 139 z trailerem, 16 bez (89.7%); szesnasty to masowy `fe959b32` (zamknięcie archiwum).
- `evidence`: każdy commit bez trailera to mechaniczny `git revert` celowego break-checka albo przeniesienie folderu zmiany do archiwum. Żadna merytoryczna zmiana w żadnej capability nie powstała bez współautorstwa agenta. Niższy udział w round, game-evening i room-screen wynika tylko z liczby cofniętych próbnych alarmów, nie z innego sposobu pracy.
- `inference`: uzasadnienie decyzji jest zapisane głównie w plikach, które workflow tworzy przy każdej zmianie (research, plan, plan-review, impl-review w `context/archive/<data>-<change>/`), a nie wyłącznie w pamięci autora. To one są pierwszym „rozmówcą”, zanim zapytasz człowieka.

## Implications

Pytać zawsze trzeba `CharlesOnTheWave` (jedyna osoba). Co przeczytać przed danym rodzajem zmiany, żeby nie powtarzać czegoś, co już próbowano (`evidence`: mapowanie PR na capability z `.work/people-pr-capabilities.tsv`, foldery z `git ls-files context/archive`):

| Przed zmianą… | Przeczytaj | Uwaga |
| --- | --- | --- |
| logowania, OAuth, sesji (host-signin) | PR #2; `context/archive/2026-10-04-one-click-host-login/` (plan, research, plan-review, impl-review); dla stanów UI `context/archive/2026-10-04-ui-signin-contract/`; PR #6 (awarie Auth w middleware) | rejestracja e-mailem już była i została usunięta (`1bcdb9d9`); `ui-signin-contract` trafił na `main` bez PR |
| schematu pokoi i RLS (room-lobby) | PR #1; `context/archive/2026-10-07-room-lobby/`; PR #3 (testy ról, znane dziury F1); PR #5 (zerwane połączenie) | migracje późniejszych zmian redefiniują funkcje lobby, więc czytaj też PR #7 |
| uprawnień `anon`, nicków, ciasteczka gracza (guest-join) | PR #3 (break-checki uprawnień i ciasteczka), PR #1, PR #7 (redefinicja `join_room`) | |
| urny, anonimowości, odsłony (round) | PR #7; `context/archive/2026-10-13-first-live-round/` (research D1 i plan-review F1, na które powołuje się `AGENTS.md`); poprawka `236afc33` | break-checki rundy opisane są w planie testów (commit `009ad52f`) |
| następnego pytania, pominięcia, końca gry, crona (game-evening) | PR #8; `context/archive/2026-10-15-full-game-evening/`; cron `close-stale-games` w PR #7 | wyniki próbnych alarmów: commit `7c444cac` |
| Realtime (live-sync) | `context/archive/2026-09-27-live-sync-spike/` (także external-research); PR #5 | spike trafił na `main` bez PR (6 z 16 commitów prosto na `main`) |
| układu ekranu pokoju (room-screen) | PR #9; `context/archive/2026-10-15-room-wide-layout/`; PR #1 (stany pokoju) | |
| bazy pytań (question-pool) | `context/archive/2026-09-27-starter-question-base/` | brak PR, cała praca prosto na `main` |
| logowania zdarzeń (event-log) | plan w `context/archive/2026-10-13-first-live-round/` (tam powstały pliki) i PR #8; PR #6 dla logów Auth | `inference`: zasady logowania są rozłożone na dwie zmiany, bo event-log nie miał własnej |
| wspólnego serwera pokoju i tokenów UI (shared) | PR #1, #3, #7, #8; dla tokenów `context/archive/2026-10-04-ui-signin-contract/` | |
| CI, hooków, E2E, deployu (platform) | PR #3, #4, #5; commity z 2026-09-26 i `context/deployment/deploy-plan.md` | |

- `evidence`: od chwili, gdy reguła „tylko przez PR” trafiła do `AGENTS.md` (`21a4deb`, 2026-10-10), commity prosto na `main` dotykają tylko `docs` i szumu (synchronizacja toolkitu). Wcześniejsze capabilities (question-pool, live-sync spike, tokeny i ekran logowania) nie mają PR, więc jedynym zapisem dyskusji jest ich folder w archiwum.
- `inference`: PR-y nie mają recenzji, więc „przegląd” to pliki `reviews/*.md` w folderze zmiany, nie wątki na GitHubie. Analizuje je pas discussion.

## Unknowns

- `unknown`: czy ktokolwiek poza `CharlesOnTheWave` ma wiedzę o projekcie (np. mentorzy kursu, testerzy na telefonach). Git i forge pokazują jedną osobę. Rozmowy poza repo (czat kursu) są niewidoczne.
- `unknown`: formalna własność. Brak `CODEOWNERS`, ochrony gałęzi i rulesetów. Reguła „PR + zielone CI” z `AGENTS.md` jest umową, nie mechanizmem GitHuba (`main` niechroniony: `evidence`). Wymuszenie po stronie Workers Builds nie zostało sprawdzone.
- `unknown`: kontekst sesji agenta (prompty, odrzucone warianty). Trailer mówi tylko, jaki to model; to, co agent zaproponował, a człowiek odrzucił, nie trafia do gita, chyba że do plików planu.
- `unknown`: dwa lokalne merge'e wewnątrz gałęzi nie były analizowane (poza liczeniem z definicji).
- Grupy tematów to `inference` z tematów commitów i ścieżek, nie z czytania kodu.
- Narzędzia: nic nie instalowałem. Przy jednej osobie autorstwo na poziomie linii (np. `git-who`, `git-fame`) nic by nie dodało. Przy większym zespole warto je rozważyć.

**Pokrycie i pewność:** 154/154 liczonych commitów, 795 zmian plików, 0 nieprzypisanych, 9/9 PR zmapowanych na capabilities (0 nierozpoznanych ścieżek). Pewność liczb: wysoka (wprost ze wspólnych danych i `git`/`gh`). Pewność grup tematów: średnia.

**Uruchomione polecenia:** `git shortlog -sne` (`--all`, `--no-merges`, `--merges`, `-c`); `git log --all --format='%aN|%aE'` z haszowaniem adresów; `git for-each-ref`; `git rev-list --all --not HEAD`; `git log --first-parent --no-merges` / `--merges`; `git log -S'go only through a PR' -- AGENTS.md`; `git ls-files` (archive, changes, CODEOWNERS/mailmap); `git check-ignore`; skrypt `people_stats.py` na `.work/commits.tsv` i `.work/changes.tsv`; `gh pr list --state all --json …`; `gh api` GET: `collaborators`, `contributors`, `contents/{CODEOWNERS,.github/CODEOWNERS,docs/CODEOWNERS}`, `branches/main/protection`, `rulesets`; `gh repo view`. Surowe dane: `context/map/.work/people-*.{txt,tsv,json}`.
