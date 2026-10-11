<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Fundament testów i zabezpieczenie lobby (testing-lobby-foundation)

- **Plan**: context/changes/testing-lobby-foundation/plan.md
- **Scope**: Full plan (fazy 1–3 ukończone; z fazy 4 punkty 1–4, dokumenty w commicie `21a4deb`; punkt 5, scalenie i produkcja, jeszcze przed nami)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-10
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 7 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Kryteria automatyczne powtórzone 10.10 na kodzie `21a4deb`:

- **Bramka:** lint, `astro check`, `npm test` (8/8) i build przechodzą.
- **CI na PR #3:** `ci`, `smoke` (37 kroków) i `db` są zielone. `db` daje 39 passed i 13 expected fail (52).
- **Migracje:** `git diff main...HEAD -- supabase/migrations` jest pusty.
- **Bezpiecznik:** lokalnie odmawia przed pierwszym żądaniem przy braku zmiennych, przy adresie `*.supabase.co`, przy `localhost.evil.com` i przy kluczu `sb_secret_`.
- **Kontrole ręczne:** 1.7, 2.5, 3.4 i 4.4 Karol odhaczył w trakcie faz. 4.3 i 4.5 czekają na scalenie.

Odstępstwa od planu, wszystkie zatwierdzone przez Karola w trakcie i opisane w test-plan §6.2/§6.6:

- CLI przypięte do 2.120.0;
- `--reporter=verbose`;
- G2 sprawdza też nazwę funkcji w komunikacie;
- próbny alarm dla smoke (`566a0a0` + revert `fa58752`, kod gry na HEAD bez zmian);
- poprawiony komentarz G2.

Sprawdzone i bez uwag:

- **Bezpiecznik adresu:**
  - `localhost.evil.com`, `127.0.0.1@evil.com`, kropka na końcu i `[::1]` są odrzucane;
  - wielkie litery normalizuje parser;
  - supabase-js parsuje adres tym samym parserem.
- **Kolejność:** żaden klient nie powstaje przed bezpiecznikiem.
- **Sekrety:** brak sekretów i `service_role` w zmianie. `$GITHUB_ENV` dostaje tylko wartości z `supabase status`.
- **Logi smoke:** nie zawierają tokenów.
- **Nowe kroki smoke:** nie tworzą na produkcji pokoi ani graczy.
- **Wyrocznie:** nie ma luster. Wszystkie oczekiwania pochodzą z tabel researchu, PRD i decyzji S-01.
- **Ciała `it.fails`:** nie rzucają.
- **Limit rejestracji:** 7 kont na 30.
- **Zakres:** limity z „What We're NOT Doing” są zachowane.

## Findings

### F1 — Cookbook dopuszcza `beforeEach` w pliku ze znaną dziurą, a Vitest liczy jego błąd jako oczekiwaną porażkę

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: context/foundation/test-plan.md:165; context/changes/testing-lobby-foundation/plan.md:111; tests/db/roles.test.ts:21; tests/db/nicks.test.ts:12-13; tests/db/support/rooms.ts:5-6
- **Detail**: Cookbook §6.2 mówi: „warunki wstępne … powstają w `beforeAll` albo `beforeEach`, bo błąd w hooku zostaje czerwony”. To prawda tylko dla `beforeAll`.
  - W Vitest 5.0.3 (`node_modules/vitest/dist/chunks/run.BTlFXlnv.js:3877-3946`) `beforeEach` i `afterEach` biegną wewnątrz bloku `try` samego testu. Ich błąd trafia do wyniku testu, a odwrócenie `test.fails` robi z niego „oczekiwaną porażkę”.
  - Tak samo działa przekroczony czas w ciele `it.fails`.
  - Błąd w `beforeAll` oblewa cały blok i zostaje czerwony. Tylko ten przypadek sprawdzał krok 1.4.
  - Dziś kod używa wyłącznie `beforeAll`, więc nic nie jest zepsute. Według cookbooka będą jednak pisane testy anonimowości w fazie 2 planu testów.
- **Fix**: W §6.2 i w planie (`Critical Implementation Details`) zapisać: „warunki wstępne tylko w `beforeAll`; w pliku z `it.fails` nigdy `beforeEach` ani `afterEach`; przekroczony czas w ciele `it.fails` też liczy się jako oczekiwana porażka”. W trzech komentarzach w kodzie zamienić „hooks” na „beforeAll”.
- **Decision**: FIXED (Karol: „poprawiamy”, 2026-10-10)

### F2 — Końcowy odczyt w znanych dziurach może dać fałszywą zieleń albo zostać „oczekiwaną porażką” po naprawie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/db/roles.test.ts:215-218, 242-245, 253-256; tests/db/nicks.test.ts:69-77
- **Detail**: Ten sam fragment ma dwie słabości.
  - **Błąd połączenia daje fałszywą zieleń.** Jeśli końcowe `room_link` (H1, H2) albo próba `join_room` (9 par F4) skończy się błędem połączenia albo limitem czasu, `data` jest puste i asercja pada. `test.fails` liczy to jako oczekiwaną porażkę, czyli fałszywą zieleń. Trwała awaria tych funkcji i tak zaświeci na czerwono w testach obok (kontrola pozytywna kanarka, 14 par-strażników, 20 liter), więc zagraża tylko jednorazowa usterka.
  - **Za ścisłe porównanie w H1 i H2.** Asercje porównują cały obiekt (`toEqual({ status: "closed" })`). Gdyby S-02 dopisało do odpowiedzi `room_link` jakieś pole, test zostałby po naprawie „oczekiwaną porażką”, zamiast zrobić się czerwony i wymusić zdjęcie znacznika.
- **Fix**: Zmienić to w trzech ciałach F1 i w gałęzi znanych dziur w `nicks.test.ts`:
  - przed asercją `if (… .error !== null) return;` z komentarzem. Test wtedy przechodzi, a `test.fails` pokazuje go na czerwono („Expect test to fail”);
  - w H1 i H2 porównywać samo pole `status`;
  - dopisać jedną linię o tym w §6.2.
- **Decision**: FIXED (Karol: „poprawiamy”, 2026-10-10)

### F3 — Brakuje drugiej połowy H8: host wstawia pokój od razu `closed`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/db/roles.test.ts:114; research.md:93
- **Detail**: Research H8 obejmuje dwie rzeczy: „Host dopisuje gościa (`user_id` null) albo wstawia pokój `closed`”, z odmową z `status = 'lobby'` w polityce (`…room_lobby.sql:71`). Plan zostawił tylko pierwszą połowę i nie wpisał drugiej do „What We're NOT Doing”. Grant `insert` na `rooms` nie ogranicza kolumn, więc odmowę daje tu wyłącznie polityka. Strażnik złapałby migrację, która ją poluzuje.
- **Fix**: Dodać w `roles.test.ts` strażnika „H8: a host inserting a room that is already closed gets 42501” (host B, bez nowej rejestracji).
- **Decision**: FIXED (Karol: „poprawiamy”, 2026-10-10)

### F4 — Test unit nie sprawdza, że każda odmowa ma inny tekst

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/unit/room-errors.test.ts:24-29
- **Detail**: Nazwa testu mówi „its own text”, ale asercja sprawdza tylko, że tekst nie jest ogólny. Gdyby `room_closed` pokazywał tekst `room_unknown`, test by przeszedł.
- **Fix**: Dodać test `new Set(GUEST_REFUSALS.map(roomErrorMessage)).size === GUEST_REFUSALS.length`. Nie kopiuje tekstów, więc nie jest lustrem.
- **Decision**: FIXED (Karol: „poprawiamy”, 2026-10-10)

### F5 — Reguła „tylko przez PR” nie chroni samych testów ani CI

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: AGENTS.md:10
- **Detail**: Lista ścieżek nie obejmuje `tests/`, `vitest.config.ts` ani `.github/workflows/`. Push prosto na `main` mógłby osłabić strażnika albo wyłączyć job `db`, i nic by nie zaświeciło na czerwono.
- **Fix**: Dopisać te trzy ścieżki do reguły (tekst do akceptacji Karola).
- **Decision**: FIXED (Karol: „poprawiamy”, 2026-10-10)

### F6 — Bezpiecznik działa tylko, dopóki testy biorą klienta z `support/clients.ts`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/db/support/clients.ts; vitest.config.ts:30
- **Detail**: `globalSetup` sprawdza tylko `TEST_SUPABASE_*`. Przyszły plik testu, który sam zaimportuje `createClient` z `@supabase/supabase-js` albo przeczyta inne zmienne, ominie bezpiecznik. Klucz publishable produkcji ma ten sam prefiks, więc chroni wyłącznie sprawdzenie adresu. Tunel z localhost do projektu w chmurze wymagałby świadomego ustawienia, więc to ryzyko przyjęte.
- **Fix**: Reguła ESLint `no-restricted-imports` dla `@supabase/supabase-js` w `tests/**` z wyjątkiem `tests/db/support/clients.ts`.
- **Decision**: FIXED (Karol: „poprawiamy”, 2026-10-10)

### F7 — Joby `db` i `smoke` nie mają limitu czasu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:28, 74
- **Detail**: Brak `timeout-minutes`. Zawieszony `supabase start` (np. pobieranie obrazów) wisi do domyślnych 6 godzin GitHuba i opóźnia sygnał. Minuty są darmowe (repo publiczne), więc kosztem jest tylko czekanie.
- **Fix**: `timeout-minutes: 15` w jobach `db` i `smoke`.
- **Decision**: FIXED (Karol: „poprawiamy”, 2026-10-10)

### F8 — Nieaktualne zdania w planie testów

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md:84-88, 220
- **Detail**: Dwa zdania są nieaktualne.
  - **§3:** zdanie mówi, że „research fazy 1 rozstrzyga, gdzie i jak” uruchamiać testy bazy. Research już to rozstrzygnął: tylko CI, job `db`.
  - **§8:** „Strategy (§1–§5) last reviewed: 2026-10-08”, choć §2 i §5 zmieniły się 10.10.

  Status wiersza 1 w §3 (`planned`) zostawiamy orkiestratorowi `/10x-test-plan`.

- **Fix**: W §3 zastąpić to zdanie jednym: „Testy bazy biegną tylko w CI (job `db`), patrz §6.2”. W §8 ustawić datę strategii na 2026-10-10.
- **Decision**: FIXED (Karol: „poprawiamy”, 2026-10-10)
