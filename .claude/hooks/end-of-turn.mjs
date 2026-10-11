// Stop: before the agent finishes, sweep everything the turn left changed (git diff, untracked files), also what a
// shell command wrote past the per-edit hooks. One retry: sent back once, the agent may finish; the commit gate and CI
// catch the rest. A turn that changed no code (a question, docs) runs nothing. Never smoke, test:db or build here.
import { existsSync } from "node:fs";
import path from "node:path";
import {
  LINTED,
  clearRegistry,
  clip,
  git,
  readPayload,
  registeredCheckouts,
  runTool,
  sendBack,
  sessionCwd,
  uiLiterals,
} from "./lib.mjs";

const payload = readPayload();

// loop_count: Cursor imports .claude/settings.json hooks and counts retries its own way.
const retry = payload.stop_hook_active === true || (typeof payload.loop_count === "number" && payload.loop_count > 0);

if (!retry) await sweep();

async function sweep() {
  const isCode = (file) => LINTED.test(file) || /(?:^|\/)(?:package(?:-lock)?|tsconfig)\.json$/.test(file);
  const isHooks = (file) => file.startsWith(".claude/hooks/") || file.startsWith("tests/hooks/");

  // The session's checkout (payload cwd follows EnterWorktree) plus every checkout the per-edit hook registered.
  const roots = [git(sessionCwd(payload), ["rev-parse", "--show-toplevel"]), ...registeredCheckouts(payload)]
    .filter((root) => root !== null && existsSync(root))
    .map((root) => path.resolve(root));
  if (roots.length === 0) {
    // Not silent: the user sees why nothing was checked.
    const systemMessage = `end-of-turn hook: no git checkout at ${sessionCwd(payload)}, nothing checked.`;
    process.stdout.write(JSON.stringify({ systemMessage }));
    return;
  }

  const reports = [];
  for (const root of new Set(roots)) {
    const listed = [
      git(root, ["diff", "--name-only", "-z", "HEAD"]),
      git(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
    ];
    const changed = [...new Set(listed.flatMap((out) => (out ?? "").split("\0")).filter(Boolean))];
    const code = changed.filter(isCode);
    const hooks = changed.some(isHooks);
    if (code.length === 0 && !hooks) continue;

    // Started together, awaited in order: the slowest check (astro check, ~7 s) sets the time.
    const checks = [];
    const linted = changed.filter((file) => LINTED.test(file) && existsSync(path.join(root, file)));
    if (linted.length > 0) {
      checks.push([
        "ESLint (changed files)",
        runTool(root, "eslint", "eslint", ["--quiet", "--no-warn-ignored", ...linted]),
      ]);
    }
    if (code.length > 0) {
      checks.push(["UI literals", uiLiterals(root)]);
      checks.push(["Unit tests", runTool(root, "vitest", "vitest", ["run", "--project", "unit"])]);
      checks.push(["Typecheck (astro check)", runTool(root, "astro", "astro", ["check"])]);
    }
    if (hooks) checks.push(["Hook tests", runTool(root, "vitest", "vitest", ["run", "--project", "hooks"])]);

    for (const [name, pending] of checks) {
      const result = await pending;
      if (result.code !== 0) reports.push(`${name} fail in ${root}:\n${clip(result.output)}`);
    }
  }

  if (reports.length > 0) {
    sendBack(
      `Fix these before you finish:\n\n${reports.join("\n\n")}\n\n` +
        "If the fix would change a test's expectation rather than the code, stop and ask the user instead.",
    );
    return;
  }
  // Clean: the next turn starts with an empty registry.
  clearRegistry(payload);
}
