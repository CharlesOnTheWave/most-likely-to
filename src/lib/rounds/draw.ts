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
// categories where the host included them (FR-005). In the base's order.
function poolFrom<Id extends string>(base: QuestionBase<Id>, selection: QuestionSelection): Id[] {
  const known = new Set(base.categories);
  const picked = new Set(selection.categories.filter((id) => known.has(id)));
  const adult = new Set(selection.adultCategories.filter((id) => picked.has(id)));
  return (Object.keys(base.questions) as Id[]).filter((id) => {
    const entry = base.questions[id];
    return picked.has(entry.category) && (!entry.adult || adult.has(entry.category));
  });
}

// An index in [0, length) from random, which gives a number in [0, 1); a value outside that still lands in range.
function indexFrom(random: () => number, length: number): number {
  const value = random();
  return Number.isFinite(value) ? Math.min(length - 1, Math.max(0, Math.floor(value * length))) : 0;
}

// Round 1's question: one question of the pool, picked by random; null when the pool is empty.
export function drawFrom<Id extends string>(
  base: QuestionBase<Id>,
  selection: QuestionSelection,
  random: () => number,
): Id | null {
  const pool = poolFrom(base, selection);
  return pool.length === 0 ? null : pool[indexFrom(random, pool.length)];
}

// The candidates of "Następne pytanie" and "Pomiń pytanie": the whole pool, each question once, in an order drawn by
// random (Fisher-Yates). The database takes the first one not played in this game yet, so no question comes twice
// (FR-015; decision D1 of context/archive/2026-10-15-full-game-evening/research.md).
export function shuffledPool<Id extends string>(
  base: QuestionBase<Id>,
  selection: QuestionSelection,
  random: () => number,
): Id[] {
  const pool = poolFrom(base, selection);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = indexFrom(random, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export function drawQuestion(selection: QuestionSelection, random: () => number): QuestionId | null {
  return drawFrom(BASE, selection, random);
}

export function shuffledQuestions(selection: QuestionSelection, random: () => number): QuestionId[] {
  return shuffledPool(BASE, selection, random);
}

// The game's pool in the base's order. Its size tells the host whether a question is left: every round of a game has
// a question of this pool and none comes twice, so N rounds have played N of them.
export function questionPool(selection: QuestionSelection): QuestionId[] {
  return poolFrom(BASE, selection);
}

// The text after "Kto z nas najprawdopodobniej" of a round's question, or null for an id the base does not have (the
// database checks only the id's format). Own keys only, so "constructor" is unknown too.
export function questionText(id: string): string | null {
  return Object.hasOwn(QUESTIONS, id) ? QUESTIONS[id as QuestionId].text : null;
}
