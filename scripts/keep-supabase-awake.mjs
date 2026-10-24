// Keep-awake ping: the free Supabase plan pauses a project after 7 days without enough database activity, and the game
// is played every week or two (roadmap Open Question 9, option 2, decided 2026-10-21; plan in
// context/archive/2026-10-21-keep-supabase-awake). One harmless call to the project behind SUPABASE_URL: room_link with
// a made-up code, a single read of public.rooms that writes and logs nothing. npm run keep-awake reads SUPABASE_URL /
// SUPABASE_KEY from .dev.vars (environment variables win); .github/workflows/keep-supabase-awake.yml passes them from
// the repository's secrets every 6 hours. It reaches production, so its commands are under an "ask" rule in
// .claude/settings.json (lessons.md). Prints one line, never the response body, the key or the address: the workflow's
// log is public.
// Exit codes: 0 ok, 1 the database answered otherwise or did not answer, 2 refused before sending anything.

// 22 characters from [A-Za-z0-9_-], like a real link code: a malformed code returns before the table read, which may
// not count as activity. Real codes are random, so this one matches no room; if it ever did, the run is red.
const PING_CODE = "keep-awake-ping-000000";
const REQUEST_TIMEOUT_MS = 15000;

function refuse(reason) {
  console.error(`Refused, nothing sent: ${reason}`);
  process.exit(2);
}

function fail(reason) {
  console.error(`FAIL: ${reason}`);
  return 1;
}

// Only the error's name (TimeoutError, TypeError): its message and cause can carry the address.
const errorName = (error) => (typeof error?.name === "string" ? error.name : "unknown error");

// Only a short plain word from the status field reaches the log, never the rest of the body (room_id included).
function describeStatus(status) {
  if (status === undefined) return "no status field";
  return typeof status === "string" && /^[\w-]{1,32}$/.test(status) ? `status ${status}` : "status not a plain word";
}

// Names only, never values; an empty variable counts as missing.
const missing = ["SUPABASE_URL", "SUPABASE_KEY"].filter((name) => !process.env[name]);
if (missing.length > 0) {
  refuse(`missing ${missing.join(", ")} (npm run keep-awake reads .dev.vars, the workflow the repository's secrets)`);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;
// A secret or service_role key bypasses RLS; it never goes into the repo, a workflow or a log (AGENTS.md).
if (!key.startsWith("sb_publishable_")) {
  refuse("SUPABASE_KEY must be the publishable key (sb_publishable_…)");
}
if (!url.startsWith("https://")) {
  refuse("SUPABASE_URL must start with https://");
}

async function ping() {
  let response;
  try {
    response = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/room_link`, {
      method: "POST",
      // A publishable key belongs only in apikey, never in Authorization as a Bearer token (@supabase/supabase-js).
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_link_token: PING_CODE }),
      // A redirect is a red answer, not a hop that carries the key to another host.
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    return fail(`no answer (${errorName(error)})`);
  }

  const http = `HTTP ${response.status}`;
  let body;
  try {
    body = await response.json();
  } catch (error) {
    // Invalid JSON is a SyntaxError; anything else broke the connection while the body arrived.
    return fail(`${http}, ${error instanceof SyntaxError ? "not JSON" : `body not read (${errorName(error)})`}`);
  }
  if (response.status === 200 && body?.status === "unknown") {
    console.log(`ok: ${http}, status unknown`);
    return 0;
  }
  return fail(`${http}, ${describeStatus(body?.status)}`);
}

// An exit code instead of process.exit(): on Windows (Node 24), exiting while fetch's connection is still closing
// aborts Node with a libuv assertion (src\win\async.c) and exit code 127, even after "ok".
process.exitCode = await ping();
