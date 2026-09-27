/**
 * Shared question base: the game creator curates it, every game draws from it.
 *
 * Rules for adding questions (also for later additions, PRD FR-021):
 * - Key = question id `<category-id>-<NNN>`, numbered in order within the category. An id never
 *   changes and is never reused, even if the question moves to another category or is retired:
 *   per-question play data (S-11) is stored under it.
 * - Keep QUESTIONS a single object literal. A duplicated key fails `npx astro check` (TS1117);
 *   merging parts with spread would let duplicates through silently.
 * - `text` is the ending after the fixed prefix "Kto z nas najprawdopodobniej"; the screen shows
 *   "Kto z nas najprawdopodobniej {text}?". Lowercase start, no trailing "?" or ".", conditional
 *   mood in the generic form ("zasnąłby…"), at most 90 characters.
 * - `adult: true` marks an 18+ question (innuendo, alcohol, dating; no vulgarity, nothing explicit).
 *   The host decides per category whether to include them (S-01).
 */

export const CATEGORIES = [
  { id: "na-co-dzien", name: "Na co dzień" },
  { id: "imprezy", name: "Imprezy" },
  { id: "przyszlosc", name: "Przyszłość" },
  { id: "wpadki-i-obciach", name: "Wpadki i obciach" },
  { id: "gry-i-internet", name: "Gry i internet" },
  { id: "podroze-i-przygody", name: "Podróże i przygody" },
  { id: "sport-i-wyzwania", name: "Sport i wyzwania" },
  { id: "praca-i-szkola", name: "Praca i szkoła" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export interface QuestionEntry {
  category: CategoryId;
  text: string;
  adult: boolean;
}

export const QUESTIONS = {} as const satisfies Record<string, QuestionEntry>;

export type QuestionId = keyof typeof QUESTIONS;
