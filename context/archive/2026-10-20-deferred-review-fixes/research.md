---
date: 2026-10-20T21:31:59+02:00
researcher: Claude (Opus 5.5)
git_commit: eb7d2bee1d0b3bbc5fab518f339e1003fe9c6f64
branch: deferred-review-fixes
repository: CharlesOnTheWave/most-likely-to
topic: "deferred-review-fixes: co dokładnie zmienić w bazie, Workerze, ekranie i testach, żeby domknąć F2, F3, F4 i F5 z przeglądów S-02 i S-03"
tags:
  [
    research,
    deferred-review-fixes,
    f2,
    f3,
    f4,
    f5,
    cast-vote,
    reveal-round,
    open-next-round,
    room-errors,
    deploy-window,
  ]
status: complete
last_updated: 2026-10-20
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Korekta F5 przy planowaniu: nieaktualny ekran hosta dostaje round_over, nie no_questions; no_questions z next_round zostaje tylko przy questionsLeft === null"
---

# Research: odłożone poprawki z przeglądów (F2, F3, F4, F5)

**Date**: 2026-10-20T21:31:59+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: eb7d2bee1d0b3bbc5fab518f339e1003fe9c6f64
**Branch**: deferred-review-fixes
**Repository**: CharlesOnTheWave/most-likely-to

## Research Question

Punkt 1 kolejki przed wieczorem z ekipą (`change.md`, Notes): jeden PR z odłożonymi poprawkami.

- **F2:** numer pytania obowiązkowy przy głosie i przy „Odsłoń wynik”.
- **F4:** granica błędów w ekranie pokoju.
- **F5:** osobny kod i tekst, gdy pytania skończą się w trakcie gry.
- **F3:** limit długości listy kandydatów i test filtra formatu id.

Pytanie: gdzie dziś żyje każda z tych reguł, co dokładnie trzeba zmienić (baza, Worker, ekran, testy, smoke, dokumenty) i jakie są ograniczenia wdrożenia.

## Summary

- **F4 jest już zrobione.** Zrobiła je S-03, a kolejka o tym nie wie. Granica błędów `RoomErrorBoundary` (`src/components/room/RoomErrorBoundary.tsx:27-89`) owija ekran pokoju (`RoomScreen.tsx:221-223`), zgłasza `island_crash` (`RoomErrorBoundary.tsx:36-40`) i ma stan na `/dev/room-states` (`room-states.astro:1044-1050`). Weszła w `ba71ece` i `8e76b01` jako faza 4 S-03 (`context/archive/2026-10-15-full-game-evening/plan.md:360-366`). F6 z tego samego pliku follow-upów też jest w kodzie (`json-route.ts:72-76`). W tej zmianie zostają więc F2, F3 i F5.
- **F2 w bazie.** Potrzebna nowa migracja z dwiema funkcjami.
  - `cast_vote` przyjmuje głos bez numeru i wpisuje go do najnowszej rundy (`full_game_evening.sql:329`).
  - `reveal_round` w ogóle nie zna numeru (`first_live_round.sql:723`). Odsłonę pominiętej rundy kwituje `ok` bez zmiany stanu (`:763-767`).
  - Wzór już jest: `next_round` i `skip_round` odmawiają `round_over` przy `p_round is null or p_round <> v_number` (`full_game_evening.sql:119-122`, `:181-184`).
  - Ograniczenie Postgresa: `cast_vote` nie może po prostu stracić `default null` przy `p_round`, bo ten parametr stoi po `p_player_token text default null` (`:255-260`). Najprościej zostawić default i odmawiać `round_over` w ciele funkcji.
- **F2 w Workerze i na ekranie.**
  - Worker przepuszcza głos bez numeru: `bodyRound` zwraca wtedy `null` (`json-route.ts:109-116`), a `vote.ts` odmawia tylko przy `undefined` (`vote.ts:34-37`).
  - `reveal.ts` nie czyta treści żądania (`reveal.ts:11-25`). Ekran wysyła odsłonę jako `{}` (`RoomScreen.tsx:125`), choć `RoundVoting` zna numer (`round.number`, użyty przy głosie i pominięciu).
  - Odmowa `round_over` daje 409 i tekst „To pytanie już się zmieniło.” (`json-route.ts:118-124`, `errors.ts:41`), a potem ekran odświeża stan (`RoomScreen.tsx:115-118`). Tego nie trzeba zmieniać.
- **F2 w testach.** Głos bez numeru utrwalają `game-rules.test.ts:152-154` (wbrew `test-plan.md:172-174`), pomocnicy `tests/db/support/rounds.ts:96-115`, pgTAP `round_creator_view.test.sql:162-213` i smoke `scripts/smoke.mjs:272-274, :282`. Odsłonę bez numeru utrwalają `rounds.ts:113-115` i pgTAP `:162-166`. Pełna lista: niżej.
- **Okno wdrożenia F2.** Prawdziwe ekrany głosują z numerem od S-03 (`RoomScreen.tsx:124`). Okno między `db push` a scaleniem dotyka więc tylko przycisku „Odsłoń wynik”, a po scaleniu tylko tego przycisku na ekranach wczytanych przed wdrożeniem. Dokładne skutki opisuje sekcja „Okno wdrożenia F2” niżej. Plan agregatu proponuje trzy fazy (2a, 2b, 2c), z ostatnią co najmniej 13 h po wdrożeniu Workera (`context/domain/02-invariant-aggregate-refactor.md:627`). To wybór dla planu.
- **F3.**
  - `private.open_next_round` filtruje kandydatów wyrażeniem `~ '^[a-z0-9-]+-[0-9]{3}$'` (`full_game_evening.sql:50`) i nie ogranicza długości listy (`:38-73`).
  - Woła ją `next_round` (`:129-131`) i `skip_round` (`:199`). `skip_round` kasuje urnę i ustawia `skipped`, zanim wywoła pomocnika (`:195-199`).
  - Żaden test nie wysyła złego ani pustego (`null`) kandydata do `next_round` ani `skip_round`.
  - Żadna migracja nie ma górnego limitu tablicy. Precedens jest przy tekście: `char_length(p_nick) > 100` daje `invalid_nick` (`first_live_round.sql:243-246`).
- **F5.**
  - `next_round` zwraca `no_questions`, gdy kandydaci się skończą (`full_game_evening.sql:129-131`). Worker przekazuje ten kod bez zmian (`next.ts:38`), a ekran pokazuje tekst startowy „…Załóż nową grę z innymi kategoriami.” (`errors.ts:35`).
  - Host trafia na tę ścieżkę, gdy `questionsLeft` jest `null`, czyli gdy Worker nie odczytał kategorii (`server.ts:214-224`, `RoundReveal.tsx:232-233`). Nieaktualny ekran hosta dostaje wcześniej `round_over` (korekta niżej, „Follow-up 2026-10-20”).
  - Po odmowie ekran odświeża stan. Przy czytelnych kategoriach `questionsLeft` staje się wtedy `false`, a `HostActions` pokazuje notkę „Pytania z wybranych kategorii się skończyły.” (`HostActions.tsx:56-65`) obok błędu (`:190`). Jeśli nowy tekst błędu będzie tym samym zdaniem, host zobaczy je dwa razy.

## Detailed Findings

### F4: granica błędów (zrobiona w S-03)

- Komponent klasowy `RoomErrorBoundary`.
  - `getDerivedStateFromError` przełącza go na ekran „Coś się popsuło — odśwież stronę.” z przyciskiem odświeżenia (`RoomErrorBoundary.tsx:32-34, 54-88`).
  - `componentDidCatch` loguje w konsoli `island_crash` z nazwą błędu (`:38`). Poza podglądem wysyła też `reportClientEvent({ event: "island_crash", roomId })` (`:39`).
- Wejście dla zgłoszeń: `island_crash` jest na liście `CLIENT_EVENTS` (`src/lib/client-events.ts:8`), a serwer loguje je jako `error` (`src/pages/api/client-events.ts:27`).
- Testy jednostkowe zgłoszenia są w `tests/unit/client-events.test.ts:24-26, 59-64`. Podgląd celowo się wysypuje (`RoomScreen.tsx:43-47, 211`). Stan „evening-crash” jest w `room-states.astro:1044-1050`.
- Historia: plan S-03 wziął F4 i F6 w zakres (`full-game-evening/plan.md:7, :32`, faza 4 `:360-366`). Kolejka na pulpicie i notatka `first-live-round/follow-ups/review-fixes.md` mówią „na później”. Ta notatka jest nieaktualna co do F4 i F6, a nadal aktualna co do F7 (czytnik ekranu: wymaga ręcznego sprawdzenia, nie kodu).

### F2: baza danych

**`public.cast_vote`**: najnowsza wersja w `supabase/migrations/20261015122252_full_game_evening.sql:255-392`.

- Sygnatura: `(p_room_id uuid, p_target text, p_player_token text default null, p_round integer default null)` (`:255-260`). `security definer`, `set search_path = ''`. Właściciel `postgres` (`:527`). Revoke od public, anon i authenticated (`:536`), grant dla `anon, authenticated` (`:542`).
- Kolejność sprawdzeń:
  - zamknięty pokój: `room_closed` (`:310-312`);
  - poczekalnia: `no_round` (`:314-316`);
  - **`if p_round is not null and p_round <> v_number`**: `round_over` (`:329-331`), więc brak numeru przechodzi dalej;
  - `revealed`: `round_revealed` (`:333-335`);
  - inna faza niż `voting`: `round_over` (`:337-340`).
- Dziś istnieje jedna wersja. S-03 zrobiła `drop function public.cast_vote(uuid, text, text)` i `create` w jednej migracji (`:246-248`), z komentarzem „One version only (T1)”. Pilnuje tego pgTAP `round_creator_view.test.sql:586-596`.
- Nagłówek migracji o wdrożeniu (`:19-21`): „this migration ships before the Worker that uses it … cast_vote still takes the old Worker's arguments (p_round defaults to null)”.
- **Ograniczenie Postgresa** (zachowanie silnika, nie dokument repo): po parametrze z wartością domyślną każdy następny parametr wejściowy też musi ją mieć. `p_round` nie może więc stracić `default null`, dopóki stoi po `p_player_token text default null`. Usunięcie defaultu wymagałoby innej kolejności parametrów albo zdjęcia defaultu z `p_player_token`. W obu przypadkach potrzebne byłoby `drop` i `create`, bo `create or replace` nie usuwa defaultu. Wywołanie bez `p_round` dostałoby wtedy od PostgREST `PGRST202` zamiast nazwanej odmowy. Plan agregatu wybiera wariant „default zostaje, `null` daje odmowę” (`02-invariant-aggregate-refactor.md:627`).

**`public.reveal_round`**: jedyna definicja w `supabase/migrations/20261014101922_first_live_round.sql:723-769`. S-03 jej nie zmieniła.

- Sygnatura: `(p_room_id uuid)`. Definer, pusty `search_path` (`:726-727`). Właściciel (`:780`), revoke (`:794`), grant tylko dla `authenticated` (`:805`).
- Kolejność sprawdzeń:
  - blokada wiersza pokoju (`:736-740`);
  - nie host: `room_unknown` (`:742-745`);
  - zamknięty: `room_closed` (`:747-749`);
  - brak najnowszej rundy albo poczekalnia: `no_round` (`:751-761`);
  - `finish_round` tylko w fazie `voting` (`:763-765`);
  - w każdym innym przypadku `ok` (`:767`).
- Zamierzone (D3, komentarz `:721-722`): druga odsłona odsłoniętej rundy daje `ok`.
- Niezamierzone (opis w `02-invariant-aggregate-refactor.md`, §3.3): odsłona rundy `skipped` też daje `ok` bez zmiany stanu.
- Zmiana listy argumentów bez `drop` zostawiłaby drugą wersję obok. Dziś nie ma testu pgTAP „jedna wersja `reveal_round`” ani `function_facts` dla tej funkcji. Te sprawdzenia w `round_creator_view.test.sql:560-584` obejmują start, next, skip, end i cast_vote.

**Wzór do skopiowania**: `next_round` (`full_game_evening.sql:119-122`) i `skip_round` (`:181-184`) mają `p_round integer` bez defaultu. Odmawiają `round_over` przy `p_round is null or p_round <> v_number`.

### F2: Worker

- `bodyRound(body)` (`src/lib/rooms/json-route.ts:112-116`) zwraca:
  - `null`, gdy treść nie ma klucza `round` albo nie jest obiektem;
  - `undefined`, gdy wartość nie jest liczbą całkowitą od 1 do `MAX_ROUND`;
  - w pozostałych przypadkach liczbę.
- Komentarz `:109-111`: „a screen loaded before S-03 votes without one … next and skip need one; a vote takes either”.
- `vote.ts:34-37` odmawia `invalid_body` (400) tylko przy `undefined`, więc `null` idzie dalej do `castVote` (`:47`). Komentarz `vote.ts:21-23` mówi o ekranie sprzed S-03.
- `next.ts:25-26` i `skip.ts:24-25` odmawiają `invalid_body` przy `typeof round !== "number"`.
- `reveal.ts:11-25` nie woła `readJsonBody` ani `bodyRound`, tylko `revealRound(supabase, roomId)` (`:22`).
- `server.ts`:
  - `castVote(supabase, roomId, target, playerToken, round: number | null)` pomija `p_round` przy `null` (`:243-257`, komentarz `:241-242`);
  - `revealRound(supabase, roomId)` wysyła samo `{ p_room_id }` (`:260-263`);
  - jedynymi wywołującymi w `src/` są te trasy (`vote.ts:47`, `reveal.ts:22`).
- Mapowanie odmów: `statusFor` (`json-route.ts:118-124`) daje `room_unknown` 404, `invalid_body` 400, `service_unavailable` 503, `unexpected` 500, a każdy inny kod 409. Odmowa z bazy przechodzi bez zmian jako `reason` (`server.ts:107-109`).

### F2: ekran

- `RoomScreen.tsx`:
  - głos: `act("vote", { target, round })` (`:124`);
  - **odsłona: `act("reveal", {})` (`:125`)**;
  - następne i pominięcie wysyłają `{ round }` (`:126-127`);
  - `act` po każdej odpowiedzi, przyjętej albo odrzuconej, woła `refresh()` (`:115-118`).
- `RoundVoting.tsx`:
  - typ propa: `onReveal: () => Promise<ActionOutcome>` (`:43`);
  - komentarz `:40-41` mówi, że numer idzie „with the vote, the skip and nothing else”;
  - przycisk: `run: onReveal` (`:283`), a `round.number` jest już w propsach (`:108`, `:292`).
- `room-actions.ts:6-7` wymienia jako niosące `{round}` tylko vote, next i skip.
- Odmowa trafia do `roomErrorMessage(code)` (`room-actions.ts:25-27, 51`). `HostActions.run` wstawia ten tekst do `ServerError` (`HostActions.tsx:100-108, 190`). Gdy odświeżony stan ma inny numer albo fazę, widok się przemontowuje, bo klucz to `round.number` (`RoomScreen.tsx:163, 180`), i błąd znika.
- Podglądy `/dev/room-states` i `/dev/room-window` przechodzą przez `preview`, który skraca `act` (`RoomScreen.tsx:113`), i nie podają `onReveal`. Zmiana sygnatury ich nie dotyka.
- E2E głosują przez UI (`tests/e2e/support/round.ts:27-34`), więc już z numerem. Żaden test E2E nie klika „Odsłoń wynik”: rundę odsłania ostatni głos (`round.spec.ts:49`, `game.spec.ts:70-71`).

### F2: testy, smoke i dokumenty, które utrwalają brak numeru

| Miejsce                                                                                                                                                                                      | Co robi dziś                                                                                           | Co po zmianie                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/db/game-rules.test.ts:98, 150-154`                                                                                                                                                    | głos bez numeru w rundzie 2 sprawdzany jako `{ok: true}` („as the Worker before S-03 sends it”)        | według `test-plan.md:172-174`: najpierw `it.fails("znana dziura F2 → deferred-review-fixes: …")` z wyrocznią `round_over`, po migracji znacznik zdjęty                                                                 |
| `game-rules.test.ts:128, 273`                                                                                                                                                                | głos bez numeru na pominiętą rundę, oczekiwane `round_over`                                            | wynik się nie zmienia; warto podać numer, żeby test sprawdzał fazę, a nie brak numeru                                                                                                                                  |
| `game-rules.test.ts:91-92, 116, 324`                                                                                                                                                         | `seedVote` i `seedReveal` bez numeru                                                                   | dostają numer rundy                                                                                                                                                                                                    |
| `tests/db/support/rounds.ts:18-26` (kontrakt w komentarzu), `:96-111` (`castVote`, `round?`), `:113-115` (`revealRound`), `:171`, `:179` (seedy)                                             | wywołania bez numeru „tak jak Worker sprzed S-03”                                                      | numer w seedach; probe bez numeru zostaje tylko do testu odmowy                                                                                                                                                        |
| `tests/db/round-rules.test.ts:85-99` (11 głosów bez numeru), `:204, 255, 259, 323` (odsłony), `:258, 317`                                                                                    | bez numeru                                                                                             | z numerem                                                                                                                                                                                                              |
| `round-rules.test.ts:213`                                                                                                                                                                    | anon woła `reveal_round` i ma dostać `42501` z nazwą funkcji w komunikacie                             | przy `reveal_round(p_room_id uuid, p_round integer default null)` wywołanie bez `p_round` nadal pasuje do funkcji; bez defaultu i bez `p_round` dostałby `PGRST202` (`first-live-round/research.md:152`, wg pomocnika) |
| `tests/db/round-anonymity.test.ts:100-102, 117-120`                                                                                                                                          | dokładne `{ok: true}` celowo bez numeru                                                                | z numerem                                                                                                                                                                                                              |
| `round-anonymity.test.ts:152, 183, 238, 284`                                                                                                                                                 | odsłona i seedy                                                                                        | z numerem                                                                                                                                                                                                              |
| pgTAP `supabase/tests/round_creator_view.test.sql:162-166` (`host_reveals`), `:193-213` (`guest_votes`, `host_votes`; komentarz `:193-194` „must keep working once cast_vote takes p_round”) | pomocnicy bez numeru; używani m.in. w `:605-608, 619, 633, 638, 663, 668, 694-702, 713, 723, 734, 740` | pomocnicy z numerem rundy; nowe `function_facts` i „jedna wersja” dla `reveal_round` (wzór `:580-596`); licznik `plan(105)` (`:24`) rośnie                                                                             |
| `scripts/smoke.mjs:272-274, 282`                                                                                                                                                             | głosy kroków S-02 bez numeru (głosy kroków S-03 mają numer: `:309, 314`)                               | z numerem; dziś smoke nie ma kroku odsłony                                                                                                                                                                             |
| `tests/unit/json-route.test.ts:96-98, 109-114`                                                                                                                                               | „gives null when the body has no round” plus komentarz „a vote … still counts”                         | zależnie od tego, czy `bodyRound` dalej rozróżnia `null` i `undefined`                                                                                                                                                 |
| `context/foundation/test-plan.md:163`                                                                                                                                                        | „`castVote(…, round?)` bez `round` woła `cast_vote` tak jak Worker sprzed S-03 (okno wdrożenia)”       | opis do poprawki                                                                                                                                                                                                       |
| `test-plan.md:172`                                                                                                                                                                           | „(F1 i F4 domknęła S-02; dziś żadnej)”                                                                 | dochodzi wpis o F2 (otwarta, potem domknięta)                                                                                                                                                                          |
| `test-plan.md:226, 287`                                                                                                                                                                      | jedna wersja `cast_vote`; smoke głosuje bez numeru, „żeby pilnować okna”                               | dochodzi `reveal_round`; zdanie o oknie do usunięcia                                                                                                                                                                   |

Konwencja znanej dziury: `test-plan.md:172-181`. Nazwa „znana dziura <F> → <zmiana>: ”. Warunki wstępne tylko w `beforeAll`, w pliku z `it.fails` bez `beforeEach`, asercje przez `toMatchObject`. `AGENTS.md` pisze `test.fails`, a `test-plan.md` pisze `it.fails`. W Vitest to aliasy, więc obie nazwy znaczą to samo. Testy bazy biegną tylko w CI (job `db`), więc czerwone „przed migracją” da się zobaczyć wyłącznie na pośrednim pushu gałęzi. Projekt tak już robił: „Testy bazy powstały przed migracją i świeciły na czerwono” (`test-plan.md:306`).

### F2: okno wdrożenia

- `context/deployment/deploy-plan.md` opisuje tylko `db push --dry-run`, `db push` i `migration list` (`:51`) oraz zakaz SQL w panelu i edycji wypchniętej migracji (`:52`). Kolejności „baza, potem kod” ani zmiany sygnatury nie opisuje.
- Kolejność opisuje plan S-03 (`context/archive/2026-10-15-full-game-evening/plan.md:82`): zielony PR → `db push` → smoke ze starym Workerem i `SMOKE_GAME=0` → scalenie → pełny smoke. Do tego zdanie „nigdy nie scalać przed `db push`”. `smoke.mjs:8, 25` obsługuje `SMOKE_GAME=0` i `SMOKE_ROUND=0`.
- Wniosek z kodu, niesprawdzony testem: skutki dla migracji, w której `cast_vote` i `reveal_round` odmawiają `round_over` przy braku numeru, a `reveal_round(p_room_id uuid, p_round integer default null)` ma default:
  - **Między `db push` a scaleniem** (stary Worker):
    - głos z ekranu ma numer (`RoomScreen.tsx:124`), a stary `castVote` go przekazuje (`server.ts:253`), więc działa;
    - „Odsłoń wynik” idzie bez numeru (`server.ts:261`) i dostaje 409 „To pytanie już się zmieniło.”;
    - rundę nadal odsłania ostatni głos (`full_game_evening.sql:381-388`, wg `02` §3.1).
  - **Bez defaultu w `reveal_round`**: odsłona starego Workera dostałaby w tym oknie `PGRST202`, a Worker odpowiedziałby błędem 5xx zamiast nazwanej odmowy.
  - **Po scaleniu** (nowy Worker, ekran wczytany przed wdrożeniem): odsłona `{}` dostaje 400 `invalid_body`. Tego kodu nie ma w `MESSAGES`, więc ekran pokazuje „Coś poszło nie tak. Spróbuj ponownie.” (`errors.ts:45-50`), dopóki ktoś nie odświeży strony.
- Plan agregatu proponuje wariant bez żadnego okna z odmową, w trzech fazach (`02-invariant-aggregate-refactor.md:627`):
  - 2a: `reveal_round` z `p_round default null`, a brak numeru działa jak dziś;
  - 2b: Worker i ekran wysyłają numer;
  - 2c: brak numeru daje `round_over`, co najmniej 13 h po 2b, bo gry sprzed 2b zamknie sprzątanie (`close_stale_games.sql:29`).

### F3: lista kandydatów

- `private.open_next_round(p_room_id uuid, p_number integer, p_candidates text[]) returns boolean` (`full_game_evening.sql:38-73`). Brak grantów (wg pomocnika `:532`).
  - Wybiera pierwszego kandydata w podanej kolejności (`unnest … with ordinality`, `order by c.position limit 1`, `:48-55`), który pasuje do `~ '^[a-z0-9-]+-[0-9]{3}$'` (`:50`) i nie był grany w tym pokoju (`:51-53`).
  - Kandydat `null` odpada, bo `null ~ …` daje `null`. Tablica `null` daje zero wierszy.
  - Gdy nikt nie pasuje, zwraca `false` i nic nie zapisuje (`:57-59`).
  - Komentarz `:33-37`: filtr jest „checked before the insert, so a repeat is never a 23505 with the row's values in DETAIL”. Według F3 z przeglądu (`full-game-evening/reviews/impl-review.md:86`, wg pomocnika) zły format wpadłby na CHECK `rounds.question_id` (23514, `first_live_round.sql:117`).
- Wywołujący (oba trzymają blokadę wiersza pokoju):
  - `next_round(p_room_id uuid, p_round integer, p_candidates text[])`: przy `false` odpowiada `no_questions` (`full_game_evening.sql:128-131`);
  - `skip_round` (ta sama sygnatura) najpierw kasuje urnę i ustawia `skipped` (`:195-197`), potem woła pomocnika przez `perform` i ignoruje wynik (`:199`), więc pominięcie ostatniego pytania daje `ok`.
- `start_game` nie korzysta z listy kandydatów. Bierze jedno `p_question_id`, a zły format daje `invalid_question` (`first_live_round.sql:572-574`, wg pomocnika).
- Worker: `next.ts:38` i `skip.ts:37` wysyłają `shuffledQuestions(room.selection, Math.random)` (`src/lib/rounds/draw.ts:53-70`, `poolFrom` `:25-33`).
  - Według pomocnika (zliczone grepem w `src/data/questions.ts`) baza ma 216 id, po 27 w każdej z 8 kategorii, więc gra ze wszystkimi kategoriami i 18+ wysyła najwyżej 216.
  - Format id to `<kategoria>-<NNN>` małymi literami (`server.ts:190`, wg pomocnika).
- Precedensy limitu:
  - tekst: `char_length(p_nick) > 100` daje `invalid_nick` (`first_live_round.sql:243-246`);
  - tablica tylko od dołu: `cardinality(p_categories) < 1` daje `invalid_categories` (`first_live_round.sql:254-258`, wg pomocnika);
  - górnego limitu tablicy nie ma w żadnej z 4 migracji.
  - Zniekształcone wejście od klienta wołającego bazę wprost już dziś kończy się wyjątkiem, a nie odmową-daną: `raise exception 'invalid player token' using errcode = '22023'` (`full_game_evening.sql:280`, `first_live_round.sql:323, 618`, `room_lobby.sql:219`). Ogólna reguła mówi jednak: „an expected refusal is data …, never an exception” (`full_game_evening.sql:15`).
- Testy:
  - `no_questions` po wyczerpaniu sprawdzają `game-rules.test.ts:239-241` i `:276-278`;
  - `invalid_question` sprawdzają tylko testy `start_game` (`round-rules.test.ts:335-343`);
  - żaden test Vitest ani pgTAP nie podaje do `next_round`/`skip_round` złego formatu ani `null` (wg pomocnika: pgTAP `:635, 643, 665, 736` ma same poprawne id);
  - pomocnicy `nextRound`/`skipRound` typują `candidates: string[]` (`rounds.ts:118-124`), więc test z `null` wymaga zmiany typu;
  - `call()` zwraca `{data, error}` i nie rzuca (`rounds.ts`, wg pomocnika `:85-98`).

### F5: pytania skończyły się w trakcie gry

- Zamknięta lista kodów `ROUND_REFUSALS` jest w `src/lib/rooms/errors.ts:7-18`, teksty w `MESSAGES` w `:22-43`. Dla `no_questions` tekst brzmi „W wybranych kategoriach nie ma pytań. Załóż nową grę z innymi kategoriami.” (`:35`). Nieznany kod dostaje tekst ogólny (`:45-50`).
- Skąd przychodzi `no_questions`:
  - start gry: Worker, gdy `drawQuestion` zwróci `null` (`start.ts:29-30`, wg pomocnika). Tekst startowy jest tu właściwy;
  - `next_round`, gdy nikt z kandydatów nie pasuje (`full_game_evening.sql:128-131`). Worker przekazuje kod bez zmian (`next.ts:38-40`);
  - `skip_round` nigdy go nie zwraca (`:199`).
- `hostQuestionsLeft` (`server.ts:214-224`) zwraca `null` w trzech przypadkach: gość, runda w `voting` albo nieczytelne kategorie. W pozostałych zwraca `questionPool(selection).length > round.number`. Komentarz `:207-213` mówi wprost, że przy `null` „the database answers no_questions if none is left”.
- Ekran:
  - `RoundReveal` pokazuje „Następne pytanie”, gdy wartość nie jest `false` (`RoundReveal.tsx:232-233`, wg pomocnika);
  - `RoundSkipped` pokazuje je tylko przy `true` (`RoundSkipped.tsx:40`);
  - `afterRoundActions(false, …)` daje tylko „Zakończ grę” i notkę „Pytania z wybranych kategorii się skończyły.” (`HostActions.tsx:56-65`).
- ~~Host widzi tekst `no_questions` po „Następne pytanie” w dwóch przypadkach: przy `questionsLeft === null` albo przy nieaktualnym `true`, np. na drugim ekranie hosta.~~ Zastąpione przez „Follow-up 2026-10-20” niżej.
- Po odmowie `refresh()` przelicza `questionsLeft` (`lobby.ts:42`, wg pomocnika). Przy czytelnych kategoriach wychodzi `false`, a widok ma ten sam klucz. `HostActions` zostaje więc zamontowany, a jego stan `error` (`HostActions.tsx:95, 100-108`) przetrwa obok notki (`:185, 190`).
- `tests/unit/room-errors.test.ts`:
  - ręczna lista `PLANNED_ROUND_REFUSALS` (`:21-32`) musi się zgadzać z `ROUND_REFUSALS` (`:70-72`);
  - każdy kod ma mieć własny tekst (`:51-56, 74-76`);
  - teksty `MESSAGES` mają się parami różnić (`:58-62`);
  - statusów test nie sprawdza.
- Nowy kod (propozycja F5: `questions_ran_out`) trafia do `ROUND_REFUSALS`, do `MESSAGES` i do ręcznej listy w teście. Status 409 dostaje sam (`json-route.ts:118-124`).
- Zmiana kodu w `next.ts` nie wymaga migracji. Testy bazy (`game-rules.test.ts:239-247, 276-278`) dalej sprawdzają `no_questions` z `next_round`.

## Code References

- `supabase/migrations/20261015122252_full_game_evening.sql:15`: reguła „expected refusal is data … never an exception”
- `full_game_evening.sql:19-21`: kolejność wdrożenia S-03 i stary Worker
- `full_game_evening.sql:38-73`: `private.open_next_round` (filtr formatu `:50`)
- `full_game_evening.sql:119-122, 128-131`: `next_round`: obowiązkowy numer, `no_questions`
- `full_game_evening.sql:181-184, 195-199`: `skip_round`: obowiązkowy numer, kasowanie urny przed `open_next_round`
- `full_game_evening.sql:246-260, 329-340`: `cast_vote`: jedna wersja, sygnatura, opcjonalny numer, faza
- `supabase/migrations/20261014101922_first_live_round.sql:721-769`: `reveal_round` bez numeru, `ok` dla `revealed` i `skipped`
- `first_live_round.sql:243-246`: precedens limitu długości (`invalid_nick`)
- `src/lib/rooms/json-route.ts:109-124`: `bodyRound`, `statusFor`
- `src/pages/api/rooms/[id]/vote.ts:21-23, 34-37, 47`; `reveal.ts:11-25`; `next.ts:25-26, 38`; `skip.ts:24-25, 37`
- `src/lib/rooms/server.ts:207-224` (`hostQuestionsLeft`), `:241-263` (`castVote`, `revealRound`)
- `src/lib/rooms/errors.ts:7-18, 22-50`: kody i teksty
- `src/components/room/RoomScreen.tsx:111-128`: `act`, `vote`, `reveal`, `next`, `skip`
- `src/components/room/RoundVoting.tsx:40-45, 108, 283, 292`: `onReveal` bez numeru
- `src/components/room/HostActions.tsx:56-65, 95-108, 185-190`: notka „Pytania … się skończyły.”, stan błędu
- `src/components/room/RoomErrorBoundary.tsx:27-89`: F4 (zrobione)
- `tests/db/game-rules.test.ts:150-154`: test utrwalający dziurę F2
- `tests/db/support/rounds.ts:18-26, 96-124`: kontrakt i pomocnicy bez numeru
- `supabase/tests/round_creator_view.test.sql:24, 162-213, 560-596`: licznik planu, pomocnicy, `function_facts` i „jedna wersja”
- `scripts/smoke.mjs:8, 25, 272-274, 282`: przełączniki i głosy bez numeru
- `context/foundation/test-plan.md:163, 172-181, 226, 287, 306`: zasady testów i opisy do poprawki

## Architecture Insights

- **Reguła N3 („ruch trafia w rundę, którą widzisz”)** jest wpisana osobno w każdą funkcję. F2 wyrównuje głos i odsłonę do wzoru `next_round`/`skip_round` (`p_round is null or p_round <> v_number` daje `round_over`) bez budowy agregatu. Agregat to fazy 3–5 w `02-invariant-aggregate-refactor.md:609-640`, poza tą zmianą.
- **Jedna wersja funkcji (T1).** Zmiana listy argumentów to zawsze `drop` i `create` w jednej migracji, a pgTAP pilnuje jednej wersji (`full_game_evening.sql:246-248`, `round_creator_view.test.sql:586-596`). `create or replace` z tą samą sygnaturą nie zmienia właściciela ani grantów (zachowanie Postgresa). Konwencja `AGENTS.md` (Conventions) i tak każe powtarzać revoke i grant przy każdej funkcji.
- **Odmowa to dana, nie wyjątek** (`full_game_evening.sql:15`). Wyjątek z `22023` jest używany tylko dla zniekształconego tokenu od klienta wołającego bazę wprost (`:280`).
- **Kody odmów to zamknięta lista ze stałym tekstem.** Kod spoza listy daje tekst ogólny, a test pilnuje, żeby lista zgadzała się z planami (`errors.ts:5-6`, `room-errors.test.ts:21-32`).
- **Ekran po każdej akcji odświeża stan** (`RoomScreen.tsx:115-118`), więc nieaktualny ekran sam dochodzi do prawdy po odmowie.

## Historical Context (from prior changes)

- `context/archive/2026-10-15-full-game-evening/follow-ups/review-fixes.md:5-20`: F2, F3 i F5 odłożone 15.10.
  - Twierdzenie F2 o stanie kodu: **potwierdzone**.
  - Uzasadnienie „okno wdrożenia dla ekranów sprzed S-03”: **już nieaktualne**. S-03 jest w repo od 15.10 (`ecb290d`, wg `02` §3.4), a gry sprzed niej zamknęło 12-godzinne sprzątanie.
  - Opis F3 i F5: **potwierdzony**. Liczba „216 id” jest zgodna z policzeniem pomocnika.
- `context/archive/2026-10-13-first-live-round/follow-ups/review-fixes.md`:
  - F4 i F6 „na później”: **sprzeczne z kodem**, oba weszły w S-03 (`full-game-evening/plan.md:7, 32, 360-366`; `json-route.ts:72-76`);
  - F7 (czytnik ekranu): **nadal otwarte**, to ręczne sprawdzenie na wieczorze.
- `context/archive/2026-10-15-full-game-evening/plan.md:82-83`: kolejność „baza, potem kod”, smoke ze starym Workerem przy `SMOKE_GAME=0` i ostrzeżenie, że dwie wersje funkcji mogą dać niejednoznaczne wywołanie w PostgREST.
- `context/domain/02-invariant-aggregate-refactor.md`:
  - §3.1–3.4: diagnoza F2 (wszystkie kotwice zgodne z kodem, sprawdzone przez pomocnika);
  - §5.2 faza 2 (`:627`): wariant trzyfazowy 2a/2b/2c;
  - §5.3: przypadki testowe I2 (głos bez numeru → `round_over`), I8 (odsłona ze starym numerem → `round_over`, następna runda nietknięta), I9 (odsłona pominiętej → `round_over`, decyzja 0.3), I15 (po odmowie stan bez zmian), L4 i L5 (odsłona z numerem, druga odsłona `ok`);
  - §5.6: decyzja 0.3 (rekomendacja: `round_over` dla odsłony pominiętej rundy).
- `context/changes/refactor-opportunities/plan.md`: strażnik nazw RPC (K1) jeszcze nie istnieje (`tests/unit/room-rpc-gate.test.ts` brak, Progress od `:354` nieodhaczony). Jego wyrocznia zapisuje dzisiejsze sygnatury (`:22-24`: `reveal_round(p_room_id)`, `cast_vote(… p_round default null)`), przypadek „`castVote` bez numeru pytania” (`:130, :311`) i krok smoke `act("reveal", {}, hostJar)` (`:273, :394`). Po F2 te miejsca są nieaktualne (wskazuje to też `02` `:640`).

## Related Research

- `context/archive/2026-10-15-full-game-evening/research.md`: S-03 (T1 „jedna wersja”, T2 filtr przed zapisem)
- `context/archive/2026-10-13-first-live-round/research.md`: S-02 (D3: odsłona w każdej chwili, druga odsłona `ok`)
- `context/domain/02-invariant-aggregate-refactor.md`: niezmiennik N3 i przypadki testowe
- `context/domain/domain-distillation.md`, `context/domain/glossary.md`: terminy („numer pytania” = `p_round`, `round`; „odsłona”; „pominięcie pytania”; „lista pytań gry” = `p_candidates`)

## Follow-up 2026-10-20 (planowanie): kiedy host naprawdę widzi `no_questions`

- `next_round` sprawdza numer przed kandydatami: `round_over` przy innym numerze (`full_game_evening.sql:119-122`), potem `round_in_progress` (`:124-126`), dopiero potem `no_questions` (`:128-131`). Nieaktualny ekran hosta ma inny numer rundy niż najnowsza, więc dostaje `round_over`, nie `no_questions`. Notatka F5 (`full-game-evening/follow-ups/review-fixes.md:17-20`, „albo nieaktualnym (drugi ekran hosta)”) jest w tej części **sprzeczna z kodem**.
- Przy tym samym numerze rundy `questionsLeft` liczy się tak samo (`questionPool(selection).length > round.number`, `server.ts:223`). Wynik się zmienia tylko wtedy, gdy między rundami zmieni się sama baza pytań (wdrożenie). To przypadek brzegowy, nie ścieżka gry.
- `questionsLeft === null` po odsłonie oznacza, że `hostRoomCategories` się nie udało (`server.ts:341-357`: błąd zapytania, wyjątek albo zły kształt wiersza). Wtedy `RoundReveal` zostawia „Następne pytanie” (`RoundReveal.tsx:232-233`).
- Wniosek dla F5: tekst `no_questions` przy „Następne pytanie” zobaczy host, gdy przy odświeżeniu stanu odczyt kategorii zawiódł, a przy kliknięciu się udał i pytania naprawdę się skończyły. Zwykła ścieżka („Zakończ grę” i notka po ostatnim pytaniu, `HostActions.tsx:56-65`) już działa.

## Open Questions

Wybory dla `/10x-plan`. Kod niczego tu nie rozstrzyga.

1. **Wdrożenie F2: jedna zmiana czy trzy fazy?**
   - Jedna migracja i jeden PR: krótkie okno, w którym „Odsłoń wynik” dostaje „To pytanie już się zmieniło.”, a ekrany wczytane przed wdrożeniem pokazują tekst ogólny do odświeżenia.
   - Wariant 2a/2b/2c z `02`: bez okna, ale dwa PR-y, dwie migracje i co najmniej 13 h przerwy.
   - Dziś nikt poza testami nie gra (pierwszy wieczór dopiero przed nami), więc wdrożenie poza grą praktycznie zeruje okno. To wniosek, nie dane z produkcji.
2. **`cast_vote`:** default zostaje, a brak numeru daje `round_over` w ciele funkcji. To `create or replace` z tą samą sygnaturą. Alternatywa to zmiana kolejności parametrów, `drop` i `create`, a przy braku argumentu `PGRST202`.
3. **`reveal_round`:** `drop (uuid)` i `create (p_room_id uuid, p_round integer default null)`, gdzie brak albo inny numer daje `round_over`. Bez defaultu stary Worker dostałby w oknie `PGRST202`.
4. **Odsłona pominiętej rundy:** `round_over` (decyzja 0.3 w `02`, ten sam kod co głos i pominięcie na pominiętej rundzie) czy zostawić `ok`?
5. **F3, gdzie limit:**
   - (a) w `private.open_next_round` przez `raise … using errcode = '22023'` (precedens zniekształconego tokenu). Jedno miejsce, rollback cofa też kasowanie w `skip_round`, ale to wyjątek, a nie odmowa-dana;
   - (b) odmowa-dana w `next_round` i `skip_round` przed pierwszym zapisem. To dwie pełne kopie funkcji w migracji i kod bez precedensu (`invalid_question`? nowy?).
   - Do tego wartość limitu: propozycja F3 to ok. 1000, dziś najwyżej 216.
6. **F5, tekst nowego kodu:** to samo zdanie co notka `HostActions` grozi dublem na ekranie po odświeżeniu. Inne zdanie? Czyścić błąd przy zmianie listy przycisków? Nazwa kodu: `questions_ran_out` (propozycja F5).
7. **`bodyRound`:** zostawić rozróżnienie `null`/`undefined` (tylko nowe komentarze), czy uprościć do `number | undefined`, skoro każdy ruch rundy wymaga numeru?
8. **Smoke:** podać numer w głosach S-02. Czy dodać kroki „głos bez numeru → 400”, „odsłona bez numeru → 400”, „odsłona ze starym numerem → 409 `round_over`”? Wtedy smoke ze starym Workerem w oknie dostanie inne odpowiedzi.
9. **Wyrocznia K1 w `refactor-opportunities/plan.md`:** poprawić w tym PR (sygnatura `reveal_round`, przypadek bez numeru, krok smoke) czy przy punkcie 6 kolejki?
