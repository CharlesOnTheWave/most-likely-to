---
type: observability-audit
date: 2026-10-11 19:31
mode: audit
commit: c32deb9
branch: main
dirty_tree: false
areas: [guest-join, live-lobby]
area_source: arguments
runtime_proof: blocked
error_tracker: none (Cloudflare Workers Logs only)
previous_report: null
findings: { critical: 1, high: 6, medium: 12, low: 5 }
---

# Audyt obserwowalności — wejście gościa i lobby na żywo (2026-10-11)

Pytanie audytu: gdy wejście gościa albo lobby zepsuje się w trakcie prawdziwego wieczoru, czy właściciel gry się o tym dowie i czy ustali dlaczego? Audyt czyta kod; niczego nie zmienia. Dowód w uruchomionej aplikacji był zablokowany (§8), więc wszystkie ustalenia są statyczne.

## 1. TL;DR

- **Przeglądarka nie ma żadnego kanału do logów.** Zerwane połączenie na żywo, nieudane odświeżenie listy i wywrócony ekran lobby widzi tylko gracz (`src/components/room/RoomLobby.tsx:74`, `:100-102`). Cały pokój może po cichu spaść na odpytywanie co 15 s, a w Workers Logs nie zostaje nic.
- **„Brak” i „zepsute” to ta sama wartość.** Błąd z `getUser()` w middleware znika (`src/middleware.ts:10-13`), więc awaria logowania Supabase wygląda jak wylogowany host. `room_lobby` zwraca `null` z kilku różnych powodów; endpoint robi z tego 404 bez logu, a ekran się przeładowuje (`src/pages/api/rooms/[id]/lobby.ts:27-29`, `RoomLobby.tsx:61-63`).
- **Każdy wynik wejścia gościa to 302, także awaria bazy** (`src/pages/api/rooms/join.ts:17-45`). Odmowy (zajęty nick, zamknięta gra) nie zostawiają żadnego śladu, więc błąd, który odrzuca wszystkich, wygląda jak błąd graczy.
- **Prywatność zrobiona jako „loguj prawie nic” zamiast listy dozwolonych pól.** `{status, code}` bez pokoju, kroku i nazwy błędu; awaria sieci to `{status: 0, code: ""}` (`src/lib/rooms/server.ts:24-29`).
- **Jedyną granicą wyjątków jest catch Astro:** pusty 500 bez treści i wynik wywołania „ok”; błąd po rozpoczęciu strumieniowania HTML to 200 z uciętą stroną i bez logu.
- Dobra wiadomość: żadne istniejące logowanie nie łamie reguły anonimowości ani nie zapisuje nicka, tokenu gracza czy kodu linku.

## 2. Capture model

- **Środowisko (w repo):** jeden Cloudflare Worker (`wrangler.jsonc:4`, `main: @astrojs/cloudflare/entrypoints/server`), Astro 7 `output: "server"` (`astro.config.mjs:12`), strony SSR i trasy API w `src/pages/**`. Wyspy React w przeglądarce (`RoomLobby.tsx`, `JoinForm.tsx`, `NewGameForm.tsx`). Jedyna praca po odpowiedzi: dzwonek `ringLobby` przez `locals.cfContext.waitUntil` (`src/lib/rooms/server.ts:198-211`). Brak crona, kolejek, osobnych workerów.
- **Tracker błędów (w repo):** brak. Żadnego SDK w `package.json`; w `src` zero trafień dla `onerror`, `unhandledrejection`, `ErrorBoundary`, `sendBeacon`.
- **Granica przechwytywania:** tylko platforma. Workers Logs włączone (`wrangler.jsonc:12-14`, bez `head_sampling_rate`). Wyjątki łapie Astro przed Workerem: `node_modules/astro/dist/core/routing/handler.js:101-108` loguje `err.stack` jako tekst `[ERROR]` i oddaje `renderErrorFromState(…, status: 500)`; bez `src/pages/500.astro` odpowiedź to `new Response(null, { status: 500 })` (`core/errors/default-handler.js:105`). Błąd po rozpoczęciu strumienia trafia do `controller.error(e)` bez logu (`runtime/server/render/astro/render.js:62-73`). `@astrojs/react` woła `hydrateRoot` bez callbacków błędów (`@astrojs/react/dist/client.js:77-80`).
- **Co działa poza każdą granicą:** cały kod w przeglądarce (kanał Realtime, pobieranie listy, render wysp) i błędy po rozpoczęciu strumienia HTML.
- **Logowanie (w repo):** surowe `console.error`, 8 wywołań, bez wspólnego loggera. Celowa polityka prywatności w `src/lib/rooms/server.ts:24-30`: tylko `{status, code}`, nigdy treść błędu ani argumenty. Odmowy funkcji bazy nie są logowane (`:56-59`). Trasy logowania hosta logują `{name, status, code}`.
- **Czyszczenie i próbkowanie:** brak w kodzie poza powyższą ręczną polityką.
- **Tożsamość wdrożenia:** brak w kodzie (bez `version_metadata`, bez znacznika wersji w logach).

**Assumptions (poza repo, nie ustalenia):**

- Workers Logs zbierają 100% wywołań (brak próbkowania w repo) — niepotwierdzone.
- Brak alertów, Logpush i tail Workera na błędy albo statusy 5xx — niepotwierdzone; dziś logi czyta się ręcznie w panelu Cloudflare, retencja 3 dni (plan darmowy).
- Wpis wywołania zawiera URL żądania i `scriptVersion`, więc `/j/<kod linku>` już trafia do logów z założenia. Poprawki logują wzorzec trasy, nigdy `request.url` — niepotwierdzone.
- Logi po stronie Supabase (Auth, PostgREST, Realtime) i okno ponownego użycia refresh tokenu to ustawienia panelu — niepotwierdzone.

## 3. What reaches the tracker

Tylko statycznie (dowód w runtime zablokowany, §8). Trackera nie ma, więc kolumna „Tracker” jest wszędzie pusta; liczy się, co zostaje w Workers Logs.

| Failure shape | Response | Platform logs | Tracker | Verdict |
|---|---|---|---|---|
| Wyjątek w endpointcie, middleware albo frontmatterze strony | pusty 500 bez treści | linia `[ERROR]` ze stosem, bez `cause`; wynik wywołania „ok” | — | słabo |
| Wyjątek po starcie strumienia (Layout, komponent, SSR wyspy) | 200, ucięty HTML | nic od Astro; dla wysp surowe `console.error` Reacta | — | niewidoczne (do potwierdzenia w runtime) |
| Funkcja bazy zwraca błąd Postgresa | 500/503 albo 302 z kodem | `<fn> failed: {status, code}` bez pokoju i trasy | — | częściowo |
| Awaria sieci do Supabase | 503 albo 302 `service_unavailable` | `{status: 0, code: ""}` | — | słabo |
| Odmowa funkcji (nick zajęty, gra zamknięta) | 302 z kodem | nic | — | niewidoczne (z założenia, ale bez licznika) |
| Błąd Auth w middleware | 200 lub 302 jak dla wylogowanego | nic | — | niewidoczne |
| Błąd dzwonka | bez wpływu | `live-sync ring failed: Error: <tekst>` bez pokoju i statusu | — | słabo |
| Brak zmiennych Supabase, klucz nie `sb_publishable_` | 503/302; Realtime wyłączony | nic | — | niewidoczne |
| Błąd w przeglądarce (Realtime, pobranie listy, render wyspy) | — | nic | — | niewidoczne |

## 4. Systemic root causes

1. **RC1 — Przeglądarka nie ma kanału do logów.** Wyspa lobby łapie błąd pobrania listy w gołym `catch {` i gubi status (`RoomLobby.tsx:65-66, 74-78`), ignoruje stany `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED` i ich `err` (`:100-102`; realtime-js przekazuje je z `cause`: `node_modules/@supabase/realtime-js/src/RealtimeChannel.ts:453-457, 486-493`), nie ma granicy błędów ani nasłuchu `astro:hydration-error`. Dlaczego tak jest: dla gracza to dobre zachowanie (lista zostaje, cicha notka), a w projekcie nie było jeszcze potrzeby osobnego endpointu. Wyjaśnia: L1, L2, L4.
2. **RC2 — „Nie ma” i „nie dało się sprawdzić” to ta sama wartość, bez logu w miejscu decyzji.** `getUser()` zwraca `{ user: null, error }` dla każdego błędu Auth, także sieci (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:2693-2729`), a middleware czyta tylko `user` (`src/middleware.ts:10-13`). `room_lobby` zwraca `null` dla „nie ma pokoju”, „nie jesteś w pokoju”, „wygasłe ciasteczko” i „brak sesji” (`supabase/migrations/20261007122858_room_lobby.sql:320-341`). Gdy odświeżenie sesji się nie uda, supabase-js po cichu wysyła klucz publishable zamiast tokenu użytkownika (`node_modules/@supabase/supabase-js/src/SupabaseClient.ts:627`), więc host trafia do bazy jako `anon`. Do tego `createClient` zwraca `null` bez logu (`src/lib/supabase.ts:6-8`), a `getPublicSupabaseConfig` wyłącza Realtime bez logu (`:27-31`). Dlaczego: każdy z tych wyborów jest bezpieczny dla gracza i nie zdradza, które pokoje istnieją. Wyjaśnia: P1, L3, P2, P8, L5, P10.
3. **RC3 — Wynik każdej operacji gościa to przekierowanie z kodem w URL.** `join.ts:17-45` odpowiada 302 zarówno na sukces, jak i na odmowę i awarię bazy; powód żyje tylko w nagłówku `Location` i na ekranie telefonu. Odmowy celowo nie są logowane (`src/lib/rooms/server.ts:56-59`), a `create_room` zwija każde naruszenie unikalności do `try_again` (`supabase/migrations/20261007122858_room_lobby.sql:190-193`). Dlaczego: formularze działają bez JS i pokazują czytelny polski komunikat. Wyjaśnia: G1, G2, G3, P9.
4. **RC4 — Prywatność jako „loguj prawie nic” zamiast listy dozwolonych pól.** `logFailure` (`src/lib/rooms/server.ts:26-29`) zapisuje `{status, code}`; postgrest-js zamienia awarię sieci na `{status: 0, code: ""}` (`node_modules/@supabase/postgrest-js/src/PostgrestBuilder.ts:345-356`), więc timeout, zerwane połączenie i DNS wyglądają tak samo. Nie ma id pokoju (nie jest daną osobową), wywołującego ani kroku; `unexpectedShape` nie mówi, które pole się nie zgadza (`:50-54`); `httpSend` gubi status HTTP (`node_modules/@supabase/realtime-js/src/RealtimeChannel.ts:996-1002`), a `ringRoom` loguje bez pokoju (`src/lib/live-sync/server.ts:21`). Dlaczego: słuszna obawa, że treść błędu Postgresa może zawierać nick (np. szczegóły `23505`). Wyjaśnia: P5, P6, L6, P7.
5. **RC5 — Jedyną granicą wyjątków jest catch Astro.** Wyjątek kończy się pustym 500 z wynikiem wywołania „ok” i tekstową linią ze stosem, bez `cause` (`node_modules/astro/dist/core/routing/handler.js:101-108`, `core/errors/default-handler.js:105`); błąd po starcie strumienia nie jest logowany wcale (`runtime/server/render/astro/render.js:62-73`). Aplikacja nie dodaje strony 500 ani własnego `try/catch` w middleware. Wyjaśnia: P3, P4.

## 5. Findings by area

Oznaczenie „zweryfikowane” = twierdzenie sprawdzone ręcznie w cytowanych wierszach i w kodzie bibliotek (§8). Pozostałe pochodzą od audytorów i zostały przeczytane, ale nie odtworzone wiersz po wierszu.

### guest-join

| # | Location | Category | Severity | What happens in production | Fix direction |
|---|---|---|---|---|---|
| G1 | `src/pages/api/rooms/join.ts:17-25, 33, 43-45` (zweryfikowane) | flattened-response | high | Supabase leży albo brakuje uprawnienia (`42501`, `PGRST202` po wdrożeniu kodu przed `db push`) → gość wraca do formularza z „Serwer jest chwilowo niedostępny” albo „Coś poszło nie tak”. POST to 302, tak samo jak udane wejście; widok „ile 5xx” nie zobaczy awarii wejść. Zostaje jedna linia `join_room failed: {status, code}`. | 302 tylko dla odmów gracza; `service_unavailable` i `unexpected` jako prawdziwe 503/500 (strona linku z komunikatem); krok w linii logu. |
| G2 | `src/lib/rooms/server.ts:56-59`, `join.ts:25-26, 43-45`, `src/lib/rooms/errors.ts:16-21` | missing-context | medium | Błąd w regule nicku albo statusu pokoju (S-02 zmienia `join_room`) odrzuca każdego gościa wiarygodnym „nick zajęty” czy „gra zamknięta”; nowy, niezmapowany kod odmowy daje „Coś poszło nie tak”. W logach tylko 302, zero linii. | Jedna linia na próbę wejścia `{op: "join", outcome: <kod>, roomId}` (bez nicka i kodu linku); ostrzeżenie dla kodu spoza `MESSAGES`. |
| G3 | `join.ts:11, 14-16, 40` | swallowed | medium | Celowe `formData().catch(() => null)` spełnia cel z komentarza, ale łapie też regresję formularza (zgubione ukryte pole `link`, przejście na JSON). Gość dostaje „Nie znamy tego linku” na `/j/invalid` i traci link z paska adresu; brak pola `nick` daje „Nick musi mieć od 1 do 20 znaków”. Logi: 302 i 404, bez linii. | W `catch` log `{op: "join", step: "parse_form", errName}`; osobny kod `invalid_form` zamiast `/j/invalid`. |

### live-lobby

| # | Location | Category | Severity | What happens in production | Fix direction |
|---|---|---|---|---|---|
| L1 | `src/components/room/RoomLobby.tsx:100-102` (zweryfikowane) | coverage-gap | critical | Awaria Realtime, limit połączeń albo odrzucone dołączenie do kanału → ekrany całego pokoju po cichu przechodzą na odpytywanie co 15 s; `CLOSED` usuwa kanał na stałe. Gracz nie widzi nic, właściciel nie znajduje nic. Skopiowane do odsłony rundy (S-02) łamie budżet 2 s z PRD dla całego pokoju. | Obsłużyć stany inne niż `SUBSCRIBED`; zgłaszać je kanałem z przeglądarki (§6, krok 5) jako `{event: "realtime_status", state, errName, roomId}`; opcjonalnie widoczny stan „na żywo wyłączone”. |
| L2 | `RoomLobby.tsx:65-66, 74-78` (zweryfikowane) | swallowed | high | Nieudane odświeżenie listy kończy się gołym `catch {`, który gubi status HTTP; sieć, offline, błędy krawędzi Cloudflare i nie-JSON lądują w tym samym miejscu. Gracz widzi cichą notkę; host może patrzeć na nieaktualną listę cały wieczór. Logi: linia tylko wtedy, gdy błąd powstał w Workerze. | Zachować `status` albo `errName` i liczbę porażek z rzędu; zgłaszać pierwszą i co N-tą (bez treści odpowiedzi). |
| L3 | `src/pages/api/rooms/[id]/lobby.ts:27-29`, `src/pages/r/[id].astro:25-27, 40-41`, `RoomLobby.tsx:61-63`, migracja `20261007122858_room_lobby.sql:320-341` (zweryfikowane: fallback na klucz publishable w `SupabaseClient.ts:627`) | missing-throw | high | Dwa scenariusze kończą się „Nie jesteś w tym pokoju. Poproś hosta o link.” i przeładowaniem: (a) hostowi nie uda się odświeżyć sesji (timeout Auth, zużyty refresh token), więc zapytanie idzie jako `anon`; (b) telefon gościa odrzucił ciasteczko po udanym `join_room` (przeglądarka w aplikacji, iOS), więc host widzi gościa, a gość przy ponownym wejściu dostaje `nick_taken` na własny nick. Logi: 404 na `/api/rooms/<id>/lobby` i `/r/<id>`, nie do odróżnienia od obcego, który zgaduje pokoje. | Przy `null` log `{route, roomId, hasUser, hasAuthCookie, hasPlayerCookie}` (same flagi, nigdy wartości); znacznik bez wartości `?joined=1` po wejściu; zgłoszenie z przeglądarki przed przeładowaniem. |
| L4 | `RoomLobby.tsx:68`; brak granicy błędów w `src/` | coverage-gap | medium | `res.json() as LobbyState` bez sprawdzenia kształtu; po wdrożeniu nowego kształtu odpowiedzi stara karta w trakcie wieczoru może wywrócić render (`lobby.players.map`) i React odmontowuje wyspę: puste lobby. Właściciel nie widzi nic. | Sprawdzać odpowiedź wspólnym parserem (`parseLobby`); granica błędów wyspy z widocznym komunikatem i zgłoszeniem `{event: "island_crash", errName, component}`. |
| L5 | `src/pages/r/[id].astro:31-34`, `src/lib/rooms/server.ts:183` | missing-throw | medium | Gdy `hostLinkToken` zwraca `ok: true` z `null` (regresja RLS albo grantu), host widzi „Nie udało się pobrać linku” na stronie 200 i nikt nie dołączy. Logowana jest tylko gałąź z `error`. | Traktować „host, ale brak wiersza” jako awarię: log `{op: "link code", reason: "no_row", roomId}`. |
| L6 | `src/lib/live-sync/server.ts:15-22`, `src/lib/rooms/server.ts:199-205` | identity-lost | medium | Błąd dzwonka zostawia `live-sync ring failed: Error: <tekst serwera>` bez pokoju, wywołującego i statusu; limit 429 (ryzyko #7), zły klucz 401 i timeout różnią się tylko tekstem. Ten sam prefiks ma prototyp `/api/live-sync/ring`. `{ok: false}` z `ringRoom` jest wyrzucane, a drugi handler w `ringLobby` odpala tylko przy awarii `removeChannel`. | Jeden obiekt `{op: "lobby_bell", caller, roomId, status \| errName}`; własne sprawdzenie statusu odpowiedzi zamiast gołego `Error`. |

### Platform / plumbing

| # | Location | Category | Severity | What happens in production | Fix direction |
|---|---|---|---|---|---|
| P1 | `src/middleware.ts:10-13` (zweryfikowane: `GoTrueClient.js:2693-2729`) | swallowed | high | Awaria Auth, timeout albo odrzucony refresh token → host na tym żądaniu jest anonimowy: `/` pokazuje stronę startową zamiast pokoju, „Załóż grę” odsyła do logowania (`src/pages/api/rooms/index.ts:16-18`), na `/j/<kod>` host widzi formularz gościa; w lobby zasila L3. Logi: nic. | Czytać `error`; pomijać `AuthSessionMissingError` (normalny przypadek gościa); inne logować `{op: "getUser", name, status, code, route}`. Opcjonalnie flaga „Auth niedostępny”, żeby odpowiedzieć 503 zamiast odsyłać do logowania. |
| P2 | `src/lib/supabase.ts:27-31`, `src/pages/r/[id].astro:39`, `src/pages/api/live-sync/config.ts:9` | config | high | Klucz inny niż `sb_publishable_` (np. stary klucz anon JWT, który działa na serwerze) po cichu wyłącza Realtime we wszystkich pokojach: wszystko 15 s do tyłu. Logi: nic. | Log raz na izolat `{op: "realtime-config", reason: "key_not_publishable"}`, nigdy klucz. |
| P4 | `node_modules/astro/dist/runtime/server/render/astro/render.js:62-73` (zweryfikowane), `@astrojs/react/dist/server.js:89-96` | coverage-gap | high | Wyjątek w Layout, komponencie albo SSR wyspy po rozpoczęciu strumienia → 200 i ucięta strona; od Astro nic w logach, dla wysp surowe `console.error` Reacta. Realne ryzyko, gdy `RoomLobby` zacznie renderować stany rundy (S-02). Wymaga potwierdzenia w runtime. | Ryzykowną logikę trzymać we frontmatterze strony (łapany przed strumieniem), sprawdzać propsy przed renderem; potwierdzić sondą z rzucającą wyspą. |
| P3 | `node_modules/astro/dist/core/routing/handler.js:101-108`, `core/errors/default-handler.js:105` (zweryfikowane); brak `src/pages/500.astro` | logged-not-captured | medium | Wyjątek → gracz dostaje pustą białą stronę 500; właściciel ma linię `[ERROR]` ze stosem (bez `cause`), a wynik wywołania to „ok”, więc licznik wyjątków platformy jej nie widzi. | `src/pages/500.astro` z polskim komunikatem; `try/catch` wokół `next()` w middleware logujący `{route, name}` i łańcuch `cause` bez wartości. |
| P5 | `src/lib/rooms/server.ts:26-29, 40-41, 45-47` | identity-lost | medium | Awaria sieci, timeout i DNS dają tę samą linię `{status: 0, code: ""}`; `room_lobby failed` ma 4 wywołujących, a żadna linia nie niesie id pokoju ani kroku. | Lista dozwolonych pól: `{op, route: <wzorzec>, step, roomId, status, code, errName}`; dla statusu 0 nazwa błędu transportu. |
| P6 | `src/lib/rooms/server.ts:50-54, 126-140, 151-153` | identity-lost | medium | S-02 doda stany pokoju (`src/lib/rooms/shared.ts`); kod wdraża się sam, migracja ręcznie, więc rozjazd jest prawdopodobny. Wtedy każde wejście i każde odpytanie daje 500 „Coś poszło nie tak”, a log mówi tylko „room_lobby returned an unexpected shape”. | Logować, które pole nie przeszło i jego typ; wartość tylko dla pól wyliczeniowych (`status`, `role`), nigdy `me` ani `players`. |
| P7 | `RoomLobby.tsx:58`, `src/lib/supabase.ts:9-22` | missing-throw | medium | Brak limitu czasu na pobranie listy w przeglądarce i na zapytania do bazy w Workerze: wiszące żądanie nie trafia ani do sukcesu, ani do `catch`, notka się nie pokazuje, odpytywania się piętrzą. Wejście gościa przerwane w locie może zostawić gracza-ducha (baza zapisała, ciasteczko nie dotarło); w logach wynik „canceled” bez linii. | `AbortSignal.timeout(~5 s)` w wyspie i limit czasu dla klienta bazy; linia `{op: "join", step: "join_room", phase: "start", roomId}` przed RPC. |
| P8 | `src/lib/supabase.ts:6-8`, `astro.config.mjs:19-20` (`optional: true`) | config | medium | Wdrożenie bez `SUPABASE_URL`/`SUPABASE_KEY` → każdy link 503, każde wejście `service_unavailable`, goście widzą baner startera o nieskonfigurowanym Supabase. Logi: 503 i 302 bez linii, jak przy awarii Supabase z zielonym panelem. | Log raz na izolat `{op: "createClient", reason: "missing_env", missing: [nazwy]}`, nigdy wartości. |
| P9 | migracja `20261007122858_room_lobby.sql:190-193`, `src/pages/api/rooms/index.ts:45-47` | flattened-response | medium | `create_room` zamienia każde naruszenie unikalności na `try_again`; jeśli błąd jest powtarzalny, host w kółko widzi „Spróbuj jeszcze raz”, a w logach jest tylko 302. | W nowej migracji rozróżnić ograniczenie (`get stacked diagnostics`, jak w `join_room`); w Workerze log `{fn, reason}`. |
| P10 | `src/pages/api/auth/signout.ts:8` (zweryfikowane: wynik ignorowany) | swallowed | medium | Wynik `signOut` jest ignorowany; jeśli się nie uda, przekierowanie wygląda jak wylogowanie, a sesja na wspólnym telewizorze może przetrwać. Logi: nic. Skutek dla ciasteczek nie sprawdzony w runtime. | Sprawdzać `error`, logować `{name, status, code}`; przy błędzie jawnie wyczyścić ciasteczka `sb-` albo pokazać komunikat. |
| P11 | `src/pages/auth/signin.astro:9-10` | coverage-gap | low | Błędy stanu OAuth, które Supabase odsyła prosto na stronę logowania (`bad_oauth_state`, `flow_state_expired`), nie trafiają do logów. | Logować sprawdzony wzorcem `error_code` (jak `src/pages/api/auth/callback.ts:11`). |
| P12 | `src/pages/api/auth/signin.ts:26`, `src/pages/api/auth/callback.ts:28` | noise | low | Złe hasło i anulowana zgoda logowane jako `console.error`, więc liczba błędów nie jest sygnałem awarii. | Kody wywołane przez użytkownika (`invalid_credentials`, `access_denied`) jako `console.warn`. |
| P13 | `wrangler.jsonc` (brak `version_metadata`) | missing-context | low | Linii logu nie da się z kodu powiązać z commitem. | Wiązanie `version_metadata` i jego id w liniach błędów. |
| P14 | `node_modules/astro/dist/core/app/origin-check.js:8-27` | coverage-gap | low | Wbudowany `checkOrigin` Astro odpowiada 403 po angielsku bez logu, gdy nagłówek `Origin` się nie zgadza; ryzyko rośnie przy `Referrer-Policy: no-referrer`. | Jeśli pojawią się 403 na wejściach: własne sprawdzenie w middleware z logiem `{op: "origin_check", originPresent}`. |
| P15 | `RoomLobby.tsx:108` | swallowed | low | `void supabase.removeChannel(channel)` przy sprzątaniu bez obsługi odrzucenia. | `.catch` z logiem w konsoli albo zgłoszeniem. |

Bez ustaleń: kopiowanie linku (`RoomLobby.tsx:127-132`) ma uzasadnione obejście, które nie zaciera awarii; podgląd linku przez Discorda niczego nie tworzy i niczego nie loguje; oczekiwane odmowy nie są logowane jako błędy (poza P12).

## 6. Recommended fix order

Według usuniętej ślepoty na jednostkę wysiłku. Każda poprawka przechodzi łańcuch zmian (najpierw nieprzechodzący test), a zmiany w `src/lib/rooms/`, `src/pages/api/rooms/`, `src/pages/j/`, `src/pages/r/` i `tests/` idą tylko przez PR na zielonym CI (AGENTS.md).

1. **Middleware czyta błąd `getUser()`** — zamyka P1, częściowo L3. Kilka linii; wspólne dla każdego żądania hosta. Ograniczenie: pomijać `AuthSessionMissingError`, inaczej każdy gość robi szum.
2. **Wspólny helper logowania z listą dozwolonych pól** (`op`, wzorzec trasy, krok, `roomId`, `status`, `code`, `errName`) w `src/lib/rooms/server.ts` i `src/lib/live-sync/server.ts` — zamyka P5, P6, L6, podstawę G2. Ograniczenie: nigdy argumenty RPC, nick, token gracza, kod linku ani `request.url`; od S-02 nigdy nic, co łączy głosującego z celem głosu. Test jednostkowy może pilnować obu stron: pola diagnostyczne są, wartości nie ma.
3. **Log w miejscach „null”** — `room_lobby` = `null` (flagi), `createClient` = `null`, klucz nie publishable, brak wiersza linku — zamyka L3, P2, P8, L5.
4. **Wejście gościa: prawdziwe 5xx dla awarii i jedna linia wyniku na próbę** — zamyka G1, G2, G3. Ograniczenie: kroki smoke i E2E oczekujące 302 trzeba przejrzeć w tej samej zmianie.
5. **Kanał z przeglądarki** (`POST` z polami wyłącznie wyliczeniowymi, limit na stronę) zasilany z `catch` listy, stanów kanału, granicy błędów i `astro:hydration-error` — zamyka L1, L2, L4. Największa zmiana: nowy publiczny endpoint to nowa droga dla ryzyka #1 (logi) i #7 (limit żądań), więc wymaga osobnej decyzji projektowej; naturalne miejsce to S-02, bo ekran odsłony go potrzebuje.
6. **Strona 500 i `try/catch` w middleware z łańcuchem `cause`** — zamyka P3. P4 najpierw potwierdzić sondą.
7. **Limity czasu** — P7. Potem reszta (P9–P15).

## 8. Method and limits

- **Agenci:** trzech audytorów tylko do odczytu, równolegle: `guest-join`, `live-lobby` i infrastruktura wspólna (Astro, adapter Cloudflare, middleware, logowanie hosta, przeglądarka, przegląd całego repo). Model przechwytywania (§2) zbudowany ręcznie przed ich uruchomieniem.
- **Sprawdzone ręcznie** (Krok 5): `RoomLobby.tsx:55-108` (goły `catch`, tylko `SUBSCRIBED`, 404 → przeładowanie); `join.ts` (302 dla każdego wyniku, także `service_unavailable`); `lobby.ts:27-29`; `SupabaseClient.ts:627` (fallback na klucz publishable bez sesji); `RealtimeChannel.ts:453-493, 990-1002` (stany kanału z `err`; `httpSend` rzuca `Error` bez statusu); `GoTrueClient.js:2693-2729` (`getUser` zwraca błąd Auth zamiast rzucać); Astro `handler.js:101-108`, `default-handler.js:105`, `render.js:62-73`; `signout.ts:8`. Wszystkie twierdzenia się potwierdziły. Po scaleniu duplikatów (np. Realtime, dzwonek, „unexpected shape” zgłoszone przez dwóch lub trzech audytorów) zostały 24 ustalenia z ok. 40 zgłoszonych.
- **Dowód w runtime: zablokowany.** Lokalnie `.dev.vars` wskazuje na produkcyjny projekt Supabase (jedyny projekt), a lokalnego Supabase nie ma (brak Dockera). Skill zabrania sond na produkcyjnej bazie, więc aplikacji nie uruchomiono. Możliwa droga na później: zestaw sond w jobie CI z lokalnym Supabase, tak jak job `e2e`. Ustalenia zależne od zachowania w runtime oznaczone (P4, P10).
- **Przegląd całego repo** (`src` + `scripts`, bez testów i zależności): 0 pustych `catch`; 4 `catch {` bez wiązania w `src` (`RoomLobby.tsx:74, 127`, `LiveSyncDemo.tsx:54, 93`); 5 `.catch(() => null)` przy parsowaniu formularza lub JSON (`oauth.ts:18`, `signin.ts:8`, `live-sync/ring.ts:12`, `rooms/index.ts:21`, `rooms/join.ts:11`); 8 `void promise` (2 bez obsługi odrzucenia); 8 surowych `console.error`; 2 `throw new Error(` bez `cause` (oba łapane własnym gołym `catch`); 2 ignorowane wyniki `{ error }` (`middleware.ts:10-12`, `signout.ts:8`).
- **Nie do sprawdzenia z repo:** jak Workers Logs renderują linie i wywołania, ich próbkowanie i retencja, logi po stronie Supabase.
- **Harness sond:** brak (runtime nie był uruchamiany); nie ma worktree ani plików do sprzątania.
