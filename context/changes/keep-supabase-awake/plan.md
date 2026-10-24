# Pukanie do Supabase z GitHub Actions: plan implementacji

## Overview

Darmowy projekt Supabase usypia po 7 dniach bez ruchu w bazie, a gra jest co 1–2 tygodnie. Decyzja Karola z 21.10.2026 (roadmapa, Open Question 9, opcja 2): co 6 godzin workflow GitHub Actions wywołuje w produkcyjnym Supabase niewinną funkcję i sprawdza odpowiedź. Baza dzięki temu nie zasypia, a czerwony przebieg jest sygnałem, że coś padło. Zmiana nie dotyka kodu gry, Workera ani bazy.

## Current State Analysis

Szczegóły i kotwice: `context/changes/keep-supabase-awake/research.md`.

- Projekt zasnął już raz, 04.10.2026. Zniknął DNS, nie działało logowanie i trzeba go było obudzić w panelu (`context/archive/2026-09-27-live-sync-spike/change.md:14`). Godzinny pg_cron (`20261014101925_close_stale_games.sql:42`) według planu S-02 nie chroni przed uśpieniem (`context/archive/2026-10-13-first-live-round/plan.md:771`).
- Supabase liczy „user database activity”, a „a few user requests to the database each day” wystarcza. Liczą się też wywołania API (dokumentacja „Project Pausing”).
- `public.room_link(p_link_token)` jest `stable`, ma grant dla `anon` i nic nie zapisuje. Kod we właściwym formacie (`^[A-Za-z0-9_-]{22}$`) daje jeden odczyt `public.rooms`. Dla nieznanego kodu funkcja oddaje `{"status":"unknown"}` (`20261014101922_first_live_round.sql:384-421`, grant `:801`).
- Repo nie ma żadnych sekretów ani zmiennych Actions. `ci.yml:25-27` czyta `secrets.SUPABASE_URL` i `secrets.SUPABASE_KEY`, dziś puste. W `astro.config.mjs:19-20` obie zmienne mają `access: "secret"`, więc build ich nie wkleja.
- Wzorzec skryptów:
  - `scripts/*.mjs` bez zależności;
  - polecenie npm `node --env-file-if-exists=.dev.vars scripts/…` (`package.json:16-17`);
  - nagłówek z celem, regułą „ask” i kodami wyjścia (`scripts/live-sync-probe.mjs:1-7`);
  - reguły „ask” dla `npm run X` i `node … X` (`.claude/settings.json:39-53`).
- `.claude/settings.json` ma `Bash(node *)` w „allow” i nie ma żadnej reguły dla `gh`. Lekcja z `context/foundation/lessons.md:5-10` wymaga reguły „ask” dla skryptu albo workflow, który w środku dotyka bazy lub stanu zdalnego.

## Desired End State

- `.github/workflows/keep-supabase-awake.yml` uruchamia się co 6 godzin (`17 */6 * * *`, UTC) i na żądanie (`workflow_dispatch`). Jedyny krok to `node scripts/keep-supabase-awake.mjs` z sekretami `SUPABASE_URL` i `SUPABASE_KEY`.
- Skrypt kończy się kodem 0 i jedną linią „ok” tylko przy HTTP 200 i `status: "unknown"`. W każdym innym przypadku jest czerwony.
  - Nigdy nie drukuje ciała odpowiedzi, klucza ani adresu.
  - Odmawia, zanim cokolwiek wyśle, gdy brakuje zmiennych, klucz nie jest `sb_publishable_…` albo adres nie jest `https`.
- `npm run keep-awake` robi to samo lokalnie z `.dev.vars`, za regułą „ask”.
- Reguły „ask” obejmują ten skrypt oraz `gh workflow run|enable|disable`, `gh secret` i `gh variable`.
- Decyzja jest zapisana:
  - roadmapa, Open Question 9 (przez `/10x-roadmap`);
  - `infrastructure.md` (ryzyko nr 1);
  - `deploy-plan.md`;
  - `test-plan.md` §7;
  - `README.md`;
  - lista „Ask the user” w `AGENTS.md`.
- Sprawdzenie:
  - po scaleniu ręczny przebieg workflow jest zielony i ma linię „ok”;
  - kolejna sesja widzi zielony przebieg z harmonogramu.

### Key Discoveries:

- `workflow_dispatch` i `schedule` działają dopiero, gdy plik jest na `main` (dokumentacja GitHuba). Pierwszy przebieg w Actions jest możliwy dopiero po scaleniu.
- Klucze `sb_publishable_…` idą tylko w nagłówku `apikey`, nie jako Bearer (`node_modules/@supabase/supabase-js/dist/index.cjs:264-270`).
- Zły format kodu kończy `room_link` przed odczytem tabeli (`first_live_round.sql:394-396`), a taka próba może nie liczyć się jako aktywność bazy.
- Z `Bash(node *)` w „allow” agent bez nowej reguły mógłby pukać do produkcji bez pytania.

## What We're NOT Doing

- Cloudflare Cron Trigger, plan Pro, zmiany w Workerze, kodzie gry i migracjach.
- Własny monitoring albo alerty poza mailami GitHuba o nieudanych przebiegach.
- Lokalne `.claude/settings.local.json` (git-ignored, pozwala na `gh api *` i `gh run *`). Tylko odnotowujemy w raporcie dla Karola, że `gh api -X POST …` ominęłoby regułę „ask”.
- Lint plików workflow (actionlint) i testy jednostkowe skryptu. Skrypt jest cienki, a jego ścieżki sprawdzamy ręcznymi uruchomieniami (Faza 1 i 3).
- Automatyczna reakcja na wyłączenie harmonogramu po 60 dniach bez commitów. Zapasem jest punkt listy przed wieczorem w `deploy-plan.md`.
- Zmiany w `ci.yml`. Sekrety o tych samych nazwach trafią tam do kroku build, ale `access: "secret"` sprawia, że build ich nie wkleja.

## Implementation Approach

- **Faza 1:** sam mechanizm, sprawdzony lokalnie. Odmowy bez sieci, potem jedno pukanie do produkcji za zgodą Karola (lekcja 3).
- **Faza 2:** zapis decyzji w dokumentach.
- **Faza 3:** wdrożenie. Karol dodaje sekrety przed scaleniem, potem push i PR, zielone CI, scalenie przez Karola i ręczny przebieg workflow.

Jedna gałąź, jeden PR, pierwszy push w fazie 3 (zmiany w `.github/workflows/` tylko przez PR, AGENTS.md).

## Critical Implementation Details

- **Kolejność w fazie 3:** sekrety muszą istnieć przed scaleniem. Pierwszy przebieg z harmonogramu może przyjść do 6 godzin po scaleniu, a bez sekretów będzie czerwony i da maila.
- **Kod pukania:** stała `keep-awake-ping-000000` (22 znaki z `[A-Za-z0-9_-]`). Prawdziwe kody to losowe 22 znaki base64url, więc trafienie w prawdziwy pokój jest praktycznie niemożliwe. Gdyby jednak się zdarzyło, odpowiedź `open`/`started`/`closed` z `room_id` daje czerwony przebieg bez wydruku ciała.
- **Limit czasu:** `AbortSignal.timeout` przyjmuje tylko liczbę całkowitą milisekund (lekcja z F-01, `7c8675c`).

## Faza 1: Skrypt, workflow i reguły „pytaj”

### Overview

Skrypt pukający, polecenie npm, workflow z harmonogramem i reguły „ask”. Sprawdzone lokalnie, bez push.

### Changes Required:

#### 1. Skrypt pukający

**File**: `scripts/keep-supabase-awake.mjs` (nowy)

**Intent**: Jedno niewinne zapytanie do produkcyjnej bazy, które liczy się jako aktywność, i twarde sprawdzenie odpowiedzi. Każda awaria daje czerwony przebieg, a w logu nie ląduje nic wrażliwego.

**Contract**:

- **Nagłówek** jak `scripts/live-sync-probe.mjs:1-7`. Mówi:
  - po co skrypt jest (roadmapa OQ 9, decyzja 21.10.2026);
  - skąd bierze zmienne (`npm run keep-awake` z `.dev.vars`, workflow z sekretów);
  - że jest za regułą „ask”;
  - jakie ma kody wyjścia: 0 ok, 1 baza odpowiedziała inaczej albo nie odpowiedziała, 2 odmowa przed wysłaniem.
- **Wejście:** `process.env.SUPABASE_URL` i `process.env.SUPABASE_KEY`, jak w innych skryptach. Zasada `astro:env/server` z AGENTS.md dotyczy `src/`.
- **Odmowy (kod 2, przed jakimkolwiek żądaniem):**
  - brak którejś zmiennej (komunikat podaje nazwę, nie wartość);
  - klucz bez prefiksu `sb_publishable_`;
  - adres, który nie zaczyna się od `https://`.
- **Żądanie:** `POST <SUPABASE_URL>/rest/v1/rpc/room_link`:
  - nagłówki `apikey: <klucz>` i `Content-Type: application/json`, bez `Authorization`;
  - ciało `{"p_link_token":"keep-awake-ping-000000"}`;
  - limit czasu 15000 ms.
- **Wynik:**
  - kod 0 i jedna linia „ok” tylko przy HTTP 200 i JSON z `status === "unknown"`;
  - w każdym innym przypadku kod 1 i jedna linia z kodem HTTP i wartością pola `status` (albo „not JSON” lub nazwa błędu sieci);
  - nigdy ciało odpowiedzi, `room_id`, klucz ani adres.

#### 2. Polecenie npm

**File**: `package.json`

**Intent**: Lokalne uruchomienie tak jak `smoke` i `live-probe`.

**Contract**: `"keep-awake": "node --env-file-if-exists=.dev.vars scripts/keep-supabase-awake.mjs"` za `live-probe`.

#### 3. Workflow

**File**: `.github/workflows/keep-supabase-awake.yml` (nowy)

**Intent**: Pukanie co 6 godzin i na żądanie, z minimalnymi uprawnieniami.

**Contract**:

- `name: Keep Supabase awake` i komentarz u góry: po co, link do `context/changes/keep-supabase-awake/plan.md` i dokumentacji „Project Pausing”, zasada 60 dni.
- Triggery: `schedule` z `cron: "17 */6 * * *"` oraz `workflow_dispatch`.
- `permissions: contents: read` i `concurrency` z własną grupą.
- Jeden job (`ping`, `ubuntu-latest`, `timeout-minutes: 5`) z krokami:
  - `actions/checkout@v4`;
  - `actions/setup-node@v4` z `node-version: 22`, bez cache i bez `npm ci` (skrypt nie ma zależności);
  - `run: node scripts/keep-supabase-awake.mjs` z `env` `SUPABASE_URL: ${{ secrets.SUPABASE_URL }}` i `SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}`.
- Wersje akcji takie jak w `ci.yml`.

#### 4. Reguły „ask”

**File**: `.claude/settings.json`

**Intent**: Agent pyta, zanim zapuka do produkcji albo zmieni ustawienia repo (lekcja, `lessons.md:5-10`).

**Contract**: na końcu listy `ask`:

- skrypt na wzór reguł smoke: `Bash(npm run keep-awake*)`, `Bash(npm *keep-awake*)`, `Bash(node scripts/keep-supabase-awake*)`, `Bash(node ./scripts/keep-supabase-awake*)`, `Bash(node *keep-supabase-awake*)`;
- `Bash(gh workflow run*)`, `Bash(gh workflow enable*)`, `Bash(gh workflow disable*)`, `Bash(gh secret *)`, `Bash(gh variable *)`.

Reszta pliku bez zmian.

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run test:hooks`, `npm run build`
- `npx prettier --check .github/workflows/keep-supabase-awake.yml .claude/settings.json package.json` przechodzi
- Odmowy bez sieci (każda kończy się kodem 2 i nie wysyła żądania):
  - bez zmiennych: komunikat podaje brakujące nazwy;
  - klucz `sb_secret_x`;
  - adres `http://…`.

#### Manual Verification:

- Karol zgadza się na jedno `npm run keep-awake` do produkcji (z `.dev.vars`). Wynik: linia „ok”, kod 0.
- Karol czyta workflow: co, kiedy i z jakimi sekretami się uruchamia.

**Implementation Note**: Po fazie 1 bez push. Zatrzymaj się na potwierdzenie Karola.

---

## Faza 2: Dokumenty

### Overview

Decyzja z 21.10.2026 trafia wszędzie tam, gdzie dziś wisi jako otwarta.

### Changes Required:

#### 1. Roadmapa

**File**: `context/foundation/roadmap.md` (`:308`, Open Question 9)

**Intent**: Zamknięcie pytania z datą i wyborem, na wzór rozstrzygnięć w „Unknowns” (`:94`, `:173`).

**Contract**: przez `/10x-roadmap`, za zgodą Karola. Treść: „Rozstrzygnięte 2026-10-21: opcja 2, workflow `keep-supabase-awake` co 6 h; zapas: punkt listy przed wieczorem w `deploy-plan.md`”. Frontmatter `updated` zgodnie ze skillem.

#### 2. Infrastruktura

**File**: `context/foundation/infrastructure.md` (`:147`, `:188`)

**Intent**: Rejestr ryzyk mówi, czym ryzyko nr 1 jest dziś łagodzone.

**Contract**:

- wiersz `:188`, kolumna Mitigation: decyzja z datą, workflow co 6 h, czerwony przebieg jako sygnał, zapas w liście przed wieczorem, zasada 60 dni;
- punkt `:147`: dopisek, że od 2026-10-21 projekt budzi pukanie.

#### 3. Plan wdrożenia

**File**: `context/deployment/deploy-plan.md` (`:191`, `:204`)

**Intent**: Lista przy kłopotach z logowaniem i lista decyzji odłożonych wiedzą o pukaniu.

**Contract**:

- `:191`: obok „Paused” sprawdzenie, czy ostatnie przebiegi „Keep Supabase awake” w zakładce Actions są zielone;
- `:204`: podpunkt „→ 21.10.2026 (keep-supabase-awake): …” na wzór `:198`, `:207`.

#### 4. Plan testów

**File**: `context/foundation/test-plan.md` (`:53-55`, `:321`)

**Intent**: §7 mówi o monitoringu, którego dotąd nie było.

**Contract**: wpis `:321` mówi, że uśpieniu zapobiega workflow `keep-supabase-awake` (czerwony przebieg = sygnał), a lista kontrolna zostaje jako zapas. Treść „Re-evaluate if…” dostosowana. Akapit `:53-55` wspomina workflow jednym zdaniem.

#### 5. README i AGENTS.md

**Files**: `README.md` (`:52-63`, `:76`), `AGENTS.md` (lista „Ask the user before any command…”, `:9`)

**Intent**: Nowe polecenie jest na liście skryptów. Agenci spoza Claude Code, którzy nie czytają `.claude/settings.json`, wiedzą, że trzeba pytać.

**Contract**:

- `README.md`:
  - w „Available Scripts” linia `npm run keep-awake` (pukanie do Supabase z `.dev.vars`, pyta najpierw);
  - opis katalogu `scripts/` (`:76`) wymienia skrypt;
- `AGENTS.md:9`: lista poleceń dostaje `npm run keep-awake`, `gh workflow run`, `gh secret set` i `gh variable set`.

### Success Criteria:

#### Automated Verification:

- `npx prettier --check context/foundation/roadmap.md context/foundation/infrastructure.md context/deployment/deploy-plan.md context/foundation/test-plan.md README.md AGENTS.md` przechodzi
- `npm run lint` przechodzi

#### Manual Verification:

- Karol akceptuje zmianę w roadmapie (zgoda w `/10x-roadmap`)

**Implementation Note**: Bez push. Pierwszy push w fazie 3.

---

## Faza 3: Sekrety, PR, scalenie i pierwszy przebieg

### Overview

Karol dodaje sekrety, potem idzie PR, zielone CI, scalenie i ręczny przebieg workflow na `main`.

### Changes Required:

#### 1. Sekrety (Karol, w przeglądarce)

**Intent**: Workflow ma adres i klucz, a wartość klucza nie przechodzi przez rozmowę z agentem.

**Contract**: kroki dla Karola:

1. GitHub, repo `most-likely-to` → Settings → Secrets and variables → Actions → New repository secret.
2. `SUPABASE_URL`: wartość `SUPABASE_URL` z `.dev.vars` (`https://<ref>.supabase.co`).
3. `SUPABASE_KEY`: klucz publishable z `.dev.vars` albo z panelu Supabase (Project Settings → API Keys), zaczyna się od `sb_publishable_`. Nigdy klucz `sb_secret_` ani `service_role`.

Agent sprawdza tylko nazwy: `gh secret list` (bez wartości).

#### 2. PR i scalenie

**Intent**: Zmiana w `.github/workflows/` trafia na `main` przez PR z zielonym CI (AGENTS.md).

**Contract**:

- push gałęzi `keep-supabase-awake` (za zgodą), `gh pr create` do `main`;
- CI zielone we wszystkich jobach;
- scala Karol: `! gh pr merge <n> --merge`.

#### 3. Pierwszy przebieg

**Intent**: Dowód, że pukanie działa w Actions: sekrety, nagłówek `apikey` bez Bearer i odpowiedź `unknown`.

**Contract**:

- po scaleniu `gh workflow run keep-supabase-awake.yml` (reguła „ask”, zgoda Karola);
- potem `gh run watch` i `gh run view --log`. W logu jest linia „ok” i nie ma `sb_publishable`.
- W następnej sesji: `gh run list --workflow keep-supabase-awake.yml --event schedule` pokazuje co najmniej jeden zielony przebieg z harmonogramu.

### Success Criteria:

#### Automated Verification:

- `gh secret list` pokazuje `SUPABASE_URL` i `SUPABASE_KEY`
- CI na PR zielone we wszystkich jobach (`ci`, `smoke`, `db`, `e2e`)
- Ręczny przebieg workflow po scaleniu jest zielony, w logu jest „ok” i nie ma `sb_publishable`
- `gh run list --workflow keep-supabase-awake.yml --event schedule` pokazuje co najmniej jeden zielony przebieg z harmonogramu

#### Manual Verification:

- Karol dodaje oba sekrety w ustawieniach repo
- Karol scala PR

**Implementation Note**: Push, `gh workflow run` i scalenie tylko za zgodą Karola. Ostatnie kryterium automatyczne może poczekać do następnej sesji (harmonogram co 6 h).

---

## Testing Strategy

### Unit Tests:

- Brak nowych. Skrypt to cienka warstwa nad jednym `fetch`, a ścieżki odmów sprawdzamy ręcznie w fazie 1. Istniejące testy (`npm test`, `npm run test:hooks`) muszą przejść, bo `test:hooks` czyta `.claude/settings.json`.

### Integration Tests:

- Jedno lokalne `npm run keep-awake` do produkcji (faza 1, za zgodą).
- Ręczny przebieg workflow po scaleniu (faza 3).
- Przebieg z harmonogramu w następnej sesji.

### Manual Testing Steps:

1. Trzy odmowy bez sieci (faza 1).
2. `npm run keep-awake`: „ok”, kod 0.
3. Po scaleniu: przycisk „Run workflow” albo `gh workflow run`, zielony przebieg z „ok”.
4. Po 6+ godzinach: zielony przebieg z harmonogramu.

## Performance Considerations

4 przebiegi na dobę po kilkanaście sekund. W publicznym repo minuty Actions nic nie kosztują. Funkcja robi jeden odczyt po unikalnym indeksie.

## Migration Notes

- Bez zmian w bazie.
- Wyłączenie: `gh workflow disable keep-supabase-awake.yml` (za zgodą) albo revert PR. Sekrety można usunąć w ustawieniach repo.
- Po 60 dniach bez commitów GitHub sam wyłączy harmonogram. Ponowne włączenie: przycisk w Actions albo `gh workflow enable`.

## References

- Research: `context/changes/keep-supabase-awake/research.md`
- Ryzyko i opcje: `context/foundation/infrastructure.md:188`, `context/foundation/roadmap.md:308`
- Wzorzec skryptu: `scripts/live-sync-probe.mjs:1-7`, `package.json:16-17`, `.claude/settings.json:39-53`
- Funkcja: `supabase/migrations/20261014101922_first_live_round.sql:384-421, 801`
- Dokumentacja: https://supabase.com/docs/guides/platform/free-project-pausing, https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Skrypt, workflow i reguły „pytaj”

#### Automated

- [x] 1.1 Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run test:hooks`, `npm run build` — c5dac7f
- [x] 1.2 `npx prettier --check .github/workflows/keep-supabase-awake.yml .claude/settings.json package.json` przechodzi — c5dac7f
- [x] 1.3 Odmowy bez sieci: brak zmiennych, klucz `sb_secret_x` i adres `http://…` dają kod 2 bez żądania — c5dac7f

#### Manual

- [x] 1.4 Karol zgadza się na jedno `npm run keep-awake` do produkcji (z `.dev.vars`); wynik: linia „ok”, kod 0 — c5dac7f
- [x] 1.5 Karol czyta workflow: co, kiedy i z jakimi sekretami się uruchamia — c5dac7f

### Phase 2: Dokumenty

#### Automated

- [x] 2.1 `npx prettier --check context/foundation/roadmap.md context/foundation/infrastructure.md context/deployment/deploy-plan.md context/foundation/test-plan.md README.md AGENTS.md` przechodzi — fa36dcd
- [x] 2.2 `npm run lint` przechodzi — fa36dcd

#### Manual

- [x] 2.3 Karol akceptuje zmianę w roadmapie (zgoda w `/10x-roadmap`) — fa36dcd

### Phase 3: Sekrety, PR, scalenie i pierwszy przebieg

#### Automated

- [x] 3.1 `gh secret list` pokazuje `SUPABASE_URL` i `SUPABASE_KEY` — 8a5e6a2
- [x] 3.2 CI na PR zielone we wszystkich jobach (`ci`, `smoke`, `db`, `e2e`) — 8a5e6a2
- [x] 3.3 Ręczny przebieg workflow po scaleniu jest zielony, w logu jest „ok” i nie ma `sb_publishable` — 8a5e6a2
- [x] 3.4 `gh run list --workflow keep-supabase-awake.yml --event schedule` pokazuje co najmniej jeden zielony przebieg z harmonogramu

#### Manual

- [x] 3.5 Karol dodaje oba sekrety w ustawieniach repo — 8a5e6a2
- [x] 3.6 Karol scala PR — 8a5e6a2
