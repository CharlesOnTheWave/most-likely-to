<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: S-16 Emotki do pokoju

- **Plan**: context/changes/room-emotes/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-27
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Every planned item matches the plan's intent: the endpoint's order of checks, log lines without nick or emote, no
database write, the listener without `limiter.bell`, `emote` outside `VIEW_CHANGING`, the bar without a heading and
outside `contentRef`, the bubbles `fixed` + `pointer-events-none` + `aria-hidden` with an sr-only live region, and the
receiver's `parseEmoteMessage` against its own list of players. Documented deviations (ADAPT): a second, emote-only
subscription at the end of the evening and `ScreenPreview.window`; Karol's choice of variant recorded in change.md Notes
rather than in Progress 2.3. Extras without harm: a comment in `src/lib/rooms/json-route.ts`, the `emotes.spec.ts`
entry in `test-plan.md` §6.4. Automated criteria re-run on main 2026-10-27: lint, `astro check`, `npm test` (662, of
them 36 in `tests/unit/emotes.test.ts`), build, `playwright test --list` (emotes.spec in both projects): all pass.
Manual 3.3 confirmed by Karol after the game of 2026-10-26 (visibility follow-up: `context/changes/emote-visibility/`).

## Findings

### F1 — End-of-evening emote listener never resubscribes

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/room/useRoomState.ts:355-373
- **Detail**: After "Zakończ grę" the screen keeps a separate emote-only channel subscribed with no status callback. A
  CLOSED channel is removed from the client for good (realtime-js `_onClose`), so after any server-side close the end
  screen stops hearing emotes until a reload. Neither E2E nor unit tests cover emotes after the room is closed.
- **Fix**: Resubscribe on CLOSED with the main channel's backoff, and add an E2E step after "Zakończ grę".
  - Strength: The end screen keeps the room's mood, as the plan's Desired End State wants.
  - Tradeoff: More channel code on a screen with nothing else to do; an extra E2E step (~5 s).
  - Confidence: MED — the close path read in realtime-js, not reproduced.
  - Blind spot: How often Realtime closes a channel within the minutes the end screen is open.
- **Decision**: SKIPPED (Karol 2026-10-27: rzadkie, odświeżenie strony pomaga)

### F2 — The emote's send error logs the Realtime server's text

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/live-sync/server.ts:28-38
- **Detail**: The shared `send()` logs `code: error.message`, an exception justified by audit L6 for the bell's
  `{ seq }`. The same path now sends `{ emote, nick }`; no evidence Realtime echoes the body in its errors, so no leak
  today, but "never with the payload" now rests on a third party's error text.
- **Fix**: For `op: "emote_send"` log a fixed code (or the status class) instead of `error.message`.
- **Decision**: ACCEPTED (Karol 2026-10-27: wyjątek z audytu L6, komunikat Realtime bez klucza i danych żądania)

### F3 — Every emote rewrites the polite live region

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/room/EmoteBubbles.tsx:49
- **Detail**: Each accepted emote sets "<nick>: <emote's name>" in a polite live region, with no throttling, sharing the
  queue with the room's own announcements (`RoomScreen.tsx:291`). In a busy room a screen reader hears a steady stream
  that can delay "new question" or "result". The plan asked for exactly this, so it is a design trade-off, not a bug;
  relevant at the evening's screen-reader check (F7).
- **Fix**: Announce at most one emote every few seconds (or "3 emotki"), and confirm with Karol that game announcements
  come first.
  - Strength: Keeps the game's announcements audible on the evening's screen-reader phone.
  - Tradeoff: A screen-reader player hears fewer emotes than the others see.
  - Confidence: MED — reasoned from the polite queue; not tried on a phone.
  - Blind spot: Whether anyone in the crew plays with a screen reader.
- **Decision**: SKIPPED (Karol 2026-10-27: sprawdzić na wieczorze z czytnikiem ekranu, F7)

### F4 — A refusal under the phone's bar covers the view's end

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/room/EmoteBar.tsx:25, :109
- **Detail**: Below lg the fixed bar's slot has a fixed height (`h-18` since emote-visibility). While a refusal shows
  under the buttons, the bar is taller than its slot and covers the last ~25 px of the view at the bottom of the
  scroll; the refusal is rare and goes with the next tap.
- **Fix**: Let the slot grow by the refusal's line while it shows.
- **Decision**: SKIPPED (Karol 2026-10-27: odmowa rzadka i znika przy następnym dotknięciu)
