// The only way the db suite learns where the database is. It reads TEST_SUPABASE_* (never the app's SUPABASE_*, which
// .dev.vars points at production) and throws before any client exists, so a refused setup sends no request.
//
// Loosening this guard (any URL that is not the local stack) needs, in the same change, an `ask` rule for
// `Bash(npm run test:db*)` in .claude/settings.json: the suite signs up accounts and writes rooms (lessons.md, entry 1).

const LOCAL_HOSTS = ["127.0.0.1", "localhost"];

export interface TestSupabaseEnv {
  url: string;
  key: string;
}

export function testSupabaseEnv(): TestSupabaseEnv {
  const url = process.env.TEST_SUPABASE_URL;
  const key = process.env.TEST_SUPABASE_KEY;

  if (!url || !key) {
    throw new Error(
      "Brak TEST_SUPABASE_URL albo TEST_SUPABASE_KEY. Testy bazy biegną tylko na lokalnym Supabase (job db w CI): " +
        "ustaw API_URL i PUBLISHABLE_KEY z `supabase status -o env`.",
    );
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error("TEST_SUPABASE_URL nie jest poprawnym adresem. Podaj API_URL z `supabase status -o env`.");
  }
  if (!LOCAL_HOSTS.includes(hostname)) {
    throw new Error(
      `TEST_SUPABASE_URL wskazuje na ${hostname}, a testy bazy biegną tylko na lokalnym Supabase ` +
        "(127.0.0.1 albo localhost). Zakładają konta i pokoje, więc nigdy nie ruszają produkcji.",
    );
  }

  // Same rule as getPublicSupabaseConfig (src/lib/supabase.ts). A secret or service_role key skips the grants and RLS,
  // so every refusal test would pass for the wrong reason. The key itself never goes into the message.
  if (!key.startsWith("sb_publishable_")) {
    throw new Error(
      "TEST_SUPABASE_KEY musi być kluczem publishable (sb_publishable_…). Klucz secret albo service_role omija " +
        "uprawnienia, więc testy odmów dałyby fałszywą zieleń.",
    );
  }

  return { url, key };
}
