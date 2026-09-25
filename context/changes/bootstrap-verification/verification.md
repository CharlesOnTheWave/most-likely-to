---
bootstrapped_at: 2026-09-20T10:57:28Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: most-likely-to
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

Verbatim copy of `context/foundation/tech-stack.md` frontmatter:

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: most-likely-to
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: true
  has_ai: false
  has_background_jobs: false
```

### Why this stack (from hand-off body)

A solo, after-hours builder shipping a browser party game ("Most Likely To") in 8 weeks, for tens to a hundred users, with host sign-in via an external provider and a live round that must reveal results to every player within 2 seconds of the last vote. The language family is JS/TS: the game runs in the phone browser, so the client is JavaScript regardless, and one language across client and server keeps the moving parts minimal for a beginner working with an agent. `10x-astro-starter` is the recommended default for `(web, js)`, clears all four agent-friendly gates (typed, convention-based, popular in training data, well documented), and ships auth, database, and edge deployment out of the box; bootstrapper confidence is first-class, so scaffolding should be smooth with at most occasional manual steps. One flagged gap: the starter card does not list realtime, which the PRD requires (FR-007, FR-009, FR-011, FR-020); the bundled database offers a realtime channel, but the edge runtime constrains long-lived connections, so this must be designed deliberately at bootstrap. Deployment defaults to Cloudflare Pages (user deferred to the starter default), CI on GitHub Actions with auto-deploy on merge.

## Pre-scaffold verification

| Signal      | Value                                                                  | Severity | Notes                                                                                                   |
| ----------- | ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| npm package | not run                                                                | n/a      | `cmd_template` starts with `git clone`; no npm `create-*` package to resolve                            |
| GitHub repo | `przeprogramowani/10x-astro-starter` last pushed 2026-09-12T21:16:08Z  | fresh    | from card `docs_url`; 7 days before bootstrap. `gh` CLI not installed, queried GitHub REST API directly |

Registry card metadata at bootstrap time: 97 stars, default branch `master`, `toolchain.runtime_version: node 22`.

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone (clone starter into a temp dir, delete its `.git/`, move files up into cwd)
**Exit code**: 0
**Files moved**: 21 top-level entries (52 source files across `.github/`, `.husky/`, `.vscode/`, `public/`, `scripts/`, `src/` (26 files), `supabase/` and 15 root files) plus `node_modules/`
**Conflicts (.scaffold siblings)**: `CLAUDE.md` → existing (10xDevs course rules, M1L3) kept; starter copy saved as `CLAUDE.md.scaffold`
**.gitignore handling**: moved silently (absent in cwd before scaffold)
**context/ handling**: scaffold contained no `context/`; cwd `context/` preserved untouched
**.bootstrap-scaffold cleanup**: deleted (empty after move-up; `.bootstrap-scaffold/.git/` removed before move-up so upstream history did not leak)

Moved entries: `.github`, `.husky`, `.vscode`, `node_modules`, `public`, `scripts`, `src`, `supabase`, `.env.example`, `.gitignore`, `.nvmrc`, `.prettierrc.json`, `AGENTS.md`, `astro.config.mjs`, `components.json`, `eslint.config.js`, `package-lock.json`, `package.json`, `README.md`, `tsconfig.json`, `wrangler.jsonc`.

CLI output (npm install): `added 648 packages, and audited 649 packages in 11m` / `found 0 vulnerabilities`. Warning: 3 packages have install scripts not yet covered by `allowScripts` (`esbuild@0.28.2`, `workerd@1.20260911.1`, `esbuild@0.28.1`); npm suggests `npm approve-scripts --allow-scripts-pending` to review. Informational only.

Environment notes:
- Local Node is v24.19.0; starter `.nvmrc` pins 22.14.0 and card says `node 22`. Install succeeded on 24; keep in mind if a toolchain mismatch surfaces later.
- Git 2.55.0 was installed via winget immediately before this run (was absent on the machine).
- `npm install` took ~11 minutes (slow disk / antivirus scanning of `node_modules`), not a failure.

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW (0 INFO)
**Direct vs transitive**: 0/0/0/0 direct of total 0/0/0/0
**Dependency tree**: 804 total (377 prod, 269 dev, 167 optional)
**Exit code**: 0

#### CRITICAL findings

none

#### HIGH findings

none

#### MODERATE findings

none

#### LOW / INFO findings

none

## Hints recorded but not acted on

| Hint                    | Value                 |
| ----------------------- | --------------------- |
| bootstrapper_confidence | first-class           |
| quality_override        | false                 |
| path_taken              | standard              |
| self_check_answers      | null                  |
| team_size               | solo                  |
| deployment_target       | cloudflare-pages      |
| ci_provider             | github-actions        |
| ci_default_flow         | auto-deploy-on-merge  |
| has_auth                | true                  |
| has_payments            | false                 |
| has_realtime            | true                  |
| has_ai                  | false                 |
| has_background_jobs     | false                 |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep (`CLAUDE.md.scaffold` here: the starter's own agent instructions; the M1L4 skill will reconcile them with the course rules).
- Address audit findings per your project's risk tolerance — the full breakdown is in this log (none this run).
- `package.json` has no `test` script; the starter ships `npm run smoke` (`scripts/smoke.mjs`) and `npm run lint`. Run those as the lesson's "tests pass" check.
- Copy `.env.example` to `.env` and fill Supabase keys before `npm run dev` (needs a Supabase project, planned for a later lesson).
