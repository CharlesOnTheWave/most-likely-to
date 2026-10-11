// A screen's Realtime connection that can be put to sleep, like a phone that locked. While asleep, nothing the server
// sends reaches the page, so a bell rung meanwhile is lost, as on a real dropped connection. Waking closes the socket,
// and the page's client reconnects and rejoins the room's channel on its own (realtime-js retries after 1 s).

import type { Page, WebSocketRoute } from "@playwright/test";

export interface SleepableConnection {
  sleep(): void;
  wake(): Promise<void>;
  // Messages from the server the page never got while asleep.
  missed(): number;
}

// Call before the page opens its socket (before it navigates to the room).
export async function sleepableRealtime(page: Page): Promise<SleepableConnection> {
  let asleep = false;
  let missed = 0;
  let current: WebSocketRoute | undefined;

  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      server.send(message);
    });
    server.onMessage((message) => {
      if (asleep) {
        missed += 1;
        return;
      }
      ws.send(message);
    });
    current = ws;
  });

  return {
    sleep() {
      asleep = true;
    },
    async wake() {
      asleep = false;
      await current?.close();
    },
    missed: () => missed,
  };
}
