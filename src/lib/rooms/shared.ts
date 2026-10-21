// Limits, types and the room state's parser, shared by the server and the room islands. No server imports, so safe in
// the browser.

export const NICK_MAX_LENGTH = 20;
// US-01: the host and at least 2 guests, the host votes too. start_game has the final word; the screen only says it.
export const MIN_PLAYERS = 3;

// lobby → playing (start_game) → closed ("Zakończ grę", "Nowa gra" or the sweep of abandoned games).
export type RoomStatus = "lobby" | "playing" | "closed";

export interface LobbyPlayer {
  nick: string;
  host: boolean;
}

// The round's keys as room_lobby names them (context/archive/2026-10-13-first-live-round/plan.md, Faza 1 #4;
// context/archive/2026-10-15-full-game-evening/plan.md, Faza 2 #4). The latest round of the game only. While it is
// open: who has voted, in seat order (never the order of voting), never a count, and whether the round before it was
// skipped (public to everyone, tied to no one's vote).
export interface VotingRound {
  number: number;
  question_id: string;
  phase: "voting";
  voted: string[];
  me_voted: boolean;
  after_skip: boolean;
}

export interface RoundResult {
  nick: string;
  votes: number;
}

// Once revealed: a count for every eligible player in seat order, zeros included, and nothing about who voted how.
export interface RevealedRound {
  number: number;
  question_id: string;
  phase: "revealed";
  results: RoundResult[];
  abstained: number;
  ballots: number;
}

// Skipped while voting, with no question left to open after it: its votes are gone, so only its number and phase.
export interface SkippedRound {
  number: number;
  phase: "skipped";
}

export type RoundState = VotingRound | RevealedRound | SkippedRound;

// What room_lobby returns: nicks in join order, no ids, hashes or link code; a round only while a game is in play.
export interface LobbyState {
  status: RoomStatus;
  role: "host" | "guest";
  me: string;
  players: LobbyPlayer[];
  round: RoundState | null;
}

// What the room screen gets: the round with its question's text, which the Worker adds from the question base. The
// text is the ending after "Kto z nas najprawdopodobniej" (src/data/questions.ts), plain text for the screen. null
// when the base does not have the round's question (the Worker logs which id): the screen then says it could not load
// the question instead of building a sentence around a placeholder. A skipped round shows no question.
export type RoundView = ((VotingRound | RevealedRound) & { question: string | null }) | SkippedRound;

// questionsLeft: for the host once the latest round is revealed or skipped, whether the game's pool has a question not
// played yet ("Następne pytanie" or "Pytań już nie ma. Możesz zakończyć grę."); null in every other state, for a
// guest, and when the Worker could not tell.
export interface RoomView extends LobbyState {
  round: RoundView | null;
  questionsLeft: boolean | null;
}

// A parser's answer: the value with only the contract's keys, or the field that did not pass (a dotted path without
// indexes, e.g. "round.results.votes"), for the log line. Never a value: a field may hold a nick.
export type ParseResult<T> = { ok: true; value: T } | { ok: false; field: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(field: string): { ok: false; field: string } {
  return { ok: false, field };
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function parsePlayers(value: unknown): ParseResult<LobbyPlayer[]> {
  if (!Array.isArray(value)) return fail("players");
  const players: LobbyPlayer[] = [];
  for (const entry of value as unknown[]) {
    if (!isRecord(entry)) return fail("players");
    if (typeof entry.nick !== "string") return fail("players.nick");
    if (typeof entry.host !== "boolean") return fail("players.host");
    players.push({ nick: entry.nick, host: entry.host });
  }
  return { ok: true, value: players };
}

function parseResults(value: unknown): ParseResult<RoundResult[]> {
  if (!Array.isArray(value)) return fail("round.results");
  const results: RoundResult[] = [];
  for (const entry of value as unknown[]) {
    if (!isRecord(entry)) return fail("round.results");
    if (typeof entry.nick !== "string") return fail("round.results.nick");
    if (!isCount(entry.votes)) return fail("round.results.votes");
    results.push({ nick: entry.nick, votes: entry.votes });
  }
  return { ok: true, value: results };
}

// Copies only the contract's keys: a key the database might add by mistake (a count before the reveal) stays here.
// A skipped round is the exception: any key next to its number and phase means its votes were not dropped (decision D3
// of context/archive/2026-10-15-full-game-evening/research.md), so the state is refused.
function parseRound(value: Record<string, unknown>): ParseResult<RoundState> {
  const { number, question_id: questionId, phase } = value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 1) return fail("round.number");
  if (phase !== "voting" && phase !== "revealed" && phase !== "skipped") return fail("round.phase");
  if (phase === "skipped") {
    const extra = Object.keys(value).find((key) => key !== "number" && key !== "phase");
    return extra === undefined ? { ok: true, value: { number, phase } } : fail(`round.${extra}`);
  }
  if (typeof questionId !== "string") return fail("round.question_id");

  if (phase === "voting") {
    if (!isStringList(value.voted)) return fail("round.voted");
    if (typeof value.me_voted !== "boolean") return fail("round.me_voted");
    if (typeof value.after_skip !== "boolean") return fail("round.after_skip");
    return {
      ok: true,
      value: {
        number,
        question_id: questionId,
        phase,
        voted: [...value.voted],
        me_voted: value.me_voted,
        after_skip: value.after_skip,
      },
    };
  }
  const results = parseResults(value.results);
  if (!results.ok) return results;
  if (!isCount(value.abstained)) return fail("round.abstained");
  if (!isCount(value.ballots)) return fail("round.ballots");
  return {
    ok: true,
    value: {
      number,
      question_id: questionId,
      phase,
      results: results.value,
      abstained: value.abstained,
      ballots: value.ballots,
    },
  };
}

// room_lobby's answer (src/lib/rooms/server.ts). A round only while a game is in play, and always one then.
export function parseLobbyState(value: unknown): ParseResult<LobbyState> {
  if (!isRecord(value)) return fail("root");
  const { status, role, me } = value;
  if (status !== "lobby" && status !== "playing" && status !== "closed") return fail("status");
  if (role !== "host" && role !== "guest") return fail("role");
  if (typeof me !== "string") return fail("me");
  const players = parsePlayers(value.players);
  if (!players.ok) return players;

  const { round: rawRound } = value;
  if (rawRound === undefined) return fail("round");
  if (status !== "playing") {
    if (rawRound !== null) return fail("round");
    return { ok: true, value: { status, role, me, players: players.value, round: null } };
  }
  if (!isRecord(rawRound)) return fail("round");
  const round = parseRound(rawRound);
  if (!round.ok) return round;
  return { ok: true, value: { status, role, me, players: players.value, round: round.value } };
}

// The Worker's answer to the room screen (GET /api/rooms/<id>/lobby): room_lobby's state plus the round's question,
// a text or null for a question the base does not have, and questionsLeft.
export function parseRoomView(value: unknown): ParseResult<RoomView> {
  const lobby = parseLobbyState(value);
  if (!lobby.ok) return lobby;
  const questionsLeft = isRecord(value) ? value.questionsLeft : undefined;
  if (typeof questionsLeft !== "boolean" && questionsLeft !== null) return fail("questionsLeft");
  const { round } = lobby.value;
  if (round === null || round.phase === "skipped") return { ok: true, value: { ...lobby.value, round, questionsLeft } };

  const rawRound = isRecord(value) ? value.round : null;
  const question = isRecord(rawRound) ? rawRound.question : undefined;
  if (typeof question !== "string" && question !== null) return fail("round.question");
  return { ok: true, value: { ...lobby.value, round: { ...round, question }, questionsLeft } };
}

// Length as the database counts it (characters, not UTF-16 units, so an emoji is one), after the part of the nick
// rule a browser can apply: NFC, whitespace runs to one space, trimmed edges. The database has the final word.
export function nickLength(nick: string): number {
  return Array.from(nick.normalize("NFC").replace(/\s+/g, " ").trim()).length;
}

export function playerCountLabel(count: number): string {
  return count === 1 ? "1 gracz" : `${count} graczy`;
}

// The round's question as one sentence, for its heading and the screen reader. React renders it as text, never as HTML
// (lessons.md). null: the base did not have the round's question, so the sentence says only that.
export function questionSentence(question: string | null): string {
  return question === null ? "Nie udało się wczytać pytania." : `Kto z nas najprawdopodobniej ${question}?`;
}
