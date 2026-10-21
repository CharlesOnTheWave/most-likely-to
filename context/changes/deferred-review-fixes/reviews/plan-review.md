<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Odłożone poprawki z przeglądów (F2, F3, F5)

- **Plan**: context/changes/deferred-review-fixes/plan.md
- **Mode**: Deep
- **Date**: 2026-10-20
- **Verdict**: REVISE (po poprawkach: SOUND)
- **Findings**: 1 critical, 4 warnings, 0 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | WARNING |
| Architectural Fitness | PASS    |
| Blind Spots           | FAIL    |
| Plan Completeness     | WARNING |

## Grounding

Grounding: 22/22 paths ✓, 11/11 symbols ✓, brief↔plan ✓

Potwierdzone w kodzie:

- głos i odsłona dostają ten sam warunek co `next_round` i `skip_round` (`full_game_evening.sql:119-122, 181-184`);
- `default null` przy `p_round` jest uzasadniony;
- kolejność sprawdzeń w `reveal_round` jest poprawna;
- pgTAP biegnie także po czerwonym Vitest (`ci.yml`, `if: success() || failure()`);
- rezygnacja z `it.fails` nie łamie `test-plan.md:172-174`, który opisuje dziurę zostającą otwartą;
- kolejność sprawdzeń w trasach Workera jest taka, jak opisuje plan (`vote.ts:25-47`, `next.ts:20-28`);
- pgTAP nie ma ogólnego przeglądu katalogu, który zmieniłaby nowa sygnatura `reveal_round`, a `plan(105)` jest aktualne.

## Findings

### F1 — Nowe testy fazy 1 rozsypią wieczór w beforeAll

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 1 #2 (pułapki kolejności, oczekiwany wynik)
- **Detail**: Wieczór w `game-rules.test.ts:84-134` gra się raz, krok po kroku, w `beforeAll`, więc dzisiejszy skutek każdej próby przechodzi na kolejne kroki.
  - (a) Odsłona bez numeru dziś odsłania rundę (`first_live_round.sql:763-765`) i nie było jej na liście czerwonych ani zielonych.
  - (b) Limit `skip_round` jako „ostatni ruch przed końcem gry” trafia w pominiętą rundę 4, więc dostaje `round_over` dziś i po migracji.
  - (c) Limit `next_round` dochodzi do `open_next_round` tylko przy odsłoniętej rundzie i zgodnym numerze.
  - (d) L4 z numerem daje dziś `PGRST202` i dubluje `round-rules.test.ts:255-294`.
- **Fix**: Wpisać dokładne miejsce każdej próby, poprawić listę czerwonych i zielonych, wykreślić L4/L5 i dodać w fazie 2 głos Oli z numerem 2 po I2.
- **Decision**: FIXED

### F2 — Poprawka wyroczni K1 jest niepełna i sama sobie przeczy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Faza 4 #1
- **Detail**: Kontrakt pomijał miejsca z tymi samymi liczbami:
  - kroki smoke: `refactor-opportunities/plan.md:93, :394`;
  - „12”: `:151, :159, :325`;
  - `plan-brief.md:24, :48, :91`.

  Tytuły Progress K1 1.1, 1.6 i 4.2 zawierają te liczby, a plan zabraniał je zmieniać. Przed K1 wejdą S-08 i S-06, które przesuną liczby kroków smoke.

- **Fix A ⭐ Recommended**: Jedna notka na górze planu K1 i briefu, bez przeliczania.
  - Strength: 2 linie, tytuły stałe, notka się nie starzeje.
  - Tradeoff: K1 przelicza przy starcie.
  - Confidence: HIGH — K1 i tak ruszy po kilku innych zmianach.
  - Blind spot: None significant.
- **Fix B**: Przeliczyć wszystko teraz, z tytułami Progress.
  - Strength: K1 od razu gotowe.
  - Tradeoff: ok. 12 miejsc, które S-08 i S-06 zdezaktualizują.
  - Confidence: MEDIUM — liczby zależą od kolejności zmian.
  - Blind spot: Co dodadzą S-08 i S-06.
- **Decision**: FIXED (Fix A)

### F3 — Odmowy „Odsłoń wynik” w smoke nie mają kontroli pozytywnej

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 2 #7 (smoke)
- **Detail**: Smoke miał tylko odmowy odsłony (400, 409). E2E nie klika przycisku (`round.spec.ts:49`). Udana odsłona z numerem przez Workera nie miała testu przed ręcznym sprawdzeniem na produkcji.
- **Fix**: Krok „host reveals question 3 with its number” w `gameSteps` przed „host ends the game”, więc smoke ma 4 nowe kroki.
- **Decision**: FIXED

### F4 — Sam rollback Workera po db push wyłącza „Odsłoń wynik”

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Migration Notes
- **Detail**: `npx wrangler rollback` (`deploy-plan.md:16`) po `db push` stawia stary Worker na nowej bazie, a wtedy odsłona dostaje `round_over`. Cofnięta baza z nowym Workerem daje `PGRST202` i 5xx.
- **Fix**: Po `db push` domyślnie naprawa do przodu. Opisane skutki obu połowicznych cofnięć. Pełne wycofanie to oba kroki razem.
- **Decision**: FIXED

### F5 — `npm run lint` nie sprawdza Markdownu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 4, kryterium 4.1 (i `test-plan.md` w fazie 2)
- **Detail**: `lint` to `eslint . && node scripts/ui-literals.mjs` (`package.json:10`), a ESLint nie czyta `.md`.
- **Fix**: `npx prettier --check` na zmienionych plikach `.md` w 4.1 i 2.1.
- **Decision**: FIXED
