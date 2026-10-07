// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 npm run smoke
// Signs in with the fixed test account SMOKE_EMAIL / SMOKE_PASSWORD (npm run smoke reads them from .dev.vars,
// environment variables win) and creates no accounts: the project has "Confirm email" on. The room steps open rooms on
// that account; they stay in the database (S-13 cleans up).

const missing = ["SMOKE_EMAIL", "SMOKE_PASSWORD"].filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing ${missing.join(", ")}: add the test account to .dev.vars (AGENTS.md, Testing)`);
  process.exit(1);
}

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const jar = new Map();

function cookieHeader(cookies = jar) {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response, cookies = jar) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) cookies.delete(name.trim());
    else cookies.set(name.trim(), rest.join("="));
  }
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
  storeCookies(response, cookies);
  const result = { status: response.status, location: response.headers.get("location") ?? "" };
  return readBody ? { ...result, body: await response.text() } : result;
}

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/" },
  ],
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
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
// Filled in as the steps run. Never printed: the link code opens the room.
const room = { id: "", link: "" };

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
      const form = [["nick", "Smoke host"], ...CATEGORY_IDS.map((id) => ["category", id]), ["confirm_close", "1"]];
      const actual = await request("/api/rooms", { method: "POST", form, cookies: hostJar });
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
];

// A string matches the start of the value, a RegExp the pattern.
function matches(pattern, value) {
  return pattern instanceof RegExp ? pattern.test(value) : value.startsWith(pattern);
}

let failed = 0;
for (const [name, run, expected] of [...steps, ...roomSteps]) {
  const actual = await run();
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined || matches(expected.location, actual.location)) &&
    (expected.body === undefined || expected.body.test(actual.body ?? ""));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
