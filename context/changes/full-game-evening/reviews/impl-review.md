<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Pełny wieczór (S-03): kolejne pytania, pominięcie rundy i koniec gry (full-game-evening)

- **Plan**: context/changes/full-game-evening/plan.md
- **Scope**: Full plan (fazy 1–5 ukończone; faza 6, czyli przegląd i wdrożenie, właśnie trwa)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-15
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 8 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Kryteria automatyczne powtórzone 15.10 na kodzie `7c444ca`:

- **Lokalnie:** `npm run lint` (0 literałów w 33 widokach), `npx astro check` (0 błędów, 0 ostrzeżeń), `npm test` (334/334), `npm run test:hooks` (33/33) i `npm run build` przechodzą.
- **CI na PR #8 (run 38764756499):** `ci`, `db` (Vitest 175/175, pgTAP 105/105), `smoke` 53/53 i `e2e` 5/5 zielone.
- **Migracje:** `git diff origin/main...HEAD -- supabase/migrations` pokazuje tylko `20261015122252_full_game_evening.sql`; tymczasowe migracje próbnych alarmów odwrócone i nigdy niewgrane.
- **Kontrole ręczne faz 1–5:** wszystkie odhaczone, każda z dowodem (opis PR z listą strażników, zrzuty ocenione przez Karola, klawiatura przy 4.4, tabela alarmów w opisie PR). Czytnik ekranu czeka na 6.6.

Sprawdzone i bez uwag:

- **Zasady z „Critical Implementation Details”:**
  - jedna wersja `cast_vote` (stara 3-argumentowa usunięta, nowa z `p_round`; pgTAP to sprawdza);
  - każda funkcja gry najpierw blokuje wiersz `rooms` (`for update`), potem runda i urna;
  - odmowy jako `{ok:false, reason}`, bez wyjątków z DETAIL;
  - pominięcie usuwa urnę, ustawia `skipped` i otwiera następną rundę w jednej funkcji;
  - głos trafia tylko do najnowszej rundy w fazie `voting`, z pasującym numerem, gdy podany;
  - next i skip biorą numer z ekranu hosta, inny to `round_over`;
  - pomocnicy pgTAP przepisani w tym samym commicie co nowe asercje urny (`5f3e40c`).
- **„What We're NOT Doing” dotrzymane:** ekran końca bez liczb, bez nowego stanu pokoju, `start_game` i `start.ts` bez zmian, lista pytań nigdzie nie zapisana, nic o jakości pytań.
- **Uprawnienia:** `next_round`, `skip_round`, `end_game` jako `security definer`, właściciel `postgres`, `search_path=''`, `execute` tylko `authenticated`, sprawdzenie hosta w środku funkcji; `open_next_round` bez grantów. Testy: gość dostaje `42501` z nazwą funkcji, obcy host `room_unknown`.
- **Anonimowość:** pominięta runda pokazuje tylko `{number, phase}`, parser odrzuca każdy dodatkowy klucz; `after_skip` nie wiąże się z niczyim głosem; logi niosą tylko `op`, wynik i `roomId`.
- **Wyścigi:** blokada pokoju szereguje głos, pominięcie i koniec; spóźniony głos dostaje `round_over` albo `room_closed`, podwójne „Następne pytanie” albo „Pomiń” `round_over`; brak odwróconej kolejności blokad. `close_stale_games` działa dla `skipped` i rund 2+ (pgTAP: gra utknięta w rundzie 2).
- **F6:** zadeklarowany `Content-Length` sprawdzany pierwszy, treść bez nagłówka liczona w bajtach, strumień przerwany po przekroczeniu limitu.
- **Pytania tylko na serwerze:** żadna wyspa nie importuje `draw`, `questions` ani `rooms/server`; pytanie jako zwykły tekst React.
- **Reguła `ask`** dla `SMOKE_GAME=*` dopisana razem z przełącznikiem (lessons.md, wpis 1).

Poza ustaleniami, bo już opisane w planie:

- wycofanie kodu (`wrangler rollback`) po pierwszym pominięciu ostatniego pytania psuje ekrany takich gier: plan, „Migration Notes”;
- dodatkowe zapytanie hosta o kategorie po odsłonie i po pominięciu: plan, „Performance Considerations”.

Niesprawdzone:

- czy PostgREST odpowiada 400 na liczbę spoza zakresu `integer` (F1): wniosek z tabeli kodów PostgREST i z kodu, bez uruchomienia (lokalnie brak bazy);
- czy `supabase db push` wgrywa plik migracji w jednej transakcji. Bez niej między `drop` a `create` funkcji `cast_vote` byłoby okno rzędu milisekund, w którym głos starego Workera dostałby błąd.

## Findings

### F1 — Numer pytania spoza zakresu bazy daje 500 i dwie linie `error` w logu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/rooms/json-route.ts:111
- **Detail**: `bodyRound` przyjmuje każdą liczbę całkowitą do `Number.MAX_SAFE_INTEGER` (2^53−1), a `p_round` w bazie to `integer` (do 2 147 483 647). Treść `{"target":null,"round":2147483648}` przechodzi przez Workera, PostgREST nie zamienia jej na `integer` (22003) jeszcze przed wejściem do `cast_vote`, a `logFailure` (`src/lib/rooms/server.ts:57-62`) zamienia każdy błąd inny niż 5xx na `unexpected`. Gracz dostaje 500, w logu lądują dwie linie `error` (`callRpc` i `actionAnswer`). Dla głosu wystarczy zmyślone ciasteczko w formacie `mlt_player_…` i ręcznie ustawiony `Origin` (`vote.ts:40-42` sprawdza tylko format ciasteczka), więc to może zrobić każdy. Przed S-03 to samo żądanie dostawało `room_unknown` i linię `info`. Next i skip mają tę samą dziurę, ale tam dochodzi tylko host pokoju. Linie `error` to sygnał „coś się psuje”, więc zalew nimi zasłaniałby prawdziwe awarie. Test `tests/unit/json-route.test.ts:113-123` sprawdza tylko `MAX_SAFE_INTEGER + 1`.
- **Fix**: Górna granica 2 147 483 647 w `bodyRound` (stała obok `MAX_BODY_LENGTH`) i przypadek `2147483648` w teście jednostkowym `bodyRound`.
- **Decision**: FIXED — `bodyRound` przyjmuje najwyżej 2 147 483 647 (`MAX_ROUND` w `json-route.ts`); test jednostkowy: 2 147 483 647 przyjęte, 2 147 483 648 odrzucone

### F2 — Numer pytania nie jest jeszcze obowiązkowy: głos bez numeru i „Odsłoń wynik” bez numeru

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/rooms/[id]/vote.ts:35; supabase/migrations/20261015122252_full_game_evening.sql:252-259, :329; src/pages/api/rooms/[id]/reveal.ts
- **Detail**: Głos bez `round` trafia do najnowszej rundy, czyli dokładnie w dziurę, którą zamyka T1 (wybór przy pytaniu N ląduje w N+1). To celowe okno wdrożenia dla ekranów wczytanych przed S-03, ale nic nie planuje jego zamknięcia (S-02 zapisało podobne „usunąć później” dla `p_link_token`). Drugi przypadek: „Odsłoń wynik” nie niesie numeru, a `reveal_round` z S-02 się nie zmienił. Nieaktualny ekran hosta (drugie urządzenie albo ekran, któremu nie wyszło odświeżenie) może więc odsłonić rundę, której nie pokazał, np. z 0–1 głosami. Host i tak może odsłonić w każdej chwili (D3), więc to nie nowa możliwość, tylko wyjątek od zasady „ruchy hosta niosą numer”. Gracz nie ma z tego korzyści: zawsze może wysłać właściwy numer.
- **Fix**: Wpis w `follow-ups/review-fixes.md`: po oknie wdrożenia nowa migracja z obowiązkowym `p_round` w `cast_vote` i z `p_round` w `reveal_round`; `vote.ts` odpowiada `invalid_body` bez `round`; ekran wysyła numer przy odsłonie.
- **Decision**: DEFERRED — `follow-ups/review-fixes.md`; wymaga migracji po oknie wdrożenia

### F3 — Lista kandydatów bez limitu długości i bez testu filtra formatu

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261015122252_full_game_evening.sql:38-55, :79, :140; tests/db/game-rules.test.ts
- **Detail**: `open_next_round` sprawdza każdy element `p_candidates` (wzorzec i `not exists`) pod blokadą wiersza pokoju, a długość tablicy ogranicza tylko `statement_timeout` i limit treści PostgREST. Wołać może tylko host, ale konto i pokój z dwoma gośćmi założy każdy, więc host może obciążać bazę długimi listami. Baza pytań ma 216 id. Do tego żaden test nie podaje błędnych ani pustych (`null`) kandydatów. Bez filtra formatu (`:50`) zły kandydat wpadłby na ograniczenie `rounds.question_id` (23514), a DETAIL takiego błędu niesie wartości wiersza, czego zasada „odmowa to dane” zabrania. Worker zawsze wysyła poprawne id z `questions.ts`, więc dotyczy to tylko hosta wołającego bazę wprost, i to we własnym pokoju.
- **Fix**: Wpis w `follow-ups/review-fixes.md`: w następnej migracji odmowa dla list dłuższych niż ok. 1000; test bazy z kandydatami `["NA-CO-DZIEN-001", null, Q]` (otwiera Q) i z samymi błędnymi (`no_questions`, `error` null).
- **Decision**: DEFERRED — `follow-ups/review-fixes.md`; dotyczy tylko hosta we własnym pokoju

### F4 — „Nie wiadomo, czy zostały pytania” obsłużone na dwa sposoby

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/rooms/server.ts:207-211; src/components/room/RoundReveal.tsx:227; src/components/room/RoundSkipped.tsx:40
- **Detail**: `questionsLeft: null` znaczy, że Worker nie odczytał kategorii pokoju. Odsłona traktuje to jak „są pytania” (`!== false`, pokazuje „Następne pytanie”), a pominięta ostatnia runda jak „skończyły się” (`=== true`, tylko „Zakończ grę”). Oba wybory są rozsądne: pominięcie, które nie otworzyło następnej rundy, znaczy, że pula była pusta, a po odsłonie baza i tak odpowie `no_questions`. Komentarz w `server.ts` opisuje jednak tylko pierwszy przypadek, więc przyszła zmiana może wziąć zły wzór.
- **Fix**: Poprawić komentarz w `server.ts:207-211`, żeby opisywał oba ekrany i powód różnicy.
- **Decision**: FIXED — komentarz w `server.ts` opisuje oba ekrany i powód różnicy

### F5 — `no_questions` w trakcie wieczoru pokazuje tekst ze startu gry

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/rooms/errors.ts:35
- **Detail**: Tekst „W wybranych kategoriach nie ma pytań. Załóż nową grę z innymi kategoriami.” pisano dla startu. Teraz ten sam kod zwraca `next_round`, gdy pula skończy się w trakcie wieczoru, a rada „załóż nową grę” zamknęłaby bieżącą, zamiast powiedzieć „Pytania z wybranych kategorii się skończyły.” jak ekran po odsłonie. Ścieżka zdarza się tylko wtedy, gdy `questionsLeft` było `null` albo nieaktualne (np. drugi ekran hosta). Po kolejnym pobraniu stanu ekran sam pokaże właściwy tekst i „Zakończ grę”.
- **Fix**: Wpis w `follow-ups/review-fixes.md`: osobny tekst dla wyczerpanej puli w trakcie gry (np. `next.ts` zamienia `no_questions` na własny kod), z testem w `room-errors.test.ts`.
- **Decision**: DEFERRED — `follow-ups/review-fixes.md`; ekran sam się poprawia przy następnym pobraniu stanu

### F6 — Ekran po wysypaniu gubi fokus

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/room/RoomErrorBoundary.tsx:37-53
- **Detail**: Gdy granica błędów podmienia ekran pokoju, element z fokusem znika i fokus spada na `<body>`, więc użytkownik klawiatury i czytnika zaczyna od początku strony. `role="alert"` obejmuje nagłówek i przycisk, więc czytnik przeczyta całość razem z nazwą przycisku. Ekran pokoju po ruchu hosta przenosi fokus na nagłówek nowego widoku (`RoomScreen.tsx:93-113`); ekran po wysypaniu tego nie robi. Zgłoszenie `island_crash` działa poprawnie.
- **Fix**: Po pokazaniu ekranu fokus na nagłówek (`tabIndex={-1}`), jak w `RoomScreen`; `role="alert"` zdjęte, bo przeniesiony fokus sam odczyta tekst. Sprawdzić na `/dev/room-states` (stan z wysypanym dzieckiem).
- **Decision**: FIXED — fokus na nagłówek ekranu po wysypaniu, ale tylko gdy był w ekranie pokoju (snapshot przed podmianą), więc podgląd i wczytanie strony nie przeskakują; `role="alert"` zostało, ale obejmuje tylko tekst, bo gracz z fokusem gdzie indziej też ma usłyszeć komunikat

### F7 — Zmiany spoza planu w ekranach i roadmapie

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/room/HostActions.tsx; src/components/room/RoomScreen.tsx:93-113; src/lib/rooms/shared.ts (`questionSentence`); context/foundation/roadmap.md (Parked)
- **Detail**: Plan tego nie opisywał:
  - dwukrokowe „Odsłoń wynik” z S-02 przeniesione do wspólnego `HostActions.tsx` razem z pominięciem, końcem i „Następne pytanie”;
  - zajęty przycisk ma `aria-disabled` zamiast `disabled`, więc nie traci fokusu;
  - po ruchu hosta fokus idzie na nagłówek nowego widoku;
  - `questionSentence` przeniesione z `RoundQuestion.tsx` do `shared.ts`, żeby `announce.ts` działał bez Reacta i miał testy;
  - w roadmapie dwa nowe wpisy Parked (drobny czat w pokoju, szeroki układ) i „Czat głosowy i tekstowy” → „Czat głosowy”. To decyzje Karola z 15.10; PRD bez zmian.

  Wszystko to służy kryteriom planu (fokus po potwierdzeniu nie ginie, ogłoszenia testowalne bez DOM), a `round.spec.ts` zostało zielone. Ryzyko niskie.

- **Fix**: Zostawić; klawiaturę („Odsłoń wynik”, „Pomiń”, „Zakończ”, „Następne pytanie”, „Anuluj”) sprawdzić jeszcze raz w ręcznym wieczorze 6.5.
- **Decision**: ACCEPTED — bez zmian; klawiatura jeszcze raz w ręcznym wieczorze 6.5

### F8 — Próbny alarm (a) zaświecił więcej testów, niż przewidywał plan

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/full-game-evening/plan.md:431; context/foundation/test-plan.md §6.2
- **Detail**: Plan (faza 5, punkt 3) przewidywał dla alarmu (a) tylko test spóźnionego głosu w `game-rules.test.ts`. Testy dopisane po planie (spóźniony głos z pominiętego pytania, odsłona pytania 3, krok smoke ze spóźnionym głosem) też pilnują numeru pytania, więc przewidywanie poprawiono w opisie commita `d4ad073` przed pushem i sprawdzono najpierw na PGlite. CI zaświeciło dokładnie tę poprawioną listę: 3 testy `game-rules` i 1 krok smoke. „Trafiły dokładnie” w kryterium 5.3 odnosi się więc do opisu commita, nie do planu.
- **Fix**: Nic do zmiany w kodzie; ten wpis zapisuje różnicę (pełna lista w test-plan §6.2 i w opisie PR #8).
- **Decision**: ACCEPTED — bez zmian; różnica zapisana w tym raporcie

### F9 — Dwa punkty §6.5 planu testów sklejone w jedną linię

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: context/foundation/test-plan.md:282
- **Detail**: „Jars” i „Break-check” stoją w jednej linii (`…jednorazowego gościa).- **Break-check**: …`), więc Markdown pokazuje drugi punkt jako dalszy ciąg pierwszego. Na `main` to były osobne linie; skleiła je ta gałąź.
- **Fix**: Rozdzielić na dwie linie.
- **Decision**: FIXED — punkty „Jars” i „Break-check” w osobnych liniach
