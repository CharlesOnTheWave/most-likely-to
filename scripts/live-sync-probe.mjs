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
const SUBSCRIBE_TIMEOUT_MS = 15000;
const DELIVERY_TIMEOUT_MS = 5000;
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

function parseArgs(argv) {
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
  return {
    baseUrl: url.origin,
    rooms: int("rooms", 1),
    players: int("players", 1),
    trials: int("trials", 1),
    pauseMs: int("pause-ms", 0),
  };
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
  const response = await fetch(`${baseUrl}/api/live-sync/config`);
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
  fetch(`${baseUrl}/api/live-sync/state?room=${player.room}&seq=${expectation.seq}`)
    .then(async (response) => {
      const board = await response.json();
      if (response.ok && board.seq === expectation.seq && typeof board.question === "string" && board.question) {
        expectation.totalMs = performance.now() - expectation.t0;
      } else {
        expectation.boardError = true;
      }
    })
    .catch(() => {
      expectation.boardError = true;
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

async function runTrial(room, seq, results) {
  const roomPlayers = players.filter((p) => p.room === room);
  const t0 = performance.now();
  const finished = roomPlayers.map(
    (player) =>
      new Promise((resolve) => {
        player.expectation = { seq, t0, done: resolve };
      }),
  );

  const ring = await hostRequest("/api/live-sync/ring", { json: { room, seq } });
  results.ringMs.push(performance.now() - t0);
  if (ring.status !== 200 && ring.status !== 502) {
    throw new TechnicalError(`POST /api/live-sync/ring returned ${ring.status}`);
  }
  if (ring.status === 502) {
    results.ringFailures++;
  }

  await Promise.race([Promise.all(finished), sleep(Math.max(0, t0 + DELIVERY_TIMEOUT_MS - performance.now()))]);

  for (const player of roomPlayers) {
    const { bellMs, totalMs, boardError } = player.expectation;
    player.expectation = null;
    if (bellMs !== undefined) {
      results.bellMs.push(bellMs);
    }
    if (boardError) {
      results.boardErrors++;
    }
    if (totalMs !== undefined && totalMs <= DELIVERY_TIMEOUT_MS) {
      results.totalMs.push(totalMs);
      results.boardMs.push(totalMs - bellMs);
    } else {
      results.lost++;
    }
  }
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  return sorted.length ? { p50: pick(50), p95: pick(95), max: sorted[sorted.length - 1] } : null;
}

function formatStats(label, values) {
  const s = stats(values);
  const ms = (v) => `${Math.round(v)} ms`;
  return `${label.padEnd(30)} ${s ? `p50 ${ms(s.p50)} | p95 ${ms(s.p95)} | max ${ms(s.max)}` : "no data"}`;
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

  await signIn(email, "Probe-Test-Passw0rd!");
  console.log(`Signed in as ${email}`);
  const config = await fetchConfig();

  const rooms = Array.from({ length: options.rooms }, (_, r) => `probe-${stamp}-${r}`);
  await subscribeAll(config, rooms, options.players);
  console.log(`${players.length} players SUBSCRIBED`);

  const results = { bellMs: [], boardMs: [], totalMs: [], ringMs: [], lost: 0, ringFailures: 0, boardErrors: 0 };
  measuring = true;
  for (let seq = 1; seq <= options.trials; seq++) {
    await Promise.all(rooms.map((room) => runTrial(room, seq, results)));
    if (seq < options.trials) {
      await sleep(options.pauseMs);
    }
  }
  measuring = false;

  const expected = players.length * options.trials;
  console.log(
    `\nDeliveries: ${expected} expected, ${results.totalMs.length} delivered, ${results.lost} lost` +
      ` (ring failures: ${results.ringFailures}, board errors: ${results.boardErrors}); disconnections: ${disconnections}`,
  );
  console.log(formatStats("Bell (ring -> bell)", results.bellMs));
  console.log(formatStats("Board (bell -> board)", results.boardMs));
  console.log(formatStats("Total (ring -> bell + board)", results.totalMs));
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
