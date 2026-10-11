// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 npm run smoke
// Signs in with the fixed test account SMOKE_EMAIL / SMOKE_PASSWORD (npm run smoke reads them from .dev.vars,
// environment variables win) and creates no accounts: the project has "Confirm email" on. The room steps open rooms on
// that account and join them as guests; rooms and guests stay in the database (S-13 cleans up).
// SMOKE_OAUTH=1 also follows Supabase one hop on to discord.com and accounts.google.com. That needs both providers
// enabled in the Supabase project, so CI (local Supabase, no providers) runs without it.

const missing = ["SMOKE_EMAIL", "SMOKE_PASSWORD"].filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing ${missing.join(", ")}: add the test account to .dev.vars (AGENTS.md, Testing)`);
  process.exit(1);
}

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const OAUTH = process.env.SMOKE_OAUTH === "1";
const jar = new Map();

function cookieHeader(cookies = jar) {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

// Returns the names this response set (not the ones it cleared), so a step checks its own cookies and not what an
// earlier step left in the jar, and which of them are HttpOnly.
function storeCookies(response, cookies = jar) {
  const set = [];
  const httpOnly = [];
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) cookies.delete(name.trim());
    else {
      cookies.set(name.trim(), rest.join("="));
      set.push(name.trim());
      if (attrs.some((a) => a.trim().toLowerCase() === "httponly")) httpOnly.push(name.trim());
    }
  }
  return { set, httpOnly };
}

// `cookies`: a jar of its own (one per player in the room steps). `form`: an object, or [name, value] pairs for repeated
// fields. `readBody`: also return the response text.
async function request(path, { method = "GET", form, cookies = jar, readBody = false } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(cookies),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const { set, httpOnly } = storeCookies(response, cookies);
  const result = { status: response.status, location: response.headers.get("location") ?? "", cookies: set, httpOnly };
  return readBody ? { ...result, body: await response.text() } : result;
}

// Supabase authorize URL from each OAuth start step, for the SMOKE_OAUTH steps that follow it.
const authorizeUrls = new Map();

async function startOAuth(provider) {
  const result = await request("/api/auth/oauth", { method: "POST", form: { provider } });
  authorizeUrls.set(provider, result.location);
  return result;
}

// One hop on from Supabase, without the app's cookies or Origin. Supabase answers 302 to the provider only when the
// provider is enabled with a client id; a disabled one gives 400. A wrong id, secret or redirect at the provider
// still passes here: only a real sign-in catches those.
async function followToProvider(provider) {
  const url = authorizeUrls.get(provider) ?? "";
  if (!url.startsWith("http")) {
    return { status: 0, location: "(no Supabase URL from the start step)", cookies: [], httpOnly: [] };
  }
  const response = await fetch(url, { redirect: "manual" });
  return { status: response.status, location: response.headers.get("location") ?? "", cookies: [], httpOnly: [] };
}

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  // Sign-up is gone; old links to it must land on the sign-in page, not on a 404.
  ["signup redirects to signin", () => request("/auth/signup"), { status: 302, exact: "/auth/signin" }],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    // Only the server reads the session cookie, so scripts must not see it (src/lib/supabase.ts).
    { status: 302, exact: "/", httpOnly: "-auth-token" },
  ],
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, exact: "/" }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  // OAuth steps run signed out, after the password steps, so they cannot disturb them. auth-js also writes per-flow
  // verifier cookies, but the callback (exchangeCodeForSession without a flow id) reads only the fixed
  // <storageKey>-code-verifier, so that is the one to check: if a library update stops writing it, sign-in breaks.
  [
    "oauth start sends discord to Supabase",
    () => startOAuth("discord"),
    {
      status: 302,
      contains: ["/auth/v1/authorize?provider=discord"],
      cookie: "-auth-token-code-verifier",
      httpOnly: "-auth-token",
    },
  ],
  [
    "oauth start sends google to Supabase",
    () => startOAuth("google"),
    {
      status: 302,
      contains: ["/auth/v1/authorize?provider=google", "prompt=select_account"],
      cookie: "-auth-token-code-verifier",
      httpOnly: "-auth-token",
    },
  ],
  [
    "oauth start rejects unknown provider",
    () => request("/api/auth/oauth", { method: "POST", form: { provider: "github" } }),
    { status: 302, location: "/auth/signin?error=unsupported_provider" },
  ],
  [
    "callback without code",
    () => request("/api/auth/callback"),
    { status: 302, location: "/auth/signin?error=bad_oauth_callback" },
  ],
  [
    "callback passes on cancelled consent",
    () => request("/api/auth/callback?error=access_denied"),
    { status: 302, location: "/auth/signin?error=access_denied" },
  ],
  [
    "callback turns free text into unknown",
    () => request(`/api/auth/callback?error=${encodeURIComponent("<b>not a code</b>")}`),
    { status: 302, exact: "/auth/signin?error=unknown" },
  ],
  ...(OAUTH
    ? [
        [
          "Supabase sends discord on to discord.com",
          () => followToProvider("discord"),
          { status: 302, location: "https://discord.com/" },
        ],
        [
          "Supabase sends google on to accounts.google.com",
          () => followToProvider("google"),
          { status: 302, location: "https://accounts.google.com/" },
        ],
      ]
    : []),
];

// S-01 rooms (context/changes/room-lobby/plan.md), on a jar of their own: the host signs in again and opens a room.
// confirm_close=1, so guests left in the open room by an interrupted earlier run cannot block "Nowa gra".
const hostJar = new Map();
// Same ids as CATEGORIES in src/data/questions.ts.
const CATEGORY_IDS = [
  "na-co-dzien",
  "imprezy",
  "przyszlosc",
  "wpadki-i-obciach",
  "gry-i-internet",
  "podroze-i-przygody",
  "sport-i-wyzwania",
  "praca-i-szkola",
];
const HOME = /^\/$/;
const ROOM_PATH = /^\/r\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const LINK_IN_PAGE = /\/j\/([A-Za-z0-9_-]{22})(?![A-Za-z0-9_-])/;
// A link code in a location (/j/<code>?error=…) is printed masked.
const LINK_IN_LOCATION = /\/j\/[A-Za-z0-9_-]{22}/g;
const mask = (location) => location.replace(LINK_IN_LOCATION, "/j/<code>");
const NICK_TAKEN = /^\/j\/[A-Za-z0-9_-]{22}\?error=nick_taken$/;
// Filled in as the steps run. Never printed: the link code opens the room.
const room = { id: "", link: "" };
// Ola's jar: she checks the lobby again after the host closes the room. Every other guest gets a fresh jar.
const olaJar = new Map();

function newRoom({ confirmClose }) {
  const form = [["nick", "Smoke host"], ...CATEGORY_IDS.map((id) => ["category", id])];
  if (confirmClose) form.push(["confirm_close", "1"]);
  return request("/api/rooms", { method: "POST", form, cookies: hostJar });
}

function join(nick, cookies) {
  return request("/api/rooms/join", { method: "POST", form: { link: room.link, nick }, cookies });
}

function lobby(roomId, cookies) {
  return request(`/api/rooms/${roomId}/lobby`, { cookies, readBody: true });
}

// Discord's preview, or a guest opening the link again. One fresh jar for all three, so a later open sends back
// whatever an earlier one set; the cookies of every response count. Status and Location of the first response that is
// not 200, if any.
async function openLinkThreeTimes() {
  const cookies = new Map();
  const results = [];
  for (let i = 0; i < 3; i++) results.push(await request(`/j/${room.link}`, { cookies }));
  const shown = results.find((result) => result.status !== 200) ?? results[0];
  return { ...shown, cookies: results.flatMap((r) => r.cookies), httpOnly: results.flatMap((r) => r.httpOnly) };
}

// Exactly one player object in the lobby's list, whatever the key order inside it. Nicks hold no braces here.
const ONLY_ONE_PLAYER = /"players":\[\{[^{}]*\}\]/;

// The room's own page; a function, because the id is known only once the room exists.
const thisRoom = () => ({ status: 302, location: new RegExp(`^/r/${room.id}$`) });

const roomSteps = [
  [
    "host signs in",
    () => request("/api/auth/signin", { method: "POST", form: { email, password }, cookies: hostJar }),
    { status: 302, location: HOME },
  ],
  [
    "signin page sends signed-in host home",
    () => request("/auth/signin", { cookies: hostJar }),
    { status: 302, location: HOME },
  ],
  [
    "signin page still shows an error to signed-in host",
    () => request("/auth/signin?error=access_denied", { cookies: hostJar }),
    { status: 200 },
  ],
  [
    "host creates a room",
    async () => {
      const actual = await newRoom({ confirmClose: true });
      room.id = ROOM_PATH.exec(actual.location)?.[1] ?? "";
      return actual;
    },
    { status: 302, location: ROOM_PATH },
  ],
  [
    "room page shows host the link",
    async () => {
      const actual = await request(`/r/${room.id}`, { cookies: hostJar, readBody: true });
      room.link = LINK_IN_PAGE.exec(actual.body)?.[1] ?? "";
      return actual;
    },
    { status: 200, body: LINK_IN_PAGE },
  ],
  ["home renders for signed-in host", () => request("/", { cookies: hostJar }), { status: 200 }],
  // Guests. Opening the link only reads (Discord fetches it for its preview): however often, it sets no player cookie
  // and adds nobody to the room. Joining sets the cookie, and with it the lobby knows Ola again after a refresh. The
  // nick stays taken, also by "Ola " (a trailing space) and "O\u200Bla" (a zero-width space), which look like it;
  // "ola" is another nick, because case counts.
  ["guest sees the join form", () => request(`/j/${room.link}`, { cookies: olaJar }), { status: 200 }],
  ["opening the link three times sets no player cookie", openLinkThreeTimes, { status: 200, noCookie: "mlt_player_" }],
  ["opening the link adds no player", () => lobby(room.id, hostJar), { status: 200, body: ONLY_ONE_PLAYER }],
  [
    "guest joins as Ola and gets the room's cookie",
    () => join("Ola", olaJar),
    () => ({ ...thisRoom(), cookie: `mlt_player_${room.id}` }),
  ],
  [
    "lobby lists the host and Ola",
    () => lobby(room.id, olaJar),
    { status: 200, body: /"nick":"Smoke host".*"nick":"Ola"/ },
  ],
  ["lobby with Ola's cookie still shows Ola as me", () => lobby(room.id, olaJar), { status: 200, body: /"me":"Ola"/ }],
  ["same plain nick Ola again is taken", () => join("Ola", new Map()), { status: 302, location: NICK_TAKEN }],
  ["nick with a trailing space is taken", () => join("Ola ", new Map()), { status: 302, location: NICK_TAKEN }],
  ["nick with a zero-width space is taken", () => join("O\u200Bla", new Map()), { status: 302, location: NICK_TAKEN }],
  ["same nick in another case joins", () => join("ola", new Map()), thisRoom],
  ["lobby without the cookie is not found", () => lobby(room.id, new Map()), { status: 404 }],
  [
    "new game asks before closing a room with guests",
    () => newRoom({ confirmClose: false }),
    { status: 302, location: "/?error=open_room_has_guests" },
  ],
  [
    "new game with confirmation opens a new room",
    () => newRoom({ confirmClose: true }),
    { status: 302, location: ROOM_PATH },
  ],
  ["old link says the game is closed", () => request(`/j/${room.link}`, { cookies: olaJar }), { status: 410 }],
  ["old lobby tells Ola the game is closed", () => lobby(room.id, olaJar), { status: 200, body: /"status":"closed"/ }],
  ["unknown link is not found", () => request("/j/AAAAAAAAAAAAAAAAAAAAAA", { cookies: new Map() }), { status: 404 }],
  [
    "host signs out",
    () => request("/api/auth/signout", { method: "POST", cookies: hostJar }),
    { status: 302, location: HOME },
  ],
];

// A string matches the start of the value, a RegExp the pattern.
function matches(pattern, value) {
  return pattern instanceof RegExp ? pattern.test(value) : value.startsWith(pattern);
}

// At least one cookie this step set has `part` in its name, and every such cookie is HttpOnly.
function httpOnlyOk(actual, part) {
  const named = actual.cookies.filter((cookie) => cookie.includes(part));
  return named.length > 0 && named.every((cookie) => actual.httpOnly.includes(cookie));
}

let failed = 0;
for (const [name, run, expectation] of [...steps, ...roomSteps]) {
  const actual = await run();
  // A function gives values known only after earlier steps (the room id).
  const expected = typeof expectation === "function" ? expectation() : expectation;
  // location: Location starts with it (a string) or matches it (a RegExp); exact: Location is exactly it (a bare "/"
  // as a prefix matches any path); contains: Location has every part; body: the response text matches it; cookie: a
  // cookie this step set ends with it; noCookie: no cookie this step set has it in its name; httpOnly: the step set
  // cookies whose names contain it, all of them HttpOnly.
  const contains = expected.contains ?? [];
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined || matches(expected.location, actual.location)) &&
    (expected.exact === undefined || actual.location === expected.exact) &&
    contains.every((part) => actual.location.includes(part)) &&
    (expected.body === undefined || expected.body.test(actual.body ?? "")) &&
    (expected.cookie === undefined || actual.cookies.some((cookie) => cookie.endsWith(expected.cookie))) &&
    (expected.noCookie === undefined || !actual.cookies.some((cookie) => cookie.includes(expected.noCookie))) &&
    (expected.httpOnly === undefined || httpOnlyOk(actual, expected.httpOnly));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${mask(actual.location)}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.exact ?? expected.location ?? ""}`);
    if (contains.length > 0) console.log(`      expected Location to contain ${contains.join(" and ")}`);
    if (expected.body !== undefined) console.log(`      expected the body to match ${expected.body}`);
    if (expected.cookie !== undefined) {
      console.log(`      expected a cookie ending in ${expected.cookie}, set: ${actual.cookies.join(", ") || "none"}`);
    }
    if (expected.noCookie !== undefined) {
      console.log(
        `      expected no cookie containing ${expected.noCookie}, set: ${actual.cookies.join(", ") || "none"}`,
      );
    }
    if (expected.httpOnly !== undefined) {
      console.log(
        `      expected HttpOnly cookies containing ${expected.httpOnly}, HttpOnly: ${actual.httpOnly.join(", ") || "none"}`,
      );
    }
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
