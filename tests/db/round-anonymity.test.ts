import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, newHost, type Host, type TestClient } from "./support/clients";
import { isRecord, readOwnRoom, seedGuest, seedRoom, type OwnRoom, type SeededGuest } from "./support/rooms";
import {
  LOBBY_KEYS,
  PLAYER_KEYS,
  RESULT_KEYS,
  REVEALED_ROUND_KEYS,
  VOTING_ROUND_KEYS,
  castVote,
  keysOf,
  roomLink,
  roomLobby,
  roundOf,
  seedReveal,
  seedStartGame,
  seedVote,
  type Answer,
} from "./support/rounds";

// Anonymity (#1) through the roles' own doors: RPC and REST with the publishable key, as guests and as the signed-in
// host. No role gets a voter next to a target, or any count before the reveal, and a round that ends without a reveal
// leaves nothing to read. Oracle: PRD Non-Goals and the anonymity NFR (nobody, the host and the game's creator
// included, can tell who voted for whom), AGENTS.md Hard Rules and decision D1 of
// context/changes/first-live-round/research.md (the urn that disappears). What the creator sees as the database owner
// is supabase/tests/round_creator_view.test.sql's to check (pgTAP).
//
// Exact key sets, not "the fields we know of": a new key in an answer is how a pair or an early count would leak
// (test-plan §2, #1: never only the table's columns).
//
// Until phase 2 adds the round functions, the suites that start a round in beforeAll are red as a whole (PGRST202, no
// such function). The private-schema guard starts no round and is green from day one.
//
// One sign-up per run. One open room per host, so the rooms come one after another (confirm_close closes the one
// before); Vitest runs the suites in order, each suite's beforeAll right before its tests.

const anon = anonClient();
let host: Host;

beforeAll(async () => {
  host = await newHost();
});

const ROUND_TABLES = ["rounds", "round_results", "ballot_boxes", "round_voters"];

// The round's tables live in schema private, which the API does not expose (supabase/config.toml: public and
// graphql_public). This guard keeps it that way: a migration that exposed private, or put one of these tables or a
// view of it in public, turns it red. Green from day one: it needs no round.
describe("the round's tables are out of the API's reach", () => {
  const doors = ROUND_TABLES.flatMap((table) => [
    { role: "anon", table, client: (): TestClient => anon },
    { role: "the host", table, client: (): TestClient => host.client },
  ]);

  // PGRST106: the schema is not one the API serves.
  it.each(doors)("$role reading private.$table gets PGRST106 and no rows", async ({ table, client }) => {
    const result = await client().schema("private").from(table).select("*");
    const data: unknown = result.data;

    expect(result.error?.code).toBe("PGRST106");
    expect(data).toBeNull();
  });

  // PGRST205: no such table in the exposed schemas.
  it.each(doors)("$role reading $table without a schema gets PGRST205 and no rows", async ({ table, client }) => {
    const result = await client().from(table).select("*");
    const data: unknown = result.data;

    expect(result.error?.code).toBe("PGRST205");
    expect(data).toBeNull();
  });
});

// While the round is open, who voted is public (FR-009) and how is nobody's. Kuba (seat 4) votes before the host
// (seat 1): the list of who voted must not keep that order, or it would tell the order of voting.
describe("a round in progress shows who voted, never how", () => {
  let room: OwnRoom;
  let ola: SeededGuest;
  let kubaVote: Answer;
  let kubaAgain: Answer;
  let hostVote: Answer;
  let olaView: Answer;
  let kubaView: Answer;
  let hostView: Answer;

  beforeAll(async () => {
    room = await seedRoom(host);
    ola = await seedGuest(room.linkToken, "Ola");
    await seedGuest(room.linkToken, "Bartek");
    const kuba = await seedGuest(room.linkToken, "Kuba");
    await seedStartGame(host, room.id);

    kubaVote = await castVote(anon, room.id, "Ola", kuba.playerToken);
    kubaAgain = await castVote(anon, room.id, "Bartek", kuba.playerToken);
    hostVote = await castVote(host.client, room.id, "Ola");
    // Two of four have voted: the round stays open.
    olaView = await roomLobby(anon, room.id, ola.playerToken);
    kubaView = await roomLobby(anon, room.id, kuba.playerToken);
    hostView = await roomLobby(host.client, room.id);
  });

  const viewers = [
    { viewer: "a guest who has not voted", meVoted: false, lobby: () => olaView },
    { viewer: "a guest who voted", meVoted: true, lobby: () => kubaView },
    { viewer: "the host", meVoted: true, lobby: () => hostView },
  ];

  // The only test that checks the whole answer of an accepted vote (plan, Faza 5, break-check b): no target, no count.
  it("cast_vote answers exactly { ok: true }, to a guest and to the host", () => {
    expect(kubaVote).toEqual({ data: { ok: true }, error: null });
    expect(hostVote).toEqual({ data: { ok: true }, error: null });
  });

  // A refusal raised as an error would carry Postgres DETAIL (a row's values) in error.details: the refusal is data.
  it("a refused second vote answers exactly { ok: false, reason: already_voted }, no error to carry details", () => {
    expect(kubaAgain).toEqual({ data: { ok: false, reason: "already_voted" }, error: null });
  });

  it.each(viewers)("$viewer sees exactly the voting keys and no count", ({ lobby }) => {
    expect(keysOf(roundOf(lobby()))).toEqual(VOTING_ROUND_KEYS);
  });

  it.each(viewers)("$viewer sees who voted in seat order and whether they voted", ({ meVoted, lobby }) => {
    expect(roundOf(lobby())).toMatchObject({ phase: "voting", voted: ["Host", "Kuba"], me_voted: meVoted });
  });

  // room_lobby keeps the fields of S-01 and adds only round: no per-player flag or count beside a nick.
  it.each(viewers)("$viewer's lobby has only its old keys plus round, and players only nick and host", ({ lobby }) => {
    const data = lobby().data;
    const players: unknown = isRecord(data) ? data.players : null;
    const playerKeys = Array.isArray(players) ? (players as unknown[]).map(keysOf) : [];

    expect(keysOf(data)).toEqual(LOBBY_KEYS);
    expect(playerKeys).toEqual([PLAYER_KEYS, PLAYER_KEYS, PLAYER_KEYS, PLAYER_KEYS]);
  });

  // After the reveal, counts per nick and nothing more (D1: only the counts stay).
  describe("after the reveal", () => {
    let olaRevealView: Answer;
    let hostRevealView: Answer;

    beforeAll(async () => {
      await seedReveal(host, room.id);
      olaRevealView = await roomLobby(anon, room.id, ola.playerToken);
      hostRevealView = await roomLobby(host.client, room.id);
    });

    it.each([
      { viewer: "a guest", lobby: () => olaRevealView },
      { viewer: "the host", lobby: () => hostRevealView },
    ])("$viewer sees exactly the reveal keys, and each result is exactly nick and votes", ({ lobby }) => {
      const round = roundOf(lobby());
      const results: unknown = round?.results;
      const resultKeys = Array.isArray(results) ? (results as unknown[]).map(keysOf) : [];

      expect(keysOf(round)).toEqual(REVEALED_ROUND_KEYS);
      expect(resultKeys).toEqual([RESULT_KEYS, RESULT_KEYS, RESULT_KEYS, RESULT_KEYS]);
    });
  });
});

// D1: a round that ends without a reveal ("Nowa gra" mid-round) leaves no counts and no voters behind.
describe("a room closed mid-round keeps nothing of the round", () => {
  let room: OwnRoom;
  let olaToken: string;

  beforeAll(async () => {
    // Closes the room of the round above.
    room = await seedRoom(host, { confirmClose: true });
    const ola = await seedGuest(room.linkToken, "Ola");
    const bartek = await seedGuest(room.linkToken, "Bartek");
    olaToken = ola.playerToken;
    await seedStartGame(host, room.id);
    await seedVote(anon, room.id, "Ola", bartek.playerToken);
    // "Nowa gra" with the "guests are still in it" question answered.
    await seedRoom(host, { confirmClose: true });
    if ((await readOwnRoom(host, room.id)).status !== "closed") {
      throw new Error("precondition failed: the new room did not close the room mid-round");
    }
  });

  it("the old room's link answers exactly { status: closed }", async () => {
    const answer = await roomLink(room.linkToken);

    expect(answer).toEqual({ data: { status: "closed" }, error: null });
  });

  // No reveal happened, so no counts may appear: not as a revealed round, not anywhere in the round.
  it.each([
    { viewer: "a guest", read: () => roomLobby(anon, room.id, olaToken) },
    { viewer: "the host", read: () => roomLobby(host.client, room.id) },
  ])("$viewer reading the old room sees it closed and no counts", async ({ read }) => {
    const answer = await read();
    const countKeys = keysOf(roundOf(answer)).filter((key) => ["abstained", "ballots", "results"].includes(key));

    expect(answer).toMatchObject({ error: null, data: { status: "closed" } });
    expect(countKeys).toEqual([]);
  });
});
