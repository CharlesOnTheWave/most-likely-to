import type { SupabaseClient } from "@supabase/supabase-js";
import { QUESTIONS } from "@/data/questions";
import { BELL_EVENT, topicFor, type LiveSyncState } from "@/lib/live-sync/shared";

// The only import of the question base in this change: it stays on the server (lessons.md).
const PLAIN_QUESTIONS = Object.values(QUESTIONS).filter((entry) => !entry.adult);

// F-01 caps a delivery at 5 s; the library default of 10 s would leave the host's request hanging.
const RING_TIMEOUT_MS = 5000;

export async function ringRoom(supabase: SupabaseClient, room: string, seq: number): Promise<{ ok: boolean }> {
  const channel = supabase.channel(topicFor(room));
  try {
    // 202 means "accepted", not "delivered"; delivery time is measured on the receivers.
    const result = await channel.httpSend(BELL_EVENT, { seq }, { timeout: RING_TIMEOUT_MS });
    return { ok: result.success };
  } catch (error) {
    // Any status other than 202, and a timeout, throw a plain Error without the status. Only the reason is logged:
    // httpSend messages carry no key and no request data.
    // eslint-disable-next-line no-console
    console.error("live-sync ring failed:", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return { ok: false };
  } finally {
    await supabase.removeChannel(channel);
  }
}

// Prototype shortcut: F-01 has no tables, so the question is derived from the bell's seq. Anyone with the publishable
// key can ring the public channel with any seq; from S-02 the board reads the current round from the database and
// takes nothing that decides content from the bell (plan.md, "Dzwonek jest niezaufaną podpowiedzią").
export function stateFor(room: string, seq: number): LiveSyncState {
  const entry = PLAIN_QUESTIONS[seq % PLAIN_QUESTIONS.length];
  return { room, seq, question: `Kto z nas najprawdopodobniej ${entry.text}?` };
}
