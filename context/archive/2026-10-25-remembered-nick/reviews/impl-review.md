<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Zapamiętany nick (S-14, FR-024)

- **Plan**: context/changes/remembered-nick/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Notes

- Every planned change is MATCH (phases 1–3). The edits to `context/foundation/prd.md` (FR-024) and `roadmap.md` (S-14) are inputs recorded in `plan-brief.md` and `research.md`, not drift.
- Adaptations accepted during implementation, recorded here because the plan's phase blocks are read-only:
  - `eslint-disable-next-line react-hooks/set-state-in-effect -- <reason>` above `setNick` in `JoinForm.tsx` and `NewGameForm.tsx`. A lazy `useState` initialiser would break hydration, and `useSyncExternalStore` models a live store, not a one-time seed. Gone after the F1 fix: the shared hook `useNickField` needs no suppression.
  - The preview states are numbered 79 (`new-remembered`) and 80 (`join-remembered`) in the page's global sequence, each at the end of its group, as with 64–68 and 72–78.
  - E2E: `nextListFetch` around guest A's first join (proves the room screen ran and stored the nick), `waitForLoadState("networkidle")` before the empty-field check, `test.slow()`.
- Break-check (test-plan §6.4): `39822c6` (`suggestNick = true`) turned red only `remembered-nick.spec.ts` (chromium), in all 3 attempts, at line 70 (`toHaveValue("")`; it received the remembered nick). `ci`, `smoke`, `db` and the rest of e2e stayed green. Reverted in `0bf4320`, which is identical to `19a3162`.
- Automated criteria re-run on `3a7bbd8`: unit test of the module 25/25, `npm test` 535/535, lint, `astro check` 0/0/0, build, storage grep exactly 4 lines, Prettier on both plans, `playwright --list` lists the new test in `chromium` only. Manual 1.3, 2.4, 3.4 and 3.5 all have evidence in this session (break-check, screenshot approval, production smoke all green after merge `5ecd38b`, the owner's check on phone and laptop).

## Findings

### F1 — Nick typed before hydration is replaced by the remembered nick

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/room/JoinForm.tsx:81-87, src/components/room/NewGameForm.tsx:78-86
- **Detail**: The updater `setNick((current) => (current === "" ? remembered : current))` compares against React state, not the field. Text that reaches the field before hydration lives only in the DOM: typing on a slow phone, a form the browser restores on back/reload, autofill. React 19.3 does not touch the DOM value while hydrating (`initInput`: `isHydrating || … (element.value = value)`, react-dom-client), so the state stays `""`. The effect then sets the remembered nick and overwrites what the player typed; keystrokes during hydration get appended to it ("Kas" → "Ola" → "Olaia"). This contradicts the plan's Key Discovery (`tests/e2e/support/room.ts:63-64`, "podpowiedź po zamontowaniu nie może nadpisać tego, co gracz już wpisał") and JoinForm's own comment. Before S-14 the typed text stayed visible but counted as empty (state `""`): the counter showed 0/20 and "Dołącz" answered "Wpisz nick". The same mechanism would make `joinRoom`/`askToJoin` retries flaky in a future spec that re-joins from a context that already remembers a nick; nothing fails today because every call runs in a fresh context.
- **Fix A ⭐ Recommended**: One hook `useRememberedNick` (in `src/components/room/`) used by both forms. After mounting it reads the nick field in the DOM. If the player has already typed something, the hook takes that text into the state. Otherwise it suggests the remembered nick, where the form allows it.
  - Strength: Removes the overwrite and the older quirk where early text counted as empty. The duplicated effect and its lint suppression then exist once.
  - Tradeoff: Slightly wider than S-14 (it also changes the pre-S-14 "typed before hydration" behaviour), so it is one more small PR. No unit test is possible in the node environment, so it needs either a manual check on a throttled network or a small E2E that holds back the island's script.
  - Confidence: HIGH — React's hydration path verified in `node_modules/react-dom` 19.3.0; both forms already reach the field by `[name="nick"]`.
  - Blind spot: Autofill on iOS Safari may fire its own input events after hydration; not checked.
- **Fix B**: In both existing effects, skip the suggestion when the DOM field already has text; nothing else changes.
  - Strength: Smallest diff; exactly the S-14 regression and nothing more.
  - Tradeoff: The older quirk stays (early text visible but counted as empty), and the two near-identical effects stay duplicated.
  - Confidence: HIGH — same mechanism.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — `src/components/room/useNickField.ts` used by both forms; a new last step in `remembered-nick.spec.ts` holds back the form's script, types a new nick and checks the counter, the field and the join under that nick; the stale "input typed before it hydrates is dropped" comments in `tests/e2e/support/room.ts` and `latecomer.spec.ts` updated.

### F2 — Empty-field E2E check rests on `networkidle`; break-check not yet in test-plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/remembered-nick.spec.ts:65-70
- **Detail**: Server-rendered markup is already empty, so only the `networkidle` wait keeps `toHaveValue("")` from passing before the form runs. It is the suite's only `networkidle` (Playwright discourages it). The 2026-10-25 break-check shows it catches the bug on CI today. `context/foundation/test-plan.md` §6.4 lists every earlier spec technique and break-check, but not this one.
- **Fix**: Add the spec's technique and the 2026-10-25 break-check result (red only line 70, 3/3 attempts; revert `0bf4320`) to test-plan §6.4.
- **Decision**: FIXED — `context/foundation/test-plan.md` §6.4: the spec in the list of patterns, the `joinRoom` note, the 2026-10-25 break-check.

### F3 — The private-mode branch of `browserNickStorage` has no unit test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/unit/remembered-nick.test.ts:139-145, src/lib/rooms/remembered-nick.ts:28-36
- **Detail**: Only the branch with no `window` (node) is covered. The `step: "open"` branch, where reaching `window.localStorage` throws (private mode, blocked site data, as the module header promises), has no case.
- **Fix**: Add a case with `vi.stubGlobal("window", …)` whose `localStorage` getter throws a `SecurityError`; assert `null`, exactly one `warn` `{ op: "remembered_nick", step: "open", errName: "SecurityError" }`, and no nick in the log; `vi.unstubAllGlobals()` in `afterEach`.
- **Decision**: FIXED — new case in `tests/unit/remembered-nick.test.ts` (`vi.stubGlobal`, 26 tests).
