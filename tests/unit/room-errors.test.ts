import { describe, expect, it } from "vitest";
import { roomErrorMessage } from "@/lib/rooms/errors";

// Every refusal on a guest's way in (src/pages/api/rooms/join.ts) must say what went wrong. A code renamed on one side
// would leave the guest with the generic "something went wrong" (test-plan #6). The Polish texts are not copied here:
// the test checks that each refusal has its own text, not what the text says.
const GUEST_REFUSALS = ["invalid_nick", "nick_taken", "room_closed", "room_unknown", "service_unavailable"];

// Codes come from ?error= in the URL, so anything can arrive. "constructor" is on Object.prototype: a lookup that is
// not an own-property check would find it.
const UNKNOWN_CODES = ["no_such_code", "constructor"];

describe("roomErrorMessage", () => {
  const generic = roomErrorMessage(UNKNOWN_CODES[0]);

  it.each(UNKNOWN_CODES)("gives the unknown code %s the one generic text", (code) => {
    const message = roomErrorMessage(code);

    expect(message).toBeTypeOf("string");
    expect(message).not.toBe("");
    expect(message).toBe(generic);
  });

  it.each(GUEST_REFUSALS)("gives the guest refusal %s its own text, not the generic one", (code) => {
    const message = roomErrorMessage(code);

    expect(message).toBeTypeOf("string");
    expect(message).not.toBe(generic);
  });

  it("gives no text when there is no code", () => {
    expect(roomErrorMessage(null)).toBeNull();
  });
});
