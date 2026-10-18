# Szeroki układ strony pokoju — plan implementacji

## Overview

Strona pokoju `/r/[id]` dostaje od 1024 px szerokości okna układ „M”, który Karol złożył z galerii 15.10:

- poczekalnia w dwóch kolumnach;
- głosowanie hosta i każda odsłona w szerszej kolumnie, z wykresem obok tabeli;
- przyciski hosta w pasku przyklejonym do dołu okna, w głosowaniu dopiero po głosie hosta;
- reszta ekranów jak dziś.

Poniżej 1024 px, czyli na telefonie, strona wygląda piksel w piksel jak dziś. Zmiana kończy się regułą układu w `AGENTS.md`, bramką wizualną pokazującą szeroki układ i testem wieczoru w oknie telefonu.

## Current State Analysis

Audyt i pomiary: `research.md` (zarzuty Z1–Z5). W skrócie:

- Cała strona pokoju to jedna kolumna 512 px: `src/pages/r/[id].astro:62` (`max-w-lg`), nagłówek `src/components/room/AppHeader.astro:16` (Z1).
- Przyciski hosta leżą pod dolną krawędzią okna: po odsłonie przy 5 graczach „Następne pytanie” zaczyna się na y 830 px, przy 20 graczach na y 1537 px, a okno laptopa ma 600–750 px (Z2). Wykres stoi nad tabelą (Z3), listy graczy są długie (Z4).
- Nie ma wspólnej ramy ani miejsca, które mówi, jak szeroka jest strona pokoju. `/dev/room-states` pokazuje każdy stan w ramce 512 px (Z5).
- **Prototyp** na gałęzi `room-wide-layout` (niezacommitowany):
  - `src/components/room/room-layout.ts`: kontekst `RoomLayout` (`now|a|b|c|d|m`), sloty klas, `mixLayout`, `MIX_WIDTH`;
  - wpięty w `RoomLobby`, `RoundVoting`, `RoundReveal`, `HostActions`, `RoundQuestion` i `RoomScreen` (`preview.layout`);
  - `AppHeader` ma prop `width`; strona `/dev/room-layouts?layout=…&state=…` ma 11 próbek; `scripts/ui-literals.mjs` dostał wpis tej strony.
  - Prawdziwa strona używa wariantu `now`, czyli wygląda jak dziś. Na telefonie 11 z 11 stanów M jest piksel w piksel jak dziś.
- Kontrakt kolorów działa: 0 literałów w widokach pokoju. Zmiana dotyczy wyłącznie układu.

## Desired End State

Od 1024 px szerokości okna (`lg:`):

| Stan                                                                                                | Układ                                                                                                               |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Rama strony i nagłówek `/r/[id]`                                                                    | do 1152 px (`max-w-6xl`); `/` i `/j/[token]` bez zmian                                                              |
| Poczekalnia (host i gość)                                                                           | dwie kolumny 2:1: po lewej tytuł, link z „Kopiuj” i „Zacznij grę”; po prawej „Gracze”, przyklejeni przy przewijaniu |
| Głosowanie gościa (przed i po głosie)                                                               | jak dziś: kolumna 512 px pośrodku                                                                                   |
| Głosowanie hosta przed jego głosem                                                                  | kolumna 768 px (`max-w-3xl`); przyciski hosta w jednym rzędzie pod formularzem, nieprzyklejone                      |
| Głosowanie hosta po jego głosie                                                                     | kolumna 768 px; ten sam rząd przycisków jako pasek przyklejony do dołu okna                                         |
| Odsłona (host i gość)                                                                               | kolumna 768 px, wykres obok tabeli; u hosta pasek przyklejony do dołu okna                                          |
| Pominięte ostatnie pytanie, koniec wieczoru, ekran awarii, „Nie jesteś w tym pokoju”, błąd otwarcia | jak dziś: wyśrodkowane w kolumnie 512 px                                                                            |

Pod 1024 px każdy ekran pokoju jest piksel w piksel taki jak dziś. Sprawdzenie:

- zrzuty `/dev/room-window` (jeden stan w prawdziwym oknie strony) na laptopie, monitorze i telefonie;
- `/dev/room-states` z ramkami szerokości strony od 1024 px;
- e2e: dotychczasowy zestaw w oknie laptopa i test wieczoru w oknie telefonu;
- skrypt porównujący telefon z wzorcem sprzed zmiany.

### Key Discoveries:

- Fokus po ruchu hosta idzie na pierwszy `h1`/`h2` w DOM (`src/components/room/RoomScreen.tsx:101`). Tytuł widoku musi zostać pierwszy w DOM, a kolumny ustawia siatka, nie przestawianie elementów.
- e2e szuka po rolach i nazwach: dokładnie jeden region `/^Gracze/` (`tests/e2e/support/room.ts:79-82`), region „Wynik” z tabelą (`tests/e2e/support/round.ts:45`), `alert` „Głos oddany” (`round.ts:39`), `note` po pominięciu (`round.ts:104`). Żadnego regionu nie wolno zdublować.
- `playwright.config.ts:33`: jeden projekt `chromium` (`Desktop Chrome`, 1280×720). Goście powstają przez `browser.newContext` (`tests/e2e/support/room.ts:59-61`).
- Klasy `lg:` to zapytania o szerokość okna, nie ramki. Podgląd w ramce 512 px na szerokim ekranie dostałby szerokie klasy i zgniótłby się. Dlatego `/dev/room-states` dostaje szerokie ramki od 1024 px (`src/pages/dev/room-states.astro:232`, 55 ramek stanów pokoju od linii 399).
- `scripts/ui-literals.mjs:20-21` przepuszcza klasy ze skali domyślnej (`max-w-6xl`, `lg:grid-cols-3`), a zatrzymuje wartości arbitralne (`max-w-[1200px]`).
- Przyciski hosta już zawijają tekst (`HostActions.tsx`: `whitespace-normal`), więc długie pytanie „Na pewno pominąć? Głosy przepadną (zagłosowało N z M)” w rzędzie urośnie w pionie zamiast wyjść poza przycisk.
- `context/foundation/test-stack.md` pisze tylko `/10x-e2e-setup` (nagłówek pliku), więc ta zmiana go nie edytuje.
- Stare ścieżki `context/changes/full-game-evening/`: 26 linii w 21 plikach. Do tego 2 linie w już wgranej migracji `supabase/migrations/20261015122252_full_game_evening.sql`, której nie wolno edytować (AGENTS.md).

## What We're NOT Doing

- Strona główna `/` i strona linku `/j/[token]` zostają w kolumnie 512 px, razem z nagłówkiem.
- Bez nowych kolorów i tokenów kolorów. Szerokości ze skali domyślnej Tailwind (`max-w-lg`, `max-w-3xl`, `max-w-6xl`), bez własnych progów, wartości arbitralnych i zapytań o kontener.
- Głosowanie gościa zostaje wąskie; przy 20 graczach gość dalej przewija listę. To wybór Karola z galerii, więc Z4 dla głosowania jest odroczone.
- Odroczenia z researchu zostają odroczone: ręcznie złożone prymitywy (`toggle-group`, `table`, `radio-group`) oraz R4/K1 z S-01.
- Bez testu zrzutów w CI (`toHaveScreenshot`). Strony `/dev/*` odpowiadają 404 w buildzie, na którym chodzi e2e, a wzorce zrzutów zależą od systemu. Telefon pilnuje lokalny skrypt porównania w tej zmianie i test wieczoru w oknie telefonu.
- Projekt telefonu w e2e bez emulacji dotyku: sprawdza układ, nie gesty.
- Bez zmian w bazie, endpointach i logice gry. Odłożone poprawki S-03 (F2, F3, F5) idą osobno.

## Implementation Approach

Prototyp zamienia się w zwykły kod. Wybrane klasy stają się klasami komponentów, a przełącznik wariantów znika. Wszystkie szerokości strony pokoju mieszkają w jednym małym module (`room-frame.ts`), który czytają strona, nagłówek, `RoomScreen` i strony podglądów. `HostActions` dostaje jedno ustawienie położenia przycisków. Strona `/dev/room-layouts` zostaje przerobiona na stałą `/dev/room-window`: jeden stan w prawdziwym oknie strony, do zrzutów i do sprawdzania paska przy dolnej krawędzi.

Komentarze w kodzie odsyłają do reguły w `AGENTS.md` §UI, a nie do folderu zmiany. Ścieżka folderu zmienia się przy archiwum, a stąd wzięło się 26 starych ścieżek po S-03.

## Critical Implementation Details

- **Wzorzec telefonu przed usunięciem prototypu.** Zanim faza 1 ruszy kod, skrypt w scratchpadzie robi zrzuty całych stron w oknie 390×844:
  - `/dev/room-layouts?layout=now&state=…` dla 11 stanów, z bieżącego drzewa (`now` to dzisiejszy ekran);
  - `/dev/room-states` z `main`: `git stash -u`, serwer dev, zrzut, `git stash pop`.

  Po zmianie te same zrzuty z `/dev/room-window` i `/dev/room-states` muszą być identyczne bajt w bajt. Dalej obowiązuje zasada: serwer dev tylko do podglądów `/dev/*` bez sieci, zatrzymany po pracy (`npx astro dev stop`).

- **Pasek przyklejony.** `position: sticky` działa tylko wtedy, gdy żaden przodek nie ma `overflow` innego niż `visible`. Dziś `main` i opakowania wyspy (`display: contents`) go nie mają. Pasek potrzebuje tła `bg-background` i warstwy nad treścią, bo przewijana treść przechodzi pod nim.
- **Klasy dosłownie w źródle.** Tailwind znajduje klasy tylko w pełnych napisach, więc `room-frame.ts` trzyma całe klasy (`"lg:max-w-3xl"`), nigdy sklejane (`` `lg:max-w-${x}` ``).
- **Okno gości w projekcie telefonu.** Goście powstają przez `browser.newContext` i powinni dostać okno z ustawień projektu. Test wieczoru na starcie sprawdza, że okno każdego gracza ma wymiary projektu. Projekt telefonu, który po cichu zagrałby w oknie laptopa, zapali wtedy test, zamiast dać fałszywą zieleń.

## Faza 1: Układ M w kodzie

### Overview

Klasy mieszanki M stają się klasami komponentów. Strona i nagłówek pokoju dostają szeroką ramę, `RoomScreen` daje każdemu stanowi jego kolumnę, a pasek hosta pojawia się w głosowaniu dopiero po głosie hosta. Prototyp znika, w jego miejsce wchodzi `/dev/room-window`. Telefon zostaje bez zmian, a Karol ocenia zrzuty.

### Changes Required:

#### 1. Szerokości strony pokoju w jednym miejscu

**File**: `src/components/room/room-frame.ts` (nowy; zastępuje `room-layout.ts`, który znika)

**Intent**: Jedno źródło szerokości strony pokoju. To odpowiedź na brakującą ramę z Z5.

**Contract**:

- `ROOM_FRAME`: klasy ramy strony i nagłówka (`max-w-lg lg:max-w-6xl`).
- `ROOM_NARROW`: kolumna ekranów wyśrodkowanych (`mx-auto w-full max-w-lg`).
- `roomColumn(view: RoomView): string`: kolumna stanu, zawsze `mx-auto w-full max-w-lg`, a od `lg:`:
  - poczekalnia: `lg:max-w-6xl`;
  - głosowanie hosta (przed i po głosie) oraz każda odsłona: `lg:max-w-3xl`;
  - każdy inny stan: bez szerszej klasy.
- Komentarz modułu odsyła do `AGENTS.md` §UI.

#### 2. Strona i nagłówek

**File**: `src/pages/r/[id].astro`, `src/components/room/AppHeader.astro`, `src/components/room/RoomMessage.astro`

**Intent**: Szeroka rama tylko na stronie pokoju. Komunikaty wyśrodkowane zostają w 512 px.

**Contract**:

- `<main>` strony pokoju używa `ROOM_FRAME` zamiast `max-w-lg`.
- `AppHeader` przyjmuje `wide?: boolean` (zamiast prototypowego `width`): z nim `ROOM_FRAME`, bez niego `max-w-lg`. Przekazuje go tylko `/r/[id]`.
- Sekcja `RoomMessage` dostaje `ROOM_NARROW`, więc w ramce 512 px (`/j/[token]`, podglądy) wygląda tak samo jak dziś.

#### 3. Kolumna stanu w `RoomScreen`

**File**: `src/components/room/RoomScreen.tsx`, `src/components/room/RoomErrorBoundary.tsx`

**Intent**: Każdy stan ma swoją kolumnę; baner połączenia i notka po pominięciu mają szerokość stanu.

**Contract**:

- Korzeń `RoomContent` łączy dzisiejsze `flex flex-col gap-6` z `roomColumn(view)`.
- Znikają `RoomLayoutContext`, `preview.layout`, `mixLayout` i `MIX_WIDTH`.
- Ekran awarii (`RoomErrorBoundary`, poza `RoomContent`) dostaje `ROOM_NARROW`.
- Kolejność DOM bez zmian: region `aria-live`, baner, notka, widok.

#### 4. Poczekalnia w dwóch kolumnach

**File**: `src/components/room/RoomLobby.tsx`

**Intent**: Wariant A z galerii jako jedyny układ poczekalni od `lg:`, u hosta i u gościa.

**Contract**:

- Korzeń: siatka 3 kolumn od `lg:`.
- Grupa gry (tytuł, link, „Zacznij grę”, błędy) na 2 kolumny; grupa „Gracze” na 1, przyklejona przy przewijaniu (`lg:sticky lg:top-6`).
- Pod `lg:` obie grupy mają `display: contents`, więc bloki stoją w jednej kolumnie jak dziś. Tytuł pierwszy w DOM.

#### 5. Głosowanie

**File**: `src/components/room/RoundVoting.tsx`

**Intent**: Głosowanie gościa jak dziś. Głosowanie hosta w szerszej kolumnie z rzędem przycisków, który po głosie hosta staje się paskiem.

**Contract**:

- Struktura widoku wraca do tej z `main`: bez grup main/side z prototypu, sekcja „Gracze” w dzisiejszym miejscu.
- `HostActions` dostaje `placement={hasVoted ? "bar" : "row"}`.
- Lista wyboru zostaje w jednej kolumnie.

#### 6. Odsłona

**File**: `src/components/room/RoundReveal.tsx`

**Intent**: Wykres obok tabeli od `lg:`, u hosta pasek przycisków (Z2, Z3).

**Contract**:

- Sekcja „Wynik” to siatka 2 kolumn od `lg:`. Wiersz z nagłówkiem i przełącznikiem oraz wiersz „Wstrzymało się” zajmują pełną szerokość. Tabela zajmuje pełną szerokość, gdy wykres jest ukryty („Paski”).
- `HostActions` dostaje `placement="bar"`.
- Bez grup main/side z prototypu. `ResultPie` zostaje bez propa `className`, jeśli nie jest potrzebny.

#### 7. Położenie przycisków hosta

**File**: `src/components/room/HostActions.tsx`, `src/components/room/RoundQuestion.tsx`

**Intent**: Jedno ustawienie zamiast slotów prototypu.

**Contract**:

- `placement?: "stack" | "row" | "bar"`, domyślnie `stack`, czyli jak dziś (`RoundSkipped` go nie podaje).
  - `row`: od `lg:` wszystkie akcje w jednym rzędzie, każda równej szerokości.
  - `bar`: `row`, a do tego od `lg:` przyklejone do dołu okna, z tłem strony i warstwą nad treścią.
- Pod `lg:` każde położenie wygląda jak dziś.
- Pytanie potwierdzenia z „Anuluj” mieści się w rzędzie bez ucinania tekstu. Wolno mu zawinąć się w kilka linii albo zająć cały rząd.
- `RoundQuestion` wraca do wersji z `main` (bez propa `className`).

#### 8. `/dev/room-window` zamiast prototypu

**File**: `src/pages/dev/room-layouts.astro` → `src/pages/dev/room-window.astro`, `scripts/ui-literals.mjs`

**Intent**: Stała strona dev: jeden stan pokoju w prawdziwej ramie strony (nagłówek `wide` + `main` z `ROOM_FRAME`), do zrzutów całego okna i do sprawdzania paska przy dolnej krawędzi.

**Contract**:

- `?state=<id>` pokazuje jeden stan, bez parametru listę linków. 404 na produkcji jak `room-states.astro`.
- Próbki: 11 stanów z prototypu oraz host z otwartym potwierdzeniem w pasku, w głosowaniu („Pomiń pytanie”) i po odsłonie („Zakończ grę”). Potwierdzenie przez `preview.host`.
- Bez parametru `layout`.
- `scripts/ui-literals.mjs`: wpis `room-window.astro` zamiast `room-layouts.astro`, bez komentarza TEMPORARY.

### Success Criteria:

#### Automated Verification:

- Lokalna bramka zielona: `npm run lint` (z literałami UI), `npx astro check`, `npm test`, `npm run build`
- Po prototypie nie ma śladu: `git grep -nE "room-layout|RoomLayout|room-layouts|mixLayout|MIX_WIDTH" -- src scripts` nic nie znajduje
- Telefon bez zmian: zrzuty całych stron 390×844 wszystkich stanów `/dev/room-window` i całej `/dev/room-states` identyczne bajt w bajt ze wzorcem sprzed zmiany (skrypt w scratchpadzie)
- CI zielone (`ci`, `db`, `smoke`, `e2e`) na commicie fazy, na gałęzi ze szkicem PR (push i PR za zgodą Karola)

#### Manual Verification:

- Karol ocenia zrzuty na stronie „Co oceniasz” (laptop 1280×600 jako całe okno, monitor 1920×950 dla odsłony, telefon 390×844 w prawdziwej wielkości):
  - stany jak w galerii M;
  - pasek hosta dopiero po głosie hosta;
  - potwierdzenie w pasku czytelne
- Klawiatura w oknie 1280×600, sprawdzona skryptem w Chrome bez okna:
  - Tab idzie w kolejności ekranu (w poczekalni lewa kolumna, potem „Gracze”);
  - przyciski paska są osiągalne;
  - element z fokusem nie chowa się pod paskiem

**Implementation Note**: Po fazie 1 pauza na ocenę zrzutów przez Karola. Push i szkic PR tylko za zgodą.

---

## Faza 2: Bramka, reguła i test telefonu

### Overview

Strona stanów pokazuje szeroki układ, reguła w `AGENTS.md` utrzymuje następnych agentów przy ramie, a test wieczoru gra drugi raz w oknie telefonu, z próbnym alarmem. Przy okazji porządek ze starymi ścieżkami.

### Changes Required:

#### 1. Bramka wizualna

**File**: `src/pages/dev/room-states.astro`

**Intent**: Od 1024 px każdy podgląd pokoju ma szerokość strony, więc bramka pokazuje to, co gracze widzą na laptopie (Z5).

**Contract**:

- W sekcji „Pokój (/r/…)” siatka przechodzi od `lg:` na jedną kolumnę, a ramki stanów dostają `ROOM_FRAME` zamiast samego `max-w-lg`.
- Tekst wstępu strony mówi, że od 1024 px stany pokoju mają szerokość strony.
- Pozostałe sekcje (nagłówek, `/`, `/j/…`) bez zmian. Szeroki nagłówek pokazuje `/dev/room-window`, w prawdziwej ramie strony.

#### 2. Reguła układu

**File**: `AGENTS.md` (§UI)

**Intent**: Krok „Utrwal to” z `/10x-ui`: następny ekran pokoju nie skopiuje wąskiej kolumny ani nie złamie telefonu.

**Contract**: 2–3 krótkie punkty w §UI:

- szerokości strony pokoju bierze się z `src/components/room/room-frame.ts`; pod `lg` (1024 px) każdy ekran pokoju to kolumna 512 px; szerokie klasy tylko od `lg:`, ze skali domyślnej, bez wartości arbitralnych;
- tytuł widoku pierwszy w DOM (fokus po ruchu hosta), kolumny przez siatkę; każdy region tylko raz (e2e szuka „Gracze” i „Wynik” po rolach);
- nowy stan pokoju dostaje podgląd w `/dev/room-states`, a gdy zmienia okno, także stan w `/dev/room-window`.

#### 3. Test wieczoru w oknie telefonu

**File**: `playwright.config.ts`, `tests/e2e/game.spec.ts`

**Intent**: Po zmianie dotychczasowy e2e gra tylko w szerokim układzie. Drugi przebieg testu wieczoru w oknie telefonu łapie błąd widoczny tylko na telefonie, np. przyciski hosta schowane poniżej 1024 px. Decyzja Karola: wieczór też na telefonie.

**Contract**:

- Nowy projekt `phone`: `testMatch` tylko `game.spec.ts`, okno 390×844, ta sama sesja hosta (`storageState`), zależny od `setup`, bez emulacji dotyku.
- Projekt `chromium` bez zmian.
- `game.spec.ts` na starcie sprawdza, że okno hosta i obu gości ma wymiary okna projektu (Critical Implementation Details).

#### 4. Plan testów

**File**: `context/foundation/test-plan.md`

**Intent**: Plan testów mówi, co pilnuje telefonu.

**Contract**:

- §4, wiersz e2e: projekt `phone` z `game.spec.ts`.
- §5, wiersz e2e, kolumna „Catches”: zepsuty układ telefonu w wieczorze.
- §6.4: wzorzec „spec w oknie telefonu” (projekt, `testMatch`, kontrola okna graczy) i wynik próbnego alarmu.

#### 5. Stare ścieżki

**File**: 21 plików z `context/changes/full-game-evening/` (`src/`, `tests/`, `scripts/smoke.mjs`, `supabase/tests/`), `src/styles/global.css:6`

**Intent**: Zaległość po archiwum S-03, uzgodniona na PR następnej zmiany.

**Contract**:

- 26 linii → `context/archive/2026-10-15-full-game-evening/`.
- `global.css:6` → `context/archive/2026-10-04-ui-signin-contract/theme.md`.
- Wgrana migracja `20261015122252_full_game_evening.sql` bez zmian (2 linie zostają).

### Success Criteria:

#### Automated Verification:

- Lokalna bramka zielona: `npm run lint`, `npx astro check`, `npm test`, `npm run build`; `npx playwright test --list` pokazuje `game.spec.ts` w projektach `chromium` i `phone`
- Telefon bez zmian po zmianie bramki: zrzut sekcji „Pokój (/r/…)” strony `/dev/room-states` w oknie 390×844 identyczny bajt w bajt ze wzorcem z fazy 1
- Stare ścieżki: `git grep -n "context/changes/full-game-evening"` znajduje tylko 2 linie wgranej migracji, a `git grep -n "context/changes/ui-signin-contract" -- src` nic
- CI zielone (`ci`, `db`, `smoke`, `e2e` z projektem `phone`)
- Próbny alarm: tymczasowy commit chowa przyciski hosta poniżej 1024 px (`HostActions` niewidoczne pod `lg:`). Czerwony tylko `game.spec.ts` w projekcie `phone`, `chromium` zielony. Po `git revert` CI znów zielone

#### Manual Verification:

- Wynik próbnego alarmu opisany w PR (który test, na którym kroku zaświecił)

**Implementation Note**: Każdy push, także commitu alarmu i jego revertu, za zgodą Karola (seria może być jednym pytaniem).

---

## Faza 3: Przegląd i wdrożenie

### Overview

Przegląd implementacji, scalenie przez Karola, smoke na produkcji i sprawdzenie na prawdziwym pokoju. Bez zmian w bazie, więc bez `db push`.

### Changes Required:

#### 1. Przegląd

**File**: `context/changes/room-wide-layout/reviews/impl-review.md`

**Intent**: `/10x-impl-review room-wide-layout` i triage z Karolem. Ustalenia UI nie są z automatu kosmetyką do pominięcia. Po poprawkach uruchomić zmienione skrypty i przeklikać zmienione ekrany (lessons.md, wpis 3).

**Contract**: każde ustalenie z decyzją (poprawione albo odłożone z powodem).

#### 2. Wdrożenie

**File**: — (polecenia)

**Intent**: Zmiana `src/pages/r/` i `tests/` idzie tylko przez PR na zielonym CI (AGENTS.md).

**Contract**:

1. PR „ready for review”, CI zielone.
2. Karol scala (`! gh pr merge <n> --merge`); Workers Builds wdraża.
3. `BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke` (pytanie).
4. Gałąź usunięta lokalnie i zdalnie (pytanie), lokalny `main` na `origin/main`.

#### 3. Notatki

**File**: `context/changes/room-wide-layout/change.md` (Notes), `context/foundation/test-plan.md` §6.6

**Intent**: Wynik zapisany; archiwum robi `/10x-archive`.

**Contract**: 2–3 linie: test telefonu i wynik alarmu, co pokazało sprawdzenie Karola.

### Success Criteria:

#### Automated Verification:

- Workers Builds po scaleniu zielone
- Smoke na produkcji zielony

#### Manual Verification:

- Karol na produkcji: na laptopie z przeglądarką na całym ekranie poczekalnia w dwóch kolumnach, a w rundzie odsłona z wykresem obok tabeli i paskiem hosta bez przewijania; na telefonie wszystko jak dawniej (laptop host + telefon + incognito, jedna runda)
- `/10x-impl-review` zakończone, ustalenia rozstrzygnięte z Karolem

**Implementation Note**: Push, smoke i usunięcie zdalnej gałęzi tylko za zgodą; scala wyłącznie Karol.

---

## Testing Strategy

### Unit Tests:

- Bez nowych. `roomColumn` tylko przypisuje klasy stanom; test powtarzający te klasy byłby lustrem implementacji (test-plan §6.1, wyrocznia). Układ sprawdzają zrzuty, porównanie telefonu i e2e.

### Integration Tests:

- e2e w oknie laptopa (projekt `chromium`): cały dotychczasowy zestaw na szerokim układzie, także pasek hosta.
- e2e w oknie telefonu (projekt `phone`): `game.spec.ts` z kontrolą okna graczy; próbny alarm dowodzi, że łapie schowane przyciski.

### Manual Testing Steps:

1. Strona „Co oceniasz” ze zrzutami `/dev/room-window` (faza 1).
2. Klawiatura w oknie laptopa skryptem (faza 1).
3. Prawdziwy pokój na produkcji: laptop + telefon + incognito (faza 3).

## Performance Considerations

Tylko klasy CSS i jeden przebieg e2e więcej (ok. 15–20 s joba `e2e`).

## Migration Notes

Brak zmian w bazie. Wycofanie to revert scalenia; bez kolejności „baza, potem kod”.

## References

- Research i zarzuty Z1–Z5: `context/changes/room-wide-layout/research.md`
- Wybór Karola (galerie, mieszanka M, pasek po głosie hosta, szeroki nagłówek): `context/changes/room-wide-layout/change.md`
- Prototyp: `src/components/room/room-layout.ts`, `src/pages/dev/room-layouts.astro` (na gałęzi, niezacommitowane)
- Wzorzec planu z wdrożeniem przez PR: `context/archive/2026-10-15-full-game-evening/plan.md`
- Bramka wizualna i podglądy: `src/pages/dev/room-states.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Układ M w kodzie

#### Automated

- [x] 1.1 Lokalna bramka zielona: `npm run lint` (z literałami UI), `npx astro check`, `npm test`, `npm run build` — 0ed1d4e
- [x] 1.2 Po prototypie nie ma śladu: `git grep -nE "room-layout|RoomLayout|room-layouts|mixLayout|MIX_WIDTH" -- src scripts` nic nie znajduje — 0ed1d4e
- [x] 1.3 Telefon bez zmian: zrzuty całych stron 390×844 wszystkich stanów `/dev/room-window` i całej `/dev/room-states` identyczne bajt w bajt ze wzorcem sprzed zmiany — 0ed1d4e
- [x] 1.4 CI zielone (`ci`, `db`, `smoke`, `e2e`) na commicie fazy, na gałęzi ze szkicem PR — 0ed1d4e

#### Manual

- [x] 1.5 Karol ocenia zrzuty (laptop 1280×600 jako całe okno, monitor 1920×950 dla odsłony, telefon 390×844): stany jak w galerii M, pasek hosta po głosie hosta, potwierdzenie w pasku czytelne — 0ed1d4e
- [x] 1.6 Klawiatura w oknie 1280×600 (skrypt w Chrome bez okna): kolejność Tab zgodna z ekranem, przyciski paska osiągalne, fokus nie chowa się pod paskiem — 0ed1d4e

### Phase 2: Bramka, reguła i test telefonu

#### Automated

- [x] 2.1 Lokalna bramka zielona; `npx playwright test --list` pokazuje `game.spec.ts` w projektach `chromium` i `phone` — 519bf3f
- [x] 2.2 Telefon bez zmian po zmianie bramki: zrzut sekcji „Pokój (/r/…)” strony `/dev/room-states` w oknie 390×844 identyczny ze wzorcem z fazy 1 — 519bf3f
- [x] 2.3 Stare ścieżki: `git grep` znajduje `context/changes/full-game-evening` tylko w 2 liniach wgranej migracji, a `context/changes/ui-signin-contract` w `src` wcale — 519bf3f
- [x] 2.4 CI zielone (`ci`, `db`, `smoke`, `e2e` z projektem `phone`) — 519bf3f
- [x] 2.5 Próbny alarm: przyciski hosta schowane pod 1024 px zapalają tylko `game.spec.ts` w projekcie `phone`; po `git revert` CI zielone — 7fa4c80

#### Manual

- [x] 2.6 Wynik próbnego alarmu opisany w PR — e56592a

### Phase 3: Przegląd i wdrożenie

#### Automated

- [x] 3.1 Workers Builds po scaleniu zielone — 287ab1a
- [x] 3.2 Smoke na produkcji zielony — 287ab1a

#### Manual

- [x] 3.3 Karol na produkcji: na laptopie poczekalnia w dwóch kolumnach, odsłona z wykresem obok tabeli i paskiem hosta bez przewijania; na telefonie jak dawniej — 287ab1a
- [x] 3.4 `/10x-impl-review` zakończone, ustalenia rozstrzygnięte z Karolem — 8722b0e
