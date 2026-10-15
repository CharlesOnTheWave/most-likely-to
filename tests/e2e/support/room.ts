// Room steps shared by the E2E specs. Setup goes through the app's own endpoints; the steps a player takes go
// through the screen, by role and accessible name.

import { expect, type Browser, type BrowserContext, type Locator, type Page, type Response } from "@playwright/test";
import { CATEGORIES } from "../../../src/data/questions";

const ROOM_PATH = /^\/r\/([0-9a-f-]{36})$/;

export interface OpenRoom {
  id: string;
  // The host's own nick in the room's list (the round's specs need it for the host's row in the reveal).
  hostNick: string;
  // The guests' link, as the host's screen shows it.
  link: string;
  // Taken just before the host's screen loads, so `Date.now() - openedAt` is never shorter than the time since the
  // screen started polling.
  openedAt: number;
}

// A nick no earlier run used: rooms and players stay in the database (nothing deletes them until S-13).
// At most 20 characters (the nick rule).
export function uniqueNick(prefix: string): string {
  return `${prefix} ${Date.now().toString(36).slice(-5)}${String(Math.floor(Math.random() * 100))}`;
}

// Setup, not the risk: the signed-in host opens a fresh room through the endpoint behind "Załóż grę". confirm_close=1
// closes a room left open by an earlier test or retry instead of stopping at the question. Then the host's screen
// opens the room and waits for its first list fetch: the screen fetches when its channel subscribes and otherwise only
// at its first poll, so a bell rung before that moment could not be told from the fetch.
export async function openRoom(page: Page, baseURL: string | undefined): Promise<OpenRoom> {
  if (!baseURL) throw new Error("baseURL is not set (playwright.config.ts)");
  const hostNick = uniqueNick("Host");
  const response = await page.request.post("/api/rooms", {
    form: { nick: hostNick, category: CATEGORIES[0].id, confirm_close: "1" },
    // Astro refuses a form POST from another origin.
    headers: { Origin: baseURL },
  });
  await expect(response).toBeOK();
  const id = ROOM_PATH.exec(new URL(response.url()).pathname)?.[1];
  expect(id, `"Załóż grę" did not end in a room: ${new URL(response.url()).pathname}`).toBeDefined();
  const roomId = id ?? "";

  const subscribed = nextListFetch(page, roomId);
  const openedAt = Date.now();
  await page.goto(`/r/${roomId}`);
  await subscribed;
  const link = await page.getByRole("textbox", { name: "Link dla graczy" }).inputValue();
  return { id: roomId, hostNick, link, openedAt };
}

// The screen's next successful fetch of the room's list. Before the first poll, the only fetch is the one a screen makes
// when its channel subscribes, so awaiting it means the screen is listening. Start waiting before the screen loads.
export function nextListFetch(page: Page, roomId: string): Promise<Response> {
  return page.waitForResponse((res) => new URL(res.url()).pathname === `/api/rooms/${roomId}/lobby` && res.ok());
}

// A guest has no account: a browser context with no cookies. A context made with browser.newContext() inside a test
// inherits the project's `use`, the host's saved session included, so the session is cleared explicitly.
export function newGuestContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ storageState: { cookies: [], origins: [] } });
}

// The join form is a React island: input typed before it hydrates is dropped. Joining again from the same browser
// only goes back to the room (src/pages/api/rooms/join.ts), so fill + submit can be retried until the guest is in.
export async function joinRoom(page: Page, link: string, nick: string): Promise<void> {
  await page.goto(link);
  await expect(async () => {
    if (ROOM_PATH.test(new URL(page.url()).pathname)) return;
    await page.getByRole("textbox", { name: "Twój nick" }).fill("");
    await page.getByRole("textbox", { name: "Twój nick" }).fill(nick);
    await page.getByRole("button", { name: "Dołącz", exact: true }).click();
    await page.waitForURL((url) => ROOM_PATH.test(url.pathname), { timeout: 5_000 });
  }).toPass();
  await expect(page.getByRole("heading", { name: `Jesteś w grze jako ${nick}` })).toBeVisible();
}

// One player's row in the room's list ("Gracze (N)").
export function playerRow(page: Page, nick: string): Locator {
  return page
    .getByRole("region", { name: /^Gracze/ })
    .getByRole("listitem")
    .filter({ hasText: nick });
}
