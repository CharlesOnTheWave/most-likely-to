// PostToolUse (Write|Edit): the unit tests that depend on the edited file. Vitest exits 0 when none do. Never the db
// project: it needs a local Supabase, which only CI has.
import { clip, editedFile, readPayload, runTool, sendBack } from "./lib.mjs";

const payload = readPayload();
const edited = editedFile(payload);

if (edited !== null && /\.(?:[cm]?[jt]s|[jt]sx)$/.test(edited.rel)) {
  const args = ["related", edited.rel, "--run", "--project", "unit", "--passWithNoTests"];
  const result = await runTool(edited.root, "vitest", "vitest", args);
  if (result.code !== 0) sendBack(`Unit tests related to ${edited.rel} fail:\n${clip(result.output)}`);
}
