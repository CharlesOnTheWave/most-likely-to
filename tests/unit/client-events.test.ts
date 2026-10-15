import { describe, expect, it } from "vitest";
import { parseClientEvent } from "@/lib/client-events";

// A player's screen reports a broken live connection, a failed refresh or a crashed island (decision D4; audit L1, L2,
// L4). The endpoint is public, so its input is narrow: only the listed events and states and a room id, nothing else,
// because anything free-form could carry a nick or a vote into the log (test-plan #1). Oracle: the lists in
// context/archive/2026-10-13-first-live-round/plan.md, Faza 3 #8, written out by hand.
const ROOM_ID = "3f2b8c1e-7a4d-4e9b-9c2a-5d6e7f8a9b0c";
const EVENTS = ["realtime_status", "refresh_failed", "island_crash"];
const STATES = ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED", "http_4xx", "http_5xx", "network"];

describe("parseClientEvent", () => {
  it.each(EVENTS)("accepts the event %s alone", (event) => {
    expect(parseClientEvent({ event })).toEqual({ ok: true, value: { event } });
  });

  it.each(STATES)("accepts the state %s with its room", (state) => {
    const report = { event: "realtime_status", state, roomId: ROOM_ID };

    expect(parseClientEvent(report)).toEqual({ ok: true, value: report });
  });

  it("accepts a report with a room and no state", () => {
    expect(parseClientEvent({ event: "island_crash", roomId: ROOM_ID })).toEqual({
      ok: true,
      value: { event: "island_crash", roomId: ROOM_ID },
    });
  });

  // Objects, not bare values: it.each would spread an array into the test's arguments.
  it.each([{ value: null }, { value: [] }, { value: "island_crash" }, { value: 1 }])(
    "names the root for $value",
    ({ value }) => {
      expect(parseClientEvent(value)).toEqual({ ok: false, field: "root" });
    },
  );

  it.each([undefined, "unknown", "", null, 1, "REALTIME_STATUS", "constructor"])("refuses the event %j", (event) => {
    expect(parseClientEvent({ event })).toEqual({ ok: false, field: "event" });
  });

  it("refuses a report without an event", () => {
    expect(parseClientEvent({ state: "CLOSED", roomId: ROOM_ID })).toEqual({ ok: false, field: "event" });
  });

  it.each(["SUBSCRIBED", "http_200", "", null, 1, "closed", "constructor"])("refuses the state %j", (state) => {
    expect(parseClientEvent({ event: "realtime_status", state })).toEqual({ ok: false, field: "state" });
  });

  it.each([ROOM_ID.toUpperCase(), "not-a-uuid", "", null, 123, `${ROOM_ID}\n`, `${ROOM_ID}0`, `../${ROOM_ID}`])(
    "refuses the room id %j",
    (roomId) => {
      expect(parseClientEvent({ event: "island_crash", roomId })).toEqual({ ok: false, field: "roomId" });
    },
  );

  // An extra key is refused whole; the answer never names it, since the name itself comes from the request.
  it.each([
    { why: "a nick", report: { event: "island_crash", nick: "Ola" } },
    { why: "a message", report: { event: "refresh_failed", state: "network", message: "TypeError: Ola" } },
    { why: "a URL", report: { event: "island_crash", url: "https://example.test/j/code" } },
    { why: "a vote's target", report: { event: "realtime_status", state: "CLOSED", target: "Ola" } },
    { why: "an error name", report: { event: "island_crash", errName: "TypeError" } },
    { why: "__proto__ from JSON", report: JSON.parse('{"event":"island_crash","__proto__":{}}') as unknown },
  ])("refuses a report with $why", ({ report }) => {
    expect(parseClientEvent(report)).toEqual({ ok: false, field: "keys" });
  });
});
