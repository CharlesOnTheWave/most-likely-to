import { CATEGORIES, QUESTIONS, type QuestionId } from "@/data/questions";

// The round's question. Server only: this file imports the whole question base, 18+ included, which never goes to the
// browser; a screen gets only the current round's text (context/foundation/lessons.md, "Pytania gry tylko po stronie
// serwera").

// What the host picked, as stored in the room. The database checks only the shape (a host can store any name over
// RPC), so names that are not categories of the base are skipped here
// (context/archive/2026-10-07-room-lobby/follow-ups/review-fixes.md:16).
export interface QuestionSelection {
  categories: readonly string[];
  adultCategories: readonly string[];
}

// The category ids that exist and each question's category and 18+ flag; the real one is src/data/questions.ts.
export interface QuestionBase<Id extends string = string> {
  categories: readonly string[];
  questions: Readonly<Record<Id, { category: string; adult: boolean }>>;
}

const BASE: QuestionBase<QuestionId> = { categories: CATEGORIES.map((category) => category.id), questions: QUESTIONS };

// PRD FR-015 and US-01: only questions of the picked categories that exist in the base, 18+ only from the picked
// categories where the host included them (FR-005). random gives a number in [0, 1) and picks one question of that
// pool, in the base's order; null when the pool is empty. No repeats within a game is S-03's: S-02 has one round.
export function drawFrom<Id extends string>(
  base: QuestionBase<Id>,
  selection: QuestionSelection,
  random: () => number,
): Id | null {
  const known = new Set(base.categories);
  const picked = new Set(selection.categories.filter((id) => known.has(id)));
  const adult = new Set(selection.adultCategories.filter((id) => picked.has(id)));
  const pool = (Object.keys(base.questions) as Id[]).filter((id) => {
    const entry = base.questions[id];
    return picked.has(entry.category) && (!entry.adult || adult.has(entry.category));
  });
  if (pool.length === 0) return null;

  // A random outside [0, 1) still lands in the pool.
  const value = random();
  const index = Number.isFinite(value) ? Math.min(pool.length - 1, Math.max(0, Math.floor(value * pool.length))) : 0;
  return pool[index];
}

export function drawQuestion(selection: QuestionSelection, random: () => number): QuestionId | null {
  return drawFrom(BASE, selection, random);
}

// The text after "Kto z nas najprawdopodobniej" of a round's question, or null for an id the base does not have (the
// database checks only the id's format). Own keys only, so "constructor" is unknown too.
export function questionText(id: string): string | null {
  return Object.hasOwn(QUESTIONS, id) ? QUESTIONS[id as QuestionId].text : null;
}
