# Materiały kursu poza publicznym repo: plan implementacji

## Overview

Skille, prompty i szablony kursu 10xDevs (paczki z `10x get`) oraz blok kursu w `CLAUDE.md` wychodzą z gita i z całej historii publicznego repo `CharlesOnTheWave/most-likely-to`. Lokalnie zostają i działają jak dziś. Powód: pod postem Karola na Circle („Skille 10x w publicznym repo projektu: zostawić czy usunąć?”) padła rada „wyczyść historię i dodaj do `.gitignore`”, a organizator kursu dał +1. Repo, PR-y i wdrożenie zostają bez zmian (decyzje Karola z 2026-10-22, w rozmowie przed tym planem).

## Current State Analysis

- Paczki kursu są w repo od pierwszego commita (`237a297`, 2026-09-25). Zmieniało je 25 z 214 commitów (stan przed tą zmianą, wszystkie refy lokalne i zdalne). Wszystko, co kiedykolwiek było w `.claude/`, jest też w dzisiejszym `HEAD`; żadna ścieżka kursu nie zniknęła po drodze.
- Śledzone pliki kursu:
  - `.claude/skills/`: 39 folderów, 134 pliki. Lista to klucze `files.skills` w `.claude/.10x-cli-manifest.json`: 36 × `10x-*` (w tym `10x-impl-review-ci`, którego nic w repo nie używa; recenzję w CI robi `tools/pr-review`) oraz `pack-init`, `setup-cicd`, `tf-registry`;
  - `.claude/prompts/` (28), `.claude/config-templates/` (10);
  - pliki 10x-cli: `.claude/.10x-cli-manifest.json`, `.10x-cli.json`;
  - blok kursu w `CLAUDE.md:3-28`, od znacznika BEGIN do znacznika END paczki 10x-cli (komentarze HTML w liniach 3 i 28). Plik ma 24 wersje w historii, a w pierwszej (`1f38111`) blok zaczyna plik. Przed tym planem znaczniki były w historii poza `CLAUDE.md` tylko w `.claude/skills/10x-ui/SKILL.md` i w manifeście, które i tak wychodzą. Dosłownego tekstu znaczników nie piszemy w żadnym pliku repo, także w tym planie: `--replace-text` z fazy 2 działa na każdy plik w każdym commicie.
- Nasze i zostają: `.claude/hooks/`, `.claude/settings.json`, `AGENTS.md`, `CLAUDE.md:1` (`@AGENTS.md`), `context/`, `tools/pr-review/`, `.github/workflows/ai-review.yml`. Zostaje też `.claude/skills/playwright-cli` (11 plików, skill Microsoftu z `@playwright/cli`, M3L4, wskazany w `context/foundation/test-stack.md:17`), a w historii `CLAUDE.md.scaffold` i odwołania do publicznego startera `10x-astro-starter`.
- Repo: publiczne, 0 forków, 0 gwiazdek, `main` bez ochrony gałęzi i bez rulesetów. Na GitHubie są `main` i 5 gałęzi ze scalonymi PR-ami (`claude/practical-faraday-tpe4vl`, `deferred-review-fixes`, `keep-supabase-awake`, `latecomer-admission`, `pr-review-agent`) oraz 15 refów `refs/pull/N` (wszystkie PR-y scalone).
- Lokalnie oba foldery (`10xdevs-gra` i główny `10xdevs` z `main`) dzielą jedno `.git`. Dwa commity nie są na GitHubie: `1153156` (`latecomer-admission`, Progress fazy 4) i `6842913` (`keep-supabase-awake`, Progress fazy 3). Stash jest pusty.
- Każdy push do `main` buduje i wdraża Workers Builds, nawet gdy CI pada (`context/deployment/deploy-plan.md:7`). CI rusza na push do `main` (`.github/workflows/ci.yml:4-5`).
- Wszystkie commity mają autora i commitera z adresem noreply (197 × Karol, 15 scaleń GitHuba, 2 × Claude), więc ustawienie „Block command line pushes that expose my email” niczego nie zablokuje.
- Python 3.12 jest (`py`, `python`), `git filter-repo` nie. Git 2.55.

## Desired End State

- Ani `main` na GitHubie, ani żaden nowy klon nie zawiera plików kursu, w żadnym commicie. `CLAUDE.md` we wszystkich wersjach ma tylko nasz tekst.
- Na GitHubie jest tylko gałąź `main`. Jej pliki są bajt w bajt takie jak przed przepisaniem (ten sam tree SHA), więc wdrożenie po nadpisaniu zbudowało identyczną grę, a smoke jest zielony.
- Każdy stary commit ma dokładnie jeden nowy odpowiednik. Mapa „stary SHA → nowy SHA” jest w `context/deployment/history-rewrite-2026-10-22.md`.
- W obu lokalnych folderach skille kursu, prompty, szablony, pliki 10x-cli i blok kursu (teraz w `CLAUDE.local.md`) są na dysku, poza gitem, i działają w świeżej sesji. `.gitignore` nie pozwala ich znów dodać.
- Na dysku Karola leżą dwie pełne kopie starej historii (z GitHuba i lokalna) oraz kopia plików kursu z obu folderów.

### Key Discoveries:

- Według dokumentacji GitHuba („Removing sensitive data from a repository”) po wymuszonym pushu stare commity zostają dostępne pod SHA i przez PR-y, które się do nich odwołują. `refs/pull/*` są tylko do odczytu, a „GitHub Support won't remove non-sensitive data”. Materiały kursu nie są sekretem, więc ta resztka zostaje (decyzja Karola: ścieżka A, bez kasowania repo).
- Historię przepisywaliśmy już raz, `git filter-branch`, przy usuwaniu maila z commitów. Strażnik trybu auto zablokował wtedy polecenie agentowi i uruchomił je Karol (`context/deployment/deploy-plan.md:115`).
- Świeża sesja Claude Code (2.1.308, `claude -p`) wczytuje `CLAUDE.local.md` z katalogu projektu: test w pustym folderze 2026-10-22 zwrócił hasło zapisane tylko w tym pliku.
- `.claude/settings.local.json` już jest ignorowany przez globalny plik ignore gita Karola (pierwsza linia), więc nie trzeba go dopisywać.
- 35 commitów cytuje w opisie inny commit (np. „Revert …” z pełnym SHA, `1153156` cytuje `2ed1304`). `git filter-repo` domyślnie podmienia takie numery na nowe; `--preserve-commit-hashes` to wyłącza.
- Logowanie `gh` (z zakresem `workflow`) jest ustawione tylko w `.git/config` tego repo (`credential.https://github.com.helper`, `deploy-plan.md:112`). Inne repo na dysku, np. kopia `--mirror`, pushowałoby przez globalny menedżer haseł, więc wszystkie pushe idą z głównego repo.
- Git domyślnie nadpisuje pliki ignorowane przy `switch`/`checkout` (`--overwrite-ignore`). Gdy stara gałąź śledzi pliki kursu, przejście na nią i powrót kasuje je z dysku.
- Po fazie 1 `main` nie zawiera plików kursu ani bloku, więc przepisanie nie zmienia jego drzewa. Równość tree SHA przed i po to najmocniejszy dowód, że gra się nie zmieniła.

## What We're NOT Doing

- Nie kasujemy ani nie zakładamy repo od nowa i nie piszemy do GitHub Support. Stare commity pod `refs/pull/*` i pod bezpośrednim SHA zostają (przyjęte ryzyko z dokumentacji GitHuba).
- Nie edytujemy `context/archive/`. Około 175 starych SHA w `context/` zostaje w tekście; tłumaczy je mapa z fazy 5.
- Nie zmieniamy opisów commitów, choć niektóre wymieniają lekcje (np. „Add M1L4 lesson package”). To tylko nazwy, nie treść. Numery commitów cytowane w 35 opisach też zostają stare (`--preserve-commit-hashes`); tłumaczy je mapa z fazy 5.
- Nie ruszamy `playwright-cli`, `tools/pr-review/`, `ai-review.yml`, odwołań do startera ani trzech komentarzy ze ścieżką do lokalnego skilla lub szablonu (`scripts/ui-literals.mjs:20`, `tests/hooks/agent-hooks.test.ts:10`, `tools/pr-review/src/review-schema.ts:1`); lokalnie wciąż prowadzą do pliku.
- Nie podpisujemy na nowo 15 commitów scalenia: po przepisaniu tracą znaczek „Verified” GitHuba.
- Nie czyścimy lokalnego `.git` (`reflog expire`, `gc`) i nie usuwamy kopii zapasowych ani folderu roboczego. O ich usunięciu decyduje Karol, nie przed certyfikacją (04.11.2026).
- Nie obsługujemy przyszłego `10x get`. Kurs jest skończony; gdyby jednak padło, 10x-cli wpisze blok z powrotem do `CLAUDE.md` i trzeba go przenieść do `CLAUDE.local.md` przed commitem.

## Implementation Approach

Dwa etapy. Najpierw zwykły PR (faza 1) przestaje śledzić pliki kursu, więc od tej chwili `main` ich nie ma. Dopiero potem przepisujemy starą historię (fazy 2–3), a ponieważ końcowe drzewo `main` już się nie zmienia, nadpisanie `main` wdraża tę samą grę. Całe przepisanie dzieje się na osobnej kopii (`ROBOCZY/rewrite.git`), z dwoma kopiami zapasowymi zrobionymi tuż przed nim. Na GitHuba trafia wyłącznie przepisany `main`, a wszystkie inne gałęzie tam usuwamy. Lokalne foldery przestawiamy na końcu (faza 4) tak, żeby Git nie skasował plików kursu: w `10xdevs-gra` są już nieśledzone, w głównym folderze najpierw wyjmujemy je z indeksu. Kopia plików kursu służy do sprawdzenia sum i do przywrócenia, gdyby czegoś brakowało. Mapę numerów zapisujemy w osobnym PR (faza 5), bo nowe numery istnieją dopiero po przepisaniu.

Miejsca na dysku (poza repo, nie w scratchpadzie sesji). Dokładne ścieżki ustala sesja w katalogu domowym Karola i nie wpisuje ich do repo; w tym planie nazywają się:

- `KOPIA` (folder kopii zapasowej z datą 2026-10-22): `course-files/10xdevs-gra/`, `course-files/10xdevs/`, sumy kontrolne, `github-mirror.git`, `local-mirror.git`, `filter-repo-paths.txt`, `filter-repo-replace.txt`, `commit-map.txt`;
- `ROBOCZY` (folder roboczy przepisania): `rewrite.git` i `verify.git`.

## Critical Implementation Details

- **Kolejność.** Faza 2 zaczyna się dopiero po scaleniu i wdrożeniu PR z fazy 1. Od kopii z GitHuba (2.1) do nadpisania `main` (3.1) nikt nie pushuje na `main`; `--force-with-lease` z SHA z kopii odrzuci push, gdyby ktoś to zrobił.
- **Główny folder.** Przed fazą 4 w `10xdevs` nie robimy `git pull`, `switch` ani `reset`: przejście na commit bez plików kursu skasowałoby je z dysku. Folder ruszamy tylko w kroku 4 i za zgodą Karola. W fazie 1 jedynie kopiujemy z niego pliki (odczyt).
- **`10xdevs-gra` między fazą 1 a 4.** Pliki kursu są tam już ignorowane, a stare gałęzie (`latecomer-admission`, `keep-supabase-awake`, `deferred-review-fixes`, `pr-review-agent`, `main`) wciąż je śledzą. Od scalenia PR fazy 1 do końca fazy 4 żadnego `switch`, `checkout`, `reset` ani `restore --source` na stare gałęzie lub stare SHA (wolno `cherry-pick`, `log`, `show`). Fazy 2–4 robimy zaraz po scaleniu fazy 1, bez innej pracy pomiędzy.
- **Strażnik trybu auto** może zablokować agentowi `filter-repo` i wymuszony push (jak 26.09). Wtedy agent wypisuje polecenie, a Karol uruchamia je z `!`.
- **Bez ścieżek z dysku w repo.** Pliki repo (mapa, notatki) nie podają ścieżek z katalogu domowego ani danych Karola; o kopiach piszemy „kopia zapasowa na dysku właściciela”.
- **Numery fazy 1 w tym planie** (sufiksy Progress) po przepisaniu wskazują stare commity. Faza 5 zamienia je na nowe według mapy (to zmiana w `context/changes/`, nie w archiwum).

## Faza 1: Zwykły PR: pliki kursu poza gitem

### Overview

Kopia plików kursu z obu folderów, usunięcie ich z indeksu gita (pliki zostają na dysku), reguły w `.gitignore`, blok kursu do `CLAUDE.local.md`. Zwykły cykl: bramka, PR, zielone CI, scala Karol, smoke na produkcji.

### Changes Required:

#### 1. Kopia plików kursu (poza repo)

**File**: `KOPIA/course-files/{10xdevs-gra,10xdevs}/`

**Intent**: Zabezpieczyć pliki kursu z obu folderów, zanim cokolwiek zmieni się w gicie, bo fazy 4 i ewentualne cofnięcie przywracają je właśnie stąd. Z głównego folderu tylko kopiujemy (odczyt).

**Contract**: W każdej kopii, z zachowaniem ścieżek względnych: 39 folderów skilli z manifestu, `.claude/prompts/`, `.claude/config-templates/`, `.claude/.10x-cli-manifest.json`, `.10x-cli.json` i `CLAUDE.md` (wersja z blokiem). Obok plik sum `sha256sum` dla każdej kopii; liczby plików zgadzają się z inwentaryzacją (134 + 28 + 10 + 2 + 1).

#### 2. Usunięcie z indeksu gita

**File**: pliki kursu wymienione w Current State Analysis

**Intent**: Przestać śledzić pliki kursu bez kasowania ich z dysku.

**Contract**: `git rm -r --cached` dla 39 folderów skilli, `.claude/prompts/`, `.claude/config-templates/`, `.claude/.10x-cli-manifest.json`, `.10x-cli.json`. `.claude/skills/playwright-cli/` zostaje śledzony.

#### 3. Reguły w `.gitignore`

**File**: `.gitignore`

**Intent**: Nie dopuścić do ponownego dodania plików kursu, łącznie z nowym `CLAUDE.local.md`.

**Contract**: Nowa sekcja na końcu pliku. Wzorzec `10x-*/` nie łapie `playwright-cli`:

```gitignore
# 10xDevs course packages (`10x get`): local only, never in git
.10x-cli.json
.claude/.10x-cli-manifest.json
.claude/config-templates/
.claude/prompts/
.claude/skills/10x-*/
.claude/skills/pack-init/
.claude/skills/setup-cicd/
.claude/skills/tf-registry/
CLAUDE.local.md
```

#### 4. Blok kursu do `CLAUDE.local.md`

**File**: `CLAUDE.md`, `CLAUDE.local.md` (nowy, poza gitem)

**Intent**: Router skilli i twarde zasady lekcji dalej docierają do każdej sesji, ale nie są w repo.

**Contract**: `CLAUDE.md` = jedna linia `Project rules for all agents: @AGENTS.md` i znak nowej linii. `CLAUDE.local.md` = dotychczasowe `CLAUDE.md:3-28` dosłownie, razem ze znacznikami `BEGIN`/`END`.

#### 5. Notatka w planie wdrożenia

**File**: `context/deployment/deploy-plan.md:202`

**Intent**: Wpis „Paczki kursu w publicznym repo” opisuje stan sprzed tej zmiany.

**Contract**: Pod tym punktem podpunkt w konwencji pliku: „→ 22.10.2026 (`course-materials-purge`): pliki kursu poza gitem i w `.gitignore`, blok kursu w `CLAUDE.local.md`; historia do przepisania w fazach 2–5 tego planu.”

#### 6. Folder zmiany

**File**: `context/changes/course-materials-purge/{change.md,plan.md,plan-brief.md}`

**Intent**: Plan, brief i przegląd planu jadą w tym samym PR.

**Contract**: cały folder zmiany (z `reviews/`), bez zmian treści poza Progress fazy 1. Przed commitem `git grep -nE '<!-- (BEGIN|END) @przeprogramowani/10x-cli'` w drzewie gałęzi jest puste: żaden plik repo nie może zawierać znaczników bloku (Current State Analysis).

### Success Criteria:

#### Automated Verification:

- Kopia plików kursu z obu folderów zgodna z sumami kontrolnymi (134 + 28 + 10 + 2 + 1 plików na folder)
- `git ls-files` nie zawiera plików kursu, `.claude/skills/playwright-cli` (11 plików) dalej jest śledzony, a `git grep -nE '<!-- (BEGIN|END) @przeprogramowani/10x-cli'` jest puste
- Pliki kursu są na dysku (40 folderów w `.claude/skills/`), `git status --short` ich nie pokazuje, a `git check-ignore -v` wskazuje nową sekcję `.gitignore`
- Świeża sesja `claude -p` w `10xdevs-gra` cytuje nagłówek bloku kursu z `CLAUDE.local.md` i zna skill `10x-plan`
- Bramka przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- PR ma zielone CI (`ci`, `smoke`, `db`, `e2e`)

#### Manual Verification:

- Karol scala PR (`! gh pr merge <n> --merge`), a smoke na produkcji (za zgodą) jest zielony
- Karol w Claude Code w `10xdevs-gra` widzi skille po wpisaniu `/10x-`

**Implementation Note**: Po fazie 1 pauza na scalenie i ręczne sprawdzenie. Głównego folderu nie aktualizujemy, a w `10xdevs-gra` nie przechodzimy na stare gałęzie (Critical Implementation Details).

---

## Faza 2: Przepisanie na kopii, nic na zewnątrz

### Overview

Dwie pełne kopie zapasowe, instalacja `git filter-repo` za zgodą Karola, przepisanie w `rewrite.git` i sprawdzenie wyniku. Nic nie trafia na GitHuba ani do lokalnych folderów.

### Changes Required:

#### 1. Kopie zapasowe całej historii

**File**: `KOPIA/github-mirror.git`, `KOPIA/local-mirror.git`

**Intent**: Pełny stan sprzed przepisania z obu źródeł: GitHub ma `refs/pull/*` i gałąź `claude/practical-faraday-tpe4vl`, a tylko lokalne repo ma dwa niewypchnięte commity.

**Contract**: `git clone --mirror https://github.com/CharlesOnTheWave/most-likely-to.git` oraz `git clone --mirror --no-local` głównego repo. Zapisać SHA `main` z `github-mirror.git` (to wartość dla `--force-with-lease` w fazie 3) i wynik `git show-ref` obu kopii. Z kopii tylko czytamy i pobieramy; nigdy z nich nie pushujemy (klon `--mirror` i brak logowania `gh`).

#### 2. Narzędzie

**File**: brak (instalacja w Pythonie użytkownika)

**Intent**: `git filter-repo` przepisuje historię jednym poleceniem i sam zapisuje mapę commitów. Instalacja tylko po wyraźnej zgodzie Karola.

**Contract**: `py -m pip install --user git-filter-repo`, potem `py -m git_filter_repo --version`. Jeśli wywołanie modułem nie działa, skrypt `git-filter-repo` z katalogu `Scripts` Pythona użytkownika, uruchamiany przez `py`.

#### 3. Kopia robocza i przepisanie

**File**: `ROBOCZY/rewrite.git`, `KOPIA/filter-repo-{paths,replace}.txt`

**Intent**: Wyciąć pliki kursu i blok z `CLAUDE.md` ze wszystkich commitów wszystkich gałęzi, tak żeby każdy stary commit miał jeden nowy odpowiednik.

**Contract**:

- `rewrite.git` = `git clone --bare --no-local` głównego repo (lokalne gałęzie, w tym oba niewypchnięte commity), potem `refs/heads/main` z `github-mirror.git` (`git fetch KOPIA/github-mirror.git +refs/heads/main:refs/heads/main`; lokalny `main` jest w tyle). Dzięki temu przepisany `main` pochodzi z tej samej migawki co SHA dla `--force-with-lease`. Przed przepisaniem zapisać `git rev-list --all --count`.
- Przed przepisaniem `git grep -lE '<!-- (BEGIN|END) @przeprogramowani/10x-cli' <SHA main z github-mirror.git>` jest puste. Inaczej `--replace-text` zmieni drzewo `main` i 2.5 nie przejdzie.
- `filter-repo-paths.txt`: po jednej linii na każdy z 39 folderów skilli (`.claude/skills/<nazwa>/`), `.claude/prompts/`, `.claude/config-templates/`, `.claude/.10x-cli-manifest.json`, `.10x-cli.json`.
- `filter-repo-replace.txt`, jedna linia, tylko w `KOPIA`, nigdy w repo: `regex:(?s)\n?` + linia 3 obecnego `CLAUDE.md` (znacznik BEGIN, dosłownie) + `.*?` + linia 28 (znacznik END, dosłownie) + `\n?==>`. Usuwa blok razem z pustą linią przed nim; z `L1\n\n<blok>\n` zostaje `L1\n`. Przed przepisaniem symulacja tym wyrażeniem (Python `re`, bajty) na `CLAUDE.md` z `KOPIA/course-files/10xdevs-gra/` daje dokładnie `Project rules for all agents: @AGENTS.md\n` (41 bajtów).
- Polecenie, w `rewrite.git`. `--force` jest potrzebne, bo po `fetch` kopia nie jest „świeżym klonem”; dotyczy tylko tej kopii. `--preserve-commit-hashes` zostawia opisy commitów bez zmian (Current State Analysis):

```bash
py -m git_filter_repo --force --invert-paths \
  --paths-from-file KOPIA/filter-repo-paths.txt \
  --replace-text KOPIA/filter-repo-replace.txt \
  --preserve-commit-hashes \
  --prune-empty never --prune-degenerate never
```

- `filter-repo/commit-map` z `rewrite.git` skopiowany do `KOPIA/commit-map.txt`.

#### 4. Sprawdzenie wyniku

**File**: `ROBOCZY/verify.git`, skrypt sprawdzający w scratchpadzie sesji (nie w repo)

**Intent**: Udowodnić przed publikacją, że przepisanie usunęło tylko pliki kursu i blok, i niczego więcej nie zmieniło.

**Contract**: `verify.git` (pusty bare) pobiera `local-mirror.git` `refs/heads/*` → `refs/old/*`, `github-mirror.git` `refs/heads/main` → `refs/old/gh-main` i `rewrite.git` `refs/heads/*` → `refs/new/*`. Dla każdej pary z mapy: `git diff --name-only <stary> <nowy>` zawiera tylko ścieżki z `filter-repo-paths.txt` i `CLAUDE.md`, a autor, committer, obie daty i opis są identyczne.

### Success Criteria:

#### Automated Verification:

- Obie kopie zapasowe przechodzą `git fsck`; `github-mirror.git` ma 15 refów `refs/pull/*`, `local-mirror.git` ma commity `1153156` i `6842913`
- `py -m git_filter_repo --version` działa (instalacja za zgodą Karola)
- `git rev-list --all --count` w `rewrite.git` po przepisaniu równa się liczbie sprzed
- W historii `rewrite.git` (`git log --all --format= --name-only`) pod `.claude/skills/` jest tylko `playwright-cli`, nic pod `.claude/prompts/` i `.claude/config-templates/`, żadnego `.10x-cli.json` ani `.claude/.10x-cli-manifest.json`, a `git log --all -G'<!-- (BEGIN|END) @przeprogramowani/10x-cli'` jest puste
- Tree SHA `main` w `rewrite.git` równa się tree SHA `main` w `github-mirror.git`
- Każda para z mapy różni się tylko plikami kursu i `CLAUDE.md`; autor, daty i opis bez zmian; `playwright-cli` jest w nowych commitach tam, gdzie był w starych
- Mapa skopiowana do kopii zapasowej, a oba niewypchnięte commity mają w niej odpowiedniki na przepisanych gałęziach

#### Manual Verification:

- Karol akceptuje wynik sprawdzeń przed fazą 3

**Implementation Note**: Faza 2 niczego nie publikuje. Gdy coś się nie zgadza, `rewrite.git` i `verify.git` usuwamy (za zgodą) i powtarzamy od kroku 3.

---

## Faza 3: Publikacja na GitHubie (nie do cofnięcia bez kopii)

### Overview

Nadpisanie `main` przepisaną wersją, sprawdzenie CI, wdrożenia i smoke, potem usunięcie wszystkich innych gałęzi na GitHubie (5 scalonych i `course-materials-purge` z fazy 1). Każdy push za osobną zgodą Karola.

### Changes Required:

#### 1. Nadpisanie `main`

**File**: lokalne repo (namespace `refs/purge/*`), `main` na GitHubie

**Intent**: Wypchnąć przepisany `main` z istniejącego repo, które ma już logowanie `gh`, tylko jeśli GitHub nadal ma `main` z kopii.

**Contract**: `git ls-remote origin refs/heads/main` równe SHA z kopii; `git fetch ROBOCZY/rewrite.git '+refs/heads/*:refs/purge/*'` (żadna gałąź się nie zmienia); potem za zgodą najpierw próba `git push --dry-run` tym samym poleceniem (jedna linia: `refs/purge/main -> main (forced update)`), a dopiero po niej:

```bash
git push --force-with-lease=main:<SHA main z github-mirror.git> origin refs/purge/main:refs/heads/main
```

Push zawiera commity z `.github/workflows/`, więc token `gh` potrzebuje zakresu `workflow` (jest od M1L5, `deploy-plan.md:110`).

#### 2. Usunięcie pozostałych gałęzi

**File**: gałęzie na GitHubie

**Intent**: Na GitHubie zostaje tylko przepisany `main`; strony PR-ów zostają.

**Contract**: lista z `git ls-remote --heads origin` bez `main`: dziś `claude/practical-faraday-tpe4vl`, `deferred-review-fixes`, `keep-supabase-awake`, `latecomer-admission`, `pr-review-agent`, a po fazie 1 także `course-materials-purge` (stara historia, jej rodzic ma pliki kursu). Za zgodą `git push origin --delete <wszystkie z listy>`.

### Success Criteria:

#### Automated Verification:

- `git ls-remote origin refs/heads/main` wskazuje przepisany `main` (push z `--force-with-lease`, za zgodą)
- CI na nowym `main` zielone, check „Workers Builds: most-likely-to” ma `success`, a `npx wrangler deployments list` pokazuje nowe wdrożenie
- Drzewo `main` na GitHubie (`gh api repos/CharlesOnTheWave/most-likely-to/git/trees/main?recursive=1`) nie zawiera plików kursu
- `git ls-remote origin` pokazuje z gałęzi tylko `main` (6 pozostałych usuniętych za zgodą)

#### Manual Verification:

- Smoke na produkcji (za zgodą) jest zielony
- Karol na GitHubie widzi repo bez folderów kursu, z 15 PR-ami na miejscu

**Implementation Note**: Awaryjny powrót, zawsze z głównego repo (tylko ono ma logowanie `gh`): `git fetch KOPIA/github-mirror.git '+refs/heads/*:refs/rollback/*'`, potem za zgodą `git push --force-with-lease=main:<SHA przepisanego main> origin refs/rollback/main:refs/heads/main` i w razie potrzeby gałęzie (`refs/rollback/<nazwa>:refs/heads/<nazwa>`); na końcu usunąć `refs/rollback/*`. Wdrożenie cofa `npx wrangler rollback` (ask).

---

## Faza 4: Przestawienie obu folderów

### Overview

Lokalne gałęzie i oba foldery przechodzą na nową historię. Pliki kursu zostają na miejscu; kopia służy do sprawdzenia sum. Główny folder ruszamy dopiero po zgodzie Karola w tym kroku.

### Changes Required:

#### 1. Lokalne gałęzie

**File**: lokalne repo (`refs/heads/*`, `refs/remotes/origin/*`)

**Intent**: Każda lokalna gałąź wskazuje swój przepisany odpowiednik, a refy usuniętych gałęzi zdalnych znikają.

**Contract**: oba foldery najpierw `git switch --detach` (bez zmian plików; główny za zgodą), potem `git fetch . '+refs/purge/*:refs/heads/*'`, `git fetch origin --prune`, `git branch --unset-upstream` dla gałęzi bez odpowiednika na GitHubie, na końcu usunięcie `refs/purge/*`.

#### 2. Foldery i pliki kursu

**File**: `10xdevs-gra`, `10xdevs`

**Intent**: Oba foldery na nowych commitach, a Git nie kasuje przy tym żadnego pliku kursu.

**Contract**: główny folder, w tej kolejności: `CLAUDE.local.md` z linii 3–28 obecnego `CLAUDE.md` (dosłownie), `git rm -r -q --cached` dla ścieżek z `filter-repo-paths.txt` (zmienia tylko indeks, pliki zostają na dysku), dopiero potem `git switch main`. Pliki kursu nie są już w indeksie, więc przejście ich nie rusza; `CLAUDE.md` dostaje jedną linię, a `.gitignore` z nowego `main` je ignoruje. Gdyby czegoś brakowało, wraca z `KOPIA/course-files/10xdevs/`. `10xdevs-gra` przechodzi na przepisany `course-materials-purge`; pliki kursu są tam już nieśledzone, a drzewa starego i nowego commita są równe, więc nic się nie zmienia. Niezwiązane pliki poza gitem (`node_modules`, `.dev.vars`, `.claude/settings.local.json`, `supabase/.temp`) Git zostawia.

### Success Criteria:

#### Automated Verification:

- Lokalne gałęzie wskazują przepisane commity z mapy, a `origin/*` nie ma usuniętych gałęzi
- Oba foldery stoją na nowej historii, `git status --short` w obu jest puste
- Pliki kursu w obu folderach zgadzają się z sumami kontrolnymi kopii (40 folderów w `.claude/skills/`) i są ignorowane
- Świeża sesja `claude -p` w obu folderach cytuje nagłówek bloku kursu i zna skill `10x-plan`

#### Manual Verification:

- Karol w Claude Code w obu folderach widzi skille po wpisaniu `/10x-`

**Implementation Note**: Gdy sumy się nie zgadzają, pliki kursu wracają z `KOPIA/course-files/`; gałęzie odtwarza `local-mirror.git`.

---

## Faza 5: Zapis i sprzątanie

### Overview

Osobny mały PR z mapą numerów i poprawionymi numerami w tym planie, odinstalowanie narzędzia, aktualizacja pamięci i pliku sesji na pulpicie.

### Changes Required:

#### 1. Mapa numerów commitów

**File**: `context/deployment/history-rewrite-2026-10-22.md` (nowy)

**Intent**: Stare SHA z `context/` (także z archiwum) da się przetłumaczyć na nowe bez edytowania archiwum.

**Contract**: krótki opis (co, kiedy, dlaczego, link do tego planu, przyjęte ryzyko z PR-ami), potem jedna linia na commit: pełny stary SHA, pełny nowy SHA, pierwsza linia opisu. Liczba linii = liczba commitów w `rewrite.git`. Bez ścieżek z dysku i danych Karola.

#### 2. Numery w tym planie i notatka wdrożenia

**File**: `context/changes/course-materials-purge/plan.md` (Progress), `context/deployment/deploy-plan.md:202`

**Intent**: Sufiksy SHA fazy 1 wskazują stare commity; notatka wdrożenia dostaje wynik.

**Contract**: sufiksy Progress zamienione według mapy; drugi podpunkt „→” pod `deploy-plan.md:202` z odesłaniem do mapy.

#### 3. Gałąź i PR

**File**: gałąź `course-materials-purge-map` od nowego `origin/main`, bez upstreamu

**Intent**: Zwykły cykl: bramka, push (zgoda), PR, zielone CI, scala Karol.

**Contract**: `git switch -c course-materials-purge-map origin/main`, `git branch --unset-upstream`. Po scaleniu za zgodą `git push origin --delete course-materials-purge-map`, żeby na GitHubie znów był tylko `main`.

#### 4. Sprzątanie lokalne

**File**: Python użytkownika, pamięć `gra-terminal-2`, `Desktop\10xdevs-gra.md` („Stan”)

**Intent**: Narzędzie z jednorazowym zadaniem wychodzi, a notatki poza repo mają nowe numery (`1153156`, `6842913`, `2ed1304` i inne wymienione tam SHA).

**Contract**: `py -m pip uninstall git-filter-repo` za zgodą; numery według mapy.

### Success Criteria:

#### Automated Verification:

- `context/deployment/history-rewrite-2026-10-22.md` ma tyle wierszy mapy, ile commitów jest w `rewrite.git`, i nie zawiera ścieżek z dysku
- Sufiksy SHA w Progress tego planu wskazują commity obecne na nowym `main`
- Bramka przechodzi, a PR ma zielone CI
- `git filter-repo` odinstalowane (za zgodą)

#### Manual Verification:

- Karol scala PR, a smoke na produkcji (za zgodą) jest zielony; potem `git ls-remote --heads origin` pokazuje tylko `main`
- Pamięć `gra-terminal-2` i „Stan” w `Desktop\10xdevs-gra.md` mają nowe numery i stan zmiany

---

## Testing Strategy

### Unit Tests:

- Brak nowych. Kod gry się nie zmienia; bramka i CI (fazy 1 i 5) pilnują, że nic się nie zepsuło.

### Integration Tests:

- Skrypt sprawdzający z fazy 2 (para po parze z mapy) i równość tree SHA `main` zastępują testy: dowodzą, że przepisanie zmieniło tylko pliki kursu i blok.
- CI na nowym `main` i smoke na produkcji po fazie 3.

### Manual Testing Steps:

1. Po fazie 1: `/10x-` w Claude Code w `10xdevs-gra` pokazuje skille.
2. Po fazie 3: repo na GitHubie bez `.claude/skills/10x-*`, `.claude/prompts/`, `.claude/config-templates/`; 15 PR-ów na miejscu.
3. Po fazie 4: `/10x-` w obu folderach pokazuje skille, a sesja zna router kursu.

## Performance Considerations

Brak. 214 commitów to sekundy dla `filter-repo`.

## Migration Notes

- Faza 1: zwykły revert PR.
- Fazy 2: nic nie wychodzi poza folder roboczy; powtórka od zera.
- Faza 3: stary `main` i gałęzie pobrane z `github-mirror.git` do głównego repo i stamtąd wypchnięte (`--force-with-lease`, za zgodą; Implementation Note fazy 3), wdrożenie cofa `npx wrangler rollback` (ask).
- Faza 4: gałęzie z `local-mirror.git`, pliki kursu z `KOPIA/course-files/`.

## References

- Dokumentacja GitHuba: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
- Poprzednie przepisanie historii (maile): `context/deployment/deploy-plan.md:113-116`
- Wdrożenie i Workers Builds: `context/deployment/deploy-plan.md:7`, `:160-177`
- Lista skilli kursu: `files.skills` w `.claude/.10x-cli-manifest.json` (lokalnie)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Zwykły PR: pliki kursu poza gitem

#### Automated

- [x] 1.1 Kopia plików kursu z obu folderów zgodna z sumami kontrolnymi (134 + 28 + 10 + 2 + 1 plików na folder) — b71446c
- [x] 1.2 `git ls-files` nie zawiera plików kursu, `.claude/skills/playwright-cli` (11 plików) dalej jest śledzony, a `git grep -nE '<!-- (BEGIN|END) @przeprogramowani/10x-cli'` jest puste — b71446c
- [x] 1.3 Pliki kursu są na dysku (40 folderów w `.claude/skills/`), `git status --short` ich nie pokazuje, a `git check-ignore -v` wskazuje nową sekcję `.gitignore` — b71446c
- [x] 1.4 Świeża sesja `claude -p` w `10xdevs-gra` cytuje nagłówek bloku kursu z `CLAUDE.local.md` i zna skill `10x-plan` — b71446c
- [x] 1.5 Bramka przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — b71446c
- [x] 1.6 PR ma zielone CI (`ci`, `smoke`, `db`, `e2e`)

#### Manual

- [x] 1.7 Karol scala PR (`! gh pr merge <n> --merge`), a smoke na produkcji (za zgodą) jest zielony
- [x] 1.8 Karol w Claude Code w `10xdevs-gra` widzi skille po wpisaniu `/10x-`

### Phase 2: Przepisanie na kopii, nic na zewnątrz

#### Automated

- [x] 2.1 Obie kopie zapasowe przechodzą `git fsck`; `github-mirror.git` ma 15 refów `refs/pull/*`, `local-mirror.git` ma commity `1153156` i `6842913`
- [x] 2.2 `py -m git_filter_repo --version` działa (instalacja za zgodą Karola)
- [x] 2.3 `git rev-list --all --count` w `rewrite.git` po przepisaniu równa się liczbie sprzed
- [x] 2.4 W historii `rewrite.git` (`git log --all --format= --name-only`) pod `.claude/skills/` jest tylko `playwright-cli`, nic pod `.claude/prompts/` i `.claude/config-templates/`, żadnego `.10x-cli.json` ani `.claude/.10x-cli-manifest.json`, a `git log --all -G'<!-- (BEGIN|END) @przeprogramowani/10x-cli'` jest puste
- [x] 2.5 Tree SHA `main` w `rewrite.git` równa się tree SHA `main` w `github-mirror.git`
- [x] 2.6 Każda para z mapy różni się tylko plikami kursu i `CLAUDE.md`; autor, daty i opis bez zmian; `playwright-cli` jest w nowych commitach tam, gdzie był w starych
- [x] 2.7 Mapa skopiowana do kopii zapasowej, a oba niewypchnięte commity mają w niej odpowiedniki na przepisanych gałęziach

#### Manual

- [x] 2.8 Karol akceptuje wynik sprawdzeń przed fazą 3

### Phase 3: Publikacja na GitHubie (nie do cofnięcia bez kopii)

#### Automated

- [x] 3.1 `git ls-remote origin refs/heads/main` wskazuje przepisany `main` (push z `--force-with-lease`, za zgodą)
- [x] 3.2 CI na nowym `main` zielone, check „Workers Builds: most-likely-to” ma `success`, a `npx wrangler deployments list` pokazuje nowe wdrożenie
- [x] 3.3 Drzewo `main` na GitHubie (`gh api repos/CharlesOnTheWave/most-likely-to/git/trees/main?recursive=1`) nie zawiera plików kursu
- [x] 3.4 `git ls-remote origin` pokazuje z gałęzi tylko `main` (6 pozostałych usuniętych za zgodą)

#### Manual

- [x] 3.5 Smoke na produkcji (za zgodą) jest zielony
- [x] 3.6 Karol na GitHubie widzi repo bez folderów kursu, z 15 PR-ami na miejscu

### Phase 4: Przestawienie obu folderów

#### Automated

- [x] 4.1 Lokalne gałęzie wskazują przepisane commity z mapy, a `origin/*` nie ma usuniętych gałęzi
- [x] 4.2 Oba foldery stoją na nowej historii, `git status --short` w obu jest puste
- [x] 4.3 Pliki kursu w obu folderach zgadzają się z sumami kontrolnymi kopii (40 folderów w `.claude/skills/`) i są ignorowane
- [x] 4.4 Świeża sesja `claude -p` w obu folderach cytuje nagłówek bloku kursu i zna skill `10x-plan`

#### Manual

- [x] 4.5 Karol w Claude Code w obu folderach widzi skille po wpisaniu `/10x-`

### Phase 5: Zapis i sprzątanie

#### Automated

- [x] 5.1 `context/deployment/history-rewrite-2026-10-22.md` ma tyle wierszy mapy, ile commitów jest w `rewrite.git`, i nie zawiera ścieżek z dysku
- [x] 5.2 Sufiksy SHA w Progress tego planu wskazują commity obecne na nowym `main`
- [ ] 5.3 Bramka przechodzi, a PR ma zielone CI
- [x] 5.4 `git filter-repo` odinstalowane (za zgodą)

#### Manual

- [ ] 5.5 Karol scala PR, a smoke na produkcji (za zgodą) jest zielony; potem `git ls-remote --heads origin` pokazuje tylko `main`
- [ ] 5.6 Pamięć `gra-terminal-2` i „Stan” w `Desktop\10xdevs-gra.md` mają nowe numery i stan zmiany
