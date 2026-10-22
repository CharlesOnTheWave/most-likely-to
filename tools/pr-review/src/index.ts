// The PR reviewer (M5L2): a diff in, the review as JSON out, the run's cost on stderr and in runs.jsonl.
//
//   gh pr diff 10 | npm run review
//   npm run review -- data/sample-diff.md
//
// It runs the Claude Agent SDK on the login of the local Claude Code (a subscription, so no API key), cut off from
// everything on disk: no CLAUDE.md, .claude/ settings, hooks or auto-memory, and no tools. What it knows of the
// project comes only from the two documents it is given below.
import { appendFileSync, readFileSync } from "node:fs";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { REVIEW_JSON_SCHEMA, REVIEW_SCHEMA, SYSTEM_PROMPT } from "./review-schema.ts";

const MODEL = "claude-sonnet-5-5";
// A hard cap per run. Measured on 2026-10-21: the sample diff about 0.05 USD, PR #10 without its documents about 0.20 USD
// (88k tokens in: the second turn, which returns the JSON, sends the diff again).
const MAX_BUDGET_USD = 0.5;
// Documents and the lockfile are most of a PR's diff and say nothing about the code, so they are left out.
const SKIPPED_PATHS = [/^context\//, /(^|\/)package-lock\.json$/];
// The CI job passes the PR's title and description (PR_TITLE, PR_BODY); the description is clipped, it costs tokens on
// every run.
const PR_BODY_LIMIT = 4000;

const repoFile = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const runsLog = new URL("../runs.jsonl", import.meta.url);

function splitDiff(diff: string): { code: string; skipped: string[] } {
  const skipped: string[] = [];
  const kept = diff.split(/^(?=diff --git )/m).filter((part) => {
    const path = /^diff --git a\/(\S+) /.exec(part)?.[1];
    if (path && SKIPPED_PATHS.some((pattern) => pattern.test(path))) {
      skipped.push(path);
      return false;
    }
    return true;
  });
  return { code: kept.join(""), skipped };
}

async function readInput(): Promise<string> {
  const file = process.argv[2];
  if (file) return readFileSync(file, "utf8");
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function describePr(): string {
  const title = process.env.PR_TITLE?.trim();
  const body = process.env.PR_BODY?.trim().slice(0, PR_BODY_LIMIT);
  return [title && `Tytuł PR-a: ${title}`, body && `Opis PR-a:\n\n${body}`].filter(Boolean).join("\n\n");
}

async function review(diff: string) {
  const pr = describePr();
  const systemPrompt = [
    SYSTEM_PROMPT,
    "AGENTS.md (zasady i konwencje repo):\n\n" + repoFile("AGENTS.md"),
    "Słownik domeny (nazwy w kodzie i w rozmowie):\n\n" + repoFile("context/domain/glossary.md"),
  ].join("\n\n");

  const run = query({
    prompt: `${pr ? `${pr}\n\n` : ""}Zrecenzuj ten diff:\n\n${diff}`,
    options: {
      systemPrompt,
      model: MODEL,
      tools: [],
      settingSources: [],
      settings: { autoMemoryEnabled: false },
      persistSession: false,
      maxTurns: 2,
      maxBudgetUsd: MAX_BUDGET_USD,
      outputFormat: { type: "json_schema", schema: REVIEW_JSON_SCHEMA },
    },
  });

  for await (const message of run) {
    if (message.type !== "result") continue;
    if (message.subtype !== "success") {
      throw new Error(`Recenzja nie powiodła się (${message.subtype}): ${message.errors.join("; ")}`);
    }
    const parsed = REVIEW_SCHEMA.safeParse(message.structured_output);
    if (!parsed.success) throw new Error(`Wynik niezgodny ze schematem: ${parsed.error.message}`);
    const tokens = Object.values(message.modelUsage).reduce(
      (sum, usage) => ({
        input: sum.input + usage.inputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens,
        output: sum.output + usage.outputTokens,
      }),
      { input: 0, output: 0 },
    );
    return {
      review: parsed.data,
      usage: {
        costUsd: message.total_cost_usd,
        ...tokens,
        turns: message.num_turns,
        seconds: Math.round(message.duration_ms / 1000),
      },
    };
  }
  throw new Error("Agent nie zwrócił wyniku");
}

const input = await readInput();
const { code, skipped } = splitDiff(input);
if (!code.trim()) throw new Error("Pusty diff: nie ma czego recenzować");

const { review: output, usage } = await review(code);
console.log(JSON.stringify(output, null, 2));
console.error(
  `koszt ≈ ${usage.costUsd.toFixed(4)} USD (szacunek SDK; na subskrypcji bez dopłat), ` +
    `tokeny: ${usage.input} we / ${usage.output} wy, tury: ${usage.turns}, ${usage.seconds} s, ` +
    `pominięte pliki: ${skipped.length}`,
);
appendFileSync(
  runsLog,
  JSON.stringify({
    at: new Date().toISOString(),
    source: process.argv[2] ?? "stdin",
    model: MODEL,
    diffChars: code.length,
    skippedFiles: skipped.length,
    verdict: output.verdict,
    ...usage,
  }) + "\n",
);
