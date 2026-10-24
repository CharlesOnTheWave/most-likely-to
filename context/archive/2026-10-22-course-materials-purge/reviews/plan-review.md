<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Materiały kursu poza publicznym repo

- **Plan**: context/changes/course-materials-purge/plan.md
- **Mode**: Deep (najbardziej ryzykowne twierdzenia sprawdzone wprost na repo, bez sub-agenta)
- **Date**: 2026-10-22
- **Verdict**: REVISE → SOUND po naniesieniu F1–F8 (2026-10-22)
- **Findings**: 2 critical, 3 warnings, 3 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | WARNING |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | FAIL    |
| Plan Completeness     | WARNING |

## Grounding

Grounding: 6/6 paths ✓ (`.gitignore`, `CLAUDE.md`, `.10x-cli.json`, `.claude/.10x-cli-manifest.json`, `deploy-plan.md:202`, `ci.yml:3-5`), inventory ✓ (39 skilli z manifestu, 134 + 28 + 10 + 2 pliki, 40 folderów skilli w historii = 40 w HEAD, nic nie zniknęło po drodze, brak `.agents/.cursor/.codex`), refy ✓ (5 gałęzi + `main` na GitHubie, `1153156` i `6842913` niewypchnięte, brak tagów, stash pusty, 2 worktree), główny folder ✓ (czysty, ten sam blok kursu co w `10xdevs-gra`), odwołania kodu do plików kursu ✓ (tylko 3 komentarze), brief↔plan ✓.

## Findings

### F1 — Plan sam zawiera znaczniki bloku, więc przepisanie popsuje plan.md

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 1 krok 6 (plan jedzie w PR) + Faza 2 krok 3 (`--replace-text`) + kryteria 2.4–2.6
- **Detail**: `--replace-text` działa na każdy plik w każdym commicie, nie tylko na `CLAUDE.md`. Plan, który faza 1 wrzuca do `main`, ma pełne znaczniki `BEGIN`/`END` w liniach 14 i 191. Symulacja tym samym wyrażeniem (Python `re`): `plan.md` traci 164 bajty (linia 14 → „między ``.”, linia 191 → `regex:(?s)\n?\n?==>`), `CLAUDE.md` 1646 → 41 bajtów (poprawnie). Skutek: tree SHA `main` po przepisaniu ≠ przed (2.5 pada), para z mapy różni się `plan.md` (2.6 pada), a `git log --all -G'@przeprogramowani/10x-cli'` nie będzie puste, bo plan wymienia nazwę paczki także w liniach 220 i 440 (2.4 pada). Twierdzenie z linii 14 („znacznik poza `CLAUDE.md` tylko w 10x-ui i manifeście”) było prawdziwe, dopóki nie powstał ten plan.
- **Fix**: W fazie 1, przed commitem, przepisać tekst planu (i briefu) bez dosłownych znaczników (np. „znaczniki BEGIN/END 10x-cli”), a treść `filter-repo-replace.txt` trzymać tylko w kopii zapasowej. Dodać w fazie 2, przed przepisaniem, sprawdzenie: `git grep -lE '<!-- (BEGIN|END) @przeprogramowani/10x-cli' <SHA main z github-mirror.git>` zwraca pusto. Kryterium 2.4 zawęzić do znaczników: `git log --all -G'<!-- (BEGIN|END) @przeprogramowani/10x-cli'` jest puste.
- **Decision**: FIXED

### F2 — filter-repo domyślnie zmienia SHA w opisach 35 commitów

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 2 krok 3 (polecenie) i krok 4 / kryterium 2.6; „What We're NOT Doing” (opisy commitów)
- **Detail**: `git filter-repo` domyślnie podmienia w opisach commitów stare skróty SHA na nowe. W repo 35 commitów cytuje w opisie inny commit (np. „Revert …” z pełnym SHA, `236afc3` cytuje `f5f046b`, `1153156` cytuje `2ed1304` i `5add8c9`). Kryterium 2.6 wymaga identycznego opisu, a plan deklaruje „Nie zmieniamy opisów commitów”, więc sprawdzenie padnie na 35 parach.
- **Fix A ⭐ Recommended**: Dodać `--preserve-commit-hashes` do polecenia filter-repo.
  - Strength: Opisy bajt w bajt jak dziś, 2.6 zostaje prostym porównaniem, zgodne z decyzją „nie zmieniamy opisów”; stare SHA w opisach tłumaczy ta sama mapa co SHA w `context/`.
  - Tradeoff: Linki SHA w opisach na GitHubie prowadzą do starych commitów (dostępnych przez `refs/pull/*`), czyli do drzew z plikami kursu; ten sam efekt dają już ~175 SHA w `context/` i sama mapa.
  - Confidence: HIGH — flaga opisana w dokumentacji filter-repo, wyłącza dokładnie tę podmianę.
  - Blind spot: None significant.
- **Fix B**: Zostawić domyślną podmianę i zmienić 2.6 na „opis identyczny po zamianie SHA według mapy”.
  - Strength: Linki w opisach prowadzą do nowych commitów.
  - Tradeoff: Skrypt sprawdzający robi się bardziej złożony, a plan łamie własną decyzję o opisach.
  - Confidence: MED — podmiana skrótów zachowuje długość, ale skrypt trzeba napisać i przetestować.
  - Blind spot: Skróty niejednoznaczne lub cytujące commity spoza przepisywanych refów.
- **Decision**: FIXED (Fix A: `--preserve-commit-hashes`)

### F3 — Na GitHubie zostanie szósta gałąź `course-materials-purge`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Faza 3 krok 2, kryterium 3.4; Faza 5 krok 3
- **Detail**: Dziś na GitHubie jest `main` + 5 gałęzi (sprawdzone `git ls-remote`). PR z fazy 1 wypycha gałąź `course-materials-purge` na starej historii (jej rodzic `2ed1304` ma pliki kursu). Lista do usunięcia w 3.2 wymienia tylko 5 nazw, więc pliki kursu zostałyby dostępne przez gałąź, a 3.4 nie przejdzie. Faza 5 dokłada `course-materials-purge-map` (już na nowej historii, nieszkodliwa, ale łamie „tylko `main`”).
- **Fix**: W 3.2 usuwać wszystkie gałęzie z `git ls-remote --heads origin` oprócz `main` (dziś 6, w tym `course-materials-purge`); w fazie 5 po scaleniu usunąć `course-materials-purge-map` (za zgodą).
- **Decision**: FIXED

### F4 — W `10xdevs-gra` przełączenie na starą gałąź skasuje pliki kursu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details („Główny folder”), okres między fazą 1 a fazą 4
- **Detail**: Plan chroni tylko główny folder. Po fazie 1 pliki kursu w `10xdevs-gra` są ignorowane, a stare gałęzie (`latecomer-admission`, `keep-supabase-awake`, `deferred-review-fixes`, `pr-review-agent`, `main`) wciąż je śledzą. Git domyślnie nadpisuje pliki ignorowane przy `switch`/`checkout` (`--overwrite-ignore`), a przy powrocie na gałąź bez nich kasuje je z dysku. Następny krok w pliku sesji to właśnie impl-review/archive `latecomer-admission` z commitem `1153156`.
- **Fix**: Dopisać do Critical Implementation Details: od scalenia fazy 1 do końca fazy 4 w `10xdevs-gra` żadnego `switch`/`checkout`/`reset` na stare gałęzie ani stare SHA (`cherry-pick` wolno); fazy 2–4 robimy zaraz po scaleniu fazy 1, bez innej pracy pomiędzy.
- **Decision**: FIXED

### F5 — Awaryjny powrót z `github-mirror.git` nie zadziała tak, jak zapisany

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 3 Implementation Note, Migration Notes
- **Detail**: Logowanie `gh` (z zakresem `workflow`) jest ustawione tylko w `.git/config` głównego repo (`credential.https://github.com.helper`, `deploy-plan.md:112`); `github-mirror.git` dostałby globalny `manager` z innym tokenem albo okienkiem logowania. Do tego klon `--mirror` ma `remote.origin.mirror = true`, więc push z refspec z niego to nieprzewidywalny tryb (test w piaskownicy niewykonany, odmowa uprawnień). Polecenie powrotu nie ma też `--force-with-lease`.
- **Fix**: Powrót robić z głównego repo: `git fetch <github-mirror.git> '+refs/heads/*:refs/rollback/*'`, potem `git push --force-with-lease=main:<nowy SHA main> origin refs/rollback/main:refs/heads/main` (gałęzie tak samo); dokładne polecenia wpisać do planu przed fazą 3.
- **Decision**: FIXED

### F6 — W głównym folderze można nic nie kasować

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 4 krok 2
- **Detail**: Plan godzi się, że `git switch main` skasuje pliki kursu w `10xdevs`, i przywraca je z kopii z fazy 1 (kopia może być starsza niż stan folderu w fazie 4). Główny folder jest dziś czysty, a jego blok kursu jest taki sam jak w `10xdevs-gra`.
- **Fix**: W fazie 4 w głównym folderze najpierw utworzyć `CLAUDE.local.md` z bloku i zrobić `git rm -r -q --cached` dla ścieżek kursu (tylko indeks), dopiero potem `git switch main`: Git zostawi pliki jako nieśledzone, a kopia zostaje wyłącznie zabezpieczeniem i sprawdzeniem sum.
- **Decision**: FIXED

### F7 — Sprawdzenia przed nadpisaniem `main` da się uszczelnić

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2 kroki 3–4, kryterium 2.4; Faza 3 krok 1
- **Detail**: (a) 2.4 sprawdza wynik tą samą listą, którą usuwano, więc brak folderu na liście nie zostanie wykryty. (b) `rewrite.git` pobiera `main` z URL osobno od `github-mirror.git`, czyli z dwóch migawek. (c) Brak próbnego pushu przed prawdziwym.
- **Fix**: 2.4 jako lista dozwolonych: w historii `rewrite.git` pod `.claude/skills/` tylko `playwright-cli`, nic pod `.claude/prompts/`, `.claude/config-templates/`, żadnego `.10x-cli*`; `main` do `rewrite.git` pobierać z `github-mirror.git`; przed 3.1 `git push --dry-run` tym samym poleceniem.
- **Decision**: FIXED

### F8 — Plan w repo łamie własną zasadę o ścieżkach z dysku

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details („Bez ścieżek z dysku w repo”) vs linie 54–55, 75, 164, 180, 198, 247
- **Detail**: Plan jedzie do publicznego repo w fazie 1 i podaje ścieżki folderu kopii i folderu roboczego w katalogu domowym (oraz globalnego pliku ignore gita). Nazwy użytkownika tam nie ma, ale zasada mówi „bez ścieżek z katalogu domowego”.
- **Fix**: Przy tej samej edycji co F1 zastąpić ścieżki nazwami „KOPIA” i „ROBOCZY” (prawdziwe ścieżki tylko w sesji), albo złagodzić zasadę do „bez nazwy użytkownika i pełnych ścieżek”.
- **Decision**: FIXED (placeholdery `KOPIA` i `ROBOCZY`; `Desktop\10xdevs-gra.md` zostaje, bo archiwum repo już tak go nazywa)
