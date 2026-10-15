// risk: test-plan.md #2 and #3, the round on the players' screens: everyone in the room sees the same question, every
// vote goes through a screen, and everyone sees the same reveal, with counts that follow the votes (PRD FR-009, US-01).
// No time is measured here: the 2 s budget is the probe's, on production (test-plan §6.4, "No 2 s here").
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { joinRoom, newGuestContext, openRoom, playerRow, uniqueNick } from "./support/room";
import {
  castVote,
  expectReveal,
  ROUND_UPDATE_MS,
  roundQuestion,
  startGame,
  voteConfirmation,
  type ExpectedReveal,
} from "./support/round";

test.describe("risks #2 and #3 (round) — three players play one round on their own screens", () => {
  test("the host and two guests see the same question and the same reveal, with counts that follow their votes", async ({
    page,
    browser,
    baseURL,
  }) => {
    // Three browsers, two joins and three votes take longer than the default 30 s on a slow runner.
    test.slow();

    // Setup: the signed-in host opens a fresh room; guests A and B join it from browsers of their own.
    const room = await openRoom(page, baseURL);
    const nickA = uniqueNick("Ola");
    const nickB = uniqueNick("Kuba");
    const guestA = await newGuestContext(browser);
    const guestB = await newGuestContext(browser);
    const pageA = await guestA.newPage();
    const pageB = await guestB.newPage();
    await joinRoom(pageA, room.link, nickA);
    await joinRoom(pageB, room.link, nickB);
    await expect(playerRow(page, nickA)).toBeVisible();
    await expect(playerRow(page, nickB)).toBeVisible();

    // Action: the host starts the game.
    await startGame(page);

    // Assertion: all three screens show the same question.
    await expect(roundQuestion(page)).toBeVisible({ timeout: ROUND_UPDATE_MS });
    const question = (await roundQuestion(page).textContent()) ?? "";
    await expect(roundQuestion(pageA)).toHaveText(question, { timeout: ROUND_UPDATE_MS });
    await expect(roundQuestion(pageB)).toHaveText(question, { timeout: ROUND_UPDATE_MS });

    // Action: the host votes for A, A for themselves (allowed, FR-009), and B abstains. Each screen confirms its own
    // vote; B's vote is the last one, which reveals the round by itself, so no one presses "Odsłoń wynik".
    await castVote(page, nickA);
    await expect(voteConfirmation(page)).toContainText(`Twój głos: ${nickA}.`);
    await castVote(pageA, nickA);
    await expect(voteConfirmation(pageA)).toContainText(`Twój głos: ${nickA}.`);
    await castVote(pageB, null);

    // Assertion: every screen shows the same reveal. Oracle, from the votes above: A 2, the host 0, B 0, one abstention.
    const reveal: ExpectedReveal = {
      question,
      votes: [
        [nickA, 2],
        [room.hostNick, 0],
        [nickB, 0],
      ],
      abstained: 1,
    };
    for (const [who, screen] of [
      ["the host", page],
      ["guest A", pageA],
      ["guest B", pageB],
    ] as const) {
      await test.step(`${who} sees the reveal`, async () => {
        await expectReveal(screen, reveal);
      });
    }

    // Cleanup: both guests' browsers close. The room, its players and the round's counts stay in the database, because
    // nothing can delete them yet (S-13). CI runs on a throwaway local Supabase; unique nicks keep runs apart.
    await guestA.close();
    await guestB.close();
  });
});
