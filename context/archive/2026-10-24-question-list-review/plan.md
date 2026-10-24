# Przegląd listy pytań przed startem (S-06) — plan implementacji

## Overview

Host w poczekalni może otworzyć „Przejrzyj pytania”: gra losuje listę 15 pytań tej gry, a host usuwa pytanie, poprawia jego treść, dodaje własne albo dolosowuje kolejne. Gra gra najpierw pytania z listy w jej kolejności, a po jej końcu losuje dalej z wybranych kategorii jak dziś, bez pytań usuniętych i poprawionych. „Zacznij grę” bez przeglądu działa dokładnie jak dziś. Zmiana realizuje FR-012 (`context/foundation/prd.md:114`) i daje grze pełny CRUD na liście pytań (wymóg 10xBuilder).

## Current State Analysis

- Listy pytań gry nie ma. Pokój pamięta tylko kategorie (`supabase/migrations/20261007122858_room_lobby.sql:26-27`). Start losuje jedno id w Workerze (`src/pages/api/rooms/[id]/start.ts:29`), „Następne pytanie” i „Pomiń” wysyłają przetasowaną pulę (`next.ts:40`, `skip.ts:37`), a `private.open_next_round` bierze pierwsze niezagrane id (`20261020205751_round_number_required.sql:39-78`).
- Baza trzyma o pytaniu tylko `private.rounds.question_id` z CHECK formatu `<kategoria>-<NNN>` i kluczem `(room_id, question_id)` (`20261014101922_first_live_round.sql:112-126`). Treść dokleja Worker z `src/data/questions.ts` (`src/lib/rooms/server.ts:240-249`, `src/lib/rounds/draw.ts:83-85`). Pytanie własne nie ma takiego id.
- `room_lobby` (`20261022132240_latecomer_admission.sql:383-514`) zwraca `{status, role, me, players, round, requests}`; dane tylko dla hosta wzorem `requests` (`:405`, `:434-439`, klucz zawsze obecny, gość dostaje `[]`). Parser Workera kopiuje tylko znane klucze (`src/lib/rooms/shared.ts:174-195`) i dla rundy w głosowaniu i po odsłonie wymaga `question_id` jako tekstu (`shared.ts:136`).
- Zapisy hosta idą przez funkcje `security definer` z blokadą pokoju i odmową `room_unknown` dla nie-hosta (wzór `admit_latecomer`, `latecomer_admission.sql:281-303`); `start_game` sprawdza kolejno `room_unknown`, `room_closed`, `game_started`, `invalid_question`, `not_enough_players` (`first_live_round.sql:540-594`).
- `hostQuestionsLeft` liczy `questionPool(selection).length > round.number` (`server.ts:259-269`), czyli zakłada, że każda runda zużyła jedno pytanie z puli wybranych kategorii.
- Poczekalnia hosta: `RoomLobby.tsx:80-176` (lewa grupa `lg:sticky` z tytułem, linkiem, „Zacznij grę”; prawa kolumna „Gracze”). Akcje: `RoomAction` (`src/components/room/room-actions.ts:12`), `act()` w `RoomScreen.tsx:114-125`, trasy wzorem `admit.ts:14-36`.
- Szczegóły i kotwice: `context/changes/question-list-review/research.md`.

## Desired End State

- W poczekalni host widzi pod „Zacznij grę” przycisk „Przejrzyj pytania”. Pierwsze kliknięcie losuje listę 15 pytań z wybranych kategorii (18+ tylko tam, gdzie host je dołączył). Rozwinięta lista pokazuje każde pytanie jako końcówkę „Kto z nas najprawdopodobniej…”, z „Popraw” i „Usuń”, a pod listą „Dolosuj pytanie” (+1 na koniec) i pole „Dodaj własne pytanie” (do 90 znaków).
- Goście listy nie widzą, ani w przeglądarce, ani w odpowiedzi `/api/rooms/<id>/lobby`.
- Po „Zacznij grę” runda 1 to pierwsze pytanie z listy, kolejne rundy idą po liście, a po jej końcu gra losuje dalej z wybranych kategorii; pytanie usunięte albo poprawione w swojej wersji z bazy nie pada w tej grze. Pytanie własne i poprawione wszyscy widzą w rundzie jak każde inne.
- Bez otwarcia przeglądu gra działa jak dziś (te same testy smoke i e2e startu).
- Pusta lista przy starcie: odmowa „Lista pytań jest pusta. Dolosuj albo dodaj pytanie.”
- Weryfikacja: testy bazy `tests/db/question-list.test.ts`, pgTAP, testy jednostkowe, nowe kroki smoke, E2E `tests/e2e/question-list.spec.ts`, przeklikanie Karola na telefonie i laptopie.

### Key Discoveries:

- Decyzja D1 z S-03 zakładała, że S-06 zbuduje własną listę, a mechanizm kandydatów przyjmie z niej pytania (`context/archive/2026-10-15-full-game-evening/research.md:110`).
- Tabela w `private` bez kolumn czasu jest automatycznie objęta skanem pgTAP (granty, publikacja, kolumny porządku; `supabase/tests/round_creator_view.test.sql:363-422, 617-624`); liczba całkowita bez domyślnej wartości przechodzi. `join_requests` trafiło do `public` tylko z powodu `created_at` (`latecomer_admission.sql:22-24`).
- CHECK, którego wyrażenie daje `NULL`, jest spełniony, więc istniejący CHECK formatu `question_id` w `private.rounds` (`first_live_round.sql:117`) przepuszcza `null` bez zmian; wystarczy zdjąć `not null` (plan-review F4).
- `private.normalize_nick` (`first_live_round.sql:60-84`) to ogólna normalizacja tekstu (NFC, białe znaki, znaki niewidoczne, podwójne spacje) — nadaje się dla treści pytania.
- Zgodność starego Workera w oknie „baza przed kodem”: parser ignoruje nieznane klucze na górze i w rundzie głosowania/odsłony (`shared.ts:128-195`; precedens `latecomer_admission.sql:30-32`).
- `no_questions` ma tekst o kategoriach przy starcie (`src/lib/rooms/errors.ts:48`); trasa `next.ts:42-44` mapuje go na własny kod — ten sam wzór dla „Dolosuj”.

## What We're NOT Doing

- Zmiany kolejności pytań na liście (przeciąganie) i przywracania usuniętego pytania.
- Listy dla współhosta (S-07) i propozycji gości (S-10); lista jest tylko hosta.
- Zapisu danych o pytaniach i ocen jakości (S-11, S-12); zostawiamy tylko oznaczenie „usunięte” w wierszu listy.
- Panelu twórcy gry do przeglądu własnych pytań (FR-021, v2); własne pytania zostają w bazie razem z pokojem.
- Pilnowania w bazie, że kandydaci po końcu listy należą do wybranych kategorii (Q-04, `context/domain/domain-distillation.md:222`): pytania z listy wybiera baza, kandydatów po liście nadal podaje Worker jak dziś.
- Zmiany losowania „bez ostatnich wieczorów ekipy” (S-12) i zachowania przy wyczerpaniu bazy (Open Question 5).
- Potwierdzenia przy „Usuń” (pomyłkę naprawia „Dolosuj”) i odświeżania ekranów gości po zmianach listy (lista jest tylko hosta).

## Implementation Approach

- **Faza 1 — Baza:** migracja z tabelą `private.game_questions`, zmianą `private.rounds`, pięcioma funkcjami listy i nowymi wersjami `start_game`, `private.open_next_round`, `room_lobby` (te same sygnatury), plus testy bazy, pgTAP, dwa próbne alarmy i słownik. Stary Worker działa dalej, bo bez listy nic się nie zmienia.
- **Faza 2 — Serwer gry:** typy i parsery, wywołania bazy, 5 tras, treść rundy z bazy dla pytań własnych, licznik pozostałych pytań z listą, kody i teksty odmów, testy jednostkowe, kroki smoke.
- **Faza 3 — Ekran poczekalni:** sekcja „Przejrzyj pytania”, podglądy, zrzuty do oceny Karola, E2E.
- **Faza 4 — Wdrożenie:** dwie zaległe poprawki dokumentów, `db push` przed scaleniem, scalenie przez Karola, smoke na produkcji, przeklikanie.

Jedna gałąź `question-list-review`, jeden PR do `main` (migracje, `src/lib/rooms/`, `src/pages/api/rooms/`, `tests/` tylko przez PR z zielonym `db`, AGENTS.md). Cel: scalenie najpóźniej 31.10.2026, przed formularzami certyfikacji.

## Critical Implementation Details

- **Pozycja jest uchwytem wpisu.** Wpis listy ma stałą pozycję (1, 2, …); usunięcie tylko go oznacza, a nowy wpis dostaje `max(position) + 1`. Pozycji nigdy się nie przenumerowuje, więc ekran i trasy adresują wpis pozycją bez wyścigów z odświeżeniem.
- **`start_game` przy istniejącej liście ignoruje `p_question_id`.** Runda 1 to pierwszy nieusunięty wpis; parametr zostaje dla zgodności ze starym Workerem i ścieżką bez listy.
- **Pozostałe pytania z listą:** `left = P − B + E − n > 0`, gdzie `P` = pula wybranych kategorii, `B` = wiersze listy z id z bazy (także usunięte i poprawione), `E` = wiersze nieusunięte, `n` = numer bieżącej rundy. Bez listy `B = E = 0`, czyli wzór sprzed zmiany. Zmiany listy są możliwe tylko w poczekalni, więc w grze `B` i `E` są stałe.
- **Kolejność wdrożenia:** `db push` przed scaleniem kodu. Nowy parser wymaga kluczy `question_list` i `question_text`, których stara baza nie zwraca; stary Worker ignoruje je w nowej bazie.

## Faza 1: Baza

### Overview

Migracja z listą pytań gry, zmianą tabeli rund, pięcioma funkcjami listy i nowymi wersjami trzech funkcji gry, plus testy bazy, pgTAP, dwa próbne alarmy i nowe hasła słownika. Bez zmian w Workerze i ekranach.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/<timestamp>_question_list_review.sql` (nowy, `npx supabase migration new question_list_review`)

**Intent**: Lista pytań gry jako osobny byt należący do pokoju, edytowalny przez hosta tylko w poczekalni, z którego gra bierze pytania, zanim sięgnie po kandydatów od Workera.

**Contract**:

- **Tabela `private.game_questions`** (logged, jak `private.rounds`; bez grantów i polityk, dostęp tylko przez funkcje):
  - `room_id uuid not null` → `public.rooms (id) on delete cascade`; `position integer not null check (position between 1 and 100)`; `question_id text` (null dla pytania własnego) z CHECK formatu `^[a-z0-9-]+-[0-9]{3}$`; `text text` (null dla niezmienionego pytania z bazy) z CHECK `char_length(text) between 1 and 90`; `removed boolean not null default false`;
  - klucz `(room_id, position)`; `unique (room_id, question_id)`; CHECK `question_id is not null or text is not null`;
  - bez kolumn czasu, serial i identity (skan pgTAP).
- **`private.rounds`**: tylko `alter column question_id drop not null` (istniejący CHECK formatu zostaje, bo `null` go spełnia); nowa kolumna `list_position integer` z kluczem obcym `(room_id, list_position)` → `private.game_questions (room_id, position)`, `unique (room_id, list_position)` i CHECK `question_id is not null or list_position is not null`. Runda z wpisu listy dostaje `list_position`, a `question_id` tylko gdy wpis nie ma własnej treści (statystyki S-11 pod id z bazy nie mieszają brzmień).
- **`private.question_text(p_text text) returns text`** (`immutable`, `search_path = ''`, bez grantów): `private.normalize_nick(p_text)`, potem obcięcie końcowych `?` i spacji. Treść jest poprawna, gdy surowa ma najwyżej 400 znaków, a po normalizacji 1–90 znaków; inaczej odmowa `invalid_question_text`.
- **Pięć funkcji listy** — każda `security definer`, właściciel `postgres`, `search_path = ''`, `execute` tylko dla `authenticated`; blokada wiersza pokoju `for update`; kolejność wspólnych sprawdzeń: `auth.uid()` ≠ host albo brak pokoju → `room_unknown`, `closed` → `room_closed`, `playing` → `game_started`; odpowiedź `{ok: true}` albo `{ok: false, reason}`:
  - `public.open_question_list(p_room_id uuid, p_candidates text[])` — „Przejrzyj pytania”: lista ma już wiersze → `{ok: true}` bez zmian; ponad 1000 kandydatów → wyjątek 22023; zapis pierwszych 15 różnych kandydatów o poprawnym formacie w podanej kolejności jako pozycje 1–15; żadnego → `no_questions`.
  - `public.draw_list_question(p_room_id uuid, p_candidates text[])` — „Dolosuj pytanie”: 100 wierszy → `list_full`; ponad 1000 kandydatów → 22023; pierwszy kandydat o poprawnym formacie, którego nie ma w żadnym wierszu listy, na pozycję `max + 1`; żadnego → `no_questions`.
  - `public.remove_list_question(p_room_id uuid, p_position integer)` — brak wiersza albo już usunięty → `question_unknown`; ustawia `removed`.
  - `public.edit_list_question(p_room_id uuid, p_position integer, p_text text)` — brak wiersza albo usunięty → `question_unknown`; zła treść → `invalid_question_text`; ustawia `text` (id z bazy zostaje w wierszu, więc ta wersja pytania nie wróci po liście).
  - `public.add_own_question(p_room_id uuid, p_text text)` — zła treść → `invalid_question_text`; 100 wierszy → `list_full`; nowy wiersz bez id na pozycji `max + 1`.
- **`public.start_game(uuid, text)`** (`create or replace`, ta sama sygnatura i granty): po `game_started` — gdy pokój ma wiersze listy: pierwszy nieusunięty wpis według pozycji jako runda 1 (z `list_position`), brak takiego → `list_empty`, `p_question_id` bez znaczenia; bez listy jak dziś (`invalid_question`). Potem `not_enough_players` jak dziś.
- **`private.open_next_round(uuid, integer, text[])`** (`create or replace`): limit 1000 bez zmian; najpierw pierwszy nieusunięty wpis listy bez rundy o jego `list_position`; dopiero potem kandydaci jak dziś, dodatkowo z pominięciem każdego id obecnego w jakimkolwiek wierszu listy pokoju.
- **`public.room_lobby(uuid, text)`** (`create or replace`, ta sama sygnatura i granty): dwa nowe klucze.
  - na górze `question_list`: dla hosta, gdy pokój ma wiersze listy, we wszystkich statusach pokoju (w grze Worker liczy z niej pozostałe pytania), `{entries: [{position, question_id, text}] nieusuniętych w kolejności pozycji, base_count: liczba wierszy z question_id}`; w pozostałych przypadkach (gość, brak listy) `null`. Klucz zawsze obecny.
  - w rundzie w fazie `voting` i `revealed`: `question_text` — treść wpisu listy, gdy runda nie ma `question_id`, inaczej `null`. Faza `skipped` bez zmian.
- Granty: `revoke execute … from public, anon, authenticated` dla każdej nowej i zmienionej funkcji (także prywatnych), potem `grant execute` tylko według listy wyżej; `alter function … owner to postgres` dla funkcji definer (wzór `latecomer_admission.sql:518-540`). Komentarz na górze migracji: stary Worker nie wywołuje nowych funkcji, a bez listy start, następne pytanie i pominięcie działają jak przed migracją.

#### 2. Testy bazy

**File**: `tests/db/question-list.test.ts` (nowy), `tests/db/support/rounds.ts`, `tests/db/round-anonymity.test.ts`, `tests/db/round-rules.test.ts`, `context/foundation/test-plan.md`

**Intent**: Wyrocznia z FR-012 i decyzji Karola z planowania (lista po „Przejrzyj pytania”, 15 pytań, po liście losowanie dalej bez usuniętych, „Dolosuj” +1, limit 90 znaków), przez RPC jako host i gość, z pominięciem Workera (`test-plan.md` §6.2).

**Contract**:

- jeden host na plik (`newHost()`), wzór pliku `tests/db/latecomers.test.ts` (jeden `beforeAll` gra scenariusz, każdy `it` sprawdza zapisaną odpowiedź); w `test-plan.md:185` pozycja `question-list 1` (razem 13 kont);
- w `rounds.ts`: sondy `openQuestionList`, `drawListQuestion`, `removeListQuestion`, `editListQuestion`, `addOwnQuestion` z opisem kontraktu w komentarzu nagłówka (`:15-62`); `LOBBY_KEYS` + `question_list`, `VOTING_ROUND_KEYS` i `REVEALED_ROUND_KEYS` + `question_text`;
- przypadki (każda odmowa konkretnym kodem, kontrola pozytywna w pliku):
  - „Przejrzyj pytania” z 20 kandydatami → host widzi 15 wpisów w kolejności kandydatów i `base_count: 15`; gość widzi `question_list: null`; drugie otwarcie → nadal 15;
  - kandydaci o złym formacie są pomijani; 1001 kandydatów → błąd 22023;
  - „Usuń” pozycję 2 → znika z `entries`, `base_count` bez zmian; drugie „Usuń” tej pozycji → `question_unknown`;
  - „Popraw” pozycję 1 na „wypiłby mleko prosto z kartonu?” → treść bez końcowego „?”; 91 znaków i same spacje → `invalid_question_text`;
  - „Dodaj własne” → nowy wpis bez `question_id` na końcu;
  - „Dolosuj” → wpis z kandydatem spoza listy; gdy wszyscy kandydaci są już na liście → `no_questions`;
  - start → runda 1 bez `question_id` i z `question_text` poprawionej treści, ta sama treść u gościa; następne pytanie → pozycja 3 (pominięta usunięta 2); „Pomiń” bierze następny wpis z listy;
  - w trakcie gry host nadal dostaje `question_list` (16 wpisów, `base_count: 16`: 15 wylosowanych i 1 dolosowane), a gość `null` (wejście licznika pozostałych pytań);
  - po wyczerpaniu listy następne pytanie bierze pierwszego kandydata spoza listy: kandydaci w kolejności [usunięte id, id poprawionego, świeże id] → świeże id;
  - zmiany listy po starcie → `game_started`; w zamkniętym pokoju → `room_closed`;
  - drugi pokój tego hosta (`seedRoom(host, { confirmClose: true })`): lista z usuniętymi wszystkimi wpisami → start `list_empty`; potem własne pytania do 100 wierszy → `add_own_question` i `draw_list_question` dają `list_full`. Główny pokój zostaje przy 17 wierszach (15 + własne + dolosowane). Start bez listy pokrywają dotychczasowe pliki (`game-rules.test.ts` i inne), więc nie ma na niego osobnego pokoju;
  - funkcje listy od gościa jako anon → odmowa uprawnień (42501);
- `round-rules.test.ts` (`hostA`, `hostB`): pięć funkcji listy na cudzym pokoju → `room_unknown`;
- `round-anonymity.test.ts` sprawdza nowe zbiory kluczy.

#### 3. pgTAP: widok twórcy

**File**: `supabase/tests/round_creator_view.test.sql`

**Intent**: Katalog i granty nowej tabeli i funkcji; skan tabel `private` obejmie `game_questions` sam.

**Contract**:

- `game_questions`: `table_privs_are` puste dla `anon` i `authenticated`, poza publikacją `supabase_realtime`, `order_columns('game_questions') = 'none'` (obok kontroli `rounds`, `:559-592`);
- `function_facts` (`:426-455`) dla pięciu funkcji listy: `security definer | owner postgres | search_path="" | execute: authenticated`, każda w jednej wersji (`versions_of`); `start_game` i `room_lobby` nadal w jednej wersji;
- lista zostaje po zamknięciu pokoju: wiersze `game_questions` pokoju po „Nowa gra” są nadal obecne (decyzja: własne pytania i usunięcia zostają dla S-11 i twórcy gry);
- `plan(128)` (`:28`) podniesione do nowej liczby.

#### 4. Próbne alarmy

**File**: dwa tymczasowe commity na gałęzi (`test-plan.md` §6.2 „Break-check”)

**Intent**: Dowód, że nowe strażniki (gość nie widzi listy; usunięte pytanie nie wraca) potrafią zaświecić na czerwono.

**Contract**: dwa alarmy, każdy w osobnej tymczasowej migracji i każdy psuje dokładnie jedną rzecz (§6.2, po jednym alarmie na strażnika):

- A: `room_lobby` daje gościowi `question_list`; przewidziane czerwone tylko przypadki gościa z `question_list: null` w `question-list.test.ts` (w poczekalni i w trakcie gry), reszta zielona;
- B: `open_next_round` po końcu listy nie pomija kandydatów obecnych na liście; przewidziany czerwony tylko „po wyczerpaniu listy → świeże id”, reszta zielona (usterka nie przesuwa rund z listy, więc nie rozlewa się na dalszy scenariusz);
- kolejność: commit A, push za zgodą, porównanie z listą; `git revert` A i commit B, push za zgodą, porównanie; `git revert` B, push, CI znów zielone. Opis każdego commita wymienia jego przewidziane czerwone. Wynik dopisany w `test-plan.md` §6.2 jak poprzednie próbne alarmy.

#### 5. Słownik

**File**: `context/domain/glossary.md` (bez Prettiera, jak dotąd)

**Intent**: Nowe słowa w słowniku, zanim nazwie je migracja i Worker (AGENTS.md, Conventions).

**Contract**: „lista pytań gry” → `private.game_questions`, `question_list`, `QuestionList` (zamiast „dziś liczona w locie”); „pozostałe pytania” → niezagrane wpisy listy i niezagrane pytania wybranych kategorii spoza listy (`questionsLeft`, `hostQuestionsLeft`); nowe wiersze: „własne pytanie” (`text` bez `question_id`), „usunięcie pytania z listy” (`removed`; nie „pominięcie”), „dolosowanie pytania” (`draw_list_question`).

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- `npx prettier --check` dla nowych i zmienionych plików `.md` (bez `context/domain/glossary.md`) przechodzi
- Draft PR do `main` (push za zgodą Karola): CI zielone we wszystkich jobach, w `db` nowe testy `question-list.test.ts` i nowe asercje pgTAP przechodzą
- Próbne alarmy A i B: każdy tymczasowy commit zapala tylko swoje przewidziane testy `question-list.test.ts`; po ostatnim `git revert` CI zielone

#### Manual Verification:

- Karol czyta streszczenie migracji (tabela, zmiana rund, 5 funkcji, co widzi host, co gość) i je akceptuje

**Implementation Note**: Pierwszy push dopiero po zgodzie Karola; gałąź z upstreamem `origin/question-list-review`, nigdy `main`.

---

## Faza 2: Serwer gry

### Overview

Worker czyta listę z `room_lobby`, wystawia pięć akcji hosta, pokazuje treść pytania własnego w rundzie i liczy pozostałe pytania z listą. Bez zmian w wyglądzie ekranów.

### Changes Required:

#### 1. Typy i parsery stanu

**File**: `src/lib/rooms/shared.ts`

**Intent**: Lista z bazy dociera do Workera, a do przeglądarki tylko jako lista hosta w poczekalni; runda może mieć treść z bazy.

**Contract**:

- `LobbyState.question_list: {entries: {position: number; question_id: string | null; text: string | null}[]; base_count: number} | null`, parsowane polami jak `parsePlayers` (`:101-111`); brak klucza → `fail("question_list")`;
- `VotingRound` i `RevealedRound`: `question_id: string | null` i `question_text: string | null`; oba `null` → `fail("round.question_id")`;
- `RoomView` nie przenosi `question_list`; zamiast niego `questions: {position: number; text: string; own: boolean}[] | null` — tablica tylko dla hosta w poczekalni z listą, w pozostałych przypadkach `null`; `parseRoomView` to sprawdza;
- `QUESTION_MAX_LENGTH = 90` i `questionLength(text)` liczące jak baza (NFC, białe znaki, bez końcowych `?`), obok `nickLength` (`:233-235`).

#### 2. Wywołania bazy

**File**: `src/lib/rooms/server.ts`

**Intent**: Pięć opakowań RPC wzorem `admitLatecomer` (`:354-357`).

**Contract**: `openQuestionList(supabase, roomId, candidates)`, `drawListQuestion(supabase, roomId, candidates)`, `removeListQuestion(supabase, roomId, position)`, `editListQuestion(supabase, roomId, position, text)`, `addOwnQuestion(supabase, roomId, text)` → `Promise<ActionResult>` przez `callRpc` i `actionResult`; argumenty dokładnie `p_room_id`, `p_candidates`, `p_position`, `p_text`.

#### 3. Trasy hosta

**File**: `src/pages/api/rooms/[id]/question-list.ts`, `question-draw.ts`, `question-remove.ts`, `question-edit.ts`, `question-add.ts` (nowe), `src/lib/rooms/json-route.ts`, `src/components/room/room-actions.ts`

**Intent**: Akcje „Przejrzyj pytania”, „Dolosuj pytanie”, „Usuń”, „Popraw”, „Dodaj własne” wzorem `admit.ts:14-36`.

**Contract**:

- `RoomAction` + `question-list | question-draw | question-remove | question-edit | question-add`;
- ciała: `{}` dla listy i dolosowania, `{position}` dla usunięcia, `{position, text}` dla poprawki, `{text}` dla dodania; nowe pomocniki `bodyPosition` (liczba całkowita 1–100) i `bodyQuestionText` (tekst, najwyżej 400 znaków) obok `bodyNick` (`json-route.ts:124-130`), zły kształt → `invalid_body`;
- `question-list` i `question-draw` czytają wybór przez `hostRoomCategories` (nie-host → `OUTSIDE_ROOM`) i wysyłają `shuffledQuestions(selection, Math.random)`;
- `question-draw` mapuje `no_questions` na `no_new_questions` (wzór `next.ts:42-44`);
- bez `ringLobby`: lista jest tylko hosta, a `act()` i tak odświeża ekran hosta; nie zużywamy dzwonków gości (`test-plan.md` ryzyko #7).

#### 4. Treść rundy i pozostałe pytania

**File**: `src/lib/rooms/server.ts`, `src/lib/rounds/draw.ts`

**Intent**: Runda z pytaniem własnym pokazuje treść z bazy; licznik pozostałych pytań uwzględnia listę.

**Contract**:

- `roomView`: `question = round.question_text ?? questionText(round.question_id)`; log `unknown_question` tylko dla id z bazy (`:234, 244-246`), nigdy z treścią;
- `roomView` buduje `questions` dla hosta w `lobby`: `text` wpisu albo `questionText(question_id)`, `own: text !== null`; wpis z nieznanym id pomija z tym samym logiem;
- czysta funkcja `questionsLeft(poolSize, list, roundNumber)` w `draw.ts` liczy `P − B + E − n > 0` (Critical Implementation Details); `hostQuestionsLeft` używa jej z `lobby.question_list`.

#### 5. Kody i teksty odmów

**File**: `src/lib/rooms/errors.ts`, `tests/unit/room-errors.test.ts`

**Intent**: Każda nowa odmowa ma własne polskie zdanie (`room-errors.test.ts:61-86`).

**Contract**: `ROUND_REFUSALS`, `MESSAGES` i `PLANNED_ROUND_REFUSALS` + `question_unknown` („Tego pytania nie ma już na liście.”), `invalid_question_text` („Pytanie może mieć od 1 do 90 znaków.”), `list_full` („Na liście nie zmieszczą się kolejne pytania.”), `list_empty` („Lista pytań jest pusta. Dolosuj albo dodaj pytanie.”), `no_new_questions` („W wybranych kategoriach nie ma już nowych pytań. Dodaj własne.”). Teksty do akceptacji Karola.

#### 6. Testy jednostkowe

**File**: `tests/unit/room-state.test.ts`, `tests/unit/json-route.test.ts`, `tests/unit/room-rpc-gate.test.ts`, `tests/unit/draw.test.ts`, `tests/unit/announce.test.ts`

**Intent**: Kontrakty parserów, ciał, sygnatur RPC i licznika z wyrocznią pisaną ręcznie (`test-plan.md` §6.1).

**Contract**:

- `room-state`: każdy fixture + `question_list`; brak klucza, zły typ i wpis z błędnym polem → nazwane pole; runda z `question_text` i `question_id: null`; oba `null` → `round.question_id`; test „passes on no key outside the contract” (`:215-228`) z nowymi kluczami; `parseRoomView` z `questions`;
- `json-route`: `bodyPosition` i `bodyQuestionText` (`it.each` przypadków poprawnych i `undefined`);
- `room-rpc-gate`: wiersze `SQL_SIGNATURES` z kotwicami do nowej migracji dla 5 funkcji oraz `start_game` i `room_lobby` (nowe linie); przypadki akcji „Przejrzyj pytania”, „Dolosuj pytanie”, „Usuń pytanie”, „Popraw pytanie”, „Dodaj własne pytanie”;
- `draw`: `questionsLeft` — bez listy jak dawniej, lista z usuniętymi, poprawionymi i własnymi (przykład z liczbami w teście), brzeg `left = 0`;
- `announce`: próbki `RoomView` (`:36, 57`) z nowymi polami rundy i `questions: null`.

#### 7. Próbki stanu w podglądach

**File**: `src/pages/dev/room-states.astro`, `src/pages/dev/room-window.astro`

**Intent**: Typy się zgadzają: każda próbka `RoomView` dostaje `questions: null` (lista w fazie 3).

**Contract**: pomocniki `lobby(...)` itd. (`room-states.astro:113-200`) i `SAMPLES` (`room-window.astro:119-246`) z nowym polem.

#### 8. Smoke

**File**: `scripts/smoke.mjs`, `context/foundation/test-plan.md`

**Intent**: Na produkcji sprawdzić przegląd listy przez prawdziwe trasy, a główną grę smoke zostawić bez listy, żeby domyślna ścieżka „Zacznij grę” bez przeglądu nadal przechodziła smoke po każdym wdrożeniu (plan-review F1).

**Contract**:

- przełącznik `SMOKE_LIST` (domyślnie włączony, `SMOKE_LIST=0` na okno „baza przed kodem”), opis w nagłówku (`:3-12`), obok `SMOKE_ROUND`/`SMOKE_GAME` (`:23-25`);
- kroki listy w pokoju, który otwiera `closingSteps` (`:417-445`, w obu gałęziach), bez startu gry: dołącza gość (nowy słoik ciasteczek); host otwiera listę → `{"ok":true}`; host widzi 15 wpisów `questions`, gość `"questions":null`; host poprawia pozycję 1 na stałą treść smoke; usuwa pozycję 2, drugie usunięcie → 409 `question_unknown`; 91 znaków → 409 `invalid_question_text`; dodaje własne i dolosowuje → `{"ok":true}`;
- główna gra smoke (start z pustym ciałem `:304`, runda, wieczór) bez listy i bez zmian oczekiwań; pytanie własne w rundzie sprawdzają testy bazy i E2E;
- `test-plan.md` §6.5: nowy przełącznik i liczba kroków.

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- CI zielone na PR we wszystkich jobach, w `smoke` nowe kroki listy przechodzą

#### Manual Verification:

- Karol akceptuje pięć nowych tekstów odmów

**Implementation Note**: Push za zgodą Karola.

---

## Faza 3: Ekran poczekalni

### Overview

Sekcja „Przejrzyj pytania” w poczekalni hosta, podglądy, zrzuty do oceny Karola i E2E.

### Changes Required:

#### 1. Sekcja listy pytań

**File**: `src/components/room/QuestionList.tsx` (nowy)

**Intent**: Zwinięta sekcja pod „Zacznij grę”, która nie wydłuża ścieżki „start teraz”, a po rozwinięciu daje pełny przegląd listy.

**Contract**:

- zwinięta: przycisk `variant="outline"` „Przejrzyj pytania” z `aria-expanded` i `aria-controls`; gdy `questions === null`, pierwsze kliknięcie woła akcję `question-list` (spinner i `aria-disabled` jak w `JoinRequests.tsx:31-35, 73-89`), potem rozwija;
- rozwinięta: `section` z `h2` „Pytania (n)” (po tytule widoku w DOM), wiersz z prefiksem „Kto z nas najprawdopodobniej…”, `ul.divide-y.rounded-md.border` jak „Gracze”; wiersz: końcówka pytania (`min-w-0 flex-1 wrap-anywhere`), `Badge` „własne” dla `own`, przyciski `size="sm"` „Popraw” i „Usuń” z `aria-describedby` na tekst wiersza; błąd wiersza przez `ServerError`;
- „Popraw”: wiersz zmienia się w `Input` z licznikiem `n/90` (wzór licznika `NewGameForm.tsx:129-139`) oraz „Zapisz” i „Anuluj”; Enter zapisuje, Escape anuluje; walidacja długości przed wysłaniem;
- pod listą: „Dolosuj pytanie” i formularz „Dodaj własne pytanie” (pole z licznikiem, „Dodaj”);
- stałe `aria-live="polite"` `sr-only` z krótkim komunikatem po udanej akcji (wzór `JoinRequests.tsx:113-118`);
- fokus: po „Usuń” na „Popraw” następnego wiersza albo na „Dolosuj pytanie”, gdy to był ostatni; po „Zapisz” i „Anuluj” z powrotem na „Popraw” tego wiersza;
- tylko tokeny i klasy ze skali (AGENTS.md UI), ikony z `lucide-react`.

#### 2. Poczekalnia i ekran pokoju

**File**: `src/components/room/RoomLobby.tsx`, `src/components/room/RoomScreen.tsx`

**Intent**: Sekcja tylko dla hosta, w lewej grupie po bloku startu; długa lista nie chowa się pod przyklejoną kolumną.

**Contract**:

- `RoomLobby` renderuje `QuestionList` dla `role === "host"` po bloku startu (`:124-152`); lewa grupa traci `lg:sticky lg:top-6`, gdy lista jest rozwinięta;
- `RoomScreen`: wywołania `question-*` przez `act()` (poza `VIEW_CHANGING`, więc fokus nie skacze, `:76`), przekazane do `RoomLobby`;
- `LobbyPreview`/`ScreenPreview` (`RoomLobby.tsx:13-17`, `RoomScreen.tsx:25-33`) + pola podglądu listy (rozwinięta, edytowany wiersz z treścią, błąd wiersza, treść i błąd dodawania, otwieranie w toku).

#### 3. Podglądy

**File**: `src/pages/dev/room-states.astro`, `src/pages/dev/room-window.astro`

**Intent**: Każdy nowy stan ma podgląd (AGENTS.md UI).

**Contract**:

- `/dev/room-states`: host w poczekalni z listą zwiniętą bez listy; otwieranie w toku; lista rozwinięta 15 wpisów (w tym własne, poprawione i 90-znakowe); edycja wiersza; błąd wiersza; dodawanie z licznikiem ponad limit; start z odmową `list_empty`;
- `/dev/room-window`: próbka `lobby-host-questions` (lista rozwinięta, 8 graczy) do zrzutów okna.

#### 4. Zrzuty do oceny

**File**: strona HTML w scratchpadzie sesji (poza repo)

**Intent**: Karol ocenia wygląd przed E2E i scaleniem.

**Contract**: strona z sekcją „Co oceniasz”, otwarta w Chrome Karola; laptop jako całe okno 1:1 (`/dev/room-window?state=lobby-host-questions`, 1536×750, skala 1) i telefon w prawdziwej wielkości (390×844, skala 2), zrzuty headless Chrome przez CDP bez paska Astro; stany z `/dev/room-states` z sekcji 3.

#### 5. E2E

**File**: `tests/e2e/question-list.spec.ts` (nowy), `tests/e2e/support/*`

**Intent**: Pełna ścieżka hosta i gości w przeglądarce (CRUD listy i własne pytanie w grze).

**Contract**: wzór `tests/e2e/latecomer.spec.ts` (host na `page`, 2 goście z `newGuestContext`, `startGame`, `roundQuestion`); scenariusz: host otwiera „Przejrzyj pytania” → 15 wierszy; zapisuje treść wiersza 3; poprawia wiersz 1 na własną treść; usuwa wiersz 2; dodaje własne pytanie (widać je na końcu listy z „własne”); startuje → host i goście widzą „Kto z nas najprawdopodobniej <poprawiona treść>?”; wszyscy głosują, odsłona; „Następne pytanie” → treść wiersza 3. Goście nie widzą sekcji listy w poczekalni. Wyrocznia z ekranu hosta, nie z kodu.

### Success Criteria:

#### Automated Verification:

- Bramka lokalna przechodzi: `npm run lint` (z kontrolą literałów UI), `npx astro check`, `npm test`, `npm run build`
- CI zielone na PR, w `e2e` nowy `question-list.spec.ts` przechodzi w obu projektach (laptop i telefon)

#### Manual Verification:

- Karol ocenia zrzuty (laptop 1:1 i telefon) i akceptuje wygląd sekcji
- Przejście klawiaturą sekcji na `/dev/room-states` (Tab, Enter, Escape): fokus zostaje w sekcji i wraca według kontraktu

**Implementation Note**: Zrzuty przed E2E; poprawki wyglądu po ocenie Karola, potem E2E i push za zgodą.

---

## Faza 4: Wdrożenie

### Overview

Dwie zaległe poprawki dokumentów w tym samym PR, potem wdrożenie według `context/deployment/deploy-plan.md`: baza, scalenie, smoke, przeklikanie.

### Changes Required:

#### 1. Zaległe poprawki dokumentów

**File**: `AGENTS.md`, `context/architect-report.md`

**Intent**: Zdanie o tym, co zatrzymuje czerwone `db`, jest nieaktualne od rulesetu „main: tylko przez PR” (23.10.2026); raport Architect (do formularza certyfikacji) ma 3 numery commitów sprzed przepisania historii.

**Contract**:

- `AGENTS.md`, Hard Rules: zdanie „Until test-plan §3 Phase 4, nothing else stops a red `db` from reaching production.” zastąpione stanem dzisiejszym: ruleset `main` scala PR tylko po zielonych `ci`, `smoke`, `db` i `e2e`, a bezpośredni push na `main` jest zablokowany;
- `context/architect-report.md`: `0fad991` → `b706ec9`, `d4bff27a` → `26844054`, `957bb6d3` → `4823cfc7` (mapa `context/deployment/history-rewrite-2026-10-22.md:188, 121, 86`).

#### 2. Baza na produkcji

**File**: — (polecenia, każde za zgodą Karola, z domu albo przez hotspot, nie z eduroam)

**Intent**: Baza przed kodem.

**Contract**: `npx supabase db push --dry-run` (tylko nowa migracja), `npx supabase db push`, `npx supabase migration list`; Advisors → Security bez błędów (nowe funkcje tylko dla `authenticated`).

#### 3. Scalenie i sprawdzenie

**File**: —

**Intent**: Kod na produkcji i dowód, że działa.

**Contract**: `gh pr ready`, scalenie przez Karola (`! gh pr merge <n> --merge`), CI na `main` zielone, smoke na produkcji (`BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke`, za zgodą), przeklikanie Karola.

### Success Criteria:

#### Automated Verification:

- `npx prettier --check AGENTS.md context/architect-report.md` przechodzi, a `git grep -n -E "0fad991|d4bff27a|957bb6d3" context/architect-report.md` nic nie znajduje
- `npx supabase db push --dry-run` pokazuje tylko migrację `question_list_review`; po `db push` `migration list` ma ją lokalnie i zdalnie
- Po scaleniu CI na `main` zielone i smoke na produkcji zielony

#### Manual Verification:

- Advisors → Security: 0 błędów
- Karol przeklikuje na telefonie i laptopie: „Przejrzyj pytania”, usuń, popraw, dodaj własne, dolosuj, start z poprawionym pytaniem u gości; nowa gra i „Zacznij grę” bez przeglądu działają jak dawniej

**Implementation Note**: `db push` przed scaleniem; po scaleniu smoke tylko za zgodą.

---

## Testing Strategy

### Unit Tests:

- Parsery `question_list`, `question_text`, `questions` (nazwane pola, brak kluczy spoza kontraktu).
- Pomocniki ciał `bodyPosition`, `bodyQuestionText`.
- Brama RPC: 5 nowych funkcji, nowe kotwice `start_game` i `room_lobby`.
- `questionsLeft`: bez listy jak dawniej, lista z usuniętymi, poprawionymi i własnymi, brzeg zera.
- Teksty odmów: 5 nowych kodów, każdy z własnym zdaniem.

### Integration Tests:

- `tests/db/question-list.test.ts`: cykl listy, odmowy, gra z listy i po liście, lista hosta w trakcie gry (licznik), prywatność gościa.
- pgTAP: granty, wersje funkcji, skan `private`, lista po zamknięciu.
- Smoke: przegląd listy przez prawdziwe trasy na produkcji w osobnym pokoju po wieczorze; główna gra smoke bez listy.
- E2E: host przegląda, gracze widzą poprawione pytanie, usunięte nie pada.

### Manual Testing Steps:

1. Telefon (host) + laptop i drugi telefon (goście): załóż grę, „Przejrzyj pytania”, usuń 2 pytania, popraw 1, dodaj 1 własne, dolosuj 1.
2. Sprawdź u gościa w poczekalni, że listy nie widać.
3. „Zacznij grę”: wszyscy widzą poprawione pytanie; po odsłonie „Następne pytanie” nie pokazuje usuniętego.
4. Nowa gra bez przeglądu: „Zacznij grę” działa jak dawniej.
5. Usuń wszystkie pytania i spróbuj wystartować: odmowa „Lista pytań jest pusta…”.

## Performance Considerations

- Lista ma najwyżej 100 wierszy na pokój; `room_lobby` czyta ją dla hosta przy każdym odpytaniu (co 15 s i po dzwonku) — mała tabela z kluczem `(room_id, position)`.
- Zmiany listy nie dzwonią do gości, więc nie zużywają dziennego limitu żądań (`test-plan.md` ryzyko #7).

## Migration Notes

- Migracja tylko dodaje i rozluźnia (`question_id` może być `null` tylko z `list_position`); istniejące rundy spełniają nowe CHECK bez zmian danych.
- Okno „baza przed kodem”: stary Worker nie wywołuje nowych funkcji, bez listy start, następne pytanie i pominięcie działają jak dawniej, a nowe klucze `room_lobby` są przez niego ignorowane.
- Wycofanie: po `db push` błąd w kodzie naprawiamy nową migracją albo cofnięciem kodu (`npx wrangler rollback` tylko za zgodą); wgranej migracji się nie edytuje.
- Po pierwszej grze z listą cofnięcie Workera psuje pokoje, w których bieżąca runda ma pytanie własne albo poprawione: stary parser wymaga tekstowego `question_id` (`shared.ts:136`), więc `/lobby` odpowiada 500. Wtedy naprawiamy do przodu (poprawka kodu albo nowa migracja), a rollback zostaje na awarię wszystkich pokojów.

## References

- Research: `context/changes/question-list-review/research.md`
- PRD FR-012: `context/foundation/prd.md:114-115`; roadmapa S-06: `context/foundation/roadmap.md:177-187`
- Precedens S-08: `context/changes/latecomer-admission/plan.md`, `supabase/migrations/20261022132240_latecomer_admission.sql`
- Decyzja D1 (kandydaci): `context/archive/2026-10-15-full-game-evening/research.md:104-112`
- Reguła pytań po stronie serwera: `context/foundation/lessons.md:12-17`
- Testy: `context/foundation/test-plan.md` §6; wdrożenie: `context/deployment/deploy-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza

#### Automated

- [x] 1.1 Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — 0890a4d
- [x] 1.2 `npx prettier --check` dla nowych i zmienionych plików `.md` (bez `context/domain/glossary.md`) przechodzi — 0890a4d
- [x] 1.3 Draft PR do `main` (push za zgodą Karola): CI zielone we wszystkich jobach, w `db` nowe testy `question-list.test.ts` i nowe asercje pgTAP przechodzą — 0890a4d
- [x] 1.4 Próbne alarmy A i B: każdy tymczasowy commit zapala tylko swoje przewidziane testy `question-list.test.ts`; po ostatnim `git revert` CI zielone — 7a6919e

#### Manual

- [x] 1.5 Karol czyta streszczenie migracji (tabela, zmiana rund, 5 funkcji, co widzi host, co gość) i je akceptuje — 0890a4d

### Phase 2: Serwer gry

#### Automated

- [x] 2.1 Bramka lokalna przechodzi: `npm run lint`, `npx astro check`, `npm test`, `npm run build` — 3314437
- [x] 2.2 CI zielone na PR we wszystkich jobach, w `smoke` nowe kroki listy przechodzą — 3314437

#### Manual

- [x] 2.3 Karol akceptuje pięć nowych tekstów odmów — 3314437

### Phase 3: Ekran poczekalni

#### Automated

- [x] 3.1 Bramka lokalna przechodzi: `npm run lint` (z kontrolą literałów UI), `npx astro check`, `npm test`, `npm run build` — f8b7e5c
- [x] 3.2 CI zielone na PR, w `e2e` nowy `question-list.spec.ts` przechodzi w obu projektach (laptop i telefon) — f8b7e5c

#### Manual

- [x] 3.3 Karol ocenia zrzuty (laptop 1:1 i telefon) i akceptuje wygląd sekcji — f8b7e5c
- [x] 3.4 Przejście klawiaturą sekcji na `/dev/room-states` (Tab, Enter, Escape): fokus zostaje w sekcji i wraca według kontraktu — f8b7e5c

### Phase 4: Wdrożenie

#### Automated

- [x] 4.1 `npx prettier --check AGENTS.md context/architect-report.md` przechodzi, a `git grep -n -E "0fad991|d4bff27a|957bb6d3" context/architect-report.md` nic nie znajduje — ceb39b1
- [x] 4.2 `npx supabase db push --dry-run` pokazuje tylko migrację `question_list_review`; po `db push` `migration list` ma ją lokalnie i zdalnie — ceb39b1
- [x] 4.3 Po scaleniu CI na `main` zielone i smoke na produkcji zielony — ceb39b1

#### Manual

- [x] 4.4 Advisors → Security: 0 błędów — ceb39b1
- [x] 4.5 Karol przeklikuje na telefonie i laptopie: „Przejrzyj pytania”, usuń, popraw, dodaj własne, dolosuj, start z poprawionym pytaniem u gości; nowa gra i „Zacznij grę” bez przeglądu działają jak dawniej — ceb39b1
