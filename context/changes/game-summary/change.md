---
change_id: game-summary
title: Podsumowanie wieczoru na ekranie końca gry
status: implementing
created: 2026-10-25
updated: 2026-10-25
archived_at: null
---

## Notes

S-15 (FR-022, zdjęte z Parked 2026-10-25, PRD bez zmian): gdy gra się kończy, wszyscy gracze na ekranie „Koniec wieczoru” widzą kilka wyróżnień z tej gry, np. „najwięcej głosów dziś” i „nikt dziś nie głosował na X”. Bez punktów, miejsc i porównań z innymi wieczorami (PRD §Non-Goals). Liczone wyłącznie z odsłon, które ekipa już widziała, nigdy z par „kto na kogo”.

Faza 1 (2026-10-25): krok ręczny 1.4 (czytanie diffu migracji przez Karola) pominięty za jego zgodą; zastępują go dokładne zbiory kluczy w `tests/db/game-summary.test.ts` i próbny alarm w CI (`82065d3`, cofnięty w `a4fb439`): czerwone dokładnie 8 przewidzianych przypadków tego pliku, reszta CI zielona.

Faza 2 (2026-10-25), decyzje Karola po pierwszych zrzutach; zmieniają kontrakt ekranu z planu (Faza 2 #3) i punkt „ROOM_NARROW zostaje” z „What We're NOT Doing”:

- Układ „Dwie połowy” (wybrany z 6 makiet): od `lg`, gdy ktoś dostał głos, ekran końca zajmuje całą ramę (`endInHalves` w `room-frame.ts`). Po lewej tytuł, kafelki, „Nikt dziś nie głosował na” i następny krok, po prawej koło z legendą. Bez wykresu (brak odsłon albo wszyscy się wstrzymali) zostaje wąska kolumna; poniżej `lg` jedna kolumna w kolejności DOM.
- Wykres: kawałki dla osób z topu w kolorach odsłony i jeden szary kawałek „pozostali” bez nicków (wybrane zamiast koła wszystkich graczy, które byłoby tabelą wyników z PRD §Non-Goals). Do tego nowe pole `GameSummary.votes`: suma wszystkich sum, liczona w Workerze; baza bez zmian.
- Kafelki z napisami Karola: „Odsłoniętych pytań:” i „Ilość głosów łącznie:” zastępują zdanie „Odsłoniliście dziś N pytań”. Lista bez głosu to kafelki z nickami zamiast zdania z „i”.
- Regiony to teraz karty „Najwięcej głosów dziś” i „Nikt dziś nie głosował na”, a liczby są w `<dl>`. Region „Podsumowanie” nie istnieje, więc test E2E z fazy 3 szuka tych regionów i par `dt`/`dd`, a nie zdania „Odsłoniliście dziś 1 pytanie”.
