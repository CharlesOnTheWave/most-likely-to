<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Kontrakt UI na ekranie logowania

- **Plan**: context/changes/ui-signin-contract/plan.md
- **Mode**: Deep
- **Date**: 2026-10-04
- **Verdict**: REVISE → SOUND po poprawkach
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
12/12 ścieżek ✓, 6/6 symboli ✓ (`useFormStatus`, `@custom-variant dark`, `outline-ring/50`, `bg-cosmic`, `@theme inline`, skrypt `lint`), brief↔plan ✓, Progress↔fazy ✓ (31/31). Weryfikacja kodu: jeden subagent (6 pytań), kluczowe twierdzenia sprawdzone ponownie u źródła (`shadcn` 4.21.1 w cache npx, `LiveSyncDemo.tsx:130`, `scripts/live-sync-probe.mjs:108-116`, `src/pages/api/auth/signin.ts`).

## Findings

### F1 — `shadcn add` bez `-o` utknie, a wygenerowane pliki nie przejdą lintu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1, krok 1; Critical Implementation Details
- **Detail**: `input-group` dociąga `button` z rejestru, który różni się od naszego `button.tsx`. Bez `-o` CLI w trybie interaktywnym (domyślnym w `add`) pyta „The file button.tsx already exists. Would you like to overwrite?” (`@shadcn/registry/dist/chunk-DJGEPYJ7.js`), a w powłoce agenta nie ma kto odpowiedzieć. Wygenerowane pliki łamią Prettier (`semi: true`, `trailingComma: all`); `field.tsx` ma `uniqueErrors?.length == 1` (`no-unnecessary-condition`, nienaprawialne przez `--fix`); część plików dostaje `"use client"` mimo `rsc: false` (w `--dry-run` raz `label.tsx`, raz `separator.tsx`), wbrew AGENTS.md.
- **Fix**: `add -o`, potem `git checkout -- src/components/ui/button.tsx`; `npm run lint:fix`, ręczne poprawki reszty, usunięcie `"use client"` i grep w kryterium 1.2.
- **Decision**: FIXED (Fix in plan)

### F2 — Niedostępny Supabase da komunikat ogólny i zero śladu w logach

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 4, kroki 1–2
- **Detail**: Plan usuwa surowy `error.message` z adresu i nigdzie go nie zapisuje. Brak połączenia i 502/503/504 dają `AuthRetryableFetchError` bez `code` (`auth-js` `fetch.js:28-43`), czyli `?error=unknown` → „Coś poszło nie tak. Spróbuj ponownie.” Tak wygląda uśpiony projekt Supabase (04.10.2026). Ponawianie nie pomaga, a diagnoza nie ma żadnego śladu.
- **Fix**: `console.error` z `name`, `status`, `code` (bez e-maila i hasła) w obu API; nowy kod `service_unavailable` dla braku połączenia i 5xx; wspólny komunikat z `config_missing` „Serwer jest chwilowo niedostępny. Spróbuj za kilka minut.” (neutralny także dla rejestracji).
  - Strength: od razu widać, że to Supabase, a nie hasło; Workers Logs są włączone (`wrangler.jsonc:12`).
  - Tradeoff: jeden kod więcej w mapie i 2 linie w każdym API.
  - Confidence: HIGH — klasa błędu i brak `code` sprawdzone w `@supabase/auth-js` 2.116.0.
  - Blind spot: zachowania prawdziwego uśpionego projektu nie da się łatwo odtworzyć lokalnie; mapowanie sprawdza skrypt 4.1.
- **Decision**: FIXED (Fix in plan)

### F3 — Sprawdzian świeżą sesją sprawdziłby stan bez reguły

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 5, krok 3
- **Detail**: `git worktree add` bierze zacommitowany stan, a reguła `## UI` i skan byłyby zacommitowane dopiero na końcu fazy, więc świeża sesja ich nie zobaczy i wynik w `ui-checks.md` byłby fałszywy. Do tego znana pułapka: junction do `node_modules` w worktree trzeba rozpiąć nierekurencyjnie przed usunięciem.
- **Fix**: commit reguły i skanu przed sprawdzianem, worktree z tego commita, bez `node_modules` (albo bezpieczne rozpięcie), wynik w drugim commicie fazy.
- **Decision**: FIXED (Fix in plan)

### F4 — Kontrola 1.5 oczekuje, że `/dev/live-sync` się nie zmieni

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1, Overview i kryterium 1.5; Migration Notes
- **Detail**: `LiveSyncDemo.tsx:130` używa `Button` w wariancie domyślnym bez nadpisań, więc po `class="dark"` przycisk „Zadzwoń” zmieni się z ciemnego na jasny `--primary`. Plan nie mówi też, kiedy zrobić zrzuty „przed”.
- **Fix**: zmiana zapisana jako oczekiwana; zrzuty „przed” robione przed zmianą `Layout.astro`.
- **Decision**: FIXED (Fix in plan)

### F5 — Liczba „przed” to 14, nie 13

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Desired End State; kryteria 2.1 i 5.3; Faza 5, krok 4; brief
- **Detail**: Skan obejmuje `src/components/auth/*.tsx`, więc łapie też `text-blue-100/50` w `SignUpForm.tsx`: przed zmianą 14 trafień, a nie 13 (13 to tylko pliki ekranu logowania z `change.md`).
- **Fix**: „14 (13 na ekranie logowania + 1 w `SignUpForm.tsx`)” w planie i briefie.
- **Decision**: FIXED (Fix in plan)

### F6 — Brak krytyki zrzutów przez model z wizją

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 4, krok 6; kryterium 4.7
- **Detail**: Zadanie 3 lekcji M2L5 każe zamknąć pętlę poprawek modelem czytającym zrzut („model wskazuje rozbieżności wobec założeń z change.md”). Plan robi zrzuty, ale ich nie ocenia.
- **Fix**: sekcja „Krytyka zrzutów” w `ui-checks.md` (porównanie z C1–C5 i `change.md`), każda uwaga poprawiona albo odłożona z powodem; dopisane do 4.7.
- **Decision**: FIXED (Fix in plan)

## Triage

Karol: „wszystkie wg rekomendacji” (2026-10-04).

| Decyzja | Ustalenia |
|---|---|
| Fixed | F1, F2, F3, F4, F5, F6 (6) |
| Skipped | — |
| Accepted | — |
| Dismissed | — |

Werdykt po poprawkach: REVISE → SOUND.
