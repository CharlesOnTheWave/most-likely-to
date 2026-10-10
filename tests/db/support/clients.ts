import { createClient } from "@supabase/supabase-js";
import { testSupabaseEnv } from "./env";

// The attacker's door: supabase-js with the publishable key, straight to REST/RPC and past the Worker. Every client
// gets the URL and key through the guard again, so none can exist with an unchecked setup.

// The Worker's own generators (src/lib/rooms/tokens.ts): a seeded guest or room sends exactly what a real one sends.
// Player token: 32 random bytes, base64url, 43 characters.
export { newLinkToken, newPlayerToken } from "@/lib/rooms/tokens";

// A guest: no session. The session of a host made from it lives only in this client's memory, with no refresh timer
// left running after the test.
export function anonClient() {
  const { url, key } = testSupabaseEnv();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// No generated database types: rows and RPC results are typed unknown at the call site (src/lib/rooms/server.ts).
export type TestClient = ReturnType<typeof anonClient>;

export interface Host {
  client: TestClient;
  userId: string;
}

function randomHex(byteCount: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// A new signed-in host. The local stack keeps "Confirm email" off (supabase/config.toml), so sign-up returns the session
// at once. It counts against 30 sign-ups and sign-ins per 5 minutes: create hosts in beforeAll, a few per run.
export async function newHost(): Promise<Host> {
  const client = anonClient();
  const { data, error } = await client.auth.signUp({
    email: `host-${randomHex(8)}@example.com`,
    password: randomHex(16),
  });
  if (error) {
    throw new Error(`host sign-up failed: ${String(error.status)} ${error.code ?? error.name}`);
  }
  if (!data.session || !data.user) {
    throw new Error("host sign-up returned no session: is Confirm email on in this Supabase?");
  }
  return { client, userId: data.user.id };
}
