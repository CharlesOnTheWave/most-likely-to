# pr-review

A code reviewer for this repo's pull requests (10xDevs M5L2): a diff in, a review as JSON out (six scores 1–10, the
Hard Rules the change touches, a pass/fail verdict, a short summary in Polish). The verdict is a suggestion; the owner
merges.

```bash
cd tools/pr-review
npm install
gh pr diff 10 | npm run review          # a PR
npm run review -- data/sample-diff.md   # the sample diff, which breaks the anonymity rule on purpose
npm run typecheck
```

- It runs the Claude Agent SDK on the login of the local Claude Code (no API key) with no tools and no settings from
  disk (`settingSources: []`, no auto-memory). It reads only the diff, `AGENTS.md` and `context/domain/glossary.md`.
- It leaves out `context/` and `package-lock.json` from the diff.
- Each run prints its cost to stderr (an SDK estimate) and appends it to `runs.jsonl` (not in git). A run stops at
  0.50 USD.
- It has its own dependencies, so the root lint and `astro check` skip `tools/`.
