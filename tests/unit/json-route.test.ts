import { describe, expect, it } from "vitest";
import { bodyNick, bodyRound, readJsonRequest } from "@/lib/rooms/json-route";

// F6 of the S-02 review (context/archive/2026-10-13-first-live-round/follow-ups/review-fixes.md;
// context/archive/2026-10-15-full-game-evening/plan.md, Faza 3 #5): a body too large for a game's action is refused
// before the Worker reads it, so a stranger cannot make it hold megabytes in memory. The limit is 4096 bytes: a vote is
// about 100.

const URL = "https://most-likely-to.example/api/rooms/x/vote";

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request(URL, { method: "POST", body, headers: { "Content-Type": "application/json", ...headers } });
}

// A body sent in chunks with no Content-Length, as a client may stream it.
function streamed(body: string): Request {
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 1000) controller.enqueue(bytes.slice(i, i + 1000));
      controller.close();
    },
  });
  return new Request(URL, {
    method: "POST",
    body: stream,
    headers: { "Content-Type": "application/json" },
    duplex: "half",
  } as RequestInit);
}

// Valid JSON of exactly n bytes: {"pad":"xxx…"}.
function jsonOfBytes(n: number): string {
  return JSON.stringify({ pad: "x".repeat(n - '{"pad":""}'.length) });
}

async function refusal(answer: Awaited<ReturnType<typeof readJsonRequest>>): Promise<unknown> {
  if (answer.ok) return "accepted";
  const body: unknown = await answer.response.json();
  return { status: answer.response.status, body };
}

describe("readJsonRequest", () => {
  it("accepts a vote's JSON body", async () => {
    const answer = await readJsonRequest(post('{"target":"Ola","round":2}'), "vote");

    expect(answer).toEqual({ ok: true, body: { target: "Ola", round: 2 } });
  });

  it("refuses a declared Content-Length over the limit without reading the body", async () => {
    const request = post('{"target":"Ola"}', { "Content-Length": "5000" });

    const answer = await readJsonRequest(request, "vote");

    expect(await refusal(answer)).toEqual({ status: 400, body: { error: "invalid_body" } });
    expect(request.bodyUsed).toBe(false);
  });

  it("refuses a Content-Length that is not a number without reading the body", async () => {
    const request = post('{"target":"Ola"}', { "Content-Length": "12abc" });

    const answer = await readJsonRequest(request, "vote");

    expect(await refusal(answer)).toEqual({ status: 400, body: { error: "invalid_body" } });
    expect(request.bodyUsed).toBe(false);
  });

  it("refuses a 5000-byte body sent without Content-Length", async () => {
    const answer = await readJsonRequest(streamed(jsonOfBytes(5000)), "vote");

    expect(await refusal(answer)).toEqual({ status: 400, body: { error: "invalid_body" } });
  });

  it("accepts a body of exactly 4096 bytes and refuses one of 4097", async () => {
    const atLimit = await readJsonRequest(streamed(jsonOfBytes(4096)), "vote");
    const overLimit = await readJsonRequest(streamed(jsonOfBytes(4097)), "vote");

    expect(atLimit.ok).toBe(true);
    expect(await refusal(overLimit)).toEqual({ status: 400, body: { error: "invalid_body" } });
  });

  // Bytes, not characters: 1400 emoji are 1400 characters in JSON.parse's eyes but 5600 bytes on the wire.
  it("counts the limit in bytes", async () => {
    const answer = await readJsonRequest(streamed(JSON.stringify({ target: "🎉".repeat(1400) })), "vote");

    expect(await refusal(answer)).toEqual({ status: 400, body: { error: "invalid_body" } });
  });

  it("refuses a body that is not JSON", async () => {
    const answer = await readJsonRequest(post("target=Ola"), "vote");

    expect(await refusal(answer)).toEqual({ status: 400, body: { error: "invalid_body" } });
  });
});

// T1 of context/archive/2026-10-15-full-game-evening/research.md and F2 of
// context/archive/2026-10-20-deferred-review-fixes/plan.md: a vote, "Odsłoń wynik", "Następne pytanie" and "Pomiń
// pytanie" carry the number of the question on the screen. A body without one, or with anything else in its place, is
// not our screen.
describe("bodyRound", () => {
  it.each([
    { body: { round: 1 }, round: 1 },
    { body: { target: "Ola", round: 12 }, round: 12 },
    // The largest number a Postgres integer holds (p_round).
    { body: { round: 2_147_483_647 }, round: 2_147_483_647 },
  ])("reads the question's number from $body", ({ body, round }) => {
    expect(bodyRound(body)).toBe(round);
  });

  it.each([{ body: { target: "Ola" } }, { body: {} }, { body: null }, { body: [] }, { body: "round" }])(
    "gives undefined when $body has no round",
    ({ body }) => {
      expect(bodyRound(body)).toBeUndefined();
    },
  );

  it.each([
    { round: 0 },
    { round: -1 },
    { round: 1.5 },
    { round: "2" },
    { round: null },
    // One past a Postgres integer: the database would fail the call instead of refusing it (F1 of
    // context/archive/2026-10-15-full-game-evening/reviews/impl-review.md).
    { round: 2_147_483_648 },
    { round: Number.MAX_SAFE_INTEGER + 1 },
    { round: Number.NaN },
  ])("gives undefined for the round $round", (body) => {
    expect(bodyRound(body)).toBeUndefined();
  });
});

// The host's "Wpuść" and "Odrzuć" ({nick}; context/changes/latecomer-admission/plan.md, Faza 2 #6): the nick as a text,
// as it stands on the host's list; anything else is not our screen's body (invalid_body).
describe("bodyNick", () => {
  it.each([
    { body: { nick: "Kuba" }, nick: "Kuba" },
    { body: { nick: "Kasia 🎉", round: 2 }, nick: "Kasia 🎉" },
  ])("reads the nick from $body", ({ body, nick }) => {
    expect(bodyNick(body)).toBe(nick);
  });

  it.each([
    { body: { target: "Kuba" } },
    { body: {} },
    { body: null },
    { body: [] },
    { body: "Kuba" },
    { body: { nick: null } },
    { body: { nick: 1 } },
    { body: { nick: ["Kuba"] } },
  ])("gives undefined for $body", ({ body }) => {
    expect(bodyNick(body)).toBeUndefined();
  });
});
