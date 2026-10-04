import { useEffect, useState } from "react";
import { createClient, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { BELL_EVENT, isValidSeq, topicFor, type LiveSyncState } from "@/lib/live-sync/shared";

interface Props {
  supabaseUrl: string;
  supabaseKey: string;
  room: string;
  canRing: boolean;
}

type Status = "connecting" | "connected" | "disconnected";

const STATUS_LABELS: Record<Status, string> = {
  connecting: "łączenie…",
  connected: "połączono",
  disconnected: "rozłączono",
};

interface Board {
  state: LiveSyncState;
  fetchMs: number;
}

export default function LiveSyncDemo({ supabaseUrl, supabaseKey, room, canRing }: Props) {
  const [status, setStatus] = useState<Status>("connecting");
  const [reconnects, setReconnects] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ringing, setRinging] = useState(false);

  useEffect(() => {
    // Realtime only: the host's session lives in server-side cookies and this client must not touch it.
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let subscribedBefore = false;

    async function fetchBoard(seq: number) {
      const started = performance.now();
      try {
        const res = await fetch(`/api/live-sync/state?room=${encodeURIComponent(room)}&seq=${seq}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const state = (await res.json()) as LiveSyncState;
        const fetchMs = Math.round(performance.now() - started);
        // A slower response for an older bell must not overwrite a newer board.
        setBoard((prev) => (prev && prev.state.seq > state.seq ? prev : { state, fetchMs }));
        setError(null);
      } catch {
        setError("Nie udało się pobrać tablicy.");
      }
    }

    const channel = supabase
      .channel(topicFor(room))
      .on("broadcast", { event: BELL_EVENT }, (message) => {
        const { payload } = message as { payload?: { seq?: unknown } };
        if (isValidSeq(payload?.seq)) {
          void fetchBoard(payload.seq);
        }
      })
      .subscribe((state) => {
        if (state === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          if (subscribedBefore) {
            setReconnects((n) => n + 1);
          }
          subscribedBefore = true;
          setStatus("connected");
        } else {
          setStatus("disconnected");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabaseUrl, supabaseKey, room]);

  async function ring() {
    setRinging(true);
    try {
      const res = await fetch("/api/live-sync/ring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, seq: Date.now() }),
      });
      setError(res.ok ? null : `Dzwonek nie wyszedł (HTTP ${res.status}).`);
    } catch {
      setError("Dzwonek nie wyszedł.");
    } finally {
      setRinging(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-blue-100/60">Pokój</dt>
        <dd>{room}</dd>
        <dt className="text-blue-100/60">Status</dt>
        <dd className={status === "connected" ? "text-green-300" : "text-amber-300"}>{STATUS_LABELS[status]}</dd>
        <dt className="text-blue-100/60">Powroty połączenia</dt>
        <dd>{reconnects}</dd>
      </dl>

      <div className="rounded-lg border border-white/10 bg-white/5 p-4" aria-live="polite">
        {board ? (
          <>
            <p className="text-blue-100/60">Dzwonek nr {board.state.seq}</p>
            <p className="mt-2 text-base font-semibold">{board.state.question}</p>
            <p className="mt-2 text-blue-100/60">Tablica pobrana w {board.fetchMs} ms</p>
          </>
        ) : (
          <p className="text-blue-100/60">Czekam na dzwonek…</p>
        )}
      </div>

      {error && (
        <p className="text-red-300" role="alert">
          {error}
        </p>
      )}

      {canRing ? (
        <Button className="w-full" disabled={ringing} onClick={() => void ring()}>
          {ringing ? "Dzwonię…" : "Zadzwoń"}
        </Button>
      ) : (
        <p className="text-center text-blue-100/60">Dzwonić może tylko zalogowany.</p>
      )}
    </div>
  );
}
