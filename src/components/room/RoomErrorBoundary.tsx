import { Component, type ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientEvent } from "@/components/room/useRoomState";
import { logEvent } from "@/lib/log";

interface Props {
  roomId: string;
  titleAs: "h1" | "h2";
  // /dev/room-states: no report leaves the page.
  isPreview: boolean;
  children: ReactNode;
}

interface State {
  crashed: boolean;
}

// F4 of the S-02 review (context/archive/2026-10-13-first-live-round/follow-ups/review-fixes.md): a room screen that
// throws while rendering shows the player what to do instead of an empty page, and leaves a trace in the owner's logs:
// island_crash with the room's id only (src/lib/client-events.ts), through the same limits as the screen's other
// reports. The error's name goes only to this browser's console, through the log's list of fields; its message may
// hold a nick. Only the browser: on the server an error in the screen fails the page as any other.
export class RoomErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    const { roomId, isPreview } = this.props;
    logEvent("error", { op: "island_crash", roomId, errName: error instanceof Error ? error.name : "unknown" });
    if (!isPreview) reportClientEvent({ event: "island_crash", roomId });
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    const { titleAs: Title } = this.props;
    return (
      <section role="alert" className="flex flex-col items-center gap-4 py-12 text-center">
        <Title className="text-2xl font-semibold text-balance">Coś się popsuło — odśwież stronę.</Title>
        <Button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
        >
          <RotateCw />
          Odśwież stronę
        </Button>
      </section>
    );
  }
}
