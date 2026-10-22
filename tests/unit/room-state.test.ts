import { describe, expect, it } from "vitest";
import { parseJoinRequestState, parseLobbyState, parseRoomView } from "@/lib/rooms/shared";

// The room's state as room_lobby returns it, and as the room screen gets it from the Worker (with the question's
// text). Every new state goes through one parser that names the field that did not pass (audit P6, L4): a database and
// a Worker out of step must give a log line that says which field, not "an unexpected shape", and an island must not
// render a shape it does not know. The fixtures are written by hand from the round's contract
// (context/archive/2026-10-13-first-live-round/plan.md, Faza 1 #4;
// context/archive/2026-10-15-full-game-evening/plan.md, Faza 1 #2 and Faza 3 #2;
// context/changes/latecomer-admission/plan.md, Faza 1 #1: requests and round.eligible; tests/db/support/rounds.ts, the
// exact key sets), never from the parser.

const PLAYERS = [
  { nick: "Ola", host: true },
  { nick: "Bartek", host: false },
  { nick: "Kuba", host: false },
];

// requests: the latecomers waiting, for the host only; a guest always gets [].
const LOBBY = { status: "lobby", role: "host", me: "Ola", players: PLAYERS, round: null, requests: [] };
const CLOSED = { status: "closed", role: "guest", me: "Bartek", players: PLAYERS, round: null, requests: [] };
const VOTING_ROUND = {
  number: 1,
  question_id: "na-co-dzien-001",
  phase: "voting",
  eligible: ["Ola", "Bartek", "Kuba"],
  voted: ["Ola", "Kuba"],
  me_voted: true,
  after_skip: false,
};
const VOTING = { status: "playing", role: "guest", me: "Kuba", players: PLAYERS, round: VOTING_ROUND, requests: [] };
// S-08: Kuba was let in after the round opened, so he is among the players but not among those who may vote in it;
// the host sees two latecomers still waiting, in the order of asking.
const LATECOMER_ROUND = { ...VOTING_ROUND, eligible: ["Ola", "Bartek"], voted: ["Ola"], me_voted: true };
const HOST_WITH_REQUESTS = {
  status: "playing",
  role: "host",
  me: "Ola",
  players: PLAYERS,
  round: LATECOMER_ROUND,
  requests: ["Zosia", "Igor"],
};
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
const REVEALED = { status: "playing", role: "host", me: "Ola", players: PLAYERS, round: REVEALED_ROUND, requests: [] };
// S-03: the host skipped the last question of the pool, so the skipped round stays the latest one. Its votes are gone:
// only its number and phase.
const SKIPPED_ROUND = { number: 4, phase: "skipped" };
const SKIPPED = {
  status: "playing",
  role: "guest",
  me: "Bartek",
  players: PLAYERS,
  round: SKIPPED_ROUND,
  requests: [],
};
// The round after a skip says so to every screen, including one that slept through the skip.
const AFTER_SKIP_ROUND = { ...VOTING_ROUND, number: 3, after_skip: true };
const AFTER_SKIP = { ...VOTING, round: AFTER_SKIP_ROUND };

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
    { why: "a skipped round", state: SKIPPED },
    { why: "a round after a skip", state: AFTER_SKIP },
    { why: "a round with a latecomer let in after it opened, for the host with requests", state: HOST_WITH_REQUESTS },
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

  it.each(["status", "role", "me", "players", "round", "requests"])("names the missing field %s", (field) => {
    expect(parseLobbyState(without(LOBBY, field))).toEqual({ ok: false, field });
  });

  // A database without requests (the Worker deployed before the migration) is refused in every status, not read as
  // "nobody waits".
  it.each([{ state: VOTING }, { state: SKIPPED }, { state: CLOSED }])(
    "names requests when a $state.status room's state has none",
    ({ state }) => {
      expect(parseLobbyState(without(state, "requests"))).toEqual({ ok: false, field: "requests" });
    },
  );

  it.each([
    { field: "role", state: { ...LOBBY, role: "admin" } },
    { field: "me", state: { ...LOBBY, me: 1 } },
    { field: "players", state: { ...LOBBY, players: {} } },
    { field: "players", state: { ...LOBBY, players: [null] } },
    { field: "players.nick", state: { ...LOBBY, players: [{ nick: 1, host: true }] } },
    { field: "players.host", state: { ...LOBBY, players: [{ nick: "Ola", host: "yes" }] } },
    { field: "requests", state: { ...LOBBY, requests: null } },
    { field: "requests", state: { ...LOBBY, requests: "Zosia" } },
    { field: "requests", state: { ...LOBBY, requests: [1] } },
    // A nick only: a request with anything next to it (a token hash, a time) is not ours.
    { field: "requests", state: { ...LOBBY, requests: [{ nick: "Zosia" }] } },
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

  it.each(["number", "question_id", "phase", "eligible", "voted", "me_voted", "after_skip"])(
    "names the missing voting field round.%s",
    (key) => {
      expect(parseLobbyState(withRound(VOTING, without(VOTING_ROUND, key)))).toEqual({
        ok: false,
        field: `round.${key}`,
      });
    },
  );

  it.each(["number", "phase"])("names the missing skipped field round.%s", (key) => {
    expect(parseLobbyState(withRound(SKIPPED, without(SKIPPED_ROUND, key)))).toEqual({
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
    { field: "round.eligible", round: { ...VOTING_ROUND, eligible: null } },
    { field: "round.eligible", round: { ...VOTING_ROUND, eligible: "Ola" } },
    { field: "round.eligible", round: { ...VOTING_ROUND, eligible: [1] } },
    { field: "round.voted", round: { ...VOTING_ROUND, voted: "Ola" } },
    { field: "round.voted", round: { ...VOTING_ROUND, voted: [1] } },
    { field: "round.me_voted", round: { ...VOTING_ROUND, me_voted: "yes" } },
    { field: "round.after_skip", round: { ...VOTING_ROUND, after_skip: "yes" } },
    { field: "round.number", round: { ...SKIPPED_ROUND, number: 0 } },
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

  // Anonymity (test-plan #1) and decision D3 of context/archive/2026-10-15-full-game-evening/research.md: a skipped
  // round's votes are gone, so anything about them next to it (a count, who voted, even its question) means they were
  // not dropped. The state is refused, not passed on without it.
  it.each([
    { field: "round.results", round: { ...SKIPPED_ROUND, results: [{ nick: "Ola", votes: 1 }] } },
    { field: "round.abstained", round: { ...SKIPPED_ROUND, abstained: 0 } },
    { field: "round.ballots", round: { ...SKIPPED_ROUND, ballots: 1 } },
    { field: "round.voted", round: { ...SKIPPED_ROUND, voted: ["Ola"] } },
    { field: "round.eligible", round: { ...SKIPPED_ROUND, eligible: ["Ola"] } },
    { field: "round.me_voted", round: { ...SKIPPED_ROUND, me_voted: true } },
    { field: "round.question_id", round: { ...SKIPPED_ROUND, question_id: "na-co-dzien-004" } },
  ])("names $field for a skipped round that carries it", ({ field, round }) => {
    expect(parseLobbyState(withRound(SKIPPED, round))).toEqual({ ok: false, field });
  });

  // Anonymity (test-plan #1): a key outside the contract, such as counts before the reveal, never reaches a screen,
  // even if the database sent one.
  it("passes on no key outside the contract", () => {
    const leaky = {
      ...VOTING,
      link_token: "planted",
      round: { ...VOTING_ROUND, tally: { Ola: 2 }, votes: 2 },
      players: [{ nick: "Ola", host: true, id: "planted" }],
      request_tokens: ["planted"],
    };

    expect(parseLobbyState(leaky)).toEqual({
      ok: true,
      value: { ...VOTING, players: [{ nick: "Ola", host: true }] },
    });
  });
});

// The Worker's view adds questionsLeft: for the host once the latest round is revealed or skipped, whether the pool has
// a question not played yet; null in every other state and for a guest.
function view(state: Record<string, unknown>, questionsLeft: boolean | null = null): Record<string, unknown> {
  return { ...state, questionsLeft };
}

describe("parseRoomView", () => {
  it.each([
    { why: "the lobby", state: view(LOBBY) },
    { why: "a closed room", state: view(CLOSED) },
    { why: "a skipped round, for a guest", state: view(SKIPPED) },
    { why: "a skipped round, for the host with no question left", state: view({ ...SKIPPED, role: "host" }, false) },
  ])("accepts $why without a question", ({ state }) => {
    expect(parseRoomView(state)).toEqual({ ok: true, value: state });
  });

  it.each([
    { why: "a round open for votes", state: view(withRound(VOTING, { ...VOTING_ROUND, question: QUESTION })) },
    { why: "a round after a skip", state: view(withRound(AFTER_SKIP, { ...AFTER_SKIP_ROUND, question: QUESTION })) },
    { why: "a revealed round", state: view(withRound(REVEALED, { ...REVEALED_ROUND, question: QUESTION }), true) },
  ])("accepts $why with its question", ({ state }) => {
    expect(parseRoomView(state)).toEqual({ ok: true, value: state });
  });

  // A question the base does not have comes as null (src/lib/rooms/server.ts, roomView): the screen says it could not
  // load the question, and the round goes on.
  it.each([
    { why: "a round open for votes", state: view(withRound(VOTING, { ...VOTING_ROUND, question: null })) },
    { why: "a revealed round", state: view(withRound(REVEALED, { ...REVEALED_ROUND, question: null }), false) },
  ])("accepts $why whose question the base does not have", ({ state }) => {
    expect(parseRoomView(state)).toEqual({ ok: true, value: state });
  });

  it.each([
    { why: "missing", state: view(VOTING) },
    { why: "not a text", state: view(withRound(VOTING, { ...VOTING_ROUND, question: 1 })) },
    { why: "an object", state: view(withRound(VOTING, { ...VOTING_ROUND, question: { text: QUESTION } })) },
  ])("names round.question when it is $why", ({ state }) => {
    expect(parseRoomView(state)).toEqual({ ok: false, field: "round.question" });
  });

  it.each([
    { why: "missing", state: LOBBY },
    { why: "not true, false or null", state: { ...LOBBY, questionsLeft: "yes" } },
    { why: "a number", state: { ...LOBBY, questionsLeft: 3 } },
  ])("names questionsLeft when it is $why", ({ state }) => {
    expect(parseRoomView(state)).toEqual({ ok: false, field: "questionsLeft" });
  });

  it("names the field the lobby parser names", () => {
    expect(parseRoomView(view({ ...LOBBY, status: "paused" }))).toEqual({ ok: false, field: "status" });
  });
});

// A latecomer's own request as join_request_state returns it (context/changes/latecomer-admission/plan.md, Faza 1 #1),
// for the /j/<code> page and its waiting screen: the state, and the nick only while a request exists.
describe("parseJoinRequestState", () => {
  it.each([
    { why: "a request waiting", state: { state: "pending", nick: "Kuba" } },
    { why: "a request turned away", state: { state: "rejected", nick: "Kuba" } },
    { why: "a latecomer let in", state: { state: "admitted" } },
    { why: "a room closed", state: { state: "closed" } },
    { why: "no request", state: { state: "none" } },
  ])("accepts $why as it came", ({ state }) => {
    expect(parseJoinRequestState(state)).toEqual({ ok: true, value: state });
  });

  it.each([{ value: null }, { value: [] }, { value: "pending" }, { value: 1 }])(
    "names the root for a value that is not an object: $value",
    ({ value }) => {
      expect(parseJoinRequestState(value)).toEqual({ ok: false, field: "root" });
    },
  );

  it.each(["waiting", "admit", "", null, 1, undefined])("names state for the unknown state %j", (state) => {
    expect(parseJoinRequestState({ state, nick: "Kuba" })).toEqual({ ok: false, field: "state" });
  });

  it.each([
    { why: "missing from a request waiting", state: { state: "pending" } },
    { why: "missing from a request turned away", state: { state: "rejected" } },
    { why: "not a text", state: { state: "pending", nick: 1 } },
    { why: "null", state: { state: "rejected", nick: null } },
  ])("names nick when it is $why", ({ state }) => {
    expect(parseJoinRequestState(state)).toEqual({ ok: false, field: "nick" });
  });

  // Whoever is still outside sees nothing of the game: a key outside the contract (the question, the players, another
  // latecomer's request) never reaches the waiting screen, even if the database sent one.
  it.each([
    {
      why: "a request waiting",
      state: { state: "pending", nick: "Kuba", question: "planted", players: ["Ola"], requests: ["Zosia"] },
      value: { state: "pending", nick: "Kuba" },
    },
    {
      why: "a latecomer let in",
      state: { state: "admitted", nick: "Kuba", room_id: "planted" },
      value: { state: "admitted" },
    },
    { why: "no request", state: { state: "none", nick: "planted" }, value: { state: "none" } },
  ])("passes on no key outside the contract for $why", ({ state, value }) => {
    expect(parseJoinRequestState(state)).toEqual({ ok: true, value });
  });
});
