import { describe, expect, it } from "vitest";
import { CATEGORIES, QUESTIONS } from "@/data/questions";
import { drawFrom, drawQuestion, questionText, type QuestionBase, type QuestionSelection } from "@/lib/rounds/draw";

// The round's question (test-plan #3). Oracle: PRD FR-015 and US-01 ("Pytanie pochodzi tylko z wybranych kategorii
// (pytania 18+ tylko z tych, w których host je dołączył)"), FR-005 (18+ is decided per chosen category) and
// context/archive/2026-10-07-room-lobby/follow-ups/review-fixes.md:16 (the categories stored in the database are
// filtered through CATEGORIES: a host can store any name over RPC). The expected sets are written by hand, never
// computed with the draw's own filter.

// Every value the injected random can give, on a grid fine enough to reach each question of a small pool.
const GRID = Array.from({ length: 1000 }, (_, i) => i / 1000).concat([1 - Number.EPSILON]);

function drawable<Id extends string>(draw: (random: () => number) => Id | null): Set<Id | null> {
  return new Set(GRID.map((value) => draw(() => value)));
}

// A base made for the test: "c" has no 18+ question, "z" is used by a question but is not a category of the base.
const BASE: QuestionBase = {
  categories: ["a", "b", "c"],
  questions: {
    "a-001": { category: "a", adult: false },
    "a-002": { category: "a", adult: true },
    "b-001": { category: "b", adult: false },
    "b-002": { category: "b", adult: true },
    "c-001": { category: "c", adult: false },
    "z-001": { category: "z", adult: false },
  },
};

describe("drawFrom", () => {
  it.each([
    { why: "a picked category without 18+", selection: { categories: ["a"], adultCategories: [] }, ids: ["a-001"] },
    {
      why: "a picked category with its 18+",
      selection: { categories: ["a"], adultCategories: ["a"] },
      ids: ["a-001", "a-002"],
    },
    {
      why: "two categories, 18+ in one of them",
      selection: { categories: ["a", "b"], adultCategories: ["a"] },
      ids: ["a-001", "a-002", "b-001"],
    },
    {
      why: "a category with no 18+ questions picked as 18+",
      selection: { categories: ["c"], adultCategories: ["c"] },
      ids: ["c-001"],
    },
    {
      why: "18+ of a category that is not picked",
      selection: { categories: ["b"], adultCategories: ["a"] },
      ids: ["b-001"],
    },
    {
      why: "unknown category names next to a known one",
      selection: { categories: ["a", "nie-ma", "constructor", "__proto__"], adultCategories: ["nie-ma"] },
      ids: ["a-001"],
    },
  ])("draws only from the allowed questions: $why", ({ selection, ids }) => {
    expect(drawable((random) => drawFrom(BASE, selection, random))).toEqual(new Set(ids));
  });

  it.each([
    { why: "no category", selection: { categories: [], adultCategories: [] } },
    { why: "only 18+ and no category", selection: { categories: [], adultCategories: ["a"] } },
    { why: "only unknown names", selection: { categories: ["nie-ma", "constructor"], adultCategories: ["nie-ma"] } },
    { why: "a name used by a question but not a category", selection: { categories: ["z"], adultCategories: ["z"] } },
  ])("gives null for an empty pool: $why", ({ selection }) => {
    expect(drawable((random) => drawFrom(BASE, selection, random))).toEqual(new Set([null]));
  });

  it.each([1, -0.5, Number.NaN])("still draws from the pool when random gives %d", (value) => {
    const selection: QuestionSelection = { categories: ["a", "b"], adultCategories: [] };

    expect(["a-001", "b-001"]).toContain(drawFrom(BASE, selection, () => value));
  });
});

describe("drawQuestion", () => {
  it.each(CATEGORIES.map((category) => category.id))("draws only ordinary questions of %s without 18+", (category) => {
    const ids = drawable((random) => drawQuestion({ categories: [category], adultCategories: [] }, random));

    for (const id of ids) {
      expect(id).not.toBeNull();
      if (id === null) continue;
      expect(QUESTIONS[id]).toMatchObject({ category, adult: false });
    }
  });

  // Ids picked by hand from src/data/questions.ts: przyszlosc-001 is ordinary, przyszlosc-011 is 18+.
  it("draws 18+ only from the categories where the host included them", () => {
    const without = drawable((random) => drawQuestion({ categories: ["przyszlosc"], adultCategories: [] }, random));
    const withAdult = drawable((random) =>
      drawQuestion({ categories: ["przyszlosc"], adultCategories: ["przyszlosc"] }, random),
    );

    expect(without.has("przyszlosc-001")).toBe(true);
    expect(without.has("przyszlosc-011")).toBe(false);
    expect(withAdult.has("przyszlosc-001")).toBe(true);
    expect(withAdult.has("przyszlosc-011")).toBe(true);
  });

  it("keeps 18+ in the category the host chose it for", () => {
    const ids = drawable((random) =>
      drawQuestion({ categories: ["imprezy", "przyszlosc"], adultCategories: ["przyszlosc"] }, random),
    );

    expect(ids.has("imprezy-001")).toBe(true);
    for (const id of ids) {
      if (id === null) {
        expect(id).not.toBeNull();
        continue;
      }
      const entry = QUESTIONS[id];
      expect(["imprezy", "przyszlosc"]).toContain(entry.category);
      if (entry.adult) expect(entry.category).toBe("przyszlosc");
    }
  });

  it("gives null when every picked name is unknown", () => {
    expect(drawQuestion({ categories: ["nie-ma", "constructor"], adultCategories: [] }, () => 0)).toBeNull();
  });
});

describe("questionText", () => {
  it.each(["na-co-dzien-001", "przyszlosc-011"] as const)("gives the text of %s from the base", (id) => {
    expect(questionText(id)).toBe(QUESTIONS[id].text);
  });

  // The id comes from the database, which checks only its format.
  it.each(["nie-ma-001", "constructor", "__proto__", "toString", ""])("gives null for the unknown id %j", (id) => {
    expect(questionText(id)).toBeNull();
  });
});
