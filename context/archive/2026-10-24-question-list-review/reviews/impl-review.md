<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Przegląd listy pytań przed startem (S-06)

- **Plan**: context/changes/question-list-review/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-24
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 5 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Evidence: every planned change is MATCH (migration, Worker, routes, screen, previews, db/pgTAP/unit/E2E tests, smoke, docs); nothing MISSING; nothing from "What We're NOT Doing" was built. Extras were reported and approved during implementation: optimistic row update and the empty-list line in `QuestionList.tsx`, the `SMOKE_LIST` ask rule in `.claude/settings.json` (lessons.md), the phone project in `playwright.config.ts` (test-plan §6.4), icon-only row buttons below `lg` (owner's choice). Local gate on `25f034f`: lint, `astro check`, 510 unit tests, build, Prettier on the changed docs, old-SHA grep: all pass. CI on PR #18 and on `main` (`fa585ee`): `ci`, `db`, `e2e`, `smoke` green; production smoke 77/77; `db push` with `migration list` local = remote; Advisors → Security 0 errors; owner's click-through on phone and laptop OK. The `review` (AI review) job was red on the last two pushes only because of its $0.50 budget on a large diff; it is not part of the gate.

## Findings

### F1 — Entry with an id outside the question base is hidden from the host but still played

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/rooms/server.ts:257
- **Detail**: `listQuestions` skips an entry whose `question_id` the base does not know (logged as `unknown_question`), but the database keeps it as not removed: `start_game`/`open_next_round` still play it (screen: "could not load the question"), the host cannot "Usuń" it, "Pytania (N)" undercounts, and `questionsLeft` assumes every base id on the list is in the pool (B ⊆ P, the accepted Q-04 decision). Reachable only if an id disappears from `src/data/questions.ts` (forbidden by its rules, `questions.ts:4-11`) or a host calls the RPC directly with made-up ids (harms only their own game).
- **Fix**: Show such an entry with a placeholder text and keep its "Usuń".
- **Decision**: SKIPPED

### F2 — `rounds.list_position` foreign key has no cascade

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261024094002_question_list_review.sql:77-78
- **Detail**: Deleting a room or user cascades to both `private.rounds` and `private.game_questions` in one statement, so today it works (NO ACTION is checked at statement end). A future cleanup (S-13) that deletes `game_questions` on its own would fail with 23503. No test deletes a room whose rounds point at list entries.
- **Fix**: Queue for S-13: a pgTAP case deleting a room with a round played from the list.
- **Decision**: QUEUED for S-13 (follow-ups/review-fixes.md)

### F3 — Own questions are kept with the closed room indefinitely

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261024094002_question_list_review.sql:47
- **Detail**: By the planned decision (FR-021, S-11) the list stays after "Nowa gra", outside the 12 h sweep. An own question may name a guest ("Kuba spóźniłby się…"). No Hard Rule is broken (no voter→target link, nothing logged), but FR-019 (deleting a game deletes what relates to nicks) and S-13 retention should cover it.
- **Fix**: Queue for S-13: include `private.game_questions` (own texts) in its retention and deletion scope.
- **Decision**: QUEUED for S-13 (follow-ups/review-fixes.md)

### F4 — "Przejrzyj pytania" can keep spinning when the refresh after it fails

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/room/QuestionList.tsx:391, 413
- **Detail**: If the action succeeds but the following state refresh fails, `opening` stays true until the next 15 s poll; "Pytania wylosowane." is announced before the list renders. Recovers by itself.
- **Fix**: Clear `opening` and announce once `questions` turns non-null.
- **Decision**: SKIPPED

### F5 — Focus edge cases in the list

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/room/QuestionList.tsx:454
- **Detail**: After "Usuń", if the next row is in "Popraw" mode, focus skips to the row after it (a row in edit has no "Popraw" registered); Escape cancels only from inside the field, not from "Zapisz"/"Anuluj". Both within the plan's wording; the keyboard pass (3.4) passed.
- **Fix**: Register the edit field as the focus target of a row in edit mode.
- **Decision**: SKIPPED
