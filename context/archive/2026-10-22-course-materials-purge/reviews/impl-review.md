<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Materiały kursu poza publicznym repo

- **Plan**: context/changes/course-materials-purge/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-24
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

Evidence, re-checked on 2026-10-24 rather than taken from Progress:

- In the repo: `.gitignore` covers all nine course patterns and `CLAUDE.local.md`; `playwright-cli` (11 files), the hooks and `settings.json` are the only tracked files under `.claude/`; `CLAUDE.md` is the single `@AGENTS.md` line; `git grep` for the 10x-cli block markers is empty; the three kept comments are in place; the phase 1 and phase 5 commits (`b71446c`, `d2b1abf`) touch only the planned files. The map has 216 well-formed rows; every new SHA exists with a matching subject; it contains no disk paths and no personal data.
- History: `git log --all` over every local ref shows no course path except `playwright-cli` and no block marker. The tree of `main` in the rewrite copy equals the tree in the GitHub mirror (`2da1290`). A fresh pair-by-pair check over all 216 map rows (in the verify copy) found 0 mismatches. Each pair differs only in course files and `CLAUDE.md`, author, committer, dates and message are identical, and the `playwright-cli` file count is unchanged.
- Backups: both mirrors are present; the GitHub mirror has 16 `refs/pull/*` (the plan said 15, written before PR #16 existed); the local mirror has both formerly unpushed commits; `commit-map.txt` holds 216 pairs; `rev-list --all --count` of the rewrite copy is 216.
- GitHub: the tree of `main` has 0 course paths; `446f143` is on `main` and the old `1c7a191` is not; on `446f143` `ci`, `smoke`, `db`, `e2e` and Workers Builds succeeded; on PR #17 the four required checks passed and only the non-gating AI `review` is red.
- Folders: in both `10xdevs-gra` and `10xdevs`, 174 of 174 course files match the backup checksums (`CLAUDE.md` excluded, since it changed by design); they are ignored, `CLAUDE.local.md` is present, `CLAUDE.md` is 41 bytes and `git status` is clean. `git filter-repo` is uninstalled. This session in `10xdevs-gra` loaded `CLAUDE.local.md` and lists the `10x-*` skills.
- Gate on the current branch: `npm run lint`, `npx astro check` (0 errors), `npm test` (510 passed) and `npm run build` pass.
- Benign extras: `history-rewrite-2026-10-22.md:7` gives the real counts (16 PR pages, 18 commits without "Verified") instead of the plan's 15/15; `deploy-plan.md:203` is dated 23.10, the actual merge day, rather than the planned 22.10.

## Findings

### F1 — Map links to the plan by its pre-archive path

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: context/deployment/history-rewrite-2026-10-22.md:5
- **Detail**: "Plan i decyzje: `context/changes/course-materials-purge/plan.md`" goes stale as soon as `/10x-archive` moves the folder. It is the only tracked file outside the change folder that names this path. The `keep-supabase-awake` close-out repointed the same kind of reference in `8d4129e`.
- **Fix**: Right after the archive commit, point it at `context/archive/2026-10-22-course-materials-purge/plan.md`.
- **Decision**: FIXED — repointed to the archive path in the same commit as this review, just before the archive commit

### F2 — Two merged branches are back on GitHub

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A (GitHub: `question-list-review`, `question-list-review-archive`)
- **Detail**: The desired end state and item 5.5 say that only `main` is on GitHub. That was true on 23.10, but the branches of PR #18 and PR #19 (both merged on 24.10) were never deleted, and the repository has `delete_branch_on_merge=false`. Both are on the new history, so no course files come back. This is about keeping things tidy and keeping to the stated end state.
- **Fix**: With approval, run `git push origin --delete question-list-review question-list-review-archive` and turn on "Automatically delete head branches" (`gh api -X PATCH repos/CharlesOnTheWave/most-likely-to -F delete_branch_on_merge=true`).
- **Decision**: FIXED — both branches deleted on GitHub (both fully on `main`) and `delete_branch_on_merge=true`, with Karol’s approval on 2026-10-24; `git ls-remote --heads origin` shows only `main`

### F3 — Deploy-plan notes: "tego planu" is ambiguous, second note has no change-id

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: context/deployment/deploy-plan.md:203-204
- **Detail**: Inside `deploy-plan.md`, "historia do przepisania w fazach 2–5 tego planu" reads as if it meant the deploy plan, and the second "→ 23.10.2026:" sub-bullet does not carry the `(`course-materials-purge`)` tag that its sibling and the file's other notes use. The wording came from the plan's own contract.
- **Fix**: Change the text to "w fazach 2–5 planu tej zmiany" and add `(`course-materials-purge`)` to the second sub-bullet.
- **Decision**: FIXED — "w fazach 2–5 planu tej zmiany" and the `(course-materials-purge)` tag added
