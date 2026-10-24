---
date: 2026-10-24T10:19:40+02:00
researcher: Claude (claude-opus-5-5)
git_commit: d141baa
branch: question-list-review
repository: most-likely-to
topic: "S-06: jak dziś gra wybiera, trzyma i pokazuje pytania i co musi powstać, żeby host przed startem przejrzał listę pytań gry (FR-012)"
tags: [research, codebase, questions, draw, room-lobby, start_game, open_next_round, s-06]
status: complete
last_updated: 2026-10-24
last_updated_by: Claude (claude-opus-5-5)
---

# Research: S-06, przegląd listy pytań gry przed startem

**Date**: 2026-10-24T10:19:40+02:00
**Researcher**: Claude (claude-opus-5-5)
**Git Commit**: d141baa
**Branch**: question-list-review
**Repository**: most-likely-to

## Research Question

Jak dziś gra wybiera, przechowuje i dostarcza pytania (od założenia pokoju po ekran rundy) i jakie decyzje,
ograniczenia oraz obowiązki testowe obowiązują S-06: host w poczekalni może opcjonalnie przejrzeć wylosowaną listę
pytań gry (usunąć pytanie, dolosować nowe, poprawić treść, dodać własne), a domyślną ścieżką zostaje „start teraz”
(`context/foundation/prd.md:114`, `context/foundation/roadmap.md:177-187`).

## Summary

1. **Listy pytań gry dziś nie ma.** Pokój przechowuje o pytaniach tylko wybór kategorii (`rooms.categories`,
   `rooms.adult_categories`, `supabase/migrations/20261007122858_room_lobby.sql:26-27`). Na trzech sprawdzonych
   ścieżkach Worker liczy pozostałe pytania od nowa z `src/data/questions.ts`: „Zacznij grę” bierze jedno losowe
   (`src/pages/api/rooms/[id]/start.ts:29`, `src/lib/rounds/draw.ts:42-49`), a „Następne pytanie” i „Pomiń pytanie”
   wysyłają całą przetasowaną pulę jako `p_candidates` (`next.ts:40`, `skip.ts:37`, `draw.ts:54-65`). Baza bierze
   pierwszego niezagranego kandydata (`20261020205751_round_number_required.sql:54-61`). To decyzja D1 W-B z S-03,
   która zakładała, że „S-06 i tak zbuduje własną listę, a W-B przyjmie z niej kandydatów”
   (`context/archive/2026-10-15-full-game-evening/research.md:110`).
2. **Baza nie trzyma treści pytań.** Na sprawdzonych ścieżkach start / next / skip o pytaniu zapisuje się
   `private.rounds.question_id`, jeden wiersz na rozegraną rundę (`20261014101922_first_live_round.sql:112-126`), z
   CHECK formatu `^[a-z0-9-]+-[0-9]{3}$` (`:117`) i kluczem `unique (room_id, question_id)` (`:125`). Treść dokleja
   Worker w `roomView` przez `questionText(id)` (`src/lib/rooms/server.ts:240-249`, `draw.ts:83-85`), który zna
   wyłącznie własne klucze `QUESTIONS`.
3. **Główny koszt S-06:** pytanie własne albo z poprawioną treścią nie ma id z bazy pytań, a format id sprawdzają trzy
   miejsca w bazie (CHECK w `private.rounds` `first_live_round.sql:117`, `start_game` `:572-574`, filtr
   `open_next_round` `round_number_required.sql:55`) i jedno w Workerze (`questionText`, `draw.ts:83-85`). S-06
   potrzebuje więc migracji z listą pytań gry, która przechowuje treść (albo jej nadpisanie), oraz zmian w start /
   next / skip i w tym, skąd ekran rundy bierze treść.
4. **Ekran:** poczekalnia hosta (`src/components/room/RoomLobby.tsx:80-176`) ma w lewej grupie tytuł, link i „Zacznij
   grę”; nowa sekcja hosta wejdzie tam albo jako osobny region. Dane przychodzą jednym źródłem, `GET
/api/rooms/<id>/lobby` (`src/pages/api/rooms/[id]/lobby.ts:50-79`), a akcje hosta idą wzorcem tras JSON
   (`start.ts:13-35`, `src/lib/rooms/json-route.ts`). Limit ciała JSON to 4096 bajtów (`json-route.ts:13`), więc
   zmiany listy idą po jednym pytaniu, nie całą listą.
5. **Wdrożenie:** baza przed kodem, a stary Worker musi działać po `db push` (`context/deployment/deploy-plan.md:57`).
   Smoke i e2e startują grę bez przeglądu (`scripts/smoke.mjs:304` z pustym ciałem, `tests/e2e/support/round.ts:19-22`
   przez przycisk), więc „start teraz” bez otwierania listy musi działać jak dziś.
6. **Do decyzji w planie** (sekcja Open Questions): kiedy lista powstaje i ile ma pytań, co po jej wyczerpaniu,
   tożsamość pytania z poprawioną treścią (dane S-11 zapisywane pod id), czy S-06 zapisuje usunięcia dla S-11, limit
   długości własnego pytania i czy baza ma pilnować, że runda gra pytanie z listy gry (Q-04).

## Detailed Findings

### 1. Wspólna baza pytań

- Statyczny moduł TypeScript, bez tabeli: `QUESTIONS = { "<id>": { category, text, adult } }`
  (`src/data/questions.ts:40-716`), `QuestionEntry` `:34-38`, `CATEGORIES` (8 kategorii) `:21-30`, `QuestionId`
  `:718`.
- Rozmiar w tej rewizji: 216 wpisów o kluczu `<kategoria>-<NNN>` i 58 z `adult: true` (policzone grepem w tej sesji na
  `src/data/questions.ts`); badacz podał 27 na kategorię.
- Reguły id (`questions.ts:4-11`): id się nie zmienia, nie wraca i nie znika; poprawka literówki zostawia id, zmiana
  sensu dostaje nowe id; kategorii nie wyprowadza się z id; dane o pytaniu z S-11 będą zapisywane pod id.
- `text` to końcówka po „Kto z nas najprawdopodobniej”, małą literą, bez „?”, najwyżej 90 znaków
  (`questions.ts:14-16`).

### 2. Kiedy i gdzie wybierane są pytania

- **Założenie pokoju:** `src/pages/api/rooms/index.ts:23-31` sprawdza `category` i `adult` względem `CATEGORIES`,
  `createRoom` (`server.ts:118-141`) woła `create_room(...)` (`first_live_round.sql:220-302`), który sprawdza tylko
  kształt tablic (`:254-258`) i zapisuje je w `public.rooms` (`:284-290`). Żadne pytanie nie jest wtedy losowane.
- **Start (runda 1):** `start.ts:25` czyta wybór przez RLS (`hostRoomCategories`, `server.ts:401-417`), `start.ts:29`
  losuje jedno id (`drawQuestion`), pusta pula daje `no_questions` (`start.ts:30`). `start_game(p_room_id,
p_question_id)` (`first_live_round.sql:540-597`, od tamtej pory nie zmieniana według badacza) wymaga `lobby`
  (`:564-570`), sprawdza format id albo odpowiada `invalid_question` (`:572-574`), wymaga 3 graczy, wstawia rundę 1 i
  ustawia `playing` (`:584-590`).
- **Następne pytanie i pominięcie:** `next.ts:36,40` i `skip.ts:33,37` przy każdym wywołaniu czytają wybór i wysyłają
  `shuffledQuestions(...)`, więc stała kolejność pytań nie istnieje w żadnym miejscu. `next_round` i `skip_round` (`p_room_id,
p_round, p_candidates text[]`, `20261015122252_full_game_evening.sql:79-202`) wołają `private.open_next_round`
  (ostatnia wersja `round_number_required.sql:39-82`): powyżej 1000 kandydatów `22023` (`:49-51`), kandydaci o złym
  formacie są pomijani (`:55`), bierze pierwszego w podanej kolejności, którego nie było w pokoju (`:56-60`).
- **Bez powtórek:** `not exists` w `open_next_round` (`:56-58`) plus klucz `rounds_room_question_key`
  (`first_live_round.sql:125`). Pominięta runda zostawia swoje `question_id` (`full_game_evening.sql:197-199`), więc
  pominięte pytanie nie wraca w tej grze.
- **Koniec pytań:** `next_round` odpowiada `no_questions` (`full_game_evening.sql:128-131`), a `next.ts:42-44` zamienia
  to na `questions_ran_out`. `skip_round` odpowiada `ok` także wtedy, gdy nie ma następnego pytania
  (`full_game_evening.sql:137-139`).
- **`hostQuestionsLeft`** (`server.ts:259-269`) to arytmetyka `questionPool(selection).length > round.number`
  (`:268`). Działa tylko przy założeniu z komentarza `draw.ts:75-76`: każda runda zużyła jedno pytanie z puli
  wybranych kategorii. Lista z własnymi pytaniami albo dolosowaniem łamie to założenie. Konsumenci:
  `HostActions.tsx:58-63`, `RoundReveal.tsx:234`, `RoundSkipped.tsx:40` (według badacza).

### 3. Jak treść dociera do ekranów

- `room_lobby` (ostatnia wersja `20261022132240_latecomer_admission.sql:383-525`) zwraca `question_id` rundy w
  głosowaniu (`:454`) i po odsłonie (`:482`); pominięta runda ma tylko `{number, phase}` (`:477`).
- Worker dokleja treść w `roomView` (`server.ts:240-249`); nieznane id daje `question: null` i log `op:
"question_text", step: "unknown_question", code: <id>` (`server.ts:234, 244-246`). Dla własnych pytań taki log z
  treścią albo własnym id w `code` złamałby regułę `logEvent` (bez danych graczy, `src/lib/log.ts:1-12`).
- `roomView` używają dwa miejsca: render strony `src/pages/r/[id].astro:49-50` i `lobby.ts:42-43` (odpytywany co 15 s
  i po dzwonku, `src/components/room/useRoomState.ts:183`).
- Przeglądarka dostaje `RoomView` (`src/lib/rooms/shared.ts:67-79`): bieżącą rundę z `question_id` i `question`
  (treść albo null) oraz `questionsLeft` tylko dla hosta. Treść renderuje się jako tekst (`RoundQuestion.tsx:12`).
- Lekcja „Pytania gry tylko po stronie serwera” (`context/foundation/lessons.md:12-17`) wprost dopuszcza, że „host w
  S-06 [dostaje] swoją listę”, jako zwykły tekst, nigdy przez `set:html` ani `dangerouslySetInnerHTML`. Przeglądarka
  importuje dziś z bazy pytań tylko id i nazwy kategorii (`src/pages/index.astro:9,16`).

### 4. Stany pokoju i prawa zapisu

- Statusy `lobby`, `playing`, `closed` (`first_live_round.sql:42-43`, `shared.ts:8-9`). „Przed startem” to `lobby`:
  `start_game` wymaga `lobby` (`:564-570`), poczekalnia hosta renderuje się przy `round === null`
  (`RoomScreen.tsx:136-148`).
- Rola `authenticated` ma na `rooms` i `players` tylko `select`, zapisy idą przez funkcje `security definer`
  (`first_live_round.sql:33-38`). Zmiana listy w poczekalni wymaga więc nowej funkcji definer z kontrolą hosta i
  `lobby` w środku (AGENTS.md, Conventions).
- `close_stale_games` zamyka tylko gry `playing` starsze niż 12 h (`20261014101925_close_stale_games.sql:28`); pokój w
  poczekalni nie jest sprzątany (pgTAP „old-lobby”, `supabase/tests/round_creator_view.test.sql:911-913`). Lista
  porzuconej poczekalni zostałaby w bazie do S-13. Nie zawiera par głosujący → cel, więc twarda reguła AGENTS.md jej
  nie dotyczy.

### 5. Poczekalnia hosta i wzorce, których musi trzymać się nowa sekcja

- `src/pages/r/[id].astro:62-64` renderuje `RoomScreen` w `main` z `ROOM_FRAME`. `RoomScreen.tsx:136-149` wybiera
  `RoomLobby`, gdy `view.round === null`. `act()` (`:114-125`) poza podglądem woła `sendRoomAction`, a potem `refresh()` niezależnie od wyniku.
  `VIEW_CHANGING` (`:76`) przenosi fokus na nowy nagłówek; z akcji poczekalni jest tam tylko `start`.
- `RoomLobby.tsx`: korzeń `flex flex-col gap-8 lg:grid lg:grid-cols-3` (`:80`); lewa grupa `lg:col-span-2 lg:sticky
lg:top-6` z tytułem (`:87`), linkiem (`:95-122`) i blokiem startu (`:124-152`, przycisk nieaktywny poniżej 3
  graczy); prawa kolumna to region „Gracze” (`:156-176`). Długa lista w przyklejonej lewej grupie może przerosnąć
  ekran (wniosek z CSS, niesprawdzony).
- Klient: `RoomAction` (`src/components/room/room-actions.ts:12`) to `start|vote|reveal|next|skip|end|admit|reject`;
  `sendRoomAction` POST-uje JSON na `/api/rooms/<id>/<action>` (`:30-55`), więc nowa akcja to nowy wpis w unii i nowy
  plik trasy.
- Trasa (`start.ts:13-35`): `refuseForeignPost` (415/403), `UUID_PATTERN`, sesja, `createClient`, sprawdzenie hosta
  przez RLS, praca, `ringLobby` po sukcesie, `actionAnswer`. `json-route.ts`: `MAX_BODY_LENGTH = 4096` (`:13`),
  pomocniki ciała `bodyRound` (`:113`) i `bodyNick` (`:124`), `statusFor` (`:132-138`).
- Odmowy: `MESSAGES` (`src/lib/rooms/errors.ts:30-57`), `ROUND_REFUSALS` (`:8-22`, pilnowane testem
  `tests/unit/room-errors.test.ts` według komentarza `:7`). Istniejące kody blisko S-06: `no_questions`,
  `invalid_question`, `game_started`, `questions_ran_out`.
- `logEvent` przepuszcza wyłącznie pola z `LOG_FIELDS` (`src/lib/log.ts:14-28`), więc treść pytania nie trafi do logu,
  dopóki nikt nie doda pola, a AGENTS.md tego zabrania.
- Układ (`src/components/room/room-frame.ts:10-30`, AGENTS.md UI): poniżej `lg` jedna kolumna 512 px, szersze klasy
  tylko `lg:` ze skali Tailwinda, tytuł pierwszy w DOM, każdy region raz, tylko tokeny.
- Komponenty w `src/components/ui`: `alert, badge, button, card, checkbox, field, input, input-group, label,
separator, spinner, textarea` (+ `LibBadge.astro`). Nie ma dialogu, listy rozwijanej ani accordionu; w kodzie
  potwierdza się dwoma naciśnięciami w miejscu, z „Anuluj” obok (`HostActions.tsx:117-125`). Gotowy wzór listy z
  wierszami: `NewGameForm.tsx:142-186` (`FieldSet`, `ul.divide-y.rounded-md.border`).
- Podglądy: `/dev/room-states` (`src/pages/dev/room-states.astro`, próbka `lobby(...)` `:113`, sekcje poczekalni od
  `:473`) i `/dev/room-window` (`src/pages/dev/room-window.astro`, `SAMPLES`, np. `"lobby-host"` `:130`). Nowy stan
  poczekalni = pole w `LobbyPreview`/`ScreenPreview` (`RoomLobby.tsx:13-17`, `RoomScreen.tsx:25-33`) i numerowana
  sekcja.

### 6. Mapa dotknięć, gdy gra ma własną, edytowalną listę

- **Baza (nowe migracje, wgranych się nie edytuje):** CHECK formatu i klucz unikalny w `private.rounds`
  (`first_live_round.sql:117,125`); format i `invalid_question` w `start_game` (`:572-574`); filtr, sprawdzenie
  zagrania i limit 1000 w `open_next_round` (`round_number_required.sql:49-58`); `next_round`/`skip_round` biorą
  kandydatów od Workera i dziś nie sprawdzają, że pytanie należy do gry; `room_lobby` zwraca tylko id
  (`latecomer_admission.sql:441-488`), a dokładne zbiory kluczy pilnują `tests/db/support/rounds.ts:80-90`.
- **Worker:** `draw.ts` w całości (`poolFrom`, `drawQuestion`, `shuffledQuestions`, `questionPool`, `questionText`);
  `server.ts` (`roomView` `:234-249`, `hostQuestionsLeft` `:259-269`, `hostRoomCategories` `:401-417`, `startGame`/
  `nextRound`/`skipRound` `:280-344`); trasy `start.ts:25-32`, `next.ts:36-44`, `skip.ts:33-38`; typy i komentarze w
  `shared.ts:22-71`; tekst `no_questions` w `errors.ts:48-49` mówi o kategoriach.
- **Testy:** `tests/unit/draw.test.ts:182-213`; `tests/unit/room-rpc-gate.test.ts` (`SQL_SIGNATURES` `:28-100`);
  `tests/unit/room-state.test.ts`, `announce.test.ts`; `tests/db/round-rules.test.ts:351-358` (format id),
  `tests/db/game-rules.test.ts:30-49, 149-154, 293-321, 411` (filtr, limit 1000, `no_questions`); stałe
  `satisfies QuestionId` w `tests/db/support/rounds.ts:64-75`; pgTAP `round_creator_view.test.sql` (`plan(128)`).

### 7. Ograniczenia z dokumentów produktu

- **FR-012** (`prd.md:114-115`): przegląd opcjonalny, domyślnie „start teraz”, lista należy tylko do tej gry; kontrargument
  „host poleruje 15 pytań, a 6 osób czeka” rozstrzygnięty opcjonalnością i pominięciem złego pytania w grze.
  Roadmapa: przegląd nie może spowolnić ścieżki „gra w mniej niż 5 minut” (`roadmap.md:186`, `prd.md:37`).
- **Rola:** przegląd i poprawianie listy ma tylko host, nie współhost i nie gość (`prd.md:168`).
- **FR-015** (`prd.md:120`): dolosowanie musi trzymać filtry wybranych kategorii i 18+ tylko tam, gdzie host je
  dołączył; „bez ostatnich wieczorów ekipy” to S-12. Co, gdy świeżych pytań brak, to Open Question 5 (`prd.md:199`,
  nie blokuje).
- **FR-016/FR-017** (`prd.md:122-125`): usunięcia z listy przed startem zasilają ocenę jakości; zapis należy do S-11
  (`roadmap.md:242`), które zależy od S-06 (`:245`). Żaden przeczytany dokument nie mówi, że S-06 ma je zapisywać
  sam; wniosek, że S-06 nie może zapisu uniemożliwić, jest interpretacją.
- **FR-021** (`prd.md:130`, nice-to-have, panel w v2 `roadmap.md:323`) i `prd.md:158-159`: pytania dopisane przez
  hosta żyją w tej grze, a potem trafiają do weryfikacji twórcy gry. Gdzie czekają, nie jest ustalone
  (`roadmap.md:236` dla S-10 dotyczy tak samo S-06).
- **FR-019** (`prd.md:128`): kasowanie gry usuwa wszystko związane z nickami; lista pytań gry nie ma nicków, więc może
  kasować się razem z pokojem (`on delete cascade` jak w innych tabelach pokoju).
- **Non-Goals** (`prd.md:177-191`): bez pytań z AI, bez wielu kuratorów, tylko po polsku, bez punktów.
- **Słownik** (`context/domain/glossary.md:56-62`): „lista pytań gry” (nie „pula hosta”), „wspólna baza pytań” (nie
  „pula”), „pozostałe pytania”, „pytania 18+”, „kategoria”; stan przed startem to „poczekalnia” (`status = 'lobby'`).
  „Pominięcie pytania” to porzucenie rundy w głosowaniu (`skip_round`), więc usunięcie pytania z listy potrzebuje
  innego słowa (np. „usunięcie z listy”), którego słownik jeszcze nie ma.
- **Q-04 / D-05** (`context/domain/domain-distillation.md:183,222`): czy baza ma blokować pytanie spoza wybranych
  kategorii zagrane przez bezpośrednie RPC, nie jest rozstrzygnięte. Lista pytań gry w bazie daje naturalną odpowiedź
  (runda gra wyłącznie pozycję z listy), ale to decyzja właściciela.

### 8. Obowiązki testowe i wdrożeniowe

- **§6.1 brama RPC** (`context/foundation/test-plan.md:145`): nowa albo zmieniona funkcja RPC to wiersz w
  `SQL_SIGNATURES` (`tests/unit/room-rpc-gate.test.ts:28`) i przypadek akcji gry w tej samej zmianie co migracja.
- **§6.2 testy bazy** (`test-plan.md:147-196`): wyrocznia ręcznie w teście, odmowa jako konkretny wynik, kontrola
  pozytywna w każdym pliku, znana dziura tylko jako `it.fails` „znana dziura <F> → <zmiana>”. Limit logowań lokalnego
  Supabase 30 na 5 minut; `:185` liczy 12 kont z 7 plików i zgadza się z 7 plikami testów w `tests/db/` (także
  `latecomers`), więc nowy plik to nowa pozycja w tej linii. Jeden host na plik.
- **pgTAP** (`supabase/tests/round_creator_view.test.sql:362-420, 615-622`): każda nowa tabela w schemacie `private`
  jest automatycznie sprawdzana pod granty, publikację i kolumny czasu, serial i identity; zwykła liczba całkowita
  jako pozycja przechodzi, znacznik czasu nie (według badacza). Nowa tabela pokoju potrzebuje sprawdzenia
  pozostałości po zamknięciu i sprzątaniu, jak `join_requests` w S-08 (`test-plan.md:204-206`).
- **Smoke** (`test-plan.md:283-298`): pełne porównanie treści odpowiedzi; przełączniki `SMOKE_GAME=0`/`SMOKE_ROUND=0`
  na okno „baza przed kodem”; krok strażnika dostaje break-check.
- **E2E** (`test-plan.md:236`): host i goście w osobnych kontekstach, także w projekcie `phone`; „Gracze” i „Wynik”
  szukane po roli (AGENTS.md UI).
- **Migracje** (AGENTS.md, `deploy-plan.md:45-58`): RLS, `revoke all`, jawne granty, `search_path = ''`, właściciel
  `postgres` dla definer; tabela dostępna tylko przez funkcje nie ma grantów ani polityk (wzór `join_requests`,
  `deploy-plan.md:57-58`). Od 30.10.2026 nowe tabele w `public` nie dostają domyślnych grantów
  (`deploy-plan.md:53`), co jawne granty i `revoke` już pokrywają. Po `db push` Advisors → Security.
- **Zgodność starego Workera:** stary Worker woła `start_game(id)` i `next_round`/`skip_round(…, p_candidates)` z
  id z bazy pytań; nowy klucz w `room_lobby` jest bezpieczny, bo parser ignoruje nieznane klucze, ale nieznana faza
  jest odrzucana (`shared.ts:137`). Migracja S-06 musi więc zostawić te wywołania działające, aż nowy Worker wejdzie.

## Code References

- `src/data/questions.ts:4-16, 21-38, 40-716, 718` — wspólna baza pytań, reguły id, limit 90 znaków
- `src/lib/rounds/draw.ts:25-33, 42-49, 54-65, 75-85` — pula, losowanie startu, tasowanie kandydatów, treść po id
- `src/pages/api/rooms/[id]/start.ts:13-35` — wzorzec trasy hosta i losowanie rundy 1
- `src/pages/api/rooms/[id]/next.ts:36-44`, `skip.ts:33-38` — kandydaci przy każdym wywołaniu, `questions_ran_out`
- `src/lib/rooms/server.ts:118-141, 234-249, 259-269, 280-344, 401-417` — RPC, `roomView`, `hostQuestionsLeft`
- `supabase/migrations/20261014101922_first_live_round.sql:33-38, 112-126, 540-597` — prawa, `private.rounds`,
  `start_game`
- `supabase/migrations/20261020205751_round_number_required.sql:39-82` — `private.open_next_round`
- `supabase/migrations/20261022132240_latecomer_admission.sql:383-525` — ostatnia wersja `room_lobby`
- `src/components/room/RoomLobby.tsx:80-176`, `RoomScreen.tsx:76, 114-149` — poczekalnia hosta
- `src/components/room/room-actions.ts:12, 30-55`, `src/lib/rooms/json-route.ts:13, 113-152` — akcje i trasy JSON
- `src/lib/rooms/errors.ts:8-57`, `src/lib/log.ts:14-28` — odmowy i dozwolone pola logu
- `tests/unit/room-rpc-gate.test.ts:28-100`, `tests/db/support/rounds.ts:64-90` — brama RPC i klucze `room_lobby`

## Architecture Insights

- Wspólna baza pytań żyje w Workerze, baza danych sprawdza tylko kształt (format id, kształt tablic kategorii). S-06
  pierwszy raz przenosi do bazy treść pytania, więc kontrole treści (długość, pusta treść, niewidoczne znaki) muszą
  zamieszkać w funkcji bazy, jak przy nicku (`roadmap.md:136`).
- Jedno źródło prawdy dla ekranu: `GET /api/rooms/<id>/lobby`, Realtime to tylko dzwonek. Lista hosta dojdzie tą samą
  drogą (nowy klucz tylko dla hosta) albo osobnym odczytem; obie drogi trzymają regułę, że gość nie widzi listy.
- Zapisy hosta to funkcje `security definer` zwracające `{ok, reason}`; Worker mapuje `reason` na status HTTP
  (`json-route.ts:132-138`) i polski komunikat (`errors.ts`).
- „Baza przed kodem” wymusza migracje zgodne wstecz: nowe funkcje obok starych albo stare sygnatury dalej
  działające do czasu scalenia kodu.

## Historical Context (from prior changes)

- `context/archive/2026-10-15-full-game-evening/research.md:104-112` — D1: wybrano W-B (kandydaci w losowej kolejności
  przy każdym kroku) zamiast W-A (lista w nowej tabeli `private`) i W-C (lista N pytań z naturalnym końcem). Argument
  „lista przyda się S-06” odrzucono, bo S-06 potrzebuje listy już w poczekalni, „15–20 pytań”, z poprawianiem treści i
  własnymi pytaniami, „których format `question_id` nie przyjmie”. Werdykt dziś: **potwierdzone** — kod odpowiada
  opisowi (sekcja 2), a format id nadal blokuje własne pytania (sekcja 6). „W-C ucina wieczór” było argumentem przeciw
  liście z naturalnym końcem; S-06 dodaje dolosowanie, więc ten argument trzeba w planie zważyć od nowa.
- `context/archive/2026-10-15-full-game-evening/plan.md:46` — S-03 nie buduje listy przed startem; to zakres S-06.
  **Potwierdzone.**
- `context/archive/2026-09-27-starter-question-base/reviews/impl-review.md:104,110` — źródło lekcji o pytaniach po
  stronie serwera: „S-06 pokaże hostowi całą listę i to jest w porządku”. **Potwierdzone** (`lessons.md:16`).
- `context/archive/2026-10-13-first-live-round/research.md:359` (T3) — host podający w RPC inne pytanie nic nie zyskuje
  ponad to, co może legalnie; krytyk zauważył, że to interpretacja FR-012. **Nadal otwarte** jako Q-04.
- `context/archive/2026-10-20-deferred-review-fixes/plan.md:379` i `reviews/plan-review.md:62,71-73` — S-08 i S-06
  dopiszą kroki smoke, więc liczby w planie `refactor-opportunities` trzeba przeliczyć. **Aktualne.**
- `context/foundation/roadmap.md:289` — tabela przekazania mówi, że S-06 „Czeka na S-02”; S-02 jest `done` (`:47`).
  **Nieaktualne** (do poprawy przy wpisie w roadmapie po S-06).

## Related Research

- `context/archive/2026-10-15-full-game-evening/research.md` — D1/D2, kandydaci i pominięcie
- `context/archive/2026-10-13-first-live-round/research.md` — `private.rounds`, anonimowość, T3
- `context/domain/domain-distillation.md` — T-36 „lista pytań gry”, D-05/Q-04, R-22

## Open Questions

Decyzje produktowe i projektowe dla `/10x-plan` (żadna nie blokuje dalszego badania):

1. **Kiedy powstaje lista i ile ma pytań.** Przy założeniu pokoju, przy pierwszym otwarciu przeglądu czy przy starcie?
   Ile pytań (archiwum mówi „15–20”, `full-game-evening/research.md:110`)? Wariant „lista dopiero po otwarciu
   przeglądu” zostawia ścieżkę „start teraz” bez zmian.
2. **Co po wyczerpaniu listy.** Gra kończy się na liście (naturalny koniec, W-C) czy dobiera z pozostałych pytań
   wybranych kategorii (dzisiejsze W-B)?
3. **Pytanie z poprawioną treścią.** Zostaje pod id z bazy (dane S-11 pod jednym id mieszają dwa brzmienia, wbrew
   `questions.ts:6-9`) czy staje się pytaniem własnym bez id z bazy?
4. **Usunięcia dla S-11.** Czy S-06 zapisuje usunięcie z listy (choćby jako znacznik), czy zostawia to S-11?
5. **Własne pytanie:** limit długości (baza pytań ma 90 znaków), reguły treści i miejsce, w którym czeka na
   weryfikację twórcy gry (FR-021, v1 poza aplikacją).
6. **Q-04:** czy baza ma pilnować, że runda gra wyłącznie pytanie z listy pytań gry.
7. **Ekran:** sekcja zwinięta w poczekalni hosta czy osobny widok; jak nie przerosnąć przyklejonej lewej grupy na
   laptopie.
8. **Słowo w słowniku** dla usunięcia pytania z listy (nie „pominięcie”).

Luki badania (nie zmieniają odpowiedzi): nie sprawdzono, czy e2e szuka w poczekalni czegoś poza przyciskiem „Zacznij
grę” i regionem „Gracze”; nie otwarto listy plików w `scripts/ui-literals.mjs`. W dokumentach nie ma „limitu treści F6 z S-03”; F6 to limit rozmiaru ciała JSON (`json-route.ts:13`).
