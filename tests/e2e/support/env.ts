// The E2E suite runs only against a local Supabase: in practice the CI job `e2e` (no Docker on the owner's machine).
// It builds and serves the real app, and the build copies the root .dev.vars into dist/server/.dev.vars, which the
// Cloudflare preview reads. Locally .dev.vars points at production, so this guard reads the same file the build will use
// (wrangler prefers .dev.vars.<CLOUDFLARE_ENV> when that is set) and throws before the build starts: a refused run
// signs nobody in and creates no room. Values never go into a message.
//
// Loosening this guard (any URL that is not the local stack) needs, in the same change, an `ask` rule for
// `Bash(npx playwright test*)` in .claude/settings.json: the suite signs in and writes rooms (lessons.md, entry 1).

import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const LOCAL_HOSTS = ["127.0.0.1", "localhost"];

export function assertLocalBackend(): void {
  const cloudflareEnv = process.env.CLOUDFLARE_ENV;
  const candidates = cloudflareEnv ? [`.dev.vars.${cloudflareEnv}`, ".dev.vars"] : [".dev.vars"];
  const file = candidates.find((path) => existsSync(path));
  if (!file) {
    throw new Error(
      "Brak .dev.vars. Testy E2E biegną tylko na lokalnym Supabase (job e2e w CI), który zapisuje ten plik przed buildem.",
    );
  }

  const vars = parseEnv(readFileSync(file, "utf8"));
  let hostname = "";
  try {
    hostname = new URL(vars.SUPABASE_URL ?? "").hostname;
  } catch {
    // An empty or broken address is refused below like any other non-local one.
  }
  if (!LOCAL_HOSTS.includes(hostname)) {
    throw new Error(
      `${file} nie wskazuje na lokalny Supabase (127.0.0.1 albo localhost). Testy E2E zakładają pokoje i graczy, więc ` +
        "nigdy nie ruszają produkcji: lokalnie się nie uruchamiają, biegną w jobie e2e w CI.",
    );
  }

  // Same rule as getPublicSupabaseConfig (src/lib/supabase.ts): without a publishable key the room screen gets no
  // Realtime config, and the bell this suite checks could never ring.
  if (!(vars.SUPABASE_KEY ?? "").startsWith("sb_publishable_")) {
    throw new Error(`SUPABASE_KEY w ${file} musi być kluczem publishable (sb_publishable_…).`);
  }
}
