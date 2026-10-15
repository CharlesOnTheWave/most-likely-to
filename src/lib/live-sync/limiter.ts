import { LOBBY_POLL_MS } from "@/lib/live-sync/shared";

// How the room screen fetches the room's state (risk #7 in context/foundation/test-plan.md; T5 and F2 in
// context/archive/2026-10-13-first-live-round/research.md). The room's channel is public, so anyone who knows the
// room's id can ring its bell: a series of bells must cost a bounded number of fetches, and the last bell must still
// end in a fetch (the 2 s budget, PRD NFR). No browser or server imports, so tests/unit/limiter.test.ts drives it with
// fake timers.
//
// - At most one fetch in flight and one waiting "for the end"; starts at least MIN_GAP_MS apart.
// - A fetch is given up after FETCH_TIMEOUT_MS: its signal aborts and its place is free again.
// - A bell waits for the bells' gap too. While the state stays the same, the gap doubles up to LOBBY_POLL_MS, which
//   brakes a spammer; a changed state brings it back to MIN_GAP_MS. The limiter learns only "changed or not" from
//   fetchState: room_lobby has no version, so the screen compares the parsed state as JSON.
// - The screen's own reasons (its poll, a (re)subscription, the tab coming back, the player's own action) wait only
//   for the fetch in flight and MIN_GAP_MS, and their answer does not grow the gap: no one outside can send them, so a
//   quiet poll must not slow down the next real bell. A fetch started for any reason answers every bell before it.

export const MIN_GAP_MS = 500;
export const FETCH_TIMEOUT_MS = 3000;

export interface FetchLimiterOptions {
  // One fetch of the state. Resolves to whether the state differs from the one the previous fetch found; a fetch that
  // found no new state (failed, aborted) resolves to false. The signal aborts when the fetch is given up.
  fetchState: (signal: AbortSignal) => Promise<boolean>;
  // fetchState rejected: a bug in it, since it handles the network itself. Counts as "no new state".
  onError: (error: unknown) => void;
}

export interface FetchLimiter {
  // A bell on the room's channel.
  bell(): void;
  // The screen's own reason to look again.
  refresh(): void;
  // Aborts the fetch in flight and starts nothing more (the island unmounts, the room is closed).
  stop(): void;
}

export function createFetchLimiter({ fetchState, onError }: FetchLimiterOptions): FetchLimiter {
  let inFlight: { controller: AbortController; timeout: ReturnType<typeof setTimeout>; servesBells: boolean } | null =
    null;
  let bellWaiting = false;
  let refreshWaiting = false;
  let lastStart = Number.NEGATIVE_INFINITY;
  let lastBellStart = Number.NEGATIVE_INFINITY;
  let gap = MIN_GAP_MS;
  let wake: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  // When the waiting fetch may start, or null when nothing waits.
  function nextStart(): number | null {
    if (refreshWaiting) return lastStart + MIN_GAP_MS;
    if (bellWaiting) return Math.max(lastStart + MIN_GAP_MS, lastBellStart + gap);
    return null;
  }

  function pump() {
    if (stopped || inFlight) return;
    const startAt = nextStart();
    if (startAt === null) return;
    const now = Date.now();
    if (startAt <= now) {
      start(now);
      return;
    }
    if (wake !== null) clearTimeout(wake);
    wake = setTimeout(() => {
      wake = null;
      pump();
    }, startAt - now);
  }

  function start(now: number) {
    const servesBells = bellWaiting;
    bellWaiting = false;
    refreshWaiting = false;
    lastStart = now;
    if (servesBells) lastBellStart = now;

    const controller = new AbortController();
    const current = {
      controller,
      servesBells,
      timeout: setTimeout(() => {
        controller.abort();
        finish(current, false);
      }, FETCH_TIMEOUT_MS),
    };
    inFlight = current;

    fetchState(controller.signal).then(
      (changed) => {
        finish(current, changed);
      },
      (error: unknown) => {
        onError(error);
        finish(current, false);
      },
    );
  }

  // The answer of a fetch given up or stopped meanwhile no longer counts.
  function finish(done: NonNullable<typeof inFlight>, changed: boolean) {
    if (inFlight !== done) return;
    clearTimeout(done.timeout);
    inFlight = null;
    if (changed) {
      gap = MIN_GAP_MS;
    } else if (done.servesBells) {
      gap = Math.min(gap * 2, LOBBY_POLL_MS);
    }
    pump();
  }

  return {
    bell() {
      bellWaiting = true;
      pump();
    },
    refresh() {
      refreshWaiting = true;
      pump();
    },
    stop() {
      stopped = true;
      if (wake !== null) clearTimeout(wake);
      wake = null;
      if (inFlight) {
        clearTimeout(inFlight.timeout);
        inFlight.controller.abort();
        inFlight = null;
      }
    },
  };
}
