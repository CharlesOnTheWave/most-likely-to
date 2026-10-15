import { questionSentence } from "@/lib/rooms/shared";

// The round's question as the heading of the voting and the reveal. The text comes from the Worker as plain text, the
// ending after "Kto z nas najprawdopodobniej" (src/lib/rooms/shared.ts, RoundView), and React renders it as text, never
// as HTML (lessons.md).
interface Props {
  question: string | null;
  titleAs: "h1" | "h2";
}

export function RoundQuestion({ question, titleAs: Title }: Props) {
  return <Title className="text-2xl font-semibold text-balance break-words">{questionSentence(question)}</Title>;
}
