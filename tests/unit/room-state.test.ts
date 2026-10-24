import { describe, expect, it } from "vitest";
import { parseJoinRequestState, parseLobbyState, parseRoomView, questionLength } from "@/lib/rooms/shared";

// The room's state as room_lobby returns it, and as the room screen gets it from the Worker (with the question's
// text). Every new state goes through one parser that names the field that did not pass (audit P6, L4): a database and
// a Worker out of step must give a log line that says which field, not "an unexpected shape", and an island must not
// render a shape it does not know. The fixtures are written by hand from the round's contract
// (context/archive/2026-10-13-first-live-round/plan.md, Faza 1 #4;
// context/archive/2026-10-15-full-game-evening/plan.md, Faza 1 #2 and Faza 3 #2;
// context/changes/latecomer-admission/plan.md, Faza 1 #1: requests and round.eligible;
// context/archive/2026-10-24-question-list-review/plan.md, Faza 1 #1 and Faza 2 #1: question_list, round.question_text
// and the view's questions; tests/db/support/rounds.ts, the exact key sets), never from the parser.

const PLAYERS = [
  { nick: "Ola", host: true },
  { nick: "Bartek", host: false },
  { nick: "Kuba", host: false },
];

// requests: the latecomers waiting, for the host only; a guest always gets []. question_list: the game's question
// list, for the host of a room with one only; null for a guest and before the host opens it.
const LOBBY = {
  status: "lobby",
  role: "host",
  me: "Ola",
  players: PLAYERS,
  round: null,
  requests: [],
  question_list: null,
};
const CLOSED = {
  status: "closed",
  role: "guest",
  me: "Bartek",
  players: PLAYERS,
  round: null,
  requests: [],
  question_list: null,
};
// question_text: null for a question of the base, which the round names by its id.
const VOTING_ROUND = {
  number: 1,
  question_id: "na-co-dzien-001",
  question_text: null,
  phase: "voting",
  eligible: ["Ola", "Bartek", "Kuba"],
  voted: ["Ola", "Kuba"],
  me_voted: true,
  after_skip: false,
};
const VOTING = {
  status: "playing",
  role: "guest",
  me: "Kuba",
  players: PLAYERS,
  round: VOTING_ROUND,
  requests: [],
  question_list: null,
};
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
  question_list: null,
};
// Every eligible player in seat order, zeros included; one abstention among four ballots.
const REVEALED_ROUND = {
  number: 1,
  question_id: "na-co-dzien-001",
  question_text: null,
  phase: "revealed",
  results: [
    { nick: "Ola", votes: 2 },
    { nick: "Bartek", votes: 0 },
    { nick: "Kuba", votes: 1 },
  ],
  abstained: 1,
  ballots: 4,
};
const REVEALED = {
  status: "playing",
  role: "host",
  me: "Ola",
  players: PLAYERS,
  round: REVEALED_ROUND,
  requests: [],
  question_list: null,
};
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
  question_list: null,
};
// The round after a skip says so to every screen, including one that slept through the skip.
const AFTER_SKIP_ROUND = { ...VOTING_ROUND, number: 3, after_skip: true };
const AFTER_SKIP = { ...VOTING, round: AFTER_SKIP_ROUND };

const QUESTION = "spóźniłby się na własne urodziny";
const REWORDED = "wypiłby mleko prosto z kartonu";
const OWN_QUESTION = "zgubiłby klucze w drodze do domu";

// S-06: the host's game's question list after "Przejrzyj pytania", shortened: entry 1 reworded (its question id stays),
// entry 2 removed (gone from the entries, still counted in base_count), entry 3 as drawn, entries 4-15 left out here,
// and the host's own question 16. base_count: the 15 drawn rows, the removed and the reworded one included.
const QUESTION_LIST = {
  entries: [
    { position: 1, question_id: "na-co-dzien-001", text: REWORDED },
    { position: 3, question_id: "na-co-dzien-003", text: null },
    { position: 16, question_id: null, text: OWN_QUESTION },
  ],
  base_count: 15,
};
const LOBBY_WITH_LIST = { ...LOBBY, question_list: QUESTION_LIST };
// During the game the host still gets the list: the Worker counts the questions left from it.
const REVEALED_WITH_LIST = { ...REVEALED, question_list: QUESTION_LIST };
// A round of an own or reworded question of the list has no question id, only the host's text, for every player.
const OWN_ROUND = { ...VOTING_ROUND, question_id: null, question_text: REWORDED };
const OWN = { ...VOTING, round: OWN_ROUND };
const OWN_REVEALED_ROUND = { ...REVEALED_ROUND, question_id: null, question_text: OWN_QUESTION };
const OWN_REVEALED = { ...REVEALED, round: OWN_REVEALED_ROUND };

function without(record: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

function withRound(state: Record<string, unknown>, round: Record<string, unknown>): Record<string, unknown> {
  return { ...state, round };
}

function withList(list: unknown): Record<string, unknown> {
  return { ...LOBBY, question_list: list };
}

// The list with one entry, entry 3 with the fields given.
function withEntry(fields: Record<string, unknown>): Record<string, unknown> {
  return withList({ ...QUESTION_LIST, entries: [{ ...QUESTION_LIST.entries[1], ...fields }] });
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
    { why: "the host's lobby with the game's question list", state: LOBBY_WITH_LIST },
    { why: "a revealed round for the host with the game's question list", state: REVEALED_WITH_LIST },
    { why: "a list whose every entry is removed", state: withList({ entries: [], base_count: 15 }) },
    { why: "a round of an own or reworded question, open for votes", state: OWN },
    { why: "a revealed round of an own question", state: OWN_REVEALED },
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

  it.each(["status", "role", "me", "players", "round", "requests", "question_list"])(
    "names the missing field %s",
    (field) => {
      expect(parseLobbyState(without(LOBBY, field))).toEqual({ ok: false, field });
    },
  );

  // A database without requests (the Worker deployed before the migration) is refused in every status, not read as
  // "nobody waits".
  it.each([{ state: VOTING }, { state: SKIPPED }, { state: CLOSED }])(
    "names requests when a $state.status room's state has none",
    ({ state }) => {
      expect(parseLobbyState(without(state, "requests"))).toEqual({ ok: false, field: "requests" });
    },
  );

  // Likewise a database without the game's question list (before *_question_list_review.sql): not read as "no list".
  it.each([{ state: REVEALED }, { state: SKIPPED }, { state: CLOSED }])(
    "names question_list when a $state.status room's state has none",
    ({ state }) => {
      expect(parseLobbyState(without(state, "question_list"))).toEqual({ ok: false, field: "question_list" });
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
    { field: "question_list", state: withList([]) },
    { field: "question_list", state: withList("na-co-dzien-001") },
    { field: "question_list.entries", state: withList({ base_count: 15 }) },
    { field: "question_list.entries", state: withList({ entries: {}, base_count: 15 }) },
    { field: "question_list.entries", state: withList({ entries: [null], base_count: 15 }) },
    { field: "question_list.entries.position", state: withEntry({ position: 0 }) },
    { field: "question_list.entries.position", state: withEntry({ position: 1.5 }) },
    { field: "question_list.entries.position", state: withEntry({ position: "3" }) },
    { field: "question_list.entries.position", state: withEntry({ position: undefined }) },
    { field: "question_list.entries.question_id", state: withEntry({ question_id: 3 }) },
    { field: "question_list.entries.question_id", state: withEntry({ question_id: undefined }) },
    { field: "question_list.entries.text", state: withEntry({ text: 1 }) },
    { field: "question_list.entries.text", state: withEntry({ text: undefined }) },
    // An entry with neither a question id nor a text is no question at all.
    { field: "question_list.entries.question_id", state: withEntry({ question_id: null, text: null }) },
    { field: "question_list.base_count", state: withList({ entries: [] }) },
    { field: "question_list.base_count", state: withList({ entries: [], base_count: -1 }) },
    { field: "question_list.base_count", state: withList({ entries: [], base_count: "15" }) },
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

  it.each(["number", "question_id", "question_text", "phase", "eligible", "voted", "me_voted", "after_skip"])(
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

  it.each(["number", "question_id", "question_text", "phase", "results", "abstained", "ballots"])(
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
    { field: "round.question_text", round: { ...OWN_ROUND, question_text: 1 } },
    // A round with neither a question id nor a text has no question to show at all.
    { field: "round.question_id", round: { ...VOTING_ROUND, question_id: null } },
    { field: "round.question_id", round: { ...REVEALED_ROUND, question_id: null } },
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
    { field: "round.question_text", round: { ...SKIPPED_ROUND, question_text: OWN_QUESTION } },
  ])("names $field for a skipped round that carries it", ({ field, round }) => {
    expect(parseLobbyState(withRound(SKIPPED, round))).toEqual({ ok: false, field });
  });

  // Anonymity (test-plan #1): a key outside the contract, such as counts before the reveal, never reaches a screen,
  // even if the database sent one; nor does anything of the game's question list beyond its entries and base_count (a
  // removed entry, the room's id).
  it("passes on no key outside the contract", () => {
    const host = { ...VOTING, role: "host", me: "Ola" };
    const leaky = {
      ...host,
      link_token: "planted",
      round: { ...VOTING_ROUND, tally: { Ola: 2 }, votes: 2, list_position: 1 },
      players: [{ nick: "Ola", host: true, id: "planted" }],
      request_tokens: ["planted"],
      question_list: {
        ...QUESTION_LIST,
        removed: [{ position: 2, question_id: "na-co-dzien-002" }],
        entries: [{ ...QUESTION_LIST.entries[0], removed: false, room_id: "planted" }],
      },
    };

    expect(parseLobbyState(leaky)).toEqual({
      ok: true,
      value: {
        ...host,
        players: [{ nick: "Ola", host: true }],
        question_list: { entries: [QUESTION_LIST.entries[0]], base_count: 15 },
      },
    });
  });
});

// The Worker's view keeps question_list to itself and adds questionsLeft and questions. questionsLeft: for the host
// once the latest round is revealed or skipped, whether the game has a question not played yet; null in every other
// state and for a guest. questions: the game's question list for its host in the lobby, as text; null otherwise.
function view(
  state: Record<string, unknown>,
  questionsLeft: boolean | null = null,
  questions: unknown[] | null = null,
): Record<string, unknown> {
  return { ...without(state, "question_list"), questionsLeft, questions };
}

// QUESTION_LIST as the host's screen gets it: the host's own text of an entry, else its text from the base.
const QUESTIONS = [
  { position: 1, text: REWORDED, own: true },
  { position: 3, text: "zjadłby na śniadanie wczorajszą pizzę prosto z lodówki", own: false },
  { position: 16, text: OWN_QUESTION, own: true },
];

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
    { why: "a round of a reworded question", state: view(withRound(OWN, { ...OWN_ROUND, question: REWORDED })) },
    {
      why: "a revealed round of an own question",
      state: view(withRound(OWN_REVEALED, { ...OWN_REVEALED_ROUND, question: OWN_QUESTION }), false),
    },
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
    { why: "the game's question list", state: view(LOBBY_WITH_LIST, null, QUESTIONS) },
    { why: "a list whose every entry is removed", state: view(LOBBY_WITH_LIST, null, []) },
  ])("accepts the host's lobby with $why", ({ state }) => {
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
    { why: "missing", state: { ...without(LOBBY, "question_list"), questions: null } },
    { why: "not true, false or null", state: { ...view(LOBBY), questionsLeft: "yes" } },
    { why: "a number", state: { ...view(LOBBY), questionsLeft: 3 } },
  ])("names questionsLeft when it is $why", ({ state }) => {
    expect(parseRoomView(state)).toEqual({ ok: false, field: "questionsLeft" });
  });

  // The list is reviewed before the start only, and only by the host: anyone else's view, and the host's in a game in
  // play, carries none.
  it.each([
    { why: "missing", state: without(view(LOBBY), "questions") },
    { why: "not an array", state: { ...view(LOBBY), questions: "na-co-dzien-001" } },
    { why: "an object", state: { ...view(LOBBY), questions: { 1: REWORDED } } },
    { why: "an entry that is not an object", state: view(LOBBY, null, [null]) },
    { why: "a guest's in the lobby", state: view({ ...LOBBY, role: "guest", me: "Bartek" }, null, QUESTIONS) },
    {
      why: "the host's in a game in play",
      state: view(withRound(REVEALED, { ...REVEALED_ROUND, question: QUESTION }), true, QUESTIONS),
    },
    { why: "the host's in a closed room", state: view({ ...CLOSED, role: "host", me: "Ola" }, null, QUESTIONS) },
  ])("names questions when it is $why", ({ state }) => {
    expect(parseRoomView(state)).toEqual({ ok: false, field: "questions" });
  });

  it.each([
    { field: "questions.position", entry: { ...QUESTIONS[0], position: 0 } },
    { field: "questions.position", entry: { ...QUESTIONS[0], position: "1" } },
    { field: "questions.text", entry: { ...QUESTIONS[0], text: null } },
    { field: "questions.text", entry: { ...QUESTIONS[0], text: 1 } },
    { field: "questions.own", entry: { ...QUESTIONS[0], own: "yes" } },
    { field: "questions.own", entry: { position: 1, text: REWORDED } },
  ])("names $field for a wrong value", ({ field, entry }) => {
    expect(parseRoomView(view(LOBBY_WITH_LIST, null, [entry]))).toEqual({ ok: false, field });
  });

  // The browser never gets question_list itself, nor anything of a question beyond its position, text and whether it
  // is the host's own.
  it("passes on no question_list and no key outside the contract", () => {
    const leaky = {
      ...view(LOBBY_WITH_LIST, null, [{ ...QUESTIONS[1], question_id: "na-co-dzien-003", removed: false }]),
      question_list: QUESTION_LIST,
    };

    expect(parseRoomView(leaky)).toEqual({ ok: true, value: view(LOBBY_WITH_LIST, null, [QUESTIONS[1]]) });
  });

  it("names the field the lobby parser names", () => {
    expect(parseRoomView(view({ ...LOBBY, status: "paused" }))).toEqual({ ok: false, field: "status" });
  });
});

// The length of an own or reworded question as the database counts it (private.question_text: the nick rule, then
// without the trailing "?" and spaces), for the screen's counter before it sends the text. Written out by hand.
describe("questionLength", () => {
  it.each([
    { text: "wypiłby mleko prosto z kartonu", length: 30 },
    { text: "  wypiłby   mleko prosto z kartonu?  ", length: 30 },
    { text: "wypiłby mleko prosto z kartonu ? ?", length: 30 },
    // "o" with a combining accent is one "ó" after NFC.
    { text: "zjadłby góralski", length: 16 },
    { text: "zjadłby pizzę 🍕", length: 15 },
    { text: "???", length: 0 },
    { text: "", length: 0 },
  ])("counts $length characters in $text", ({ text, length }) => {
    expect(questionLength(text)).toBe(length);
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
