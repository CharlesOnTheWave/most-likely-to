# Strażnicy bramy RPC i anonimowości w przeglądarce — plan implementacji

> Po `deferred-review-fixes`:
>
> - `reveal_round(p_room_id, p_round default null)`: brak numeru albo inny numer daje `round_over`, tak jak w
>   `cast_vote`.
> - Przypadek „`castVote` bez numeru pytania” (`:141, :322`) odpada, bo Worker odmawia 400 przed bazą.
> - Krok smoke K1 (`:288`) wysyła numer pytania: `act("reveal", { round: <numer> }, hostJar)`.
> - Smoke ma już udaną odsłonę przez Workera („host reveals question 3 with its number”), więc przy starcie K1 sprawdź,
>   czy krok smoke z fazy 4 jest jeszcze potrzebny.
> - Smoke ma nowe kroki tej zmiany, więc liczby przypadków i kroków smoke przelicz przy starcie K1, z `smoke.mjs` i z
>   testu.

> Po S-14 (`remembered-nick`, decyzja właściciela 2026-10-25, tylko nick):
>
> - D7 ma dwa dozwolone dostępy do pamięci przeglądarki: znacznik przeładowania w `useRoomState.ts` i
>   `window.localStorage` w `src/lib/rooms/remembered-nick.ts` (`browserNickStorage`, jedna linia; reszta modułu pracuje
>   na zwróconym obiekcie).
> - Faza 2 oczekuje 4 ostrzeżeń zamiast 3: `useRoomState.ts:99,100,110` i jedno w `remembered-nick.ts`.
> - Komunikat reguły wymienia oba wyjątki.
> - Faza 3: linia w module dostaje komentarz `eslint-disable-next-line no-restricted-properties -- <powód>` (tylko nick,
>   nigdy głos ani jego cel), tak jak 3 linie znacznika.
> - Próbny alarm 3.4 w `JoinForm.tsx` pozostaje ważny: formularz woła tylko funkcje modułu i sam nie dotyka pamięci.

## Overview

Plan realizuje dwie pozycje z rankingu `research.md` tej zmiany, wybrane przez Karola 20.10.2026: **K1** (strażnik
bramy RPC: nazwy i argumenty, z którymi Worker woła 10 funkcji bazy) oraz tani zysk **D7** (strażnik zasady „głos
nigdzie się nie zapisuje” po stronie przeglądarki). Oba to strażnicy, nie przebudowa: kod gry nie zmienia działania.
Jedyna zmiana w `src` to trzy komentarze wyjątku przy znaczniku przeładowania ekranu.

## Current State Analysis

- Worker woła bazę wyłącznie przez `callRpc` (`src/lib/rooms/server.ts:82-98`, jedno `supabase.rpc(fn, args)` w
  `:89`), z 10 funkcji opakowujących (`server.ts:115,137,156,177,235,250,261,274,291,302`). Nazwa funkcji i klucze
  `p_*` to zwykłe napisy. Żaden test nie importuje `server.ts` (research, W7).
- Ścieżki Workera dla „Odsłoń wynik” (`revealRound`, `server.ts:260-263`, trasa `src/pages/api/rooms/[id]/reveal.ts`)
  nie woła żaden test CI: smoke woła start, 6× vote, next, skip i end (`scripts/smoke.mjs:270-323`), e2e kończy rundę
  ostatnim głosem (`tests/e2e/round.spec.ts:48-49`), testy db wołają `reveal_round` własną kopią nazwy
  (`tests/db/support/rounds.ts:114`). Literówka w nazwie albo zmiana parametru przeszłaby wszystkie joby.
- Aktualne sygnatury SQL (research, W2): `create_room(p_nick, p_link_token, p_categories, p_adult_categories,
p_confirm_close default false)` (`20261014101922_first_live_round.sql:220-226`), `join_room(p_link_token, p_nick,
p_player_token)` (`:308`), `room_link(p_link_token)` (`:384`), `start_game(p_room_id, p_question_id)` (`:540`),
  `reveal_round(p_room_id)` (`:723`), `next_round(p_room_id, p_round, p_candidates)` i `skip_round(…tak samo)`
  (`20261015122252_full_game_evening.sql:79,140`), `end_game(p_room_id)` (`:207`), `cast_vote(p_room_id, p_target,
p_player_token default null, p_round default null)` (`:255-260`), `room_lobby(p_room_id, p_player_token default null)`
  (`:403`).
- Zapis w przeglądarce w całym `src` to dziś tylko znacznik przeładowania pokoju: `window.sessionStorage` w
  `src/components/room/useRoomState.ts:99,100,110` (klucz `mlt-room-reloaded:<roomId>`, wartość `"1"`, `:51`, `:94-114`).
  `localStorage`, `indexedDB`, `document.cookie`: 0 (research, W26). Ciasteczko gracza ustawia serwer (`join.ts:53`).
- `npm run lint` (`eslint . && node scripts/ui-literals.mjs`) przechodzi dziś bez ostrzeżeń. Hook po edycji i hook końca
  tury uruchamiają ESLint z `--quiet` (`.claude/hooks/lint-edited-file.mjs:12`, `end-of-turn.mjs:58`), więc widzą tylko
  błędy, nie ostrzeżenia.

## Desired End State

- `npm test` zawiera test bramy RPC: dla każdej akcji gry sprawdza nazwę funkcji bazy, klucze argumentów i to, że każda
  wartość trafia do właściwego parametru. Wyrocznia to ręczna tabela z sygnatur SQL. Literówka w `"reveal_round"` w
  `server.ts` daje czerwony test lokalnie, w hooku agenta i w CI.
- Smoke (lokalny Supabase w CI i produkcja po wdrożeniu) ma krok, w którym host naciska „Odsłoń wynik” przez Workera:
  54 kroki zamiast 53.
- ESLint zabrania w `src` (`.ts`, `.tsx` i frontmatter `.astro`) zapisu w przeglądarce. Jedyny wyjątek to 3 linie
  znacznika przeładowania, każda z komentarzem i powodem. Nowy zapis, także w tym samym pliku, daje błąd lintu w chwili
  edycji (hook), w `npm run lint` i w CI. Skrypty `<script>` w `.astro` lint dziś pomija (Key Discoveries): to znana
  luka, zapisana w `test-plan.md` §6.3.
- Sprawdzenie: Progress na dole tego planu, wszystkie wiersze odhaczone, CI PR zielone we wszystkich jobach.

### Key Discoveries:

- Łańcuch importów `server.ts` nie dotyka `astro:*` ani `src/lib/supabase.ts`, także przechodnio (research, W8), więc
  test w projekcie `unit` może go zaimportować (`test-plan.md` §6.1).
- ESLint pozwala testom na import typów z `@supabase/supabase-js` (`eslint.config.js:94-109`, `allowTypeImports`), więc
  atrapa klienta może mieć typ `SupabaseClient` bez importu wartości.
- Wzór ręcznej wyroczni: `PLANNED_ROUND_REFUSALS` (`tests/unit/room-errors.test.ts:17-32`); oczekiwanie nigdy z
  implementacji (`test-plan.md` §6.1).
- Drugie „Odsłoń wynik” niczego nie zmienia i dostaje `{ ok: true }` (`first_live_round.sql:721`, `rounds.ts:25`), więc
  krok smoke po automatycznej odsłonie jest bezpieczny także na produkcji.
- Konwencja wyjątku od reguły ESLint w `src`: `// eslint-disable-next-line <reguła>` (np. `src/lib/auth-user.ts:15`).
- Skryptów klienta w `.astro` (`src/components/room/RoomCard.astro:27`, `src/components/auth/SignInCard.astro:42`)
  ESLint dziś nie sprawdza żadną regułą. eslint-plugin-astro robi z nich pliki wirtualne `*.astro/*.ts`, ale obejmuje je
  `projectService: true` z konfiguracji bazowej, parsowanie pada, a plugin po cichu wyrzuca ten błąd. Dowód z przeglądu
  planu (F1): `--rule no-restricted-syntax:CallExpression` na obu plikach nie zgłasza nic, choć `RoomCard.astro:30` ma
  wywołanie. Wszystkie dzisiejsze zapisy w przeglądarce są w `.ts`.

## What We're NOT Doing

- **K3** (kody odmów SQL ↔ `MESSAGES`, decyzja o `not_signed_in`), **K2** (parser ↔ `*_KEYS`), **K4** (wzorce tokenów),
  **K5** (kopia stałych w sondzie): później, osobnymi zmianami.
- Wygenerowane typy bazy i jedno źródło nazw RPC dla testów db (odrzucone w researchu: `jsonb` w 10/10 funkcji,
  niezależność wyroczni „drzwi atakującego”).
- Porównywanie tabeli testu z tekstem migracji (odrzucony wariant wyroczni K1). Zmianę samego SQL łapią testy db i smoke
  w CI.
- Testy gałęzi awarii `server.ts` (P6) na tej samej atrapie: osobna zmiana.
- Zmiany w `src/lib/rooms/server.ts`, także poprawka komentarza `:7-9` (P17). Próbne alarmy edytują go tylko tymczasowo.
- Przebudowa rundy w smoke (odsłona przed ostatnim głosem): scenariusz i oczekiwane liczby zostają.
- P12 (pamiętanie głosu po odświeżeniu), P13 (utrata ciasteczka): decyzje produktowe S-04.
- Bez migracji, bez `npx supabase db push`, bez zmian w `tests/db`, `tests/e2e` i `AGENTS.md`.
- Naprawa lintowania skryptów `<script>` w `.astro` (dziś żadna reguła ich nie sprawdza, przegląd planu F1): osobna
  zmiana. Do tego czasu D7 ich nie pilnuje.

## Implementation Approach

Najpierw strażnicy, potem egzekwowanie. Każda faza to osobny commit na jednej gałęzi i jednym PR (zmiany w `tests/`
idą tylko przez PR i zielone CI, `AGENTS.md`). Fazy idą od najtańszej i najbardziej samodzielnej, najpierw lokalne:

1. test charakteryzujący bramę RPC (utrwala dzisiejsze wywołania, zanim ktokolwiek dotknie `server.ts`);
2. reguła D7 jako ostrzeżenie: mechanizm wchodzi przy zielonym lincie i pokazuje dokładnie dzisiejsze 3 użycia;
3. reguła D7 jako błąd: egzekwowanie osobnym krokiem, z wyjątkiem przy 3 liniach;
4. krok smoke, który pierwszy raz prowadzi „Odsłoń wynik” przez Workera do prawdziwej bazy; pierwszy push gałęzi i PR,
   więc CI sprawdza naraz wszystkie cztery fazy.

Faza 3 zależy od 2, więc cofanie idzie w kolejności 3 → 2; fazy 1 i 4 są od nich niezależne. Fazy 1–3 sprawdza się
lokalnie, bez push (przegląd planu, F2: jeden push i jeden przebieg CI mniej). Push gałęzi, otwarcie PR,
`npm run smoke` i każde polecenie zdalne tylko za zgodą Karola; scala wyłącznie Karol (`! gh pr merge <n> --merge`). Po
scaleniu Workers Builds wdroży kod, który różni się tylko komentarzami, a smoke na produkcji (pytanie) ma dać 54/54.

## Critical Implementation Details

- **Atrapa na ścieżce sukcesu.** Każda funkcja opakowująca po wywołaniu sprawdza kształt odpowiedzi i przy złym kształcie
  loguje błąd (`unexpectedShape`, `server.ts:101-104`). Atrapa oddaje więc dla każdej funkcji odpowiedź, która przechodzi
  walidację: `create_room` i `join_room` `{ ok: true, room_id }`, `room_link` `{ status: "unknown" }`, `room_lobby`
  `null`, pozostałe `{ ok: true }`. Każdy przypadek sprawdza też `ok: true` w wyniku funkcji, więc zła odpowiedź atrapy
  świeci na czerwono, zamiast tylko zaśmiecić wynik linią logu.
- **Skrypty klienta w `.astro` poza zasięgiem.** Reguła D7 obejmuje `src/**/*.{ts,tsx,astro}`, bez plików wirtualnych
  `*.astro/*.{js,ts}`: lint ich dziś nie parsuje (Key Discoveries), więc taki glob dawałby tylko pozór ochrony. Luka
  jest jawna w „What We're NOT Doing” i w §6.3. Zapis w przeglądarce, gdyby kiedyś był potrzebny, należy do wyspy
  React, nie do `<script>` strony.

## Faza 1: Test bramy RPC (K1)

### Overview

Test unit z atrapą klienta utrwala, z jaką nazwą funkcji i jakimi argumentami Worker woła bazę dla każdej akcji gry.
Wyrocznia to ręczna tabela sygnatur SQL. Kod gry bez zmian.

### Changes Required:

#### 1. Test bramy

**File**: `tests/unit/room-rpc-gate.test.ts` (nowy)

**Intent**: Pierwszy lokalny sygnał dla `server.ts`: literówka w nazwie funkcji, zgubiony albo nadmiarowy klucz `p_*` i
wartość podana do złego parametru świecą na czerwono, zanim zmiana trafi do CI. Zamyka lokalnie dziurę „Odsłoń wynik”.

**Contract**:

- Atrapa: obiekt z metodą `rpc(fn, args, options?)`, który zapisuje każde wywołanie i oddaje odpowiedź ze ścieżki
  sukcesu (Critical Implementation Details); typ przez `import type { SupabaseClient }`. Wzór ręcznej atrapy:
  `tests/unit/auth-user.test.ts:14-17`.
- Wyrocznia: tabela 10 funkcji z aktualnych definicji SQL (komentarz z `plik:linia` przy każdej), dla każdej lista
  parametrów i znacznik „ma wartość domyślną”. Nigdy z `server.ts`.
- 12 przypadków w jednym `it.each`, nazwanych akcją gry: 10 funkcji opakowujących, `castVote` bez numeru pytania
  (`round` = `null`, bez `p_round`) i `roomLobby` bez tokenu gracza (`p_player_token: null`).
- Każdy przypadek woła funkcję opakowującą z wartościami-wartownikami, czyli innymi dla każdego pola wejścia, i sprawdza:
  dokładnie jedno wywołanie `rpc`; nazwa równa nazwie z tabeli; argumenty dokładnie równe oczekiwanemu obiektowi (każdy
  `p_*` niesie swojego wartownika); klucze ⊆ parametry z tabeli i każdy parametr bez wartości domyślnej obecny; brak
  trzeciego argumentu (zawsze POST, `server.ts:80-81`); wynik funkcji opakowującej ma `ok: true` (atrapa przeszła
  walidację odpowiedzi).
- Importy według `test-plan.md` §6.1 (`describe`, `it`, `expect` z `vitest`, kod przez `@/`).

#### 2. Wzór w planie testów

**File**: `context/foundation/test-plan.md` §6.1

**Intent**: Następna zmiana, która doda albo zmieni funkcję RPC, wie, że tabela w teście bramy idzie razem z migracją.

**Contract**: jeden punkt w §6.1: nazwa pliku, atrapa klienta, wyrocznia z sygnatur SQL, nowa funkcja RPC = nowy wiersz.

### Success Criteria:

#### Automated Verification:

- `npx vitest run --project unit tests/unit/room-rpc-gate.test.ts`: 12 testów zielonych
- `npm test`, `npm run lint`, `npx astro check`, `npm run build` przechodzą
- `git diff main --stat -- src` pusty (kod gry bez zmian)

#### Manual Verification:

- Próbny alarm A (lokalnie, bez commita): `"reveal_round"` → `"reveal_rounds"` w `server.ts:261` daje czerwony dokładnie przypadek „Odsłoń wynik”; po cofnięciu `git diff -- src` pusty
- Próbny alarm B (lokalnie, bez commita): zamienione wartości `p_nick` i `p_link_token` w `createRoom` dają czerwony dokładnie przypadek „Załóż grę”; po cofnięciu `git diff -- src` pusty
- Karol czyta listę 12 nazw testów i potwierdza, że jest tam każda akcja gry

**Implementation Note**: Po zielonych kryteriach automatycznych zatrzymaj się na ręczne potwierdzenie Karola, zanim
ruszy faza 2.

---

## Faza 2: Reguła D7 jako ostrzeżenie (mechanizm)

### Overview

ESLint dostaje regułę, która w `src` zakazuje zapisu w przeglądarce. Wchodzi jako ostrzeżenie, więc lint, hooki i CI
zostają zielone, a wynik lintu pokazuje dokładnie dzisiejsze użycia, czyli charakteryzuje stan przed dotknięciem
`useRoomState.ts`.

### Changes Required:

#### 1. Reguła w konfiguracji lintu

**File**: `eslint.config.js`

**Intent**: Mechaniczny strażnik zasady z `AGENTS.md` (Hard Rules: nigdy nie utrwalać pary głosujący–cel) po stronie
przeglądarki, tam gdzie S-04 może kusić zapamiętaniem głosu.

**Contract**:

- Nowy blok konfiguracji z komentarzem „dlaczego”, `files`: `src/**/*.{ts,tsx,astro}` (bez plików wirtualnych
  `*.astro/*.{js,ts}`, Critical Implementation Details).
- `no-restricted-globals`: `localStorage`, `sessionStorage`, `indexedDB`, `cookieStore`.
- `no-restricted-properties`: te same nazwy na `window`, `globalThis` i `self` oraz `document.cookie`.
- Poziom `warn`. Komunikat po angielsku: zasada anonimowości z `AGENTS.md` i jedyny dozwolony wyjątek (znacznik
  przeładowania w `useRoomState.ts`).

### Success Criteria:

#### Automated Verification:

- `npm run lint` kończy się kodem 0
- `npx eslint src` zgłasza dokładnie 3 ostrzeżenia nowych reguł, w `src/components/room/useRoomState.ts:99,100,110`, i żadnych innych
- `npm test`, `npx astro check`, `npm run build` przechodzą

#### Manual Verification:

- Karol czyta komunikat reguły: mówi, czego nie wolno, dlaczego i gdzie jest jedyny wyjątek

**Implementation Note**: Po fazie 2 reguła jeszcze niczego nie blokuje; egzekwowanie włącza dopiero faza 3. Bez push.

---

## Faza 3: Reguła D7 jako błąd (egzekwowanie)

### Overview

Trzy linie znacznika przeładowania dostają wyjątek z powodem, a reguła przechodzi z ostrzeżenia na błąd. Od tej chwili
każdy nowy zapis w przeglądarce w `src` zatrzymuje agenta w chwili edycji, `npm run lint` i CI.

### Changes Required:

#### 1. Wyjątek przy znaczniku przeładowania

**File**: `src/components/room/useRoomState.ts` (`:99`, `:100`, `:110`)

**Intent**: Jedyne dozwolone użycie jest jawne przy samym kodzie; każde nowe, także w tym pliku, świeci.

**Contract**: nad każdą z 3 linii komentarz `// eslint-disable-next-line no-restricted-properties -- <powód>`: tylko
znacznik przeładowania, bez danych głosu, z odesłaniem do zasady w `AGENTS.md`. Wyłącznie linie komentarza, zero zmian
w działaniu.

#### 2. Egzekwowanie

**File**: `eslint.config.js`

**Intent**: Włączenie blokady osobnym, odwracalnym krokiem.

**Contract**: poziom reguł z fazy 2: `warn` → `error`.

#### 3. Plan testów

**File**: `context/foundation/test-plan.md` §6.3

**Intent**: Warstwa anonimowości w przeglądarce opisana obok dwóch warstw bazy.

**Contract**: jeden punkt w §6.3: reguła ESLint (lokalnie, hooki, CI), jedyny wyjątek, jak dodać nowy, gdyby kiedyś był
konieczny (decyzja właściciela), i znana luka: skrypty `<script>` w `.astro` poza zasięgiem lintu (osobna zmiana).

### Success Criteria:

#### Automated Verification:

- `npm run lint` kończy się kodem 0, `npx eslint src` bez ostrzeżeń i błędów
- `git diff main -- src/components/room/useRoomState.ts` dodaje wyłącznie linie komentarza
- `npm test`, `npm run test:hooks`, `npx astro check`, `npm run build` przechodzą

#### Manual Verification:

- Próbny alarm (lokalnie, bez commita): `localStorage.setItem` w `src/components/room/RoundVoting.tsx`, odczyt `document.cookie` w `src/components/room/JoinForm.tsx` i czwarte `window.sessionStorage.setItem` w `useRoomState.ts` bez komentarza dają po jednym błędzie lintu każde; po cofnięciu `git diff -- src` pokazuje tylko komentarze z tej fazy
- Karol czyta diff `useRoomState.ts` (`git diff main -- src/components/room/useRoomState.ts`) i potwierdza, że to same komentarze

**Implementation Note**: Bez push; pierwszy push gałęzi dopiero w fazie 4.

---

## Faza 4: Krok smoke „Odsłoń wynik” (K1)

### Overview

Smoke dostaje krok, w którym host naciska „Odsłoń wynik” przez Workera. To jedyny test, który prowadzi tę akcję przez
trasę, `server.ts` i prawdziwą bazę: w CI na lokalnym Supabase, a po wdrożeniu na produkcji. Faza kończy się pierwszym
push gałęzi i PR, więc CI sprawdza naraz wszystkie cztery fazy.

### Changes Required:

#### 1. Krok rundy

**File**: `scripts/smoke.mjs` (`roundSteps()`, `:264-288`)

**Intent**: Pokrycie ścieżki Workera dla „Odsłoń wynik” bez zmiany scenariusza rundy i oczekiwanych liczb.

**Contract**: nowy krok po „room state shows the reveal with the votes' counts”: `act("reveal", {}, hostJar)`,
oczekiwanie `{ status: 200, body: ACCEPTED }`. Nazwa kroku nie mówi nic o głosach (`test-plan.md` §6.5). Komentarz nad
`roundSteps()` wspomina, że drugie odsłonięcie niczego nie zmienia (`first_live_round.sql:721`). Krok podlega
`SMOKE_ROUND=0` jak reszta rundy.

#### 2. Wzór w planie testów

**File**: `context/foundation/test-plan.md` §6.5

**Intent**: Zapis, skąd w smoke bierze się „Odsłoń wynik” i dlaczego po automatycznej odsłonie.

**Contract**: jeden punkt w §6.5.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- CI na PR (po push gałęzi i otwarciu PR, za zgodą) zielone we wszystkich jobach (`ci`, `smoke`, `db`, `e2e`); `smoke` ma 54 kroki, w tym nowy krok

#### Manual Verification:

- Próbny alarm w CI (`test-plan.md` §6.2): tymczasowy commit z literówką w `"reveal_round"` (`server.ts:261`), push (pytanie); czerwone dokładnie przypadek „Odsłoń wynik” w teście bramy (job `ci`) i nowy krok smoke, `db` i `e2e` zielone; potem `git revert`, push, CI zielone
- Karol widzi nowy krok w logu joba `smoke` na PR

**Implementation Note**: Push, otwarcie PR i każdy ruch na zdalnej gałęzi tylko za zgodą Karola. Scalenie PR wyłącznie
przez Karola; smoke na produkcji po wdrożeniu tylko za zgodą.

---

## Testing Strategy

### Unit Tests:

- Test bramy: 12 przypadków (10 akcji, głos bez numeru pytania, stan pokoju bez tokenu gracza), nazwa, dokładne argumenty
  z wartownikami, zgodność z sygnaturą SQL, brak opcji `rpc` (POST), wynik `ok: true`.

### Integration Tests:

- Smoke w CI (lokalny Supabase) i na produkcji: „Odsłoń wynik” przez trasę Workera, 54 kroki.
- Bez zmian w `tests/db` i `tests/e2e`; CI PR uruchamia je w całości jako kontrolę regresji.

### Manual Testing Steps:

1. Próbne alarmy A i B z fazy 1 (lokalnie).
2. Próbny alarm lintu z fazy 3 (trzy formy: `localStorage` i `document.cookie` w dwóch plikach `.tsx`, czwarte użycie w
   pliku z wyjątkiem).
3. Próbny alarm w CI z fazy 4 (tymczasowy commit i revert, push za zgodą).
4. Karol: lista 12 nazw testów, komunikat reguły, diff `useRoomState.ts`, nowy krok w logu smoke.

## Performance Considerations

Brak: jeden plik testu unit (milisekundy), jeden krok smoke, dwie reguły ESLint z rdzenia.

## Migration Notes

Bez migracji i bez zmian bazy. Wdrożenie po scaleniu niesie tylko komentarze w `useRoomState.ts`; cofnięcie to
`git revert` commita fazy.

## References

- Research (z weryfikacją W1–W26): `context/changes/refactor-opportunities/research.md`
- Wejście: `context/changes/guest-vote-flow-analysis/research.md` (D1, D7)
- Brama RPC: `src/lib/rooms/server.ts:82-98,111-304`
- Wzór ręcznej wyroczni: `tests/unit/room-errors.test.ts:17-32`
- Wzór zakazu w ESLint: `eslint.config.js:94-109`
- Smoke, kroki rundy: `scripts/smoke.mjs:264-288`; zasady kroków: `context/foundation/test-plan.md` §6.5
- Znacznik przeładowania: `src/components/room/useRoomState.ts:51,94-114`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test bramy RPC (K1)

#### Automated

- [x] 1.1 `npx vitest run --project unit tests/unit/room-rpc-gate.test.ts`: 12 testów zielonych — 6827aaa
- [x] 1.2 `npm test`, `npm run lint`, `npx astro check`, `npm run build` przechodzą — 6827aaa
- [x] 1.3 `git diff main --stat -- src` pusty (kod gry bez zmian) — 6827aaa

#### Manual

- [ ] 1.4 Próbny alarm A (lokalnie, bez commita): `"reveal_round"` → `"reveal_rounds"` w `server.ts:261` daje czerwony dokładnie przypadek „Odsłoń wynik”; po cofnięciu `git diff -- src` pusty
- [ ] 1.5 Próbny alarm B (lokalnie, bez commita): zamienione wartości `p_nick` i `p_link_token` w `createRoom` dają czerwony dokładnie przypadek „Załóż grę”; po cofnięciu `git diff -- src` pusty
- [ ] 1.6 Karol czyta listę 12 nazw testów i potwierdza, że jest tam każda akcja gry

### Phase 2: Reguła D7 jako ostrzeżenie (mechanizm)

#### Automated

- [ ] 2.1 `npm run lint` kończy się kodem 0
- [ ] 2.2 `npx eslint src` zgłasza dokładnie 3 ostrzeżenia nowych reguł, w `src/components/room/useRoomState.ts:99,100,110`, i żadnych innych
- [ ] 2.3 `npm test`, `npx astro check`, `npm run build` przechodzą

#### Manual

- [ ] 2.4 Karol czyta komunikat reguły: mówi, czego nie wolno, dlaczego i gdzie jest jedyny wyjątek

### Phase 3: Reguła D7 jako błąd (egzekwowanie)

#### Automated

- [ ] 3.1 `npm run lint` kończy się kodem 0, `npx eslint src` bez ostrzeżeń i błędów
- [ ] 3.2 `git diff main -- src/components/room/useRoomState.ts` dodaje wyłącznie linie komentarza
- [ ] 3.3 `npm test`, `npm run test:hooks`, `npx astro check`, `npm run build` przechodzą

#### Manual

- [ ] 3.4 Próbny alarm (lokalnie, bez commita): `localStorage.setItem` w `src/components/room/RoundVoting.tsx`, odczyt `document.cookie` w `src/components/room/JoinForm.tsx` i czwarte `window.sessionStorage.setItem` w `useRoomState.ts` bez komentarza dają po jednym błędzie lintu każde; po cofnięciu `git diff -- src` pokazuje tylko komentarze z tej fazy
- [ ] 3.5 Karol czyta diff `useRoomState.ts` (`git diff main -- src/components/room/useRoomState.ts`) i potwierdza, że to same komentarze

### Phase 4: Krok smoke „Odsłoń wynik” (K1)

#### Automated

- [ ] 4.1 `npm run lint` przechodzi
- [ ] 4.2 CI na PR (po push gałęzi i otwarciu PR, za zgodą) zielone we wszystkich jobach (`ci`, `smoke`, `db`, `e2e`); `smoke` ma 54 kroki, w tym nowy krok

#### Manual

- [ ] 4.3 Próbny alarm w CI (`test-plan.md` §6.2): tymczasowy commit z literówką w `"reveal_round"` (`server.ts:261`), push (pytanie); czerwone dokładnie przypadek „Odsłoń wynik” w teście bramy (job `ci`) i nowy krok smoke, `db` i `e2e` zielone; potem `git revert`, push, CI zielone
- [ ] 4.4 Karol widzi nowy krok w logu joba `smoke` na PR
