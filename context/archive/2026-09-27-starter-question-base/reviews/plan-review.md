<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Baza startowa pytań (F-02)

- **Plan**: context/changes/starter-question-base/plan.md
- **Mode**: Deep
- **Date**: 2026-09-27
- **Verdict**: SOUND
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding
Grounding: 4/4 paths ✓ (src/data/ nowy, zgodnie z planem), 3/3 symbols ✓ (FR-005, ### S-01, astro check w CI), brief↔plan ✓. Codebase: TS1117 potwierdzony w `npx astro check` i `tsc` (TS 6.0.3); szkic pliku przechodzi eslint, astro check i prettier; nic nie importuje `src/data`, a nieimportowany moduł nie trafia do paczki.

## Findings

### F1 — Kryteria 2.1, 2.2 i 3.1 nie mówią, czym je sprawdzić

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 i Phase 3, Success Criteria
- **Detail**: Kryteria automatyczne (liczby w kategoriach, brak powtórek, zgodność pliku z przeglądem) nie miały polecenia, a „powtórzony tekst” nie był zdefiniowany.
- **Fix**: Jednorazowy skrypt node w scratchpadzie sesji (bez commitu), wynik w raporcie fazy; „powtórzony” = identyczny po zamianie na małe litery i przycięciu spacji.
- **Decision**: FIXED (Phase 2 Overview)

### F2 — Ochrona przed powtórzonym ID działa tylko w jednym literale

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Critical Implementation Details, Phase 1 (Contract)
- **Detail**: TS1117 działa w `astro check` i `tsc`, ale ESLint (`no-dupe-keys` wyłączone dla TS) i build go nie łapią, a sklejenie części przez spread przepuszcza duplikat po cichu.
- **Fix**: `QUESTIONS` zostaje jednym literałem, bez spreadu; zapisane w Critical Implementation Details i w zasadach komentarza pliku.
- **Decision**: FIXED

### F3 — Długie pytania rozleją się na kilka linii (Prettier)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3
- **Detail**: Przy szerokości 120 znaków wpis z ID `podroze-i-przygody-NNN` mieści w linii tekst do ok. 33 znaków; dłuższe Prettier rozbije, a `npm run lint` zgłosi formatowanie.
- **Fix**: W Fazie 3 `npm run lint:fix` przed `npm run lint`.
- **Decision**: FIXED (Phase 3 Contract)

### F4 — Brief obiecuje „bez zmian w bazie danych” dla S-01 i S-02

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: plan-brief.md, Success Criteria (Summary)
- **Detail**: S-01 i tak będzie potrzebować tabel na pokoje; bez bazy obejdą się tylko same pytania.
- **Fix**: „…bez przenoszenia pytań do bazy danych”.
- **Decision**: FIXED
