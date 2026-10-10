import { testSupabaseEnv } from "./env";

// Global setup of the db project: runs once in the main process, before any test file is loaded. A refused setup aborts
// the whole run (red, not skipped) with the guard's message, before the first client or request.
export default function setup(): void {
  testSupabaseEnv();
}
