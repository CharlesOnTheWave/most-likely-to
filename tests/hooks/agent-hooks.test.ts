import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Proof for the agent hooks in .claude/hooks/, wired in .claude/settings.json. Each case pipes a Claude Code payload
// into the real script and checks the exit code and the channel: the agent sees a hook's text only on exit 2 with
// stderr; exit 0 means "clean" or "nothing to check" (.claude/skills/10x-configure-hook/references/anthropic.md).
// The scripts and git are real. The slow tools (ESLint, Vitest, astro check) and the UI literal scan are stubs in a
// throwaway repo outside this checkout: each fails on a marker in a file and logs its call to calls.log.

const HOOKS = fileURLToPath(new URL("../../.claude/hooks/", import.meta.url));
const SETTINGS = fileURLToPath(new URL("../../.claude/settings.json", import.meta.url));
const SESSION = "hooks-test-session";

// base/node_modules (stubs), base/main (the session's repo), base/wt (its worktree), base/other (another repo).
const base = mkdtempSync(path.join(os.tmpdir(), "agent-hooks-"));
const main = path.join(base, "main");
const wt = path.join(base, "wt");
const other = path.join(base, "other");
const registry = path.join(base, "tmp");
const callsLog = path.join(base, "calls.log");

// Runs in the checkout the hook chose; logs "<tool> <checkout> <args>".
const STUB_HEAD = `
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(callsLog)}, [TOOL, path.basename(process.cwd()), ...args].join(" ") + "\\n");
const has = (file, marker) => existsSync(file) && statSync(file).isFile() && readFileSync(file, "utf8").includes(marker);
const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    : [];
const fail = (lines) => {
  if (lines.length > 0) console.log(lines.join("\\n"));
  process.exit(lines.length > 0 ? 1 : 0);
};
`;

const STUBS = {
  eslint: `fail(args.filter((a) => !a.startsWith("-") && has(a, "LINT_ERROR")).map((f) => f + "\\n  1:1  error  stub lint error  stub/rule"));`,
  vitest: `const files = args[0] === "related" ? [args[1]] : walk(args.includes("hooks") ? ".claude/hooks" : "src");
fail(files.filter((f) => has(f, "TEST_FAIL")).map((f) => "FAIL " + f + " > stub test\\nAssertionError: expected 1 to be 2"));`,
  astro: `fail(walk("src").filter((f) => has(f, "TYPE_ERROR")).map((f) => "\u001b[96m" + f + "\u001b[0m:1:1 - error ts(2322): stub type error"));`,
};

const UI_LITERALS_STUB = `${STUB_HEAD.replace("[TOOL,", '["ui-literals",')}
const hits = walk("src").filter((f) => has(f, "UI_LITERAL"));
for (const f of hits) console.error(f + ":1: UI_LITERAL");
process.exit(hits.length > 0 ? 1 : 0);
`;

function git(cwd: string, ...args: string[]): string {
  const config = [
    "-c",
    "user.name=hooks-test",
    "-c",
    "user.email=hooks-test@example.com",
    "-c",
    "commit.gpgsign=false",
  ];
  const result = spawnSync("git", [...config, ...args], { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} in ${cwd}: ${result.stderr}`);
  return result.stdout;
}

function write(file: string, content: string): string {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

function initRepo(dir: string): void {
  mkdirSync(dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  write(path.join(dir, "package.json"), JSON.stringify({ name: path.basename(dir), private: true, type: "module" }));
  write(path.join(dir, "scripts", "ui-literals.mjs"), UI_LITERALS_STUB);
  write(path.join(dir, "src", "lib", "ok.ts"), "export const ok = 1;\n");
  write(path.join(dir, "src", "components", "View.tsx"), "export const View = () => null;\n");
  write(path.join(dir, "README.md"), "# fixture\n");
}

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function hook(script: string, payload: unknown, env: Record<string, string> = {}): Run {
  const input = typeof payload === "string" ? payload : JSON.stringify(payload);
  const result = spawnSync(process.execPath, [path.join(HOOKS, script)], {
    input,
    encoding: "utf8",
    env: { ...process.env, TMPDIR: registry, TEMP: registry, TMP: registry, CLAUDE_PROJECT_DIR: main, ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const edit = (file: string, cwd = main) => ({
  hook_event_name: "PostToolUse",
  tool_name: "Edit",
  session_id: SESSION,
  cwd,
  tool_input: { file_path: file },
});
const stop = (extra: Record<string, unknown> = {}) => ({
  hook_event_name: "Stop",
  session_id: SESSION,
  cwd: main,
  stop_hook_active: false,
  ...extra,
});

const calls = (): string[] => (existsSync(callsLog) ? readFileSync(callsLog, "utf8").split("\n").filter(Boolean) : []);

// A stub tool moved away for one call: the hook must fail, not pass.
function without<T>(pkg: string, body: () => T): T {
  const dir = path.join(base, "node_modules", pkg);
  renameSync(dir, `${dir}.off`);
  try {
    return body();
  } finally {
    renameSync(`${dir}.off`, dir);
  }
}

beforeAll(() => {
  for (const [tool, body] of Object.entries(STUBS)) {
    const dir = path.join(base, "node_modules", tool);
    write(path.join(dir, "package.json"), JSON.stringify({ name: tool, type: "module", bin: { [tool]: "bin.mjs" } }));
    write(path.join(dir, "bin.mjs"), `const TOOL = ${JSON.stringify(tool)};\n${STUB_HEAD}\n${body}\n`);
  }
  initRepo(main);
  // The hook scripts themselves, so that a worktree can run the commands of .claude/settings.json.
  cpSync(HOOKS, path.join(main, ".claude", "hooks"), { recursive: true });
  git(main, "add", "-A");
  git(main, "commit", "-q", "-m", "fixture");
  git(main, "worktree", "add", "-q", "-b", "wt", wt);
  initRepo(other);
  git(other, "add", "-A");
  git(other, "commit", "-q", "-m", "other");
});

beforeEach(() => {
  for (const dir of [main, wt, other]) {
    git(dir, "reset", "-q", "--hard");
    git(dir, "clean", "-fdq");
  }
  rmSync(callsLog, { force: true });
  rmSync(registry, { recursive: true, force: true });
  mkdirSync(registry);
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("per edit: lint-edited-file.mjs", () => {
  it("sends a lint error in the edited file back to the agent", () => {
    const file = write(path.join(main, "src", "lib", "bad.ts"), "export const x = 1; // LINT_ERROR\n");

    const run = hook("lint-edited-file.mjs", edit(file));

    expect(run.status).toBe(2);
    expect(run.stderr).toContain("src/lib/bad.ts");
    expect(run.stderr).toContain("stub lint error");
    expect(run.stdout).toBe("");
  });

  it("passes a clean file without a word", () => {
    const run = hook("lint-edited-file.mjs", edit(path.join(main, "src", "lib", "ok.ts")));

    expect(run).toMatchObject({ status: 0, stderr: "" });
    expect(calls()).toEqual(["eslint main --quiet --no-warn-ignored src/lib/ok.ts"]);
  });

  it("sends a UI literal in an edited view back to the agent", () => {
    const file = write(path.join(main, "src", "components", "View.tsx"), "export const c = 'UI_LITERAL';\n");

    const run = hook("lint-edited-file.mjs", edit(file));

    expect(run.status).toBe(2);
    expect(run.stderr).toContain("UI literals");
  });

  it("resolves a relative path against the session cwd", () => {
    write(path.join(main, "src", "lib", "bad.ts"), "// LINT_ERROR\n");

    expect(hook("lint-edited-file.mjs", edit("src/lib/bad.ts")).status).toBe(2);
  });

  it("skips a broken file of another repository", () => {
    const file = write(path.join(other, "src", "lib", "bad.ts"), "// LINT_ERROR\n");

    expect(hook("lint-edited-file.mjs", edit(file))).toMatchObject({ status: 0, stderr: "" });
    expect(calls()).toEqual([]);
  });

  it("fails visibly when ESLint is not installed", () => {
    const run = without("eslint", () => hook("lint-edited-file.mjs", edit(path.join(main, "src", "lib", "ok.ts"))));

    expect(run.status).toBe(2);
    expect(run.stderr).toContain("eslint is not installed");
  });
});

describe("per edit: related-tests.mjs", () => {
  it("sends a failing related test back to the agent", () => {
    const file = write(path.join(main, "src", "lib", "bad.ts"), "export const x = 1; // TEST_FAIL\n");

    const run = hook("related-tests.mjs", edit(file));

    expect(run.status).toBe(2);
    expect(run.stderr).toContain("src/lib/bad.ts");
    expect(run.stderr).toContain("AssertionError");
  });

  it("passes when the related tests pass, and never runs the db project", () => {
    const run = hook("related-tests.mjs", edit(path.join(main, "src", "lib", "ok.ts")));

    expect(run).toMatchObject({ status: 0, stderr: "" });
    expect(calls()).toEqual(["vitest main related src/lib/ok.ts --run --project unit --passWithNoTests"]);
  });
});

describe("per edit: nothing to check", () => {
  const cases: [string, () => unknown][] = [
    ["an empty object", () => ({})],
    ["broken JSON", () => "not json"],
    ["empty stdin", () => ""],
    ["a tool call without a path", () => ({ tool_name: "Bash", cwd: main, tool_input: { command: "ls" } })],
    ["a file that does not exist", () => edit(path.join(main, "src", "lib", "gone.ts"))],
    ["a file the checks do not cover", () => edit(write(path.join(main, "README.md"), "LINT_ERROR TEST_FAIL\n"))],
  ];
  const scripts = ["lint-edited-file.mjs", "related-tests.mjs"];

  it.each(scripts.flatMap((script) => cases.map(([name, payload]) => [script, name, payload] as const)))(
    "%s passes %s and runs no tool",
    (script, _name, payload) => {
      expect(hook(script, payload())).toMatchObject({ status: 0, stderr: "" });
      expect(calls()).toEqual([]);
    },
  );
});

describe("end of turn: end-of-turn.mjs", () => {
  it("runs nothing when the turn changed nothing", () => {
    expect(hook("end-of-turn.mjs", stop())).toMatchObject({ status: 0, stderr: "" });
    expect(calls()).toEqual([]);
  });

  it("runs nothing when the turn changed only docs", () => {
    write(path.join(main, "README.md"), "# changed\n");

    expect(hook("end-of-turn.mjs", stop())).toMatchObject({ status: 0, stderr: "" });
    expect(calls()).toEqual([]);
  });

  it("runs lint, UI literals, the unit suite and the typecheck when code changed and they pass", () => {
    write(path.join(main, "src", "lib", "ok.ts"), "export const ok = 2;\n");

    expect(hook("end-of-turn.mjs", stop())).toMatchObject({ status: 0, stderr: "" });
    expect(calls().sort()).toEqual([
      "astro main check",
      "eslint main --quiet --no-warn-ignored src/lib/ok.ts",
      "ui-literals main",
      "vitest main run --project unit",
    ]);
  });

  it.each([
    ["a lint error written past the per-edit hook (shell)", "LINT_ERROR", "ESLint"],
    ["a type error", "TYPE_ERROR", "astro check"],
    ["a failing unit test", "TEST_FAIL", "Unit tests"],
    ["a UI literal", "UI_LITERAL", "UI literals"],
  ])("sends %s back to the agent", (_name, marker, check) => {
    write(path.join(main, "src", "lib", "bad.ts"), `// ${marker}\n`);

    const run = hook("end-of-turn.mjs", stop());

    expect(run.status).toBe(2);
    expect(run.stderr).toContain(check);
    // Plain text for the model: astro check colours its output despite NO_COLOR.
    expect(run.stderr).not.toContain("\u{1b}[");
    expect(run.stderr).toContain("bad.ts");
  });

  it("lets the agent finish on the retry, even with the error still there", () => {
    write(path.join(main, "src", "lib", "bad.ts"), "// LINT_ERROR\n");

    expect(hook("end-of-turn.mjs", stop({ stop_hook_active: true }))).toMatchObject({ status: 0, stderr: "" });
    expect(calls()).toEqual([]);
  });

  it("runs the hook tests only when the hooks changed", () => {
    write(path.join(main, ".claude", "hooks", "notes.txt"), "changed\n");

    expect(hook("end-of-turn.mjs", stop()).status).toBe(0);
    expect(calls()).toEqual(["vitest main run --project hooks"]);
  });

  it("fails visibly when the typechecker is not installed", () => {
    write(path.join(main, "src", "lib", "ok.ts"), "export const ok = 2;\n");

    const run = without("astro", () => hook("end-of-turn.mjs", stop()));

    expect(run.status).toBe(2);
    expect(run.stderr).toContain("astro is not installed");
  });
});

describe("checkouts: the session's, not $CLAUDE_PROJECT_DIR", () => {
  it("sweeps the session cwd, not a broken checkout named by $CLAUDE_PROJECT_DIR", () => {
    write(path.join(other, "src", "lib", "bad.ts"), "// LINT_ERROR\n");

    expect(hook("end-of-turn.mjs", stop(), { CLAUDE_PROJECT_DIR: other })).toMatchObject({ status: 0, stderr: "" });
  });

  it("sweeps a sibling worktree the session edited", () => {
    expect(hook("lint-edited-file.mjs", edit(path.join(wt, "src", "lib", "ok.ts"))).status).toBe(0);
    write(path.join(wt, "src", "lib", "bad.ts"), "// LINT_ERROR\n");

    const run = hook("end-of-turn.mjs", stop());

    expect(run.status).toBe(2);
    expect(run.stderr).toContain("bad.ts");
    expect(calls()).toContain("eslint wt --quiet --no-warn-ignored src/lib/bad.ts");
  });

  it("reaches the script through every command of .claude/settings.json, from a worktree", () => {
    const settings = JSON.parse(readFileSync(SETTINGS, "utf8")) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    const commands = Object.values(settings.hooks).flatMap((groups) =>
      groups.flatMap((g) => g.hooks.map((h) => h.command)),
    );
    expect(commands).toHaveLength(3);

    for (const command of commands) {
      const result = spawnSync(shell(), ["-c", command], {
        cwd: wt,
        input: "{}",
        encoding: "utf8",
        env: { ...process.env, CLAUDE_PROJECT_DIR: path.join(base, "nowhere") },
      });
      expect({ command, status: result.status, stderr: result.stderr }).toEqual({ command, status: 0, stderr: "" });
    }
  });
});

// The shell Claude Code runs hook commands in: sh on macOS and Linux, Git Bash on Windows.
function shell(): string {
  if (process.platform !== "win32") return "/bin/sh";
  const gitRoot = path.resolve(git(base, "--exec-path").trim(), "../../..");
  const bash = [path.join(gitRoot, "bin", "bash.exe"), path.join(gitRoot, "usr", "bin", "bash.exe")].find(existsSync);
  if (bash === undefined) throw new Error(`Git Bash not found next to ${gitRoot}`);
  return bash;
}
