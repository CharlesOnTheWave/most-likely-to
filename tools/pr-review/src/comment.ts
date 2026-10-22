// The PR comment the CI job posts (M5L3, .github/workflows/ai-review.yml): the reviewer's JSON rendered as Markdown,
// with the run's cost from the last line of runs.jsonl.
//
//   npx tsx src/comment.ts review.json > comment.md
import { existsSync, readFileSync } from "node:fs";
import { REVIEW_SCHEMA } from "./review-schema.ts";

const SCORES = [
  ["implementationCorrectness", "Poprawność"],
  ["idiomaticity", "Idiomatyczność"],
  ["complexity", "Złożoność"],
  ["testRiskCoverage", "Testy wobec ryzyka"],
  ["documentation", "Dokumentacja"],
  ["securitySafety", "Bezpieczeństwo"],
] as const;

const file = process.argv[2];
if (!file) throw new Error("Podaj plik z recenzją (JSON z src/index.ts)");
const review = REVIEW_SCHEMA.parse(JSON.parse(readFileSync(file, "utf8")));

const runsLog = new URL("../runs.jsonl", import.meta.url);
const lastRun = existsSync(runsLog) ? JSON.parse(readFileSync(runsLog, "utf8").trim().split("\n").at(-1) ?? "{}") : {};
const cost =
  typeof lastRun.costUsd === "number"
    ? `Koszt ≈ ${lastRun.costUsd.toFixed(2)} USD (szacunek SDK; subskrypcja, bez dopłat), ` +
      `${lastRun.input} tokenów we, ${lastRun.seconds} s.`
    : "";

console.log(
  [
    `## Recenzja AI: ${review.verdict === "pass" ? "✅ pass" : "❌ fail"}`,
    "",
    review.summary,
    "",
    review.hardRules.length ? "**Twarde zasady:**" : "**Twarde zasady:** zmiana żadnej nie dotyka.",
    ...review.hardRules.map((rule) => `- ${rule}`),
    "",
    "| Kryterium | Ocena |",
    "| --- | --- |",
    ...SCORES.map(([key, label]) => `| ${label} | ${review[key]}/10 |`),
    "",
    `<sub>Werdykt to sugestia, scala właściciel. Ponowna recenzja: etykieta \`ai-cr:review\`. ${cost}</sub>`,
  ].join("\n"),
);
