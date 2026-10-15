---
date: 2026-10-15T13:03:26+02:00
researcher: Claude (Opus 5.5)
git_commit: 4738dfff0a4f53c92d57c8f86803a752bbaac703
branch: main
repository: CharlesOnTheWave/most-likely-to
topic: "S-03 full-game-evening: na czym stoi gra po S-02 i co trzeba zmienić, żeby jedna runda stała się wieczorem (następne pytanie, pominięcie, koniec gry)"
tags: [research, s-03, full-game-evening, rounds, anonymity, round-rules, supabase, test-plan]
status: complete
last_updated: 2026-10-15
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Decyzje Karola D1–D5: wszystko wg rekomendacji; podsumowanie wieczoru (FR-022) poza S-03"
---

# Research: pełny wieczór (S-03)

**Date**: 2026-10-15T13:03:26+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 4738dfff0a4f53c92d57c8f86803a752bbaac703
**Branch**: main
**Repository**: CharlesOnTheWave/most-likely-to

## Research Question

Z `change.md`: jak przejść od jednej rundy (S-02) do wieczoru:

- prowadzący przechodzi do kolejnego pytania, bez powtórek w tej grze;
- może pominąć rundę: jej głosy przepadają i nie liczą się do jakości pytania;
- kończy grę po potwierdzeniu;
- po ostatnim pytaniu ekipa widzi koniec wieczoru bez punktacji.

Przy tym: follow-upy F4 i F6 z przeglądu S-02, F7 w ręcznej rundzie, stare ścieżki w komentarzach i pytanie, czy faza 3 planu testów idzie razem z S-03. Decyzje ponad wiedzę właściciela przeszły przez recenzję (adwokat diabła + krytyk).

## Summary

- **Schemat bazy już dopuszcza wiele rund, ale funkcje i ekrany zakładają jedną.**
  - `private.rounds` ma `number` i dwa klucze unikalne: `(room_id, number)` oraz `(room_id, question_id)` (`supabase/migrations/20261014101922_first_live_round.sql:112-126`). Drugi z nich już blokuje powtórkę pytania w pokoju.
  - Ale `start_game` otwiera wyłącznie rundę 1 i tylko z `lobby` (`:564-585`, komentarz `:539` „S-03 adds the next rounds”), a Worker losuje pytanie bez wykluczania zagranych (`src/lib/rounds/draw.ts:25`).
- **Najważniejsze ustalenie: głos nie wie, na które pytanie odpowiada.**
  - Żądanie głosu niesie tylko `{target}` (`src/pages/api/rooms/[id]/vote.ts:29-31`), a `cast_vote` zapisuje głos w najnowszej rundzie pokoju (`:655-659`).
  - Gdy pojawi się „Następne pytanie” albo „Pomiń”, spóźniony ekran oddałby głos wybrany przy pytaniu N do rundy N+1 (ryzyko #3).
  - `cast_vote` odmawia tylko fazie `revealed` (`:663-665`), a brakującą urnę zakłada od nowa (`:694`). Runda w nowej fazie (np. `skipped`) przyjęłaby więc głosy i mogłaby nawet odsłonić liczby (`finish_round`, `:206-208`).
- **Recenzja zmieniła dwie moje wstępne rekomendacje** (§5):
  - zamiast listy pytań zapisanej przy starcie wystarczy, że Worker przy każdym „Następne pytanie” podaje pulę w losowej kolejności, a baza bierze pierwsze niezagrane (bez nowej tabeli, bez zmiany `start_game`);
  - pominięcie ostatniego pytania nie kończy gry samo, bo koniec gry wymaga potwierdzenia (FR-006, `context/foundation/prd.md:97`).
- **Koniec gry da się oprzeć na istniejącym stanie `closed`.** Nowy stan wymagałby zmian w indeksie „jeden otwarty pokój” (`:47`), w parserze (`src/lib/rooms/shared.ts:144`) i w `room_link`. Zakończenie w trakcie głosowania musi usunąć urnę, bo godzinne sprzątanie patrzy tylko na `playing` (`supabase/migrations/20261014101925_close_stale_games.sql:29`).
- **Strażnicy z S-02 dają w kilku miejscach fałszywą zieleń dla rund 2+.** pgTAP zapamiętuje id rund tylko przy starcie (`supabase/tests/round_creator_view.test.sql:111-123`), więc `urn_rows` (`:164-181`) nie policzy urny rundy 2. Ekrany ogłaszają zmianę tylko przy zmianie nazwy fazy (`src/components/room/RoomScreen.tsx:40-45, 58-66`), więc każde następne pytanie byłoby ogłoszone jako „Gra się zaczęła.”, a pominięcie w ogóle.
- **Faza 3 planu testów zostaje osobno.** S-03 niesie testy ryzyk #1, #3, #4 i e2e kilku rund bez pomiaru czasu; pomiar 2 s, zerwane połączenie i sonda na produkcji pasują do S-04 (§6).

## Detailed Findings

### 1. Baza danych: gra i runda dziś

- **Stany pokoju:** `lobby`, `playing`, `closed` (`:42-43`). Host ma najwyżej jeden pokój w stanie `lobby` albo `playing` (indeks `:46-47`). Z `closed` nic nie wychodzi.
- **Przejścia** idą wyłącznie przez funkcje `security definer` z właścicielem `postgres` (`:774-805`):
  - `create_room` (host): nowy pokój w `lobby`; zamyka poprzedni pokój hosta, z potwierdzeniem, gdy są w nim goście (`:266-278`), i woła `drop_round_state` (`:276-278`);
  - `start_game` (host): `lobby` → `playing`, runda 1, uprawnieni = gracze w pokoju, co najmniej 3 (`:540-594`);
  - `private.close_stale_games` (cron co godzinę): zamyka pokoje `playing` rozpoczęte ponad 12 h temu (`close_stale_games.sql:17-36`).
- **Runda:** `private.rounds` (logowana) z fazą `voting` albo `revealed` (`:117`); `private.round_results` (logowana, liczba na cel, bez głosującego, `:130-135`); urna nielogowana `private.ballot_boxes` i `private.round_voters` (`:141-153`). Wszystkie bez grantów i polityk (`:155-161`), żadna w publikacji `supabase_realtime`.
- **Głos** (`cast_vote`, `:599-719`): bierze najnowszą rundę pokoju (`:655-659`), odmawia `round_revealed` (`:663-665`), sprawdza uprawnienie i podwójny głos, zakłada urnę od nowa, jeśli zniknęła (`:694`), a ostatni uprawniony głos woła `finish_round` (`:708-715`).
- **Odsłona:** `reveal_round` (host) jest powtarzalna: dla rundy już odsłoniętej zwraca `{ok:true}` bez zmian (`:723-769`). `finish_round` zapisuje wyniki, ustawia `phase='revealed'` i usuwa urnę (`:182-213`).
- **`drop_round_state`** usuwa wiersze urny wszystkich rund pokoju, ale nie zmienia fazy (`:166-178`).
- **Stan dla ekranów** (`room_lobby`, `:425-534`): runda jest czytana tylko przy `status='playing'` (`:474-481`). Gałąź `voting` zwraca `{number, question_id, phase, voted, me_voted}` (`:483-498`), a każda inna faza wpada do gałęzi wyników `{number, question_id, phase, results, abstained, ballots}` (`:499-516`). Dokładne zbiory kluczy pilnują testy (`tests/db/support/rounds.ts:32-38`).

### 2. Worker i ekrany

- **Akcje rundy** (wszystkie POST JSON poza stanem):
  - `GET /api/rooms/[id]/lobby`: stan;
  - `/start` i `/reveal`: tylko host, treść żądania nieczytana;
  - `/vote`: gość z ciasteczkiem albo host, treść `{target}` przez `readJsonBody`.
  - Wzór nowej akcji to `reveal.ts`: `refuseForeignPost` (`src/lib/rooms/json-route.ts:26-37`), sprawdzenie UUID, sesji, `callRpc` (`src/lib/rooms/server.ts:80-96`, wywołanie nazwanymi argumentami), dzwonek tylko po `ok`, `actionAnswer` z mapowaniem statusów (`json-route.ts:65-85`).
  - Kody odmów: lista `ROUND_REFUSALS` (`src/lib/rooms/errors.ts:7-16`) i polskie teksty w `MESSAGES`; ręcznie przepisaną listę porównuje `tests/unit/room-errors.test.ts:19-28`. Nowy kod bez wpisu dostaje ogólny tekst i żaden test nie zaświeci.
- **Losowanie:** `drawFrom` (`src/lib/rounds/draw.ts:26-48`) filtruje pulę po wybranych kategoriach i 18+ tylko tam, gdzie host je włączył, a potem wybiera jedno pytanie `Math.random` (`src/pages/api/rooms/[id]/start.ts:29`). Kategorie czyta przez RLS hosta (`server.ts:276-292`). Do przeglądarki trafia tylko tekst bieżącego pytania (`server.ts:194-203`, `draw.ts:52-54`), zgodnie z lekcją „Pytania gry tylko po stronie serwera” (`context/foundation/lessons.md`).
- **Baza pytań:** 216 pytań, 8 kategorii po 27, z tego 58 oznaczonych 18+ (`src/data/questions.ts`, policzone 15.10). Najmniejsza pula (jedna kategoria bez 18+) to ok. 19–20 pytań, więc kryterium „co najmniej 10 pytań” (`prd.md:38`) mieści się w każdej puli.
- **Odświeżanie ekranów** (`src/components/room/useRoomState.ts`): dzwonek wywołuje pobranie przez ogranicznik (`src/lib/live-sync/limiter.ts:17-18`), poza tym odpytywanie co 15 s (`src/lib/live-sync/shared.ts:8`) albo co 5 s przy zerwanym kanale. Efekt nie działa, gdy `status === "closed"` (`useRoomState.ts:139, 144`).
- **Co widzi host po odsłonie:** „Kolejne pytania wkrótce.” i link „Nowa gra” (`src/components/room/RoundReveal.tsx:215-223`). Goście nic. Wzór potwierdzenia w dwóch krokach: „Na pewno odsłonić? Zagłosowało N z M” + „Anuluj” (`src/components/room/RoundVoting.tsx`).
- **Zamknięty pokój:** ekran „Ta gra jest zamknięta.” z „Załóż nową grę” dla hosta (`RoomScreen.tsx:83-95`).
- **Ogłoszenia dla czytnika:** jeden region `aria-live`, ustawiany tylko wtedy, gdy zmienia się nazwa fazy (`RoomScreen.tsx:58-66`); tekst „Gra się zaczęła. …” dla każdej fazy `voting` (`:42`).
- **Parser stanu** odrzuca nieznaną fazę rundy (`src/lib/rooms/shared.ts:137`) i nieznany status (`:144`).

### 3. Follow-upy z przeglądu S-02

- **F4:** `island_crash` jest przyjmowany (`src/lib/client-events.ts:8`) i logowany (`src/pages/api/client-events.ts:27`), ale w sprawdzonym `src/` nie ma granicy błędów ani nadawcy. `reportClientEvent` jest prywatna w `useRoomState.ts:67-91`. Najmniejsza poprawka: klasa granicy błędów wokół treści `RoomScreen` (`RoomScreen.tsx:138-146`), która zgłasza `island_crash` i pokazuje „odśwież”.
- **F6:** `readJsonBody` czyta całą treść (`json-route.ts:47`) przed sprawdzeniem limitu 4096 (`:12, :52`). Wołają ją tylko `vote.ts:29` i `api/client-events.ts:17`. Poprawka w miejscu: odmowa po nagłówku `Content-Length`, potem czytanie z limitem. Nowe akcje next/skip/end mogą nie czytać treści, jak start i reveal, chyba że niosą numer rundy (§5, T1).
- **F7:** sprawdzenie czytnikiem w ręcznej rundzie S-03 (`context/archive/2026-10-13-first-live-round/follow-ups/review-fixes.md`).

### 4. Testy, które dotyka S-03

- **Zmienią się albo zaświecą celowo:**
  - `tests/db/round-rules.test.ts:169-173` oczekuje `game_started` przy drugim `start_game` (zostaje prawdą, jeśli następne pytanie idzie nową funkcją);
  - dokładne zbiory kluczy (`round-anonymity.test.ts:121, 134, 157-158`) przy każdym nowym kluczu w stanie;
  - `tests/unit/room-state.test.ts:121` (nieznana faza) i `:70` (nieznane statusy);
  - lista kodów w `tests/unit/room-errors.test.ts:19-28`.
- **Fałszywa zieleń bez poprawki pomocników pgTAP:** `host_starts` zapisuje id rund tylko przy starcie (`round_creator_view.test.sql:119-123`), `urn_rows` liczy tylko te id (`:164-181`), `results_of` bierze `max()` po wszystkich rundach pokoju (`:229-230`). Strażnicy tabel wymieniają tabele z nazwy (`:314-352`).
- **Do wykorzystania:** pomocnicy DB (`tests/db/support/rounds.ts:61-147`), E2E (`tests/e2e/support/room.ts`, `round.ts`), pgTAP (`call_as`, `open_room`, `guest_votes`). Brakuje pomocników next/skip/end wszędzie. `act()` w smoke przyjmuje dowolną akcję (`scripts/smoke.mjs:234`).
- **Budżet:** rejestracje w jednym przebiegu `db` dziś 10 przy limicie 30 na 5 min (test-plan §6.2); nowe testy ról mogą użyć istniejących hostów (`round-rules.test.ts:44-48`), więc 0 nowych kont.
- **Smoke i wdrożenie „baza, potem kod”:** `SMOKE_ROUND=0` pomija kroki rundy (`scripts/smoke.mjs:21`). Stary Worker nie ma akcji next/skip/end, więc kroki S-03 potrzebują osobnego przełącznika.
- **Stare ścieżki** `context/changes/first-live-round/` w komentarzach: `tests/` (12 miejsc w 10 plikach), `scripts/smoke.mjs:9, 254, 319`, `supabase/tests/round_creator_view.test.sql:4` i kilka plików w `src/` (m.in. `useRoomState.ts:42`, `limiter.ts:4`, `shared.ts:16`). Do tego `scripts/smoke.mjs:174` wskazuje `context/changes/room-lobby/plan.md`. Wgrane migracje zostają bez zmian.

### 5. Decyzje do podjęcia (rekomendacje po recenzji)

Recenzja: adwokat diabła szukał najlepszej alternatywy dla każdej rekomendacji, krytyk sposobów, w jakie każda się psuje. Zarzuty sprawdzone u źródła; niesprawdzone oznaczone.

**D1. Skąd bierze się kolejne pytanie.**
- W-A: przy starcie Worker tasuje całą pulę i zapisuje listę w nowej tabeli `private`; „Następne pytanie” bierze następne z listy (moja wstępna rekomendacja).
- **W-B (rekomendacja po recenzji):** przy każdym „Następne pytanie” i „Pomiń” Worker podaje pulę w losowej kolejności, a funkcja bazy bierze pierwsze pytanie, którego w tym pokoju jeszcze nie było. Klucz `(room_id, question_id)` (`:125`) zostaje bezpiecznikiem.
- W-C: lista N pytań (np. 15) z naturalnym końcem.
- Dlaczego W-B:
  - nie ma nowej tabeli ani zmiany `start_game`, więc stary Worker działa w oknie wdrożenia;
  - argument „lista z PRD przyda się S-06” nie trzyma: S-06 potrzebuje listy już w lobby, 15–20 pytań, z poprawianiem treści i własnymi pytaniami, których format `question_id` (`:116`) nie przyjmie (adwokat). S-06 i tak zbuduje własną listę, a W-B przyjmie z niej kandydatów;
  - W-C ucina wieczór, a dolosować nie ma jak przed S-06.
- Skutek: „ostatnie pytanie” to wyczerpana pula (19–216 pytań), więc w praktyce wieczór kończy host. Gdy pula się wyczerpie, „Następne pytanie” odpowiada `no_questions`, a host widzi „Pytania z wybranych kategorii się skończyły” i „Zakończ grę”.

**D2. Kiedy i jak działa „Pomiń pytanie”.**
- Rekomendacja: tylko w trakcie głosowania (po odsłonie liczby są już widziane, więc nie ma czego „przepadać”); drugie kliknięcie jak przy odsłonie („Na pewno pominąć? Zagłosowało N z M”); pominięcie od razu otwiera następne pytanie, w jednej transakcji.
- Zmiana po recenzji: pominięcie ostatniego pytania nie zamyka gry samo, tylko pokazuje „Pytania się skończyły” + „Zakończ grę” z potwierdzeniem (FR-006 wymaga potwierdzenia końca, `prd.md:97`).

**D3. Co zostaje po pominiętej rundzie.**
- Rekomendacja: wiersz rundy zostaje z fazą `skipped`, bez liczb (`abstained`, `ballots` puste, brak `round_results`); urna usunięta w tej samej transakcji.
- Powód po recenzji: numeracja rund i bezpiecznik „bez powtórek”. Nie dane dla S-11: wiersze rund znikają razem z pokojem (`on delete cascade`, `:113`), a FR-019 wymaga, by anonimowe dane o pytaniach przetrwały skasowanie gry (`prd.md:128`), więc S-11 i tak zbuduje własne zestawienia.
- Interpretacja FR-006 do potwierdzenia: „nie liczy się do jakości” = głosy pominiętej rundy nie trafiają do żadnych danych; samo pominięcie jest sygnałem dla S-11/S-12 (FR-016/017), ale S-03 go jeszcze nigdzie nie zapisuje poza wierszem rundy.

**D4. Koniec gry i ekran końca wieczoru.**
- Rekomendacja: „Zakończ grę” z drugim kliknięciem (w trakcie głosowania i po odsłonie) ustawia `closed` i usuwa urnę (`drop_round_state`). Ekran zamkniętej gry staje się „Koniec wieczoru” dla wszystkich: bez punktów, bez podsumowania (FR-022 odłożone), z „Nowa gra” tylko dla hosta. Po odsłonie host widzi „Następne pytanie” i „Zakończ grę” zamiast „Kolejne pytania wkrótce” i „Nowa gra”.
- Skutki do przyjęcia świadomie:
  - ostatni wynik znika z ekranów przy końcu, bo stan nie czyta rundy zamkniętego pokoju (`:474`);
  - „Koniec wieczoru” zobaczą też goście pokoju zamkniętego przez „Nową grę” hosta i przez nocne sprzątanie;
  - strona linku (`/j/…`) ma własny tekst dla zamkniętej gry (`room_link`, `:416`) do wyrównania.
- Odrzucone: nowy stan pokoju (np. `finished`) — trzy miejsca do zmiany i nic nie daje ponad `closed`.

**D5. Faza 3 planu testów.**
- Rekomendacja: nie łączyć całej fazy z S-03.
  - S-03 niesie testy ryzyk #1 (brak urny i liczb po pominięciu i końcu), #3 (bez powtórek, spóźniony głos), #4 (gość i obcy host nie zrobią next/skip/end) i e2e kilku rund bez pomiaru czasu;
  - pomiar 2 s, zerwane połączenie w rundzie i sonda na produkcji zostają w fazie 3, najlepiej z S-04 (powrót po odświeżeniu w 10 s), bo sonda pisze do produkcji i wymaga osobnej zgody (`context/archive/2026-10-13-first-live-round/research.md:395`).
- Szacunek ryzyka #7 (rachunek, nie pomiar) należy jednak do S-03, bo to S-03 tworzy obciążenie wieczoru:
  - S-02 liczył ok. 520–620 żądań Workera na rundę przy 20 ekranach (`context/archive/2026-10-13-first-live-round/plan.md:756`);
  - odpytywanie co 15 s to 20 × 4 × 60 = 4 800 żądań na godzinę;
  - wieczór 3 h z 20 rundami: ok. 20 rund × 570 + 3 × 4 800 ≈ 26 tys., przy limicie 100 tys. dziennie na konto (`context/foundation/infrastructure.md:49`). Mieści się, ale dwa takie wieczory jednego dnia zjadłyby ponad połowę limitu.

### Decyzje Karola (2026-10-15)

Karol przyjął wszystkie rekomendacje z §5 („spoko”), po upewnieniu się, że podsumowanie wieczoru (FR-022) nie wchodzi teraz:

- **D1: W-B.** Worker przy każdym „Następne pytanie” i „Pomiń” podaje pulę w losowej kolejności, baza bierze pierwsze niezagrane; bez nowej tabeli, `start_game` bez zmian.
- **D2:** „Pomiń pytanie” tylko w trakcie głosowania, z drugim kliknięciem, od razu następne pytanie; przy wyczerpanej puli „Pytania się skończyły” + „Zakończ grę”, bez samoczynnego końca.
- **D3:** pominięta runda zostaje jako wiersz `skipped` bez liczb; głosy pominiętej rundy przepadają całkowicie (interpretacja FR-006 przyjęta).
- **D4:** „Zakończ grę” z drugim kliknięciem → `closed`, urna usunięta, „Koniec wieczoru” dla wszystkich (bez punktów, bez podsumowania, bez liczby pytań), „Nowa gra” dla hosta. Skutki z §5 D4 przyjęte.
- **D5:** faza 3 planu testów osobno (najlepiej z S-04); S-03 niesie testy ryzyk #1, #3, #4, e2e kilku rund bez pomiaru czasu i szacunek ryzyka #7.
- **Poza S-03:** ekran podsumowania wieczoru („najwięcej głosów dziś” itp., FR-022) zostaje w Parked roadmapy („wrócić po pierwszych wieczorach”, `context/foundation/roadmap.md`, sekcja Parked); lista gier hosta to S-13.

### 6. Wymagania techniczne, które wynikają z researchu (nie wymagają decyzji)

- **T1. Numer rundy w głosie, pominięciu i „Następnym”.** `cast_vote` dostaje `p_round integer default null` i odmawia każdej fazie innej niż `voting` oraz rundzie innej niż bieżąca (`round_over`). W tej samej migracji usunąć starą wersję z 3 argumentami: dwie wersje obok siebie byłyby furtką (stara przyjęłaby głos do pominiętej rundy) i mogłyby dać niejednoznaczne wywołanie (krytyk; zachowanie PostgREST przy przeciążeniach niesprawdzone, do potwierdzenia w CI testem, który woła `cast_vote` starymi argumentami). Pominięcie i „Następne” zawsze niosą numer rundy, którą host widział, więc podwójne kliknięcie albo ponowione żądanie nie pominie pytania, którego nikt nie widział.
- **T2. Funkcje bazy:** next i skip (host, `security definer`, właściciel `postgres`, `search_path = ''`, grant tylko `authenticated`) blokują wiersz pokoju, sprawdzają numer i fazę, wybierają pierwszego kandydata spoza zagranych przez `exists` przed `insert` (żeby powtórka była odmową w danych, a nie błędem 23505 z wartościami wiersza w DETAIL) i zakładają urnę nowej rundy. Koniec gry blokuje pokój, woła `drop_round_state` i ustawia `closed`.
- **T3. `room_lobby`** dostaje gałąź `skipped` bez liczb, w tej samej migracji.
- **T4. Ekrany:** nowe akcje w `RoomAction` (`src/components/room/room-actions.ts:9`), przyciski w bloku hosta `RoundVoting` i `RoundReveal`, ekran końca wieczoru, parser przyjmuje `skipped`, głos wysyła numer rundy, ogłoszenie zależne od fazy i numeru („Pytanie N: …”, osobne ogłoszenie pominięcia).
- **T5. pgTAP:** `urn_rows` czyta rundy pokoju w chwili wywołania, `results_of` liczy jedną rundę, pętla po wszystkich tabelach `private` (granty, publikacja, kolumny czasu); nowe sprawdzenia „0 wierszy urny po pominięciu, po końcu w trakcie głosowania i po sprzątaniu gry w rundzie 2”.
- **T6. Wdrożenie „baza, potem kod”:** stary Worker działa na nowej bazie, bo `start_game` się nie zmienia, a `cast_vote` przyjmuje stare argumenty. Smoke potrzebuje przełącznika dla kroków S-03, a test-plan §4 nowej liczby kroków.
- **T7.** F4 i F6 (§3), stare ścieżki (§4).

## Code References

- `supabase/migrations/20261014101922_first_live_round.sql:42-47` — stany pokoju i jeden otwarty pokój hosta
- `supabase/migrations/20261014101922_first_live_round.sql:112-126` — `private.rounds`, klucze `(room_id, number)` i `(room_id, question_id)`
- `supabase/migrations/20261014101922_first_live_round.sql:166-213` — `drop_round_state`, `finish_round`
- `supabase/migrations/20261014101922_first_live_round.sql:540-594` — `start_game` (runda 1, tylko z `lobby`)
- `supabase/migrations/20261014101922_first_live_round.sql:655-719` — `cast_vote`: najnowsza runda, odmowa tylko `revealed`, urna od nowa
- `supabase/migrations/20261014101922_first_live_round.sql:474-516` — `room_lobby`: runda tylko przy `playing`, gałęzie faz
- `supabase/migrations/20261014101925_close_stale_games.sql:29` — sprzątanie tylko `playing`
- `src/lib/rounds/draw.ts:25-48` — losowanie bez wykluczeń
- `src/pages/api/rooms/[id]/vote.ts:29-31` — głos niesie tylko `target`
- `src/lib/rooms/json-route.ts:12, 47, 52` — F6
- `src/components/room/RoomScreen.tsx:40-66, 83-95, 138-146` — ogłoszenia, ekran zamknięty, miejsce na granicę błędów (F4)
- `src/components/room/RoundReveal.tsx:215-223` — „Kolejne pytania wkrótce.” i „Nowa gra”
- `src/components/room/useRoomState.ts:67-91, 139-144` — zgłoszenia z przeglądarki, koniec odświeżania po `closed`
- `src/lib/rooms/shared.ts:137, 144` — parser odrzuca nieznaną fazę i status
- `supabase/tests/round_creator_view.test.sql:111-123, 164-181, 229-230` — pomocnicy liczący tylko rundę 1

## Architecture Insights

- Każda zmiana stanu gry idzie przez funkcję bazy, która najpierw blokuje wiersz pokoju, więc głos, odsłona, pominięcie i koniec gry przychodzące naraz wykonają się po kolei (krytyk; sprawdzone w `start_game`, `:540-594`, i w zasadzie spisanej w nagłówku migracji, `:14`).
- Odmowy są danymi (`{ok:false, reason}`), nie błędami Postgresa, bo DETAIL błędu niósłby wartości wiersza (komentarz `:11-12`). Nowe funkcje muszą sprawdzać przed zapisem.
- Kanał na żywo niesie tylko dzwonek; stan zawsze z bazy. Nowe akcje dzwonią tylko po `ok`.

## Historical Context (from prior changes)

- `context/archive/2026-10-13-first-live-round/plan.md:72` — następne pytanie, pominięcie i koniec gry odłożone do S-03; w S-02 gra kończy się na odsłonie.
- `context/archive/2026-10-13-first-live-round/research.md:83` — „bez pytań z ostatnich wieczorów hosta” to S-12; „bez powtórek w grze” staje się realne w S-03.
- `context/archive/2026-10-13-first-live-round/plan.md:756` — budżet żądań na rundę.
- `context/archive/2026-10-13-first-live-round/follow-ups/review-fixes.md` — F4, F6, F7.
- `context/archive/2026-10-07-room-lobby/` — jeden otwarty pokój hosta, „Nowa gra” z potwierdzeniem w formularzu.

## Related Research

- `context/archive/2026-10-13-first-live-round/research.md` — urna, która znika (D1), decyzje D2–D6 S-02.
- `context/archive/2026-09-27-live-sync-spike/measurements.md` — dzwonek + stan z serwera.

## Open Questions

- Zachowanie PostgREST przy zmianie sygnatury `cast_vote` (T1) potwierdzi dopiero test w CI.
- Liczba zagranych pytań na ekranie końca wieczoru: nie w S-03 (D4), wrócić przy S-13 albo FR-022.
