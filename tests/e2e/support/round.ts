// Round steps shared by the E2E specs: the host starts the game, a player votes, a screen's reveal is read. Every step
// goes through the screen, by role and accessible name, as a player would (src/components/room/RoundVoting.tsx,
// RoundReveal.tsx).

import { expect, type Locator, type Page } from "@playwright/test";

// How long a screen may take to show the round's next phase after someone else's action: the bell, the screen's
// limiter (500 ms between fetches, a little more after a bell that found nothing new; src/lib/live-sync/limiter.ts)
// and a slow CI runner. Below LOBBY_POLL_MS (15 s) on purpose: the bell brings the new phase, the poll is not waited for.
export const ROUND_UPDATE_MS = 10_000;

// The round's question as the screen's title, "Kto z nas najprawdopodobniej …?". The text shown when the question
// could not be loaded ("Nie udało się wczytać pytania.") does not match.
export function roundQuestion(page: Page): Locator {
  return page.getByRole("heading", { level: 1, name: /^Kto z nas najprawdopodobniej .+\?$/ });
}

// The host's "Zacznij grę", once the screen allows it (at least 3 players in the list).
export async function startGame(host: Page): Promise<void> {
  const start = host.getByRole("button", { name: "Zacznij grę", exact: true });
  await expect(start).toBeEnabled();
  await start.click();
}

// One player's vote through their own screen: a person from the list, or null for "Wstrzymuję się", then "Zagłosuj".
export async function castVote(page: Page, target: string | null): Promise<void> {
  const choice =
    target === null
      ? page.getByRole("radio", { name: "Wstrzymuję się", exact: true })
      : page.getByRole("radio", { name: target, exact: true });
  await choice.check();
  await page.getByRole("button", { name: "Zagłosuj", exact: true }).click();
}

// The screen's own confirmation of an accepted vote ("Głos oddany"). It stays until the round is revealed, so the last
// vote's confirmation may be gone before anyone looks: check the reveal after that one.
export function voteConfirmation(page: Page): Locator {
  return page.getByRole("alert").filter({ hasText: "Głos oddany" });
}

// The reveal's table under "Wynik": one row per player, nick and votes. It is there in both views ("Koło" and
// "Paski"), so the toggle is never needed to read the counts.
export function resultTable(page: Page): Locator {
  return page.getByRole("region", { name: "Wynik" }).getByRole("table");
}

export interface ExpectedReveal {
  // The question every screen showed while voting.
  question: string;
  // Every player of the round with their count, as the oracle has it.
  votes: [nick: string, count: number][];
  abstained: number;
}

// A screen shows the round's reveal: the same question, exactly these players (header row aside) with these counts,
// and the abstentions. Waits for the reveal to arrive first.
export async function expectReveal(page: Page, expected: ExpectedReveal): Promise<void> {
  const table = resultTable(page);
  await expect(table).toBeVisible({ timeout: ROUND_UPDATE_MS });
  await expect(roundQuestion(page)).toHaveText(expected.question);
  await expect(table.getByRole("row")).toHaveCount(expected.votes.length + 1);
  for (const [nick, count] of expected.votes) {
    const votes = table.getByRole("row").filter({ hasText: nick }).getByRole("cell").last();
    await expect(votes, `votes of ${nick}`).toHaveText(String(count));
  }
  await expect(page.getByText(`Wstrzymało się: ${String(expected.abstained)}`, { exact: true })).toBeVisible();
}
