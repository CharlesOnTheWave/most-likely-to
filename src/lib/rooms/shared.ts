// Limits and types shared by the server and the room islands. No server imports, so safe in the browser.

export const NICK_MAX_LENGTH = 20;

// S-02 adds the game states.
export type RoomStatus = "lobby" | "closed";

export interface LobbyPlayer {
  nick: string;
  host: boolean;
}

// What room_lobby returns: nicks in join order, no ids, hashes or link code.
export interface LobbyState {
  status: RoomStatus;
  role: "host" | "guest";
  me: string;
  players: LobbyPlayer[];
}

// Length as the database counts it (characters, not UTF-16 units, so an emoji is one), after the part of the nick
// rule a browser can apply: NFC, whitespace runs to one space, trimmed edges. The database has the final word.
export function nickLength(nick: string): number {
  return Array.from(nick.normalize("NFC").replace(/\s+/g, " ").trim()).length;
}

export function playerCountLabel(count: number): string {
  return count === 1 ? "1 gracz" : `${count} graczy`;
}
