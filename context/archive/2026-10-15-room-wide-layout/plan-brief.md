# Szeroki układ strony pokoju — Plan Brief

> Full plan: `context/changes/room-wide-layout/plan.md`
> Research: `context/changes/room-wide-layout/research.md`

## What & Why

Na laptopie i monitorze strona gry zajmuje wąski pasek 512 px pośrodku. Po odsłonie przyciski hosta („Następne pytanie”, „Zakończ grę”) leżą pod dolną krawędzią okna, a wykres stoi nad tabelą. Karol gra z przeglądarką na całym ekranie, a wielu graczy ma dwa monitory. Plan wprowadza szeroki układ „M”, który Karol złożył z galerii czterech wariantów.

## Starting Point

Cała strona pokoju to jedna kolumna `max-w-lg`: strona i nagłówek. Prototyp mieszanki M leży lokalnie na gałęzi `room-wide-layout` jako przełącznik wariantów (`room-layout.ts`) ze stroną `/dev/room-layouts`. Prawdziwa gra wygląda dziś po staremu.

## Desired End State

Od 1024 px szerokości okna:

- poczekalnia ma dwie kolumny (gra po lewej, gracze po prawej);
- głosowanie hosta i odsłona mają szerszą kolumnę z wykresem obok tabeli;
- przyciski hosta stoją w pasku przy dolnej krawędzi okna, w głosowaniu dopiero po głosie hosta;
- głosowanie gościa, pominięte pytanie i koniec wieczoru wyglądają jak dziś.

Na telefonie wszystko jest piksel w piksel jak dziś. Nowy ekran pokoju trzyma się tej ramy, bo pilnują tego reguła w `AGENTS.md` i bramka wizualna.

## Key Decisions Made

| Decision                 | Choice                                                                                                    | Why (1 sentence)                                                                    | Source                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| Układ                    | Mieszanka M: poczekalnia A; głosowanie gościa dziś; głosowanie hosta i odsłona C; pominięte i koniec dziś | Wybór Karola stan po stanie z galerii 4 wariantów                                   | change.md (galerie)   |
| Pasek hosta w głosowaniu | Dopiero po głosie hosta; przed głosem rząd przycisków pod formularzem                                     | W prototypie pasek zasłaniał hostowi „Zagłosuj”                                     | change.md (galeria M) |
| Nagłówek                 | Zawsze szeroki na stronie pokoju                                                                          | Nie skacze między ekranami o różnej szerokości                                      | change.md (galeria M) |
| Próg                     | `lg:` (1024 px), skala domyślna Tailwind, bez wartości arbitralnych                                       | Telefon bez zmian; skan literałów przepuszcza tylko skalę                           | Research              |
| Źródło szerokości        | Jeden moduł `room-frame.ts` (rama, kolumna stanu)                                                         | Odpowiedź na brak ramy z Z5; jedno miejsce dla strony, nagłówka i podglądów         | Plan                  |
| Prototyp                 | Przełącznik znika; `/dev/room-layouts` staje się stałą `/dev/room-window`                                 | Zrzuty całego okna i sprawdzanie paska przy dolnej krawędzi zostają możliwe         | Plan                  |
| Test telefonu            | `game.spec.ts` drugi raz w oknie 390×844, z próbnym alarmem                                               | Po zmianie e2e w 1280×720 nie widzi układu telefonu, a telefon to główne urządzenie | Plan (Karol)          |
| Komentarze w kodzie      | Odsyłają do `AGENTS.md` §UI, nie do folderu zmiany                                                        | Ścieżka folderu zmienia się przy archiwum (26 starych ścieżek po S-03)              | Plan                  |

## Scope

**In scope:**

- strona pokoju `/r/[id]` ze wszystkimi stanami i jej nagłówek;
- `HostActions` z położeniem „pod spodem / rząd / pasek”;
- `/dev/room-window`, szerokie ramki w `/dev/room-states`;
- reguła w `AGENTS.md` §UI;
- projekt `phone` w Playwright z próbnym alarmem, plan testów;
- stare ścieżki S-03 w 21 plikach i `global.css:6`.

**Out of scope:**

- `/` i `/j/[token]`;
- nowe kolory i tokeny;
- szersze głosowanie gościa (Z4 dla gościa odroczone wyborem Karola);
- test zrzutów w CI;
- emulacja dotyku;
- baza, endpointy, logika gry;
- odłożone poprawki S-03 (F2, F3, F5).

## Architecture / Approach

Wybrane klasy z prototypu stają się klasami komponentów: siatka poczekalni, siatka wyniku, położenie przycisków hosta. `room-frame.ts` daje ramę strony i kolumnę dla każdego stanu. Czytają go `/r/[id]`, `AppHeader` (prop `wide`), `RoomScreen` i strony podglądów. Wszystko szerokie zaczyna się od `lg:`, więc poniżej 1024 px DOM i klasy dają dzisiejszy obraz. Dowodem jest porównanie zrzutów telefonu bajt w bajt ze wzorcem zrobionym przed usunięciem prototypu.

## Phases at a Glance

| Phase                             | What it delivers                                                                                                                              | Key risk                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1. Układ M w kodzie               | Szeroka rama, kolumna stanu, poczekalnia w 2 kolumnach, wykres obok tabeli, pasek hosta po głosie; `/dev/room-window`; zrzuty do oceny Karola | Pytanie potwierdzenia ściśnięte w rzędzie przycisków; zmiana na telefonie (łapie porównanie zrzutów) |
| 2. Bramka, reguła i test telefonu | `/dev/room-states` szeroka od 1024 px, reguła w AGENTS.md, projekt `phone` z alarmem, porządek ścieżek                                        | Goście w projekcie telefonu dostaliby okno laptopa (kontrola okna w teście)                          |
| 3. Przegląd i wdrożenie           | `/10x-impl-review`, scalenie przez Karola, smoke na produkcji, sprawdzenie na prawdziwym pokoju                                               | Pasek przyklejony zachowuje się inaczej w prawdziwej przeglądarce niż w Chrome bez okna              |

**Prerequisites:** gałąź `room-wide-layout` z prototypem; serwer dev tylko dla podglądów `/dev/*` (bez sieci), zatrzymany po pracy; każdy push, smoke i usunięcie gałęzi za zgodą Karola.
**Estimated effort:** ok. jedna sesja (2–3 h) w 3 fazach, plus przebiegi CI i ocena zrzutów.

## Open Risks & Assumptions

- Długie pytanie potwierdzenia w rzędzie trzech przycisków zawija się w kilka linii; czy to czytelne, rozstrzygają zrzuty potwierdzeń w `/dev/room-window`.
- Pasek przyklejony zakłada brak `overflow` u przodków `HostActions`. Dziś tak jest; nowy kontener z `overflow-hidden` po cichu go wyłączy.
- e2e w oknie laptopa klika przy przyklejonym pasku. Playwright przewija, gdy coś zasłania cel, ale pierwszy przebieg CI to potwierdzi.

## Success Criteria (Summary)

- Na laptopie host prowadzi wieczór bez przewijania do przycisków, a odsłona z wykresem i tabelą mieści się obok siebie.
- Telefon wygląda dokładnie jak dziś (porównanie zrzutów) i gra wieczór w e2e.
- Następny agent znajduje regułę układu w `AGENTS.md` i widzi szeroki układ w `/dev/room-states`.
