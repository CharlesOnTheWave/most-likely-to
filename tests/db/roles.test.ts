import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, newHost, newLinkToken, newPlayerToken, type Host } from "./support/clients";
import {
  SEED_CATEGORIES,
  hostLobbyNicks,
  isRecord,
  readOwnRoom,
  seedGuest,
  seedRoom,
  type OwnRoom,
  type SeededGuest,
} from "./support/rooms";

// Roles (#4) through the attacker's door: REST/RPC with the publishable key, as anon and as signed-in hosts, past the
// Worker. Oracle: research.md §2 (H1–H8, G1–G3) and PRD Access Control (prd.md:156-175), never the migration's code.
//
// A refusal is a specific result, never "some error": 42501 for a missing grant or a failed `with check`. RLS `using`
// hides rows without an error, so a silent refusal is checked by its effect: read back by the owner or via room_link.
//
// Known holes (F1, fixed by S-02) are test.fails with the oracle's expectation. test.fails passes on any failure, a
// crashed seed or a network error too, so: preconditions live in beforeAll (a failed beforeAll stays red; beforeEach and
// afterEach run inside the test, so never use them here); the attack only collects results (supabase-js returns
// { data, error } and does not throw) and skips steps whose input is missing; a failed closing read returns early, so
// the test passes and shows red; the closing expect is the only thing that can fail.
//
// Six sign-ups per run, all in beforeAll: sign-ups and sign-ins share 30 per 5 minutes with the other db files.

const anon = anonClient();

// Look the same, differ in code points: "Ola" and "Ola" + ZERO WIDTH SPACE (research.md §3.1). Invisible characters
// only as escapes.
const OLA = "Ola";
const OLA_ZWSP = "Ola\u{200B}";

// Narrowing that never throws, for test.fails bodies.
function firstId(rows: unknown): string | null {
  const row: unknown = Array.isArray(rows) ? rows[0] : null;
  return isRecord(row) && typeof row.id === "string" ? row.id : null;
}

function nicksOf(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  return (rows as unknown[]).flatMap((row) => (isRecord(row) && typeof row.nick === "string" ? [row.nick] : []));
}

describe("role guards: hosts and guests stay inside their roles", () => {
  let hostA: Host;
  let hostB: Host;
  let roomA: OwnRoom;
  let roomB: OwnRoom;
  let guestA: SeededGuest;

  beforeAll(async () => {
    [hostA, hostB] = await Promise.all([newHost(), newHost()]);
    [roomA, roomB] = await Promise.all([seedRoom(hostA, { nick: "Ana" }), seedRoom(hostB, { nick: "Bartek" })]);
    // A guest in room A, so there is something to leak: A's players and a token hash.
    guestA = await seedGuest(roomA.linkToken, OLA);
  });

  // Positive control: an allowed read must work, or a wrong address or a missing session would look like a refusal.
  it("positive control: host A reads its own room", async () => {
    const result = await hostA.client.from("rooms").select("id").eq("id", roomA.id);
    const rows: unknown = result.data;

    expect(rows).toEqual([{ id: roomA.id }]);
  });

  // A host owns its own games (prd.md:159) and nobody else's. A failed request gives null, not [], so it cannot pass.
  describe("H6: host B against host A's room", () => {
    it("selecting A's room returns no rows", async () => {
      const result = await hostB.client.from("rooms").select("id").eq("id", roomA.id);
      const rows: unknown = result.data;

      expect(rows).toEqual([]);
    });

    it("selecting A's players returns no rows", async () => {
      const result = await hostB.client.from("players").select("id").eq("room_id", roomA.id);
      const rows: unknown = result.data;

      expect(rows).toEqual([]);
    });

    // An update that matches no visible row is not an error, so the owner reads the status back.
    it("updating A's room status leaves it unchanged", async () => {
      await hostB.client.from("rooms").update({ status: "closed" }).eq("id", roomA.id);
      const room = await readOwnRoom(hostA, roomA.id);

      expect(room.status).toBe("lobby");
    });

    it("inserting a player into A's room gets 42501 and A's lobby is unchanged", async () => {
      const before = await hostLobbyNicks(hostA, roomA.id);
      const result = await hostB.client
        .from("players")
        .insert({ room_id: roomA.id, nick: "Bartek", user_id: hostB.userId, seat: 99 });
      const after = await hostLobbyNicks(hostA, roomA.id);

      expect(result.error?.code).toBe("42501");
      expect(after).toEqual(before);
    });
  });

  // A readable hash could vote for a guest in S-02 (FR-011). No grant at all: the hash never leaves the database.
  it("H7: a host reading player_secrets gets 42501", async () => {
    const result = await hostA.client.from("player_secrets").select("*");
    const data: unknown = result.data;

    expect(result.error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  // A guest comes in only through join_room and its nick rule; this fake one carries a look-alike of the guest "Ola".
  // Host B's own room: if H6's update ever got through, room A would be closed and refuse this insert for another reason.
  it("H8: a host inserting a guest (user_id null) into its own room gets 42501", async () => {
    const result = await hostB.client
      .from("players")
      .insert({ room_id: roomB.id, nick: OLA_ZWSP, user_id: null, seat: 99 });

    expect(result.error?.code).toBe("42501");
  });

  // A room opens only as a lobby (research.md §2, H8). Host B already has an open room; a closed one does not clash
  // with the one-open-room rule, so only the room rule itself can refuse.
  it("H8: a host inserting a room that is already closed gets 42501", async () => {
    const result = await hostB.client
      .from("rooms")
      .insert({ host_id: hostB.userId, link_token: newLinkToken(), categories: SEED_CATEGORIES, status: "closed" });

    expect(result.error?.code).toBe("42501");
  });

  // A guest reaches the tables only through the definer functions (prd.md:161). No grant: 42501 (HTTP 401). No
  // player_secrets row here: the canary owns that one.
  const anonTableAttempts = [
    { verb: "select", table: "rooms", attempt: () => anon.from("rooms").select("id") },
    {
      verb: "insert",
      table: "rooms",
      attempt: () =>
        anon.from("rooms").insert({ host_id: hostA.userId, link_token: newLinkToken(), categories: SEED_CATEGORIES }),
    },
    { verb: "select", table: "players", attempt: () => anon.from("players").select("id") },
    {
      verb: "insert",
      table: "players",
      attempt: () => anon.from("players").insert({ room_id: roomA.id, nick: "Zosia", seat: 99 }),
    },
  ];

  it.each(anonTableAttempts)("G1: anon $verb on $table gets 42501", async ({ attempt }) => {
    const result = await attempt();

    expect(result.error?.code).toBe("42501");
  });

  // Only a signed-in host opens a room (prd.md:162,167). The function's name is checked, not only 42501: create_room
  // runs as its caller and starts with the nick rule in schema private, which anon cannot use either, so a create_room
  // granted to anon would still answer 42501, as "permission denied for function normalize_nick" (the phase 2
  // break-check).
  it("G2: anon calling create_room is refused permission on the function", async () => {
    const result = await anon.rpc("create_room", {
      p_nick: "Host",
      p_link_token: newLinkToken(),
      p_categories: SEED_CATEGORIES,
      p_adult_categories: [],
      p_confirm_close: false,
    });

    expect(result.error?.code).toBe("42501");
    expect(result.error?.message).toContain("function create_room");
  });

  // A guest's identity lives in its token (prd.md:161): the token opens its own room's lobby and no other. A failed
  // call also gives null data, so the null cases check that the call itself succeeded.
  describe("G3: room_lobby and the guest's token from room A", () => {
    it("positive control: in room A, me is the guest's nick", async () => {
      const result = await anon.rpc("room_lobby", { p_room_id: roomA.id, p_player_token: guestA.playerToken });
      const lobby: unknown = result.data;

      expect(lobby).toMatchObject({ me: OLA });
    });

    it("in room B, the guest's token gets null", async () => {
      const result = await anon.rpc("room_lobby", { p_room_id: roomB.id, p_player_token: guestA.playerToken });
      const lobby: unknown = result.data;

      expect(result.error).toBeNull();
      expect(lobby).toBeNull();
    });

    it.each([
      { label: "a random token", token: newPlayerToken() },
      { label: "no token", token: null },
    ])("in room A, $label gets null", async ({ token }) => {
      const result = await anon.rpc("room_lobby", { p_room_id: roomA.id, p_player_token: token });
      const lobby: unknown = result.data;

      expect(result.error).toBeNull();
      expect(lobby).toBeNull();
    });
  });
});

// Each test fails today and must pass once S-02 closes F1; then test.fails turns it red and the marker comes off.
describe("known holes F1: expected failures until S-02", () => {
  // Oracle: a closed room is final (F1 triage, roadmap S-02; the game says "Poproś hosta o nowy link.").
  describe("H1: a closed room stays closed", () => {
    let host: Host;
    let closedRoom: OwnRoom;
    let openRoom: OwnRoom;

    beforeAll(async () => {
      host = await newHost();
      closedRoom = await seedRoom(host);
      openRoom = await seedRoom(host, { confirmClose: true });
      if ((await readOwnRoom(host, closedRoom.id)).status !== "closed") {
        throw new Error("precondition failed: opening the second room did not close the first one");
      }
    });

    it.fails("znana dziura F1 → S-02: the host cannot reopen a closed room over REST", async () => {
      // One open room per host, so the open one closes first. The reopen runs either way: a fix may refuse either step.
      await host.client.from("rooms").update({ status: "closed" }).eq("id", openRoom.id);
      await host.client.from("rooms").update({ status: "lobby" }).eq("id", closedRoom.id);
      const link = await anon.rpc("room_link", { p_link_token: closedRoom.linkToken });
      // A failed read is not the expected failure: returning passes the test, and test.fails shows it red.
      if (link.error !== null) return;
      const data: unknown = link.data;

      expect(data).toMatchObject({ status: "closed" });
    });
  });

  // Oracle: the link code is not the host's choice (F1 triage; a known link lets strangers in, FR-002, FR-004). Checked
  // by effect, so it stays true after a fix where create_room loses the parameter and the call errors.
  describe("H2: the host cannot pick the link code", () => {
    let viaFunction: Host;
    // No room of its own: one open room per host would refuse the insert for another reason.
    let viaInsert: Host;

    beforeAll(async () => {
      [viaFunction, viaInsert] = await Promise.all([newHost(), newHost()]);
    });

    it.fails("znana dziura F1 → S-02: create_room does not take a link code the host picked", async () => {
      const picked = newLinkToken();
      await viaFunction.client.rpc("create_room", {
        p_nick: "Host",
        p_link_token: picked,
        p_categories: SEED_CATEGORIES,
        p_adult_categories: [],
        p_confirm_close: false,
      });
      const link = await anon.rpc("room_link", { p_link_token: picked });
      if (link.error !== null) return;
      const data: unknown = link.data;

      expect(data).toMatchObject({ status: "unknown" });
    });

    it.fails("znana dziura F1 → S-02: an insert into rooms does not take a link code the host picked", async () => {
      const picked = newLinkToken();
      await viaInsert.client
        .from("rooms")
        .insert({ host_id: viaInsert.userId, link_token: picked, categories: SEED_CATEGORIES });
      const link = await anon.rpc("room_link", { p_link_token: picked });
      if (link.error !== null) return;
      const data: unknown = link.data;

      expect(data).toMatchObject({ status: "unknown" });
    });
  });

  // Oracle: what looks the same is the same nick (S-01 rule, the pair from research.md §3.1), the host's nick included.
  describe("H3: the host's nick follows the nick rule", () => {
    // No room of its own: the attack opens one by insert.
    let host: Host;

    beforeAll(async () => {
      host = await newHost();
    });

    it.fails("znana dziura F1 → S-02: a host cannot store a nick that skips the nick rule", async () => {
      const linkToken = newLinkToken();
      const room = await host.client
        .from("rooms")
        .insert({ host_id: host.userId, link_token: linkToken, categories: SEED_CATEGORIES })
        .select("id");
      const roomId = firstId(room.data);

      // No room (a fix refused the insert): nothing to join and no nicks, which is the oracle's outcome too.
      let nicks: string[] = [];
      if (roomId !== null) {
        await host.client.from("players").insert({ room_id: roomId, nick: OLA_ZWSP, user_id: host.userId, seat: 1 });
        await anon.rpc("join_room", { p_link_token: linkToken, p_nick: OLA, p_player_token: newPlayerToken() });
        const players = await host.client.from("players").select("nick").eq("room_id", roomId);
        nicks = nicksOf(players.data);
      }
      const lookAlikes = nicks.filter((nick) => nick === OLA || nick === OLA_ZWSP);

      expect(lookAlikes.length).toBeLessThanOrEqual(1);
    });
  });
});
