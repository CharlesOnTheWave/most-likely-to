<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Live sync spike (F-01)

- **Plan**: context/changes/live-sync-spike/plan.md
- **Mode**: Deep
- **Date**: 2026-10-03
- **Verdict**: REVISE → SOUND po poprawkach (wszystkie 6 naniesione)
- **Findings**: 0 critical, 5 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
13/13 paths ✓ (5 nowych celowo jeszcze nie istnieje), 6/6 symbols ✓ (`output: "server"`, `httpSend`, `channel()`, `astro:env/server`, `locals.user`, globale eslint), brief↔plan ✓; 1 zła linia (`infrastructure.md:17`, nie `:127`). Weryfikacja kodu (subagent): renderowanie na żądanie ✓, `httpSend` bez `subscribe()` ✓, `removeChannel` bez WebSocketu i bez czekania ✓, origin check dla JSON ✓, supabase-js/realtime-js 2.116.0 ✓.

## Findings

### F1 — Fałszywy dzwonek decyduje, jakie pytanie widzą wszyscy

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details; Faza 2 (`stateFor`)
- **Detail**: Na publicznym kanale każdy z kluczem publishable może nadać `bell` (`external-research.md:65`); ryzyko przyjęto jako „spam odświeżeń” (`:153,186`). W spike'u tablica liczy pytanie z `seq` z dzwonka, więc fałszywy dzwonek wybiera treść (pre-mortem `infrastructure.md:143`), a plan mówi „kod zostaje jako fundament” bez oznaczenia skrótu.
- **Fix**: Dopisać, że „dzwoni tylko zalogowany” dotyczy wyłącznie endpointu, a dzwonek jest niezaufaną podpowiedzią; `stateFor(room, seq)` oznaczyć jako skrót prototypu; od S-02 stan wyłącznie z bazy (też w roadmapie w fazie 5).
- **Decision**: FIXED (Fix in plan) — nowy akapit „Dzwonek jest niezaufaną podpowiedzią” w Critical Implementation Details, notka przy `stateFor`, punkt w kontrakcie roadmapy (faza 5), ryzyko w `plan-brief.md`.

### F2 — httpSend nie zwraca statusu, a czeka do 10 s

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 2 — `ringRoom`, `ring.ts`
- **Detail**: Plan: `ringRoom` „zwraca sukces albo błąd ze statusem”. realtime-js 2.116: sukces tylko przy 202, każdy inny wynik rzuca `Error` bez statusu (`RealtimeChannel.ts:982-1002`); domyślny timeout 10 s (`constants.ts:20`).
- **Fix**: `ringRoom` łapie wyjątek i zwraca `{ ok: false }` (endpoint 502); `httpSend` z `timeout: 5000`.
- **Decision**: FIXED (Fix in plan)

### F3 — Kryteria 4.2 i 5.2 wymagają PASS, a FAIL to też wynik

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Faza 4 i 5 — Success Criteria; Progress 4.2, 5.2
- **Detail**: Plan przewiduje werdykt negatywny, ale kryterium fazy to „kod 0”. Agent mógłby „naprawiać” sondę pod wynik.
- **Fix**: Kody 0 PASS / 1 FAIL / 2 błąd techniczny; kryterium „kod 0 albo 1, werdykt zapisany”; przy FAIL pauza i decyzja Karola, bez zmian kodu pod wynik.
- **Decision**: FIXED (Fix in plan) — także Desired End State, Implementation Note fazy 4 i tytuły Progress 4.2/5.2 (zmienione w trakcie przeglądu, przed implementacją).

### F4 — getPublicSupabaseConfig: za późno i bez strażnika klucza

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2 (`config.ts`) i Faza 3 (#1 `supabase.ts`)
- **Detail**: Funkcja powstawała w fazie 3, a endpoint z fazy 2 z niej korzysta. Nic nie wymusza, że `SUPABASE_KEY` jest publishable, a `/api/live-sync/config` jest publiczny.
- **Fix**: Przenieść do fazy 2 (#0) i zwracać `null`, gdy klucz nie zaczyna się od `sb_publishable_`.
- **Decision**: FIXED (Fix in plan) — w fazie 3 numeracja zmian to teraz 1. Strona, 2. Wyspa.

### F5 — Sonda może mierzyć tablicę z ciasteczkami hosta

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 4 — kontrakt sondy
- **Detail**: Z ciasteczkami sesji middleware przy każdym z 20 pobrań tablicy woła Supabase Auth (`middleware.ts:10-12`), czego goście nie robią; pomiar byłby zawyżony.
- **Fix**: Ciasteczka tylko przy logowaniu (z `Origin`, jak `smoke.mjs:29`) i dzwonku; gracze pobierają tablicę bez ciasteczek.
- **Decision**: FIXED (Fix in plan)

### F6 — Drobne nieścisłości w kontraktach

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 #2, #3, #5; Faza 3 wyspa
- **Detail**: „prosto z przeglądarki” jest w `infrastructure.md:17`, nie `:127`; wyspa importuje też React i supabase-js; ask nie łapie `node ./scripts/live-sync-probe…`; `@supabase/ssr` 0.12.7 już wymaga supabase-js `^2.114.0`.
- **Fix**: Poprawić odnośnik i brzmienie, 6. wpis ask, zakres `^2.114.0`.
- **Decision**: FIXED (Fix in plan) — kryterium 1.2 mówi teraz o 6 wpisach ask; brief zaktualizowany.
