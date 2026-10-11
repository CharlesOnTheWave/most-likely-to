// PostToolUse (Write|Edit): lint only the file the agent just edited, in its own checkout. No --fix: it would rewrite
// the file under the agent and fail its next Edit. A view under src/ also gets the UI literal scan of `npm run lint`.
import { LINTED, clip, editedFile, readPayload, registerCheckout, runTool, sendBack, uiLiterals } from "./lib.mjs";

const payload = readPayload();
const edited = editedFile(payload);

if (edited !== null) {
  registerCheckout(payload, edited.root);

  if (LINTED.test(edited.rel)) {
    const checks = [["ESLint", runTool(edited.root, "eslint", "eslint", ["--quiet", "--no-warn-ignored", edited.rel])]];
    if (/^src\/.*\.(?:astro|tsx)$/.test(edited.rel)) checks.push(["UI literals", uiLiterals(edited.root)]);

    const failures = [];
    for (const [name, pending] of checks) {
      const result = await pending;
      if (result.code !== 0) failures.push(`${name} reported errors in ${edited.rel}:\n${clip(result.output)}`);
    }
    if (failures.length > 0) sendBack(failures.join("\n\n"));
  }
}
