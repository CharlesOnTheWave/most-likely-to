# Sources: code

- repo_root: C:\Users\karol\10xdevs
- code_scope: . (whole repository; one application)
- head: a4eb127 (clean)
- path_alias: none

## Stack

- TypeScript, Astro 7 in SSR mode (`astro.config.mjs`), React 19 islands for interactive screens
- Tailwind 4 + shadcn/ui components (`src/components/ui/`)
- Supabase: Postgres (SQL migrations, SQL functions, row-level security, pg_cron), Auth, Realtime (`@supabase/supabase-js`, `@supabase/ssr`)
- Deployed to Cloudflare Workers (`wrangler.jsonc`)
- Tests: Vitest (unit, database-through-API), pgTAP (database catalog), Playwright (browser E2E)

## Layers

| layer | path patterns | notes |
| --- | --- | --- |
| entry points | `src/pages/**/*.astro`, `src/pages/**/*.ts` (`src/pages/api/**` = JSON/HTTP endpoints), `src/middleware.ts` | Astro file-based routing; page files and API route files are both entry points |
| entry points (scheduled) | `supabase/migrations/*.sql` (pg_cron schedule inside a migration) | a scheduled database job is declared in SQL, not in the Worker |
| application logic | `src/lib/**/*.ts` (server-side helpers, route helpers), `src/components/room/room-actions.ts` | no separate service layer; server logic sits in `src/lib/` subfolders |
| application logic (database) | `supabase/migrations/*.sql` (SQL functions called over RPC) | a large part of the rules is written as SQL functions; later migrations replace earlier function versions (`create or replace`), so the newest definition wins |
| domain types | `src/lib/**/shared.ts`, other `src/lib/**/*.ts` type declarations, `src/data/questions.ts` (static content shipped with the code) | no dedicated domain-model layer; types live next to the logic that uses them (this is a finding, not a gap) |
| persistence | `supabase/migrations/*.sql` (tables, schemas, grants, policies, functions, triggers), `supabase/config.toml` | 4 migration files; tables in more than one schema |
| UI | `src/components/**/*.tsx`, `src/components/**/*.astro`, `src/components/**/use*.ts` (client state), `src/layouts/`, `src/styles/global.css` | screen copy (user-facing text) lives inside components and some `src/lib/**` modules |
| tests | `tests/unit/*.test.ts`, `tests/db/*.test.ts` (+ `tests/db/support/`), `tests/e2e/*.spec.ts` (+ `tests/e2e/support/`), `supabase/tests/*.test.sql`, `tests/hooks/` | test names and fixtures also carry vocabulary |

## Excluded

| path | reason |
| --- | --- |
| `context/` (all of it, including `context/domain/`, `context/map/`, `context/archive/`, `context/changes/`) | documents and earlier analyses, not code; read by the docs agent and the synthesis only |
| `AGENTS.md`, `CLAUDE.md`, `README.md` | instruction and reference documents; read by the docs agent only |
| `.claude/` (skills, prompts, hooks, settings) | agent configuration and course tooling, not the product |
| `scripts/` (`smoke.mjs`, `live-sync-probe.mjs`, `ui-literals.mjs`) | developer tooling: smoke check, probe, lint helper |
| `src/pages/dev/**`, `src/components/live-sync/**`, `src/lib/live-sync/**`, `src/pages/api/live-sync/**` | dev-only preview pages and an early technical spike; may be read to tell spike code from product code, not as primary evidence. **Correction after the run:** the product imports `src/lib/live-sync/{server,shared,limiter}.ts` (`src/lib/rooms/server.ts:2`, `src/components/room/useRoomState.ts:5-6`), so those three files are product code; both code agents read them where a rule depended on them |
| `src/components/ui/**` | generated shadcn/ui primitives (vendored) |
| `.github/`, `.husky/`, `.vscode/`, config files (`eslint.config.js`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `components.json`, `wrangler.jsonc`, `package*.json`) | build, CI and editor tooling |
| `node_modules/`, `dist/`, `.astro/`, `.wrangler/`, `playwright-report/` | generated or vendored |
| `.dev.vars`, `.env*` | secrets; never open |
