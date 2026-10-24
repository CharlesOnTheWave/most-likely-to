<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Przegląd listy pytań przed startem (S-06)

- **Plan**: context/changes/question-list-review/plan.md
- **Mode**: Deep
- **Date**: 2026-10-24
- **Verdict**: REVISE (drobne, ukierunkowane poprawki; podejście i model danych dobre); po poprawkach z 2026-10-24: SOUND
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | WARNING |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

Grounding: 24/24 paths ✓, 10/10 symbols ✓, brief↔plan ✓, Progress↔Fazy ✓ (4 fazy, 14 kryteriów, jedna sekcja `## Progress`)

Potwierdzone w kodzie:

- Kolumnowy CHECK `question_id` w `private.rounds` (`20261014101922_first_live_round.sql:117`) nazywa się według reguły Postgresa `rounds_question_id_check`, jak `rounds_phase_check` (`20261015122252_full_game_evening.sql:28`). `NULL` spełnia każdy CHECK, a `unique (room_id, question_id)` (`:125`) dopuszcza wiele `NULL`, więc rundy z pytaniem własnym nie kolidują z kluczem.
- `question_id` rundy czytają w SQL tylko `open_next_round` (`20261020205751_round_number_required.sql:53-70`) i `room_lobby` (`20261022132240_latecomer_admission.sql:442-482`). `drop_round_state` i `close_stale_games` rund nie kasują, więc klucz obcy `rounds → game_questions` nie zablokuje zamknięcia pokoju.
- Zgodność starego Workera w oknie „baza przed kodem” trzyma się. `parseLobbyState` składa obiekt tylko ze znanych kluczy (`src/lib/rooms/shared.ts:189,194`), a `parseRound` kopiuje tylko znane klucze rundy w głosowaniu i po odsłonie (`:143-153`, `:160-169`). Stary Worker bez listy wysyła te same wywołania `start_game`, `next_round` i `skip_round`, a nowy filtr „poza listą” jest bez listy pusty.
- Runda pominięta odrzuca każdy dodatkowy klucz (`shared.ts:133-134`). Plan słusznie zostawia ją bez `question_text` („Faza `skipped` bez zmian”).
- Wzór licznika `P − B + E − n` jest poprawny, sprawdzony na usuniętych, poprawionych, własnych i dolosowanych wpisach oraz na pominiętej rundzie, która zostaje ostatnia (wtedy `n = E + P − B`, więc wynik to 0). Warunek: lista hosta dociera do Workera także w trakcie gry (F3).
- `question_id` w przeglądarce nie jest kluczem niczego. Klucze React, `announcementKey` i porównanie widoku opierają się na `round.number` albo całym JSON (`RoomScreen.tsx:154,168,185`, `announce.ts:10`, `useRoomState.ts:219-221`), więc dwie rundy z rzędu z `null` są bezpieczne.
- `statusFor` daje 409 każdemu nieznanemu powodowi (`json-route.ts:132-138`), więc pięć nowych kodów nie potrzebuje wpisu. `MESSAGES` wymaga wpisów, inaczej gracz zobaczy „Coś poszło nie tak” (`errors.ts:61-64`).
- `room-rpc-gate.test.ts` ma ręczną tabelę i nie czyta migracji, więc faza 1 nie zaczerwieni `npm test`. Wiersze w fazie 2 tego samego PR spełniają §6.1.
- `scripts/ui-literals.mjs:17` czyta cały `src/components/room`, więc `QuestionList.tsx` jest sprawdzany bez dopisywania.
- Pula e2e to jedna kategoria (`tests/e2e/support/room.ts:34`), czyli 20 pytań bez 18+. Starcza na 15 pytań listy i jedno dolosowanie.
- Lokatory e2e w poczekalni (`/^Gracze/`, „Link dla graczy”, „Zacznij grę”) nie zderzą się z sekcją „Pytania (n)”.
- Zaległe poprawki dokumentów są zgodne z mapą. `0fad991` → `b706ec9`, `d4bff27a` → `26844054`, `957bb6d3` → `4823cfc7` (`history-rewrite-2026-10-22.md:188,121,86`), a zdanie do wymiany stoi w `AGENTS.md:10`.
- Trzy decyzje „Plan” się bronią:
  - poprawione pytanie gra jako własne, zgodnie z regułą id w `questions.ts:6-9`;
  - usunięcie bez potwierdzenia, bo pomyłkę naprawia „Dolosuj”;
  - odmowa przy pustej liście.

## Findings

### F1 — Smoke na produkcji przestaje sprawdzać „Zacznij grę” bez przeglądu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Faza 2 #8 (Smoke) vs Desired End State („Bez otwarcia przeglądu gra działa jak dziś (te same testy smoke i e2e startu)”)
- **Detail**: Smoke gra jedną grę w jednym pokoju: start z pustym ciałem (`scripts/smoke.mjs:304`), następne pytanie, pominięcie, odsłona i koniec (`:380-407`). Pokój po końcu (`:431`) gry już nie startuje. Plan wstawia kroki listy „w poczekalni przed startem” tego samego pokoju, więc jedyna gra smoke zawsze startuje z listą. Gałąź `start_game` bez listy, z `p_question_id` (czyli domyślna ścieżka każdego wieczoru), znika ze smoke na produkcji. Zostaje tylko w e2e w CI na lokalnej bazie. To wprost przeczy zdaniu o „tych samych testach smoke” w stanie końcowym, a dotyczy dokładnie tej ścieżki, którą migracja zmienia (`create or replace start_game`).
- **Fix A ⭐ Recommended**: Kroki listy w osobnym pokoju po wieczorze. W pokoju z kroku „new game after the end opens a room without asking” (`smoke.mjs:431`): dołącza gość, a dalej otwarcie listy, 15 wpisów u hosta i `"questions":null` u gościa, poprawka, dwa usunięcia (drugie 409), 91 znaków (409), własne i dolosowanie. Bez startu w tym pokoju. Główna gra zostaje bez listy, jak dziś.
  - Strength: domyślna ścieżka nadal przechodzi smoke na produkcji po każdym wdrożeniu, a kroki listy da się wyłączyć `SMOKE_LIST=0` bez ruszania gry.
  - Tradeoff: smoke nie pokaże na produkcji rundy z pytaniem własnym. To pokrywają testy bazy (ta sama migracja) i e2e na prawdziwym buildzie.
  - Confidence: HIGH — struktura `closingSteps` (`smoke.mjs:417-445`) już otwiera ten pokój.
  - Blind spot: liczba kroków w `test-plan.md` §6.5 do przeliczenia tak czy inaczej.
- **Fix B**: Zostawić listę w głównej grze i dopisać do Desired End State, że start bez listy na produkcji sprawdza tylko e2e w CI.
  - Strength: smoke pokazuje na produkcji pytanie własne w rundzie.
  - Tradeoff: domyślna ścieżka bez strażnika na produkcji. A to ona będzie na wieczorze w 90%.
  - Confidence: MEDIUM — zmiana `start_game` jest mała, ale to jedyna droga do gry.
  - Blind spot: none significant.
- **Decision**: FIXED (Fix A)

### F2 — Próbny alarm: dwie usterki w jednym commicie i niepełna lista czerwonych

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 #4 (Próbny alarm), kryterium 1.4
- **Detail**:
  - `test-plan.md` §6.2 „Break-check” każe psuć „dokładnie jedną rzecz” (po jednym alarmie na strażnika, jak 14.10). Plan psuje w jednej tymczasowej migracji dwie: `room_lobby` daje gościowi listę, a `open_next_round` nie pomija usuniętych.
  - Druga usterka nie zaświeci tylko „następne pytanie → pozycja 3”. Scenariusz gra się raz, po kolei, w `beforeAll` (wzór `latecomers.test.ts`). Gdy runda 2 weźmie usuniętą pozycję 2, „Pomiń” weźmie pozycję 3 zamiast 4, a lista skończy się o rundę później. Czerwone będą więc też „Pomiń bierze następny wpis” i zapewne „po wyczerpaniu listy → świeże id”.
  - Plan przewiduje „reszta zielona”. Według §6.2 („przewidziany, który został zielony, albo inny czerwony → zatrzymaj się”) alarm wypadnie więc jako nieudany i zabierze dodatkowy push i przebieg CI.
- **Fix**: Dwa osobne commity alarmu (A: gość widzi listę, czerwony tylko „gość widzi `question_list: null`”; B: usterka po liście, np. `open_next_round` nie pomija kandydatów obecnych na liście, czerwony tylko „po wyczerpaniu listy → świeże id”). Pushe: A → revert A + B → revert B. Albo przy obecnej usterce B wypisać w opisie commita każdy test scenariusza po rundzie 2.
- **Decision**: FIXED

### F3 — Licznik pozostałych pytań: wejście w trakcie gry bez testu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 1 #1 (`room_lobby`, `question_list`) i #2 (testy bazy); Faza 2 #4 (`questionsLeft`)
- **Detail**:
  - Wzór `P − B + E − n` działa tylko wtedy, gdy `room_lobby` daje hostowi `question_list` także w statusie `playing`. Kontrakt na to pozwala („dla hosta, gdy pokój ma wiersze listy”), ale reszta planu mówi o „liście hosta w poczekalni”, a żaden test tego nie przypina. Test bazy sprawdza listę tylko w poczekalni, unit liczy wzór na liczbach z ręki, a smoke i e2e nie dochodzą do końca puli.
  - Jeśli implementacja odda listę tylko w `lobby`, `hostQuestionsLeft` po cichu wróci do starego wzoru (`B = E = 0`). Przykład: jedna kategoria (20 pytań), lista 15 i 5 własnych, bez usunięć. Prawda to `25 − n`, stary wzór `20 − n`.
  - Skutek: po odsłonie rundy 20 host widzi tylko „Zakończ grę” (`RoundReveal.tsx:234`, `HostActions.tsx:62`), choć zostało 5 pytań.
- **Fix**: W `question-list.test.ts` jeden przypadek: w trakcie gry host dostaje `question_list` z `entries.length` = 16 i `base_count` = 16 (15 + dolosowane), a gość `null`. W kontrakcie `room_lobby` dopisać „we wszystkich statusach (licznik pozostałych pytań w grze)”.
- **Decision**: FIXED

### F4 — Zbędna wymiana CHECK w `private.rounds`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Faza 1 #1 (`private.rounds`); brief, Open Risks (nazwa `rounds_question_id_check`)
- **Detail**: CHECK, którego wyrażenie daje `NULL`, jest spełniony, więc istniejący `check (question_id ~ '^[a-z0-9-]+-[0-9]{3}$')` już przepuszcza `question_id is null`. Zdjęcie `rounds_question_id_check` i założenie równoważnego `question_id is null or …` niczego nie zmienia, a jest jedynym miejscem, w którym migracja zależy od nazwy nadanej automatycznie (ryzyko z briefu, sprawdzane dopiero w CI).
- **Fix**: Tylko `alter table private.rounds alter column question_id drop not null;` plus nowe `list_position`, klucz obcy, `unique` i CHECK „id albo pozycja”. Ryzyko o nazwie CHECK skreślić z briefu.
- **Decision**: FIXED

### F5 — Testy bazy: gdzie sprawdzić `list_full`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 #2 (przypadki `question-list.test.ts`)
- **Detail**:
  - „100 wierszy listy → `list_full`” stoi w liście przypadków bez wskazania pokoju. W głównym pokoju dopełnienie do 100 wierszy (ok. 83 wywołania `add_own_question`) wydłuży listę, a przypadek „po wyczerpaniu listy” wymaga potem przejścia przez wszystkie wpisy: ok. 99 rund zamiast 16.
  - Pokój bez listy startujący „jak dziś” pokrywają już wszystkie dotychczasowe pliki (`game-rules`, `round-rules`, `latecomers`). Trzeci pokój tylko po to nie jest potrzebny.
- **Fix**: `list_full` (dla `add_own_question` i `draw_list_question`) w drugim pokoju, po sprawdzeniu `list_empty`. Główny pokój zostaje przy 17 wierszach (15 + własne + dolosowane). Przypadek „pokój bez listy” skreślić albo opisać jako pokryty przez `game-rules.test.ts`.
- **Decision**: FIXED

### F6 — Wycofanie Workera po pierwszym pytaniu własnym psuje pokoje w grze

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Migration Notes („Wycofanie: … cofnięciem kodu (`npx wrangler rollback` …)”)
- **Detail**: Stary parser odrzuca rundę w głosowaniu albo po odsłonie z `question_id` innym niż tekst (`shared.ts:136`). `roomLobby` daje wtedy `unexpected`, a `/lobby` odpowiada 500 (`server.ts:231`, `lobby.ts:29`). Po `wrangler rollback` każdy pokój, w którym bieżąca runda jest pytaniem własnym albo poprawionym, pokaże więc błąd. Poza tym okno „baza przed kodem” jest bezpieczne (Grounding).
- **Fix**: Dopisać w Migration Notes: „Po pierwszej grze z listą `wrangler rollback` psuje pokoje z pytaniem własnym w bieżącej rundzie; błąd naprawiamy do przodu (poprawka kodu albo nowa migracja), rollback tylko przy awarii wszystkich pokojów”.
- **Decision**: FIXED

### F7 — Drobne braki w liście plików i kolejności

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 3 #6 (Słownik), Faza 2 #6–#7
- **Detail**:
  - AGENTS.md każe czytać słownik, zanim cokolwiek się nazwie, a plan dopisuje nowe hasła („lista pytań gry” → `game_questions`, „usunięcie pytania z listy”, „własne pytanie”, „dolosowanie pytania”) dopiero w fazie 3, gdy nazwy są już w migracji i Workerze.
  - Hasło „pozostałe pytania” (`glossary.md:61`: „niezagrane pytania z wybranych kategorii”) po S-06 obejmuje też wpisy listy, a „lista pytań gry” ma dziś w kodzie „liczona w locie: `poolFrom`, `p_candidates`”. Oba hasła trzeba zmienić, nie tylko dopisać nowe.
  - Próbki `RoomView` z rundą są także w `tests/unit/announce.test.ts:36,57` (pliku nie ma w planie), a bramka `npx astro check` złapie to dopiero w fazie 2.
- **Fix**: Wpisy słownika przenieść do fazy 1 (razem z poprawką „pozostałe pytania” i „lista pytań gry”); `tests/unit/announce.test.ts` dopisać do plików fazy 2 #6.
- **Decision**: FIXED
