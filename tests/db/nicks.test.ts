import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, newHost, newPlayerToken, type Host } from "./support/clients";
import { NICK_PAIRS, nickLabel } from "./support/nick-pairs";
import { hostLobbyNicks, seedGuest, seedRoom, type OwnRoom } from "./support/rooms";

// Nicks on the guest's way in (#6) through the guest's door: join_room as anon with the publishable key, past the
// Worker. Oracle: the pair table of research.md §3.1, kept in support/nick-pairs.ts (Unicode sources, S-01 decisions),
// never private.normalize_nick, which anon cannot call anyway. The table guards both ways: look-alikes get nick_taken
// and visibly different nicks join, so an over-eager fix in S-02 turns red too.
//
// Known holes (F4, fixed by S-02) are test.fails with the oracle's expectation. test.fails passes on any failure, a
// crashed seed or a network error too, so, as in roles.test.ts: preconditions (the host, a fresh room, the taken nick)
// live in beforeAll, whose helpers throw (a failed beforeAll stays red; beforeEach and afterEach run inside the test, so
// never use them here); a test sends one probe, collects { data, error } and never throws; in a known hole a failed
// call returns early, so the test passes and shows red; the closing expect is the only thing that can fail.
//
// One sign-up per run: one host opens every room in turn. One open room per host, so each new room (confirm_close)
// closes the one before. Vitest runs the suites in order, each suite's beforeAll right before its tests.

const KNOWN_HOLE_F4 = "znana dziura F4 → S-02: ";

const anon = anonClient();
let host: Host;

beforeAll(async () => {
  host = await newHost();
});

interface JoinAnswer {
  data: unknown;
  // Tells a refusal by the function (data, no error) from a failed call, e.g. a timeout on a very long nick.
  error: string | null;
}

// A guest on a new phone tries a nick, with a fresh player token like the Worker's cookie. Never throws: supabase-js
// returns { data, error }.
async function tryJoin(linkToken: string, nick: string): Promise<JoinAnswer> {
  const result = await anon.rpc("join_room", {
    p_link_token: linkToken,
    p_nick: nick,
    p_player_token: newPlayerToken(),
  });
  const data: unknown = result.data;
  return { data, error: result.error?.code ?? null };
}

const NICK_TAKEN = { error: null, data: { ok: false, reason: "nick_taken" } };
const INVALID_NICK = { error: null, data: { ok: false, reason: "invalid_nick" } };

function joined(room: OwnRoom) {
  return { error: null, data: { ok: true, room_id: room.id } };
}

// Each pair in a room of its own, so a probe that got in (a known hole today) cannot change the next pair. The test
// name shows the code points, so the log reads like the research table; the number matches print-nick-pairs.ts.
describe("nick pairs: what looks the same is the same nick (research.md §3.1)", () => {
  for (const [index, pair] of NICK_PAIRS.entries()) {
    describe(`pair ${index + 1}`, () => {
      let room: OwnRoom;

      // The taken nick comes in through the same door; seedGuest throws when the room refuses it.
      beforeAll(async () => {
        room = await seedRoom(host, { confirmClose: true });
        await seedGuest(room.linkToken, pair.taken);
      });

      const outcome = pair.expected === "joins" ? "joins" : "is nick_taken";
      const name = `${nickLabel(pair.probe)} against ${nickLabel(pair.taken)} ${outcome}`;
      const probe = async () => {
        const answer = await tryJoin(room.linkToken, pair.probe);
        // A failed call is not the expected failure: returning passes the test, and test.fails shows it red.
        if (pair.knownHole && answer.error !== null) return;

        expect(answer).toMatchObject(pair.expected === "joins" ? joined(room) : NICK_TAKEN);
      };

      if (pair.knownHole) {
        it.fails(`${KNOWN_HOLE_F4}${name}`, probe);
      } else {
        it(name, probe);
      }
    });
  }
});

// A nick that is too long, however long, gets the clear refusal invalid_nick, not the generic error (test-plan §2, #6).
// The limit is S-01's "1–20 characters" (the guest reads "Nick musi mieć od 1 do 20 znaków."), checked on plain
// letters. Where a fix of F4 cuts a long text before the nick rule is its own detail and is not pinned here.
describe("length and blank nicks: a clear invalid_nick", () => {
  const TWENTY_LETTERS = "a".repeat(20);
  let room: OwnRoom;

  beforeAll(async () => {
    room = await seedRoom(host, { confirmClose: true });
  });

  // Positive control: an allowed join must work, or a wrong address would look like a refusal everywhere in this file.
  it("positive control: 20 plain letters join and the host's lobby lists them", async () => {
    const answer = await tryJoin(room.linkToken, TWENTY_LETTERS);
    const nicks = await hostLobbyNicks(host, room.id);

    expect(answer).toMatchObject(joined(room));
    expect(nicks).toContain(TWENTY_LETTERS);
  });

  it("21 plain letters get invalid_nick", async () => {
    const answer = await tryJoin(room.linkToken, "a".repeat(21));

    expect(answer).toMatchObject(INVALID_NICK);
  });

  // Today the whole text goes through the nick rule first (F4: no limit before it); the guest must still get the clear
  // refusal, not a failed call.
  it("10 000 plain letters get invalid_nick", async () => {
    const answer = await tryJoin(room.linkToken, "a".repeat(10_000));

    expect(answer).toMatchObject(INVALID_NICK);
  });

  // Looks empty: nothing, SPACE and IDEOGRAPHIC SPACE (White_Space), ZERO WIDTH SPACE (Default_Ignorable).
  it.each(["", "\u{20}", "\u{200B}", "\u{3000}"].map((nick) => ({ label: nickLabel(nick), nick })))(
    "$label looks empty and gets invalid_nick",
    async ({ nick }) => {
      const answer = await tryJoin(room.linkToken, nick);

      expect(answer).toMatchObject(INVALID_NICK);
    },
  );
});
