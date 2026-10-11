import type { User } from "@supabase/supabase-js";

// What readUser needs from supabase.auth. Of an AuthError only the name, status and code are read.
interface UserReader {
  getUser(): Promise<{ data: { user: User | null }; error: { name: string; status?: number; code?: string } | null }>;
}

// The signed-in host of this request, or null for anyone else. A guest has no session (AuthSessionMissingError): normal,
// not logged. Any other error (Auth down or unreachable, a rejected refresh token) also gives null, so the page works as
// for a guest, but it is logged: otherwise an Auth outage looks like a host who signed out. Only the name, status and
// code: the message may echo request data.
export async function readUser(auth: UserReader): Promise<User | null> {
  const { data, error } = await auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    // eslint-disable-next-line no-console
    console.error("auth getUser failed:", { name: error.name, status: error.status, code: error.code });
  }
  return data.user ?? null;
}
