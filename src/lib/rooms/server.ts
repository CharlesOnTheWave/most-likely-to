import type { SupabaseClient } from "@supabase/supabase-js";
import { ringRoom } from "@/lib/live-sync/server";
import type { LobbyPlayer, LobbyState } from "@/lib/rooms/shared";

// Every database call of the room screens, in one place. The functions come from
// supabase/migrations/*_room_lobby.sql; failures come back as codes for the URL (src/lib/rooms/errors.ts).

export interface RoomFailure {
  ok: false;
  reason: string;
}

export type CreateRoomResult = { ok: true; roomId: string; closedRoomId: string | null } | RoomFailure;
export type RoomLinkResult =
  { ok: true; status: "open"; roomId: string } | { ok: true; status: "closed" | "unknown" } | RoomFailure;
export type JoinRoomResult = { ok: true; roomId: string } | RoomFailure;
// lobby is null for anyone who is neither the host nor a player of the room, and for a room that does not exist.
export type RoomLobbyResult = { ok: true; lobby: LobbyState | null } | RoomFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Never logs the arguments or the error message: they can hold a nick, a player token or a link code. A network error
// (status 0) or a 5xx means Supabase itself is down, e.g. a paused project.
function logFailure(what: string, status: number, code: string): RoomFailure {
  // eslint-disable-next-line no-console
  console.error(`${what} failed:`, { status, code });
  return { ok: false, reason: status === 0 || status >= 500 ? "service_unavailable" : "unexpected" };
}

// Always a POST: rpc(…, { get: true }) would put the arguments, a guest's token among them, into the URL and the logs.
async function callRpc(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | RoomFailure> {
  try {
    const result = await supabase.rpc(fn, args);
    if (result.error) {
      return logFailure(fn, result.status, result.error.code);
    }
    const data: unknown = result.data;
    return { ok: true, data };
  } catch (error) {
    return logFailure(fn, 0, error instanceof Error ? error.name : "unknown");
  }
}

function unexpectedShape(fn: string): RoomFailure {
  // eslint-disable-next-line no-console
  console.error(`${fn} returned an unexpected shape`);
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
  if (!isRecord(data)) return unexpectedShape("create_room");
  if (data.ok === true && typeof data.room_id === "string") {
    return {
      ok: true,
      roomId: data.room_id,
      closedRoomId: typeof data.closed_room_id === "string" ? data.closed_room_id : null,
    };
  }
  return refusal(data) ?? unexpectedShape("create_room");
}

export async function roomLink(supabase: SupabaseClient, linkToken: string): Promise<RoomLinkResult> {
  const result = await callRpc(supabase, "room_link", { p_link_token: linkToken });
  if (!result.ok) return result;

  const { data } = result;
  if (!isRecord(data)) return unexpectedShape("room_link");
  const { status, room_id: roomId } = data;
  if (status === "open" && typeof roomId === "string") {
    return { ok: true, status, roomId };
  }
  if (status === "closed" || status === "unknown") {
    return { ok: true, status };
  }
  return unexpectedShape("room_link");
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
  if (!isRecord(data)) return unexpectedShape("join_room");
  if (data.ok === true && typeof data.room_id === "string") {
    return { ok: true, roomId: data.room_id };
  }
  return refusal(data) ?? unexpectedShape("join_room");
}

function parsePlayer(value: unknown): LobbyPlayer | null {
  if (!isRecord(value) || typeof value.nick !== "string" || typeof value.host !== "boolean") return null;
  return { nick: value.nick, host: value.host };
}

function parseLobby(value: unknown): LobbyState | null {
  if (!isRecord(value)) return null;
  const { status, role, me, players: entries } = value;
  if (status !== "lobby" && status !== "closed") return null;
  if (role !== "host" && role !== "guest") return null;
  if (typeof me !== "string" || !Array.isArray(entries)) return null;

  const players: LobbyPlayer[] = [];
  for (const entry of entries as unknown[]) {
    const player = parsePlayer(entry);
    if (!player) return null;
    players.push(player);
  }
  return { status, role, me, players };
}

// The host is recognised by the session (auth.uid()), a guest by the token from their cookie.
export async function roomLobby(
  supabase: SupabaseClient,
  roomId: string,
  playerToken?: string | null,
): Promise<RoomLobbyResult> {
  const result = await callRpc(supabase, "room_lobby", { p_room_id: roomId, p_player_token: playerToken ?? null });
  if (!result.ok) return result;

  if (result.data === null) return { ok: true, lobby: null };
  const lobby = parseLobby(result.data);
  return lobby ? { ok: true, lobby } : unexpectedShape("room_lobby");
}

// The signed-in host's open room, read through RLS (a host has at most one room in the lobby).
export async function hostOpenRoomId(
  supabase: SupabaseClient,
): Promise<{ ok: true; roomId: string | null } | RoomFailure> {
  try {
    const result = await supabase.from("rooms").select("id").eq("status", "lobby").limit(1).maybeSingle();
    if (result.error) {
      return logFailure("open room", result.status, result.error.code);
    }
    const row: unknown = result.data;
    return { ok: true, roomId: isRecord(row) && typeof row.id === "string" ? row.id : null };
  } catch (error) {
    return logFailure("open room", 0, error instanceof Error ? error.name : "unknown");
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
      return logFailure("link code", result.status, result.error.code);
    }
    const row: unknown = result.data;
    return { ok: true, linkToken: isRecord(row) && typeof row.link_token === "string" ? row.link_token : null };
  } catch (error) {
    return logFailure("link code", 0, error instanceof Error ? error.name : "unknown");
  }
}

// The part of locals.cfContext (the Worker's ExecutionContext from the Cloudflare adapter) the bell needs. Typed here
// because the project has no Workers types, so the adapter's own type resolves to any.
interface BellLocals {
  cfContext?: { waitUntil(promise: Promise<unknown>): void };
}

// Wakes everyone on the room's channel: they fetch the lobby again. Workers may cut a promise still running after the
// response, so the bell goes through waitUntil; without an execution context it is awaited instead. A failed bell is
// only logged (ringRoom logs it): the players' 15 s polling catches up.
export async function ringLobby(locals: BellLocals, supabase: SupabaseClient, roomId: string): Promise<void> {
  const ring = ringRoom(supabase, roomId, Date.now()).then(
    () => undefined,
    (error: unknown) => {
      // eslint-disable-next-line no-console
      console.error("room ring failed:", error instanceof Error ? error.name : "unknown");
    },
  );
  if (locals.cfContext) {
    locals.cfContext.waitUntil(ring);
    return;
  }
  await ring;
}
