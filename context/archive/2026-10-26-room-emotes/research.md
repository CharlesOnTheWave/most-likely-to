---
date: 2026-10-26T13:40:33+01:00
researcher: Claude (Opus 5.5)
git_commit: 437162df085c58163143b47c526131f3604700e6
branch: room-emotes
repository: most-likely-to
topic: "S-16: jak puścić emotkę od gracza do całego pokoju przez dzisiejszy kanał na żywo i gdzie ją pokazać, nie łamiąc zasad kanału, anonimowości i limitów Realtime"
tags: [research, s-16, emotka, realtime, broadcast, kanał, room-screen, limity]
status: complete
last_updated: 2026-10-26
last_updated_by: Claude (Opus 5.5)
---

# Research: S-16 emotki do pokoju

**Date**: 2026-10-26T13:40:33+01:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 437162df085c58163143b47c526131f3604700e6
**Branch**: room-emotes
**Repository**: most-likely-to

## Research Question

Roadmapa S-16 (`context/foundation/roadmap.md:308-319`), PRD FR-023 (`context/foundation/prd.md:135`) i §Non-Goals
(`prd.md:187`): każdy gracz (host i goście) jednym dotknięciem wysyła emotkę z krótkiej, stałej listy, a cały pokój widzi
ją na chwilę; bez gifów, tekstu i historii, nieobowiązkowo. Pytanie: którędy emotka może dojść do pokoju w dzisiejszym
kodzie (kanał na żywo, Worker, baza), co z podszywaniem, zalaniem pokoju i limitami Realtime, gdzie ją wpiąć na ekranie
oraz jak ją testować i pokazać do oceny.

Zakres: stan obecny i ograniczenia. Decyzje produktowe (nick przy emotce, lista emotek, ekrany) zostają dla Karola.

## Summary

- **Kanał na żywo niesie dziś jedno zdarzenie.** Temat `live-sync:<roomId>`, zdarzenie `bell`, payload `{ seq }`
  (`src/lib/live-sync/shared.ts:3-4,20-22`). Nadaje wyłącznie Worker przez REST `httpSend` (`src/lib/live-sync/server.ts:12-32`),
  a ekran pokoju na `bell` tylko pobiera stan z serwera i payloadu nie czyta (`src/components/room/useRoomState.ts:283-289`).
  Kanał jest publiczny: nikt w kodzie nie ustawia `private: true`, a `supabase/config.toml:85-86` ma tylko
  `[realtime] enabled = true`, więc każdy, kto zna UUID pokoju i klucz publiczny, może nadać dowolne zdarzenie.
- **Emotka potrzebuje nowego zdarzenia, nie dzwonka.** Każdy `bell` uruchamia pobranie stanu przez ogranicznik
  (`src/lib/live-sync/limiter.ts`), więc emotka na `bell` mnożyłaby zapytania. `ringRoom` jest na sztywno związany z `bell`
  i `{ seq }` (`live-sync/server.ts:16`), więc nadawanie emotki wymaga osobnej funkcji serwera z własną nazwą zdarzenia.
- **Droga zgodna z zasadami repo: przycisk → endpoint Workera → sprawdzenie gracza → `httpSend` zdarzenia emotki.**
  Wzór to `src/pages/api/rooms/[id]/react.ts:24-49` (S-11): `refuseForeignPost`, UUID, JSON do 4 KB, ciasteczko gościa albo
  sesja hosta, RPC `security definer`. Nadawanie z przeglądarki (`channel.send`) jest tańsze, ale AGENTS.md:12 daje klucz
  przeglądarce „only for Realtime subscriptions”, a archiwum S-02 zapisuje „nadaje tylko Worker”
  (`context/archive/2026-10-13-first-live-round/research.md:113`).
- **Podszycia nie da się zablokować na publicznym kanale.** Endpoint sprawdza tylko naszą drogę; kto zna UUID, może nadać
  emotkę wprost do Realtime. Skutek zależy od payloadu: anonimowa emotka z listy to najwyżej szum, a nick w payloadzie da się
  podrobić („Kasia wysłała 🍆”). Dodatkowo plan F-01 przyjął, że temat, zdarzenie i payload „nie niosą danych o graczach”
  (`context/archive/2026-09-27-live-sync-spike/plan.md:97`); nick w emotce byłby pierwszym wyjątkiem.
- **Limity Realtime to realne ryzyko przy entuzjastycznym klikaniu.** Darmowy plan: 100 wiadomości/s jako średnia z okna do
  60 s, broadcast liczy się jako 1 + N (`context/archive/2026-09-27-live-sync-spike/external-research.md:46,56,181`;
  `context/archive/2026-10-07-room-lobby/research.md:171-174`). W pokoju 20 graczy jedna emotka to 21 wiadomości, więc średnio
  ok. 4,7 emotki/s (ok. 285 na minutę) na cały projekt wyczerpuje limit; przekroczenie rozłącza połączenia całego projektu
  (`tenant_events`, `external-research.md:46`). Potrzebny jest limit na gracza (odstęp między emotkami) i rysowanie
  ograniczonej liczby naraz.
- **Na ekranie:** wspólny kontener wszystkich ekranów pokoju to wrapper w `RoomContent`
  (`src/components/room/RoomScreen.tsx:245-268`); pasek emotek i nakładka pasują tam, poza `contentRef` (fokus po ruchu hosta
  trafia w pierwszy nagłówek w `contentRef`, `RoomScreen.tsx:129`). Nakładka musi być `fixed` i `pointer-events-none`, bo
  przyklejony pasek hosta od `lg` psuje się, gdy przodek przycina overflow (`src/components/room/HostActions.tsx:76-83`).

## Detailed Findings

### Kanał na żywo dziś

- Temat i zdarzenie: `LIVE_SYNC_TOPIC_PREFIX = "live-sync:"`, `BELL_EVENT = "bell"` (`src/lib/live-sync/shared.ts:3-4`),
  `topicFor(room)` (`shared.ts:20-22`).
- Nadawca: `ringRoom` → `channel.httpSend(BELL_EVENT, { seq }, { timeout: 5000 })`, potem `removeChannel`
  (`src/lib/live-sync/server.ts:12-32`). Wywołuje go `ringLobby` w `waitUntil` (`src/lib/rooms/server.ts:542-555`) po
  udanych akcjach, np. `src/pages/api/rooms/[id]/vote.ts:47-48`. Kciuk S-11 celowo nie dzwoni
  (`src/pages/api/rooms/[id]/react.ts:21-22`). Błąd wysyłki loguje `op: "ring"`, `roomId`, `errName`, `code`
  (`live-sync/server.ts:22-27`).
- Odbiorcy: `useRoomState` subskrybuje tylko `bell` i woła `limiter.bell()` (`useRoomState.ts:283-289`); tak samo
  `JoinWaiting` dla czekającego spóźnionego (`src/components/room/JoinWaiting.tsx:161-166`). W tych dwóch subskrypcjach
  i w demie F-01 (`src/components/live-sync/LiveSyncDemo.tsx:60-61`, też `bell`) nie ma nasłuchu innego zdarzenia.
- Klucz: serwer używa `SUPABASE_KEY` (publiczny), przeglądarka dostaje URL i klucz tylko przez `getPublicSupabaseConfig`,
  który zwraca `null` dla klucza innego niż `sb_publishable_` (`src/lib/supabase.ts:27-32`).
- Kanał publiczny: realtime-js 2.116.0 ma domyślnie `private: false`, `broadcast { ack: false, self: false }`
  (`node_modules/@supabase/realtime-js/src/RealtimeChannel.ts:377-379`); w repo brak polityk na `realtime.messages`
  (sprawdzone: migracje i `supabase/config.toml`).
- UUID pokoju zna też spóźniony czekający na wpuszczenie (dostaje `roomId` i konfigurację Realtime,
  `src/pages/j/[token].astro:79,118`); wniosek z propsów, nie z testu.

### Identyfikacja gracza w Workerze (wzór dla endpointu emotki)

- Host: sesja Supabase w `locals.user` (`src/middleware.ts:11`). Gość: ciasteczko httpOnly `mlt_player_<roomId>` z tokenem
  43 znaków, baza trzyma tylko sha256 (`src/lib/rooms/tokens.ts:11,31-45`).
- Ścieżka `react.ts:24-49`: `refuseForeignPost` (typ JSON + Origin, `src/lib/rooms/json-route.ts:39-50`) → `UUID_PATTERN` →
  `readJsonBody` do 4 KB (`json-route.ts:14`) i parsowanie z białej listy → brak sesji i tokenu = `OUTSIDE_ROOM` (404) →
  RPC `react_round` (`security definer`, rozpoznaje gracza z sesji albo hasha tokenu; obcy dostaje `room_unknown`,
  `supabase/migrations/20261026074427_question_play_data.sql:525-559`) → `actionAnswer` (`json-route.ts:177-185`).
- Akcja w przeglądarce: `sendRoomAction` (`src/components/room/room-actions.ts:49-74`) z unią `RoomAction`
  (`room-actions.ts:17-31`); nowa akcja = wpis w unii + trasa.
- Emotka nie musi niczego zapisywać; do sprawdzenia członkostwa wystarczy RPC tylko do odczytu. `room_lobby` jest ciężkie;
  lekka funkcja „czy jestem w tym otwartym pokoju” byłaby nowa (wniosek, nie sprawdzony koszt).

### Drogi emotki (ocena)

| Droga                                                                              | Podszycie (jako inny gracz / spoza pokoju)                    | Zalanie                                                                                                              | Zapis w bazie                                             | Zgodność z zasadami repo                                                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| (a) przeglądarka `channel.send` na istniejący temat                                | tak / tak                                                     | brak hamulca po stronie serwera                                                                                      | brak                                                      | sporne: AGENTS.md:12 („only for Realtime subscriptions”), archiwum „nadaje tylko Worker”    |
| (b) POST `/api/rooms/[id]/<akcja>` → RPC członkostwa → `httpSend` zdarzenia emotki | nasza droga sprawdzona; wprost do Realtime nadal da się nadać | Worker może hamować swoich, ale nie ma wspólnego limitera (`wrangler.jsonc` bez wiązania rate-limit); fałszerz omija | odczyt; zapis tylko, jeśli limit na gracza ma być w bazie | zgodna z wzorcem S-11 i `ringRoom`                                                          |
| (c1) Presence                                                                      | jak (a)                                                       | 20 wiadomości Presence/s na darmowym planie (`room-lobby/research.md:165`)                                           | brak                                                      | to stan „kto online”, nie chwilowe zdarzenie; nieużywane w `src`                            |
| (c2) `realtime.send` z funkcji w bazie                                             | sprawdzone w bazie, temat i tak publiczny                     | jak (b)                                                                                                              | wiersz w `realtime.messages`                              | ślad w bazie wbrew „bez historii”; ryzyko błędu partycji (`room-lobby/research.md:167-170`) |

Żadna droga nie wymaga klucza sekretnego. Otwarte (Q8 z `context/domain/03-anti-corruption-layer.md:572`): czy `httpSend`
dołącza JWT hosta; dla emotki bez znaczenia, bo kanał jest publiczny.

### Limity i koszt jednej emotki

- Realtime (darmowy plan): 100 wiadomości/s jako średnia z okna do 60 s, broadcast = 1 + N wiadomości, 200 połączeń,
  100 dołączeń/s, 2 mln wiadomości miesięcznie; przekroczenie średniej rozłącza połączenia projektu do czasu spadku
  (`external-research.md:46,56`; `room-lobby/research.md:171-174`). Limitu rozmiaru payloadu repo nie zapisuje.
- Rachunek: pokój 20 graczy → 21 wiadomości na emotkę → 100 × 60 / 21 ≈ 285 emotek na minutę na cały projekt. Przy
  odstępie 5 s na gracza 20 graczy daje najwyżej 4 emotki/s = 84 wiadomości/s, plus dzwonki rund. Odstęp krótszy niż ok. 4,2 s
  przy 20 stale klikających graczach przekracza średnią (wniosek z tych liczb, nie pomiar).
- Droga (b) kosztuje na emotkę 1 żądanie Workera (darmowo 100 tys./dzień), 1 wywołanie bazy i 1 + N wiadomości Realtime.

### Logi

- `logEvent` przepuszcza tylko pola `op, route, step, roomId, status, code, errName, field, event, state, outcome, hasUser,
hasPlayerCookie`, wartości tekst/liczba/bool do 200 znaków (`src/lib/log.ts:13-27,38-50`).
- `actionAnswer` loguje jedną linię `{op, outcome, roomId}` na próbę akcji (`json-route.ts:177-185`), bez nadawcy. Emotka
  przez (b) dawałaby jedną taką linię na dotknięcie; tożsamości gracza nic w sprawdzonym kodzie nie loguje.

### Ekran pokoju

- Ekrany: `RoomContent` wybiera `EveningEnd` (z `GameSummary`), `RoomLobby`, `RoundSkipped`, `RoundVoting`, `RoundReveal`
  (`RoomScreen.tsx:175-241`; `EveningEnd` `:65-91`).
- Wspólny wrapper `flex flex-col gap-6` + `roomColumn(view)` (`RoomScreen.tsx:245-268`) zawiera: komunikat sr-only (`:247`),
  `LiveBanner` (`:250`), `JoinRequests` hosta (`:251`), alert pominięcia (`:255`), `contentRef` z `display: contents` (`:264`).
  `useRoomState` jest zamontowany raz (`:105`) i trzyma kanał (`useRoomState.ts:281-320`), więc tam dopisuje się nasłuch
  nowego zdarzenia.
- Ograniczenia: fokus po ruchu hosta idzie w pierwszy `h1, h2` w `contentRef` (`RoomScreen.tsx:129`); akcja emotki nie może
  trafić do `VIEW_CHANGING` (`:98`); `act()` zwraca `{ok: true}` w podglądach (`:142-153`).
- Pasek hosta: `BAR = "lg:bg-background lg:sticky lg:bottom-0 lg:z-10 …"` (`HostActions.tsx:83`), na głosowaniu po
  oddaniu głosu przez hosta i na odsłonie (`RoundVoting.tsx:355-357`, `RoundReveal.tsx:204`); poniżej `lg` paska nie ma. Pasek
  emotek na dole okna zderzy się z nim od `lg`.
- Szerokości: `ROOM_FRAME = "max-w-lg lg:max-w-6xl"` i `roomColumn` (`src/components/room/room-frame.ts:9-38`).
- Wzór przycisku jednym dotknięciem: `QuestionReaction.tsx` (S-11): `role="group"` z widoczną etykietą, `Button size="icon"`
  z `aria-label`, `aria-pressed`, `aria-disabled` zamiast `disabled`, `Spinner` przy wysyłce, `FieldError` przy odmowie
  (`src/components/room/QuestionReaction.tsx:15-22,56-108`).
- Klocki: `src/components/ui` ma `alert, badge, button, card, checkbox, field, input, input-group, label, separator, spinner,
textarea`; brak toast/popover/tooltip (do dodania przez `npx shadcn@latest add`). `tw-animate-css` jest zaimportowany
  (`src/styles/global.css:2`); w `src` nie ma `@keyframes`, `motion-reduce`/`motion-safe` ani `prefers-reduced-motion` (grep),
  więc obsługa ograniczonego ruchu byłaby nowa. Emoji w produkcyjnym UI dziś brak (są tylko w przykładowych nickach stron dev).
- `scripts/ui-literals.mjs` skanuje cały katalog `src/components/room/` (nierekurencyjnie, `:7,17`) oraz strony dev i pokoju
  (`:8-18`), więc nowe pliki pokoju są objęte automatycznie; nie skanuje `src/components/ui` ani `global.css`.

### Podglądy i zrzuty do oceny

- `/dev/room-states`: sekcje z numerowanym `<h2>` i `<RoomScreen … preview={…} client:load/>`; najwyższy numer to 90 (stany S-11
  86–90, `src/pages/dev/room-states.astro:1206-1265`); nowa flaga podglądu idzie do `ScreenPreview` (`RoomScreen.tsx:29-39`);
  akapit wstępu (`room-states.astro:356-367`) wymaga dopisania.
- `/dev/room-window`: jedna próbka na `?state=<klucz>` z `SAMPLES` (`src/pages/dev/room-window.astro:171-319`); `Sample`
  (`:160-169`) i obiekt podglądu (`:336-341`) przenoszą dziś tylko `myVote`, `host`, `questionList`, więc nowe pole trzeba
  przeprowadzić. Parametrów `thumbs=`/`thumb=` w repo nie ma (grep); S-11 dodał tylko stany 86–90 (commit `55e96f8`).
- Zrzuty: headless Chrome przez CDP, laptop jako całe okno 1536×750, telefon 390×844 ×2 przez iframe
  (`context/changes/question-reactions-play-data/plan.md:283-288`,
  `context/archive/2026-10-04-ui-signin-contract/ui-checks.md:23`).

### Testy

- E2E: `tests/e2e/support/room.ts` (`openRoom`, `newGuestContext` `:59-61`, `joinRoom` `:66-77`, `nextListFetch`,
  `playerRow`), `tests/e2e/support/round.ts` (`ROUND_UPDATE_MS = 10_000`, `questionThumb` `:79-82`); `game.spec.ts` gra trzema
  kontekstami, krok kciuka `:91-97`, pasek hosta przy 1280×400 `:99-113`, dzwonek kontra odpytywanie `:115-134`; projekt
  telefonu gra tylko `game` i `question-list` (`playwright.config.ts:40-44`).
- Unit: Vitest w środowisku `node` bez testing-library (`vitest.config.ts:20`); testy dotyczą czystych modułów
  `src/lib/rooms/*`, więc logika emotki (biała lista, odstęp) do testów jednostkowych powinna być czystym modułem.
- `context/foundation/test-plan.md` §6: wyrocznia z PRD/decyzji właściciela, nie z kodu; role i nazwy dostępne; `test.slow()`
  dla 3 przeglądarek; dla nowego strażnika oczekiwany commit próby złamania; znana dziura jako `test.fails` „znana dziura …”.

## Code References

- `src/lib/live-sync/shared.ts:3-4,20-22` – temat i zdarzenie kanału
- `src/lib/live-sync/server.ts:12-32` – `ringRoom`, jedyny nadawca (REST `httpSend`)
- `src/components/room/useRoomState.ts:281-320` – subskrypcja kanału w ekranie pokoju
- `src/components/room/JoinWaiting.tsx:161-166` – subskrypcja czekającego spóźnionego
- `src/pages/api/rooms/[id]/react.ts:24-49` – wzór endpointu akcji gracza bez dzwonka
- `src/lib/rooms/json-route.ts:14,39-50,177-185` – limit body, ochrona POST, odpowiedź i log akcji
- `src/lib/rooms/tokens.ts:11,31-45` – ciasteczko gościa
- `src/components/room/room-actions.ts:17-31,49-74` – unia akcji i `sendRoomAction`
- `src/components/room/RoomScreen.tsx:29-39,98,105,129,142-153,175-268` – podgląd, akcje, fokus, ekrany, wspólny wrapper
- `src/components/room/HostActions.tsx:76-83` – przyklejony pasek hosta
- `src/components/room/QuestionReaction.tsx` – wzór przycisku jednym dotknięciem
- `src/lib/log.ts:13-50` – dozwolone pola logu
- `src/pages/dev/room-states.astro:356-367,1206-1265`, `src/pages/dev/room-window.astro:160-169,171-319,336-341` – podglądy

## Architecture Insights

- „Dzwonek jest niezaufaną podpowiedzią”: stan pokoju pochodzi wyłącznie z bazy, a kanał może być podrobiony
  (`live-sync/server.ts:34-36`; `context/archive/2026-09-27-live-sync-spike/measurements.md:104-106`). Emotka jest pierwszą
  treścią, która na kanale ma znaczenie sama w sobie, więc odbiorca musi ją walidować (stała lista identyfikatorów,
  nieznane ignorować) i nie może z niej wywodzić niczego o stanie gry.
- Akcje gracza idą przez Worker i RPC `security definer`, a anonimowość opiera się na tym, że nic nie łączy gracza z treścią
  dłużej niż runda (AGENTS.md, Hard Rules). Anonimowa emotka bez nicku i bez zapisu w bazie mieści się w tych zasadach bez
  wyjątków; emotka z nickiem wymaga świadomego wyjątku od reguły F-01 o payloadzie.

## Historical Context (from prior changes)

- `context/archive/2026-09-27-live-sync-spike/plan.md:97` – temat, zdarzenie i payload nie niosą danych o graczach (obowiązuje).
- `context/archive/2026-09-27-live-sync-spike/measurements.md:104-106` – stan tylko z bazy, bo dzwonek może nadać każdy (obowiązuje).
- `context/archive/2026-09-27-live-sync-spike/external-research.md:30,56,65-77,181` – limit jako średnia z 60 s; kanały
  prywatne (RLS na `realtime.messages`) odrzucone jako opcja A (obowiązuje; dla gości bez kont nadal brak modelu uwierzytelnienia).
- `context/foundation/infrastructure.md:156,198` – mitygacja ryzyka: „Kanał niesie tylko dzwonek `{ seq }`”; emotka ją
  rozszerza, więc rejestr ryzyka trzeba będzie dopisać.
- `context/archive/2026-10-13-first-live-round/research.md:93,113,231` – kanał bez danych o głosach, nadaje tylko Worker,
  podrobiony dzwonek kosztuje tylko dodatkowe pobranie (obowiązuje).
- `context/archive/2026-10-13-first-live-round/plan.md:77` – kanały prywatne poza zakresem S-02.
- `context/changes/question-reactions-play-data/` – S-11: kciuk bez dzwonka, wzór endpointu i przycisku; słowo „reakcja” w
  słowniku oznacza kciuk (`context/domain/glossary.md:69`), więc S-16 potrzebuje hasła „emotka”.

## Related Research

- `context/archive/2026-09-27-live-sync-spike/external-research.md`
- `context/archive/2026-10-07-room-lobby/research.md`
- `context/archive/2026-10-13-first-live-round/research.md`
- `context/changes/question-reactions-play-data/research.md`

## Open Questions

Dla Karola (produkt, decyzje do planu):

1. **Nick przy emotce czy anonimowo?** Anonimowo: zgodne z regułą F-01 o payloadzie, podróbka to tylko szum, emotka w trakcie
   głosowania nic nie zdradza. Z nickiem: więcej zabawy („kto się śmieje”), ale nick da się podrobić z zewnątrz i to pierwszy
   wyjątek od reguły kanału.
2. **Jakie emotki i ile** (np. 5–6 stałych) oraz **na których ekranach** (cała gra, czy tylko głosowanie i odsłona; poczekalnia
   i koniec wieczoru?). Wygląd na zrzutach.
3. **Czy gracz widzi odstęp między emotkami** (przycisk chwilowo wyszarzony) czy nadmiar po cichu przepada.

Techniczne, do rozstrzygnięcia w planie:

4. Gdzie egzekwować odstęp na gracza: tylko w przeglądarce (proste, fałszerz omija) czy też na serwerze (wymaga stanu: ostatni
   czas emotki gracza w bazie albo innym magazynie). Rachunek limitu przemawia za odstępem rzędu kilku sekund.
5. Lekka funkcja członkostwa dla endpointu emotki (zamiast `room_lobby`) i czy zamknięty pokój odmawia.
6. Czy nadawca widzi swoją emotkę od razu lokalnie (bez czekania na kanał) i jak uniknąć podwójnego pokazania, skoro
   `httpSend` z serwera dociera do wszystkich subskrybentów, nadawcy też.
7. Czy czekający spóźniony (`JoinWaiting`) ma widzieć emotki (dziś słucha tylko dzwonka).
