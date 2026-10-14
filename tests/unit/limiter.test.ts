import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFetchLimiter, type FetchLimiter } from "@/lib/live-sync/limiter";

// The room screen's fetches of the room's state go through one limiter (risk #7 in context/foundation/test-plan.md;
// T5 in context/changes/first-live-round/research.md). The channel is public, so anyone with the room's id can ring
// its bell: a series of bells must give a bounded number of fetches, and the last bell must still end in a fetch (the
// 2 s budget). The oracle is the contract in context/changes/first-live-round/plan.md, Faza 4 #1, worked out by hand:
//
// - at most one fetch in flight and one waiting "for the end", at least 500 ms apart from start to start;
// - a fetch is given up after 3 s, which frees its place;
// - while the state stays the same (no new state counts as the same), the bells' gap doubles, up to LOBBY_POLL_MS
//   (15 s); a changed state brings it back to 500 ms;
// - the screen's own reasons (its poll, a (re)subscription, the tab coming back, the player's own action) wait only
//   for the fetch in flight and the 500 ms: no one outside can send them, so they never wait for the bells' back-off.
//
// The start times below are written out by hand from those rules, never computed by the limiter's own logic.

interface Harness {
  limiter: FetchLimiter;
  // When each fetch started, in ms since the test began.
  starts: number[];
  signals: AbortSignal[];
  errors: unknown[];
}

// fetchState as the screen gives it: answers after durationMs whether the state changed. answers[n] is the answer of
// fetch n (the last one repeats); "hang" never answers, "reject" fails with an error.
function harness(answers: (boolean | "hang" | "reject")[], durationMs = 100): Harness {
  const starts: number[] = [];
  const signals: AbortSignal[] = [];
  const errors: unknown[] = [];
  const limiter = createFetchLimiter({
    fetchState: (signal) => {
      const answer = answers[Math.min(starts.length, answers.length - 1)];
      starts.push(Date.now());
      signals.push(signal);
      if (answer === "hang") return new Promise<boolean>(() => undefined);
      return new Promise<boolean>((resolve, reject) => {
        setTimeout(() => {
          if (answer === "reject") reject(new Error("fetchState broke"));
          else resolve(answer);
        }, durationMs);
      });
    },
    onError: (error) => {
      errors.push(error);
    },
  });
  return { limiter, starts, signals, errors };
}

// Moves the clock to the given time (ms since the test began), running every timer and promise on the way.
async function at(time: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(time - Date.now());
}

// A bell at every step from `from` to `to`, both included.
async function bells(limiter: FetchLimiter, from: number, to: number, step: number): Promise<void> {
  for (let time = from; time <= to; time += step) {
    await at(time);
    limiter.bell();
  }
}

describe("createFetchLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns a series of 20 bells into one fetch now and one at the end", async () => {
    const { limiter, starts } = harness([true]);

    // 20 bells in 190 ms, the first one fetches at once, the other 19 wait together for the end.
    await bells(limiter, 0, 190, 10);
    await at(10_000);

    expect(starts).toEqual([0, 500]);
  });

  it("ends a bell that came during a fetch with one more fetch, after it", async () => {
    const { limiter, starts } = harness([true], 400);

    limiter.bell();
    await at(350);
    // The fetch in flight may have read the state before this bell's change.
    limiter.bell();
    await at(10_000);

    expect(starts).toEqual([0, 500]);
  });

  it("keeps the last bell of a slow series, each one fetched at least 500 ms after the one before", async () => {
    const { limiter, starts } = harness([true]);

    for (const time of [0, 300, 700, 1200]) {
      await at(time);
      limiter.bell();
    }
    await at(10_000);

    // 300 waits for 500, 700 for 1000, and the last bell (1200) for 1500: it still gets its fetch.
    expect(starts).toEqual([0, 500, 1000, 1500]);
  });

  it("gives up a hung fetch after 3 s, frees its place and aborts it", async () => {
    const { limiter, starts, signals } = harness(["hang", true]);

    // A bell every 100 ms while the first fetch hangs: nothing else starts until it is given up.
    await bells(limiter, 0, 2900, 100);
    await at(2999);
    expect(starts).toEqual([0]);
    expect(signals[0].aborted).toBe(false);

    await at(10_000);

    expect(signals[0].aborted).toBe(true);
    expect(starts).toEqual([0, 3000]);
  });

  it("backs off while the state stays the same, doubling the gap up to 15 s", async () => {
    const { limiter, starts } = harness([false]);

    // A bell every 100 ms for a minute, and the state never changes: 500 doubles to 1 s after the first fetch, then
    // 2, 4, 8 s and at most 15 s.
    await bells(limiter, 0, 59_900, 100);
    await at(70_000);

    expect(starts).toEqual([0, 1000, 3000, 7000, 15_000, 30_000, 45_000, 60_000]);
  });

  it("goes back to 500 ms as soon as the state changes", async () => {
    // The 1st and 2nd fetch find the same state, the 3rd a new one, and so on.
    const { limiter, starts } = harness([false, false, true]);

    await bells(limiter, 0, 3900, 100);
    await at(10_000);

    // 0 (same: 1 s), 1000 (same: 2 s), 3000 (changed: 500 ms), 3500, 4000 for the bell at 3900.
    expect(starts).toEqual([0, 1000, 3000, 3500, 4000]);
  });

  it("lets a bell through at once after a quiet stretch as long as the gap", async () => {
    const { limiter, starts } = harness([false]);

    // Backed off to 15 s by a series that ends at 14.9 s ...
    await bells(limiter, 0, 14_900, 100);
    await at(16_000);
    expect(starts).toEqual([0, 1000, 3000, 7000, 15_000]);

    // ... then nothing until 40 s: 15 s have passed since the last bell's fetch.
    await at(40_000);
    limiter.bell();
    await at(41_000);

    expect(starts).toEqual([0, 1000, 3000, 7000, 15_000, 40_000]);
  });

  it("never makes the screen's own reasons wait for the bells' back-off", async () => {
    const { limiter, starts } = harness([false]);

    await bells(limiter, 0, 14_900, 100);
    await at(20_000);
    // The tab came back (or the poll ran): only the 500 ms since the last start count.
    limiter.refresh();
    await at(25_000);
    // The next bell still keeps its own 15 s from the last bell's fetch (at 15 s), not from the refresh.
    limiter.bell();
    await at(40_000);

    expect(starts).toEqual([0, 1000, 3000, 7000, 15_000, 20_000, 30_000]);
  });

  it("keeps the screen's own fetches one at a time and 500 ms apart", async () => {
    const { limiter, starts } = harness([true], 50);

    for (const time of [0, 100, 200, 300]) {
      await at(time);
      limiter.refresh();
    }
    await at(10_000);

    expect(starts).toEqual([0, 500]);
  });

  it("answers a waiting bell with the screen's own fetch when that comes first", async () => {
    const { limiter, starts } = harness([false]);

    // Backed off: the bell at 15.5 s would wait for 30 s ...
    await bells(limiter, 0, 14_900, 100);
    await at(15_500);
    limiter.bell();
    // ... but the poll at 16 s starts a fetch that reads the state after that bell, so nothing else waits.
    await at(16_000);
    limiter.refresh();
    await at(40_000);

    expect(starts).toEqual([0, 1000, 3000, 7000, 15_000, 16_000]);
  });

  it("reports a fetch that failed with an error and goes on", async () => {
    const { limiter, starts, errors } = harness(["reject", true]);

    limiter.bell();
    await at(300);
    limiter.bell();
    await at(10_000);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    // The failed fetch found no new state, so the gap doubled: 1 s after the first start.
    expect(starts).toEqual([0, 1000]);
  });

  it("stops: aborts the fetch in flight and starts nothing more", async () => {
    const { limiter, starts, signals } = harness(["hang"]);

    limiter.bell();
    await at(100);
    limiter.bell();
    limiter.stop();
    expect(signals[0].aborted).toBe(true);

    limiter.bell();
    limiter.refresh();
    await at(60_000);

    expect(starts).toEqual([0]);
  });
});
