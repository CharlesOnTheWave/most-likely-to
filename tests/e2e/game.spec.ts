// risk: test-plan.md #2 and #3, the evening on the players' screens: after "Następne pytanie" and after a skip every
// screen shows the same new question, one this game has not played yet (FR-015), ready for a fresh vote; after a skip
// every screen says its votes are gone; "Zakończ grę" ends the evening on every screen (PRD FR-006; decisions D2 and D4
// of context/changes/full-game-evening/research.md). One time is checked: guest B gets the next question from the
// room's bell, before its own poll could have run (test-plan §6.4, "Bell vs poll"). The 2 s budget is the probe's.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { LOBBY_POLL_MS } from "../../src/lib/live-sync/shared";
import { joinRoom, newGuestContext, nextListFetch, openRoom, playerRow, uniqueNick } from "./support/room";
import {
  castVote,
  endGame,
  eveningEnd,
  expectFreshVote,
  nextQuestion,
  resultTable,
  ROUND_UPDATE_MS,
  roundQuestion,
  skipNotice,
  skipQuestion,
  startGame,
  voteConfirmation,
} from "./support/round";

test.describe("risks #2 and #3 (evening) — three players go on to the next question, skip one and end the game", () => {
  test("every screen gets the same new question after Następne pytanie and after a skip, and the end of the evening", async ({
    page,
    browser,
    baseURL,
  }) => {
    // Three browsers, three questions and the end take longer than the default 30 s on a slow runner.
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
    const screens = [
      ["the host", page],
      ["guest A", pageA],
      ["guest B", pageB],
    ] as const;
    const guests = screens.slice(1);

    // Setup: question 1 played to its reveal. A votes for B and B abstains; the host's vote is the last one and
    // reveals the round by itself. The counts are round.spec.ts's; here every screen only has to be on the reveal.
    await startGame(page);
    await expect(roundQuestion(page)).toBeVisible({ timeout: ROUND_UPDATE_MS });
    const question1 = (await roundQuestion(page).textContent()) ?? "";
    for (const [, screen] of guests) {
      await expect(roundQuestion(screen)).toHaveText(question1, { timeout: ROUND_UPDATE_MS });
    }
    await castVote(pageA, nickB);
    await expect(voteConfirmation(pageA)).toBeVisible();
    await castVote(pageB, null);
    await expect(voteConfirmation(pageB)).toBeVisible();
    await castVote(page, nickA);
    for (const [, screen] of screens) {
      await expect(resultTable(screen)).toBeVisible({ timeout: ROUND_UPDATE_MS });
    }

    // Setup: guest B's screen loads again, on the reveal. Its own poll then comes no sooner than LOBBY_POLL_MS after
    // this moment, so a new question before that can only have come with the bell. Waiting for its first fetch means
    // the screen is listening; the wait starts before the reload.
    const listening = nextListFetch(pageB, room.id);
    const loadedB = Date.now();
    await pageB.reload();
    await listening;
    await expect(resultTable(pageB)).toBeVisible();

    // Action: the host opens the next question.
    await nextQuestion(page);

    // Assertion: question 2 is not question 1, and guest B has it before its own poll could have run.
    await expectFreshVote(page);
    const question2 = (await roundQuestion(page).textContent()) ?? "";
    expect(question2, "question 2 repeats question 1").not.toBe(question1);
    await expect(roundQuestion(pageB)).toHaveText(question2, { timeout: ROUND_UPDATE_MS });
    expect(Date.now() - loadedB, "guest B got question 2 only after its own poll could have run").toBeLessThan(
      LOBBY_POLL_MS,
    );
    await expect(roundQuestion(pageA)).toHaveText(question2, { timeout: ROUND_UPDATE_MS });
    // A voted at question 1, and her screen asks again: nothing chosen, nothing cast.
    for (const [who, screen] of screens) {
      await test.step(`${who} can vote at question 2`, async () => {
        await expectFreshVote(screen);
      });
    }

    // Action: A votes at question 2, then the host skips it.
    await castVote(pageA, nickA);
    await expect(voteConfirmation(pageA)).toBeVisible();
    await skipQuestion(page);

    // Assertion: every screen shows the same question 3, other than both before it, says that question 2 was skipped
    // with its votes, and asks for a fresh vote, A's screen too. The host's form was fresh already, so the note is what
    // tells that the host's screen moved on.
    await expect(skipNotice(page)).toBeVisible({ timeout: ROUND_UPDATE_MS });
    const question3 = (await roundQuestion(page).textContent()) ?? "";
    expect(question3, "question 3 repeats question 1").not.toBe(question1);
    expect(question3, "question 3 repeats question 2").not.toBe(question2);
    for (const [, screen] of guests) {
      await expect(roundQuestion(screen)).toHaveText(question3, { timeout: ROUND_UPDATE_MS });
    }
    for (const [who, screen] of screens) {
      await test.step(`${who} sees the skip note and can vote at question 3`, async () => {
        await expect(skipNotice(screen)).toBeVisible();
        await expectFreshVote(screen);
      });
    }

    // Action: the host ends the game while question 3 is voting.
    await endGame(page);

    // Assertion: every screen shows the end of the evening; only the host gets "Nowa gra", a guest is told to ask the
    // host for a new link.
    for (const [who, screen] of screens) {
      await test.step(`${who} sees the end of the evening`, async () => {
        await expect(eveningEnd(screen)).toBeVisible({ timeout: ROUND_UPDATE_MS });
      });
    }
    await expect(page.getByRole("link", { name: "Nowa gra", exact: true })).toBeVisible();
    for (const [who, screen] of guests) {
      await test.step(`${who} is asked to get a new link from the host`, async () => {
        await expect(
          screen.getByText("Chcesz zagrać jeszcze raz? Poproś hosta o nowy link.", { exact: true }),
        ).toBeVisible();
        await expect(screen.getByRole("link", { name: "Nowa gra", exact: true })).toHaveCount(0);
      });
    }

    // Assertion: the room's old link only says the game is over, also to guest A, who has the room's cookie.
    const linkAnswer = await pageA.goto(room.link);
    expect(linkAnswer?.status(), "the old link's status").toBe(410);
    await expect(
      pageA.getByRole("heading", { level: 1, name: "Ta gra już się skończyła.", exact: true }),
    ).toBeVisible();

    // Cleanup: both guests' browsers close. The room, its players and question 1's counts stay in the database, because
    // nothing can delete them yet (S-13). CI runs on a throwaway local Supabase; unique nicks keep runs apart.
    await guestA.close();
    await guestB.close();
  });
});
