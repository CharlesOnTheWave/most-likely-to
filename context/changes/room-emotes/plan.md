# S-16 Emotki do pokoju — plan implementacji

## Overview

Każdy gracz w pokoju (host i goście) jednym dotknięciem wysyła jedną z sześciu emotek (❤️ 👍 👎 😭 🤬 💀), a cały pokój
widzi przez chwilę dymek z nickiem nadawcy i emotką. Emotka idzie przez Worker (sprawdzenie gracza) i kanał na żywo jako
nowe zdarzenie obok dzwonka; nic nie trafia do bazy. Po wysłaniu przyciski gasną na 3 s. Roadmapa S-16
(`context/foundation/roadmap.md:308-319`), PRD FR-023 (`context/foundation/prd.md:135`).

## Current State Analysis

- Kanał na żywo `live-sync:<roomId>` niesie jedno zdarzenie `bell` z `{ seq }`; nadaje tylko Worker przez REST `httpSend`
  (`src/lib/live-sync/shared.ts:3-4`, `src/lib/live-sync/server.ts:12-32`), a ekran pokoju na `bell` pobiera stan i payloadu
  nie czyta (`src/components/room/useRoomState.ts:283-289`). Kanał jest publiczny (research, „Kanał na żywo dziś”).
- `room_lobby` rozpoznaje hosta po sesji, a gościa po tokenie z ciasteczka i zwraca m.in. `me` (nick pytającego) oraz
  `players` (nicki w kolejności dołączenia), a dla obcego `null` (`src/lib/rooms/server.ts:221-238`,
  `src/lib/rooms/shared.ts:91-104`). Endpoint emotki może więc sprawdzić gracza i wziąć jego nick bez nowej funkcji w bazie.
- Wzór endpointu akcji gracza bez dzwonka: `src/pages/api/rooms/[id]/react.ts` (S-11); dzwonek przez `waitUntil`:
  `ringLobby` (`src/lib/rooms/server.ts:542-555`); odpowiedź i log `{op, outcome, roomId}`: `actionAnswer`
  (`src/lib/rooms/json-route.ts:177-185`).
- Wzór przycisku jednym dotknięciem: `src/components/room/QuestionReaction.tsx`; wysyłka: `sendRoomAction`
  (`src/components/room/room-actions.ts:49-74`) z unią `RoomAction` (`:17-31`).
- Wspólny kontener wszystkich ekranów pokoju: wrapper w `RoomContent` (`src/components/room/RoomScreen.tsx:245-268`); fokus
  po ruchu hosta trafia w pierwszy nagłówek w `contentRef` (`:129`); pasek hosta przyklejony do dołu od `lg`
  (`src/components/room/HostActions.tsx:76-83`). Kolor gracza: `seatColors` (`src/lib/rooms/chart.ts:95-97`).
- W `src` nie ma obsługi ograniczonego ruchu (`motion-reduce`/`prefers-reduced-motion`); `tw-animate-css` jest
  zaimportowany (`src/styles/global.css:2`). Emoji w produkcyjnym UI dziś brak.

## Desired End State

- W poczekalni, w trakcie gry (głosowanie, odsłona, pominięte pytanie) i na ekranie końca wieczoru każdy gracz ma pasek
  sześciu emotek w kolejności ❤️ 👍 👎 😭 🤬 💀. Dotknięcie wysyła emotkę; wszystkie przyciski paska gasną na 3 s
  (widocznie, nadal fokusowalne); odmowa serwera pokazuje się pod paskiem.
- Wszyscy w pokoju, nadawca też, widzą przez ok. 3 s dymek „<kropka w kolorze gracza> <nick> <emotka>”; naraz najwyżej
  5 dymków, nadmiar przepada. Przy ograniczonym ruchu dymek pojawia się i znika bez animacji. Czytnik ekranu dostaje
  grzeczny komunikat „<nick>: <nazwa emotki>”.
- Czekający spóźniony i obcy nie mogą wysłać emotki (404) i jej nie widzą.
- Odbiorca pokazuje emotkę tylko, gdy jej identyfikator jest na liście sześciu, a nick należy do gracza z jego bieżącej
  listy graczy; inaczej ją pomija.
- Nic z emotki nie trafia do bazy; log ma jedną linię `{op: "emote", outcome, roomId}` na próbę, bez nadawcy i emotki.
- Weryfikacja: testy jednostkowe modułu emotek, krok w smoke, test E2E z trzema graczami, wybór wyglądu przez Karola na
  zrzutach, sprawdzenie w zbiorczej grze.

### Key Discoveries:

- `room_lobby` daje nick pytającego (`me`) i listę graczy, więc nie potrzeba migracji ani `db push`
  (`src/lib/rooms/shared.ts:91-104`).
- `ringRoom` ma na sztywno `BELL_EVENT` i `{ seq }` (`src/lib/live-sync/server.ts:16`); emotka potrzebuje wspólnej funkcji
  wysyłki z nazwą zdarzenia, a dzwonek ma działać bez zmian.
- `httpSend` z serwera dociera do wszystkich subskrybentów tematu, także do nadawcy (opcja `self` dotyczy tylko wysyłki
  z klienta, research „Kanał na żywo dziś”), więc nadawca widzi swój dymek z kanału, bez lokalnego echa.
- Limit Realtime: 100 wiadomości/s jako średnia z 60 s, broadcast = 1 + N (research, „Limity”); przerwa 3 s na gracza to
  przy 20 stale klikających graczach ok. 140 wiadomości/s, więc limit chroni realny rytm gry, nie ciągłe klikanie.

## What We're NOT Doing

- Gify, tekst, historia emotek, liczniki emotek (PRD §Non-Goals; Parked w roadmapie).
- Podpisywanie emotek kluczem ani kanały prywatne: kanał zostaje publiczny, więc kto zna UUID pokoju, może nadać emotkę
  z nickiem gracza tego pokoju (decyzja Karola 2026-10-26: emotki z nickiem mimo tego). Odbiorca odrzuca tylko obce nicki
  i emotki spoza listy.
- Pilnowanie przerwy 3 s na serwerze: fałszerz i tak omija Worker, a uczciwy klient pilnuje jej sam (research, Open
  Question 4).
- Zapis czegokolwiek w bazie, migracja, pgTAP.
- Emotki u czekającego spóźnionego (`JoinWaiting`).
- Zmiana dzwonka, ogranicznika pobrań i odpytywania co 15 s.
- Kanał bez nicku (S-09 „usuń gracza” zmieni listę graczy; dymek nieobecnego gracza po prostu przepadnie).

## Implementation Approach

Najpierw droga emotki bez wyglądu (faza 1): czysty moduł z listą i walidacją (testy jednostkowe), wspólna wysyłka na kanał,
endpoint `emote`, krok w smoke. Potem ekran (faza 2): nasłuch w `useRoomState`, pasek i dymki, kilka wariantów
rozmieszczenia na zrzutach do wyboru Karola (tymczasowy przełącznik usunięty po wyborze), podglądy i test E2E. Na końcu
wdrożenie bez bazy (faza 3).

## Critical Implementation Details

- **Fokus i podglądy:** pasek emotek nie ma nagłówka `h1/h2` i stoi poza `contentRef`, żeby fokus po ruchu hosta dalej
  trafiał w tytuł ekranu (`RoomScreen.tsx:129`); akcja `emote` nie wchodzi do `VIEW_CHANGING` (`:98`), bo nie zmienia
  widoku. Nakładka dymków jest `fixed` i `pointer-events-none` i nie owija treści, bo przyklejony pasek hosta psuje się
  pod przodkiem przycinającym overflow (`HostActions.tsx:76-81`).
- **Nasłuch nie może dzwonić:** handler zdarzenia emotki w `useRoomState` nie woła `limiter.bell()`; emotka nie zmienia
  stanu pokoju, a każde wywołanie ogranicznika to pobranie stanu.

## Faza 1: Emotka przez serwer do kanału

### Overview

Lista sześciu emotek i walidacja w czystym module, wspólna wysyłka na kanał z nazwą zdarzenia, endpoint
`POST /api/rooms/[id]/emote` i krok w smoke. Bez zmian na ekranie.

### Changes Required:

#### 1. Lista emotek i walidacja

**File**: `src/lib/rooms/emotes.ts` (nowy, bez importów serwera, bezpieczny w przeglądarce)

**Intent**: Jedno źródło listy emotek w kolejności Karola oraz walidacja ciała żądania i wiadomości z kanału, wspólna dla
Workera, ekranu i testów.

**Contract**:

- `EMOTES`: tablica tylko do odczytu `{ id, char, label }` w kolejności: `heart` ❤️ „Serce”, `like` 👍 „Kciuk w górę”,
  `dislike` 👎 „Kciuk w dół”, `cry` 😭 „Płacz”, `angry` 🤬 „Wkurzenie”, `skull` 💀 „Czaszka”; typ `EmoteId`.
- `EMOTE_COOLDOWN_MS = 3000`, `EMOTE_SHOW_MS` (ok. 3000) i `EMOTE_MAX_SHOWN = 5`.
- `bodyEmote(body: unknown): EmoteId | undefined` — `{ emote: <id z listy> }`, wszystko inne `undefined`.
- `parseEmoteMessage(payload: unknown, nicks: ReadonlySet<string>): { emote: EmoteId; nick: string } | null` — przyjmuje
  tylko obiekt z `emote` z listy i `nick` będącym napisem z `nicks`; inaczej `null`.

#### 2. Zdarzenie emotki na kanale

**File**: `src/lib/live-sync/shared.ts`, `src/lib/live-sync/server.ts`, `src/lib/rooms/server.ts`

**Intent**: Druga nazwa zdarzenia obok dzwonka i wspólna wysyłka przez `httpSend`, żeby dzwonek działał bez zmian, a emotka
szła tą samą drogą (limit czasu 5 s, log błędu, `removeChannel`).

**Contract**:

- `EMOTE_EVENT = "emote"` w `shared.ts` (komentarz: payload `{ emote, nick }`, niezaufany jak dzwonek; odbiorca waliduje
  `parseEmoteMessage`).
- W `live-sync/server.ts` wspólna funkcja wysyłki `(supabase, room, event, payload, op)`; `ringRoom` korzysta z niej
  z dotychczasowym logiem `op: "ring"`; nowa `sendEmote(supabase, room, message)` loguje błąd jako `op: "emote_send"`
  (pola tylko z listy `logEvent`, bez nicku i emotki).
- W `rooms/server.ts` `broadcastEmote(locals, supabase, roomId, message)` na wzór `ringLobby` (przez `waitUntil`, bez
  kontekstu czekamy).

#### 3. Endpoint emotki

**File**: `src/pages/api/rooms/[id]/emote.ts` (nowy)

**Intent**: Gracz pokoju wysyła emotkę; Worker sprawdza, że jest graczem tego pokoju (host po sesji, gość po ciasteczku),
bierze jego nick z `room_lobby` i nadaje zdarzenie emotki. Działa w każdym stanie pokoju, w którym gracz ma ekran
(poczekalnia, gra, zamknięty pokój z końcem wieczoru).

**Contract**: `POST` z `{ emote: EmoteId }`, kolejność jak w `react.ts`: `refuseForeignPost` → `UUID_PATTERN` (inaczej
`OUTSIDE_ROOM`) → `readJsonBody` → `bodyEmote` (inaczej `invalid_body`, 400) → brak sesji i tokenu = `OUTSIDE_ROOM` (404)
→ `createClient` (brak = `service_unavailable`) → `roomLobby(supabase, roomId, playerToken)`: błąd = jego `reason`,
`null` = `OUTSIDE_ROOM` → `broadcastEmote(…, { emote, nick: lobby.me })` → `actionAnswer(OP, roomId, { ok: true })`.
`OP = "emote"`. Emotka i nick nie trafiają do logu ani odpowiedzi.

#### 4. Akcja w przeglądarce

**File**: `src/components/room/room-actions.ts`

**Intent**: `"emote"` w unii `RoomAction` i w komentarzu nagłówka (z ciałem `{emote}`).

**Contract**: `RoomAction` z nowym członem `"emote"`.

#### 5. Testy jednostkowe

**File**: `tests/unit/emotes.test.ts` (nowy)

**Intent**: Wyrocznia z decyzji Karola (sześć emotek w tej kolejności; nick musi należeć do gracza pokoju), nie z kodu.

**Contract**: `it.each` dla `bodyEmote` (każdy z sześciu identyfikatorów; nieznany identyfikator, emoji zamiast
identyfikatora, brak pola, `null`, tablica, liczba) i dla `parseEmoteMessage` (poprawna para; nick spoza zbioru; nick
z innym rozmiarem liter; emotka spoza listy; payload `null`/tablica/napis; brakujące pole); kolejność i liczba `EMOTES`.

#### 6. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Na produkcji sprawdzić drogę emotki bez ekranu.

**Contract**: w krokach pokoju, gdy Ola jest graczem: „Ola sends an emote” → 200 `{ok: true}`; „an emote not on the list is
refused” → 400; „Ula, rejected, cannot send an emote” → 404 (Ula odrzucona w krokach spóźnionych). Pominięcia
`SMOKE_*` jak w sąsiednich krokach.

#### 7. Słownik i rejestr ryzyka

**File**: `context/domain/glossary.md`, `context/foundation/infrastructure.md`

**Intent**: Hasło „emotka” (jedna z sześciu emotek od gracza, widoczna chwilę dla całego pokoju z nickiem; nie „reakcja”,
nic nie zapisuje) i dopisek w rejestrze ryzyka przy „Kanał niesie tylko dzwonek `{ seq }`”: kanał niesie też emotkę
`{ emote, nick }`; podróbka z nickiem gracza możliwa, przyjęta decyzją Karola 2026-10-26.

**Contract**: wiersz w tabeli słownika; zdanie w `infrastructure.md:156,198`.

### Success Criteria:

#### Automated Verification:

- Bramka zielona: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- Testy jednostkowe `tests/unit/emotes.test.ts` przechodzą, a próba złamania (odbiorca przyjmuje dowolny nick) daje je
  czerwone i zostaje wycofana

#### Manual Verification:

- Przegląd diffu: dzwonek (`ringRoom`, `ringLobby`, nasłuch `bell`) zachowuje się jak przed zmianą, a w logu emotki nie ma
  nicku ani emotki

**Implementation Note**: Po fazie i zielonej bramce zatrzymaj się na potwierdzenie przed fazą 2.

---

## Faza 2: Pasek i dymki na ekranie

### Overview

Nasłuch emotek w ekranie pokoju, pasek emotek z przerwą 3 s, nakładka dymków, warianty rozmieszczenia na zrzutach do
wyboru Karola, podglądy i test E2E.

### Changes Required:

#### 1. Nasłuch na kanale

**File**: `src/components/room/useRoomState.ts`

**Intent**: Ta sama subskrypcja co dzwonek słucha też `EMOTE_EVENT` i przekazuje surowy payload do callbacku podanego przez
ekran; bez wywołania ogranicznika.

**Contract**: opcjonalny parametr/callback `onEmote(payload: unknown)` (najnowszy przez ref, bez ponownej subskrypcji przy
każdym renderze).

#### 2. Pasek emotek

**File**: `src/components/room/EmoteBar.tsx` (nowy)

**Intent**: Sześć przycisków w kolejności `EMOTES`, wzór `QuestionReaction.tsx`: `role="group"` z widoczną etykietą
„Emotki”, `Button size="icon"` z `aria-label` = `label`; po dotknięciu wszystkie przyciski na `EMOTE_COOLDOWN_MS` mają
`aria-disabled` i wyraźnie przygaszony wygląd (bez `disabled`, fokus zostaje); dotknięcie w przerwie nic nie wysyła;
odmowa → `FieldError` pod paskiem.

**Contract**: props `{ roomId, preview? }`; wysyłka `sendRoomAction(roomId, "emote", { emote })`; przerwa liczy się od
dotknięcia, niezależnie od odpowiedzi.

#### 3. Dymki

**File**: `src/components/room/EmoteBubbles.tsx` (nowy)

**Intent**: Nakładka `fixed`, `pointer-events-none`, `aria-hidden`, z najwyżej `EMOTE_MAX_SHOWN` dymkami „kropka w kolorze
gracza (`seatColors`) + nick + emotka”, każdy znika po `EMOTE_SHOW_MS`; animacja wejścia tylko przy `motion-safe`, przy
`motion-reduce` bez ruchu. Osobny region sr-only `aria-live="polite"` z tekstem „<nick>: <label>” ostatniej emotki.

**Contract**: props `{ shown: { key, nick, emote }[], players }`; kolory i odstępy z tokenów i klas ról (zasady UI w
AGENTS.md; `scripts/ui-literals.mjs` obejmuje pliki pokoju sam).

#### 4. Wpięcie w ekran

**File**: `src/components/room/RoomScreen.tsx`

**Intent**: `RoomContent` trzyma listę pokazywanych emotek: `onEmote` → `parseEmoteMessage(payload, nicki z bieżącego
widoku)` → dopisanie (obcięcie do `EMOTE_MAX_SHOWN`) i zdjęcie po `EMOTE_SHOW_MS`. Pasek i dymki we wspólnym wrapperze, poza
`contentRef`, na każdym ekranie pokoju (poczekalnia, głosowanie, odsłona, pominięte, koniec wieczoru). Podgląd przez nowe
pole `ScreenPreview.emotes` (`{ cooling?, error?, shown? }`).

**Contract**: miejsce paska na telefonie i od `lg` według wariantu wybranego przez Karola (pkt 5).

#### 5. Warianty do wyboru (tymczasowe)

**File**: `src/pages/dev/room-window.astro`, zrzuty w scratchpadzie

**Intent**: 3–4 warianty rozmieszczenia paska i dymków (np. pasek pod treścią w kolumnie; pasek przyklejony do dołu okna
na telefonie i obok paska hosta od `lg`; dymki z prawego dołu w górę kontra stos w rogu) przez tymczasowy przełącznik
`?emotes=<wariant>`; zrzuty jak przy S-11 (laptop całe okno 1536×750, telefon 390×844 ×2), strona „Co oceniasz” w Chrome
Karola. Po wyborze przełącznik i warianty usunięte, zostaje wybrany.

**Contract**: wybór Karola zapisany w tym planie (Progress 2.3) przed implementacją ostateczną.

#### 6. Podglądy

**File**: `src/pages/dev/room-states.astro`, `src/pages/dev/room-window.astro`

**Intent**: Nowe stany od 91: pasek w spoczynku, pasek w przerwie, odmowa pod paskiem, trzy dymki naraz (w tym nick
z emoji), pięć dymków (limit); akapit wstępu uzupełniony. W `room-window` próbka głosowania i odsłony z paskiem i dymkami
(przeprowadzenie nowego pola przez `Sample` i obiekt podglądu).

**Contract**: numerowane sekcje `<h2>` jak dotąd; `?state=<klucz>` dla nowych próbek.

#### 7. Test E2E

**File**: `tests/e2e/game.spec.ts` (albo nowy `tests/e2e/emotes.spec.ts` z wpisem w `playwright.config.ts`, jeśli ma grać
też projekt telefonu)

**Intent**: Trzech graczy: Ola dotyka „Serce”; host i drugi gość widzą komunikat „Ola: Serce” (rola `status`/region
sr-only, nie tekst dymku z `aria-hidden`), a przyciski Oli są `aria-disabled` i po przerwie znów aktywne; host przechodzi
dalej bez czekania na emotki.

**Contract**: `test.slow()`, `newGuestContext`, `ROUND_UPDATE_MS`, wyrocznia z decyzji Karola (§6.4 `test-plan.md`).

### Success Criteria:

#### Automated Verification:

- Bramka zielona: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- `npx playwright test --list` pokazuje nowy test emotek (sam test gra w CI, job `e2e`)

#### Manual Verification:

- Karol wybrał wariant rozmieszczenia paska i dymków na zrzutach (zapisany tutaj)
- Zrzuty wybranego wariantu: pasek i dymki na telefonie i laptopie, przerwa 3 s, odmowa, pięć dymków; fokus po ruchu hosta
  nadal w tytule ekranu

**Implementation Note**: Po fazie i zielonej bramce zatrzymaj się na potwierdzenie przed wdrożeniem.

---

## Faza 3: Wdrożenie

### Overview

Bez migracji: PR, zielone CI, scalenie przez Karola, smoke na produkcji, sprawdzenie w zbiorczej grze.

### Changes Required:

#### 1. PR i wdrożenie

**File**: — (gałąź `room-emotes`)

**Intent**: Push gałęzi (za zgodą), `gh pr create`, zielone `ci`, `smoke`, `db`, `e2e`; scala Karol
(`! gh pr merge <n> --merge`), Workers Builds wdraża; smoke na produkcji raz (za zgodą).

**Contract**: ścieżki chronione (`src/pages/api/rooms/`, `src/lib/rooms/`, `tests/`) tylko przez PR (AGENTS.md).

### Success Criteria:

#### Automated Verification:

- CI na PR zielone: `ci`, `smoke`, `db`, `e2e`

#### Manual Verification:

- Smoke na produkcji zielony po scaleniu (za zgodą), w tym trzy kroki emotki
- Karol w zbiorczej grze: emotka z nickiem widoczna u wszystkich na telefonie i laptopie, przyciski gasną na 3 s, host
  prowadzi grę bez przeszkód, dymki nie zasłaniają przycisków

---

## Testing Strategy

### Unit Tests:

- `tests/unit/emotes.test.ts`: walidacja ciała i wiadomości z kanału (lista sześciu, nick tylko z bieżącej listy graczy),
  kolejność `EMOTES`.

### Integration Tests:

- E2E z trzema graczami przez lokalny Supabase z Realtime w CI: emotka dochodzi do pozostałych, przerwa 3 s.
- Smoke na produkcji: 200 dla gracza, 400 dla emotki spoza listy, 404 dla odrzuconego spóźnionego.

### Manual Testing Steps:

1. W zbiorczej grze każdy wysyła po jednej emotce w poczekalni, w głosowaniu, na odsłonie i na końcu wieczoru.
2. Kilka osób naraz klika: najwyżej pięć dymków, nic się nie rozjeżdża.
3. Na telefonie z ograniczeniem ruchu dymek bez animacji.

## Performance Considerations

Jedna emotka = 1 żądanie Workera, 1 wywołanie `room_lobby` i 1 + N wiadomości Realtime. Przy przerwie 3 s pokój 20 graczy
klikających bez przerwy przez minutę przekroczyłby średni limit Realtime projektu (ok. 140 wiadomości/s), co rozłącza
połączenia projektu do czasu spadku; w zwykłej grze (pojedyncze emotki przy odsłonie) to daleko od limitu. Odczyt
`room_lobby` to ten sam koszt co jedno pobranie stanu ekranu.

## Migration Notes

Brak migracji i zmian w bazie. Stary Worker nie zna `emote`; nowy ekran wysłany przed wdrożeniem Workera nie istnieje, bo
ekran i Worker wdrażają się razem.

## References

- Research: `context/changes/room-emotes/research.md`
- Wzór endpointu: `src/pages/api/rooms/[id]/react.ts`
- Wzór przycisku: `src/components/room/QuestionReaction.tsx`
- Wysyłka na kanał: `src/lib/live-sync/server.ts:12-32`, `src/lib/rooms/server.ts:542-555`
- Decyzje Karola: `context/changes/room-emotes/change.md` (Notes)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Emotka przez serwer do kanału

#### Automated

- [x] 1.1 Bramka zielona: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — e0c1c16
- [x] 1.2 Testy jednostkowe `tests/unit/emotes.test.ts` przechodzą, a próba złamania (odbiorca przyjmuje dowolny nick) daje je czerwone i zostaje wycofana — e0c1c16

#### Manual

- [x] 1.3 Przegląd diffu: dzwonek (`ringRoom`, `ringLobby`, nasłuch `bell`) zachowuje się jak przed zmianą, a w logu emotki nie ma nicku ani emotki — e0c1c16

### Phase 2: Pasek i dymki na ekranie

#### Automated

- [x] 2.1 Bramka zielona: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — 5d80891
- [x] 2.2 `npx playwright test --list` pokazuje nowy test emotek (sam test gra w CI, job `e2e`) — 5d80891

#### Manual

- [x] 2.3 Karol wybrał wariant rozmieszczenia paska i dymków na zrzutach (zapisany tutaj) — 5d80891
- [x] 2.4 Zrzuty wybranego wariantu: pasek i dymki na telefonie i laptopie, przerwa 3 s, odmowa, pięć dymków; fokus po ruchu hosta nadal w tytule ekranu — 5d80891

### Phase 3: Wdrożenie

#### Automated

- [x] 3.1 CI na PR zielone: `ci`, `smoke`, `db`, `e2e`

#### Manual

- [x] 3.2 Smoke na produkcji zielony po scaleniu (za zgodą), w tym trzy kroki emotki
- [ ] 3.3 Karol w zbiorczej grze: emotka z nickiem widoczna u wszystkich na telefonie i laptopie, przyciski gasną na 3 s, host prowadzi grę bez przeszkód, dymki nie zasłaniają przycisków
