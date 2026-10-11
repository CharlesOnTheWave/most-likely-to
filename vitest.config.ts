import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Separate from astro.config.mjs (no getViteConfig): the tests need no astro:* modules, and the Cloudflare adapter under
// Vitest is unconfirmed (context/changes/testing-lobby-foundation/research.md §6). Two projects, one per script:
// `npm test` runs unit, `npm run test:db` runs db. Neither script passes --env-file: .dev.vars points at production,
// and the db suite reads only TEST_SUPABASE_* from the process environment.
export default defineConfig({
  resolve: {
    // As tsconfig.json paths.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          // The guard: refuses a missing, non-local or non-publishable setup before any test file loads.
          globalSetup: ["tests/db/support/setup.ts"],
          // Real round trips to the local stack; preconditions (sign-up, rooms) run in hooks.
          testTimeout: 15_000,
          hookTimeout: 30_000,
          // Files one after another: the sign-up limit (30 per 5 minutes) and one open room per host.
          fileParallelism: false,
        },
      },
    ],
  },
});
