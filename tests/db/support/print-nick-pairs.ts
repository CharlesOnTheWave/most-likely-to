import { NICK_PAIRS, codePoints } from "./nick-pairs.ts";

// Prints the nick pairs straight from the test's data, for the side-by-side check against research.md §3.1 (plan,
// Phase 3): generated, never copied by hand, or the check proves nothing. Plain node, no database:
//   node tests/db/support/print-nick-pairs.ts
// The .ts extension in the import is what lets node run this file without a build step.

const lines = NICK_PAIRS.map((pair, index) =>
  [
    String(index + 1).padStart(2, " "),
    `taken ${codePoints(pair.taken)}`,
    `probe ${codePoints(pair.probe)}`,
    pair.expected,
    pair.knownHole ? "known hole F4 -> S-02" : "guard",
    pair.why,
  ].join(" | "),
);

process.stdout.write(`${lines.join("\n")}\n`);
