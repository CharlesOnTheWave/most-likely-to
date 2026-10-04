// Live-sync probe (F-01): players on separate Realtime connections, timing "bell + board" for each of them.
// Signs up a probe-<timestamp>@example.com account in the Supabase project behind --base-url (production included)
// and rings through the app, so its commands are under an "ask" rule in .claude/settings.json (lessons.md).
// Usage: npm run live-probe -- [--base-url http://localhost:4321] [--rooms 1] [--players 20] [--trials 10] [--pause-ms 3000]
// Exit codes: 0 PASS (INFO with --rooms > 1), 1 FAIL of the F-01 criterion, 2 technical error (nothing measured).
// FAIL is an honest spike result: thresholds, timeouts and counting are fixed by the plan, not tuned to the outcome.

import { createClient } from "@supabase/supabase-js";

// Mirrors src/lib/live-sync/shared.ts.
const TOPIC_PREFIX = "live-sync:";
const BELL_EVENT = "bell";

const DEFAULTS = { "base-url": "http://localhost:4321", rooms: "1", players: "20", trials: "10", "pause-ms": "3000" };
// Free plan allows 100 channel joins per second (https://supabase.com/docs/guides/realtime/limits).
const SUBSCRIBES_PER_SECOND = 20;
// Free plan allows 200 concurrent Realtime connections, and the only project is production.
const MAX_PLAYERS = 200;
const SUBSCRIBE_TIMEOUT_MS = 15000;
const DELIVERY_TIMEOUT_MS = 5000;
// Caps every other request, so a server that hangs ends the run instead of stalling it.
const REQUEST_TIMEOUT_MS = 10000;
const BUDGET_P95_MS = 2000;
const BUDGET_MAX_MS = 5000;

class TechnicalError extends Error {}

const jar = new Map();
const players = [];
let baseUrl = DEFAULTS["base-url"];
let supabaseKey = "";
let signedIn = false;
let measuring = false;
let disconnections = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const redact = (text) => (supabaseKey ? String(text).replaceAll(supabaseKey, "<key>") : String(text));
const ms = (v) => (v === Infinity ? `> ${DELIVERY_TIMEOUT_MS} ms` : `${Math.round(v)} ms`);
const span = (values) =>
  values.length ? `${Math.round(Math.min(...values))}-${Math.round(Math.max(...values))} ms` : "none";

function parseArgs(argv) {
  // The address comes only from --base-url (ask rule), so a BASE_URL habit from smoke must not measure localhost.
  if (process.env.BASE_URL) {
    throw new TechnicalError("BASE_URL is ignored by this probe; pass --base-url instead");
  }
  const raw = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!match || !(match[1] in DEFAULTS)) {
      throw new TechnicalError(`Unknown argument: ${argv[i]}`);
    }
    raw[match[1]] = match[2] ?? argv[++i];
  }
  const int = (name, min) => {
    const value = Number(raw[name]);
    if (!Number.isSafeInteger(value) || value < min) {
      throw new TechnicalError(`--${name} must be an integer >= ${min}`);
    }
    return value;
  };
  const url = new URL(raw["base-url"]);
  const options = {
    baseUrl: url.origin,
    rooms: int("rooms", 1),
    players: int("players", 1),
    trials: int("trials", 1),
    pauseMs: int("pause-ms", 0),
  };
  if (options.rooms * options.players > MAX_PLAYERS) {
    throw new TechnicalError(`--rooms × --players must be <= ${MAX_PLAYERS} (free plan Realtime connections)`);
  }
  return options;
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

// Session cookies travel only with sign-in, the bell and sign-out; players fetch the board without them, like guests.
async function hostRequest(path, { form, json } = {}) {
  const response = await fetch(baseUrl + path, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    method: "POST",
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: baseUrl,
      "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json",
    },
    body: form ? new URLSearchParams(form).toString() : JSON.stringify(json),
  });
  storeCookies(response);
  return response;
}

async function signIn(email, password) {
  const signup = await hostRequest("/api/auth/signup", { form: { email, password } });
  const signupLocation = signup.headers.get("location") ?? "";
  if (signup.status !== 302 || !signupLocation.startsWith("/auth/confirm-email")) {
    throw new TechnicalError(`Sign-up failed: ${signup.status} ${signupLocation}`);
  }
  const signin = await hostRequest("/api/auth/signin", { form: { email, password } });
  const signinLocation = signin.headers.get("location") ?? "";
  if (signin.status !== 302 || signinLocation !== "/") {
    throw new TechnicalError(`Sign-in failed: ${signin.status} ${signinLocation}`);
  }
  signedIn = true;
}

async function fetchConfig() {
  const response = await fetch(`${baseUrl}/api/live-sync/config`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    throw new TechnicalError(`GET /api/live-sync/config returned ${response.status}`);
  }
  const config = await response.json();
  supabaseKey = config.supabaseKey;
  return config;
}

function onBell(player, payload) {
  const expectation = player.expectation;
  if (!expectation || payload?.seq !== expectation.seq || expectation.bellMs !== undefined) {
    return;
  }
  expectation.bellMs = performance.now() - expectation.t0;
  fetch(`${baseUrl}/api/live-sync/state?room=${player.room}&seq=${expectation.seq}`, {
    // AbortSignal.timeout takes whole milliseconds; rounding up keeps the full window, and late is still totalMs > 5000.
    signal: AbortSignal.timeout(Math.max(1, Math.ceil(expectation.t0 + DELIVERY_TIMEOUT_MS - performance.now()))),
  })
    .then(async (response) => {
      const board = await response.json();
      if (response.ok && board.seq === expectation.seq && typeof board.question === "string" && board.question) {
        expectation.totalMs = performance.now() - expectation.t0;
      } else {
        expectation.boardError = true;
      }
    })
    .catch((error) => {
      // A board cut off at the end of the window is late, not failed.
      if (error?.name !== "TimeoutError") {
        expectation.boardError = true;
      }
    })
    .finally(() => expectation.done());
}

function addPlayer(config, room) {
  // One client per player: channel() returns the existing channel for a topic, so a shared client is one connection.
  const client = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const player = { client, room, subscribed: false, expectation: null };
  client
    .channel(TOPIC_PREFIX + room)
    .on("broadcast", { event: BELL_EVENT }, ({ payload }) => {
      onBell(player, payload);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        player.subscribed = true;
      } else if (measuring) {
        disconnections++;
      }
    });
  players.push(player);
}

async function subscribeAll(config, rooms, perRoom) {
  for (const room of rooms) {
    for (let i = 0; i < perRoom; i++) {
      addPlayer(config, room);
      await sleep(1000 / SUBSCRIBES_PER_SECOND);
    }
  }
  const deadline = performance.now() + SUBSCRIBE_TIMEOUT_MS;
  while (players.some((p) => !p.subscribed)) {
    if (performance.now() > deadline) {
      const missing = players.filter((p) => !p.subscribed).length;
      throw new TechnicalError(
        `${missing} of ${players.length} players not SUBSCRIBED within ${SUBSCRIBE_TIMEOUT_MS} ms`,
      );
    }
    await sleep(100);
  }
}

async function runTrial(roomIndex, room, seq, results) {
  const roomPlayers = players.filter((p) => p.room === room);
  const t0 = performance.now();
  const finished = roomPlayers.map(
    (player) =>
      new Promise((resolve) => {
        player.expectation = { seq, t0, done: resolve };
      }),
  );

  const ring = await hostRequest("/api/live-sync/ring", { json: { room, seq } });
  const ringMs = performance.now() - t0;
  results.ringMs.push(ringMs);
  if (ring.status !== 200 && ring.status !== 502) {
    throw new TechnicalError(`POST /api/live-sync/ring returned ${ring.status}`);
  }
  if (ring.status === 502) {
    results.ringFailures++;
  }

  await Promise.race([Promise.all(finished), sleep(Math.max(0, t0 + DELIVERY_TIMEOUT_MS - performance.now()))]);

  const trial = { bellMs: [], totalMs: [] };
  for (const player of roomPlayers) {
    const { bellMs, totalMs, boardError } = player.expectation;
    player.expectation = null;
    if (bellMs !== undefined) {
      results.bellMs.push(bellMs);
      trial.bellMs.push(bellMs);
    }
    if (totalMs !== undefined && totalMs <= DELIVERY_TIMEOUT_MS) {
      results.totalMs.push(totalMs);
      results.boardMs.push(totalMs - bellMs);
      trial.totalMs.push(totalMs);
    } else {
      results.lost++;
      // Why a delivery was lost: no bell within the window, a failed board, or a board after the window.
      if (bellMs === undefined) {
        results.bellMissing++;
      } else if (boardError) {
        results.boardErrors++;
      } else {
        results.lateBoards++;
      }
    }
  }
  const n = roomPlayers.length;
  console.log(
    `Trial ${seq}, room ${roomIndex}: ring reply ${ms(ringMs)} | bells ${trial.bellMs.length}/${n} at ${span(trial.bellMs)}` +
      ` | boards in 5 s ${trial.totalMs.length}/${n} at ${span(trial.totalMs)}`,
  );
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  return sorted.length ? { p50: pick(50), p95: pick(95), max: sorted[sorted.length - 1] } : null;
}

function formatStats(label, values) {
  const s = stats(values);
  return `${label.padEnd(36)} ${s ? `p50 ${ms(s.p50)} | p95 ${ms(s.p95)} | max ${ms(s.max)}` : "no data"}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  baseUrl = options.baseUrl;
  const stamp = Date.now();
  const email = `probe-${stamp}@example.com`;
  console.log(
    `Live-sync probe: ${baseUrl}, ${options.rooms} room(s) × ${options.players} players × ${options.trials} trials` +
      ` (${new Date().toISOString()})`,
  );

  // Config first: a misconfigured server ends the run before an account is created.
  const config = await fetchConfig();
  await signIn(email, "Probe-Test-Passw0rd!");
  console.log(`Signed in as ${email}`);

  const rooms = Array.from({ length: options.rooms }, (_, r) => `probe-${stamp}-${r}`);
  await subscribeAll(config, rooms, options.players);
  console.log(`${players.length} players SUBSCRIBED`);

  const results = {
    bellMs: [],
    boardMs: [],
    totalMs: [],
    ringMs: [],
    lost: 0,
    bellMissing: 0,
    lateBoards: 0,
    boardErrors: 0,
    ringFailures: 0,
  };
  measuring = true;
  console.log("\nPer trial (times from t0, just before the ring POST):");
  for (let seq = 1; seq <= options.trials; seq++) {
    await Promise.all(rooms.map((room, r) => runTrial(r, room, seq, results)));
    if (seq < options.trials) {
      await sleep(options.pauseMs);
    }
  }
  measuring = false;

  const expected = players.length * options.trials;
  const withinBudget = results.totalMs.filter((v) => v <= BUDGET_P95_MS).length;
  console.log(
    `\nDeliveries: ${expected} expected, ${results.totalMs.length} delivered, ${results.lost} lost` +
      ` (no bell in 5 s: ${results.bellMissing}, board late: ${results.lateBoards}, board errors: ${results.boardErrors});` +
      ` ring failures: ${results.ringFailures}; disconnections: ${disconnections}`,
  );
  console.log(
    `Within ${BUDGET_P95_MS / 1000} s: ${withinBudget} of ${expected} expected` +
      ` (${Math.round((withinBudget / expected) * 100)}%)`,
  );
  console.log(formatStats("Bell (ring -> bell), received", results.bellMs));
  console.log(formatStats("Board (bell -> board), delivered", results.boardMs));
  console.log(formatStats("Total, delivered only", results.totalMs));
  // Lost deliveries count as slower than the window, so this line reads the F-01 criterion literally.
  console.log(formatStats("Total, all expected", [...results.totalMs, ...Array(results.lost).fill(Infinity)]));
  console.log(formatStats("Ring request (POST -> reply)", results.ringMs));

  const total = stats(results.totalMs);
  const criterion = `p95 <= ${BUDGET_P95_MS} ms, max <= ${BUDGET_MAX_MS} ms, 0 lost, 0 disconnections`;
  if (options.rooms > 1) {
    console.log(`\nVerdict: INFO (${options.rooms} rooms; the F-01 criterion is judged on 1 room: ${criterion})`);
    return 0;
  }
  const pass =
    total !== null &&
    total.p95 <= BUDGET_P95_MS &&
    total.max <= BUDGET_MAX_MS &&
    results.lost === 0 &&
    disconnections === 0;
  console.log(`\nVerdict: ${pass ? "PASS" : "FAIL"} (criterion: ${criterion})`);
  return pass ? 0 : 1;
}

async function cleanup() {
  measuring = false;
  await Promise.allSettled(players.map((p) => p.client.removeAllChannels()));
  for (const player of players) {
    player.client.realtime.disconnect();
  }
  if (signedIn) {
    await hostRequest("/api/auth/signout", { form: {} }).catch(() => undefined);
  }
}

let exitCode;
try {
  exitCode = await main();
} catch (error) {
  console.error(`\nTECHNICAL ERROR: ${redact(error instanceof Error ? error.message : error)}`);
  exitCode = 2;
} finally {
  await cleanup();
}
process.exit(exitCode);
