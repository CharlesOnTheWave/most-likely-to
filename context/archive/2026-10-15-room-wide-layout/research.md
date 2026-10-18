---
date: 2026-10-15T20:22:45+02:00
researcher: Claude (Opus 5.5) z Karolem
git_commit: 2916ed0
branch: main
repository: CharlesOnTheWave/most-likely-to
topic: "Szeroki układ strony pokoju /r/[id] na laptopie i dużym monitorze: audyt /10x-ui i 4 kierunki układu"
tags: [research, ui, layout, room-screen, 10x-ui]
status: complete
last_updated: 2026-10-15
last_updated_by: Claude (Opus 5.5)
---

# Research: Szeroki układ strony pokoju `/r/[id]`

**Date**: 2026-10-15T20:22:45+02:00
**Researcher**: Claude (Opus 5.5) z Karolem
**Git Commit**: 2916ed0
**Branch**: main (gałąź zmiany jeszcze nie istnieje)
**Repository**: CharlesOnTheWave/most-likely-to

## Research Question

Audyt `/10x-ui` jednego widoku: strona pokoju `/r/[id]` (`RoomScreen` i jej stany: poczekalnia, głosowanie, odsłona, pominięte ostatnie pytanie, koniec wieczoru, ekran po wysypaniu) z nagłówkiem `AppHeader`. Wynik:

- 3–5 zarzutów z plikiem, linią i wpływem na gracza;
- 4 kierunki szerokiego układu (decyzja Karola: dokładnie 4) do zbudowania na tymczasowej stronie podglądów z prawdziwymi komponentami;
- sposób zrobienia zrzutów do oceny (laptop jako całe okno 1:1, telefon w prawdziwej wielkości).

## Summary

- **Wariant kontraktu: istniejący system projektowy, bez braków kolorystycznych.** Skan literałów (`node scripts/ui-literals.mjs`, 2026-10-15) daje `0 literals in 33 view files`. Widoki pokoju czytają role kolorów i komponenty z `src/components/ui`. Problem dotyczy wyłącznie układu.
- **Cała strona pokoju to jedna kolumna 512 px** (`max-w-lg`, `src/pages/r/[id].astro:62`, nagłówek `src/components/room/AppHeader.astro:16`). Warstwa stylów nie ma tokenu szerokości, kontenera ani własnych progów: `src/styles/global.css:111-162` publikuje w `@theme inline` tylko promień i kolory, więc obowiązują domyślne progi Tailwind 4 (`lg` = 64rem = 1024 px).
- **Pomiar (2026-10-15, `/dev/room-states` w Chrome bez okna, kolumna 512 px, przeliczone na stronę: nagłówek 57 px + odstęp 32 px):**
  - u hosta po odsłonie (5 graczy) „Następne pytanie” zajmuje y 830–866 px, a „Zakończ grę” 878–916 px;
  - przy 20 graczach te same przyciski zajmują y 1537–1623 px;
  - w trakcie głosowania (host po głosie) „Odsłoń wynik” zajmuje y 690–726 px, a „Zakończ grę” 788–826 px.
  - W oknie laptopa 1536×750, w którym Karol oceniał zrzuty przy S-03, przyciski hosta po odsłonie leżą więc pod dolną krawędzią ekranu, w obu zmierzonych składach.
- **Strukturalnie podział na kolumny nie wymaga przenoszenia logiki** w poczekalni, po głosie i po odsłonie: bloki są tam rodzeństwem w jednym korzeniu widoku (`RoomLobby.tsx:80`, `RoundVoting.tsx:165-190`, `RoundReveal.tsx:132` i `:224`).
  - Wyjątek: przed głosem lista graczy to formularz głosu (`RoundVoting.tsx:195`), więc nie da się jej wydzielić do osobnej kolumny bez duplikowania.
  - Ograniczenia testów i fokusu (niżej) wykluczają dublowanie list.
- **Wybór układu należy do Karola** (`change.md`, decyzja 15.10): 4 kierunki opisane niżej trafiają na tymczasową stronę podglądów. Plan powstaje dopiero po wyborze.

## Charges

Każdy zarzut: plik:linia, kategoria i jedno zdanie o wpływie na gracza. Pomiary dotyczą okna 1536×750 i podglądów z `/dev/room-states`, przeliczonych na stronę `/r/[id]`.

### Z1 — Strona pokoju zamknięta w kolumnie 512 px na każdym ekranie (przypadkowa architektura)

- **Gdzie:**
  - `src/pages/r/[id].astro:62`: `mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8`;
  - `src/components/room/AppHeader.astro:16`: ta sama szerokość nagłówka, bez propa do jej zmiany.
- **Dowód:** szerokość wzięła się z formularzy (`/`, `/j/[token]` mają tę samą klasę: `index.astro:40`, `j/[token].astro:66`), a nie z decyzji o ekranie gry. PRD wymienia komputer jedynie raz, w zdaniu „Gra działa w przeglądarce telefonu i komputera” (`prd.md:140`).
- **Wpływ:** na laptopie i monitorze gra zajmuje wąski pasek pośrodku (512 z 1536 px, czyli jedną trzecią), a host i goście przewijają ekran, choć obok jest puste miejsce.

### Z2 — Przyciski hosta po odsłonie i w trakcie głosowania pod dolną krawędzią ekranu (przypadkowa architektura)

- **Gdzie:**
  - `src/components/room/RoundReveal.tsx:224-230`: `HostActions` stoi pod całą sekcją wyniku;
  - `src/components/room/HostActions.tsx:115-131`: każda akcja to osobny wiersz na całą szerokość (`flex flex-col gap-2 sm:flex-row` tylko dla pary „Na pewno…” + „Anuluj”);
  - `src/components/room/RoundVoting.tsx:271-299`: przyciski pod formularzem głosu.
- **Dowód:** pomiar z Summary. Przy 5 graczach „Następne pytanie” zaczyna się na y 830 px, a przy 20 graczach na y 1537 px. Okno ma 750 px wysokości.
- **Wpływ:** po każdej odsłonie host musi przewinąć ekran, żeby poprowadzić wieczór dalej („Następne pytanie”, „Zakończ grę”). To główny powód tej zmiany w roadmapie (`roadmap.md:329`).

### Z3 — Odsłona: mały wykres nad rozciągniętą tabelą (przypadkowa architektura)

- **Gdzie:** `src/components/room/RoundReveal.tsx:86` i `:159` (koło `size-48 sm:size-56`, czyli stałe 192/224 px, wyśrodkowane) oraz `:161-214` (tabela `w-full` pod wykresem; w widoku „Paski” pasek zajmuje procent komórki z nickiem, `:180-191`).
- **Dowód:** sekcja wyniku hosta ma 827 px wysokości przy 5 graczach i 1534 px przy 20 graczach (pomiar). Wykres i tabela pokazują ten sam wynik jeden pod drugim.
- **Wpływ:** wynik, czyli najważniejszy moment rundy, nie mieści się na jednym ekranie laptopa. Na szerokiej kolumnie koło zostałoby małe, a paski rozciągnięte.

### Z4 — Długie listy graczy w jednej kolumnie (przypadkowa architektura)

- **Gdzie:**
  - `src/components/room/RoundVoting.tsx:195-244`: lista wyboru z jednym wierszem na gracza i „Wstrzymuję się”;
  - `src/components/room/RoomLobby.tsx:158`: lista graczy w poczekalni;
  - wiersz ok. 45 px: `px-3 py-2.5`, szacunek z klas (`RoundVoting.tsx:54-56`).
- **Dowód:** podgląd głosowania z 20 graczami ma 1254 px wysokości (pomiar `vote-20`), a „Zagłosuj” stoi pod listą.
- **Wpływ:** przy większej ekipie gracz na laptopie przewija listę, żeby wybrać osobę i dojść do „Zagłosuj”.

### Z5 — Brak wspólnej ramy strony i tokenu szerokości; podglądy na sztywno w 512 px (brakujący token / przypadkowa architektura)

- **Gdzie:**
  - `max-w-lg` wpisane w `r/[id].astro:62`, `AppHeader.astro:16`, `index.astro:40`, `j/[token].astro:66` oraz w 71 ramkach podglądów `src/pages/dev/room-states.astro` (np. `:233`);
  - `global.css:111-162` nie ma tokenu szerokości ani progów;
  - `AGENTS.md:44-49` mówi tylko o kolorach.
- **Dowód:** `/dev/room-states` pokazuje każdy stan w ramce `max-w-lg` (`room-states.astro:232`: `grid … md:grid-cols-2 xl:grid-cols-3`), więc szerokiego układu nie da się tam dziś zobaczyć.
- **Wpływ:** pośredni. Bez wspólnej ramy następny ekran skopiuje wąską kolumnę, a bramka wizualna (strona stanów) nie pokaże układu, który gracze zobaczą na laptopie.

### Odroczone (poza układem; nie usuwać)

- **Ręcznie złożone prymitywy:**
  - listy `ul.divide-y.rounded-md.border` ×3 (`RoomLobby.tsx:158`, `RoundVoting.tsx:178, :195`);
  - wyśrodkowany komunikat ×3 (`RoomMessage.astro:13`, `RoomScreen.tsx:54`, `RoomErrorBoundary.tsx:61`);
  - tytuł `text-2xl font-semibold text-balance` ×6 bez komponentu;
  - przełącznik „Koło | Paski”, `<table>` i radia bez zainstalowanych `toggle-group`, `table`, `radio-group` (`RoundReveal.tsx:138-155, :162-213`; `RoundVoting.tsx:203-240`).
  - Powód odroczenia: nie zmieniają układu, a ich wymiana to osobne ryzyko (e2e szuka ról `radio`, `table`, `alert`).
- **R4 (słabe obramowania pól) i K1 (słabo widoczny hover przycisków)** z `context/archive/2026-10-04-ui-signin-contract/ui-checks.md:47,52`: odłożone w S-01 „przez `/10x-ui` po scaleniu S-01 i S-05” (`context/archive/2026-10-07-room-lobby/plan.md:65`). Nie znaleziono zapisu o ich zamknięciu. Powód odroczenia: dotyczą kolorów i formularzy `/`, poza zakresem tej zmiany.
- **Stara ścieżka** w `src/styles/global.css:6` (`context/changes/ui-signin-contract/theme.md`, folder jest w archiwum). Powód odroczenia: komentarz, a plik stylów jest poza widokiem; do poprawienia przy okazji.

## Detailed Findings

### Rama strony i kolejność bloków

- `Layout.astro:14`: `<html class="dark">`; tło i kolor tekstu z tokenów.
- `RoomScreen.tsx:193` (`flex flex-col gap-6`) jest bezpośrednim dzieckiem `<main>`, bo wyspa Astro i `RoomErrorBoundary` (`:54`) mają `display: contents`. Kolejność w kolumnie:
  - ukryty region `aria-live` (`:194-196`);
  - `LiveBanner` poza stanem `closed` (`:197`);
  - notka po pominięciu (`:198-205`);
  - widok w `div.contents` z `contentRef` (`:207`).
- Bloki widoków (pełny spis: raport agenta w tej sesji; najważniejsze kotwice):
  - poczekalnia u hosta to tytuł, link z „Kopiuj”, „Zacznij grę” i „Gracze (N)” (`RoomLobby.tsx:81-169`); u gościa tylko tytuł i „Gracze” (`:90`, `:119`);
  - głosowanie to pytanie z podpowiedzią (`RoundVoting.tsx:158-161`), potem formularz (`:192-268`) albo „Głos oddany” i „Gracze” (`:164-190`); u hosta dochodzi `HostActions` (`:271-299`);
  - odsłona to pytanie, sekcja „Wynik” (przełącznik, koło, tabela, „Wstrzymało się”, `RoundReveal.tsx:132-222`) i `HostActions` u hosta (`:224-230`);
  - pominięte ostatnie pytanie, koniec wieczoru i ekran po wysypaniu to pojedyncze wyśrodkowane sekcje (`RoundSkipped.tsx:29-43`, `RoomScreen.tsx:52-68`, `RoomErrorBoundary.tsx:60-77`).
- Responsywność dziś to wyłącznie progi `sm:`: `HostActions.tsx:121, :131` i `RoundReveal.tsx:86`. W `src/components/room` ani `src/pages/r` nie ma klas `md:`, `lg:` ani `xl:` (przeszukane oba katalogi).

### Ograniczenia, których żaden wariant nie może złamać

- **Fokus po ruchu hosta** idzie na pierwszy `h1, h2` w `contentRef`, w kolejności DOM (`RoomScreen.tsx:101`). Tytuł widoku musi zostać pierwszy w DOM; kolumny ustawia siatka (`grid`, `order`), nie przestawianie elementów w kodzie.
- **e2e** (lokatory po rolach i nazwach):
  - pytanie i „Koniec wieczoru” jako nagłówki poziomu 1 (`tests/e2e/support/round.ts:16, :109`);
  - region „Wynik” z tabelą (`round.ts:45`);
  - dokładnie jeden region `/^Gracze/` (`tests/e2e/support/room.ts:79-82`), więc druga kopia listy złamie tryb ścisły Playwrighta;
  - `alert` „Głos oddany” (`round.ts:39`) i `note` po pominięciu (`round.ts:104`).
- **Okno e2e:** projekt hosta używa `devices["Desktop Chrome"]` (`playwright.config.ts:33`), a goście zwykłego `browser.newContext` (`room.ts:60`). Oba dostają domyślne 1280×720 Playwrighta (wartość domyślna narzędzia, nie zapisana w repo). Przy progu ≤ 1280 px e2e sprawdza więc szeroki układ, a układu telefonu żaden test w przeglądarce nie obejmie.
- **Skan literałów** (`scripts/ui-literals.mjs:20-21`) zatrzyma `max-w-[1200px]`, `grid-cols-[320px_1fr]` i `min-[1024px]:`. Przepuści klasy ze skali domyślnej (`lg:grid-cols-3`, `max-w-6xl`) i formę `max-w-(--x)`. Podfolder w `src/components/room/` wywróci skan (`readFileSync` na katalogu, `:16`, `:25`; wniosek z kodu, nieuruchomione).
- **Telefon bez zmian:** każda zmiana układu idzie za progiem `lg:` (1024 px). Pod nim klasy zostają takie jak dziś.

### Sprzężenia

- `AppHeader` jest wspólny dla `/`, `/j/[token]` i `/r/[id]` (`index.astro:39`, `j/[token].astro:65`, `r/[id].astro:61`). Szerszy nagłówek tylko na stronie pokoju wymaga propa szerokości (dziś go nie ma, `AppHeader.astro:8-12`).
- `HostActions` umieszcza każdy widok osobno (`RoundVoting.tsx:271`, `RoundReveal.tsx:224`, `RoundSkipped.tsx:38`), z callbackami tego widoku. „Zacznij grę” w poczekalni to nie `HostActions` (`RoomLobby.tsx:120-146`). Jedna „kolumna hosta” we wszystkich stanach oznacza albo ułożenie per widok, albo przeniesienie akcji do `RoomScreen`, czyli zmianę logiki.
- `LiveBanner` i notka po pominięciu należą do `RoomScreen` (`:197-205`) i stoją nad widokiem. W układzie z kolumnami zostają nad obiema kolumnami, chyba że wejdą do widoków.

## 4 kierunki układu (do tymczasowej strony podglądów)

Wspólne dla wszystkich czterech:

- próg `lg:` (1024 px), pod nim układ jak dziś;
- tylko klasy ze skali domyślnej Tailwind;
- tytuł widoku pierwszy w DOM;
- jedna lista „Gracze”;
- region „Wynik” z tabelą;
- nagłówek strony szeroki jak treść.

Ekrany wyśrodkowane (pominięte ostatnie pytanie u gościa, koniec wieczoru, wysypanie, „Nie jesteś w tym pokoju”) zostają wyśrodkowane w każdym wariancie.

| Stan                           | **A. Dwie kolumny: gra + panel**                                                                                                    | **B. Szeroka jedna kolumna**                                             | **C. Kolumna + pasek hosta**                                      | **D. Scena**                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Szerokość treści od 1024 px    | ok. 1152 px (`max-w-6xl`), siatka 2:1                                                                                               | ok. 768 px (`max-w-3xl`)                                                 | ok. 768 px (`max-w-3xl`) + pasek na całą szerokość                | ok. 1280 px (`max-w-7xl`)                                                                     |
| Poczekalnia (host)             | lewa: tytuł, link, „Zacznij grę”; prawa: „Gracze”                                                                                   | jak dziś, szerzej; lista graczy w 2 kolumnach                            | jak B; „Zacznij grę” zostaje w treści (to nie `HostActions`)      | duży tytuł na całą szerokość; pod nim link + start i lista graczy w 3 kolumnach               |
| Głosowanie (przed głosem)      | lewa: pytanie i formularz (lista wyboru zostaje w formularzu); prawa: przyciski hosta (u gościa podpowiedź i licznik „Zagłosowało”) | pytanie, lista wyboru w 2 kolumnach, „Zagłosuj” pod spodem               | jak B; u hosta przyciski w pasku przyklejonym do dołu okna        | pytanie dużą czcionką na całą szerokość; lista wyboru w 3 kolumnach                           |
| Głosowanie (po głosie)         | lewa: pytanie + „Głos oddany”; prawa: „Gracze” z oznaczeniami i przyciski hosta                                                     | „Głos oddany” i lista w 2 kolumnach                                      | jak B + pasek hosta                                               | „Głos oddany” obok listy graczy                                                               |
| Odsłona                        | lewa: pytanie i wynik (koło obok tabeli); prawa: przyciski hosta przyklejone przy przewijaniu                                       | pytanie, koło obok tabeli, przyciski hosta w jednym rzędzie pod wynikiem | koło obok tabeli; przyciski w pasku na dole okna                  | duże pytanie; większe koło po lewej, tabela po prawej; przyciski hosta w rzędzie pod pytaniem |
| Pominięte / koniec / wysypanie | wyśrodkowane, szerokość jak dziś                                                                                                    | wyśrodkowane                                                             | wyśrodkowane; pasek tylko przy pominięciu u hosta („Zakończ grę”) | wyśrodkowane, większa czcionka                                                                |
| Co zmienia w kodzie            | siatka w korzeniach widoków + przyklejenie (`sticky`) akcji; prop szerokości nagłówka                                               | szerokość kontenera, wewnętrzne siatki listy i wyniku, rząd przycisków   | jak B + `HostActions` jako przyklejony pasek od `lg:`             | jak A + większa typografia i siatki list od `lg:`                                             |
| Ryzyko                         | duplikat listy, gdyby chcieć „Gracze” obok formularza przed głosem (zabronione przez e2e)                                           | najmniejsza zmiana; przy 20 graczach dalej przewijanie, krótsze          | pasek zasłania dół treści; trzeba odstępu na dole                 | najwięcej zmian; większa czcionka to nowa skala tekstu (decyzja o tokenach typografii)        |

Telefon (< 1024 px) jest w każdym wariancie identyczny jak dziś. Zrzut telefonu wystarczy więc jeden na stan, jako dowód braku zmian.

## Jak zbudować podglądy i zrobić zrzuty

- **Strona:** tymczasowa `src/pages/dev/room-layouts.astro`, tylko w dev (404 na produkcji, jak `room-states.astro:20-23`). Każdy stan to osobny adres w prawdziwej ramie strony (nagłówek + `main`), np. `?variant=a&state=reveal-host`, żeby zrzut pokazywał całe okno gry.
- **Przełączanie wariantu:** komponenty nie przyjmują dziś klas układu (raport agenta: „no prop to inject layout classes”). Proponowana droga na czas wyboru: tymczasowy kontekst React z wariantem (domyślnie „jak dziś”), czytany przez widoki pokoju i `AppHeader` (prop). Po wyborze zostaje tylko wybrany układ jako domyślny, a kontekst i strona znikają. Alternatywa (kopie komponentów) odpada, bo podgląd przestałby pokazywać prawdziwe komponenty.
- **Dane:** buildery stanów (`lobby`, `voting`, `revealed`, `skipped`, `closed`, `room-states.astro:102-176`) i zestawy graczy (`roundPlayers`, `twentyPlayers` itd.) są dziś tylko we frontmatterze `room-states.astro`. Podgląd wariantów musi je skopiować albo wydzielić do wspólnego modułu dev.
- **Nowy plik dev** trzeba dopisać do listy w `scripts/ui-literals.mjs:8-17`, inaczej skan go nie obejmie.
- **Zrzuty:** Chrome bez okna (Playwright, `channel: "chrome"`, jak `crash-focus.mjs` w tej sesji).
  - **Laptop:** okno 1536×750 w skali 1, jak przy ocenie S-03 (pamięć `zrzuty-do-oceny.md`). Ekran Karola ma dziś powiększenie 150% (`AppliedDPI` 144, obszar roboczy 1920×1032), co daje okno przeglądarki ok. 1280×600. Do potwierdzenia przy galerii przez odczyt `window.innerWidth` i `innerHeight` w jego Chrome.
  - **Monitor:** 1920×950.
  - **Telefon:** 390×844 w ramce `iframe`, bo Chrome bez okna nie zwęża się poniżej ok. 500 px.
  - Czerwona przerywana linia oznacza dolną krawędź ekranu.
  - Galeria HTML w scratchpadzie z sekcjami „Co oceniasz” i „Czego nie oceniasz”, otwarta w Chrome Karola.
- **Proponowany zestaw stanów** (każdy wariant tak samo; „jak dziś” jako punkt odniesienia):
  - poczekalnia hosta z 8 graczami;
  - głosowanie gościa przed głosem;
  - głosowanie hosta po głosie;
  - odsłona hosta z 5 graczami;
  - odsłona hosta z 20 graczami;
  - koniec wieczoru u hosta.

  Laptop: 6 stanów × 5 układów (A–D i „jak dziś”). Monitor: tylko odsłona hosta, 5 układów. Telefon: 6 stanów raz.

## Code References

- `src/pages/r/[id].astro:62` — kolumna `max-w-lg` strony pokoju
- `src/components/room/AppHeader.astro:16` — kolumna nagłówka, wspólna z `/` i `/j`
- `src/components/room/RoomScreen.tsx:101` — fokus na pierwszy nagłówek po ruchu hosta
- `src/components/room/RoomScreen.tsx:193-209` — kolumna wyspy: live region, LiveBanner, notka, widok
- `src/components/room/HostActions.tsx:115-131` — akcje hosta, jedna na wiersz
- `src/components/room/RoundReveal.tsx:86, :132-230` — koło, tabela, akcje po odsłonie
- `src/components/room/RoundVoting.tsx:157-299` — pytanie, formularz albo „Głos oddany”, akcje
- `src/components/room/RoomLobby.tsx:80-169` — bloki poczekalni
- `src/styles/global.css:111-162` — `@theme inline`: promień i kolory, bez układu
- `scripts/ui-literals.mjs:8-21` — lista widoków i wzorzec skanu
- `playwright.config.ts:33`, `tests/e2e/support/room.ts:60, :79-82`, `tests/e2e/support/round.ts:16, :39, :45, :104, :109` — okno i lokatory e2e
- `src/pages/dev/room-states.astro:102-176, :232` — buildery stanów i siatka podglądów

## Architecture Insights

- Kontrakt kolorów z `ui-signin-contract` (tokeny, AGENTS.md §UI, skan literałów, kitchen sink) działa: 0 literałów. Kontrakt nie obejmuje układu, więc szerokość i progi powstały przypadkiem, z formularzy.
- Widoki są zbudowane z rodzeństwa bloków w jednym korzeniu `flex flex-col gap-8`, więc siatka na korzeniu wystarczy do kolumn. Przenoszenie logiki byłoby potrzebne tylko przy jednej wspólnej „kolumnie hosta” dla wszystkich stanów.
- Testy e2e opierają się na rolach i nazwach, nie na układzie, więc zmiana kolumn ich nie łamie, o ile nic nie zostanie zdublowane.

## Historical Context (from prior changes)

- `context/foundation/roadmap.md:329` — decyzja Karola 2026-10-15: osobna zmiana `/10x-ui` po S-03 dla wszystkich ekranów gry, np. dwie kolumny od ok. 1024 px, telefon bez zmian. Wspiera zakres tej zmiany.
- `context/archive/2026-10-15-full-game-evening/plan-brief.md:61` — „Tłok trzech przycisków na telefonie (ocena na zrzutach)”. Wspiera: układ przycisków hosta był już tematem.
- `context/archive/2026-10-15-full-game-evening/reviews/impl-review.md:125-135` (F7 przyjęte) — wspólne `HostActions`, `aria-disabled` przy zajętym przycisku, fokus na nagłówek po ruchu hosta. Warunki, które ten układ musi zachować.
- `context/archive/2026-10-13-first-live-round/reviews/impl-review.md:32` (commit `b5a753e`) — przełącznik „Koło | Paski”, tokeny `--chart-6…20`, pytanie powtórzone przy odsłonie i dwukrokowe „Odsłoń wynik” przyjęte po ocenie zrzutów. Wariant nie może tego zgubić.
- `context/archive/2026-10-07-room-lobby/change.md:17-18` i `AppHeader.astro:4-6` — e-mail hosta ukryty w nagłówku (host udostępnia ekran na Discordzie), nazwa gry w jednej linii. Wspiera: nagłówek zostaje tak samo skromny.
- `context/archive/2026-10-04-ui-signin-contract/plan.md:31-35, :391-416` — kontrakt tokenów, skan literałów, kitchen sink, zrzuty desktop + 390 px. Wspiera wariant „istniejący system projektowy”.
- PRD: domyślne urządzenie to telefon (`prd.md:28`, `:49`, `:59-60`); w przyszłości ekran pokoju dostanie pukanie spóźnialskiego (FR-020, `prd.md:90`), kciuki przy odsłonie (FR-018, `prd.md:126`) i współhosta (FR-003, `prd.md:86-87`). Układ z panelem bocznym (A) ma na nie naturalne miejsce; to wniosek, nie decyzja.

## Related Research

- `context/archive/2026-10-04-ui-signin-contract/research.md` — poprzedni audyt `/10x-ui` (logowanie, tokeny)
- `context/archive/2026-10-15-full-game-evening/research.md` — ekrany wieczoru (S-03)

## Open Questions

- **Wybór układu (Karol):** A, B, C, D albo mieszanka, po obejrzeniu zrzutów. To jedyna decyzja blokująca plan.
- **Rozmiar okna laptopa do zrzutów:** 1536×750 (jak przy S-03) czy faktyczne okno Karola przy powiększeniu 150% (ok. 1280×600). Do odczytania w jego Chrome przy budowie galerii; nie zmienia wariantów.
- **Typografia w D:** większa czcionka od `lg:` to nowa skala tekstu. Jeśli Karol wybierze D, plan musi rozstrzygnąć, czy wystarczy skala Tailwind (`lg:text-4xl`), czy potrzebny jest token.
- **Test telefonu po zmianie:** e2e w 1280×720 przestanie sprawdzać układ telefonu. Plan rozstrzyga, czy dodać projekt Playwrighta z oknem telefonu dla jednego spec (koszt: dłuższy job `e2e`), czy wystarczy bramka wizualna i ręczne zrzuty.
