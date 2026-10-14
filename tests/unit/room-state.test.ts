import { describe, expect, it } from "vitest";
import { parseLobbyState, parseRoomView } from "@/lib/rooms/shared";

// The room's state as room_lobby returns it, and as the room screen gets it from the Worker (with the question's
// text). Every new state goes through one parser that names the field that did not pass (audit P6, L4): a database and
// a Worker out of step must give a log line that says which field, not "an unexpected shape", and an island must not
// render a shape it does not know. The fixtures are written by hand from the round's contract
// (context/changes/first-live-round/plan.md, Faza 1 #4; tests/db/support/rounds.ts, the exact key sets), never from the
// parser.

const PLAYERS = [
  { nick: "Ola", host: true },
  { nick: "Bartek", host: false },
  { nick: "Kuba", host: false },
];

const LOBBY = { status: "lobby", role: "host", me: "Ola", players: PLAYERS, round: null };
const CLOSED = { status: "closed", role: "guest", me: "Bartek", players: PLAYERS, round: null };
const VOTING_ROUND = {
  number: 1,
  question_id: "na-co-dzien-001",
  phase: "voting",
  voted: ["Ola", "Kuba"],
  me_voted: true,
};
const VOTING = { status: "playing", role: "guest", me: "Kuba", players: PLAYERS, round: VOTING_ROUND };
// Every eligible player in seat order, zeros included; one abstention among four ballots.
const REVEALED_ROUND = {
  number: 1,
  question_id: "na-co-dzien-001",
  phase: "revealed",
  results: [
    { nick: "Ola", votes: 2 },
    { nick: "Bartek", votes: 0 },
    { nick: "Kuba", votes: 1 },
  ],
  abstained: 1,
  ballots: 4,
};
const REVEALED = { status: "playing", role: "host", me: "Ola", players: PLAYERS, round: REVEALED_ROUND };

const QUESTION = "spóźniłby się na własne urodziny";

function without(record: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

function withRound(state: Record<string, unknown>, round: Record<string, unknown>): Record<string, unknown> {
  return { ...state, round };
}

describe("parseLobbyState", () => {
  it.each([
    { why: "the lobby", state: LOBBY },
    { why: "a closed room", state: CLOSED },
    { why: "a round open for votes", state: VOTING },
    { why: "a revealed round", state: REVEALED },
  ])("accepts $why as it came", ({ state }) => {
    expect(parseLobbyState(state)).toEqual({ ok: true, value: state });
  });

  // Objects, not bare values: it.each would spread an array into the test's arguments.
  it.each([{ value: null }, { value: [] }, { value: "lobby" }, { value: 1 }])(
    "names the root for a value that is not an object: $value",
    ({ value }) => {
      expect(parseLobbyState(value)).toEqual({ ok: false, field: "root" });
    },
  );

  it.each(["paused", "open", "started", "", null, 1])("names status for the unknown status %j", (status) => {
    expect(parseLobbyState({ ...LOBBY, status })).toEqual({ ok: false, field: "status" });
  });

  it.each(["status", "role", "me", "players", "round"])("names the missing field %s", (field) => {
    expect(parseLobbyState(without(LOBBY, field))).toEqual({ ok: false, field });
  });

  it.each([
    { field: "role", state: { ...LOBBY, role: "admin" } },
    { field: "me", state: { ...LOBBY, me: 1 } },
    { field: "players", state: { ...LOBBY, players: {} } },
    { field: "players", state: { ...LOBBY, players: [null] } },
    { field: "players.nick", state: { ...LOBBY, players: [{ nick: 1, host: true }] } },
    { field: "players.host", state: { ...LOBBY, players: [{ nick: "Ola", host: "yes" }] } },
  ])("names $field for a wrong type", ({ field, state }) => {
    expect(parseLobbyState(state)).toEqual({ ok: false, field });
  });

  // The database has a round only while a game is in play, and always one then.
  it.each([
    { why: "a round in the lobby", state: { ...LOBBY, round: VOTING_ROUND } },
    { why: "a round in a closed room", state: { ...CLOSED, round: REVEALED_ROUND } },
    { why: "no round in a game in play", state: { ...VOTING, round: null } },
    { why: "a round that is not an object", state: { ...VOTING, round: "voting" } },
  ])("names round for $why", ({ state }) => {
    expect(parseLobbyState(state)).toEqual({ ok: false, field: "round" });
  });

  it.each(["number", "question_id", "phase", "voted", "me_voted"])("names the missing voting field round.%s", (key) => {
    expect(parseLobbyState(withRound(VOTING, without(VOTING_ROUND, key)))).toEqual({
      ok: false,
      field: `round.${key}`,
    });
  });

  it.each(["number", "question_id", "phase", "results", "abstained", "ballots"])(
    "names the missing revealed field round.%s",
    (key) => {
      expect(parseLobbyState(withRound(REVEALED, without(REVEALED_ROUND, key)))).toEqual({
        ok: false,
        field: `round.${key}`,
      });
    },
  );

  it.each([
    { field: "round.number", round: { ...VOTING_ROUND, number: 0 } },
    { field: "round.number", round: { ...VOTING_ROUND, number: 1.5 } },
    { field: "round.number", round: { ...VOTING_ROUND, number: "1" } },
    { field: "round.question_id", round: { ...VOTING_ROUND, question_id: 1 } },
    { field: "round.phase", round: { ...VOTING_ROUND, phase: "counting" } },
    { field: "round.voted", round: { ...VOTING_ROUND, voted: "Ola" } },
    { field: "round.voted", round: { ...VOTING_ROUND, voted: [1] } },
    { field: "round.me_voted", round: { ...VOTING_ROUND, me_voted: "yes" } },
    { field: "round.results", round: { ...REVEALED_ROUND, results: {} } },
    { field: "round.results", round: { ...REVEALED_ROUND, results: [null] } },
    { field: "round.results.nick", round: { ...REVEALED_ROUND, results: [{ nick: 1, votes: 0 }] } },
    { field: "round.results.votes", round: { ...REVEALED_ROUND, results: [{ nick: "Ola", votes: -1 }] } },
    { field: "round.results.votes", round: { ...REVEALED_ROUND, results: [{ nick: "Ola", votes: "2" }] } },
    { field: "round.abstained", round: { ...REVEALED_ROUND, abstained: -1 } },
    { field: "round.ballots", round: { ...REVEALED_ROUND, ballots: "4" } },
  ])("names $field for a wrong value", ({ field, round }) => {
    expect(parseLobbyState(withRound(VOTING, round))).toEqual({ ok: false, field });
  });

  // Anonymity (test-plan #1): a key outside the contract, such as counts before the reveal, never reaches a screen,
  // even if the database sent one.
  it("passes on no key outside the contract", () => {
    const leaky = {
      ...VOTING,
      link_token: "planted",
      round: { ...VOTING_ROUND, tally: { Ola: 2 }, votes: 2 },
      players: [{ nick: "Ola", host: true, id: "planted" }],
    };

    expect(parseLobbyState(leaky)).toEqual({
      ok: true,
      value: { ...VOTING, players: [{ nick: "Ola", host: true }] },
    });
  });
});

describe("parseRoomView", () => {
  it.each([
    { why: "the lobby", state: LOBBY },
    { why: "a closed room", state: CLOSED },
  ])("accepts $why without a question", ({ state }) => {
    expect(parseRoomView(state)).toEqual({ ok: true, value: state });
  });

  it.each([
    { why: "a round open for votes", state: withRound(VOTING, { ...VOTING_ROUND, question: QUESTION }) },
    { why: "a revealed round", state: withRound(REVEALED, { ...REVEALED_ROUND, question: QUESTION }) },
  ])("accepts $why with its question", ({ state }) => {
    expect(parseRoomView(state)).toEqual({ ok: true, value: state });
  });

  // A question the base does not have comes as null (src/lib/rooms/server.ts, roomView): the screen says it could not
  // load the question, and the round goes on.
  it.each([
    { why: "a round open for votes", state: withRound(VOTING, { ...VOTING_ROUND, question: null }) },
    { why: "a revealed round", state: withRound(REVEALED, { ...REVEALED_ROUND, question: null }) },
  ])("accepts $why whose question the base does not have", ({ state }) => {
    expect(parseRoomView(state)).toEqual({ ok: true, value: state });
  });

  it.each([
    { why: "missing", state: VOTING },
    { why: "not a text", state: withRound(VOTING, { ...VOTING_ROUND, question: 1 }) },
    { why: "an object", state: withRound(VOTING, { ...VOTING_ROUND, question: { text: QUESTION } }) },
  ])("names round.question when it is $why", ({ state }) => {
    expect(parseRoomView(state)).toEqual({ ok: false, field: "round.question" });
  });

  it("names the field the lobby parser names", () => {
    expect(parseRoomView({ ...LOBBY, status: "paused" })).toEqual({ ok: false, field: "status" });
  });
});
