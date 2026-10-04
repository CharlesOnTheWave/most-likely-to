# Repository Guidelines

"Most Likely To" is a live browser party game: everyone sees the same question, casts one anonymous vote, and the result is revealed after the last vote. Stack: Astro 7 (SSR) + React 19 islands + Tailwind 4 + Supabase auth, deployed to Cloudflare Workers. Product scope: @context/foundation/prd.md. Stack decision: @context/foundation/tech-stack.md.

## Hard Rules

- Never persist, log or return a pairing of voter and voted-for player, in any form. Votes are anonymous by design (PRD Non-Goals).
- Do not add points, leaderboards or round timers; they are PRD Non-Goals.
- Ask the user before any command that publishes or changes remote or database state: `git push` (a push to `main` deploys to production), `npx wrangler deploy`, `npx wrangler rollback`, `npx wrangler versions deploy`, `npx wrangler delete`, `npx wrangler secret put`, `npx supabase db push`, `npx supabase db reset`.
- Read `SUPABASE_URL` / `SUPABASE_KEY` only through `astro:env/server` (see @src/lib/supabase.ts), never via `import.meta.env`. Never commit `.env` or `.dev.vars`.
- `SUPABASE_KEY` must be the publishable key (`sb_publishable_…`). Server code may pass the URL and this key to the browser at runtime (page props or a JSON endpoint), only for Realtime subscriptions. A secret or `service_role` key never goes to the browser, the repo or logs.
- Only `/10x-archive` moves a finished change into `context/archive/`; never edit anything already there.

## Commands

Before handing off a change, `npm run lint`, `npx astro check` and `npm run build` must pass; CI (@.github/workflows/ci.yml) runs the same gate. Other scripts: @README.md.

- `npx astro sync`: regenerate `.astro/` types after a fresh clone or config change; without it, lint reports false `no-unsafe-*` errors.
- Workers Builds deploys every push to `main` to production, even when CI fails: run the gate before `git push`, then `BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke`. Deploy steps and status: @context/deployment/deploy-plan.md.

## Testing

No unit or e2e framework yet. `npm run smoke` (@scripts/smoke.mjs) needs a running server and a reachable Supabase with email confirmation off. The local `.dev.vars` points at the only Supabase project, which production also uses, so every run adds a `smoke-<timestamp>@example.com` user there. Without `.dev.vars` (fresh clone), skip it; a smoke failure then is not a code bug.

## Conventions

- Add shadcn/ui components with `npx shadcn@latest add <name>`. Since September 2026 (after your training data) shadcn ships `cn()` as the `cn` npm package and imports it from `"cn"`; `@/lib/utils` only re-exports it. Keep those imports and the `cn` dependency; they are not a bug.
- No Next.js directives such as `"use client"` in React components.
- Create Supabase migrations with `npx supabase migration new <name>`; every new table gets RLS with per-operation policies.

## Tooling Gotchas

- Files use LF line endings (@.gitattributes, Prettier). Lint errors `Delete ␍` mean CRLF crept in: run `npm run lint:fix`.
- The husky pre-commit hook is not installed (no `prepare` script); run `npm run lint` yourself before committing.
- `npm run dev` (Astro 7) starts the dev server in the background and returns at once; manage it with `npx astro dev status`, `npx astro dev logs` and `npx astro dev stop`. Stop it when you are done.
- The deploy target is Cloudflare Workers (@wrangler.jsonc), not Pages: never use `wrangler pages` commands.
