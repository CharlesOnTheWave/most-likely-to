import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, newHost, newPlayerToken, type Host } from "./support/clients";
import {
  hostLobbyNicks,
  isRecord,
  readOwnRoom,
  seedGuest,
  seedRoom,
  type OwnRoom,
  type SeededGuest,
} from "./support/rooms";
import {
  EVENING_QUESTION_IDS,
  GAME_TOTALS_KEYS,
  LOBBY_KEYS,
  RESULT_KEYS,
  admitLatecomer,
  endGame,
  keysOf,
  requestJoin,
  roomLobby,
  seedNextRound,
  seedSkipRound,
  seedStartGame,
  seedVote,
  type Answer,
} from "./support/rounds";

// The game's summary (S-15) in the room's state, through the roles' own doors: RPC with the publishable key, as the
// room's guests, as a latecomer let in mid-game and as the signed-in host, past the Worker. Oracle: PRD FR-022 (the end
// of the game may show highlights of the whole game, such as the most votes tonight or nobody voted for X, with no
// points and no ranking across evenings) and Karol's decisions written in context/changes/game-summary/plan.md: only
// revealed rounds count, so a skipped round and a round ended without a reveal give nobody votes and are not counted
// among the revealed questions; a player is in the sums once they had a result in a revealed round, zeros included, so
// a latecomer who could vote in no revealed round is not; the sums appear only once the room is closed, the same whichever way
// it closed ("Zakończ grę" or "Nowa gra"), and the same for the host and every guest. Each round's votes and counts and
// every sum expected here are written out by hand from the scenario, never computed.
//
// room_lobby's game_totals comes from supabase/migrations/*_game_summary.sql. Without it no answer here has the key, so
// every test that reads it is red, a null one included (toMatchObject fails on a missing key).
//
// One sign-up per run, in beforeAll. One open room per host, so the rooms come one after another (confirm_close closes
// the one before); Vitest runs the suites in order, each suite's beforeAll right before its tests.

const anon = anonClient();
const [Q1, Q2, Q3, Q4] = EVENING_QUESTION_IDS;
// The whole pool, as the Worker would send it at any point of this file's games.
const POOL = [Q1, Q2, Q3, Q4];

let host: Host;

beforeAll(async () => {
  host = await newHost();
});

// game_totals of a room_lobby answer; undefined when the answer has no such key (a failed call included). Never throws.
function gameTotalsOf(answer: Answer): unknown {
  return isRecord(answer.data) ? answer.data.game_totals : undefined;
}

// The entries of game_totals.totals; [] for anything else. Never throws.
function totalsOf(answer: Answer): unknown[] {
  const gameTotals = gameTotalsOf(answer);
  const totals: unknown = isRecord(gameTotals) ? gameTotals.totals : null;
  return Array.isArray(totals) ? (totals as unknown[]) : [];
}

// The game plays out once, in order, in beforeAll. Each kept answer is checked by its own test, so no test depends on
// another one having run.
//
// The oracle, seats Host 1, Ola 2, Bartek 3, Kuba 4 (let in while round 2 is voting):
//   round 1, Q1, revealed (Host, Ola and Bartek may vote): Ola for Bartek, Bartek for Bartek, the host abstains, which
//     is the third vote of three and reveals the round: Host 0, Ola 0, Bartek 2;
//   round 2, Q2, revealed (Host, Ola and Bartek: Kuba came in after it opened): the host for Ola, Bartek for Ola, Ola
//     for Bartek, the third vote revealing it: Host 0, Ola 2, Bartek 1, and no result for Kuba;
//   round 3, Q3, skipped (all four may vote): Ola and Kuba vote for the host; counted, they would give the host 2;
//   round 4, Q4, ended by "Zakończ grę" while voting (all four may vote): Bartek votes for Kuba and Kuba for Ola;
//     counted, they would give Kuba 1 and Ola 3.
// Sums of the two reveals: Host 0 + 0 = 0, Ola 0 + 2 = 2, Bartek 2 + 1 = 3; Kuba has no result in a revealed round, so
// is not there; 2 revealed rounds of the 4 played.
describe("a game: two reveals, a skip, a latecomer and Zakończ grę mid-round", () => {
  let room: OwnRoom;
  let ola: SeededGuest;
  let bartek: SeededGuest;
  // Kuba's token, as the cookie of this room would keep it.
  const kuba = newPlayerToken();
  let olaLobbyView: Answer;
  let hostLobbyView: Answer;
  let olaRound1View: Answer;
  let hostRound1View: Answer;
  let hostRound2View: Answer;
  let endWhileVoting: Answer;
  let olaEndView: Answer;
  let kubaEndView: Answer;
  let hostEndView: Answer;

  beforeAll(async () => {
    room = await seedRoom(host);
    ola = await seedGuest(room.linkToken, "Ola");
    bartek = await seedGuest(room.linkToken, "Bartek");
    olaLobbyView = await roomLobby(anon, room.id, ola.playerToken);
    hostLobbyView = await roomLobby(host.client, room.id);

    // Round 1.
    await seedStartGame(host, room.id, Q1);
    await seedVote(anon, room.id, "Bartek", ola.playerToken, 1);
    await seedVote(anon, room.id, "Bartek", bartek.playerToken, 1);
    await seedVote(host.client, room.id, null, undefined, 1);
    olaRound1View = await roomLobby(anon, room.id, ola.playerToken);
    hostRound1View = await roomLobby(host.client, room.id);

    // Round 2: Q1 was played, so Q2 comes up. Kuba asks and is let in before anyone votes in it.
    await seedNextRound(host, room.id, 1, POOL);
    await requestJoin(room.linkToken, "Kuba", kuba);
    await admitLatecomer(host.client, room.id, "Kuba");
    const nicks = await hostLobbyNicks(host, room.id);
    if (nicks.join() !== ["Host", "Ola", "Bartek", "Kuba"].join()) {
      throw new Error("precondition failed: Wpuść did not make Kuba the player at seat 4");
    }
    await seedVote(host.client, room.id, "Ola", undefined, 2);
    await seedVote(anon, room.id, "Ola", bartek.playerToken, 2);
    await seedVote(anon, room.id, "Bartek", ola.playerToken, 2);
    hostRound2View = await roomLobby(host.client, room.id);

    // Round 3: Q3, with Kuba among those who may vote. Two votes for the host, then the skip; Q4 comes up as round 4.
    await seedNextRound(host, room.id, 2, POOL);
    await seedVote(anon, room.id, "Host", ola.playerToken, 3);
    await seedVote(anon, room.id, "Host", kuba, 3);
    await seedSkipRound(host, room.id, 3, POOL);

    // Round 4: a vote for Kuba and one of his, then "Zakończ grę" with two of four votes in.
    await seedVote(anon, room.id, "Kuba", bartek.playerToken, 4);
    await seedVote(anon, room.id, "Ola", kuba, 4);
    endWhileVoting = await endGame(host.client, room.id);
    if ((await readOwnRoom(host, room.id)).status !== "closed") {
      throw new Error("precondition failed: end_game did not close the room mid-round");
    }
    olaEndView = await roomLobby(anon, room.id, ola.playerToken);
    kubaEndView = await roomLobby(anon, room.id, kuba);
    hostEndView = await roomLobby(host.client, room.id);
  });

  it.each([
    { viewer: "a guest", lobby: () => olaLobbyView },
    { viewer: "the host", lobby: () => hostLobbyView },
  ])("in the lobby $viewer sees game_totals: null", ({ lobby }) => {
    expect(lobby()).toMatchObject({ error: null, data: { status: "lobby", game_totals: null } });
  });

  // A revealed round in a game in play: the sums wait for the end, though round 1's counts are on every screen.
  it.each([
    { viewer: "a guest", lobby: () => olaRound1View },
    { viewer: "the host", lobby: () => hostRound1View },
  ])(
    "after round 1 reveals Host 0, Ola 0, Bartek 2, $viewer sees game_totals: null while the game is in play",
    ({ lobby }) => {
      expect(lobby()).toMatchObject({
        error: null,
        data: {
          status: "playing",
          round: {
            number: 1,
            phase: "revealed",
            results: [
              { nick: "Host", votes: 0 },
              { nick: "Ola", votes: 0 },
              { nick: "Bartek", votes: 2 },
            ],
            abstained: 1,
            ballots: 3,
          },
          game_totals: null,
        },
      });
    },
  );

  it("round 2 reveals Host 0, Ola 2, Bartek 1 with no result for Kuba, and game_totals stays null", () => {
    expect(hostRound2View).toMatchObject({
      error: null,
      data: {
        status: "playing",
        round: {
          number: 2,
          phase: "revealed",
          results: [
            { nick: "Host", votes: 0 },
            { nick: "Ola", votes: 2 },
            { nick: "Bartek", votes: 1 },
          ],
          abstained: 0,
          ballots: 3,
        },
        game_totals: null,
      },
    });
  });

  // Positive control: the end must work, or every answer below would be a room still in play.
  it("positive control: end_game while round 4 is voting gets ok: true", () => {
    expect(endWhileVoting).toMatchObject({ error: null, data: { ok: true } });
  });

  const endViewers = [
    { viewer: "Ola, a guest from the start", lobby: () => olaEndView },
    { viewer: "Kuba, let in mid-game", lobby: () => kubaEndView },
    { viewer: "the host", lobby: () => hostEndView },
  ];

  // Exact key sets (test-plan §6.3): a key beside nick and votes is how a voter would leak into the sums.
  it.each(endViewers)(
    "after the end $viewer sees exactly the lobby's keys, game_totals with exactly revealed and totals, and each entry exactly nick and votes",
    ({ lobby }) => {
      expect(keysOf(lobby().data)).toEqual(LOBBY_KEYS);
      expect(keysOf(gameTotalsOf(lobby()))).toEqual(GAME_TOTALS_KEYS);
      expect(totalsOf(lobby()).map(keysOf)).toEqual([RESULT_KEYS, RESULT_KEYS, RESULT_KEYS]);
    },
  );

  // Only rounds 1 and 2: the skipped round 3 would give the host 2, the ended round 4 Ola 3 and Kuba 1. The host's zero
  // stays; Kuba, with no result in a revealed round, is not there.
  it.each(endViewers)(
    "after the end $viewer sees the room closed and the sums of rounds 1 and 2 only: revealed 2, Host 0, Ola 2, Bartek 3, no Kuba",
    ({ lobby }) => {
      expect(lobby()).toMatchObject({ error: null, data: { status: "closed", round: null } });
      expect(gameTotalsOf(lobby())).toEqual({
        revealed: 2,
        totals: [
          { nick: "Host", votes: 0 },
          { nick: "Ola", votes: 2 },
          { nick: "Bartek", votes: 3 },
        ],
      });
    },
  );
});

// "Nowa gra" while the game is in play closes it as "Zakończ grę" does, so the room shows the sums of its reveals all
// the same. The oracle:
//   round 1, Q1, revealed: the host for Ola, Ola for Ola, Bartek for the host, the third vote revealing it: Host 1,
//     Ola 2, Bartek 0;
//   round 2, Q2, abandoned by "Nowa gra" while voting: Ola votes for Bartek; counted, it would give Bartek 1.
// Sums: Host 1, Ola 2, Bartek 0; 1 revealed round of the 2 played.
describe("a game closed by Nowa gra after a reveal shows the sums of its reveals", () => {
  let room: OwnRoom;
  let olaToken: string;

  beforeAll(async () => {
    // The game above is closed already; confirm_close only keeps this suite from depending on it.
    room = await seedRoom(host, { confirmClose: true });
    const ola = await seedGuest(room.linkToken, "Ola");
    const bartek = await seedGuest(room.linkToken, "Bartek");
    olaToken = ola.playerToken;

    await seedStartGame(host, room.id, Q1);
    await seedVote(host.client, room.id, "Ola", undefined, 1);
    await seedVote(anon, room.id, "Ola", ola.playerToken, 1);
    await seedVote(anon, room.id, "Host", bartek.playerToken, 1);

    await seedNextRound(host, room.id, 1, POOL);
    await seedVote(anon, room.id, "Bartek", ola.playerToken, 2);
    // "Nowa gra" with the "guests are still in it" question answered.
    await seedRoom(host, { confirmClose: true });
    if ((await readOwnRoom(host, room.id)).status !== "closed") {
      throw new Error("precondition failed: the new room did not close the game mid-round");
    }
  });

  it.each([
    { viewer: "a guest", read: () => roomLobby(anon, room.id, olaToken) },
    { viewer: "the host", read: () => roomLobby(host.client, room.id) },
  ])(
    "$viewer sees the room closed and the sums of round 1 only: revealed 1, Host 1, Ola 2, Bartek 0",
    async ({ read }) => {
      const answer = await read();

      expect(answer).toMatchObject({ error: null, data: { status: "closed", round: null } });
      expect(keysOf(gameTotalsOf(answer))).toEqual(GAME_TOTALS_KEYS);
      expect(totalsOf(answer).map(keysOf)).toEqual([RESULT_KEYS, RESULT_KEYS, RESULT_KEYS]);
      expect(gameTotalsOf(answer)).toEqual({
        revealed: 1,
        totals: [
          { nick: "Host", votes: 1 },
          { nick: "Ola", votes: 2 },
          { nick: "Bartek", votes: 0 },
        ],
      });
    },
  );
});

// A room closed before its game started has no reveal, so nothing to sum.
describe("a room closed by Nowa gra from the lobby has no sums", () => {
  let room: OwnRoom;
  let olaToken: string;

  beforeAll(async () => {
    // Closes the lobby left open by "Nowa gra" above.
    room = await seedRoom(host, { confirmClose: true });
    const ola = await seedGuest(room.linkToken, "Ola");
    olaToken = ola.playerToken;
    // "Nowa gra" with the "guests are still in it" question answered.
    await seedRoom(host, { confirmClose: true });
    if ((await readOwnRoom(host, room.id)).status !== "closed") {
      throw new Error("precondition failed: the new room did not close the lobby");
    }
  });

  it.each([
    { viewer: "a guest", read: () => roomLobby(anon, room.id, olaToken) },
    { viewer: "the host", read: () => roomLobby(host.client, room.id) },
  ])("$viewer sees the room closed, exactly the lobby's keys and game_totals: null", async ({ read }) => {
    const answer = await read();

    expect(answer).toMatchObject({ error: null, data: { status: "closed", round: null, game_totals: null } });
    expect(keysOf(answer.data)).toEqual(LOBBY_KEYS);
  });
});
