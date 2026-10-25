---
date: 2026-10-25T09:55:38+01:00
researcher: Claude (Opus 5.5) z Karolem
git_commit: e87003c
branch: remembered-nick
repository: most-likely-to
topic: "S-14 / FR-024: gdzie gra przyjmuje nick i jak bezpiecznie podpowiadać ostatni nick z przeglądarki"
tags: [research, codebase, remembered-nick, JoinForm, NewGameForm, localStorage, D7]
status: complete
last_updated: 2026-10-25
last_updated_by: Claude (Opus 5.5)
---

# Research: zapamiętany nick (S-14, FR-024)

**Date**: 2026-10-25T09:55:38+01:00
**Researcher**: Claude (Opus 5.5) z Karolem
**Git Commit**: e87003c (`origin/main`; PRD i roadmapa z FR-024/S-14 niescommitowane na gałęzi)
**Branch**: remembered-nick
**Repository**: most-likely-to

## Research Question

Gdzie gracz wpisuje nick, skąd formularz bierze dziś wartość początkową i co (kod, testy, wcześniejsze decyzje,
zasada anonimowości, planowana reguła D7) ogranicza podpowiadanie ostatniego nicku z pamięci przeglądarki
(FR-024: „ta sama przeglądarka podpowiada nick użyty ostatnio przy wejściu do pokoju i przy nowej grze; można go
zmienić przed wejściem”).

## Summary

- W `src/` są dokładnie dwa komponenty z polem nicku: `JoinForm.tsx` (gość w poczekalni i spóźniony, 3 warianty)
  i `NewGameForm.tsx` (host). Oba trzymają nick w `useState`, startują od `""` w SSR i wysyłają go zwykłym POST-em
  formularza (`JoinForm.tsx:59,79`; `NewGameForm.tsx:64,114`).
- Wyjątek: wariant `request-again` (po „Odrzuć”) dostaje nick z serwera przez `initialNick`
  (`src/pages/j/[token].astro:99-105`, `JoinForm.tsx:59`).
- Dziś nic po stronie przeglądarki nie pamięta nicku. Jedyne użycie pamięci przeglądarki w `src/` to 3 linie
  `sessionStorage` znacznika przeładowania w `useRoomState.ts:99,100,110` (grep po `localStorage|sessionStorage|
document.cookie|indexedDB` w `src/`). Ciasteczko gracza jest `httpOnly`, per pokój, 24 h (`tokens.ts:13,31-45`),
  więc JS go nie czyta, a w nowym pokoju formularz zawsze jest pusty.
- Serwer normalizuje nick w bazie (`private.normalize_nick`, `20261014101922_first_live_round.sql:60-84`), a ekran
  pokoju ma potwierdzony nick w `view.me` dla hosta i gościa (`shared.ts:87-90`). To naturalne źródło „ostatniego
  nicku”, który baza przyjęła.
- Obecne testy nie powinny się zepsuć: każdy krok E2E czyści pole przed wpisaniem (`tests/e2e/support/room.ts:69-70`,
  `latecomer.spec.ts:40-41`), każdy gracz ma osobny kontekst z pustą pamięcią (`room.ts:57-61`), host nigdy nie
  używa formularza „Nowa gra” przez ekran (`room.ts:30-37`), a żaden test nie sprawdza pustego pola ani licznika.
- Główna kolizja: planowana reguła D7 (`refactor-opportunities/plan.md:196-201`) zabrania w `src/**/*.{ts,tsx,astro}`
  każdego `localStorage`/`sessionStorage`/`indexedDB`/`cookieStore`/`document.cookie` poza znacznikiem przeładowania.
  D7 nie istnieje jeszcze w `eslint.config.js` (fazy 2–4 nieodhaczone, `plan.md:375-411`), więc S-14 przejdzie lint,
  ale plan D7 trzeba będzie poprawić (liczba ostrzeżeń, komunikat, próbny alarm w `JoinForm.tsx`).

## Detailed Findings

### Pola nicku i ich przepływ

- `JoinForm.tsx` — wyspa `client:load` montowana 3 razy w `src/pages/j/[token].astro`: `:85` `join` (poczekalnia),
  `:94` `request` (gra trwa, S-08), `:99-105` `request-again` z `initialNick={page.rejectedNick}`.
  - Stan: `useState(preview?.nick ?? initialNick ?? "")` (`JoinForm.tsx:59`).
  - Wysyłka: `<form method="POST" action="/api/rooms/join">` (`:79`), `name="nick"` (`:84`); `handleSubmit`
    (`:64-76`) tylko waliduje i przy błędzie robi `preventDefault`.
  - Serwer (`src/pages/api/rooms/join.ts`): gracz już w środku → 302 `/r/<id>` (`:39-44`); gra trwa → prośba,
    ciasteczko, 303 `/j/<link>` (`:51-60`); poczekalnia → `joinRoom`, ciasteczko, 302 `/r/<id>` (`:65-78`); każdy błąd
    → `/j/<link>?error=<code>` (`:24`), bez nicku w adresie.
- `NewGameForm.tsx` — wyspa `client:load` w `src/pages/index.astro:48`, tylko dla zalogowanego hosta.
  - Stan: `useState(preview?.nick ?? "")` (`NewGameForm.tsx:64`).
  - Wysyłka: POST `/api/rooms` (`:114`); błąd → `/?error=<code>`, sukces → 302 `/r/<id>`
    (`src/pages/api/rooms/index.ts:27,35,46,53`).
- Oba używają wspólnego `FormField` (`src/components/auth/FormField.tsx:41-53`), kontrolowany `<input>` bez
  `autoComplete`.
- `JoinWaiting.tsx` (spóźniony czeka) pokazuje nick z serwera jako tekst, bez pola (`[token].astro:109`).

### Walidacja nicku

- Klient: `NICK_MAX_LENGTH = 20` (`shared.ts:4`), `nickLength()` liczy po NFC i zwinięciu spacji (`shared.ts:350-352`);
  te same dwa komunikaty w obu formularzach (`JoinForm.tsx:51-56`, `NewGameForm.tsx:49-61`). Klient wysyła surowy
  tekst, bez przycinania.
- Worker: brak reguł („The nick rule lives in the database”, `join.ts:17`, `index.ts:20`).
- Baza: `normalize_nick` i `nick_key` (`first_live_round.sql:60-99`), unikalność `(room_id, nick_key)` (`:103-107`);
  odmowy `invalid_nick`, `nick_taken` (`:351-371`), dla spóźnionych także `nick_taken` wobec oczekujących próśb
  (`20261022132240_latecomer_admission.sql:150-177`). Zapisany nick jest znormalizowany, więc `view.me` może się różnić
  od wpisanego tekstu (spacje, znaki niewidoczne).
- Tekst `nick_taken` (`src/lib/rooms/errors.ts:39-40`): „…Jeśli to ty, a telefon cię nie pamięta…, wpisz inny nick.”

### Wartość początkowa i hydratacja

- SSR i pierwszy render dają `""` w wariantach `join`, `request` i w `NewGameForm` (brak propsa z nickiem); tylko
  `request-again` ma nick z serwera (`[token].astro:58,103`).
- Po przekierowaniu z `?error=` wpisany nick przepada i pole wraca puste (poza `request-again`).
- Tekst wpisany przed hydratacją jest gubiony (komentarz `tests/e2e/support/room.ts:63-64`).
- Wniosek: odczyt z pamięci przeglądarki w `useState` inicjalizatorze rozjechałby się z SSR; bezpieczny jest odczyt
  w efekcie po zamontowaniu, ustawiany tylko wtedy, gdy pole jest jeszcze puste (żeby nie nadpisać szybkiego pisania).

### Pamięć przeglądarki dziś i reguła D7

- `useRoomState.ts:99,100,110`: `sessionStorage` z kluczem `mlt-room-reloaded:<roomId>` (`:51`), w try/catch, błąd do
  `logEvent` z `{op, roomId, step, errName}` (`:94-114`). To wzór obsługi zablokowanej pamięci.
- D7 (`refactor-opportunities/plan.md:196-201`): `no-restricted-globals` i `no-restricted-properties` na
  `localStorage`, `sessionStorage`, `indexedDB`, `cookieStore`, `document.cookie`, pliki `src/**/*.{ts,tsx,astro}`;
  wyjątki jako komentarze `eslint-disable-next-line … -- <powód>` (`plan.md:234-236`); faza 2 oczekuje „dokładnie
  3 ostrzeżeń” (`plan.md:208`, Progress 2.2 `:380`); próbny alarm fazy 3 wstawia `document.cookie` do `JoinForm.tsx`
  (`plan.md:265`). `plan-brief.md:95`: nowa potrzeba zapisu w przeglądarce wymaga decyzji właściciela i wyjątku
  z powodem.
- `eslint.config.js` ma dziś tylko zakaz importów w testach (`:98`) i `no-console` jako `warn` (`:25`); żadnej reguły
  pamięci przeglądarki.
- Wniosek: przy jednym małym module z dostępem do `localStorage` wyjątek D7 to 1–2 opisane linie w jednym pliku.
  Gołe `localStorage.getItem` uruchamia `no-restricted-globals`, a nie `no-restricted-properties` z szablonu planu D7.

### Testy

- E2E: nick tylko przez `.fill()` po `.fill("")` (`room.ts:65-75`, `latecomer.spec.ts:36-45`); goście przez
  `newGuestContext` z pustym `storageState` (`room.ts:57-61`); host z zapisanej sesji, która powstaje przed jakimkolwiek
  formularzem nicku (`auth.setup.ts:29`, `playwright.config.ts:32-33,44-46`); testy szeregowo (`playwright.config.ts:19-20`).
- Brak asercji na puste pole, placeholder `np. Ola` czy licznik `x/20` (licznik ma `aria-hidden`, `JoinForm.tsx:96-104`).
- Unit: trzy projekty Vitest, wszystkie `environment: "node"` (`vitest.config.ts:16-50`), unit tylko
  `tests/unit/**/*.test.ts`; brak `@testing-library/*`, `jsdom`, `happy-dom` w `package.json`; żaden komponent nie ma
  testu jednostkowego. Hook `related-tests` odpala `vitest related` po każdej edycji (`.claude/hooks/related-tests.mjs:8-11`).
- `test-plan.md` §6.1 (`:137-145`): wyrocznia z PRD/roadmapy/decyzji właściciela, `it.each`, przypadki brzegowe,
  bez polskich tekstów UI w asercjach. §6.4 (`:239-285`): E2E tylko w CI, kontekst na gościa, logowanie z ponowieniem,
  nicki z `uniqueNick`.
- `scripts/smoke.mjs` używa tylko `fetch` (`:61-83`, `:221-228`), nie wykonuje JS strony, więc pamięć przeglądarki go
  nie dotyczy.

### Podglądy `/dev/room-states`

- `NewGameForm` `new-default` (`room-states.astro:327`), `JoinForm` `join-default` (`:430`) i `join-request` (`:473`)
  pokazują puste pole; komentarz `:411` „Empty nick… because the nick never goes in a URL”.
- Wniosek: przy podpowiedzi także w trybie `preview` zapamiętany nick z przeglądarki dewelopera zmieniałby „puste”
  stany; AGENTS.md wymaga podglądu każdego nowego stanu pokoju.

## Code References

- `src/components/room/JoinForm.tsx:59` — stan nicku: `preview?.nick ?? initialNick ?? ""`
- `src/components/room/JoinForm.tsx:79-84` — POST `/api/rooms/join`, `name="nick"`
- `src/components/room/NewGameForm.tsx:64,114` — stan nicku i POST `/api/rooms`
- `src/pages/j/[token].astro:85,94,99-105` — trzy montowania `JoinForm`, `initialNick` z `rejectedNick`
- `src/pages/index.astro:48` — montowanie `NewGameForm`
- `src/lib/rooms/shared.ts:4,87-90,350-352` — limit 20, `LobbyState.me`, `nickLength`
- `src/components/room/RoomLobby.tsx:111` — „Jesteś w grze jako ${view.me}”
- `src/components/room/useRoomState.ts:51,94-114` — jedyny dzisiejszy zapis w przeglądarce, wzór try/catch + `logEvent`
- `src/lib/rooms/tokens.ts:13,31-45` — ciasteczko gracza `httpOnly`, per pokój, 24 h
- `src/lib/rooms/errors.ts:38-40` — teksty `invalid_nick` i `nick_taken`
- `src/lib/log.ts:13-27,52-55` — dozwolone pola logu, nicku nie ma
- `supabase/migrations/20261014101922_first_live_round.sql:60-107` — normalizacja i unikalność nicku
- `tests/e2e/support/room.ts:57-75` — kontekst gościa i `joinRoom` z `fill("")`
- `src/pages/dev/room-states.astro:327,411,430,473` — podglądy formularzy z pustym nickiem

## Architecture Insights

- Formularze nicku są natywnymi POST-ami z walidacją po stronie klienta tylko dla długości; prawdę o nicku trzyma baza.
  „Ostatni przyjęty nick” najprościej wziąć z `view.me` na ekranie pokoju (host i gość, `shared.ts:89`), a nie z pola
  formularza w chwili wysyłki, bo wtedy zapamiętany byłby też nick odrzucony (`nick_taken`, `invalid_nick`).
- Zablokowana pamięć przeglądarki (tryb prywatny, limit) ma już wzór: try/catch, zdarzenie przez `logEvent` bez danych
  gracza (`useRoomState.ts:94-114`, `log.ts:1-6`).
- Pomocnik w `src/lib/` z wstrzykiwaną pamięcią (obiekt z `getItem/setItem`) da się testować w środowisku `node` bez
  nowych zależności i złapie go hook `related-tests`; test komponentu wymagałby DOM i Testing Library (nowa zależność).

## Historical Context (from prior changes)

- `AGENTS.md:7` — twarda zasada: żadnej pary głosujący→cel w żadnej formie. Nick nie jest objęty; głos jest.
- `context/archive/2026-10-13-first-live-round/plan.md:73` — własny wybór gracza żyje tylko w pamięci ekranu, „bez
  zapisu w telefonie”; potwierdzone w `reviews/impl-review.md:68`. Wspierane (stan kodu: `guest-vote-flow-analysis/
research.md:164-171`).
- `context/archive/2026-10-07-room-lobby/plan.md:99,393` — „Nick nigdy w adresie ani w logach”. Wspierane w kodzie
  (`JoinForm.tsx:24,28`, `join.ts:14`, `index.ts:13`). Podpowiedź może więc pochodzić tylko z pamięci przeglądarki,
  nie z `?nick=`.
- `context/archive/2026-10-22-latecomer-admission/plan.md:243` — `initialNick` dla `request-again`. Wspierane.
- `roadmap.md:162-163` (S-04) — pamiętanie głosu na urządzeniu to otwarta decyzja właściciela; moduł S-14 nie może stać
  się po cichu miejscem na głos.
- `context/foundation/shape-notes.md:28,32` — nick przypięty w przeglądarce „deferred to v2”. Zastąpione przez PRD
  FR-024 (decyzja hosta 2026-10-25); `shape-notes.md` nie był aktualizowany.
- `context/archive/2026-10-07-room-lobby/phone-test.md:38-39` — na Androidzie Discord otwiera linki w Chrome Custom Tab
  ze wspólnymi ciasteczkami, na iOS przeglądarka Discorda trzyma je osobno od Safari. Dotyczy też `localStorage`:
  „ten sam telefon” w roadmapie znaczy w praktyce „ta sama przeglądarka” (jak w FR-024).

## Related Research

- `context/changes/refactor-opportunities/research.md` i `plan.md` — D7, kolejność z S-14.
- `context/changes/guest-vote-flow-analysis/research.md` — przepływ gościa od linku do głosu.
- `context/archive/2026-10-07-room-lobby/research.md:77` — wcześniejsze „v2” dla nicku w przeglądarce (zastąpione).

## Open Questions

Decyzje produktowe dla `/10x-plan` (właściciel: Karol):

1. **Kiedy zapamiętać nick:** po potwierdzeniu przez bazę (`view.me` na ekranie pokoju; dla spóźnionego po wpuszczeniu)
   czy już przy wysłaniu formularza (także nick odrzucony)?
2. **Jeden nick dla hosta i gościa:** wspólny klucz (host też jest graczem, `glossary.md:38`) czy osobne? Na wspólnym
   laptopie czy telewizorze podpowiedź trafi do następnej osoby; FR-024 pozwala ją zmienić.
3. **Po błędzie `nick_taken`:** podpowiadać zapamiętany nick czy zostawić puste pole jak dziś?
4. **Podglądy:** wyłączyć podpowiedź w trybie `preview` i dodać nowy stan „nick podpowiedziany” w `/dev/room-states`?
5. **Kolejność z D7:** S-14 teraz, a w `refactor-opportunities/plan.md` dopisek o nowym wyjątku (liczba ostrzeżeń,
   komunikat, próbny alarm poza `JoinForm.tsx`)?
6. **Test:** jednostkowy test pomocnika (wyrocznia: FR-024 i „tylko nick, nigdy głos”) wystarczy, czy też krok E2E
   (gość w drugim pokoju widzi swój nick w polu)?
