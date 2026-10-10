// The nick pairs of research.md §3.1, the oracle of tests/db/nicks.test.ts: what looks the same is the same nick. The
// expectations come from Unicode (DerivedCoreProperties.txt Default_Ignorable_Code_Point, PropList.txt White_Space,
// UTS #51, Core Spec §5.21 and §23.4) and S-01's decisions, never from private.normalize_nick.
//
// No imports on purpose: print-nick-pairs.ts prints this data with plain node for the side-by-side check against the
// research table (plan, Phase 3). Invisible characters only as \u{…} escapes, never literal: an editor or a formatter
// can drop them, and a review cannot see them.
//
// Left out by decision (plan, What We're NOT Doing): pairs whose look depends on the emoji decision of the F4 fix
// (U+2764 with and without FE0F, # with and without FE0F, the flag of Scotland and the black flag) and compatibility
// forms (full width, ligatures). Spaces are escapes too: one at the end of a string is just as easy to miss.

export type NickOutcome = "nick_taken" | "joins";

export interface NickPair {
  // Already in the room when the probe comes.
  readonly taken: string;
  // A new guest's try.
  readonly probe: string;
  readonly expected: NickOutcome;
  // Why, with its source.
  readonly why: string;
  // F4: today the probe gets the other outcome. A test.fails until S-02 fixes the nick rule.
  readonly knownHole: boolean;
}

export const NICK_PAIRS: readonly NickPair[] = [
  // Edges and invisible characters the rule already handles.
  {
    taken: "Ola",
    probe: "Ola\u{20}",
    expected: "nick_taken",
    why: "SPACE at the edge, White_Space (PropList.txt)",
    knownHole: false,
  },
  {
    taken: "Ola",
    probe: "\u{20}Ola",
    expected: "nick_taken",
    why: "SPACE at the edge, White_Space (PropList.txt)",
    knownHole: false,
  },
  {
    taken: "Ola",
    probe: "O\u{200B}la",
    expected: "nick_taken",
    why: "ZERO WIDTH SPACE, Default_Ignorable (DerivedCoreProperties.txt)",
    knownHole: false,
  },
  {
    taken: "Ola",
    probe: "Ola\u{A0}",
    expected: "nick_taken",
    why: "NO-BREAK SPACE at the edge, White_Space (PropList.txt)",
    knownHole: false,
  },
  {
    taken: "Ola",
    probe: "O\u{AD}la",
    expected: "nick_taken",
    why: "SOFT HYPHEN, Default_Ignorable (DerivedCoreProperties.txt)",
    knownHole: false,
  },
  {
    taken: "Ola",
    probe: "Ola\u{FEFF}",
    expected: "nick_taken",
    why: "ZERO WIDTH NO-BREAK SPACE (BOM), Default_Ignorable (DerivedCoreProperties.txt)",
    knownHole: false,
  },
  {
    taken: "Ola",
    probe: "O\u{2060}la",
    expected: "nick_taken",
    why: "WORD JOINER, Default_Ignorable (DerivedCoreProperties.txt)",
    knownHole: false,
  },
  {
    taken: "Ola",
    probe: "Ola\u{3164}",
    expected: "nick_taken",
    why: "HANGUL FILLER, Default_Ignorable (DerivedCoreProperties.txt)",
    knownHole: false,
  },
  {
    taken: "Ola",
    probe: "Ola\u{2800}",
    expected: "nick_taken",
    why: 'BRAILLE PATTERN BLANK, "imaged as a fixed-width blank" (NamesList.txt)',
    knownHole: false,
  },
  {
    taken: "Ol\u{E1}",
    probe: "Ola\u{301}",
    expected: "nick_taken",
    why: "a + COMBINING ACUTE ACCENT is canonically equivalent to the composed letter (UAX #15)",
    knownHole: false,
  },
  // F4: characters the rule misses today.
  {
    taken: "Ola",
    probe: "Ola\u{FE0F}",
    expected: "nick_taken",
    why: "VARIATION SELECTOR-16 after a letter with no variation sequence: invisible and ignored (Core Spec §23.4)",
    knownHole: true,
  },
  {
    taken: "Ola",
    probe: "O\u{FE0E}la",
    expected: "nick_taken",
    why: "VARIATION SELECTOR-15 after a letter with no variation sequence: invisible and ignored (Core Spec §23.4)",
    knownHole: true,
  },
  {
    taken: "Ola",
    probe: "Ola\u{E0100}",
    expected: "nick_taken",
    why: "VARIATION SELECTOR-17 with no variation sequence: invisible and ignored (Core Spec §23.4)",
    knownHole: true,
  },
  {
    taken: "Ola",
    probe: "Ola\u{E0041}",
    expected: "nick_taken",
    why: "TAG LATIN CAPITAL LETTER A, an invisible tag (Core Spec §5.21)",
    knownHole: true,
  },
  {
    taken: "Ola",
    probe: "Ola\u{61C}",
    expected: "nick_taken",
    why: "ARABIC LETTER MARK, Default_Ignorable (DerivedCoreProperties.txt)",
    knownHole: true,
  },
  {
    taken: "Ola",
    probe: "Ola\u{180F}",
    expected: "nick_taken",
    why: "MONGOLIAN FREE VARIATION SELECTOR FOUR, Default_Ignorable (DerivedCoreProperties.txt)",
    knownHole: true,
  },
  {
    taken: "Ola",
    probe: "Ola\u{1BCA0}",
    expected: "nick_taken",
    why: "SHORTHAND FORMAT LETTER OVERLAP, Default_Ignorable (DerivedCoreProperties.txt)",
    knownHole: true,
  },
  {
    taken: "Ola",
    probe: "Ola\u{1D173}",
    expected: "nick_taken",
    why: "MUSICAL SYMBOL BEGIN BEAM, Default_Ignorable (DerivedCoreProperties.txt)",
    knownHole: true,
  },
  {
    taken: "Ola\u{1F600}",
    probe: "Ola\u{1F600}\u{FE0F}",
    expected: "nick_taken",
    why: "U+1F600 has no variation sequence with FE0F, so the selector changes nothing (UTS #51, emoji-variation-sequences.txt)",
    knownHole: true,
  },
  // Visibly different nicks join: a guard against an over-eager fix (e.g. lowercase or NFKC plus stripped accents).
  {
    taken: "Ola",
    probe: "ola",
    expected: "joins",
    why: "case counts (S-01 decision)",
    knownHole: false,
  },
  {
    taken: "Ola",
    probe: "Ola1",
    expected: "joins",
    why: "visibly different: an extra digit",
    knownHole: false,
  },
  {
    taken: "Ola",
    probe: "\u{D3}la",
    expected: "joins",
    why: "visibly different: O with an acute accent is another letter",
    knownHole: false,
  },
  // Not in the research table: the plain duplicate, the base of the rule.
  {
    taken: "Ola",
    probe: "Ola",
    expected: "nick_taken",
    why: "the same nick: the room rejects a duplicate nick (PRD FR-002)",
    knownHole: false,
  },
];

function codePoint(char: string): string {
  return `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;
}

// Every code point of a nick: "Ola" is U+004F U+006C U+0061.
export function codePoints(nick: string): string {
  return nick === "" ? "(empty)" : Array.from(nick, codePoint).join(" ");
}

// A nick readable in a test name: visible ASCII in quotes, everything else (a space too) as its code point, so
// "O" + U+FE0E + "la" shows what a log or a terminal would hide.
export function nickLabel(nick: string): string {
  const parts: string[] = [];
  let visible = "";
  for (const char of nick) {
    if (char > " " && char <= "~" && char !== '"') {
      visible += char;
      continue;
    }
    if (visible !== "") parts.push(`"${visible}"`);
    visible = "";
    parts.push(codePoint(char));
  }
  if (visible !== "") parts.push(`"${visible}"`);
  return parts.length > 0 ? parts.join(" + ") : '""';
}
