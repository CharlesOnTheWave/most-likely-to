// Shared by the agent hooks in this directory (wired in .claude/settings.json, proven by tests/hooks/).
// Claude Code shows a hook's output to the agent only on exit 2 with the text on stderr; exit 0 means "checked and
// clean" or "nothing to check", any other code reaches only the user as "hook error". Node, not bash: no jq here.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

// Output goes to a model, not a terminal.
const PLAIN_ENV = { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" };
const MAX_LINES = 200;

// Files ESLint covers in this repo (eslint.config.js: JS/TS by default, typescript-eslint, eslint-plugin-astro).
export const LINTED = /\.(?:[cm]?[jt]s|[jt]sx|astro)$/;

// The payload is untrusted input: empty stdin, broken JSON or a missing field means "nothing to check", never a crash.
export function readPayload() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {
    return {};
  }
  try {
    const value = JSON.parse(raw);
    return value !== null && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function sessionCwd(payload) {
  return typeof payload.cwd === "string" && payload.cwd !== "" ? payload.cwd : process.cwd();
}

export function sessionId(payload) {
  return typeof payload.session_id === "string" ? payload.session_id.replace(/[^\w-]/g, "") : "";
}

export function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

// The edited file and its checkout. Not $CLAUDE_PROJECT_DIR: after EnterWorktree, or for a sibling worktree, that
// variable names another checkout. A relative path resolves against the session cwd. Files of another repository
// (~/.claude, other projects) and deleted files give null: nothing to check.
export function editedFile(payload) {
  const input = payload.tool_input !== null && typeof payload.tool_input === "object" ? payload.tool_input : {};
  const raw = [input.file_path, input.notebook_path].find((value) => typeof value === "string" && value !== "");
  if (raw === undefined) return null;
  const file = path.resolve(sessionCwd(payload), raw);
  if (!existsSync(file)) return null;
  const root = git(path.dirname(file), ["rev-parse", "--show-toplevel"]);
  if (root === null) return null;
  const repo = git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const sessionRepo = git(sessionCwd(payload), ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (repo === null || repo !== sessionRepo) return null;
  return { file, root: path.resolve(root), rel: path.relative(root, file).split(path.sep).join("/") };
}

// Checkouts this session edited, so the end-of-turn hook sweeps a sibling worktree too.
function registryPath(payload) {
  const id = sessionId(payload);
  return id === "" ? null : path.join(os.tmpdir(), "claude-hooks", `${id}.roots`);
}

export function registerCheckout(payload, root) {
  const file = registryPath(payload);
  if (file === null) return;
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, `${root}\n`);
  } catch {
    // The end-of-turn hook still sweeps the session cwd.
  }
}

export function registeredCheckouts(payload) {
  const file = registryPath(payload);
  if (file === null || !existsSync(file)) return [];
  return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
}

export function clearRegistry(payload) {
  const file = registryPath(payload);
  if (file !== null && existsSync(file)) writeFileSync(file, "");
}

// A tool from the checkout's own node_modules, run with the current Node. A tool that is not installed is a failure
// the agent sees (code null), never a pass.
export function runTool(root, pkg, bin, args) {
  let entry = null;
  try {
    const manifestPath = createRequire(path.join(root, "package.json")).resolve(`${pkg}/package.json`);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const rel = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[bin];
    if (typeof rel === "string") entry = path.join(path.dirname(manifestPath), rel);
  } catch {
    entry = null;
  }
  if (entry === null) {
    return Promise.resolve({ code: null, output: `${pkg} is not installed in ${root}: run npm ci there.` });
  }
  return runNode(root, [entry, ...args]);
}

// The UI literal scan of `npm run lint` (AGENTS.md, "## UI"). Missing is a failure: the gate would vanish silently.
export function uiLiterals(root) {
  const script = path.join(root, "scripts", "ui-literals.mjs");
  if (!existsSync(script)) {
    return Promise.resolve({ code: null, output: `scripts/ui-literals.mjs is missing in ${root}.` });
  }
  return runNode(root, [script]);
}

export function runNode(root, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: root, env: PLAIN_ENV, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", (error) => resolve({ code: null, output: String(error) }));
    // astro check colours its diagnostics despite NO_COLOR; the escape codes are noise to a model.
    child.on("close", (code) => resolve({ code, output: output.replace(/\u001b\[[\d;]*m/g, "").trim() }));
  });
}

export function clip(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length <= MAX_LINES) return text;
  return [...lines.slice(0, MAX_LINES), `… ${lines.length - MAX_LINES} more lines`].join("\n");
}

// Exit 2 + stderr: the only combination Claude Code shows to the agent.
export function sendBack(message) {
  process.stderr.write(`${message.trimEnd()}\n`);
  process.exitCode = 2;
}
