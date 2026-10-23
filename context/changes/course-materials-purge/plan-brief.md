# Materiały kursu poza publicznym repo — Plan Brief

> Full plan: `context/changes/course-materials-purge/plan.md`

## What & Why

Skille, prompty i szablony kursu 10xDevs (`10x get`) oraz blok kursu w `CLAUDE.md` wychodzą z gita i z całej historii publicznego repo. Lokalnie zostają i działają jak dziś. Pod postem Karola na Circle padła rada „wyczyść historię i dodaj do `.gitignore`”, a organizator kursu dał +1.

## Starting Point

Paczki kursu są w repo od pierwszego commita (25.09): 39 folderów skilli (134 pliki), 28 promptów, 10 szablonów, 2 pliki 10x-cli i blok w `CLAUDE.md:3-28`. Zmieniało je 25 z 214 commitów. Na GitHubie jest `main`, 5 scalonych gałęzi i 15 scalonych PR-ów; lokalnie dwa niewypchnięte commity (`1153156`, `6842913`). Każdy push do `main` wdraża grę.

## Desired End State

Ani `main`, ani nowy klon nie ma plików kursu w żadnym commicie, a na GitHubie zostaje tylko `main`. Gra po nadpisaniu `main` jest bajt w bajt ta sama (ten sam tree SHA), smoke zielony. W obu lokalnych folderach skille i blok kursu (teraz w `CLAUDE.local.md`) działają poza gitem. Mapa starych i nowych numerów commitów jest w `context/deployment/history-rewrite-2026-10-22.md`.

## Key Decisions Made

| Decision                                     | Choice                                                                                             | Why (1 sentence)                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Zakres                                       | 39 skilli z manifestu (z `10x-impl-review-ci`), prompty, szablony, pliki 10x-cli, blok `CLAUDE.md` | Najprostsza zasada: z gita wychodzi wszystko z `10x get`; `10x-impl-review-ci` nic nie używa.             |
| `playwright-cli`, `tools/pr-review`, starter | Zostają                                                                                            | To nie materiały kursu (Microsoft, nasz kod, publiczny szablon).                                          |
| Stare PR-y                                   | Zostają, repo nie kasujemy (ścieżka A)                                                             | Support GitHuba nie usuwa danych, które nie są tajne; kasowanie repo zabrałoby PR-y, wdrożenie i sekrety. |
| Kolejność                                    | Najpierw zwykły PR, potem przepisanie                                                              | Nadpisanie `main` wdraża wtedy identyczną grę.                                                            |
| Narzędzie                                    | `git filter-repo` z pip, za zgodą, potem odinstalowane                                             | Poleca je GitHub i Git; samo robi mapę commitów.                                                          |
| Stare numery w notatkach                     | Bez edycji, mapa w osobnym pliku; `--prune-empty never`, `--preserve-commit-hashes`                | Archiwum i opisów commitów nie zmieniamy; każdy stary commit ma jeden nowy odpowiednik.                   |
| Gałęzie                                      | Na GitHubie usuwamy wszystkie poza `main`, lokalnie wszystko zostaje (przepisane)                  | Do niczego nie służą, a strony PR-ów zostają.                                                             |
| Foldery                                      | Oba przestawione bez kasowania plików kursu; kopia plików jako zabezpieczenie                      | Stary folder na starej historii mógłby wypchnąć skille z powrotem.                                        |
| Blok kursu                                   | `CLAUDE.local.md` poza gitem                                                                       | Świeża sesja go wczytuje (sprawdzone 22.10).                                                              |

## Scope

**In scope:**

- PR z usunięciem z gita, `.gitignore`, `CLAUDE.local.md`, notatką w `deploy-plan.md`
- kopie zapasowe (pliki kursu z obu folderów, `git clone --mirror` z GitHuba i lokalny)
- przepisanie historii na kopii i sprawdzenie para po parze
- nadpisanie `main` (najpierw próba `--dry-run`), usunięcie wszystkich innych gałęzi, CI, wdrożenie, smoke
- przestawienie obu folderów bez kasowania plików kursu, sprawdzenie sum z kopią
- PR z mapą numerów; odinstalowanie narzędzia; pamięć i plik na pulpicie

**Out of scope:**

- kasowanie repo, GitHub Support, stare commity pod `refs/pull/*`
- edycja `context/archive/`, opisów commitów, trzech komentarzy ze ścieżką do lokalnego skilla
- ponowne podpisanie 15 scaleń (tracą „Verified”), `gc` lokalnego repo, usuwanie kopii

## Architecture / Approach

Faza 1 to zwykły PR, po którym `main` już nie ma plików kursu. Przepisanie dzieje się w osobnej kopii (`rewrite.git`) zbudowanej z lokalnego repo i `main` z kopii GitHuba, po dwóch kopiach zapasowych. Wycinanie bloku działa na każdy plik, więc żaden plik repo (także plan) nie zawiera dosłownie znaczników bloku. Skrypt porównuje każdą parę stary/nowy commit. Na GitHuba trafia tylko przepisany `main` (`--force-with-lease`, wszystkie pushe z głównego repo), potem foldery lokalne przechodzą na nową historię, a pliki kursu zostają na dysku (w głównym folderze najpierw wyjęte z indeksu).

## Phases at a Glance

| Phase                                | What it delivers                                                   | Key risk                                                              |
| ------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 1. Zwykły PR: pliki kursu poza gitem | Pliki kursu nieśledzone i w `.gitignore`, blok w `CLAUDE.local.md` | `pull` w głównym folderze skasowałby tam skille (nie robimy go)       |
| 2. Przepisanie na kopii              | Przepisana historia sprawdzona para po parze, mapa numerów         | Strażnik trybu auto może zablokować `filter-repo` (wtedy Karol z `!`) |
| 3. Publikacja na GitHubie            | Nowy `main`, tylko jedna gałąź, CI, wdrożenie i smoke zielone      | Push na `main` = wdrożenie; powrót z `github-mirror.git`              |
| 4. Przestawienie obu folderów        | Oba foldery na nowej historii, skille działają                     | Przejście na starą gałąź przed fazą 4 kasuje pliki kursu              |
| 5. Zapis i sprzątanie                | PR z mapą, nowe numery w planie, narzędzie odinstalowane           | Mapa nie może zawierać ścieżek z dysku                                |

**Prerequisites:** wolna chwila bez innych pushy na `main` między fazą 2 a 3; od scalenia fazy 1 do końca fazy 4 żadnego przejścia na stare gałęzie w `10xdevs-gra` (fazy 2–4 zaraz po fazie 1); zgoda Karola na instalację, każdy push, usunięcie gałęzi i ruszenie głównego folderu.
**Estimated effort:** 2–3 sesje (faza 1 z PR; fazy 2–4 razem; faza 5 z PR).

## Open Risks & Assumptions

- Stare commity zostają dostępne przez 15 PR-ów i pod SHA (przyjęte; potwierdza to dokumentacja GitHuba).
- Kto pobrał repo wcześniej, ma swoją kopię; w ostatnich 14 dniach stronę repo obejrzała 1 osoba.
- Ponowne `10x get` wpisałoby blok z powrotem do `CLAUDE.md` (kurs skończony).

## Success Criteria (Summary)

- Na GitHubie żadna gałąź ani nowy klon nie pokazuje plików kursu, a gra działa bez zmian (smoke zielony).
- W obu folderach Karola `/10x-` dalej pokazuje skille, a sesja zna router kursu.
- Każdy stary numer commita z notatek da się znaleźć w mapie.
