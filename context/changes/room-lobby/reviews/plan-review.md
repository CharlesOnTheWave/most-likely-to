<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Pokój i poczekalnia (room-lobby)

- **Plan**: `context/changes/room-lobby/plan.md`
- **Mode**: Deep
- **Date**: 2026-10-07
- **Verdict**: REVISE → SOUND (po poprawkach, 07.10, Karol: „zgoda”)
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 10/10 paths ✓, 5/5 symbols ✓ (`ringRoom`, `topicFor`, `getPublicSupabaseConfig`, `PROTECTED_ROUTES`, `locals.cfContext`), brief↔plan ✓, Progress↔Faza ✓ (33/33 kryteriów).

Weryfikacja w kodzie (pomocnik, 07.10):
- `locals.cfContext.waitUntil` działa na produkcji, w `astro preview` i w `astro dev` (`node_modules/@astrojs/cloudflare/dist/utils/handler.js:77-85`, `cf-helpers.js:23-26`, `index.js:175-179`).
- Checkbox z Radix w natywnym formularzu wysyła ukryty `<input type="checkbox">` z `name`/`value`. Wyłączony nie jest wysyłany, a kilka pól o tej samej nazwie czytamy przez `formData.getAll()` (`@radix-ui/react-checkbox` 1.3.11, `dist/index.mjs:250-261`).
- `create_room` z `security invoker` ma komplet uprawnień i polityk, a `auth.uid()` działa w funkcji `security definer` z `search_path = ''` (dokumentacja PostgreSQL 17, migracja supabase/auth `20220224000811`).

## Findings

### F1 — Błędne zdanie o CLI i domyślnych uprawnieniach

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries, punkt „Domyślne uprawnienia w Supabase”
- **Detail**: Plan twierdzi, że „CLI 2.117 przy `supabase start` już te uprawnienia odbiera”. Polecenie `start` obsługuje binarka TypeScript, nie Go. Gdy w `config.toml` brak `[api].auto_expose_new_tables`, przyjmuje wartość `true` i niczego nie odbiera (`db-setup.ts:890` w v2.117.0, `:624` w v2.120.0). Lokalnie i w CI nowe tabele dostają więc stare domyślne uprawnienia, inaczej niż na produkcji po 30.10. Nasza migracja i tak robi `revoke` i `grant`, więc projekt jest bezpieczny, ale CI nie sprawdza stanu „bez domyślnych uprawnień”.
- **Fix**: Poprawić zdanie w Key Discoveries. W fazie 2 dopisać do `supabase/config.toml` w `[api]` `auto_expose_new_tables = false` z komentarzem, żeby CI odwzorowało produkcję po 30.10.
- **Decision**: Fixed (Fix in plan)

### F2 — `create_room`: kto ustawia `host_id` i co przy dwóch kliknięciach naraz

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1, migracja, `rooms` i `create_room`
- **Detail**: `rooms.host_id` nie ma wartości domyślnej, a kontrakt `create_room` nie mówi, że funkcja wstawia `host_id = auth.uid()`. Bez tego polityka insert odrzuci wiersz. Dwa równoczesne „Załóż grę” jednego hosta trafią w częściowy indeks unikalny i dadzą `unique_violation`. Plan nie mapuje tego na kod błędu, więc host zobaczy błąd 500.
- **Fix**: Kontrakt `create_room`: funkcja sama wstawia `host_id = auth.uid()`, a `unique_violation` zamienia na `{ok:false, reason:'try_again'}`. Kod `try_again` dochodzi do `errors.ts` („Spróbuj jeszcze raz”).
- **Decision**: Fixed (Fix in plan)

### F3 — Migracja trafia na produkcję bez próby na prawdziwym Postgresie

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 1, kolejność kroków
- **Detail**: Karol nie ma Dockera (`docker: command not found`), więc migracji nie da się uruchomić lokalnie. `db push --dry-run` tylko wypisuje pliki. Błąd składni, literówka w wyrażeniu regularnym albo zły `grant` wyjdzie dopiero przy `db push` na jedynej bazie. Każda poprawka to wtedy nowa migracja i kolejna zgoda. Tymczasem CI przy każdym PR do `main` uruchamia `supabase start`, który wgrywa migracje na czystego Postgresa.
- **Fix A ⭐ Recommended**: Po commicie migracji push gałęzi S-01 (za zgodą) i szkic PR do `main`. CI wgrywa migrację na lokalny Postgres, a istniejący smoke musi przejść. Dopiero potem `db push --dry-run` i `db push`. Ten sam PR posłuży w fazie 5.
  - Strength: Darmowa próba na prawdziwym Postgresie przed jedyną bazą; od fazy 1 CI sprawdza też każdy kolejny commit gałęzi.
  - Tradeoff: Jeden push gałęzi więcej, za zgodą. Push gałęzi nie wdraża produkcji, bo Workers Builds wdraża `main`.
  - Confidence: MED — `pull_request: branches: [main]` w `ci.yml:6-7` uruchamia CI także dla szkicu PR, a `supabase start` wgrywa `supabase/migrations/*`.
  - Blind spot: Nie sprawdzałem, czy Workers Builds robi podgląd dla gałęzi; nawet jeśli tak, to nie produkcja. Funkcje plpgsql sprawdzają się w pełni dopiero przy wywołaniu, więc CI złapie składnię, a nie każdy błąd w logice.
- **Fix B**: Zostawić plan: `db push` od razu, błędy poprawiane kolejnymi migracjami.
  - Strength: Bez dodatkowego pusha.
  - Tradeoff: Pierwszy prawdziwy Postgres, na którym wykona się migracja, to produkcja.
  - Confidence: HIGH — tak jest zapisane w planie.
  - Blind spot: Czy `db push` wgrywa plik w jednej transakcji (przy błędzie nic nie zostaje), nie sprawdzałem.
- **Decision**: Fixed via Fix A

### F4 — Przegląd implementacji dopiero po wdrożeniu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 5, Implementation Note
- **Detail**: Plan każe uruchomić `/10x-impl-review` po scaleniu, a scalenie to wdrożenie na produkcję. Uwagi z przeglądu wymagałyby wtedy drugiego wdrożenia. Reguła z `lessons.md` (wpis 3) mówi, żeby po poprawkach z przeglądu uruchomić zmieniony kod przed push.
- **Fix**: W fazie 5 kolejność: `/10x-impl-review` na gałęzi, poprawki, smoke lokalny (`lessons.md`, wpis 3), dopiero potem scalenie za zgodą.
- **Decision**: Fixed (Fix in plan)

### F5 — Litery z innych alfabetów wyglądają jak nasze

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Implementation Approach (Nick), brief (Key Decisions)
- **Detail**: Normalizacja usuwa znaki niewidoczne, ale cyrylickie „О” albo greckie „Ο” wyglądają jak łacińskie „O”, więc „Оla” przejdzie obok „Ola”. Brief obiecuje, że „na liście do głosowania nie ma dwóch identycznie wyglądających nicków”. To obietnica za mocna. Wpisanie takiego nicku wymaga celowej złośliwości, a gramy w gronie znajomych.
- **Fix**: Złagodzić zdanie w briefie i dopisać do „What We're NOT Doing”: litery z innych alfabetów o tym samym wyglądzie to przyjęte ryzyko.
- **Decision**: Fixed (Fix in plan)

### F6 — `joined_at` to dodatkowa informacja o gościu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Faza 1, migracja, `players.joined_at`
- **Detail**: PRD mówi, że „o gościu nie zostaje nic poza nickiem i głosami”. `joined_at` zapisuje, o której gość wszedł, a służy tylko do kolejności na liście. To nie dane osobowe w ścisłym sensie, ale wykracza poza literę PRD.
- **Fix**: Zamiast `joined_at` numer kolejny w pokoju (`seat integer`, nadawany w `join_room` i `create_room`). Kolejność na liście zostaje, a godziny wejścia nie zapisujemy.
- **Decision**: Fixed (Fix in plan)
