import type { QuestionId } from "@/data/questions";
import { anonClient, newPlayerToken, type Host, type TestClient } from "./clients";
import { isRecord } from "./rooms";

// The round's contract (context/archive/2026-10-13-first-live-round/plan.md, Faza 1 #4) and the evening's
// (context/archive/2026-10-15-full-game-evening/plan.md, Faza 1 #2), called through the roles' own doors: start_game,
// reveal_round, next_round, skip_round and end_game as the signed-in host, cast_vote as a guest with its player token
// or as the host by its session, room_lobby as either. supabase/migrations/*_first_live_round.sql implements the
// round and *_full_game_evening.sql the evening (S-03, phase 2); before a function exists, PostgREST answers its call
// with PGRST202 (no such function), the expected red of phase 1.
//
// seed* helpers throw on any failure: beforeAll only, as in rooms.ts. The other calls are probes: they return
// { data, error } and never throw, so a test checks the exact answer, a refusal included.
//
// start_game(p_room_id uuid, p_question_id text): authenticated only. { ok: true } or { ok: false, reason } with
//   reason in room_unknown, room_closed, game_started, not_enough_players, invalid_question; another host's room is
//   room_unknown. Opens round 1 only.
// cast_vote(p_room_id uuid, p_target text, p_player_token text default null, p_round integer default null): anon and
//   authenticated, in one version only (S-03 drops the one without p_round). The voter is the host by auth.uid() or a
//   guest by token, as in room_lobby. p_target is a nick of the room or null (an abstention). p_round is the number of
//   the question the voter saw; without it (the Worker deployed before S-03) the vote goes to the latest round.
//   { ok: true } and nothing else, or { ok: false, reason } with reason in room_unknown, room_closed, no_round,
//   round_revealed, round_over (the round was skipped, or p_round is not the latest round's number), already_voted,
//   unknown_target. A malformed token raises 22023, as in join_room.
// reveal_round(p_room_id uuid): authenticated only. { ok: true }, also when already revealed, or { ok: false, reason }
//   with reason in room_unknown, room_closed, no_round.
// next_round(p_room_id uuid, p_round integer, p_candidates text[]): authenticated only. "Następne pytanie": p_round is
//   the number of the round on the host's screen, which must be the latest one, revealed or skipped; the new round
//   takes the first candidate not yet played in this room. { ok: true } or { ok: false, reason } with reason in
//   room_unknown, room_closed, no_round (a lobby), round_over (another number), round_in_progress (still voting),
//   no_questions (every candidate played; no new round).
// skip_round(p_room_id uuid, p_round integer, p_candidates text[]): authenticated only. "Pomiń pytanie", only while
//   round p_round, the latest one, is voting: its votes are gone, it stays as a skipped row, and the next round opens
//   as in next_round. { ok: true }, also when no candidate is left (the skipped round stays the latest one), or
//   { ok: false, reason } with reason in room_unknown, room_closed, no_round, round_over (another number, or skipped
//   already), round_revealed.
// end_game(p_room_id uuid): authenticated only. "Zakończ grę" while the game is in play: the room is closed and its
//   round's in-progress state deleted. { ok: true } or { ok: false, reason } with reason in room_unknown, room_closed,
//   no_round (a lobby).
// room_lobby: the fields of S-01 plus round, with exactly the keys below: a skipped round shows only its number and
//   phase, and a voting round says whether the round before it was skipped (after_skip). room_link of a game in play:
//   { status: "started", room_id }. join_room into a game in play: reason game_started.

// Real question ids from the base, in the first of the seed categories (SEED_CATEGORIES in rooms.ts) and not 18+:
// `satisfies` makes the build fail if an id ever leaves the base. The database checks only the id's format.
export const QUESTION_ID = "na-co-dzien-001" satisfies QuestionId;
export const OTHER_QUESTION_ID = "na-co-dzien-002" satisfies QuestionId;
// An evening's questions, in the order of the base: the scenarios pass them as candidates and expect the first one not
// yet played, written out by hand.
export const EVENING_QUESTION_IDS = [
  "na-co-dzien-001",
  "na-co-dzien-002",
  "na-co-dzien-003",
  "na-co-dzien-004",
] as const satisfies readonly QuestionId[];

// Exact key sets, sorted, of room_lobby and its round. A key outside these lists is a possible leak (counts before the
// reveal, a voter next to a target) until a decision adds it here.
export const LOBBY_KEYS = ["me", "players", "role", "round", "status"];
export const PLAYER_KEYS = ["host", "nick"];
// voted: nicks in seat order, never in the order of voting. after_skip: whether the round before this one was skipped,
// public to everyone and tied to no one's vote.
export const VOTING_ROUND_KEYS = ["after_skip", "me_voted", "number", "phase", "question_id", "voted"];
// results: every eligible player in seat order, zeros included; counts only, per nick.
export const REVEALED_ROUND_KEYS = ["abstained", "ballots", "number", "phase", "question_id", "results"];
export const RESULT_KEYS = ["nick", "votes"];
// A skipped round: its votes are gone, so nothing of them is left to show, not even who voted.
export const SKIPPED_ROUND_KEYS = ["number", "phase"];

export interface Answer {
  data: unknown;
  // Kept whole for the log. A refusal by grant is code 42501 with the function's name in message; details would carry a
  // row's values (Postgres DETAIL), which no round call may send back.
  error: { code: string; message: string; details: string | null; hint: string | null } | null;
}

async function call(client: TestClient, fn: string, args: Record<string, unknown>): Promise<Answer> {
  const result = await client.rpc(fn, args);
  const data: unknown = result.data;
  const error = result.error
    ? {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details || null,
        hint: result.error.hint || null,
      }
    : null;
  return { data, error };
}

export function startGame(client: TestClient, roomId: string, questionId: string): Promise<Answer> {
  return call(client, "start_game", { p_room_id: roomId, p_question_id: questionId });
}

// The host votes by its session (no token); a guest sends its player token. null target: an abstention. round: the
// number of the question the voter saw; without it the call carries no p_round at all, exactly as the Worker deployed
// before S-03 sends it.
export function castVote(
  client: TestClient,
  roomId: string,
  target: string | null,
  playerToken?: string,
  round?: number,
): Promise<Answer> {
  return call(client, "cast_vote", {
    p_room_id: roomId,
    p_target: target,
    ...(playerToken === undefined ? {} : { p_player_token: playerToken }),
    ...(round === undefined ? {} : { p_round: round }),
  });
}

export function revealRound(client: TestClient, roomId: string): Promise<Answer> {
  return call(client, "reveal_round", { p_room_id: roomId });
}

// round: the number of the round on the host's screen. candidates: the game's pool in the Worker's order.
export function nextRound(client: TestClient, roomId: string, round: number, candidates: string[]): Promise<Answer> {
  return call(client, "next_round", { p_room_id: roomId, p_round: round, p_candidates: candidates });
}

export function skipRound(client: TestClient, roomId: string, round: number, candidates: string[]): Promise<Answer> {
  return call(client, "skip_round", { p_room_id: roomId, p_round: round, p_candidates: candidates });
}

export function endGame(client: TestClient, roomId: string): Promise<Answer> {
  return call(client, "end_game", { p_room_id: roomId });
}

export function roomLobby(client: TestClient, roomId: string, playerToken?: string): Promise<Answer> {
  return call(client, "room_lobby", {
    p_room_id: roomId,
    ...(playerToken === undefined ? {} : { p_player_token: playerToken }),
  });
}

export function roomLink(linkToken: string): Promise<Answer> {
  return call(anonClient(), "room_link", { p_link_token: linkToken });
}

// A new guest on a new phone, with a fresh player token like the Worker's cookie.
export function joinRoom(linkToken: string, nick: string): Promise<Answer> {
  return call(anonClient(), "join_room", { p_link_token: linkToken, p_nick: nick, p_player_token: newPlayerToken() });
}

// The function's own refusal code, never its arguments: they hold nicks, vote targets and tokens.
function refusalOf(answer: Answer): string {
  if (answer.error) return answer.error.code;
  return isRecord(answer.data) && typeof answer.data.reason === "string" ? answer.data.reason : "an unexpected shape";
}

function accepted(answer: Answer): boolean {
  return answer.error === null && isRecord(answer.data) && answer.data.ok === true;
}

// "Zacznij grę" as the host. Throws on any failure: beforeAll only.
export async function seedStartGame(host: Host, roomId: string, questionId: string = QUESTION_ID): Promise<void> {
  const answer = await startGame(host.client, roomId, questionId);
  if (!accepted(answer)) {
    throw new Error(`start_game refused the seed round: ${refusalOf(answer)}`);
  }
}

// A vote that is a precondition, not the thing under test. Throws on any failure: beforeAll only.
export async function seedVote(
  client: TestClient,
  roomId: string,
  target: string | null,
  playerToken?: string,
): Promise<void> {
  const answer = await castVote(client, roomId, target, playerToken);
  if (!accepted(answer)) {
    throw new Error(`cast_vote refused the seed vote: ${refusalOf(answer)}`);
  }
}

// "Odsłoń wynik" as the host, as a precondition. Throws on any failure: beforeAll only.
export async function seedReveal(host: Host, roomId: string): Promise<void> {
  const answer = await revealRound(host.client, roomId);
  if (!accepted(answer)) {
    throw new Error(`reveal_round refused the seed reveal: ${refusalOf(answer)}`);
  }
}

// "Następne pytanie" as the host, as a precondition. Throws on any failure: beforeAll only.
export async function seedNextRound(host: Host, roomId: string, round: number, candidates: string[]): Promise<void> {
  const answer = await nextRound(host.client, roomId, round, candidates);
  if (!accepted(answer)) {
    throw new Error(`next_round refused the seed round: ${refusalOf(answer)}`);
  }
}

// "Pomiń pytanie" as the host, as a precondition. Throws on any failure: beforeAll only.
export async function seedSkipRound(host: Host, roomId: string, round: number, candidates: string[]): Promise<void> {
  const answer = await skipRound(host.client, roomId, round, candidates);
  if (!accepted(answer)) {
    throw new Error(`skip_round refused the seed skip: ${refusalOf(answer)}`);
  }
}

// The round of a room_lobby answer, or null when there is none (a failed call included). Never throws.
export function roundOf(answer: Answer): Record<string, unknown> | null {
  const round: unknown = isRecord(answer.data) ? answer.data.round : null;
  return isRecord(round) ? round : null;
}

// Sorted keys of a record, for the exact key-set checks; [] for anything else. Never throws.
export function keysOf(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value).sort() : [];
}
