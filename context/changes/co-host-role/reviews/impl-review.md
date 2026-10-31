<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Współhost (S-07)

- **Plan**: context/changes/co-host-role/plan.md
- **Scope**: Full plan (fazy ukończone; faza 4 czeka na 4.4 z ekipą i nie ma kodu)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-31
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Dowody, które przeszły:

- Siedem ruchów i `room_lobby` w `20261027121442_co_host_role.sql` porównane linia po linii z ich najnowszymi definicjami. Różnią się tylko kontrolą prowadzącego (`private.leader_refusal` zamiast `v_user <> v_host`), argumentem `p_player_token text default null` (`drop` + `create`) i czterema komentarzami. Nic nie zginęło: F2 (numer pytania), kciuki S-11, sumy S-15, limit nicku i `drop_round_state` są na miejscu. Wiersz pokoju jest blokowany (`for update`) przed `leader_refusal` we wszystkich siedmiu ruchach, a `set_cohost` też go blokuje.
- `search_path = ''`, właściciel `postgres`, `revoke` przed selektywnym `grant` (siedem ruchów: `anon, authenticated`; `set_cohost`: tylko `authenticated`; `leader_refusal`: bez grantów). Żadna ścieżka nie zwraca ani nie loguje pary głosujący→cel. `roomView` odcina `leader_draw`, a `question_list` dostaje tylko host.
- Siedem tras kopiuje wzór `vote.ts:39-47`, `cohost.ts` przyjmuje tylko sesję. Odmowy mają jawne statusy, a logi mają tylko dozwolone pola.
- Bramki 31.10: `npm run lint`, `npx astro check` (0 błędów), `npm test` (729/729), `npm run build`, `prettier --check` dla zmienionych `.md`, `npx playwright test --list` (2 × `cohost.spec.ts`), CI na PR #30 zielone (`ci`, `smoke`, `db`, `e2e`). Smoke na produkcji 31.10 zielony.
- Dodatki spoza planu (podtytuł współhosta, podpowiedzi pod „Gracze”, widoczny `Alert` przy ogłoszeniu roli, więcej tekstów „prowadzący”) Karol zaakceptował na zrzutach 29.10. PRD przeformatowany w całości przez Prettier (szum w diffie).
- Znane i przyjęte, poza ustaleniami: pula pytań i 18+ sprawdzane tylko w Workerze (dziura F1 z przeglądu planu, `test.fails`); „Nowa gra” hosta zamyka wieczór współhosta; host, który wyszedł, dalej jest uprawniony do głosu (S-09).

## Findings

### F1 — Przełącznik roli może zostać „w toku” na zawsze

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/room/CohostButton.tsx:63
- **Detail**: Przełącznik zwalnia się tylko wtedy, gdy odświeżona lista pokaże dokładnie wartość, o którą prosił (`asked === cohost`), a do tego czasu `toggle()` nic nie robi. Gdy host na drugim ekranie (albo drugim kliknięciem gdzie indziej) ustawi odwrotną wartość, zanim ten ekran się odświeży, lista nigdy nie pokaże prośby: pigułka kręci się i jest `aria-disabled` aż do przeładowania strony. W S-08 ta sama klasa błędu w `JoinRequests` (F4) została naprawiona licznikiem `refreshes`, a `CohostButton` go nie używa.
- **Fix**: Przekazać `refreshes` do `CohostButton` (przez `RoomLobby` i `RoundVoting`) i po przyjętej odpowiedzi zwolnić przełącznik przy pierwszym odświeżeniu, jak `RequestRow` w `JoinRequests.tsx:65-77`.
  - Strength: Ten sam wzór co poprawka F4 z S-08, sprawdzony w e2e.
  - Tradeoff: Kilka plików (props przez dwa ekrany i podgląd); to samo „znane ograniczenie” co w `RequestRow` (żądanie wysłane przed odpowiedzią może na chwilę pokazać starą wartość).
  - Confidence: HIGH — wzór już działa w tym repo.
  - Blind spot: Brak testu jednostkowego komponentów; sprawdzenie przez podgląd albo e2e.
- **Decision**: FIXED — `refreshes` przekazany przez `RoomScreen` → `RoomLobby`/`RoundVoting` → `CohostButton`; przełącznik zwalnia się przy pierwszym odświeżeniu po przyjętym kliknięciu (jak `RequestRow`), 2026-10-31

### F2 — Odmowy `leaderSelection` w Workerze bez testu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/rooms/server.ts:319-329
- **Detail**: Nowa bramka Workera dla start/next/skip zamienia brak pokoju na `room_unknown` (404), a `leader_draw: null` na `not_leader` (409). Żaden test jednostkowy, smoke ani e2e nie przechodzi przez te dwie gałęzie (jedyna odmowa `not_leader` w smoke to `reveal`, która idzie prosto do bazy). Baza i tak sprawdza rolę pod blokadą, więc to nie dziura, ale zły kod albo status odmowy przeszedłby niezauważony.
- **Fix**: Test jednostkowy `leaderSelection` z podstawionym `supabase.rpc`: brak pokoju → `room_unknown`, `leader_draw: null` → `not_leader`, prowadzący → wybór z kategorii.
- **Decision**: FIXED — 5 przypadków `leaderSelection` w `tests/unit/room-state.test.ts` (host, współhost, gość bez roli ×2, brak pokoju); próbny alarm: `not_leader` → `room_unknown` w `server.ts` zapalił 2 testy, plik przywrócony, 2026-10-31

### F3 — „host” w podpowiedzi prośby spóźnionego

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/room/JoinForm.tsx:46
- **Detail**: Desired End State: teksty mówią „prowadzący” tam, gdzie ruch może wykonać host albo współhost. Podpowiedź prośby spóźnionego dalej mówi „Ten nick zobaczy host, a gdy cię wpuści…”, a od S-07 prośbę widzi i wpuszcza też współhost. Plan nie miał tego tekstu na liście.
- **Fix**: „Ten nick zobaczy prowadzący, a gdy cię wpuści, także inni gracze.” (+ komentarz w `JoinForm.tsx:20-21`).
- **Decision**: FIXED — „Ten nick zobaczy prowadzący…” + komentarz `JoinForm.tsx:20-21`, 2026-10-31

### F4 — Znana dziura F1 (18+ przez RPC) bez zmiany w roadmapie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: tests/db/cohost.test.ts:52, :414
- **Detail**: Współhost wołający `start_game`/`next_round`/`skip_round` przez RPC z tokenem z własnego ciasteczka może otworzyć dowolne pytanie z bazy, także 18+ spoza wyboru hosta (przyjęte w planie, przypięte `test.fails`). Konwencja AGENTS.md to „znana dziura <F> → <change>”, a test mówi „→ pula w bazie”, bo zmiany naprawczej nie ma w roadmapie. „F1” już raz oznaczało dziurę S-02 w `test-plan.md`, więc wpis w logu jest dwuznaczny.
- **Fix A ⭐ Recommended**: Dopisać do roadmapy mały wycinek „pula pytań w bazie” (przez `/10x-roadmap`, za zgodą) i zmienić nazwę testu na „znana dziura F1 → <change-id>”.
  - Strength: Dziura nie zginie, a test wskaże zmianę, która go zaczerwieni (konwencja AGENTS.md).
  - Tradeoff: Jedna pozycja więcej w roadmapie, jeszcze bez terminu.
  - Confidence: HIGH — tak samo zrobiono z „F4 → S-02”.
  - Blind spot: Nie oceniono kosztu samej naprawy (sprawdzenie kategorii w trzech funkcjach).
- **Fix B**: Zostawić jak jest.
  - Strength: Zero pracy; ryzyko wymaga złośliwego i technicznego znajomego w pokoju.
  - Tradeoff: Dziura żyje tylko w teście i planie, łatwo o niej zapomnieć.
  - Confidence: MED — zależy, czy ktoś kiedyś zajrzy do `test.fails`.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — S-17 `question-pool-in-db` w roadmapie (proposed), test „znana dziura F1 → S-17”, `test-plan.md` §6.2, 2026-10-31

### F5 — Komentarz „`leader_draw` nigdy nie trafia na ekran” jest nieścisły

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/rooms/shared.ts (opis `LeaderDraw`); supabase/migrations/20261027121442_co_host_role.sql:760
- **Detail**: `room_lobby` ma grant `anon`, więc współhost może odczytać `leader_draw` (kategorie, podzbiór 18+, dwie liczby listy, nigdy treść listy) sam przez RPC. Worker go nie wysyła (`roomView`, test kluczy widoku), więc to tylko słowa. Wgranej migracji nie poprawiamy.
- **Fix**: W `shared.ts` napisać „Worker nigdy nie wysyła go na ekran; prowadzący może go odczytać przez RPC”.
- **Decision**: FIXED — komentarz w `shared.ts` (opis `RoomView.leader`); migracji nie ruszamy, 2026-10-31

### F6 — Cięższe start/next/skip i render przy każdym odświeżeniu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/rooms/server.ts:319; src/components/room/useRoomState.ts:240
- **Detail**: Start, następne pytanie i pominięcie wołają cały `room_lobby` zamiast jednego odczytu `rooms` (liczba wywołań bez zmian, a trasa stanu i `/r/[id]` mają o jedno mniej). `setRefreshes` biegnie przy każdym udanym odświeżeniu, więc ekran renderuje się co 15 s i przy każdym dzwonku, nawet bez zmian. Przy tej skali bez znaczenia.
- **Fix**: Nic teraz; przy kłopotach osobna lekka funkcja dla `leader_draw` albo licznik tylko dla `JoinRequests`.
- **Decision**: ACCEPTED — Karol 2026-10-31: zostawić, przy tej skali bez znaczenia

### F7 — Dwie linie komentarzy ponad 120 znaków

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/room/JoinWaiting.tsx:14; src/pages/dev/room-window.astro:16
- **Detail**: 148 i 156 znaków; Prettier nie zawija komentarzy, więc lint jest zielony.
- **Fix**: Zawinąć ręcznie do 120.
- **Decision**: FIXED — oba komentarze zawinięte do 120 znaków, 2026-10-31
