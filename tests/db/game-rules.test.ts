import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, newHost, type Host } from "./support/clients";
import { seedGuest, seedRoom, type OwnRoom, type SeededGuest } from "./support/rooms";
import {
  EVENING_QUESTION_IDS,
  castVote,
  endGame,
  joinRoom,
  nextRound,
  roomLink,
  roomLobby,
  roundOf,
  seedReveal,
  seedStartGame,
  seedVote,
  skipRound,
  type Answer,
} from "./support/rounds";

// The evening's rules (#3) through the roles' own doors: RPC with the publishable key, as guests and as the signed-in
// host, past the Worker. Oracle: PRD FR-006 (the host moves on to the next question, skips a round, whose votes are
// lost, and ends the game after a confirmation), FR-015 (no question twice in one game) and the decisions of
// context/archive/2026-10-15-full-game-evening/research.md: D1 (the Worker sends the pool in its own order and the
// database takes the first question not played yet), D2 (a skip only while voting, with the next question at once;
// skipping the last question does not end the game), D3 (a skipped round keeps no count), D4 (ending the game closes
// the room) and T1 (a vote and the host's moves carry the number of the question on screen; another number is
// round_over). Every expected question, round number and count is written out by hand from the scenario, never
// computed.
//
// next_round, skip_round, end_game and cast_vote's p_round come from supabase/migrations/*_full_game_evening.sql.
// Without them PostgREST answers each of those calls with PGRST202 (no such function), and every test here is red on
// its own probe or on the state those calls should have made.
//
// One sign-up per run, in beforeAll. One open room per host, so the rooms come one after another (confirm_close closes
// the one before); Vitest runs the suites in order, each suite's beforeAll right before its tests.

const anon = anonClient();
const [Q1, Q2, Q3, Q4] = EVENING_QUESTION_IDS;
// The whole pool, as the Worker would send it at any point of this file's evening.
const POOL = [Q1, Q2, Q3, Q4];

let host: Host;

beforeAll(async () => {
  host = await newHost();
});

// The evening plays out once, in order, in beforeAll: every move and every refused try between them. Each step's
// answer is kept and checked by its own test, so no test depends on another one having run.
describe("an evening: Host, Ola and Bartek through four questions", () => {
  let room: OwnRoom;
  let ola: SeededGuest;
  let bartek: SeededGuest;
  // Round 2: the next question.
  let nextAfterReveal: Answer;
  let olaRound2View: Answer;
  let olaVotesWithNoNumber: Answer;
  let nextWhileVoting: Answer;
  let nextFromOldScreen: Answer;
  let hostRound2View: Answer;
  let bartekLateForRound1: Answer;
  // Round 3: after a skip.
  let skipWhileVoting: Answer;
  let olaRound3View: Answer;
  let bartekLateForRound2: Answer;
  let skipSentAgain: Answer;
  let hostRound3View: Answer;
  let olaVotesWithNumber: Answer;
  let round3Revealed: Answer;
  let skipAfterReveal: Answer;
  // Round 4: the last question, skipped.
  let nextWithNoneLeft: Answer;
  let hostAfterNoneLeft: Answer;
  let nextToLastQuestion: Answer;
  let olaRound4View: Answer;
  let skipLastQuestion: Answer;
  let olaSkippedView: Answer;
  let olaVotesOnSkipped: Answer;
  let nextAfterLastSkip: Answer;
  // The end.
  let endAfterLastSkip: Answer;
  let olaEndView: Answer;

  beforeAll(async () => {
    room = await seedRoom(host);
    ola = await seedGuest(room.linkToken, "Ola");
    bartek = await seedGuest(room.linkToken, "Bartek");

    // Round 1: Ola votes; Bartek is still choosing when the host reveals.
    await seedStartGame(host, room.id, Q1);
    await seedVote(anon, room.id, "Bartek", ola.playerToken);
    await seedReveal(host, room.id);

    // Round 2: the pool starts with Q1, which was played, so Q2 comes up.
    nextAfterReveal = await nextRound(host.client, room.id, 1, [Q1, Q2]);
    olaRound2View = await roomLobby(anon, room.id, ola.playerToken);
    // A screen loaded before S-03 sends no number: the vote goes to the latest round (the deployment window).
    olaVotesWithNoNumber = await castVote(anon, room.id, "Bartek", ola.playerToken);
    nextWhileVoting = await nextRound(host.client, room.id, 2, POOL);
    // The host's own screen still on round 1, or the same click sent twice.
    nextFromOldScreen = await nextRound(host.client, room.id, 1, POOL);
    hostRound2View = await roomLobby(host.client, room.id);
    // Bartek's screen still shows Q1 and sends his choice now. He has not voted in round 2, so the number is the only
    // thing it can be refused for.
    bartekLateForRound1 = await castVote(anon, room.id, "Ola", bartek.playerToken, 1);

    // Round 3: the host skips round 2 while it is voting; Q1 and Q2 were played, so Q3 comes up.
    skipWhileVoting = await skipRound(host.client, room.id, 2, [Q1, Q2, Q3]);
    olaRound3View = await roomLobby(anon, room.id, ola.playerToken);
    // Bartek's screen still shows the skipped Q2. He has not voted in round 3.
    bartekLateForRound2 = await castVote(anon, room.id, "Ola", bartek.playerToken, 2);
    // The skip sent twice: it must not skip round 3, which nobody has answered yet.
    skipSentAgain = await skipRound(host.client, room.id, 2, POOL);
    hostRound3View = await roomLobby(host.client, room.id);
    olaVotesWithNumber = await castVote(anon, room.id, "Bartek", ola.playerToken, 3);
    await seedReveal(host, room.id);
    round3Revealed = await roomLobby(host.client, room.id);
    skipAfterReveal = await skipRound(host.client, room.id, 3, POOL);

    // Round 4: Q1, Q2 and Q3 were played, so a pool of those three has nothing left; the whole pool has Q4.
    nextWithNoneLeft = await nextRound(host.client, room.id, 3, [Q1, Q2, Q3]);
    hostAfterNoneLeft = await roomLobby(host.client, room.id);
    nextToLastQuestion = await nextRound(host.client, room.id, 3, POOL);
    olaRound4View = await roomLobby(anon, room.id, ola.playerToken);
    // Skipping the last question: no question is left to open, and the game goes on until the host ends it (D2).
    skipLastQuestion = await skipRound(host.client, room.id, 4, POOL);
    olaSkippedView = await roomLobby(anon, room.id, ola.playerToken);
    olaVotesOnSkipped = await castVote(anon, room.id, "Bartek", ola.playerToken);
    nextAfterLastSkip = await nextRound(host.client, room.id, 4, POOL);

    // "Zakończ grę" once the questions ran out.
    endAfterLastSkip = await endGame(host.client, room.id);
    olaEndView = await roomLobby(anon, room.id, ola.playerToken);
  });

  // Positive control: the first next question must work, or a wrong address would look like a refusal everywhere.
  it("positive control: next_round after the reveal gets ok: true", () => {
    expect(nextAfterReveal).toMatchObject({ error: null, data: { ok: true } });
  });

  // FR-015: Q1 was played, so the first candidate left is Q2. Ola voted in round 1; round 2 starts with nobody's vote.
  it("Ola, who voted in round 1, sees round 2 with Q2, voting, nobody voted yet and no skip before it", () => {
    expect(olaRound2View).toMatchObject({
      error: null,
      data: {
        status: "playing",
        round: { number: 2, question_id: Q2, phase: "voting", voted: [], me_voted: false, after_skip: false },
      },
    });
  });

  // The deployment window (plan, Critical Implementation Details): the database ships before the Worker, whose vote
  // carries no question number.
  it("a vote with no question number in round 2 gets ok: true, as the Worker before S-03 sends it", () => {
    expect(olaVotesWithNoNumber).toMatchObject({ error: null, data: { ok: true } });
  });

  it("next_round while round 2 is voting gets round_in_progress", () => {
    expect(nextWhileVoting).toMatchObject({ error: null, data: { ok: false, reason: "round_in_progress" } });
  });

  it("next_round from a screen still on round 1 gets round_over", () => {
    expect(nextFromOldScreen).toMatchObject({ error: null, data: { ok: false, reason: "round_over" } });
  });

  it("after both refused next_round calls the game is still in round 2 with Q2, with Ola's vote in it", () => {
    expect(hostRound2View).toMatchObject({
      error: null,
      data: { round: { number: 2, question_id: Q2, phase: "voting", voted: ["Ola"] } },
    });
  });

  // T1: a choice made at question 1 must not land in question 2, which Bartek has not seen.
  it("Bartek's vote for question 1, sent while round 2 is voting, gets round_over", () => {
    expect(bartekLateForRound1).toMatchObject({ error: null, data: { ok: false, reason: "round_over" } });
  });

  it("skip_round while round 2 is voting gets ok: true", () => {
    expect(skipWhileVoting).toMatchObject({ error: null, data: { ok: true } });
  });

  // D2: the next question comes at once. Ola voted in the skipped round 2, and her vote is gone with it.
  it("after the skip Ola sees round 3 with Q3, voting, nobody voted yet, after a skip", () => {
    expect(olaRound3View).toMatchObject({
      error: null,
      data: {
        status: "playing",
        round: { number: 3, question_id: Q3, phase: "voting", voted: [], me_voted: false, after_skip: true },
      },
    });
  });

  it("Bartek's vote for the skipped question 2, sent while round 3 is voting, gets round_over", () => {
    expect(bartekLateForRound2).toMatchObject({ error: null, data: { ok: false, reason: "round_over" } });
  });

  it("the same skip of round 2 sent again gets round_over", () => {
    expect(skipSentAgain).toMatchObject({ error: null, data: { ok: false, reason: "round_over" } });
  });

  it("after the repeated skip the game is still in round 3 with Q3", () => {
    expect(hostRound3View).toMatchObject({
      error: null,
      data: { round: { number: 3, question_id: Q3, phase: "voting", after_skip: true } },
    });
  });

  it("a vote with round 3's number while round 3 is voting gets ok: true", () => {
    expect(olaVotesWithNumber).toMatchObject({ error: null, data: { ok: true } });
  });

  // Only Ola's vote for Bartek in round 3 counts: her vote for Bartek in the skipped round 2 would make it 2, and
  // Bartek's late vote for Ola would give her 1.
  it("round 3 reveals only its own vote: Bartek 1, the rest 0, 1 ballot", () => {
    expect(round3Revealed).toMatchObject({
      error: null,
      data: {
        round: {
          number: 3,
          question_id: Q3,
          phase: "revealed",
          results: [
            { nick: "Host", votes: 0 },
            { nick: "Ola", votes: 0 },
            { nick: "Bartek", votes: 1 },
          ],
          abstained: 0,
          ballots: 1,
        },
      },
    });
  });

  // D2: once the counts are shown there is nothing left to lose.
  it("skip_round after round 3 was revealed gets round_revealed", () => {
    expect(skipAfterReveal).toMatchObject({ error: null, data: { ok: false, reason: "round_revealed" } });
  });

  it("next_round when every candidate was played gets no_questions", () => {
    expect(nextWithNoneLeft).toMatchObject({ error: null, data: { ok: false, reason: "no_questions" } });
  });

  it("after no_questions the game is still in play, in round 3, revealed", () => {
    expect(hostAfterNoneLeft).toMatchObject({
      error: null,
      data: { status: "playing", round: { number: 3, question_id: Q3, phase: "revealed" } },
    });
  });

  it("next_round with one candidate left gets ok: true", () => {
    expect(nextToLastQuestion).toMatchObject({ error: null, data: { ok: true } });
  });

  // FR-015: Q4 is the last of the pool and the only one not played yet. Round 3 was revealed, not skipped.
  it("round 4 is Q4, voting, nobody voted yet and no skip before it", () => {
    expect(olaRound4View).toMatchObject({
      error: null,
      data: { round: { number: 4, question_id: Q4, phase: "voting", voted: [], me_voted: false, after_skip: false } },
    });
  });

  it("skipping the last question gets ok: true", () => {
    expect(skipLastQuestion).toMatchObject({ error: null, data: { ok: true } });
  });

  // D2 and D3: no new round, the game stays in play, and the skipped round shows its number and phase, nothing else.
  it("after the last skip the game is still in play and its latest round is exactly round 4, skipped", () => {
    expect(olaSkippedView).toMatchObject({ error: null, data: { status: "playing" } });
    expect(roundOf(olaSkippedView)).toEqual({ number: 4, phase: "skipped" });
  });

  it("a vote with no question number on the skipped round gets round_over", () => {
    expect(olaVotesOnSkipped).toMatchObject({ error: null, data: { ok: false, reason: "round_over" } });
  });

  it("next_round after the last question was skipped gets no_questions", () => {
    expect(nextAfterLastSkip).toMatchObject({ error: null, data: { ok: false, reason: "no_questions" } });
  });

  // D4: when the questions ran out, the host ends the game.
  it("end_game after the last question was skipped gets ok: true", () => {
    expect(endAfterLastSkip).toMatchObject({ error: null, data: { ok: true } });
  });

  it("after the end Ola sees the room closed and no round", () => {
    expect(olaEndView).toMatchObject({ error: null, data: { status: "closed", round: null } });
  });
});

describe("in the lobby there is no round to move on from, skip or end", () => {
  let room: OwnRoom;

  beforeAll(async () => {
    // Closes the evening's room, should ending it have failed.
    room = await seedRoom(host, { confirmClose: true });
    await seedGuest(room.linkToken, "Ola");
    await seedGuest(room.linkToken, "Bartek");
  });

  // end_game last: a lobby it closed by mistake would leave the other two nothing to refuse.
  it.each([
    { fn: "next_round", attempt: () => nextRound(host.client, room.id, 1, POOL) },
    { fn: "skip_round", attempt: () => skipRound(host.client, room.id, 1, POOL) },
    { fn: "end_game", attempt: () => endGame(host.client, room.id) },
  ])("$fn in the lobby gets no_round", async ({ attempt }) => {
    const answer = await attempt();

    expect(answer).toMatchObject({ error: null, data: { ok: false, reason: "no_round" } });
  });
});

// D4: "Zakończ grę" also while a round is voting; the room is closed for everyone, the link included.
describe("the host ends the game while round 1 is voting", () => {
  let room: OwnRoom;
  let ola: SeededGuest;
  let endWhileVoting: Answer;

  beforeAll(async () => {
    // Closes the lobby room.
    room = await seedRoom(host, { confirmClose: true });
    ola = await seedGuest(room.linkToken, "Ola");
    await seedGuest(room.linkToken, "Bartek");
    await seedStartGame(host, room.id, Q1);
    await seedVote(anon, room.id, "Bartek", ola.playerToken);
    endWhileVoting = await endGame(host.client, room.id);
  });

  it("end_game while round 1 is voting gets ok: true", () => {
    expect(endWhileVoting).toMatchObject({ error: null, data: { ok: true } });
  });

  it.each([
    { viewer: "Ola", read: () => roomLobby(anon, room.id, ola.playerToken) },
    { viewer: "the host", read: () => roomLobby(host.client, room.id) },
  ])("$viewer sees the room closed and no round", async ({ read }) => {
    const answer = await read();

    expect(answer).toMatchObject({ error: null, data: { status: "closed", round: null } });
  });

  it("the room's link answers exactly { status: closed }", async () => {
    const answer = await roomLink(room.linkToken);

    expect(answer).toEqual({ data: { status: "closed" }, error: null });
  });

  it("a new guest joining after the end gets room_closed", async () => {
    const answer = await joinRoom(room.linkToken, "Wiktor");

    expect(answer).toMatchObject({ error: null, data: { ok: false, reason: "room_closed" } });
  });

  it.each([
    { fn: "end_game", attempt: () => endGame(host.client, room.id) },
    { fn: "next_round", attempt: () => nextRound(host.client, room.id, 1, POOL) },
    { fn: "skip_round", attempt: () => skipRound(host.client, room.id, 1, POOL) },
  ])("$fn after the end gets room_closed", async ({ attempt }) => {
    const answer = await attempt();

    expect(answer).toMatchObject({ error: null, data: { ok: false, reason: "room_closed" } });
  });
});
