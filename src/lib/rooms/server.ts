import type { SupabaseClient } from "@supabase/supabase-js";
import { ringRoom } from "@/lib/live-sync/server";
import { logEvent } from "@/lib/log";
import { questionPool, questionText, type QuestionSelection } from "@/lib/rounds/draw";
import { parseLobbyState, type LobbyState, type RoomView } from "@/lib/rooms/shared";

// Every database call of the room screens, in one place. The functions come from supabase/migrations/*_room_lobby.sql,
// *_first_live_round.sql, *_full_game_evening.sql and *_round_number_required.sql; failures come back as codes for the
// URL or the JSON answer (src/lib/rooms/errors.ts).
// Logs go only through src/lib/log.ts, never with an RPC's arguments: they hold nicks, player tokens, link codes and
// a vote's target.

export interface RoomFailure {
  ok: false;
  reason: string;
}

// A game's action (start, vote, reveal, next, skip, end): the database answers { ok: true } and nothing else, or its
// refusal.
export type ActionResult = { ok: true } | RoomFailure;

export type CreateRoomResult = { ok: true; roomId: string; closedRoomId: string | null } | RoomFailure;
// "started": a game in play; the /j/<code> page lets the room's own players back in. One member per status, so a
// check of one status narrows the rest.
export type RoomLinkResult =
  | { ok: true; status: "open"; roomId: string }
  | { ok: true; status: "started"; roomId: string }
  | { ok: true; status: "closed" }
  | { ok: true; status: "unknown" }
  | RoomFailure;
export type JoinRoomResult = { ok: true; roomId: string } | RoomFailure;
// lobby is null for anyone who is neither the host nor a player of the room, and for a room that does not exist.
export type RoomLobbyResult = { ok: true; lobby: LobbyState | null } | RoomFailure;
// selection is null when the signed-in user does not see the room (not its host, or no such room).
export type RoomCategoriesResult = { ok: true; selection: QuestionSelection | null } | RoomFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

// postgrest-js turns a failed fetch (network, DNS, timeout) into status 0, code "" and "<name>: <message>" as the
// message. Only the name is kept, and only when it looks like one: the rest may echo the request.
function transportErrorName(message: string): string | undefined {
  return /^([A-Za-z]{1,64}):/.exec(message)?.[1];
}

// Never logs the arguments or the error message: they can hold a nick, a player token, a link code or a vote's target.
// A network error (status 0) or a 5xx means Supabase itself is down, e.g. a paused project.
function logFailure(failure: { op: string; roomId?: string; status: number; code?: string; errName?: string }) {
  logEvent("error", failure);
  return {
    ok: false as const,
    reason: failure.status === 0 || failure.status >= 500 ? "service_unavailable" : "unexpected",
  };
}

// A query's or an RPC's own error: its status and SQLSTATE (or PostgREST code), never its message or details.
function queryFailure(
  op: string,
  roomId: string | undefined,
  result: { status: number; error: { code: string; message: string } },
): RoomFailure {
  return logFailure({
    op,
    roomId,
    status: result.status,
    code: result.error.code,
    errName: result.status === 0 ? transportErrorName(result.error.message) : undefined,
  });
}

// Always a POST: rpc(…, { get: true }) would put the arguments, a guest's token or a vote's target among them, into the
// URL and the logs.
async function callRpc(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
  roomId?: string,
): Promise<{ ok: true; data: unknown } | RoomFailure> {
  try {
    const result = await supabase.rpc(fn, args);
    if (result.error) {
      return queryFailure(fn, roomId, result);
    }
    const data: unknown = result.data;
    return { ok: true, data };
  } catch (error) {
    return logFailure({ op: fn, roomId, status: 0, errName: errorName(error) });
  }
}

// field: the part of the answer that did not pass, so a database and a Worker out of step say where (audit P6).
function unexpectedShape(op: string, field: string, roomId?: string): RoomFailure {
  logEvent("error", { op, step: "shape", field, roomId });
  return { ok: false, reason: "unexpected" };
}

// The function's own refusal ({ok: false, reason}) passes through as is: its reasons are the codes in errors.ts.
function refusal(data: Record<string, unknown>): RoomFailure | null {
  return data.ok === false && typeof data.reason === "string" ? { ok: false, reason: data.reason } : null;
}

export async function createRoom(
  supabase: SupabaseClient,
  input: { nick: string; linkToken: string; categories: string[]; adultCategories: string[]; confirmClose: boolean },
): Promise<CreateRoomResult> {
  const result = await callRpc(supabase, "create_room", {
    p_nick: input.nick,
    p_link_token: input.linkToken,
    p_categories: input.categories,
    p_adult_categories: input.adultCategories,
    p_confirm_close: input.confirmClose,
  });
  if (!result.ok) return result;

  const { data } = result;
  if (!isRecord(data)) return unexpectedShape("create_room", "root");
  if (data.ok === true && typeof data.room_id === "string") {
    return {
      ok: true,
      roomId: data.room_id,
      closedRoomId: typeof data.closed_room_id === "string" ? data.closed_room_id : null,
    };
  }
  return refusal(data) ?? unexpectedShape("create_room", "ok");
}

export async function roomLink(supabase: SupabaseClient, linkToken: string): Promise<RoomLinkResult> {
  const result = await callRpc(supabase, "room_link", { p_link_token: linkToken });
  if (!result.ok) return result;

  const { data } = result;
  if (!isRecord(data)) return unexpectedShape("room_link", "root");
  const { status, room_id: roomId } = data;
  if (status === "open" || status === "started") {
    return typeof roomId === "string" ? { ok: true, status, roomId } : unexpectedShape("room_link", "room_id");
  }
  if (status === "closed" || status === "unknown") {
    return { ok: true, status };
  }
  return unexpectedShape("room_link", "status");
}

export async function joinRoom(
  supabase: SupabaseClient,
  input: { linkToken: string; nick: string; playerToken: string },
): Promise<JoinRoomResult> {
  const result = await callRpc(supabase, "join_room", {
    p_link_token: input.linkToken,
    p_nick: input.nick,
    p_player_token: input.playerToken,
  });
  if (!result.ok) return result;

  const { data } = result;
  if (!isRecord(data)) return unexpectedShape("join_room", "root");
  if (data.ok === true && typeof data.room_id === "string") {
    return { ok: true, roomId: data.room_id };
  }
  return refusal(data) ?? unexpectedShape("join_room", "ok");
}

// The host is recognised by the session (auth.uid()), a guest by the token from their cookie.
export async function roomLobby(
  supabase: SupabaseClient,
  roomId: string,
  playerToken?: string | null,
): Promise<RoomLobbyResult> {
  const result = await callRpc(
    supabase,
    "room_lobby",
    { p_room_id: roomId, p_player_token: playerToken ?? null },
    roomId,
  );
  if (!result.ok) return result;

  if (result.data === null) return { ok: true, lobby: null };
  const parsed = parseLobbyState(result.data);
  return parsed.ok ? { ok: true, lobby: parsed.value } : unexpectedShape("room_lobby", parsed.field, roomId);
}

const QUESTION_ID_PATTERN = /^[a-z0-9-]+-[0-9]{3}$/;

// The room's state for its screen: the round gets its question's text from the base, on the server only
// (context/foundation/lessons.md, "Pytania gry tylko po stronie serwera"). A question the base does not have (the
// database checks only the id's format) goes out as null: the round goes on, the screen says it could not load the
// question, and the log says which id. A skipped round has no question to show. questionsLeft from hostQuestionsLeft.
export function roomView(lobby: LobbyState, roomId: string, questionsLeft: boolean | null): RoomView {
  const { round } = lobby;
  if (round === null || round.phase === "skipped") return { ...lobby, round, questionsLeft };
  const question = questionText(round.question_id);
  if (question === null) {
    const code = QUESTION_ID_PATTERN.test(round.question_id) ? round.question_id : undefined;
    logEvent("error", { op: "question_text", step: "unknown_question", roomId, code });
  }
  return { ...lobby, round: { ...round, question }, questionsLeft };
}

// For the host once the latest round is revealed or skipped: whether the game's pool has a question not played yet,
// so the screen offers "Następne pytanie" or says the questions ran out. Each round of a game has its own question of
// the pool (FR-015), so round N has played N of them. null in every other state, for a guest, and when the room's
// categories could not be read (logged by hostRoomCategories). On null the two screens differ on purpose: after a
// reveal (RoundReveal) the screen still offers "Następne pytanie", and the database answers no_questions if none is
// left; a skipped latest round (RoundSkipped) offers only "Zakończ grę", because skip_round opens the next question
// whenever there is one, so a skip that stayed the latest round means the pool had run out.
export async function hostQuestionsLeft(
  supabase: SupabaseClient,
  lobby: LobbyState,
  roomId: string,
): Promise<boolean | null> {
  const { round } = lobby;
  if (lobby.role !== "host" || lobby.status !== "playing" || round === null || round.phase === "voting") return null;
  const room = await hostRoomCategories(supabase, roomId);
  if (!room.ok || !room.selection) return null;
  return questionPool(room.selection).length > round.number;
}

// A round's answer: { ok: true } and nothing else, or the function's refusal.
function actionResult(fn: string, data: unknown, roomId: string): ActionResult {
  if (!isRecord(data)) return unexpectedShape(fn, "root", roomId);
  if (data.ok === true) return { ok: true };
  return refusal(data) ?? unexpectedShape(fn, "ok", roomId);
}

// "Zacznij grę": the host's session; the question was drawn by the Worker (src/lib/rounds/draw.ts).
export async function startGame(supabase: SupabaseClient, roomId: string, questionId: string): Promise<ActionResult> {
  const result = await callRpc(supabase, "start_game", { p_room_id: roomId, p_question_id: questionId }, roomId);
  return result.ok ? actionResult("start_game", result.data, roomId) : result;
}

// A vote: the host by the session (no token), a guest by the room's cookie. target is a nick of the room or null for
// an abstention; it travels only in this POST's body, and the answer never carries it back. round is the number of the
// question on the voter's screen: another one than the latest round's is round_over.
export async function castVote(
  supabase: SupabaseClient,
  roomId: string,
  target: string | null,
  playerToken: string | null,
  round: number,
): Promise<ActionResult> {
  const result = await callRpc(
    supabase,
    "cast_vote",
    { p_room_id: roomId, p_target: target, p_player_token: playerToken, p_round: round },
    roomId,
  );
  return result.ok ? actionResult("cast_vote", result.data, roomId) : result;
}

// "Odsłoń wynik": the host's session, at any time; a second reveal is ok too. round is the number of the round on the
// host's screen: another one than the latest round's, or a skipped round, is round_over.
export async function revealRound(supabase: SupabaseClient, roomId: string, round: number): Promise<ActionResult> {
  const result = await callRpc(supabase, "reveal_round", { p_room_id: roomId, p_round: round }, roomId);
  return result.ok ? actionResult("reveal_round", result.data, roomId) : result;
}

// "Następne pytanie": the host's session. round is the number of the round on the host's screen, revealed or skipped;
// candidates the game's pool in random order (src/lib/rounds/draw.ts), of which the database opens the first one not
// played yet.
export async function nextRound(
  supabase: SupabaseClient,
  roomId: string,
  round: number,
  candidates: string[],
): Promise<ActionResult> {
  const result = await callRpc(
    supabase,
    "next_round",
    { p_room_id: roomId, p_round: round, p_candidates: candidates },
    roomId,
  );
  return result.ok ? actionResult("next_round", result.data, roomId) : result;
}

// "Pomiń pytanie": the host's session, while round `round` is voting. Its votes are gone, and the next question opens
// at once from candidates, as in nextRound.
export async function skipRound(
  supabase: SupabaseClient,
  roomId: string,
  round: number,
  candidates: string[],
): Promise<ActionResult> {
  const result = await callRpc(
    supabase,
    "skip_round",
    { p_room_id: roomId, p_round: round, p_candidates: candidates },
    roomId,
  );
  return result.ok ? actionResult("skip_round", result.data, roomId) : result;
}

// "Zakończ grę": the host's session, while the game is in play. The room is closed for everyone.
export async function endGame(supabase: SupabaseClient, roomId: string): Promise<ActionResult> {
  const result = await callRpc(supabase, "end_game", { p_room_id: roomId }, roomId);
  return result.ok ? actionResult("end_game", result.data, roomId) : result;
}

// The host's open room, read through RLS: a host has at most one room in the lobby or with a game in play.
export async function hostOpenRoomId(
  supabase: SupabaseClient,
): Promise<{ ok: true; roomId: string | null } | RoomFailure> {
  try {
    const result = await supabase.from("rooms").select("id").in("status", ["lobby", "playing"]).limit(1).maybeSingle();
    if (result.error) {
      return queryFailure("open_room", undefined, result);
    }
    const row: unknown = result.data;
    return { ok: true, roomId: isRecord(row) && typeof row.id === "string" ? row.id : null };
  } catch (error) {
    return logFailure({ op: "open_room", status: 0, errName: errorName(error) });
  }
}

// The room's link code, through RLS: only the host reads it.
export async function hostLinkToken(
  supabase: SupabaseClient,
  roomId: string,
): Promise<{ ok: true; linkToken: string | null } | RoomFailure> {
  try {
    const result = await supabase.from("rooms").select("link_token").eq("id", roomId).maybeSingle();
    if (result.error) {
      return queryFailure("link_code", roomId, result);
    }
    const row: unknown = result.data;
    return { ok: true, linkToken: isRecord(row) && typeof row.link_token === "string" ? row.link_token : null };
  } catch (error) {
    return logFailure({ op: "link_code", roomId, status: 0, errName: errorName(error) });
  }
}

// The categories the host picked for the room, through RLS: only the host reads them. The draw filters them through
// the question base, because the database checks only their shape.
export async function hostRoomCategories(supabase: SupabaseClient, roomId: string): Promise<RoomCategoriesResult> {
  try {
    const result = await supabase.from("rooms").select("categories, adult_categories").eq("id", roomId).maybeSingle();
    if (result.error) {
      return queryFailure("room_categories", roomId, result);
    }
    const row: unknown = result.data;
    if (row === null) return { ok: true, selection: null };
    if (!isRecord(row)) return unexpectedShape("room_categories", "root", roomId);
    const { categories, adult_categories: adultCategories } = row;
    if (!isStringList(categories)) return unexpectedShape("room_categories", "categories", roomId);
    if (!isStringList(adultCategories)) return unexpectedShape("room_categories", "adult_categories", roomId);
    return { ok: true, selection: { categories, adultCategories } };
  } catch (error) {
    return logFailure({ op: "room_categories", roomId, status: 0, errName: errorName(error) });
  }
}

// The part of locals.cfContext (the Worker's ExecutionContext from the Cloudflare adapter) the bell needs. Typed here
// because the project has no Workers types, so the adapter's own type resolves to any.
interface BellLocals {
  cfContext?: { waitUntil(promise: Promise<unknown>): void };
}

// Wakes everyone on the room's channel: they fetch the room's state again. Workers may cut a promise still running
// after the response, so the bell goes through waitUntil; without an execution context it is awaited instead. A failed
// bell is only logged (ringRoom logs it): the players' 15 s polling catches up.
export async function ringLobby(locals: BellLocals, supabase: SupabaseClient, roomId: string): Promise<void> {
  const ring = ringRoom(supabase, roomId, Date.now()).then(
    () => undefined,
    // Only removeChannel's failure gets here; ringRoom catches its own.
    (error: unknown) => {
      logEvent("error", { op: "ring", step: "remove_channel", roomId, errName: errorName(error) });
    },
  );
  if (locals.cfContext) {
    locals.cfContext.waitUntil(ring);
    return;
  }
  await ring;
}
