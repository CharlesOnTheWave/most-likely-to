---
title: "Warstwa antykorupcyjna dla Supabase: dzwonek Realtime jako przeciek #1"
created: 2026-10-20
type: refactor-plan
---

# Warstwa antykorupcyjna (ACL) dla Supabase: plan refaktoru

> Plan, nie implementacja. W tej sesji nie zmieniłem żadnego pliku kodu, testu ani konfiguracji. Każde `plik:linia`
> poniżej sprawdziłem w tej sesji (kod, dokumenty, `node_modules/@supabase/*` w wersji 2.116.0). Liczby z grepa są z
> 2026-10-20, z wykluczeniem `node_modules`, `dist`, `.astro`, `.wrangler`, `playwright-report`. Według `CLAUDE.md`
> „badanie szereguje, plan decyduje”, więc ten dokument jest wejściem do `/10x-plan`. Decyzje, które zostają otwarte, są
> w §6.6.

## Dla Karola w 30 sekund

- **Co przecieka:** biblioteka Supabase (`@supabase/supabase-js` i `@supabase/ssr`), najbardziej jej część „na żywo”
  (Realtime, czyli dzwonek pokoju). Klienta SDK budują dwa miejsca w przeglądarce i jedno na serwerze. Nazwy stanów
  kanału z biblioteki weszły do kontraktu zgłoszeń z telefonów i do logów. Osiem tras dostaje klienta Supabase tylko po
  to, żeby zadzwonić. Do tego telefon każdego gracza pobiera cały SDK (około 215 KB, gzip około 55 KB), choć używa
  tylko kanału.
- **Czy to świadoma decyzja:** samo Realtime z przeglądarki tak, to jest zapisane i kod tego pilnuje. Rozlanie po
  warstwach nie: nikt tego nie zapisał. Dokumenty mówią, że Realtime da się zastąpić Durable Objects (plan B), a kod
  takiej zamiany nie ułatwia.
- **Co to da w grze:** gracz nic nie zobaczy. To ubezpieczenie. Gdyby Realtime padł w wieczór gry albo skończył się
  darmowy limit, plan B dotknie dwóch plików adaptera i dwóch linii składania zamiast około 23 plików. Błędy łączenia
  będą też naprawiane w jednym miejscu.
- **Rekomendacja:** Faza 0 (testy charakteryzujące) robimy teraz, po scaleniu `refactor-opportunities`, bo te testy
  przydadzą się tak czy inaczej. Fazy 1–4 (Realtime) robimy przy najbliższej zmianie w kodzie na żywo albo wtedy, gdy
  plan B stanie się realny. Faz 5–7 (dane, logowanie) teraz nie, chyba że kurs wymaga pełnego kryterium „grep tylko w
  ACL”.
- **Twoje tak/nie:** (1) Prototyp F-01 (`/dev/live-sync` i demo) zostaje czy znika? (2) Fazy 1–4 robimy teraz w
  ramach kursu czy odkładamy?

---

## Krok 0. Kontekst

### 0.1 Stack i zależności zewnętrzne

Astro 7 SSR, wyspy React 19, Tailwind 4, Supabase (Auth, Postgres, Realtime), Cloudflare Workers (`AGENTS.md:3`,
`context/foundation/infrastructure.md:9`). Zależności runtime z `package.json`, z liczbą instrukcji importu w `src`,
`scripts` i `tests`:

| Pakiet | Importy | Gdzie | Przecina warstwy? |
| --- | --- | --- | --- |
| `react`, `react-dom` | 27 | wyspy | nie, to framework UI |
| `astro` (+ `astro:env`, `astro:middleware`) | 21 + 3 | strony, trasy; w `src/lib` tylko typy: `supabase.ts:2`, `rooms/json-route.ts:1`, `rooms/tokens.ts:1` | framework aplikacji, przyjęte |
| `lucide-react` | 14 | `src/components/{room,auth,ui}` | nie, tylko UI |
| `cn`, `class-variance-authority`, `radix-ui`, `@radix-ui/react-slot` | 12, 5, 4, 1 | `src/components/ui` (plus re-eksport `cn` w `src/lib/utils.ts`) | nie, konwencja shadcn (`AGENTS.md`, Conventions) |
| **`@supabase/supabase-js`** (`package.json:27`) | **10** | wyspy, typy globalne, middleware, trasy, `src/lib`, sonda, testy | **tak** |
| **`@supabase/ssr`** (`package.json:26`) | 1 | `src/lib/supabase.ts:1` | razem z powyższym |
| `vitest`, `@playwright/test` | 18, 8 | tylko `tests/` | nie |

Przez granice warstw przecieka tylko Supabase. Pozostałe pakiety siedzą w jednej warstwie albo są frameworkiem, na
którym stoi cała aplikacja.

### 0.2 Warstwy kodu

1. **UI (wyspy React):** `src/components/**`.
2. **Kontrakty wspólne dla przeglądarki i serwera:** `src/lib/rooms/shared.ts:1-2`, `src/lib/live-sync/shared.ts:1`,
   `src/lib/client-events.ts`.
3. **Strony SSR:** `src/pages/*.astro`, `src/pages/j/`, `src/pages/r/`, `src/pages/dev/`.
4. **Trasy API:** `src/pages/api/**`.
5. **Middleware:** `src/middleware.ts`.
6. **Serwer i domena:** `src/lib/rooms/server.ts` (jedyna brama do funkcji SQL, `context/map/repo-map.md:15`),
   `src/lib/live-sync/server.ts`, `src/lib/auth-*.ts`.
7. **Konfiguracja i infrastruktura:** `src/lib/supabase.ts`, `src/env.d.ts`.
8. **Narzędzia i testy:** `scripts/`, `tests/`.
9. **Baza:** `supabase/migrations/` (SQL, RLS, `auth.uid()`). To jest sama persystencja, nie biblioteka TS, więc ACL
   jej nie obejmuje.

### 0.3 Deklaracje intencji (źródło prawdy o tym, co miało być)

- `AGENTS.md:11`: `SUPABASE_URL` / `SUPABASE_KEY` czytamy tylko przez `astro:env/server`, „see `src/lib/supabase.ts`”.
  Jest jedno miejsce konfiguracji.
- `AGENTS.md:12`: serwer może przekazać do przeglądarki adres i klucz publishable, „only for Realtime subscriptions”.
  To świadoma, zapisana zgoda na SDK w przeglądarce, ograniczona do Realtime.
- `context/foundation/tech-stack.md:24`: kanał na żywo „must be designed deliberately at bootstrap”, bo runtime na
  krawędzi ogranicza długie połączenia.
- **Deklaracja wymienności:** `context/foundation/infrastructure.md:17` („Durable Objects zostają planem B, na razie
  niepotrzebnym”), `:55` („Plan B dla rundy na żywo: Durable Objects z WebSocket Hibernation”), `:109` („Na wypadek,
  gdyby Supabase Realtime nie wystarczył, jest plan B po tej samej stronie”), `:195` („Durable Objects dopiero wtedy,
  gdy test z 20 graczami go obali”). Do tego `context/archive/2026-09-27-live-sync-spike/external-research.md:32`
  („Supabase zostaje do danych trwałych (logowanie hosta, pytania, później statystyki)”) i `:181` („Durable Objects
  przez PartyServer zostają planem awaryjnym”). Stan na dziś to
  `context/archive/2026-09-27-live-sync-spike/measurements.md:102`: plan awaryjny nie jest potrzebny.
- `context/archive/2026-09-27-live-sync-spike/plan.md:105`: klient przeglądarki tylko do Realtime, z
  `persistSession: false`, `autoRefreshToken: false` i `detectSessionInUrl: false`.
- `src/lib/supabase.ts:10` i `context/archive/2026-10-04-one-click-host-login/plan.md:11`: w przeglądarce nie ma
  klienta Auth.
- `src/lib/rooms/server.ts:7`: „Every database call of the room screens, in one place”.
- `context/foundation/prd.md:159`: lista dostawców logowania to decyzja późniejsza. To nie jest deklaracja
  wymienności samego Supabase Auth.
- Precedens ACL już w repo: w testach jedynymi drzwiami do supabase-js jest `tests/db/support/clients.ts`, a pilnuje
  tego reguła ESLint (`eslint.config.js:92-110`; geneza:
  `context/archive/2026-10-10-testing-lobby-foundation/reviews/impl-review.md:121-122`). W kodzie podobnie działa wąski
  interfejs `UserReader` (`src/lib/auth-user.ts:3-6`).

---

## Krok 1. Identyfikacja: kto dziś „zna” Supabase

Supabase to jeden pakiet o trzech twarzach. Inwentaryzacja obejmuje pliki, które importują pakiet, i te, które znają
kształt biblioteki pośrednio: dostają albo podają dalej `SupabaseClient`, `{ supabaseUrl, supabaseKey }` albo nazwy
stanów kanału.

### R. Realtime, czyli dzwonek pokoju (21 plików w `src` i 2 poza nim)

| Warstwa | Plik:linia | Co wie o bibliotece |
| --- | --- | --- |
| UI | `src/components/room/useRoomState.ts:2` | `createClient`, `REALTIME_SUBSCRIBE_STATES`, `RealtimeChannel` |
| UI | `useRoomState.ts:17-22` | `LiveConfig { supabaseUrl; supabaseKey }` |
| UI | `useRoomState.ts:116-120` | mapowanie stanów biblioteki na `ClientState` (`channelState`) |
| UI | `useRoomState.ts:272-278` | budowa klienta „tylko Realtime” z opcjami Auth |
| UI | `useRoomState.ts:281-320` | `channel(topicFor)`, `.on("broadcast")`, `.subscribe(state)`, ponowne łączenie po `CLOSED` (`:302-303`, `:309-318`) |
| UI | `useRoomState.ts:334-338` | `removeChannel(...).catch` |
| UI | `src/components/live-sync/LiveSyncDemo.tsx:2, 6-11, 34-37, 59-81` | to samo drugi raz: import, propsy URL/klucz, klient, kanał, `removeChannel` |
| UI | `src/components/room/RoomScreen.tsx:14, 39` | typ `LiveConfig` w propsach wyspy |
| Kontrakt | `src/lib/client-events.ts:9-10` | `CLIENT_STATES` zawiera `"CHANNEL_ERROR"`, `"TIMED_OUT"`, `"CLOSED"`, czyli wartości enumu biblioteki (`node_modules/@supabase/realtime-js/src/RealtimeChannel.ts:261-266`) |
| Kontrakt | `src/lib/live-sync/shared.ts:3-4, 20-22` | nazewnictwo kanału (`live-sync:` + id, zdarzenie `bell`) |
| API (logi) | `src/pages/api/client-events.ts:26-27` | zapisuje te wartości do logu właściciela |
| Serwer | `src/lib/live-sync/server.ts:1, 9-10, 12-32` | `SupabaseClient`, `channel`, `httpSend`, `removeChannel`, wiedza o błędach `httpSend` (`:19-21`) |
| Serwer | `src/lib/rooms/server.ts:1, 359-381` | `ringLobby(locals, supabase: SupabaseClient, roomId)`; komentarz o `removeChannel` (`:371`) |
| Konfiguracja | `src/lib/supabase.ts:25-32` | `getPublicSupabaseConfig(): { supabaseUrl; supabaseKey }`, strażnik `sb_publishable_` (`:28`) |
| Strony | `src/pages/r/[id].astro:12, 53, 65` | config Supabase do propsów wyspy |
| Strony | `src/pages/dev/live-sync.astro:5, 15, 28-35` | to samo dla demo |
| API | `src/pages/api/live-sync/config.ts:2, 7-11` | JSON `{ supabaseUrl, supabaseKey }` (kontrakt sondy) |
| API | `src/pages/api/live-sync/ring.ts:4, 19-24` | klient Supabase do `ringRoom` |
| API (8 tras) | `src/pages/api/rooms/index.ts:51`, `join.ts:55`, `[id]/start.ts:33`, `vote.ts:48`, `reveal.ts:23`, `next.ts:39`, `skip.ts:38`, `end.ts:25` | `ringLobby(context.locals, supabase, …)`: trasa musi trzymać klienta Supabase, żeby zadzwonić |
| Narzędzia | `scripts/live-sync-probe.mjs:9, 11-13, 126-131, 164-169` | własny `createClient`, kopia nazw kanału, czyta `supabaseUrl`/`supabaseKey` z `/api/live-sync/config` |
| Testy E2E | `tests/e2e/support/realtime.ts:20` | ścieżka transportu `/realtime/v1/websocket` |

Podglądy dev znają tylko nazwę propsa, nie jego kształt: `realtime={null}` występuje 53 razy w
`src/pages/dev/room-states.astro` (np. `:414`) i raz w `src/pages/dev/room-window.astro:203`.

### D. Dane (PostgREST/RPC), 13 plików w `src`

- `src/lib/rooms/server.ts:1` (typ), `:80-98` (`callRpc` → `supabase.rpc`, `:89`), `:49-53` (parsowanie błędu
  transportu postgrest-js), `:307-357` (trzy `supabase.from("rooms")`: `:311`, `:328`, `:343`). Wszystkie 10 funkcji
  publicznych przyjmują `SupabaseClient` (`:111`, `:136`, `:152`, `:172`, `:214-218`, `:234`, `:243`, `:260`, `:268`,
  `:285`, `:301`).
- Wołający, którzy budują klienta i podają go dalej: 9 tras `src/pages/api/rooms/**` (`index.ts:33`, `join.ts:19`,
  `[id]/end.ts:21`, `lobby.ts:21`, `next.ts:30`, `reveal.ts:19`, `skip.ts:29`, `start.ts:21`, `vote.ts:44`) i 3 strony
  (`src/pages/index.astro:22`, `src/pages/j/[token].astro:27`, `src/pages/r/[id].astro:25`).

### A. Logowanie (Auth), 9 plików w `src` i 1 test

- `src/env.d.ts:3`: `App.Locals.user` ma typ `import("@supabase/supabase-js").User`.
- `src/lib/auth-user.ts:1, 3-6, 12-19`: typ `User` i rozpoznanie gościa po `AuthSessionMissingError`.
- `src/lib/auth-errors.ts:1, 43-48`: `AuthError`, `isAuthRetryableFetchError`.
- `src/middleware.ts:3, 8-14`: `readUser(supabase.auth)`.
- `src/pages/api/auth/oauth.ts:2, 7, 25, 31-38` (typ `Provider`, `signInWithOAuth`), `callback.ts:37, 42`
  (`exchangeCodeForSession`), `signin.ts:17, 21` (`signInWithPassword`), `signout.ts:5, 8` (`signOut`).
- `src/pages/dashboard.astro:14` czyta `user?.email`. Pozostałe miejsca z `locals.user` sprawdzają tylko, czy jest
  zalogowany.
- `tests/unit/auth-user.test.ts:2`: typ `User`.

### Poza `src`

- `scripts/live-sync-probe.mjs:9`: pomiar samego Supabase Realtime. Kopie stałych to świadome, zapisane odstępstwo
  (K5).
- `tests/db/support/clients.ts:1, 4-5, 13-16`: „drzwi atakującego”, czyli testy bazy idą celowo z pominięciem Workera.

---

## Krok 2. Klasyfikacja i wybór #1

| Oś | R: Realtime (dzwonek) | D: Dane (RPC) | A: Logowanie |
| --- | --- | --- | --- |
| (a) Warstwy | **7**: UI, kontrakty, strony, API, serwer, konfiguracja, logi, plus narzędzia i E2E | 3: serwer, API, strony | 4: typy globalne, middleware, API, `src/lib` |
| (a) Pliki | **21 w `src` + 2** | 13 | 9 + 1 test |
| Granica klient/serwer | **SDK po obu stronach** | tylko serwer | tylko serwer (sesja w ciasteczkach `httpOnly`, `supabase.ts:11`) |
| Kontrakty wire | **propsy wyspy, JSON `/api/live-sync/config`, `CLIENT_STATES` w `POST /api/client-events` i w logach** | brak; odpowiedzi to kody domenowe | kody błędów Supabase w `?error=`, tłumaczone na polski w `auth-errors.ts` |
| Duplikacja | **3× budowa klienta, 2× subskrypcja, 3× `removeChannel`, 3× kształt configu** | brak, jedna brama `callRpc` | mała |
| Paczka przeglądarki | **cały SDK, około 215 KB (gzip około 55 KB), u każdego gracza** | — | — |
| (b) Koszt wymiany dziś | wysoki: hook, demo, 2 moduły serwera, 8 tras, kontrakt zgłoszeń, E2E, sonda | bardzo wysoki, ale przez SQL (logika w migracjach, `repo-map.md:15`), nie przez bibliotekę | wysoki: `auth.uid()` w SQL i RLS |
| (c) Dokumenty deklarują wymienność | **TAK, plan B Durable Objects** (`infrastructure.md:17, 55, 109, 195`) | nie | nie |

**Wybór #1: twarz Realtime pakietu `@supabase/supabase-js`, czyli dzwonek pokoju.** Wygrywa na wszystkich trzech
osiach naraz. Dotyka najwięcej warstw, jako jedyna przechodzi przez granicę klient/serwer, jako jedyna ma powielony
kod i jako jedyna wchodzi do kontraktów wire. Przede wszystkim tylko dla niej dokumenty deklarują zamiennik, a kod tej
deklaracji nie dotrzymuje (rozjazd intencji z kodem, §3.3).

Dlaczego nie D: brama do bazy już istnieje (`rooms/server.ts:7`) i nie zależy od Astro (research
`refactor-opportunities`, W8: `context/changes/refactor-opportunities/research.md:367`). Wymiana bazy to wymiana SQL,
której żaden adapter TS nie ukryje. Przecieka jedynie typ `SupabaseClient` w sygnaturach.

Dlaczego nie A: Auth jest już częściowo za ACL. Kody są tłumaczone na polski w `auth-errors.ts`, a `readUser` czyta
przez wąski `UserReader`. Nikt nie deklaruje wymiany, a Auth i tak jest spięty z RLS w SQL.

Kryterium z kroku 6 („grep po nazwie pakietu tylko w ACL”) dotyczy jednak całego pakietu. Dlatego projekt zakłada
jeden katalog ACL na cały pakiet: najpierw i najgłębiej dla R (fazy 1–4), a D i A jako krótsze fazy domykające (5–7).

---

## Krok 3. Diagnoza

### 3.1 Duplikacja (cytaty)

1. **Budowa klienta przeglądarki, dwie kopie i trzecia w sondzie, z tymi samymi opcjami Auth:**
   `useRoomState.ts:273-278` i `LiveSyncDemo.tsx:35-37` (`auth: { persistSession: false, autoRefreshToken: false,
   detectSessionInUrl: false }`) oraz `scripts/live-sync-probe.mjs:164`.
2. **Subskrypcja i stan kanału, dwie kopie o różnej semantyce:** `useRoomState.ts:281-320` (mapuje stany, raportuje,
   po `CLOSED` łączy się ponownie z backoffem) i `LiveSyncDemo.tsx:59-77` (tylko „połączono”/„rozłączono”).
3. **Zwalnianie kanału, trzy kopie o trzech politykach błędu:** `useRoomState.ts:334-338` (`.catch` → `logEvent`),
   `LiveSyncDemo.tsx:79-81` (`void`, bez obsługi), `live-sync/server.ts:29-31` (`await` w `finally`; odrzucenie łapie
   `rooms/server.ts:369-375`).
4. **Kształt configu, trzy deklaracje:** `supabase.ts:27`, `useRoomState.ts:19-22` (`LiveConfig`),
   `LiveSyncDemo.tsx:7-8`.
5. **Nazwy kanału:** `live-sync/shared.ts:3-4` i kopia w sondzie `live-sync-probe.mjs:11-13`. Kopia jest świadoma (K5).

### 3.2 Przecieki przez granice

- **SDK po obu stronach granicy klient/serwer.** Przeglądarka buduje pełnego klienta (`useRoomState.ts:275`), serwer
  nadaje przez `httpSend` z klienta żądania (`live-sync/server.ts:13-16`). Obie strony muszą zgadzać się co do tematu
  i zdarzenia, a pilnuje tego tylko wspólny moduł nazw (`live-sync/shared.ts:20-22`).
- **Cały SDK w paczce przeglądarki.** `createClient` zawsze buduje klienta Auth (`node_modules/@supabase/supabase-js/
  src/SupabaseClient.ts:349-353`), Realtime (`:387-392`), PostgREST (`:401-408`), Storage (`:410-415`) i nasłuch
  zdarzeń Auth (`:417-419`). Lokalny build w `dist/` (z 2026-10-20 10:26, nowszy niż ostatnia zmiana `src`:
  `cfe158f`, 2026-10-16; nie budowałem go w tej sesji) ma chunk `dist/client/_astro/shared.D87Ijxgj.js`: 214 781 B,
  54 595 B po gzip. Zawiera znaczniki wszystkich pięciu podbibliotek (`GoTrueClient`, `rest/v1`, `storage/v1`,
  `functions/v1`, `realtime/v1`) i importują go tylko `RoomScreen.D5PFp5ch.js` i `LiveSyncDemo.BR1Do__O.js`. Z całego
  SDK ekran używa wyłącznie kanału. To nie jest biblioteka serwerowa w bundlu, ale pakiet szerszy niż potrzeba.
  Wyciek kluczy nie występuje: strażnik `sb_publishable_` jest w `supabase.ts:28`.
- **Słownik biblioteki w kontrakcie wire i w logach.** `CLIENT_STATES` (`client-events.ts:10`) to dosłownie wartości
  `REALTIME_SUBSCRIBE_STATES` (`RealtimeChannel.ts:261-266`). Ekran je wysyła (`useRoomState.ts:116-120, 254`), a
  Worker zapisuje do logu (`api/client-events.ts:26-27`). Decyzja D4 ustaliła zamkniętą listę pól
  (`context/archive/2026-10-13-first-live-round/research.md:318`), ale nie neutralność słownika. Po przejściu na
  Durable Objects te nazwy przestałyby cokolwiek znaczyć.
- **Kształt configu biblioteki w propsach i w JSON.** `RoomScreen` dostaje `{ supabaseUrl, supabaseKey }`
  (`r/[id].astro:53, 65`), a `/api/live-sync/config` zwraca ten sam kształt (`config.ts:7-11`), który czyta sonda
  (`live-sync-probe.mjs:126-131, 164`).
- **Typ biblioteki w sygnaturach domenowych.** `ringLobby(locals, supabase: SupabaseClient, roomId)`
  (`rooms/server.ts:368`) wymusza na 8 trasach klienta Supabase tylko po to, żeby zadzwonić. Ta sama sygnatura
  przecieka w 10 funkcjach bramy danych (twarz D).
- **Wiedza o wnętrzu biblioteki w kodzie domenowym i UI.** `rooms/server.ts:49-53` (postgrest-js zamienia awarię
  sieci na status 0), `live-sync/server.ts:19-21` (`httpSend` rzuca `Error` bez statusu), `useRoomState.ts:302-303`
  (`CLOSED` usuwa kanał z klienta, `CHANNEL_ERROR` i `TIMED_OUT` dołączają same). To prawdziwe kontrakty biblioteki,
  sprawdzone w §5.4, ale leżą w trzech warstwach zamiast w adapterze.

### 3.3 Deklaracja wymienności a kod

Dokumenty mówią, że runda na żywo może przejść na Durable Objects (`infrastructure.md:55, 109, 195`), a Supabase
zostaje „do danych trwałych” (`external-research.md:32`). Kod tej obietnicy nie dotrzymuje. Wymiana dzwonka dotknęłaby
dziś hooka ekranu (`useRoomState.ts:272-339`), demo, dwóch modułów serwera, 8 tras (sygnatura `ringLobby`), strony
pokoju, endpointu configu, słownika zgłoszeń z logami, helpera E2E i sondy. Dokument ryzyk sam przyznaje, że plan B to
„kod pisany tylko pod Cloudflare” (`infrastructure.md:132-133`). Tym bardziej powinien zostać zamknięty w jednym
adapterze.

Druga, mniejsza rozbieżność: deklaracja „no auth client in the browser” (`supabase.ts:10`) nie zgadza się dosłownie z
kodem, bo `createClient` w wyspie zawsze tworzy klienta Auth (`SupabaseClient.ts:349-353`). Intencja jest jednak
dotrzymana: przeglądarka nie widzi sesji dzięki `httpOnly` (`supabase.ts:11`) i opcjom bez sesji
(`useRoomState.ts:276`).

### 3.4 Co jest zgodne z decyzjami i zostaje

- Przeglądarka dostaje adres i klucz publishable w runtime i tylko do Realtime (`AGENTS.md:12`,
  `live-sync-spike/research.md:38`). ACL tego nie zmienia, tylko zamyka w jednym obiekcie.
- Kanał niesie tylko dzwonek, a stan przychodzi z serwera (`infrastructure.md:189`, `useRoomState.ts:10-15`).
  Anonimowość (`AGENTS.md:7`) zostaje nietknięta, bo ładunek dzwonka powstaje w jednej funkcji VO (§4.2).
- Brama danych w jednym module (`rooms/server.ts:7`), klucze `room_lobby` jako kontrakt wire (`rooms/shared.ts:16`),
  kody błędów logowania tłumaczone na polski (`auth-errors.ts:3-5`). To świadome decyzje i plan ich nie podważa.
- Sonda i testy bazy znają Supabase celowo: mierzą i atakują samego dostawcę.

---

## Krok 4. Projekt ACL

### 4.1 Układ katalogów i reguła zależności

```
src/lib/live-sync/bell.ts         DOMENA: LiveStatus, LiveDropReason, LiveLink, porty RoomBellListener/RoomBellRinger
src/lib/rooms/store.ts            DOMENA: port RoomStore                          (faza 5)
src/lib/host-auth.ts              DOMENA: Host, port HostAuth                     (faza 6)
src/lib/live-sync/browser.ts      SKŁADANIE (przeglądarka): bellListener(link)    (faza 3)
src/lib/backend.ts                SKŁADANIE (serwer): requestBackend(...)         (faza 5)
src/lib/supabase/                 ACL: JEDYNE miejsce z „@supabase/*”
  index.ts                        przejściowy re-eksport (fazy 1–7, potem usunięty)
  server-client.ts                dawne src/lib/supabase.ts: createServerClient + ciasteczka, liveLink() z astro:env
  room-channel.ts                 VO: RoomChannel / LiveLink / LiveStatus ↔ typy Realtime
  realtime-server.ts              adapter RoomBellRinger (httpSend)
  realtime-browser.ts             adapter RoomBellListener (kanał w przeglądarce)
  room-store.ts                   adapter RoomStore (rpc, 3 selecty)              (faza 5)
  host-auth.ts                    adapter HostAuth (auth-js)                      (faza 6)
```

Reguła zależności: domena nie importuje niczego z ACL. ACL importuje typy domeny. Dwa korzenie składania importują
jedno i drugie. UI importuje tylko domenę i `@/lib/live-sync/browser`. Adaptery nie importują `server-client.ts` (on
jako jedyny czyta `astro:env/server`), więc test unit może je wołać z atrapą klienta (`test-plan.md:139`).

### 4.2 Value object `RoomChannel` / `LiveLink` / `LiveStatus`: jedyne miejsce wiedzy o kształcie Realtime

Domena (`src/lib/live-sync/bell.ts`, bez typów biblioteki, bezpieczna w przeglądarce):

```ts
import type { ClientState } from "@/lib/client-events";

// Dlaczego połączenie na żywo leży. Wartości to kontrakt POST /api/client-events (CLIENT_STATES) i pól logu; od teraz
// słowa gry, nie biblioteki. Zostają bajt w bajt (zgodność wsteczna logów i zgłoszeń).
export type LiveDropReason = Extract<ClientState, "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED">;
export type LiveStatus = { readonly live: true } | { readonly live: false; readonly reason: LiveDropReason };

// Dostęp, który serwer daje wyspie, żeby słyszała dzwonek pokoju. Nieprzezroczysty dla UI (czyta go tylko adapter),
// serializowalny (propsy Astro). Dla Supabase: adres projektu + klucz publishable; dla Durable Objects: adres Workera.
export interface LiveLink {
  readonly endpoint: string;
  readonly credential: string;
}
```

ACL (`src/lib/supabase/room-channel.ts`), jedyny plik z tłumaczeniem w obie strony:

```ts
import { REALTIME_SUBSCRIBE_STATES, type SupabaseClientOptions } from "@supabase/supabase-js";
import type { LiveLink, LiveStatus } from "@/lib/live-sync/bell";

const TOPIC_PREFIX = "live-sync:";          // dziś live-sync/shared.ts:3; sonda trzyma kopię (K5)
export const BELL_EVENT = "bell";           // dziś live-sync/shared.ts:4

export interface RoomChannel { readonly roomId: string; readonly topic: string }
export function roomChannel(roomId: string): RoomChannel;             // { roomId, topic: TOPIC_PREFIX + roomId }

// domena → biblioteka: jedyny ładunek, jaki nadaje serwer (infrastructure.md:189: tylko dzwonek, nic o głosach)
export function bellPayload(seq: number): { seq: number };
// biblioteka → domena: niezaufana podpowiedź z wiadomości broadcast (demo F-01 czyta seq, ekran pokoju ignoruje)
export function bellHint(message: unknown): unknown;                  // message.payload albo undefined

// biblioteka → domena (dziś channelState, useRoomState.ts:116-120, i gałąź SUBSCRIBED :291)
export function liveStatusFrom(state: REALTIME_SUBSCRIBE_STATES): LiveStatus {
  SUBSCRIBED → { live: true }; TIMED_OUT → { live: false, reason: "TIMED_OUT" };
  CLOSED → { live: false, reason: "CLOSED" }; inaczej → { live: false, reason: "CHANNEL_ERROR" }
}
// kontrakt biblioteki (§5.4, Q3): tylko CLOSED wymaga nowego kanału; ERROR/TIMED_OUT dołączają same
export function needsNewChannel(state: REALTIME_SUBSCRIBE_STATES): boolean;    // state === CLOSED
export function resubscribeDelay(attempt: number): number;   // min(1000·2^attempt, 30 000); dziś useRoomState.ts:47-48, 315

// env → domena (ten sam warunek co supabase.ts:28; AGENTS.md:12)
export function liveLinkFrom(url: string | undefined, key: string | undefined): LiveLink | null {
  if (!url || !key?.startsWith("sb_publishable_")) return null;
  return { endpoint: url, credential: key };
}
// domena → wire sondy (GET /api/live-sync/config; kontrakt live-sync-probe.mjs:126-131, 164), bez zmian w JSON
export function publicConfigJson(link: LiveLink): { supabaseUrl: string; supabaseKey: string };
// domena → biblioteka: klient „tylko Realtime”, jedna kopia opcji (dziś useRoomState.ts:275-277, LiveSyncDemo.tsx:35-37)
export function realtimeOnlyClient(link: LiveLink): [url: string, key: string, options: SupabaseClientOptions<"public">];
```

### 4.3 Wąskie porty (domena)

```ts
// src/lib/live-sync/bell.ts (cd.)
export interface BellHandlers {
  bell(hint: unknown): void;            // „sprawdź stan”; treść nie decyduje o niczym (niezaufana podpowiedź)
  status(status: LiveStatus): void;     // przy każdej zmianie stanu połączenia
}
// Przeglądarka: słucha, aż wywołamy stop(); sama odtwarza zamknięte połączenie.
export interface RoomBellListener {
  listen(roomId: string, on: BellHandlers): () => void;
}
// Serwer: budzi wszystkich na kanale pokoju. Nigdy nie rzuca; porażkę loguje sam (logEvent, pola z log.ts).
export type RingOutcome = { ok: true } | { ok: false };
export interface RoomBellRinger {
  ring(roomId: string, seq: number): Promise<RingOutcome>;
}
```

Dwie metody na krzyż i zero typów biblioteki. Reszta kodu zna tylko te porty.

### 4.4 Adaptery Supabase (pseudokod)

```ts
// src/lib/supabase/realtime-server.ts (dziś live-sync/server.ts:9-32, przeniesione dosłownie)
import type { SupabaseClient } from "@supabase/supabase-js";
const RING_TIMEOUT_MS = 5000;                         // F-01: 5 s zamiast domyślnych 10 s biblioteki (§5.4, Q2)
export function supabaseBellRinger(client: SupabaseClient): RoomBellRinger {
  return { async ring(roomId, seq) {
    const channel = client.channel(roomChannel(roomId).topic);
    try {
      const result = await channel.httpSend(BELL_EVENT, bellPayload(seq), { timeout: RING_TIMEOUT_MS });
      return { ok: result.success };                  // typ dopuszcza success:false, kod 2.116 zwraca tylko true (Q2)
    } catch (error) {
      // Q2: komunikat to powód serwera Realtime albo statusText, bez klucza i danych żądania → pole code (log.ts:9, :35)
      logEvent("error", { op: "ring", roomId, errName: nameOf(error), code: messageOf(error) });
      return { ok: false };
    } finally {
      await client.removeChannel(channel);            // Q1: rozwiązuje się statusem, nie odrzuceniem
    }
  } };
}

// src/lib/supabase/realtime-browser.ts (dziś useRoomState.ts:272-339 bez logiki ekranu)
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
export function supabaseBellListener(link: LiveLink): RoomBellListener {
  const client = createClient(...realtimeOnlyClient(link));
  return { listen(roomId, on) {
    let channel: RealtimeChannel | null = null, stopped = false, attempt = 0, timer;
    const open = () => {
      const current = client.channel(roomChannel(roomId).topic);  // po CLOSED channel() tworzy nowy (Q3)
      channel = current;
      current.on("broadcast", { event: BELL_EVENT }, (m) => on.bell(bellHint(m)))
             .subscribe((state) => {
               if (stopped || channel !== current) return;          // jak useRoomState.ts:290
               const status = liveStatusFrom(state);
               if (status.live) attempt = 0;
               on.status(status);
               if (needsNewChannel(state)) timer = setTimeout(() => { if (!stopped) open(); }, resubscribeDelay(attempt++));
             });
    };
    open();
    return () => {
      stopped = true; clearTimeout(timer);
      if (channel) client.removeChannel(channel).catch((e) =>
        logEvent("warn", { op: "room_channel", roomId, step: "remove", errName: nameOf(e) }));   // jak useRoomState.ts:335-337
    };
  } };
}
```

### 4.5 Korzenie składania

```ts
// src/lib/live-sync/browser.ts (przeglądarka; jedyny plik UI-side, który zna ACL)
export const bellListener = (link: LiveLink): RoomBellListener => supabaseBellListener(link);

// src/lib/backend.ts (serwer; faza 5). Świeży klient przy każdym wywołaniu, jak dziś createClient(...) w każdej trasie.
export function requestBackend(headers: Headers, cookies: AstroCookies):
  { store: RoomStore; bell: RoomBellRinger; auth: HostAuth } | null;   // null = brak konfiguracji, jak supabase.ts:6-8
export function liveLink(): LiveLink | null;                          // liveLinkFrom(SUPABASE_URL, SUPABASE_KEY)
```

### 4.6 Porty dla pozostałych twarzy (szkic do faz 5–6)

```ts
// src/lib/rooms/store.ts: brama danych; odpowiedź już oczyszczona (bez message/details, rooms/server.ts:55-56)
export type RoomFunction = "create_room" | "room_link" | "join_room" | "room_lobby" | "start_game"
  | "cast_vote" | "reveal_round" | "next_round" | "skip_round" | "end_game";
export type StoreAnswer = { ok: true; data: unknown } | { ok: false; status: number; code?: string; errName?: string };
export interface RoomStore {
  rpc(fn: RoomFunction, args: Readonly<Record<string, unknown>>): Promise<StoreAnswer>;  // zawsze POST (Q5)
  ownOpenRoomId(): Promise<StoreAnswer>;                                // dziś rooms/server.ts:311
  ownRoom(roomId: string, columns: "link_token" | "categories, adult_categories"): Promise<StoreAnswer>; // :328, :343
}
// rooms/server.ts zostaje domeną: parsery kształtu, odmowy, logFailure, mapowanie status 0/5xx → service_unavailable.
// Do adaptera room-store.ts idą: supabase.rpc/from, try/catch → status 0 + errName, transportErrorName (Q4).

// src/lib/host-auth.ts
export interface Host { readonly id: string; readonly email: string | null }   // App.Locals.user; dashboard.astro:14
export type AuthFailure = { code: string; name: string; status?: number; errorCode?: string }; // code → URL, reszta → log
export const HOST_PROVIDERS = ["discord", "google"] as const;                  // adapter: satisfies readonly Provider[]
export interface HostAuth {
  currentHost(): Promise<Host | null>;                                         // dziś readUser (auth-user.ts:12-19)
  signInWithPassword(email: string, password: string): Promise<{ ok: true } | ({ ok: false } & AuthFailure)>;
  startOAuth(provider: (typeof HOST_PROVIDERS)[number], redirectTo: string): Promise<{ ok: true; url: string } | ({ ok: false } & AuthFailure)>;
  finishOAuth(code: string): Promise<{ ok: true } | ({ ok: false } & AuthFailure)>;
  signOutHere(): Promise<void>;                                                // scope "local" (signout.ts:7-8)
}
// Do adaptera host-auth.ts idą: authErrorCode (auth-errors.ts:43-48), rozpoznanie gościa (Q7), prompt=select_account
// dla Google (oauth.ts:35-36). authErrorMessage (kod → polski tekst) zostaje w domenie.
```

### 4.7 Strażnik granicy

- ESLint `@typescript-eslint/no-restricted-imports` z `patterns: ["@supabase/*"]` dla `src/**` z wyjątkiem
  `src/lib/supabase/**`. To ten sam mechanizm co dziś dla testów (`eslint.config.js:94-109`) i ta sama ścieżka „najpierw
  ostrzeżenie, potem błąd” co D7 (`context/changes/refactor-opportunities/plan-brief.md:38-39`).
- Druga reguła: `src/components/**` i `src/lib/live-sync/browser.ts` nie mogą importować `@/lib/backend`,
  `@/lib/supabase` ani `@/lib/supabase/{server-client,room-store,host-auth}`. To chroni paczkę przeglądarki przed
  modułem z `astro:env/server`.
- Reguła nie widzi typów `import("…")`. `no-restricted-imports` sprawdza tylko deklaracje importu i eksportu oraz
  `import x = require()` (`node_modules/@typescript-eslint/eslint-plugin/dist/rules/no-restricted-imports.js:208-236`),
  więc `src/env.d.ts:3` przeszedłby niezauważony. Zapasem jest grep z §6.1, dopięty do `npm run lint` małym skryptem,
  tak jak `scripts/ui-literals.mjs`.

---

## Krok 5. Dowód izolacji, przed/po, kontrakt biblioteki

### 5.1 Co dotyka wymiana (po fazach 1–4, a dla S4 po 5–6)

| Scenariusz | Zmienia się | NIE zmienia się |
| --- | --- | --- |
| **S1. Plan B: Realtime → Durable Objects** (`infrastructure.md:55`) | nowe adaptery `RoomBellRinger` i `RoomBellListener` (np. `src/lib/durable/*`); 1 linia w `src/lib/live-sync/browser.ts`; 1 linia w składaniu serwera (`bell`); źródło `LiveLink` (adres Workera); infrastruktura poza aplikacją (klasa DO, binding w `wrangler.jsonc`); testy transportu: `tests/e2e/support/realtime.ts:20`, sonda | **tabele i migracje** (dzwonek nie ma persystencji); **trasy API** (wołają `ringLobby`/`bell.ring`); **strona pokoju** (podaje `LiveLink`); **UI** (`RoomScreen`, `LiveBanner` dostają `liveBroken`, hook dostaje `LiveStatus`); **kontrakt zgłoszeń i logi** (`CLIENT_STATES` to słowa domeny, nowy adapter mapuje na nie swoje zdarzenia); limiter i odpytywanie (`live-sync/limiter.ts`, `LOBBY_POLL_MS`) |
| **S2. Odchudzenie paczki: supabase-js → realtime-js w przeglądarce** | `src/lib/supabase/realtime-browser.ts`, `package.json` | wszystko poza ACL |
| **S3. Major supabase-js zmienia `REALTIME_SUBSCRIBE_STATES` albo `httpSend`** | `room-channel.ts`, `realtime-*.ts` | wszystko poza ACL |
| **S4. Zmiana API auth-js/postgrest-js** | `host-auth.ts` / `room-store.ts` | trasy, strony, middleware (znają porty) |
| Wymiana całej bazy | **nie da się ukryć**: SQL, RLS i `auth.uid()` siedzą w `supabase/migrations/` | — |

### 5.2 Przed/po w powielonych miejscach

**(1) Budowa klienta w przeglądarce**

Przed (`useRoomState.ts:273-278`, a niemal tak samo `LiveSyncDemo.tsx:35-37`):

```ts
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  : null;
```

Po (hook):

```ts
const listener = live ? bellListener(live) : null;        // live: LiveLink | null z propsów; zero wiedzy o Supabase
```

**(2) Subskrypcja i stan kanału**

Przed: `useRoomState.ts:116-120` (`channelState`) i `:281-320`. Hook zna `REALTIME_SUBSCRIBE_STATES`, `RealtimeChannel`,
regułę „po `CLOSED` nowy kanał” i backoff. Po:

```ts
const stop = listener?.listen(roomId, {
  bell: () => limiter.bell(),
  status: (s) => {
    if (s.live) { const wasBroken = broken !== null; broken = null; reported = false; disarmReport();
                  setLiveBroken(false); if (wasBroken) schedulePoll(); limiter.refresh(); return; }
    const wasSubscribed = broken === null; broken = s.reason;            // ClientState, jak dziś
    setLiveBroken(true); if (wasSubscribed) schedulePoll(); armReport();
  },
});
// sprzątanie efektu: stop?.()  (zamiast useRoomState.ts:334-338)
```

Polityka zgłoszeń (D4: `useRoomState.ts:42-45`), odpytywanie i przeładowanie po 404 zostają w hooku bez zmian. Wynoszę
tylko transport.

**(3) Dzwonek na serwerze**

Przed: `live-sync/server.ts:12-32` i `rooms/server.ts:368-381`, a każda z 8 tras robi
`ringLobby(context.locals, supabase, roomId)`. Po fazie 2 trasy się nie zmieniają (Strangler: `ringLobby` buduje
`supabaseBellRinger(supabase)` w środku). Po fazie 5:

```ts
const backend = requestBackend(context.request.headers, context.cookies);
if (!backend) return actionAnswer(OP, roomId, { ok: false, reason: "service_unavailable" });
const result = await revealRound(backend.store, roomId);
if (result.ok) await ringLobby(context.locals, backend.bell, roomId);   // port zamiast SupabaseClient
```

**(4) Kształt configu**

Przed: `{ supabaseUrl; supabaseKey }` w trzech miejscach (§3.1, pkt 4). Po: jeden typ domeny `LiveLink`
(`bell.ts`), konwersje tylko w VO: `liveLinkFrom` przy wejściu i `realtimeOnlyClient` / `publicConfigJson` przy
wyjściu. JSON dla sondy zostaje bajt w bajt.

**(5) Brama danych (faza 5)**

Przed: `callRpc(supabase: SupabaseClient, …)` w `rooms/server.ts:82-98`. Po: `callRpc(store: RoomStore, …)` woła
`store.rpc(fn, args)` i dalej robi to samo (odmowy, kształt, log). Transport i parsowanie błędu postgrest-js są w
`room-store.ts`.

### 5.3 UI dostaje gotowe dane domenowe

Pod hookiem UI jest już czyste: `RoomScreen` dostaje `{ view: RoomView (sparsowany), refreshFailed, liveBroken,
refresh }` (`RoomScreen.tsx:80`), a `LiveBanner` tylko wartość logiczną (`:202`). Brudny jest hook i propsy. Po
refaktorze hook dostaje `LiveStatus` zamiast `REALTIME_SUBSCRIBE_STATES` i nie trzyma `RealtimeChannel`. `RoomScreen`
dostaje nieprzezroczysty `LiveLink` zamiast `{ supabaseUrl, supabaseKey }`. `RoomErrorBoundary`
(`RoomErrorBoundary.tsx:5`) dalej bierze `reportClientEvent` z hooka, bez zmian.

### 5.4 Pytania zależne od kontraktu biblioteki: rozstrzygnięcia z `node_modules` (supabase-js/realtime-js/postgrest-js/auth-js 2.116.0)

| # | Pytanie | Co mówi biblioteka | Gdzie kodujemy decyzję |
| --- | --- | --- | --- |
| Q1 | Czy `removeChannel` odrzuca przy porażce? | **Nie.** Rozwiązuje się wartością `'ok' \| 'timed out' \| 'error'` (`realtime-js/src/RealtimeClient.ts:40, 370-378`, `RealtimeChannel.ts:1151-1158`), a przy wyniku innym niż `'ok'` nie robi `teardown`. Dzisiejszy `.catch` (`useRoomState.ts:335-337`) i komentarz „Only removeChannel's failure gets here” (`rooms/server.ts:371`) zakładają odrzucenie, więc `'error'` i `'timed out'` znikają po cichu. | W adapterach (`realtime-*.ts`). Refaktor zachowuje dzisiejsze zachowanie, czyli bez nowych linii logu. Logowanie `{ op, step: "remove", code: status }` to osobna zmiana, ale w jednym miejscu. |
| Q2 | Co zwraca `httpSend`? | Typ obiecuje `{ success: false; status; error }` (`RealtimeChannel.ts:944-948`), ale kod zwraca tylko `{ success: true }` przy 202 (`:982-984`) i odrzuca w każdym innym przypadku `Error` z `body.error \|\| body.message \|\| statusText` (`:986-1002`). Timeout działa przez `AbortController` (`:1171-1183`), domyślnie 10 s (`lib/constants.ts:20`). | `realtime-server.ts`: obie gałęzie mapowane na `RingOutcome`. Uzasadnienie wyjątku od `AGENTS.md:20` („never an error message”) leży przy adapterze, bo komunikat to powód serwera, a `log.ts:35` tnie go do 200 znaków. Timeout 5 s też w adapterze. **Nie w trasie API.** |
| Q3 | Które stany kanału są końcowe? | `CLOSED`: kanał sam usuwa się z klienta (`RealtimeChannel.ts:387-388`, phoenix `assets/js/phoenix/channel.js:65-70`), a `channel(topic)` tworzy wtedy nowy (`RealtimeClient.ts:462-475`). `CHANNEL_ERROR` i `TIMED_OUT`: biblioteka sama planuje ponowne dołączenie (phoenix `channel.js:45-47, 60-64, 71-84`; ta sama logika w buildzie `priv/static/phoenix.cjs.js:259-309`). Callback dostaje stany z `RealtimeChannel.ts:453-457, 486-493`. | `room-channel.ts` (`needsNewChannel`) i `realtime-browser.ts` (backoff). Kontrakt portu: „`listen` próbuje do `stop()`”. Hook o tym nie wie. |
| Q4 | Jak wygląda awaria sieci w PostgREST? | `{ status: 0, error: { code: "", message: "<Name>: <msg>" } }` (`postgrest-js/src/PostgrestBuilder.ts:345-357`). `rooms/server.ts:49-53` na tym polega. | `room-store.ts` (faza 5). Port zwraca już `errName`, nigdy `message`. |
| Q5 | Czy `rpc` może wysłać argumenty w URL? | Tylko z `get`/`head`; domyślnie POST z ciałem (`PostgrestClient.ts:534-557`). | `room-store.ts`: port nie ma opcji `get`. To reguła z `rooms/server.ts:80-81` i anonimowość głosu (`AGENTS.md:7`). |
| Q6 | Czy klient „tylko Realtime” to naprawdę tylko Realtime? | Nie. `createClient` buduje Auth, Realtime, PostgREST i Storage (`supabase-js/src/SupabaseClient.ts:349-353, 387-392, 401-415`) i słucha zdarzeń Auth (`:417-419`). Samo realtime-js działa osobno z `params.apikey` (`realtime-js/README.md:50-58`), a bez klucza konstruktor rzuca (`RealtimeClient.ts:277-282`). | Opcje w `realtimeOnlyClient` (VO). Odchudzenie paczki (S2) to osobna zmiana, bo wymaga jawnej zależności w `package.json`, czyli instalacji za zgodą. |
| Q7 | Po czym poznać gościa i awarię Auth? | Gość: `AuthSessionMissingError` (`auth-js/src/lib/errors.ts:134-137`). Awaria: `isAuthRetryableFetchError` (`errors.ts:296-298`). | `host-auth.ts` (faza 6). |
| Q8 | Czy dzwonek z serwera niesie tożsamość? | `httpSend` dokłada `Authorization`, gdy gniazdo ma token (`RealtimeChannel.ts:960-962`). Czy klient żądania z ciasteczkami hosta go ma, **nie sprawdziłem** [U]. | Refaktor zostawia dzwonek na kliencie żądania (zero zmian na drucie). Ringer bez sesji, budowany z samego env, to osobna decyzja. |

Otwarte pytanie projektu zależne od tego obszaru: los prototypu F-01 i `/api/live-sync/*`
(`context/changes/refactor-opportunities/research.md:438`, „Decyzja produktowa”). Rozstrzyga go właściciel przed
fazą 4. Warianty są w §6.3.

---

## Krok 6. Weryfikacja i plan

### 6.1 Kryterium sukcesu: grep dziś i po

Polecenia (uruchomione 2026-10-20 w katalogu repo):

```
K-A  grep -rlE "@supabase/" src scripts tests --include='*.ts' --include='*.tsx' --include='*.astro' --include='*.mjs' --include='*.js'
K-A' grep -rlE "@supabase/" src --include='*.ts' --include='*.tsx' --include='*.astro' | grep -v '^src/lib/supabase/'
K-B  grep -rlE "REALTIME_SUBSCRIBE_STATES|RealtimeChannel|httpSend|removeChannel|\.channel\(|supabaseUrl|supabaseKey|getPublicSupabaseConfig|LiveConfig" src
K-C  grep -rlE "@supabase/" src/components
K-D  grep -rlE "SupabaseClient" src | grep -v '^src/lib/supabase/'
K-E  grep -rlE "from \"@/lib/supabase(/[a-z-]+)?\"" src | grep -v '^src/lib/supabase/'
```

| Miara | Dziś (zmierzone) | Po fazie 4 (cel, Realtime) | Po fazie 7 (cel, cały pakiet) |
| --- | --- | --- | --- |
| **K-A**: pliki z nazwą pakietu | **12** (`src` 9, `scripts` 1, `tests` 2) | `src` 9 (4 w ACL + 5 poza) | `src` **6, wszystkie w `src/lib/supabase/`**; poza `src`: `scripts/live-sync-probe.mjs`, `tests/db/support/clients.ts` i testy ACL w `tests/unit/supabase/` (importy typów) |
| **K-A'**: nazwa pakietu w `src` poza ACL | **9** | 5 | **0** |
| **K-B**: kształt Realtime w `src` | **9** | **3** (`room-channel.ts`, `realtime-browser.ts`, `realtime-server.ts`) | 3 |
| **K-C**: nazwa pakietu w UI | **2** | **0** | 0 |
| **K-D**: `SupabaseClient` poza ACL | **2** | 1 (`rooms/server.ts`) | **0** |
| **K-E**: importy wejścia do ACL poza ACL | **20** | 20 (przejściowo przez `index.ts`) | **2** (`src/lib/backend.ts`, `src/lib/live-sync/browser.ts`) |

Kryterium końcowe: **K-A' = 0 i K-B = 3**, a lint z regułą z §4.7 jako błędem jest zielony. Wyjątki poza `src` są
wymienione z nazwy. Każdy nowy plik z nazwą pakietu poza tą listą to czerwone światło.

### 6.2 Kto dziś zna zależność, a po refaktorze już nie

Przestają znać pakiet (z K-A, 9 plików `src`):

- **fazy 2–4:** `src/components/room/useRoomState.ts`, `src/components/live-sync/LiveSyncDemo.tsx` (albo trafia do
  ACL, wariant A1), `src/lib/live-sync/server.ts`;
- **faza 1:** `src/lib/supabase.ts` przechodzi do ACL jako `server-client.ts`;
- **faza 5:** `src/lib/rooms/server.ts`;
- **faza 6:** `src/env.d.ts`, `src/lib/auth-user.ts` (przechodzi do ACL), `src/lib/auth-errors.ts` (zostaje tylko
  `authErrorMessage`), `src/pages/api/auth/oauth.ts`.

Przestają znać kształt biblioteki pośrednio:

- `RoomScreen.tsx`, `client-events.ts` (słownik staje się domeną);
- `live-sync/shared.ts` (nazwy kanału idą do VO; zostają `LOBBY_POLL_MS`, z którego korzystają testy E2E, np.
  `tests/e2e/lobby-connection-drop.spec.ts:5`, oraz walidatory);
- `r/[id].astro`, `dev/live-sync.astro`, `api/live-sync/config.ts`, `api/live-sync/ring.ts`;
- 8 tras z `ringLobby`, a po fazie 5 wszystkie 20 importerów `@/lib/supabase` (zamiast tego `@/lib/backend`).

Znają i znać będą: pliki ACL, sonda, `tests/db/support/clients.ts`, testy ACL i helper transportu E2E
(`tests/e2e/support/realtime.ts:20`).

### 6.3 Plan faz

Konwencja projektu: `/10x-new` → `/10x-research` → weryfikacja ast-grep → `/10x-plan` → `/10x-plan-review` →
`/10x-implement` (`CLAUDE.md`). Najpierw zabezpieczenie, każda faza osobnym, cofalnym commitem, Strangler Fig zamiast
big-bangu i bez zmiany obserwowalnego zachowania. Zmiany w `src/lib/rooms/`, `src/pages/api/rooms/`, `src/pages/j/`,
`src/pages/r/` i `tests/` idą tylko przez PR i scalenie na zielonym CI z jobem `db` (`AGENTS.md:10`). Każdy push
wymaga zgody Karola (`AGENTS.md:9`). Przed oddaniem fazy: `npm run lint`, `npx astro check`, `npm test`,
`npm run build` (`AGENTS.md:29`), a w CI dodatkowo `db`, `e2e` i `smoke`.

**Warunek wstępny:** najpierw zaimplementowana i scalona zmiana `refactor-opportunities` (status `plan_reviewed`,
`context/changes/refactor-opportunities/change.md:4`). Jej test bramy RPC (K1, atrapa `{ rpc(fn, args) }`,
`plan-brief.md:61-64`) to siatka dla fazy 5, a reguła D7 dotyka tych samych plików (`eslint.config.js`,
`useRoomState.ts:99-100, 110`). Kolejność unika konfliktów.

| Faza | Co dostarcza | Pliki (🔒 = tylko przez PR) | Zabezpieczenie / dowód | Cofnięcie |
| --- | --- | --- | --- | --- |
| **0. Testy charakteryzujące** | Utrwalenie dzisiejszego zachowania dzwonka i kodów Auth, które dziś nie mają testu (w `tests/unit` brak `ringRoom`, `ringLobby`, `authErrorCode`) | 🔒 `tests/unit/supabase/ring.test.ts`: `ringRoom` z atrapą typowaną `import type { SupabaseClient }` (dozwolone, `eslint.config.js:105`): 202 → `ok`; odrzucenie → `ok: false` + jedna linia `{ op: "ring", roomId, errName, code }`; temat `live-sync:<id>`, zdarzenie `bell`, `timeout: 5000`; `removeChannel` zawsze. `ringLobby`: z `cfContext` → `waitUntil`, bez niego `await`, odrzucenie → `step: "remove_channel"`. 🔒 `tests/unit/auth-errors.test.ts`: `authErrorCode` (retryable / ≥500 → `service_unavailable`, kod bez zmian, brak kodu → `unknown`), `authErrorMessage` z przypadkiem `"constructor"` (`test-plan.md:142`) | Wyrocznia z decyzji F-01 i UI logowania (`ui-signin-contract/plan.md:24`, `ui-checks.md:95`), nie z kodu (`test-plan.md:140`). Hook ekranu charakteryzują istniejące E2E (`lobby-connection-drop.spec.ts:10`, `game.spec.ts`, `seed.spec.ts`; job `e2e`) | usunięcie plików |
| **1. Szkielet ACL + strażnik (ostrzeżenie)** | `git mv src/lib/supabase.ts src/lib/supabase/server-client.ts` + `index.ts` z re-eksportem (20 importerów `@/lib/supabase` bez zmian); reguła z §4.7 jako **warn**; w regule testów dopisane `@/lib/supabase/server-client` | `src/lib/supabase/*`, `eslint.config.js`, `AGENTS.md:11` (ścieżka), `test-plan.md:139` (ścieżka) | Lint: **dokładnie 7 ostrzeżeń** (`LiveSyncDemo.tsx:2`, `useRoomState.ts:2`, `auth-errors.ts:1`, `auth-user.ts:1`, `live-sync/server.ts:1`, `rooms/server.ts:1`, `oauth.ts:2`); `env.d.ts:3` widać tylko w grepie. Build: te same chunki. [U] rozwiązywanie `@/lib/supabase` → `index.ts` sprawdza `astro check` + build | `git revert` |
| **2. Serwer: dzwonek za portem** | `bell.ts` (domena), `room-channel.ts` (na razie bierze nazwy z `live-sync/shared.ts`; zależność ACL → domena jest dozwolona), `realtime-server.ts`; `ringRoom` w `live-sync/server.ts` zostaje cienką nakładką (Strangler), `ringLobby` buduje ringer w środku | 🔒 `src/lib/rooms/server.ts`, `src/lib/live-sync/server.ts`, `src/lib/supabase/*`, `src/lib/live-sync/bell.ts` | Testy fazy 0 **bez zmian i zielone**; E2E i smoke zielone | `git revert` |
| **3. Przeglądarka: ekran pokoju za portem** | `realtime-browser.ts`, `live-sync/browser.ts`, w VO `liveStatusFrom` / `needsNewChannel` / `resubscribeDelay` / `liveLinkFrom` / `realtimeOnlyClient`; `liveLink()` w `server-client.ts`; hook na porcie (§5.2, pkt 2); `RoomScreen` i strona pokoju podają `LiveLink` (nazwa propsa `realtime` zostaje, więc 54 podglądy dev bez zmian) | `useRoomState.ts`, `RoomScreen.tsx`, 🔒 `src/pages/r/[id].astro`, `src/lib/supabase/*`, 🔒 `tests/unit/supabase/room-channel.test.ts` | Unit: tabela 4 stanów → `LiveStatus` (wyrocznia: enum `RealtimeChannel.ts:261-266` i kontrakt `client-events.ts:10`), ciąg opóźnień 1, 2, 4… 30 s (zapisana decyzja `useRoomState.ts:46`), strażnik `sb_publishable_` (`AGENTS.md:12`). E2E zerwania połączenia zielone. Chunk SDK importują dalej tylko te same 2 wyspy | `git revert` |
| **4. Demo F-01, endpoint configu, nazwy kanału do VO** | Wariant wybiera właściciel: **A1 (zalecany w refaktorze)** — logika demo przeniesiona dosłownie do `src/lib/supabase/realtime-demo.ts`, zero zmian zachowania; **A2** — demo na wspólnym porcie, czyli zyskuje ponowne łączenie po `CLOSED` i `.catch` (zmiana zachowania strony dev, więc osobna zmiana); **B** — usunięcie demo (produkt, osobna zmiana). `config.ts` → `publicConfigJson(link)` (JSON bez zmian); `TOPIC_PREFIX` / `BELL_EVENT` / `topicFor` przechodzą z `shared.ts` do VO; poprawka `shared.ts:1`; usunięcie `getPublicSupabaseConfig` | `LiveSyncDemo.tsx`, `dev/live-sync.astro`, `api/live-sync/config.ts`, `api/live-sync/ring.ts`, `live-sync/shared.ts`, `src/lib/supabase/*` | **K-B = 3, K-C = 0** (etap 1 kryterium). Sonda: `GET /api/live-sync/config` zwraca te same klucze | `git revert` |
| **5. Dane za portem `RoomStore`** | `rooms/store.ts`, `supabase/room-store.ts`, `src/lib/backend.ts`; `rooms/server.ts` na `RoomStore`; trasy i strony na `requestBackend` (świeży klient przy każdym wywołaniu, jak dziś) | 🔒 `src/lib/rooms/*`, 🔒 9 tras `src/pages/api/rooms/**`, `api/live-sync/ring.ts`, `index.astro`, 🔒 `j/[token].astro`, 🔒 `r/[id].astro`, 🔒 test K1 (atrapa owinięta `supabaseRoomStore(fake)`: test dalej pilnuje drzwi dostawcy) | K1 zielony bez zmiany tabeli sygnatur; `db`, E2E, smoke | `git revert` |
| **6. Logowanie za portem `HostAuth`** | `host-auth.ts` (domena) i `supabase/host-auth.ts`; `App.Locals.user: Host \| null`; middleware i 4 trasy auth na porcie (te same przekierowania i linie `console.error`); `auth-user.test.ts` → `tests/unit/supabase/host-auth.test.ts` (te same przypadki) | `env.d.ts`, `middleware.ts`, `api/auth/*`, `auth-errors.ts`, `auth-user.ts`, 🔒 `tests/unit/*` | Testy z fazy 0 i `auth-user` zielone; E2E `auth.setup.ts`; smoke (logowanie) | `git revert` |
| **7. Strażnik jako błąd + sprzątanie** | Usunięte nakładki Strangler (`ringRoom` w `live-sync/server.ts`, `index.ts`); test fazy 0 przepięty na adapter; reguła **error** i reguła paczki przeglądarki; grep `import("@supabase/` w `npm run lint`; jedna linia w `AGENTS.md` (Conventions): „`@supabase/*` tylko w `src/lib/supabase/`” | `eslint.config.js`, `scripts/*`, `AGENTS.md`, 🔒 `tests/unit/supabase/*` | **K-A' = 0, K-D = 0, K-E = 2** | `git revert` |
| 8. (osobna zmiana, nie refaktor) | S2: przeglądarka na `RealtimeClient` z `@supabase/realtime-js` (mniejszy chunk); logowanie statusów `removeChannel` (Q1); ewentualnie ringer bez sesji (Q8) | `package.json` (instalacja, za zgodą) + adaptery | zmiana zachowania sieci lub logów, więc własny cykl `/10x-new` | — |

Minimalne sensowne cięcie to fazy 0–4: cała twarz #1 i etap 1 kryterium. Fazy 5–7 dają pełne „grep tylko w ACL”, ale
mają małą wartość dla gry dziś.

### 6.4 Czego ten plan nie robi

- Nie rusza SQL ani migracji i nie dodaje `db push`. Nie zmienia kontraktów wire: `CLIENT_STATES`, JSON configu,
  odpowiedzi tras, pola logów.
- Nie łączy dwóch klientów na jedno żądanie (middleware `middleware.ts:8` i trasa, np. `signin.ts:17`), bo to zmiana
  zachowania sesji.
- Nie wprowadza wygenerowanych typów bazy. Ten temat był rozważony i odrzucony w `refactor-opportunities`.
- Nie przepisuje sondy (K5, świadome odstępstwo).

### 6.5 Ryzyka

- **Subtelna zmiana kolejności zdarzeń w hooku** (strażnik `channel !== current`, `useRoomState.ts:290`). Środek
  zaradczy: przeniesienie dosłowne i E2E zerwania połączenia w CI.
- **Moduł z `astro:env/server` w paczce przeglądarki** przez `index.ts`. Środek zaradczy: wyspy importują tylko
  `@/lib/live-sync/browser`, reguła z §4.7 i kontrola builda.
- **Za dużo abstrakcji jak na projekt jednej osoby.** Środek zaradczy: porty mają po 1–2 metody, a po fazie 4 można
  świadomie stanąć.
- **„Fałszywa zieleń” kryterium**, jeśli lista wyjątków poza `src` nie będzie zamknięta. Lista jest w §6.1.
- **Konflikty z `refactor-opportunities`.** Środek zaradczy: warunek wstępny w §6.3.

### 6.6 Decyzje dla `/10x-plan` i właściciela

1. Los prototypu F-01: wariant A1, A2 czy B (`refactor-opportunities/research.md:438`).
2. Czy robimy etap 2 (fazy 5–7), czy kończymy na etapie 1.
3. Nazwy korzeni składania (`src/lib/backend.ts`, `src/lib/live-sync/browser.ts`) i katalogu ACL.
4. Czy chcemy osobnej zmiany S2 (paczka) i Q1 (logowanie `removeChannel`). Wcześniej warto zmierzyć wpływ około
   55 KB gzip na wejście gościa na telefonie [U].
5. Q8: czy dzwonek ma iść bez sesji hosta (dziś nie wiadomo, czy ją niesie).

---

## Źródła sprawdzone w tej sesji

- **Kod:** `src/components/room/{useRoomState.ts,RoomScreen.tsx,RoomErrorBoundary.tsx}`,
  `src/components/live-sync/LiveSyncDemo.tsx`, `src/lib/{supabase.ts,auth-user.ts,auth-errors.ts,client-events.ts,log.ts}`,
  `src/lib/rooms/{server.ts,json-route.ts,shared.ts}`, `src/lib/live-sync/{server.ts,shared.ts}`,
  `src/env.d.ts`, `src/middleware.ts`, `src/pages/api/auth/*`, `src/pages/api/live-sync/*`,
  `src/pages/api/client-events.ts`, `src/pages/api/rooms/{index,join}.ts`, `src/pages/api/rooms/[id]/{lobby,vote,start}.ts`
  (pozostałe trasy: linie `createClient` / `ringLobby` z grepa), `src/pages/{index,dashboard}.astro`,
  `src/pages/{j/[token],r/[id]}.astro`, `src/pages/dev/live-sync.astro`.
- **Konfiguracja i testy:** `package.json`, `tsconfig.json`, `astro.config.mjs`, `eslint.config.js`, `vitest.config.ts`,
  `scripts/live-sync-probe.mjs`, `tests/db/support/clients.ts`, `tests/unit/auth-user.test.ts`,
  `tests/e2e/support/realtime.ts`, `tests/e2e/lobby-connection-drop.spec.ts`.
- **Dokumenty:** `AGENTS.md`, `CLAUDE.md`, `context/foundation/{tech-stack,infrastructure,prd,test-plan,lessons}.md`,
  `context/map/repo-map.md`, `context/archive/2026-09-27-live-sync-spike/*`, `context/archive/2026-10-13-first-live-round/research.md`,
  `context/changes/refactor-opportunities/{change,plan-brief,research}.md`.
- **Biblioteki (`node_modules`, 2.116.0; phoenix 0.4.5):** `@supabase/supabase-js/src/SupabaseClient.ts`,
  `@supabase/realtime-js/src/{RealtimeChannel,RealtimeClient}.ts`, `@supabase/realtime-js/src/lib/constants.ts`,
  `@supabase/realtime-js/README.md`, `@supabase/phoenix/assets/js/phoenix/channel.js`,
  `@supabase/postgrest-js/src/{PostgrestBuilder,PostgrestClient}.ts`, `@supabase/auth-js/src/lib/errors.ts`,
  `@typescript-eslint/eslint-plugin/dist/rules/no-restricted-imports.js`.
- **Build lokalny (tylko odczyt):** `dist/client/_astro/*.js` (rozmiary i znaczniki podbibliotek).
