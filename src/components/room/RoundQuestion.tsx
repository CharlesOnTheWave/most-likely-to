// The round's question as the heading of the voting and the reveal. The text comes from the Worker as plain text, the
// ending after "Kto z nas najprawdopodobniej" (src/lib/rooms/shared.ts, RoundView), and React renders it as text, never
// as HTML (lessons.md). null: the base did not have the round's question, so the screen says only that.
export function questionSentence(question: string | null): string {
  return question === null ? "Nie udało się wczytać pytania." : `Kto z nas najprawdopodobniej ${question}?`;
}

interface Props {
  question: string | null;
  titleAs: "h1" | "h2";
}

export function RoundQuestion({ question, titleAs: Title }: Props) {
  return <Title className="text-2xl font-semibold text-balance break-words">{questionSentence(question)}</Title>;
}
