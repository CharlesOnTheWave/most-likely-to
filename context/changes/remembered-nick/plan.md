# Zapamiętany nick (S-14, FR-024) — plan implementacji

## Overview

Ta sama przeglądarka podpowiada nick, którym gracz ostatnio wszedł do gry: gość ma go wpisanego w formularzu
wejścia z linku (także jako spóźniony), host w formularzu „Nowa gra”. Nick zapisuje ekran pokoju dopiero wtedy, gdy baza
go przyjęła. Z przeglądarki pamiętamy wyłącznie nick, nigdy głos ani cel głosu (decyzja hosta 2026-10-25, roadmapa S-14).

## Current State Analysis

- Pola nicku są dwa: `JoinForm.tsx` (warianty `join`, `request`, `request-again` w `src/pages/j/[token].astro:85,94,99-105`)
  i `NewGameForm.tsx` (`src/pages/index.astro:48`). Oba startują od `""` w SSR (`JoinForm.tsx:59`, `NewGameForm.tsx:64`) i
  wysyłają nick natywnym POST-em; błąd wraca jako `?error=<code>`, a pole jest wtedy puste.
- Jedynie `request-again` ma nick z serwera (`initialNick`, `[token].astro:103`).
- Nic po stronie przeglądarki nie pamięta nicku; jedyny zapis w przeglądarce to 3 linie `sessionStorage` znacznika
  przeładowania (`useRoomState.ts:99,100,110`), z try/catch i `logEvent` (`:94-114`).
- Ekran pokoju zna potwierdzony, znormalizowany nick w `view.me` dla hosta i gościa (`shared.ts:87-90`), w wyspie
  `RoomScreen` (`src/pages/r/[id].astro:66`, `RoomScreen.tsx:85`).
- Planowana reguła D7 (`context/changes/refactor-opportunities/plan.md:196-201`) zakaże w `src` dostępu do pamięci
  przeglądarki poza wyjątkami; dziś nie istnieje w `eslint.config.js`.
- Szczegóły i źródła: `context/changes/remembered-nick/research.md`.

## Desired End State

- Gość, który wszedł do jakiejkolwiek gry w tej przeglądarce, przy następnym linku widzi swój ostatni nick w polu i tylko
  klika „Dołącz” (albo „Poproś o wejście”); może go zmienić przed wejściem.
- Host widzi swój ostatni nick w „Nowej grze”. Host i gość dzielą jeden zapamiętany nick.
- Po odmowie „nick zajęty” pole jest puste, jak dziś.
- „Poproś jeszcze raz” dalej pokazuje nick z serwera; podglądy `/dev/room-states` nie zależą od pamięci przeglądarki.
- W przeglądarce leży wyłącznie nick pod jednym kluczem; dostęp do `localStorage` jest w jednym miejscu w `src`.
- Sprawdzenie: test jednostkowy modułu, test E2E w CI (podpowiedź u gościa i hosta, puste pole po „nick zajęty”),
  przeklikanie na telefonie po wdrożeniu.

### Key Discoveries:

- `JoinForm.tsx:59` — kolejność wartości startowej: `preview?.nick ?? initialNick ?? ""`; podpowiedź wchodzi za nią.
- `[token].astro:74` — kod błędu jest czytany z `?error=` i od razu zamieniany na tekst (`roomErrorMessage`); formularz
  dostaje tylko tekst, więc decyzję „po `nick_taken` bez podpowiedzi” musi podjąć strona.
- `tests/e2e/support/room.ts:63-64` — tekst wpisany przed hydratacją przepada; podpowiedź po zamontowaniu nie może
  nadpisać tego, co gracz już wpisał.
- `useRoomState.ts:94-114` — wzór obsługi pamięci, która odmawia (tryb prywatny): try/catch, `logEvent` z
  `op`/`step`/`errName`, bez danych gracza (`src/lib/log.ts:1-6,13-27`).
- `vitest.config.ts:16-21` — testy jednostkowe w środowisku `node`, bez DOM; moduł musi przyjmować pamięć jako argument.

## What We're NOT Doing

- Bez zapisu głosu, celu głosu, tokenu ani czegokolwiek poza nickiem (AGENTS.md:7; S-04 to osobna decyzja właściciela).
- Bez nicku w adresie (`?nick=`), w ciasteczku ani w logach.
- Bez przycisku „to nie ja / zapomnij nick” i bez dopisku przy polu; gracz po prostu zmienia tekst (FR-024).
- Bez zmian w bazie, w trasach API i w `scripts/smoke.mjs` (smoke używa tylko `fetch`).
- Bez wdrażania reguły D7 — tylko dopisek w jej planie.
- Bez poprawiania `context/foundation/shape-notes.md` (historyczne notatki; PRD FR-024 rozstrzyga).
- Bez podpowiedzi na ekranie oczekiwania spóźnionego (`JoinWaiting.tsx`, tam nie ma pola).

## Implementation Approach

Jeden mały moduł w `src/lib/rooms/` trzyma klucz, regułę poprawnego nicku i bezpieczny dostęp do `localStorage`;
reszta kodu woła tylko jego funkcje. Ekran pokoju zapisuje `view.me`, a formularze czytają zapamiętany nick w efekcie
po zamontowaniu (SSR i pierwszy render zostają puste, więc hydratacja się nie rozjeżdża) i wpisują go tylko do pustego
pola. Strona `/j/[token]` wyłącza podpowiedź, gdy wraca z `nick_taken`.

## Critical Implementation Details

- **Timing & lifecycle** — podpowiedź ustawia nick funkcją aktualizującą, która zmienia wartość tylko wtedy, gdy pole
  jest nadal puste (`setNick((current) => (current === "" ? remembered : current))`); inaczej szybkie wpisanie tuż po
  hydratacji zostałoby nadpisane.
- **Dostęp do pamięci** — sam odczyt `window.localStorage` potrafi rzucić wyjątek (zablokowane dane witryny), więc
  dostęp jest w try/catch, a reszta modułu pracuje na zwróconym obiekcie. Dzięki temu przyszła reguła D7 złapie dokładnie
  jedną linię w module (`window.localStorage`, `no-restricted-properties`), a nie każde wywołanie.

## Faza 1: Moduł zapamiętanego nicku i test jednostkowy

### Overview

Moduł z kluczem, regułą i bezpiecznym zapisem/odczytem oraz test, który pilnuje, że do przeglądarki trafia tylko nick.

### Changes Required:

#### 1. Moduł

**File**: `src/lib/rooms/remembered-nick.ts` (nowy)

**Intent**: Jedno miejsce, które zapisuje i czyta ostatni przyjęty nick, odrzuca wartości, których formularz i tak by nie
przyjął, i nigdy nie rzuca wyjątku do ekranu.

**Contract**:

- `REMEMBERED_NICK_KEY = "mlt-nick"` (przedrostek `mlt-` jak `mlt-room-reloaded:` w `useRoomState.ts:51`).
- `type NickStorage = Pick<Storage, "getItem" | "setItem">`.
- `browserNickStorage(): NickStorage | null` — `window.localStorage` w try/catch; `null` poza przeglądarką albo gdy
  dostęp rzuci (log `warn`, `op: "remembered_nick"`, `step: "open"`, `errName`).
- `readRememberedNick(storage: NickStorage | null): string | null` — zwraca zapisany tekst tylko wtedy, gdy ma od 1 do
  `NICK_MAX_LENGTH` znaków według `nickLength` (`shared.ts:4,350-352`); w każdym innym przypadku `null`; błąd `getItem`
  → `null` i log `step: "read"`.
- `rememberNick(storage: NickStorage | null, nick: string): void` — przy poprawnym nicku dokładnie jedno
  `setItem(REMEMBERED_NICK_KEY, nick)`; przy niepoprawnym nic; błąd `setItem` → log `step: "write"`, bez wyjątku.
- Logi przez `logEvent` z `src/lib/log.ts`, tylko pola `op`, `step`, `errName`; nigdy nick. Lokalna funkcja `errorName`
  jak w `useRoomState.ts:56`.

#### 2. Test jednostkowy

**File**: `tests/unit/remembered-nick.test.ts` (nowy)

**Intent**: Wyrocznia z FR-024 i roadmapy S-14 („tylko nick, nigdy głos”) oraz limitu 1–20 znaków z reguły bazy
(`invalid_nick`, `20261014101922_first_live_round.sql:351-359`); oczekiwane wartości jako literały, nie liczone kodem pod testem (`test-plan.md` §6.1).

**Contract**: Pamięć jako atrapa w teście (obiekt z `getItem`/`setItem`, licznik wywołań), bez `window`. Przypadki
(`it.each` tam, gdzie to jedna właściwość):

- odczyt: nic zapisane → `null`; poprawny nick → ten sam tekst; pusty i same spacje → `null`; 20 znaków (także z emoji
  liczonym jako jeden znak) → zwrócony; 21 znaków → `null`; `getItem` rzuca → `null` bez wyjątku; `storage` `null` → `null`;
- zapis: poprawny nick → dokładnie jedno `setItem` z kluczem modułu i wartością równą nickowi, nic więcej; pusty albo
  21 znaków → zero `setItem`; `setItem` rzuca → bez wyjątku; `storage` `null` → bez wyjątku;
- obieg: zapis, potem odczyt tej samej pamięci → ten sam nick.

### Success Criteria:

#### Automated Verification:

- `npx vitest run --project unit tests/unit/remembered-nick.test.ts` zielony
- `npm test`, `npm run lint`, `npx astro check`, `npm run build` przechodzą

#### Manual Verification:

- Próbny alarm (lokalnie, bez commita): `rememberNick` zapisujący także drugi klucz albo wartość inną niż nick daje
  czerwony przypadek „dokładnie jedno setItem”; po cofnięciu `git diff -- src` pusty

**Implementation Note**: Po zielonej automatyce poczekaj na potwierdzenie próbnego alarmu przed fazą 2.

---

## Faza 2: Ekrany, podglądy i dokumenty

### Overview

Zapis na ekranie pokoju, podpowiedź w obu formularzach, wyjątek po `nick_taken`, nowe stany podglądu, słownik i dopisek
w planie D7.

### Changes Required:

#### 1. Zapis na ekranie pokoju

**File**: `src/components/room/RoomScreen.tsx`

**Intent**: Gdy ekran pokoju (nie podgląd) zna `view.me`, zapamiętuje go jako ostatni nick tej przeglądarki; obejmuje
hosta, gościa i wpuszczonego spóźnionego.

**Contract**: Efekt zależny od `view.me` i trybu podglądu, wołający `rememberNick(browserNickStorage(), view.me)`;
w podglądzie (`preview` ustawione) nic nie zapisuje.

#### 2. Podpowiedź w formularzu wejścia

**File**: `src/components/room/JoinForm.tsx`

**Intent**: Po zamontowaniu wpisuje zapamiętany nick do pustego pola, chyba że strona zabroniła podpowiedzi, formularz
jest podglądem albo ma nick od serwera.

**Contract**: Nowy prop `suggestNick?: boolean` (domyślnie `false`). Efekt po zamontowaniu: gdy `suggestNick && !preview &&
!initialNick` → `readRememberedNick(browserNickStorage())` i funkcja aktualizująca z Critical Implementation Details.
Licznik `x/20` i walidacja działają na podpowiedzianej wartości bez zmian.

#### 3. Strona linku

**File**: `src/pages/j/[token].astro`

**Intent**: Strona zna kod błędu z adresu, więc to ona decyduje o podpowiedzi: po `nick_taken` pole zostaje puste.

**Contract**: Kod z `Astro.url.searchParams.get("error")` (dziś czytany w `:74`) trafia do zmiennej; montowania `join`
(`:85`) i `request` (`:94`) dostają `suggestNick={errorCode !== "nick_taken"}`; `request-again` (`:99-105`) bez zmian.

#### 4. Podpowiedź w „Nowej grze”

**File**: `src/components/room/NewGameForm.tsx`

**Intent**: Host widzi swój ostatni nick; host nie dostaje `nick_taken` przy zakładaniu gry, więc wystarczy warunek
„nie podgląd”.

**Contract**: Ten sam efekt co w `JoinForm` przy `!preview`; potwierdzenie zamknięcia otwartego pokoju (`:103-107`) bez zmian.

#### 5. Podglądy

**File**: `src/pages/dev/room-states.astro`

**Intent**: Nowy stan „nick podpowiedziany z poprzedniej gry” dla obu formularzy (AGENTS.md: nowy stan pokoju ma podgląd)
i komentarze zgodne z nowym zachowaniem.

**Contract**:

- Nowa sekcja w grupie „Nowa gra” (`id="new-remembered"`) i w grupie wejścia (`id="join-remembered"`), z `preview.nick`
  ustawionym na przykładowy nick, numerowane dalej w swoich grupach.
- Komentarz przy `new-server-error` (`:411`): nick nadal nie idzie w adresie, ale przeglądarka, która go pamięta, wpisze
  go po przekierowaniu (S-14).
- `join-nick-taken` (`:434-445`) zostaje z pustym polem — tak jest też na prawdziwej stronie.

#### 6. Słownik

**File**: `context/domain/glossary.md`

**Intent**: Nowe pojęcie dla kodu i planów.

**Contract**: Wiersz po „nick”: `zapamiętany nick` | ostatni nick przyjęty w tej przeglądarce, podpowiadany w formularzu
wejścia i „Nowej grze”; tylko nick, nigdy głos | `src/lib/rooms/remembered-nick.ts`, `mlt-nick` | „konto”, „login”.
Plik celowo bez Prettiera.

#### 7. Dopisek w planie D7

**File**: `context/changes/refactor-opportunities/plan.md`

**Intent**: Plan D7 zakłada jeden wyjątek; po S-14 są dwa. Dopisek na górze planu, bez przepisywania faz (tak jak
notka po F2).

**Contract**: Notka: S-14 dodaje drugi dozwolony dostęp do pamięci przeglądarki, `window.localStorage` w
`src/lib/rooms/remembered-nick.ts` (decyzja właściciela 2026-10-25, tylko nick); faza 2 oczekuje 4 ostrzeżeń zamiast 3,
komunikat reguły wymienia oba wyjątki, linia w module dostaje komentarz `eslint-disable-next-line
no-restricted-properties -- <powód>`; próbny alarm 3.4 w `JoinForm.tsx` pozostaje ważny (formularz nie dotyka pamięci).

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, `npx astro check`, `npm run build` przechodzą
- Grep `localStorage|sessionStorage|document\.cookie|indexedDB` w `src/` daje dokładnie 4 linie: 3 w `useRoomState.ts`
  i 1 w `src/lib/rooms/remembered-nick.ts`
- `npx prettier --check` dla zmienionych plików `.md` poza `glossary.md`

#### Manual Verification:

- Karol ocenia zrzuty nowych stanów `new-remembered` i `join-remembered` z `/dev/room-states` (laptop jako całe okno,
  telefon w prawdziwej wielkości)

**Implementation Note**: Serwer dev tylko do podglądów `/dev/*` (`.dev.vars` wskazuje na produkcję); zatrzymać po zrzutach.
Po akceptacji zrzutów przejdź do fazy 3.

---

## Faza 3: Test E2E i wdrożenie

### Overview

Test przeglądarkowy prawdziwego przepływu, potem PR, zielone CI, scalenie przez Karola i sprawdzenie na telefonie.

### Changes Required:

#### 1. Test E2E

**File**: `tests/e2e/remembered-nick.spec.ts` (nowy, projekt `chromium`; bez zmian w `testMatch` telefonu)

**Intent**: Dowód z perspektywy gracza: zapamiętany nick wraca w następnej grze u gościa i u hosta, a po „nick zajęty”
pole jest puste.

**Contract** (helpery z `tests/e2e/support/room.ts`, nicki z `uniqueNick`, konteksty gości zamknięte na końcu):

1. `openRoom` → pokój 1 (ekran hosta zapisuje nick hosta).
2. Gość A w `newGuestContext` → `joinRoom(link1, nickA)` (ekran pokoju zapisuje `nickA`).
3. Host: `page.goto("/")` → pole „Twój nick” ma wartość `hostNick`.
4. `openRoom` → pokój 2 (`confirm_close` zamyka pokój 1).
5. Gość A otwiera `link2` → pole „Twój nick” ma wartość `nickA`.
6. Gość B w nowym kontekście → `joinRoom(link2, nickA)`.
7. Gość A klika „Dołącz” → zostaje na `/j/…` z odmową, pole „Twój nick” ma wartość `""`.

Asercje przez role i nazwy, bez polskich tekstów odmowy (test-plan §6.4); `toHaveValue` czeka na efekt po hydratacji.

#### 2. Wdrożenie

**Intent**: Pełny cykl z pliku zasad: push gałęzi (zgoda), PR, zielone `ci`/`smoke`/`db`/`e2e`, scalenie przez Karola,
smoke na produkcji (zgoda), przeklikanie.

**Contract**: Bez migracji, więc bez `db push`. Opis PR wymienia decyzje 1–6 i dopisek w planie D7.

### Success Criteria:

#### Automated Verification:

- `npx playwright test --list` pokazuje nowy test w projekcie `chromium`
- `npm test`, `npm run lint`, `npx astro check`, `npm run build` przechodzą
- CI na PR zielone: `ci`, `smoke`, `db`, `e2e` (w tym nowy test)

#### Manual Verification:

- Smoke na produkcji zielony po scaleniu (za zgodą)
- Karol na telefonie: wejście do gry z linku, potem następna gra z tego samego telefonu — nick wpisany; „Nowa gra” na
  laptopie z jego nickiem; zmiana nicku przed wejściem działa

**Implementation Note**: Push i smoke tylko za zgodą Karola; scala wyłącznie Karol (`! gh pr merge <n> --merge`).

---

## Testing Strategy

### Unit Tests:

- Moduł: odczyt i zapis z atrapą pamięci, granica 20/21 znaków, puste wartości, pamięć rzucająca wyjątki, „dokładnie jedno
  `setItem` z nickiem”.

### Integration Tests:

- E2E w CI: podpowiedź u gościa w drugim pokoju, podpowiedź u hosta w „Nowej grze”, puste pole po `nick_taken`.
- Istniejące testy E2E czyszczą pole przed wpisaniem (`room.ts:69-70`, `latecomer.spec.ts:40-41`) i mają osobne konteksty
  z pustą pamięcią, więc nie wymagają zmian.

### Manual Testing Steps:

1. Telefon: link do gry → nick → wejście; koniec gry; nowy link → nick już wpisany.
2. Laptop: „Nowa gra” → nick hosta wpisany; zmiana na inny przed „Załóż grę” działa.
3. Spóźniony na telefonie: link do trwającej gry → nick wpisany w „Poproś o wejście”.

## Performance Considerations

Jeden odczyt i jeden zapis `localStorage` na wejście; bez wpływu na rundę.

## Migration Notes

Brak zmian w bazie. Przeglądarki bez zapisanego nicku zachowują się jak dziś.

## References

- Research: `context/changes/remembered-nick/research.md`
- PRD: `context/foundation/prd.md` (FR-024), roadmapa S-14
- Wzór obsługi pamięci: `src/components/room/useRoomState.ts:94-114`
- Plan D7: `context/changes/refactor-opportunities/plan.md:196-201`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Moduł zapamiętanego nicku i test jednostkowy

#### Automated

- [x] 1.1 `npx vitest run --project unit tests/unit/remembered-nick.test.ts` zielony — 29c1b87
- [x] 1.2 `npm test`, `npm run lint`, `npx astro check`, `npm run build` przechodzą — 29c1b87

#### Manual

- [x] 1.3 Próbny alarm: drugi klucz albo wartość inna niż nick daje czerwony przypadek „dokładnie jedno setItem”; po cofnięciu `git diff -- src` pusty — 29c1b87

### Phase 2: Ekrany, podglądy i dokumenty

#### Automated

- [x] 2.1 `npm test`, `npm run lint`, `npx astro check`, `npm run build` przechodzą
- [x] 2.2 Grep pamięci przeglądarki w `src/` daje dokładnie 4 linie: 3 w `useRoomState.ts` i 1 w `remembered-nick.ts`
- [x] 2.3 `npx prettier --check` dla zmienionych plików `.md` poza `glossary.md`

#### Manual

- [x] 2.4 Karol ocenia zrzuty stanów `new-remembered` i `join-remembered` z `/dev/room-states`

### Phase 3: Test E2E i wdrożenie

#### Automated

- [ ] 3.1 `npx playwright test --list` pokazuje nowy test w projekcie `chromium`
- [ ] 3.2 `npm test`, `npm run lint`, `npx astro check`, `npm run build` przechodzą
- [ ] 3.3 CI na PR zielone: `ci`, `smoke`, `db`, `e2e` (w tym nowy test)

#### Manual

- [ ] 3.4 Smoke na produkcji zielony po scaleniu (za zgodą)
- [ ] 3.5 Karol na telefonie i laptopie: nick wpisany w następnej grze i w „Nowej grze”, zmiana nicku przed wejściem działa
