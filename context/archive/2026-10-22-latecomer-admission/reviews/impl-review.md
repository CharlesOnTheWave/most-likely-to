<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Wpuszczanie spóźnionych (S-08)

- **Plan**: context/changes/latecomer-admission/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-24
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Evidence (S-08 merge `2e2010f`, formerly `2ed1304`, 42 files; checked against `HEAD` after S-06):

- Plan adherence: every planned item is MATCH. These include the table, the four functions with the planned check order and room lock, `room_lobby` `requests`/`eligible`, cleanup in `drop_round_state`, the db tests, pgTAP, the Worker routes, parsers and refusal texts, the link page states, `JoinWaiting`, `JoinRequests`, the `RoundVoting` count, candidates and note, previews, E2E, smoke, docs and the glossary. "What We're NOT Doing" was respected: `cast_vote`, `start_game`, `open_next_round`, `finish_round`, `join_room` and `AppHeader` are untouched, and there are no requests in the lobby and no co-host.
- Benign extras: `bodyNick` in `json-route.ts` with its unit cases, the four RPCs in `room-rpc-gate.test.ts` (rule from PR #15), the start hint in `RoomLobby.tsx`, and the S-08 order in `roadmap.md`. "Host cię nie wpuścił" in lower case and the row buttons as `aria-disabled` (keyboard keeps its place, as in `HostActions`) are deliberate.
- S-06 (`fa585ee`) redefined `room_lobby` but kept `requests` (host only) and `eligible`. No later commit touches `RoundVoting`, `JoinRequests`, `JoinWaiting`, `JoinForm`, `j/[token].astro` or the S-08 tests.
- Safety checked clean:
  - `join_requests`: RLS on, no grants or policies, outside the publication (pgTAP).
  - Every write function locks the room row first, `request_join` checks the token format first, and all four functions are `security definer` with `search_path=''`, owner postgres and selective grants.
  - `join_request_state` returns only the caller's own state.
  - Every close path drops requests.
  - Nobody gets a player row without the host, and the host learns only nicks.
  - Routes follow `skip.ts` (origin check, id format, session).
  - Nicks are rendered as text, `JoinWaiting` cleans up its channel and timers, and nothing logs a nick or token.
- Success criteria:
  - PR #14 checks are green (`ci`, `smoke`, `db`, `e2e`, `review`).
  - `npx supabase migration list` shows `20261022132240` locally and remotely.
  - The S-06 merge on `main` passed all four jobs and Workers Builds.
  - Production smoke runs 66/66 for S-08 on 22.10, and 77/77 for S-06 on 24.10 with the latecomer steps included.
  - The gate on the current branch passes (lint, astro check, 510 unit tests, build).
  - Karol's run-through 4.4 was OK on 2026-10-24.
  - `npx prettier --check context/domain/glossary.md` (3.2) does not pass and never has (not since `b706ec9`): Karol keeps the glossary's compact tables unformatted (decision of 2026-10-22).
- Minor, left as is:
  - `j/[token].astro:51` sends the raw cookie to `join_request_state` without the `PLAYER_TOKEN_PATTERN` guard that `request.ts:20` has. The database answers `none`, so the only cost is one needless call.
  - `JoinRequests` sits before the view title in the DOM, outside `contentRef`, as `LiveBanner` and the skip note do.

## Findings

### F1 — `request_join` lacks a malformed-token test and a parallel-limit test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/db/latecomers.test.ts
- **Detail**: The first guard of this public (`anon`) endpoint, the 22023 refusal for a malformed token, has no test. The only malformed-token case covers `join_request_state` (`:192`). The limit of 5 and the nick collisions are tested only with sequential calls, so the room lock that orders parallel requests is never exercised. The partial unique index still guards nicks at the database level, so a lost lock could at worst let a sixth request in.
- **Fix**: In the next change that touches `tests/db`, add a malformed-token probe (22023) and six parallel `requestJoin` calls asserting exactly 5 `ok` and 1 `requests_full`.
- **Decision**: DEFERRED — queued in `follow-ups/review-fixes.md` for the next change that touches `tests/db` (Karol, 2026-10-24)

### F2 — A token hash reused across rooms ends in a 500, not a refusal

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261022132240_latecomer_admission.sql:48,194,322-323
- **Detail**: `request_join` checks the token only against this room, but `join_requests.token_hash` and `player_secrets.token_hash` are unique across rooms. The Worker issues one token per room (`mlt_player_<roomId>`), so this is reachable only by calling the public RPC directly with one's own token. If that token already has a request in another room, the insert raises 23505 (500 for the caller). If it is already a player's token in another room, the request is accepted, but the host's "Wpuść" fails on the `player_secrets` insert, which sits outside the `exception` block, and the host gets a 500 "unexpected". Everything rolls back, so no orphan row is left, and the host can still press "Odrzuć". It harms only the one who crafts the call.
- **Fix**: Accept as is. If a later migration touches `request_join`, refuse a hash that already exists in another room.
- **Decision**: ACCEPTED — self-harm only, reachable only by a hand-made RPC call; refuse it if a later migration touches `request_join` (Karol, 2026-10-24)

### F3 — During a game, a link holder can probe whether a nick is taken

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261022132240_latecomer_admission.sql:169-185
- **Detail**: `nick_taken` is answered before `requests_full` and before any write. Someone with the link can therefore check, without the host seeing anything, whether a nick is in the game. Before S-08, `join_room` answered `game_started` first. Nicks are not secret among link holders: anyone with the link sees every nick in the lobby, and the link is the game's trust boundary.
- **Fix**: Accept as is (the link is the trust boundary).
- **Decision**: ACCEPTED — the link is the trust boundary and nicks are visible to every link holder (Karol, 2026-10-24)

### F4 — A host's request row can stay greyed out if the same nick asks again at once

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/room/JoinRequests.tsx:55,127
- **Detail**: After a successful "Wpuść"/"Odrzuć", the row stays `aria-disabled` until the refreshed state drops it, and rows are keyed by nick. Suppose a rejected latecomer asks again under the same nick before the host's refresh arrives, for example because that refresh failed and the next one comes on the 15 s poll. The refreshed list then still holds that nick, and the row keeps its buttons greyed out until the nick leaves the list. Normally `refresh()` runs right after the action (`RoomScreen.tsx:123`), long before a person can resubmit the form.
- **Fix**: Next time `JoinRequests` changes, clear the row's busy state when a refreshed list arrives that still holds its nick.
- **Decision**: DEFERRED — queued in `follow-ups/review-fixes.md` for the next change to `JoinRequests.tsx` (Karol, 2026-10-24)
