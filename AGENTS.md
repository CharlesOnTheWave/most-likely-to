# Repository Guidelines

"Most Likely To" is a live browser party game: everyone sees the same question, casts one anonymous vote, and the result is revealed after the last vote. Stack: Astro 7 (SSR) + React 19 islands + Tailwind 4 + Supabase auth, deployed to Cloudflare Workers. Product scope: @context/foundation/prd.md. Stack decision: @context/foundation/tech-stack.md.

## Hard Rules

- Never persist, log or return a pairing of voter and voted-for player, in any form. Votes are anonymous by design (PRD Non-Goals).
- Do not add points, leaderboards or round timers; they are PRD Non-Goals.
- Ask the user before any command that publishes or changes remote or database state: `git push`, `npx wrangler deploy`, `npx wrangler secret put`, `npx supabase db push`, `npx supabase db reset`.
- Read `SUPABASE_URL` / `SUPABASE_KEY` only through `astro:env/server` (see @src/lib/supabase.ts); never via `import.meta.env`, never in React components. Never commit `.env` or `.dev.vars`.
- Never edit `context/archive/`.

## Commands

Before handing off a change, `npm run lint`, `npx astro check` and `npm run build` must pass; CI (@.github/workflows/ci.yml) runs the same gate. Other scripts: @README.md.

- `npx astro sync`: regenerate `.astro/` types after a fresh clone or config change; without it, lint reports false `no-unsafe-*` errors.

## Testing

No unit or e2e framework yet. `npm run smoke` (@scripts/smoke.mjs) needs a running server and a reachable Supabase with email confirmation off. Until `SUPABASE_URL` is set in `.dev.vars`, skip it; a smoke failure without it is not a code bug.

## Conventions

- Protect pages by adding paths to `PROTECTED_ROUTES` in @src/middleware.ts.
- Merge Tailwind classes with `cn()` from `@/lib/utils`, never by string concatenation.
- Add shadcn/ui components with `npx shadcn@latest add <name>`.
- No Next.js directives such as `"use client"` in React components.
- Create Supabase migrations with `npx supabase migration new <name>`; every new table gets RLS with per-operation policies.

## Tooling Gotchas

- Files use LF line endings (@.gitattributes, Prettier). Lint errors `Delete ␍` mean CRLF crept in: run `npm run lint:fix`.
- The husky pre-commit hook is not installed (no `prepare` script); run `npm run lint` yourself before committing.
- The deploy target is Cloudflare Workers (@wrangler.jsonc), not Pages: never use `wrangler pages` commands.
