<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Odłożone poprawki z przeglądów (F2, F3, F5)

- **Plan**: context/changes/deferred-review-fixes/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 5 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Success Criteria: lint, `astro check`, `npm test` (338), build and Prettier pass at `5f2e123`. CI was green on `420414a` and on `88bb289`. `db push --dry-run` showed one migration, and `migration list` shows it both locally and remotely. Smoke on production passed 57/57. Every Manual row is confirmed by Karol: 1.4 and 2.4 on 20.10, and 3.3, 4.5 and 4.6 on 21.10.

Checked and fine:

- The migration: `security definer`, `search_path = ''`, owner `postgres`, revoke and grants as planned.
- The check order of `reveal_round` (steps 1–8).
- One version of `reveal_round`, asserted by pgTAP `plan(107)`.
- The 1000 cap is the first statement, and its rollback restores the urn in `skip_round`.
- No route or log carries the target of a vote.
- `reveal.ts` follows `next.ts`/`skip.ts`.
- No `catch` swallows a failure.
- UI uses role classes only.

## Findings

### F1 — Owner's decision on the "ran out" sentence is not in the plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/deferred-review-fixes/plan.md:62 (vs src/components/room/HostActions.tsx:63, 100-104, 190-196)
- **Detail**: "What We're NOT Doing" (:62) says the note "Pytania z wybranych kategorii się skończyły." and error clearing in HostActions stay as they are.
  - On 21.10, Karol decided otherwise during phase 3. The note now uses the same sentence as the refusal (`QUESTIONS_RAN_OUT`). The refusal is grey, shown once, and read by the live region. Preview 63 was added.
  - The implementation is coherent. The decision is recorded only in the body of commit 420414a and in a code comment.
  - The domain evidence snapshots still quote the old note: `context/domain/evidence/2-code-language.md:64` and `3-code-rules.md:103`. `domain-distillation.md:182` cites `full-game-evening/research.md`. These are dated snapshots, refreshed by `/10x-domain-distillation --replace`.
- **Fix**: Append a dated addendum to plan.md (above `## Progress`) recording the decision and its files, so the archived plan matches the code.
- **Decision**: FIXED — addendum w plan.md (21.10.2026)

### F2 — Code paths to context/changes/deferred-review-fixes break after archiving

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/rooms/[id]/reveal.ts:12, tests/db/game-rules.test.ts:28, tests/unit/json-route.test.ts:97, tests/unit/room-errors.test.ts:20, scripts/smoke.mjs:268, :319
- **Detail**: After `/10x-archive`, these six comments point to a folder that no longer exists. Earlier changes point at `context/archive/<date>-…`. The precedent is 519bf3f, which rewrote 26 such lines after full-game-evening was archived. The header of the pushed migration stays as is, because pushed migrations are never edited.
- **Fix**: In the same follow-up PR as `/10x-archive`, rewrite the six paths to the archive folder.
- **Decision**: ACCEPTED — do poprawy przy /10x-archive (follow-ups/review-fixes.md)

### F3 — An old host tab gets the generic error on "Odsłoń wynik"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/rooms/[id]/reveal.ts:21-24, src/lib/rooms/errors.ts
- **Detail**: A page loaded before the deploy sends `reveal` with `{}`. It gets 400 `invalid_body`, which has no text in `MESSAGES`, so the host sees "Coś poszło nie tak. Spróbuj ponownie." Retrying does not help; a reload does. The last vote still reveals the round. The deploy happened while nobody was playing, so the window is closed.
- **Fix**: Accept. The next time a move gains a required body field, consider a refusal text that says to reload the page.
- **Decision**: ACCEPTED — okno wdrożenia minęło, nikt nie grał

### F4 — The grey sentence disappears after "Zakończ grę" → "Anuluj" (state 63)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/room/HostActions.tsx:117-118
- **Detail**: This happens only when the Worker twice fails to read the room's categories, so there is no note.
  - The first press of "Zakończ grę" calls `setError(null)`, so the sentence goes away and does not come back after "Anuluj".
  - Pressing "Następne pytanie" again shows the sentence again.
  - State 62, with the note, is unaffected.
- **Fix**: Accept (double failure only).
- **Decision**: ACCEPTED — tylko przy podwójnej awarii odczytu kategorii

### F5 — "skip" used for the candidate filter in test comments

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/db/game-rules.test.ts:31, :46, :154
- **Detail**: In the glossary, "skip" means _pominięcie pytania_ (`skip_round`), and the same file probes `skip_round` with these lists. The filter "skips" malformed candidates, which mixes the two meanings.
- **Fix**: Change "skipped like" / "skips" to "ignored like" / "ignores" in these three comments.
- **Decision**: FIXED — „ignored/ignores” w trzech komentarzach

### F6 — Outdated SMOKE_GAME=0 window note in smoke

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: scripts/smoke.mjs:321-322
- **Detail**: The comment still describes the S-03 deploy window ("a Worker without next, skip and end"). In this change's window, the round steps would fail too, because the old Worker sends `round_over` and not 400. The plan did not run smoke in the window.
- **Fix**: Drop the parenthesis about the S-03 window, leaving "Skipped with SMOKE_GAME=0 and with SMOKE_ROUND=0."
- **Decision**: FIXED — usunięty dopisek o oknie S-03

### F7 — F3 probes placed after `nextWithNoneLeft`, not before

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/db/game-rules.test.ts:147-151
- **Detail**: The plan placed the filter probe and the `next_round` limit probe before `nextWithNoneLeft`. They sit after it, before the existing state read. All three are refusals that write nothing, so the outcome is the same.
- **Fix**: Accept.
- **Decision**: ACCEPTED — bez wpływu na wynik
