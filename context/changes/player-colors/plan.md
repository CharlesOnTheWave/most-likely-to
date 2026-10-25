# Stały kolor gracza Implementation Plan

## Overview

Każdy gracz dostaje na całą grę stały kolor z miejsca przy stole: host pierwszy, kolejni gracze po kolei. Kolor jest na kole odsłony, w tabeli wyniku (w obu widokach, „Koło” i „Paski”), na kole i w legendzie podsumowania oraz jako kropka przy nicku na liście „Gracze” w poczekalni i w trakcie gry. Dziś kolor zależy od miejsca w wyniku, więc kto ma najwięcej głosów, ten jest różowy, i co rundę różowy jest ktoś inny. Po grze testowej S-15 Karol zgłosił, że ludzie się przez to mylą (`change.md`, Notes).

## Current State Analysis

- Kolor to numer kawałka koła: `SLICE_FILLS[index]` i `SLICE_DOTS[index]` z `src/components/room/chart-colors.ts:4-47`. Kawałki idą w kolejności odsłony (`pieSlices` → `sortResults`, najwięcej głosów pierwszy, `src/lib/rooms/chart.ts:31-33`), więc pierwszy kolor zawsze dostaje zwycięzca rundy.
- Odsłona (`src/components/room/RoundReveal.tsx`):
  - Koło: `SLICE_FILLS[index]` (:44, :50).
  - Kropka w tabeli: `sliceIndex` z kawałków (:79, :136, :159), tylko w widoku „Koło” (:153). Wiersz z 0 głosów ma pustą kropkę.
  - Widok „Paski”: kropki nie ma, pasek ma jeden kolor (`bg-primary/35` albo `/20`, :140-151).
- Podsumowanie (`src/components/room/GameSummary.tsx`): kropka w legendzie i kawałek koła mają numer pozycji w topie (:48, :113). Reszta to jeden szary kawałek i szara kropka „pozostali” (`fill-muted-foreground`, `bg-muted-foreground`; :58, :113). Chipy „Nikt dziś nie głosował na” nie mają kropki (:78-88).
- Listy „Gracze”: w poczekalni `RoomLobby.tsx:190-210`, w trakcie gry `RoundVoting.tsx:159-186`. Obie iterują po `view.players` i nie mają kropki.
- Każdy z tych komponentów dostaje już cały `view: RoomView`, a `view.players` to wszyscy gracze w kolejności miejsc w każdym stanie pokoju. `room_lobby` sortuje ich `order by p.seat` (`supabase/migrations/20261025122918_game_summary.sql:229-236`), a parser zachowuje kolejność (`src/lib/rooms/shared.ts:179-189`).

## Desired End State

Gracz ma ten sam kolor od wejścia do pokoju do ekranu końca:

- kropka przy jego nicku na liście „Gracze” w poczekalni i w trakcie gry;
- jego kawałek na kole każdej odsłony i kropka w każdym wierszu tabeli wyniku, w widoku „Koło” i „Paski”, także przy 0 głosów;
- jego kawałek i kropka w legendzie „Najwięcej głosów dziś”.

Dwie odsłony z różnymi zwycięzcami pokazują tę samą osobę w tym samym kolorze. Szary kawałek „pozostali” zostaje szary. Sprawdzamy to testami jednostkowymi reguły, oceną zrzutów przez Karola i krótką grą na produkcji.

### Key Discoveries:

- Miejsce nigdy się nie zmienia w trakcie gry, więc numer na liście `view.players` jest stały:
  - nic nie usuwa gracza, nie zmienia mu nicka ani miejsca: w migracjach nie ma `delete from public.players` ani `update public.players`, a tabela ma dla `authenticated` tylko `select` (`20261014101922_first_live_round.sql:33-38`);
  - miejsca to 1..N bez dziur: host ma 1 (`first_live_round.sql:292-293`), każdy następny `max + 1`, także spóźniony (`20261022132240_latecomer_admission.sql:307-312`);
  - „Nowa gra” zakłada nowy pokój z nowymi graczami (`first_live_round.sql:276-293`).
- Numer miejsca nie trafia do przeglądarki (`LobbyPlayer` ma tylko `nick` i `host`, `shared.ts:14-17`). Wystarcza jednak pozycja na liście, bo `players[i]` ma zawsze miejsce `i + 1`.
- Nicki są unikalne w pokoju (`players_room_nick_key`, `20261007122858_room_lobby.sql:42`), więc mapa nick → kolor jest jednoznaczna. Wyniki, top i lista „uprawnieni” to podzbiory `players`, więc ich własny porządek nie nadaje się na kolor.
- Paleta ma 20 kolorów (`--chart-1` … `--chart-20`, `src/styles/global.css:81-100`, `MAX_PIE_SLICES`, `chart.ts:11-12`). Komentarz palety (`global.css:78-80`) mówi, że każdy kolor ma co najmniej 3.8:1 na `--card`, a dwa najbliższe dzieli 0.095 w OKLab. Każda para kolorów jest więc rozróżnialna, także gdy obok siebie wypadną kolory niesąsiednie w palecie.
- Testy E2E szukają graczy po tekście (`playerRow`, `expectReveal`, `summaryItem` w `tests/e2e/support/`) albo po nazwie radia z `<label>` (`castVote`). Kropka bez tekstu z `aria-hidden` ich nie zmienia. Lista do głosowania i chipy „Nikt dziś nie głosował na” zostają bez kropki, więc ich nazwy też się nie zmieniają.

## What We're NOT Doing

- Wybór koloru przez gracza (wariant B, odrzucony na teraz 2026-10-25). Można go dołożyć później na wierzchu tej reguły.
- Zmiany w bazie, w `room_lobby` i w Workerze. Numer miejsca nie idzie do przeglądarki, wystarcza kolejność `players`.
- Kropka w liście do głosowania i przy chipach „Nikt dziś nie głosował na” (decyzja Karola: listy „Gracze”, odsłona i podsumowanie).
- Pasek w widoku „Paski” w kolorze gracza: pasek zostaje jak dziś, dochodzi tylko kropka (decyzja Karola).
- Inna kolejność kawałków koła: kawałki dalej idą od największego, zmienia się tylko ich kolor.
- Prośby spóźnionych („Proszą o wejście”) i ekran oczekującego (`JoinWaiting`): spóźniony nie ma jeszcze miejsca, więc nie ma koloru.
- Nowe kolory albo tokeny. Ponad 20 graczy kolory się powtarzają (PRD nie ma limitu graczy, 20 to poziom, na którym sprawdzamy grę).
- Usuwanie gracza (S-09). Gdy powstanie, musi zachować kolory pozostałych graczy, więc wpis w słowniku nazywa tę zależność.

## Implementation Approach

Jedna czysta funkcja w `src/lib/rooms/chart.ts` zamienia listę graczy w mapę nick → numer koloru (pozycja na liście modulo 20). Każdy widok bierze kolor z tej mapy, zamiast z numeru kawałka albo pozycji w topie. Mapę budujemy z `view.players` w komponencie, bo każdy z nich już ma `view`. Klasy kolorów zostają w `chart-colors.ts`, bo Tailwind generuje tylko klasy zapisane w całości.

## Phase 1: Kolor z miejsca przy stole na wszystkich ekranach

### Overview

Reguła z testami, a potem jej użycie w odsłonie, podsumowaniu i obu listach „Gracze”. Do tego wpis w słowniku i ocena zrzutów przez Karola.

### Changes Required:

#### 1. Reguła koloru

**File**: `src/lib/rooms/chart.ts`

**Intent**: Kolor gracza ma wynikać z jego miejsca przy stole, nie z miejsca w wyniku. Dlatego potrzebna jest jedna funkcja, z której biorą kolor wszystkie ekrany.

**Contract**: `seatColors(players: readonly LobbyPlayer[]): ReadonlyMap<string, number>`: nick → numer koloru `0 … MAX_PIE_SLICES - 1`, czyli pozycja gracza w `players` modulo `MAX_PIE_SLICES`. Host (pierwszy) ma 0, 21. gracz znów 0. Komentarz nad funkcją mówi, dlaczego pozycja na liście jest stała przez całą grę: nikt nie znika, spóźniony dochodzi na koniec. Mówi też, że widok bierze numer z tej mapy, a nick spoza niej (nieosiągalny, póki nikt nie znika z pokoju) nie ma koloru. Funkcja jest czysta i bezpieczna w przeglądarce, jak reszta pliku. Import typu `LobbyPlayer` z `shared.ts`.

#### 2. Testy reguły

**File**: `tests/unit/chart.test.ts`

**Intent**: Wyrocznia w testach to ręcznie wypisane numery, nigdy nie liczone tą samą formułą.

**Contract**: nowy `describe` dla `seatColors`, z przypadkami:

- host i czterech gości dostają 0–4 w kolejności listy;
- spóźniony dopisany na koniec dostaje następny numer, a pozostali zachowują swoje;
- przy 21 i 22 graczach 21. dostaje 0, a 22. dostaje 1;
- pusta lista daje pustą mapę.

Istniejące testy `pieSlices` i `slicesInOrder` zostają bez zmian, bo kolejność kawałków się nie zmienia. Testu „kolor nie zależy od głosów” nie piszemy: `seatColors` nie dostaje głosów, więc taki test nie mógłby się nie udać. Ryzyko, że ekran dalej bierze kolor z numeru kawałka, sprawdzają zrzuty (kryterium 1.4), bo repo nie ma testów komponentów (przegląd planu, F1).

#### 3. Odsłona

**File**: `src/components/room/RoundReveal.tsx`

**Intent**: Kawałek koła i kropka w wierszu mają kolor gracza, a kropka stoi w każdym wierszu w obu widokach. Dzięki temu ta sama osoba ma ten sam kolor w każdej rundzie, także przy 0 głosów i w widoku „Paski”.

**Contract**:

- `ResultPie` dostaje mapę kolorów albo numer koloru każdego kawałka i maluje `SLICE_FILLS[seatColors…get(nick)]` zamiast `SLICE_FILLS[index]`.
- `sliceIndex` znika. Kropka w wierszu: `SLICE_DOTS[kolor gracza]` w każdym wierszu i niezależnie od `shown`. Zostaje `aria-hidden` bez tekstu, poza owijającym nick `<span>`, jak dziś (komentarz przy kropce do aktualizacji). Nick bez koloru ma pustą kropkę, która trzyma miejsce. W przygaszonym wierszu z 0 głosów kropka też ma pełny kolor: to kolor osoby, nie kawałka koła (przegląd planu, F4; ocena na zrzutach).
- Pasek w widoku „Paski” bez zmian.
- Komentarze przy `ResultPie` i nad komponentem: kolor to kolor gracza z miejsca przy stole.

#### 4. Podsumowanie

**File**: `src/components/room/GameSummary.tsx`

**Intent**: Na kole i w legendzie „Najwięcej głosów dziś” gracz ma ten sam kolor co w odsłonach.

**Contract**:

- Kropka w legendzie: `SLICE_DOTS[kolor gracza]` z `seatColors(view.players)` zamiast `SLICE_DOTS[index]`.
- `SummaryPie` dostaje numery kolorów topu. Kawałek topu ma kolor gracza, kawałek „pozostali” zostaje `fill-muted-foreground`.
- Komentarz nad `SummaryPie`, że „kawałki trzymają numery topu”, przepisany: kolor bierze się z gracza, a kawałek z topu nadal ma głosy, więc numer kawałka to pozycja w topie.
- Chipy „Nikt dziś nie głosował na” bez zmian.

#### 5. Listy „Gracze”

**Files**: `src/components/room/RoomLobby.tsx`, `src/components/room/RoundVoting.tsx`

**Intent**: Każdy widzi swój kolor od wejścia do pokoju, zanim padnie pierwsza odsłona.

**Contract**:

- Na liście „Gracze” (`RoomLobby.tsx:200-208`, `RoundVoting.tsx:165-183`) przed nickiem stoi kropka `SLICE_DOTS[kolor gracza]`, wielkości i z odstępem jak kropka w tabeli odsłony (`size-2.5 shrink-0 rounded-full`), `aria-hidden`, bez tekstu.
- Długi nick zawija się obok kropki, a kropka nie spada do osobnej linii (jak w `RoundReveal.tsx:154-156`).
- Znaczki „host”, „ty”, „zagłosował(a)” i dopisek „od następnego pytania” bez zmian.
- Lista do głosowania (radia, `RoundVoting.tsx:230-261`) bez kropki.

#### 6. Kolory i słownik

**Files**: `src/components/room/chart-colors.ts`, `context/domain/glossary.md`

**Intent**: Komentarz palety i słownik mówią, co znaczy kolor, żeby następna zmiana (np. S-09) go nie zepsuła.

**Contract**:

- `chart-colors.ts:1-3`: jeden kolor na gracza, z miejsca przy stole (`seatColors`), na kole odsłony i podsumowania i jako kropka na listach „Gracze” i w tabeli odsłony.
- `glossary.md`: nowy wiersz pod „miejsce”. Termin „kolor gracza”: stały na całą grę, z miejsca (host pierwszy, po 20 kolory od nowa), na kole odsłony i podsumowania i kropką przy nicku. Usunięcie gracza (S-09) nie może zmienić kolorów pozostałych graczy. Kod: `seatColors`. Nie mówić: „kolor zwycięzcy”, kolor z miejsca w wyniku.

#### 7. Podglądy

**Files**: `src/pages/dev/room-states.astro`, `src/pages/dev/room-window.astro`

**Intent**: Podglądy pokazują nową regułę bez nowych stanów, bo każdy widok już niesie `players`.

**Contract**:

- Bez zmian. Przegląd planu sprawdził (F3), że każdy podgląd odsłony i końca buduje wyniki i sumy z tej samej listy `players`, którą pokazuje (`roundPlayers`, `twentyPlayers`), więc żadna kropka nie będzie pusta.
- Nowego stanu pokoju nie ma, więc nowych podglądów też nie trzeba.
- Para do zrzutów: odsłona „Ola i Kasia po 2” (`fiveResults`) i odsłona „1 głos” (`oneVote`). Dziś Kasia 🎉 ma w nich raz drugi, raz pierwszy kolor, po zmianie ma w obu trzeci (miejsce 3).

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi, w tym nowe przypadki `seatColors` w `tests/unit/chart.test.ts`
- `npm run lint` (z `scripts/ui-literals.mjs`), `npx astro check`, `npm run build` przechodzą
- `npx prettier --check` dla zmienionych plików `.md`

#### Manual Verification:

- Karol ocenia zrzuty z `/dev/room-states` (laptop jako całe okno 1:1, telefon w prawdziwej wielkości): poczekalnia i głosowanie z kropkami na liście „Gracze”, dwie odsłony z różnymi zwycięzcami (ta sama osoba w tym samym kolorze, widok „Koło” i „Paski”), podsumowanie z kołem i legendą

**Implementation Note**: Po zielonych bramkach tej fazy zatrzymaj się na ocenę zrzutów przez Karola przed fazą 2.

---

## Phase 2: PR i wdrożenie

### Overview

Zmiana idzie przez PR, bo dotyka `src/lib/rooms/` i `tests/`. Baza się nie zmienia, więc nie ma `db push`. Po scaleniu Workers Builds wdraża produkcję.

### Changes Required:

#### 1. PR

**Intent**: Gałąź `player-colors` z commitami fazy 1 trafia do PR z opisem po polsku. Opis mówi, co widzi gracz, co zostaje bez zmian i że baza się nie zmienia.

**Contract**: `git push` i `gh pr create` za zgodą Karola. Scala tylko Karol (`! gh pr merge <n> --merge`).

### Success Criteria:

#### Automated Verification:

- CI na PR zielone: `ci`, `smoke`, `db`, `e2e` (testy E2E bez zmian, kropka bez tekstu ich nie dotyka)

#### Manual Verification:

- Smoke na produkcji zielony po scaleniu (za zgodą)
- Karol: krótka gra na telefonie i laptopie z co najmniej dwiema odsłonami o różnych zwycięzcach, potem „Zakończ grę”. Każdy gracz ma ten sam kolor na liście „Gracze”, w każdej odsłonie i w podsumowaniu.

---

## Testing Strategy

### Unit Tests:

- `seatColors`: kolejność listy, spóźniony na końcu, zawinięcie po 20 graczach, pusta lista.

### Integration Tests:

- Istniejące testy E2E (`tests/e2e/`) bez zmian i zielone w CI: kropka bez tekstu nie zmienia nazw radiów ani tekstu wierszy.

### Manual Testing Steps:

1. Zrzuty z `/dev/room-states`: poczekalnia, głosowanie, dwie odsłony z różnymi zwycięzcami (Koło i Paski), podsumowanie. Laptop 1:1 i telefon 390 px.
2. Na produkcji: krótka gra, dwie odsłony z różnymi zwycięzcami, „Zakończ grę”, porównanie kolorów każdego gracza na wszystkich ekranach.

## Performance Considerations

Mapa z co najwyżej kilkudziesięciu nicków, budowana przy renderze. Bez znaczenia.

## Migration Notes

Nie dotyczy: bez zmian w bazie i bez nowych danych. Wycofanie to zwykły revert PR.

## References

- Decyzja Karola i granice: `context/changes/player-colors/change.md`
- Paleta i jej kontrast: `src/styles/global.css:78-100`, decyzje S-02: `context/archive/2026-10-13-first-live-round/`
- Podsumowanie i kawałek „pozostali”: `context/archive/2026-10-25-game-summary/change.md`
- Miejsce w słowniku: `context/domain/glossary.md` („miejsce”)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Kolor z miejsca przy stole na wszystkich ekranach

#### Automated

- [x] 1.1 `npm test` przechodzi, w tym nowe przypadki `seatColors` w `tests/unit/chart.test.ts`
- [x] 1.2 `npm run lint` (z `scripts/ui-literals.mjs`), `npx astro check`, `npm run build` przechodzą
- [x] 1.3 `npx prettier --check` dla zmienionych plików `.md`

#### Manual

- [x] 1.4 Karol ocenia zrzuty z `/dev/room-states` (laptop jako całe okno 1:1, telefon w prawdziwej wielkości): poczekalnia i głosowanie z kropkami na liście „Gracze”, dwie odsłony z różnymi zwycięzcami (ta sama osoba w tym samym kolorze, widok „Koło” i „Paski”), podsumowanie z kołem i legendą

### Phase 2: PR i wdrożenie

#### Automated

- [ ] 2.1 CI na PR zielone: `ci`, `smoke`, `db`, `e2e` (testy E2E bez zmian, kropka bez tekstu ich nie dotyka)

#### Manual

- [ ] 2.2 Smoke na produkcji zielony po scaleniu (za zgodą)
- [ ] 2.3 Karol: krótka gra na telefonie i laptopie z co najmniej dwiema odsłonami o różnych zwycięzcach, potem „Zakończ grę”. Każdy gracz ma ten sam kolor na liście „Gracze”, w każdej odsłonie i w podsumowaniu.
