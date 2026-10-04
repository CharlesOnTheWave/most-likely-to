# Research zewnętrzny: live-sync-spike (F-01)

- **Data:** 2026-09-27
- **Metoda:** wbudowane wyszukiwanie Claude Code (zamiast Exa) do znalezienia stron, potem dokumentacja w wersji dla agentów: Supabase i Cloudflare podają każdą stronę jako markdown (Supabase: `.md` na końcu adresu, Cloudflare: `index.md`). Context7 świadomie pominięty (decyzja Karola, 2026-09-27). Wycinki niżej są dosłowne; dwa oznaczone „(WebFetch)” to cytaty podane przez narzędzie streszczające stronę, a nie z pobranego pliku.
- **Pytanie:** jak dostarczyć zdarzenia pokoju (dołączenie, kto już zagłosował, liczby głosów, odsłona) do 20 graczy w ≤ 2 s tak, żeby goście bez konta dostawali tylko swój pokój, a kanał nigdy nie niósł „kto na kogo”?
- **Wymagania:** FR-007, FR-009, FR-011 (później S-04), NFR (≤ 2 s, 20 graczy głosujących naraz, prywatność głosów), twarde reguły AGENTS.md (anonimowość, klucze Supabase tylko przez `astro:env/server`).

## Źródła

| Plik (pobrany 2026-09-27) | Adres |
| --- | --- |
| Realtime Authorization | https://supabase.com/docs/guides/realtime/authorization.md |
| Realtime Broadcast | https://supabase.com/docs/guides/realtime/broadcast.md |
| Realtime Presence | https://supabase.com/docs/guides/realtime/presence.md |
| Realtime Concepts | https://supabase.com/docs/guides/realtime/concepts.md |
| Realtime Limits | https://supabase.com/docs/guides/realtime/limits.md |
| Realtime Pricing | https://supabase.com/docs/guides/realtime/pricing.md |
| Realtime Messages usage (WebFetch) | https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages.md |
| Anonymous Sign-Ins | https://supabase.com/docs/guides/auth/auth-anonymous.md |
| Auth Rate limits | https://supabase.com/docs/guides/auth/rate-limits.md |
| API keys | https://supabase.com/docs/guides/getting-started/api-keys.md |
| Durable Objects: Use WebSockets | https://developers.cloudflare.com/durable-objects/best-practices/websockets/index.md |
| Durable Objects: Limits | https://developers.cloudflare.com/durable-objects/platform/limits/index.md |
| Durable Objects: Pricing | https://developers.cloudflare.com/durable-objects/platform/pricing/index.md |
| `@astrojs/cloudflare` CHANGELOG (WebFetch) | https://github.com/withastro/astro/blob/main/packages/integrations/cloudflare/CHANGELOG.md |
| Issue withastro/astro#17957 (WebFetch) | https://github.com/withastro/astro/issues/17957 |

## Kandydaci

- **A. Supabase Realtime, prywatne kanały + anonimowe logowanie gości.** To hipoteza z `infrastructure.md` („prosto z przeglądarki”, plan A). Gość dostaje w przeglądarce anonimowe konto Supabase, a reguły RLS na `realtime.messages` wpuszczają go tylko do kanału jego pokoju. Zdarzenia nadaje nasz serwer.
- **B. Supabase Realtime, publiczny kanał jako „dzwonek”.** Kanał niesie tylko sygnał „coś się zmieniło”, a przeglądarka pobiera stan pokoju z naszego serwera (Worker). Obcy, który zna nazwę kanału, nie dowie się niczego, może najwyżej dzwonić.
- **C. Cloudflare Durable Objects, jeden obiekt na pokój, WebSocket Hibernation.** Plan B z `infrastructure.md`. Gracze łączą się WebSocketem z obiektem pokoju, który sam trzyma stan rundy i wysyła tylko dane zbiorcze. Supabase zostaje do danych trwałych (logowanie hosta, pytania, później statystyki).

Odrzucone bez prototypu: **odpytywanie serwera co sekundę.** 20 graczy × 1 zapytanie/s to 72 000 zapytań na godzinę, a darmowy Worker ma 100 000 dziennie (`infrastructure.md`).

## Dowody

### Supabase: limity darmowego planu liczą każdą dostarczoną kopię

> | **Messages per second** | 100 | … (Free)
> | **Concurrent connections** | 200 | … (Free)
> | **Presence messages per second** | 20 | … (Free)
>
> — Realtime Limits

> **`tenant_events`** Connections will be disconnected if your project is generating too many messages per second. `supabase-js` will reconnect automatically when the message throughput decreases below your plan limit. An `event` is a WebSocket message delivered to, or sent from a client.
>
> — Realtime Limits

> Each broadcast message counts as one message sent plus one message per subscribed client that receives it. […] if you broadcast a message and 4 clients listen to it, it counts as 5 messages—1 sent and 4 received.
>
> — Realtime Messages usage (WebFetch)

**Co to znaczy dla gry (poprawione po recenzji):** jedno zdarzenie w pokoju z 20 graczami to 21 wiadomości. Cała runda (pytanie, 20 × „ktoś zagłosował”, odsłona) daje ok. 460 wiadomości.

~~Jeśli głosy spadną w ciągu 2 s, to 210/s przy limicie 100/s, więc Supabase rozłącza graczy.~~ **To było błędne.** Limit nie jest licznikiem sekundowym, tylko średnią z okna do 60 s. Kod Realtime: `tick: :timer.seconds(5), max_bucket_len: 12, measurement: :avg` oraz `avg = sum / bucket_len / (state.tick / 1_000)` ([tenants.ex](https://github.com/supabase/realtime/blob/main/lib/realtime/tenants.ex), [rate_counter.ex](https://github.com/supabase/realtime/blob/main/lib/realtime/rate_counter/rate_counter.ex); sprawdzone przez WebFetch 2026-09-27).

- Przy świeżym liczniku cała runda w pierwszych 5 s daje ok. 92/s, czyli poniżej limitu.
- W pełnym oknie wychodzi ok. 8/s.
- Przekroczenie wymaga ok. 6000 wiadomości na minutę, czyli ok. 13 rund w tej samej minucie. To więcej graczy, niż mieści limit 200 połączeń.
- To dowód z kodu open source, a nie z dokumentacji, więc prototyp ma go zmierzyć.

### Supabase: kanały publiczne i prywatne

> For public channels, any user can subscribe to the channel, send and receive messages.
>
> — Realtime Concepts

> Note: To enforce private channels you need to disable the 'Allow public access' setting in Realtime Settings
>
> — Realtime Authorization

> Client access policies are cached for the duration of the connection. […] if you revoke a user's access […] while they're still connected, they'll keep receiving messages until their JWT expires or a new one is sent.
>
> — Realtime Authorization

**Co to znaczy dla gry:** A wymaga przełącznika w panelu na całym (jedynym, produkcyjnym) projekcie i migracji z regułami RLS na `realtime.messages`. Wyrzucony gracz (S-09) słyszy pokój do wygaśnięcia swojego tokenu.

### Supabase: anonimowe logowanie gości

> JWTs for these users will have an `is_anonymous` claim which you can use to distinguish in RLS policies.
>
> — Anonymous Sign-Ins

> An IP-based rate limit is enforced at 30 requests per hour which can be modified in your dashboard.
>
> — Anonymous Sign-Ins

> Automatic cleanup of anonymous users is currently not available.
>
> — Anonymous Sign-Ins

> By default, Supabase Auth uses the IP address of the client for rate limiting. In certain cases, such as when using server-side frameworks or proxies in front of a project, it may be necessary to forward the end-user IP address to avoid being rate limited based on the address of the server-side client. To use a forwarded IP address for rate limiting in Supabase Auth, set the `Sb-Forwarded-For` header to the end-user IP address and make a request with a secret API key.
>
> — Auth Rate limits

**Co to znaczy dla gry:** u nas klient Supabase działa tylko na serwerze (`src/lib/supabase.ts`). Gdyby serwer zakładał gościom konta, wszyscy goście wszystkich gier dzieliliby adres IP Workera, a limit to 30 kont na godzinę. Da się to obejść na dwa sposoby: logowaniem w przeglądarce albo przekazywaniem IP z kluczem secret, którego dziś nie mamy (nowy sekret w Cloudflare, więc wdrożenie). Konta gości zostają w `auth.users` na zawsze, chyba że dopiszemy sprzątanie.

### Supabase: klucz publishable a reguła z AGENTS.md

> | Anything you ship: browser, mobile app, CLI, script | Publishable key | Anyone can read it, so it only reaches what Row Level Security allows |
>
> — API keys

> Publishable key | `sb_publishable_...` | Low | … | Safe to expose online: web page, mobile or desktop app, GitHub actions, CLIs, source code.
>
> — API keys

**Co to znaczy dla gry:** nasz `SUPABASE_KEY` to klucz publishable (sprawdzone po prefiksie, bez wyświetlania wartości). Supabase projektuje go do przeglądarki. Reguła „klucze tylko po stronie serwera, nigdy w React” jest więc surowsza niż wymaga bezpieczeństwo. A i B wymagają jej świadomej zmiany: publishable wolno do przeglądarki, klucz secret nigdy. C zostawia regułę bez zmian.

### Supabase: nadawanie z serwera

> You can also send a Broadcast message by making an HTTP request to Realtime servers. This is useful when you want to send messages from your server or client without having to first establish a WebSocket connection.
>
> `channel.httpSend()` always uses the REST API regardless of WebSocket connection state, and is available from the Supabase JavaScript client version 2.107.0 and later.
>
> — Realtime Broadcast

**Co to znaczy dla gry:** Worker może nadawać bez trzymania połączenia. Mamy `@supabase/supabase-js` 2.116.0, więc `httpSend()` jest dostępne.

### Cloudflare Durable Objects

> Durable Objects can act as WebSocket servers that connect thousands of clients per instance. […] A single Durable Object instance can coordinate between multiple clients (for example, chat rooms or multiplayer games)
>
> — Durable Objects: Use WebSockets

> **Workers Free plan**: Only Durable Objects with SQLite storage backend are available.
>
> | Requests | 100,000 / day | … (Free plan)
>
> A request is needed to create a WebSocket connection. There is no charge for outgoing WebSocket messages, nor for incoming WebSocket protocol pings. For compute requests billing-only, a 20:1 ratio is applied to incoming WebSocket messages […]
>
> — Durable Objects: Pricing

> An individual Object has a soft limit of 1,000 requests per second.
>
> — Durable Objects: Limits

> **14.3.2** Fixes a build failure when the wrangler config uses the `exports` field to declare Durable Object classes
>
> — `@astrojs/cloudflare` CHANGELOG (WebFetch); dotyczy issue #17957 „Cloudflare 14.3.1: prerender worker loses custom Durable Object exports and fails to start” (zamknięte)

**Co to znaczy dla gry:** wieczór z 20 graczami to kilkadziesiąt „zapytań” z 100 000 dziennie; wiadomości wychodzące do graczy są darmowe, więc nie ma mnożenia ×20 jak w Supabase. Obiekt pokoju sam liczy głosy, więc może wysłać jedną zbiorczą aktualizację zamiast dwudziestu. **Uwaga:** mamy adapter `@astrojs/cloudflare` 14.3.1, czyli dokładnie wersję z błędem. Durable Objects wymagają podbicia do ≥ 14.3.2 (najnowsza: 14.3.3). Integracja z Astro miała we wrześniu 2026 dwa błędy z rzędu, więc to najmniej dojrzały element tej ścieżki.

## Porównanie

| Kryterium | A. Supabase prywatne + anonimowi | B. Supabase „dzwonek” | C. Durable Objects |
| --- | --- | --- | --- |
| 20 głosów naraz w darmowym planie | OK według kodu (średnia z 60 s), do zmierzenia | OK według kodu; do tego ok. 440 żądań Workera na rundę | OK: wychodzące darmowe, obiekt może zbierać głosy |
| Wznawianie połączenia (telefon po zgaszeniu ekranu) | supabase-js sam | supabase-js sam + pobranie stanu | do napisania samemu albo biblioteka (PartyServer/partysocket) |
| Wdrożenie (push na `main`) w trakcie gry | gracze zostają połączeni | gracze zostają połączeni | „Code updates disconnect all WebSockets” |
| Tożsamość gościa | anonimowe konto Supabase (limit 30/h na IP) | własny token gościa | własny token gościa |
| Obcy z nazwą pokoju | nic nie usłyszy (RLS) | usłyszy tylko „coś się zmieniło”, może dzwonić | nie połączy się bez tokenu pokoju (piszemy sami) |
| Kanał bez „kto na kogo” | tak, jeśli nadaje tylko serwer | tak | tak |
| Klucz Supabase w przeglądarce | tak (zmiana reguły) | tak (zmiana reguły) | nie (reguła bez zmian) |
| Zmiany na produkcyjnym Supabase | migracja RLS, przełącznik w panelu, anonimowe logowanie, zalecana captcha | brak dla kanału | brak |
| Nowe elementy do nauki | RLS na `realtime.messages`, anonimowe konta, limity IP | mało | obiekt pokoju, WebSocket, podbicie adaptera, wpis w `wrangler.jsonc` |
| Uzależnienie od dostawcy | Supabase | Supabase | Cloudflare |
| Gotowość pod S-04 (powrót po odświeżeniu) | Broadcast Replay tylko dla kanałów prywatnych | stan z serwera | stan w obiekcie pokoju |

## Recenzja: adwokat diabła i krytyk (2026-09-27)

Dwóch niezależnych agentów, bez dostępu do mojego toku rozumowania: jeden atakował rekomendację C, drugi sprawdzał fakty. Najważniejsze ustalenia (sprawdzone przeze mnie u źródła tam, gdzie zaznaczono):

1. **Pierwsza rekomendacja (C) opierała się na błędnym rachunku.** Limit 100/s to średnia z 60 s, nie licznik sekundowy (poprawka wyżej; sprawdzone w kodzie Realtime). Obaj recenzenci doszli do tego niezależnie.
2. **Push na `main` rozłącza wszystkich graczy w C.** „Code updates disconnect all WebSockets. Deploying a new version restarts every Durable Object, which disconnects any existing connections.” (cf-do-websockets.md:761; sprawdzone.) U nas każdy push to wdrożenie.
3. **Hibernacja kasuje pamięć obiektu:** „In-memory state is reset” (cf-do-websockets.md:53; sprawdzone). Stan rundy trzeba zapisywać, a przy tym łatwo przez nieuwagę utrwalić parę gracz→cel.
4. **Wznawianie połączenia.** W A i B robi to supabase-js; w C trzeba je napisać albo wziąć bibliotekę (PartyServer + partysocket).
5. **Anonimowość w każdej opcji:** jeśli liczby głosów idą na żywo razem z „X zagłosował”, z kolejności zdarzeń da się odtworzyć, kto na kogo głosował. W trakcie rundy wolno wysyłać tylko „kto już zagłosował”, a liczby dopiero przy odsłonie. Własny głos gracza (FR-011) trzymać tylko w jego przeglądarce. Opis F-01 w roadmapie („kto już zagłosował, liczby głosów”) trzeba tak doprecyzować.
6. **`infrastructure.md:195` już to rozstrzygało:** „Najpierw Supabase Realtime; Durable Objects dopiero wtedy, gdy test z 20 graczami go obali”.
7. **Podbicie adaptera do ≥ 14.3.2 jest zalecane, nie konieczne** (błąd dotyczy pola `exports` w konfiguracji wranglera); `^14.3.1` w `package.json` pozwala na 14.3.3.
8. **Poboczne, do sprawdzenia (nie blokuje F-01):** zapytania z Workera do Supabase mogą mieć jeden wspólny adres IP Cloudflare, co dotyczyłoby też dzisiejszego logowania hosta (limity Auth na IP). Źródło: wątek społeczności Cloudflare, niepotwierdzone przez Supabase.
9. **Pominięte opcje (oceniane w rozmowie z Karolem):** PartyServer/Agents SDK nad DO, Broadcast from Database, Presence (20/s na Free), Supabase Pro (25 $/mies.), Ably, Pusher.

## Rekomendacja i decyzja

**Rekomendacja po recenzji (do akceptacji Karola):** prototyp F-01 w wariancie B (Supabase, kanał-„dzwonek” + stan z serwera) z pomiarem na 20 symulowanych graczach. Jeśli pomiar obali B, przechodzimy na C przez PartyServer.

**Decyzja Karola (2026-09-27): ścieżka 1.**

> Wybieramy prototyp B (Supabase Realtime: publiczny kanał jako „dzwonek” + stan pokoju z naszego serwera) z pomiarem na 20 symulowanych graczach, bo limit darmowego planu to średnia z okna do 60 s (`measurement: :avg`), więc runda z 20 graczami mieści się w nim z zapasem. supabase-js sam wznawia połączenie, a po każdym powrocie wystarczy pobrać stan z serwera. W Durable Objects to trzeba napisać samemu, a do tego „Code updates disconnect all WebSockets”. Durable Objects przez PartyServer zostają planem awaryjnym, jeśli pomiar obali B.

**Zastrzeżenie Karola, przyjęte jako ryzyko:** „to moje pierwsze podejście do tego typu spraw i przez brak wiedzy jest możliwość, że kiedyś się na tym przejedziemy”. Decyzja opiera się na researchu i recenzji agentów, a nie na doświadczeniu właściciela. Wracamy do tematu, gdy zajdzie którekolwiek z poniższych:

- pomiar F-01 nie spełni „20 graczy, ≤ 2 s” albo w logach Realtime pojawi się `MessagePerSecondRateLimitReached` lub rozłączenia;
- obcy zaczną dzwonić na kanały pokoi (spam odświeżeń);
- wyrzucenie gracza (S-09) albo powrót po odświeżeniu (S-04) będą wymagały czegoś, czego „dzwonek” nie daje;
- Supabase zmieni limity darmowego planu Realtime albo zasady klucza publishable.

**Wynik pomiaru (2026-10-04):** B przeszło kryterium F-01 na produkcji:
- 200 z 200 dostarczeń w 2 s, najwolniejsze 247 ms;
- 100 graczy w 5 pokojach też w 2 s;
- telefon przetrwał zgaszony ekran.

Sonda nie zobaczyła rozłączeń; logów Realtime w panelu Supabase nie sprawdzaliśmy. Pierwszy powód do powrotu do tematu się więc nie spełnił, a pozostałe trzy obowiązują dalej. Plan awaryjny C nie jest potrzebny. Szczegóły: `measurements.md`.

## Pytania do researchu wewnętrznego (`/10x-research`)

1. Jak dziś zbudowany jest Worker (`wrangler.jsonc`, wejście adaptera, `astro.config.mjs`) i co trzeba zmienić, żeby wyeksportować klasę Durable Object obok handlera Astro?
2. Czy `astro dev` (Astro 7, workerd) uruchamia Durable Objects lokalnie, czy prototyp wymaga `wrangler dev`?
3. Skąd gość ma dostać token pokoju, skoro dziś są tylko sesje hosta w ciasteczkach (`src/middleware.ts`, `src/pages/api/auth/*`)?
4. Czy coś w repo (CI, smoke, reguły ask) trzeba zmienić przy nowym bindingu i migracji Durable Objects w `wrangler.jsonc`? Push na `main` od razu wdraża.
5. Gdzie przy wyborze A lub B siedziałby klucz publishable po stronie przeglądarki (`astro:env/client`?) i czego wymaga zmiana reguły z AGENTS.md?
6. W B serwer zapisuje głosy gości, którzy nie mają sesji Supabase. Czy robić to przez funkcję w bazie, która sprawdza token gościa, czy przez klucz secret na serwerze (nowy sekret = wdrożenie, zgoda Karola)? Jak nie wystawić tabel na zapis każdemu, kto zna klucz publishable?
