// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 npm run smoke
// Signs in with the fixed test account SMOKE_EMAIL / SMOKE_PASSWORD (npm run smoke reads them from .dev.vars,
// environment variables win) and creates no accounts: the project has "Confirm email" on.
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

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

// Returns the names this response set (not the ones it cleared), so a step checks its own cookies and not what an
// earlier step left in the jar.
function storeCookies(response) {
  const set = [];
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else {
      jar.set(name.trim(), rest.join("="));
      set.push(name.trim());
    }
  }
  return set;
}

async function request(path, { method = "GET", form } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const cookies = storeCookies(response);
  return { status: response.status, location: response.headers.get("location") ?? "", cookies };
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
  if (!url.startsWith("http")) return { status: 0, location: "(no Supabase URL from the start step)", cookies: [] };
  const response = await fetch(url, { redirect: "manual" });
  return { status: response.status, location: response.headers.get("location") ?? "", cookies: [] };
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
  // OAuth steps run signed out, after the password steps, so they cannot disturb them.
  [
    "oauth start sends discord to Supabase",
    () => startOAuth("discord"),
    { status: 302, contains: ["/auth/v1/authorize?provider=discord"], cookie: "-code-verifier" },
  ],
  [
    "oauth start sends google to Supabase",
    () => startOAuth("google"),
    {
      status: 302,
      contains: ["/auth/v1/authorize?provider=google", "prompt=select_account"],
      cookie: "-code-verifier",
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

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  // location: Location starts with it; contains: Location has every part; cookie: a cookie this step set ends with it.
  const contains = expected.contains ?? [];
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined || actual.location.startsWith(expected.location)) &&
    contains.every((part) => actual.location.includes(part)) &&
    (expected.cookie === undefined || actual.cookies.some((cookie) => cookie.endsWith(expected.cookie)));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}`);
    if (contains.length > 0) console.log(`      expected Location to contain ${contains.join(" and ")}`);
    if (expected.cookie !== undefined) {
      console.log(`      expected a cookie ending in ${expected.cookie}, set: ${actual.cookies.join(", ") || "none"}`);
    }
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
