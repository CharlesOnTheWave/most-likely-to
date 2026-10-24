<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Pukanie do Supabase z GitHub Actions

- **Plan**: context/changes/keep-supabase-awake/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-24
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Evidence: every planned item is MATCH and still on `HEAD` (script and workflow unchanged since the merge `5e2ace6`, formerly `8a5e6a2`). Benign extras: `redirect: "manual"`, a filtered status word and `process.exitCode` in the script; a README CI paragraph; `infrastructure.md` notes in Secrets and Approval; `gh workflow enable|disable` in `AGENTS.md`. The four no-network refusals exit 2 and print no value. Prettier on the workflow, settings, `package.json` and the six docs passes. Runs: 8 of 8 scheduled and 1 of 1 manual green. The Progress SHAs `c5dac7f`, `fa36dcd`, `8a5e6a2` predate the 2026-10-22 history rewrite (map: `context/deployment/history-rewrite-2026-10-22.md`).

## Findings

### F1 — `node --run keep-awake` bypasses the ask rules

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .claude/settings.json:6, 54-58
- **Detail**: Node 22+ runs package.json scripts with `node --run <name>`. That matches the allow rule `Bash(node *)` and none of the ask rules (they need `npm` or `keep-supabase-awake` in the command), so `node --run keep-awake` would ping production without a prompt. The same gap covers `node --run smoke` and `node --run live-probe`. This is the case of the lesson „Dopisuj regułę „ask” dla każdego skrótu do wdrożenia lub bazy”.
- **Fix**: Add `Bash(node --run*)` and `Bash(node *--run*)` to `ask`.
- **Decision**: FIXED (`Bash(node --run*)`, `Bash(node *--run*)` in ask)

### F2 — Silent 60-day disable is not caught by the fallback check

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: context/deployment/deploy-plan.md:193
- **Detail**: After 60 days without commits GitHub disables the schedule without a red run or mail, and the last runs stay green. The fallback in `deploy-plan.md:193` sits in the troubleshooting list (reached once sign-in already fails) and checks only that the last runs are green. `test-plan.md:332` points to a pre-evening checklist that does not exist in the repo.
- **Fix**: Reword `deploy-plan.md:193` to "the latest run is less than about 12 h old and the workflow is not Disabled" and add it as a step before a real evening.
- **Decision**: FIXED (deploy-plan.md:193 and a pre-evening step; test-plan.md §7 points to it)

### F3 — `gh run rerun` is allowed locally

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .claude/settings.local.json:59
- **Detail**: The git-ignored local settings allow `Bash(gh run *)`, so `gh run rerun` of a keep-awake run would repeat the production ping without a prompt. The ping only reads one row by a dummy code, so the effect is the same as a scheduled run.
- **Fix**: Note it next to the `gh api` remark (plan, What We're NOT Doing) or add `Bash(gh run rerun*)` to `ask`.
- **Decision**: SKIPPED

### F4 — Action versions are tags, not commit SHAs

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: .github/workflows/keep-supabase-awake.yml:27, 29
- **Detail**: `actions/checkout@v4` and `setup-node@v4`, as in `ci.yml`, while `ai-review.yml` pins SHAs. The job holds only public values (publishable key, URL).
- **Fix**: Keep as in `ci.yml`; revisit both together if the repo adopts SHA pinning.
- **Decision**: SKIPPED

### F5 — Proof that the ping prevents pausing comes only after a quiet week

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A
- **Detail**: A green run shows `room_link` read `public.rooms`, but Supabase does not publish what exactly counts as activity. The real proof is the project staying active after 7+ days without players; the workflow runs since 2026-10-22, and the game itself has had traffic since.
- **Fix**: Check the project status in the Supabase dashboard after the first week without players.
- **Decision**: SKIPPED (check after the first quiet week, from 29.10.2026)
