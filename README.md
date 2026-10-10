# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v7 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v6 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

`SMOKE_EMAIL` and `SMOKE_PASSWORD` are the smoke test account — see [Smoke test](#smoke-test).

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier
- `npm test` - Run the unit tests (Vitest, `tests/unit/`)
- `npm run test:db` - Run the database tests (`tests/db/`) as a guest and as a host; only against a local Supabase (`TEST_SUPABASE_URL` on `127.0.0.1`/`localhost`, `TEST_SUPABASE_KEY` publishable), so it needs Docker and runs in CI
- `npm run smoke` - Smoke test the auth and room flows against a running server (`BASE_URL`, defaults to `http://localhost:4321`)
- `npm run live-probe` - Measure live-sync delivery with simulated players (`--base-url`, defaults to `http://localhost:4321`); signs in with the smoke test account from `.dev.vars` and rings through the app, so it asks first

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── scripts/ # Smoke test, live-sync probe, UI literal scan
├── supabase/migrations/ # Database tables and functions
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and read only on the server (`astro:env/server`). `SUPABASE_KEY` must be the **publishable** key (`sb_publishable_…`): the server may pass it and `SUPABASE_URL` to the browser at runtime, only for Realtime subscriptions. Never use a secret or `service_role` key here.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<publishable key from CLI output>
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

`npx supabase start` also applies the migrations in `supabase/migrations/` (rooms and players), see [Database migrations](#database-migrations).

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                                        |
| -------------- | ---------------------------------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API                               |
| `SUPABASE_KEY` | Publishable key (`sb_publishable_…`) from Supabase dashboard → Settings → API Keys |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<publishable-key>
```

### Email confirmation

The hosted project has **Confirm email** turned **on**, and it stays on. With it off, Supabase links a Discord or Google sign-in to an existing account by an unverified email, so anyone who registered someone else's address could take over that host's account. Never turn it off to make sign-up, the smoke test or the probe pass.

The local stack (`supabase/config.toml`) keeps confirmations off only so CI can create the smoke test account with a plain sign-up.

### Auth routes

| Route          | Description                                                                        |
| -------------- | ---------------------------------------------------------------------------------- |
| `/auth/signin` | Sign-in with Discord, Google or email and password                                 |
| `/auth/signup` | Redirects to `/auth/signin`; new hosts create an account through Discord or Google |
| `/dashboard`   | Example protected page (redirects to `/auth/signin` if unauthenticated)            |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication. A signed-in host who opens `/auth/*` is sent to `/`, unless the URL carries `error` or `error_code`, so sign-in errors still reach the screen.

### Game routes

| Route                       | Description                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                         | Signed out: the game's name and a sign-in button. Signed in: "Nowa gra" (nick, categories, 18+ per category) and "Wróć do pokoju" when the host has an open room |
| `/j/<code>`                 | Guest link: a nick form. 404 for an unknown link, 410 for a closed game. A GET changes nothing, because Discord fetches the link for its preview                 |
| `/r/<id>`                   | Room: the host sees the guest link, "Kopiuj" and the players; a guest sees their own nick and the players. 404 for anyone not in the room                        |
| `/dev/room-states`          | Every state of the room screens with sample data. Local only (`npm run dev`); a production build answers 404                                                     |
| `POST /api/rooms`           | Creates a room (signed-in host only) and closes the host's previous one; asks first (`confirm_close=1`) when that room has guests                                |
| `POST /api/rooms/join`      | Adds a guest to a room in the lobby and sets the `mlt_player_<roomId>` cookie                                                                                    |
| `GET /api/rooms/<id>/lobby` | Lobby state (`status`, `role`, `me`, `players`) for the room's host or one of its guests; 404 for anyone else                                                    |

A host can have one open room at a time. Guests have no account: the cookie (httpOnly, 24 h) holds a random token, and the database keeps only its SHA-256 in `player_secrets`, which no API role can read. Guests reach the database only through three `security definer` functions: `join_room`, `room_link` and `room_lobby`. Nicks are case-sensitive ("Ola" and "ola" are two players), but invisible differences (extra spaces, zero-width characters) do not count. Lists update live: when a guest joins or the host closes the room, the server rings `live-sync:<roomId>` and every screen in that room fetches the lobby again; screens also poll every 15 s while the tab is visible and on return to the tab.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/). Production: https://most-likely-to.charlesonthewave.workers.dev. Every push to `main` is built and deployed there by Cloudflare Workers Builds.

To deploy manually:

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`.

## Smoke test

`scripts/smoke.mjs` is a dependency-free Node script that walks two flows over HTTP:

- **auth**: wrong and correct password, protected page, sign-out, the Discord and Google sign-in start and the callback errors (`SMOKE_OAUTH=1` also follows Supabase on to discord.com and accounts.google.com; that needs both providers enabled, so CI runs without it);
- **rooms**: the signed-in host is sent away from `/auth/signin`, creates a room and sees the guest link; guests join through the link, a nick that differs only by a trailing space or a zero-width character is taken while another letter case joins, the lobby is closed to anyone without the room's cookie, a new game asks before closing a room with guests, and old and unknown links answer 410 and 404.

Run it against the dev server or the production preview after dependency upgrades:

```bash
npm run dev            # or: npm run build && npm run preview
BASE_URL=http://localhost:4321 npm run smoke
```

It signs in with a fixed test account and creates no accounts. The rooms and guests it creates stay in the database. `npm run smoke` reads `SMOKE_EMAIL` and `SMOKE_PASSWORD` from `.dev.vars` (environment variables win). The account must exist in the Supabase project behind the server: create it once in **Authentication → Users → Add user** with **Auto Confirm User** on.

> **Note:** this script exists primarily to guard the development of the starter itself — it is a fast sanity check that dependency upgrades did not break the build, the Cloudflare adapter or the Supabase auth flow. It is **not** a substitute for a real test suite. Once you build your own product on top of this starter, add proper tests (unit, integration, end-to-end) suited to your application.

## Live-sync test page and probe

The live-sync spike (F-01) proved the technique the room screens use: the server rings a public Realtime channel (`live-sync:<room>`) and every screen then fetches the state from the server.

- `/dev/live-sync` is the F-01 test page: open it in two windows, sign in in one of them and press "Zadzwoń" (`?room=<name>` picks the channel). Local only (`npm run dev`); a production build answers 404.
- `npm run live-probe` measures bell delivery with simulated players. It needs only `/api/live-sync/config`, `/api/live-sync/state` and `/api/live-sync/ring`, which stay in production, so it still runs there (`--base-url`). It signs in with the smoke test account and asks first.

## CI

GitHub Actions runs three jobs on every push and PR to `main`:

- **ci** — lint, `astro check`, unit tests (`npm test`) and build. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets for the build step.
- **smoke** — starts a local Supabase via the Supabase CLI, which applies every migration in `supabase/migrations/` to a fresh database, and takes its `API_URL` and `PUBLISHABLE_KEY` (`sb_publishable_…`, as in production). It then creates the smoke test account there with a plain sign-up, builds, serves the production preview on the Cloudflare runtime and runs `npm run smoke` against it. Realtime is not started, so the room screens fall back to polling. No secrets required.
- **db** — starts its own local Supabase the same way, passes its `API_URL` and `PUBLISHABLE_KEY` to the tests as `TEST_SUPABASE_URL` and `TEST_SUPABASE_KEY` and runs `npm run test:db`: the database grants, policies and functions through REST/RPC as a guest and as a signed-in host. Known holes show in the log as expected failures ("znana dziura … → S-02"). Runs in parallel with smoke. No secrets required.

## Database migrations

Tables and functions live in `supabase/migrations/`. There is one hosted Supabase project for development and production, so applying a migration changes the production database.

- **New migration:** `npx supabase migration new <name>`. Every table gets RLS, explicit grants and a policy per granted operation; every function gets `set search_path = ''` and explicit `execute` grants (rules in `AGENTS.md`, Conventions).
- **Tried first in CI:** a PR to `main` runs the smoke and db jobs, each of which applies all migrations to a fresh local database with `auto_expose_new_tables = false` (`supabase/config.toml`), as Supabase does for new tables from 30.10.2026; db then tests the grants, policies and functions as a guest and as a host.
- **Applied to the hosted project only with `npx supabase db push`**, after `npx supabase db push --dry-run`, and only with the project owner's consent; `npx supabase migration list` then shows it locally and remotely. The CLI must be linked once (`npx supabase login`, `npx supabase link`).
- **Never paste SQL in the dashboard** (it bypasses the migration history and breaks the next `db push`) and never edit an applied migration: a fix or a rollback is a new migration.

Details and the list of applied migrations: `context/deployment/deploy-plan.md` (section "Migracje Supabase").

## License

MIT
