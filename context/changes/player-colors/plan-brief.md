# Stały kolor gracza — Plan Brief

> Full plan: `context/changes/player-colors/plan.md`

## What & Why

Każdy gracz dostaje na całą grę jeden kolor, który zależy od jego miejsca przy stole. Dziś kolor zależy od miejsca w wyniku, więc zwycięzca każdej rundy jest różowy, a różowy to co rundę ktoś inny. Po grze testowej S-15 Karol zauważył, że ludzie się przez to mylą.

## Starting Point

Kolor to numer kawałka koła (`SLICE_FILLS[index]`, `SLICE_DOTS[index]`) w odsłonie i w podsumowaniu. Listy „Gracze” nie mają kolorów. Każdy ekran ma już pełną listę graczy w kolejności miejsc (`view.players`), a ta kolejność nie zmienia się przez całą grę.

## Desired End State

Gracz ma ten sam kolor wszędzie, od wejścia do pokoju do ekranu końca:

- kropka przy jego nicku na liście „Gracze” w poczekalni i w trakcie gry;
- kawałek koła i kropka w tabeli każdej odsłony, w widoku „Koło” i „Paski”;
- kawałek koła i kropka w legendzie podsumowania.

„Pozostali” w podsumowaniu zostają szarzy.

## Key Decisions Made

| Decision                                          | Choice                                               | Why (1 sentence)                                           | Source            |
| ------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- | ----------------- |
| Skąd kolor                                        | gra nadaje sama, z miejsca przy stole (wariant A)    | mało pracy, bez bazy, rozwiązuje mylenie osób              | change.md (Karol) |
| Wybór koloru przez gracza                         | nie teraz (wariant B)                                | nowe pole w bazie, wybór, konflikty; można dołożyć później | change.md (Karol) |
| Ponad 20 graczy                                   | kolory od nowa (21. jak host)                        | 20 kolorów w palecie, PRD nie ma limitu graczy             | change.md         |
| Gdzie kropka                                      | listy „Gracze”, tabela odsłony, legenda podsumowania | swój kolor znasz od wejścia do pokoju                      | Plan (Karol)      |
| Lista do głosowania i „Nikt dziś nie głosował na” | bez kropki                                           | obok kółka wyboru dwa kółka by się myliły                  | Plan (Karol)      |
| Widok „Paski”                                     | pasek jak dziś, dochodzi kropka                      | czytelność napisów bez zmian                               | Plan (Karol)      |
| Skąd numer miejsca                                | pozycja na liście `players`, bez zmian w bazie       | nikt nie znika z pokoju, spóźniony dochodzi na koniec      | Plan (zwiad kodu) |

## Scope

**In scope:**

- `seatColors` w `src/lib/rooms/chart.ts` z testami jednostkowymi
- odsłona (`RoundReveal.tsx`), podsumowanie (`GameSummary.tsx`), listy „Gracze” (`RoomLobby.tsx`, `RoundVoting.tsx`)
- komentarz palety (`chart-colors.ts`), wiersz „kolor gracza” w słowniku
- zrzuty do oceny, PR, wdrożenie, krótka gra

**Out of scope:**

- wybór koloru przez gracza, nowe tokeny, zmiany w bazie i w Workerze
- kropka w liście do głosowania, przy chipach „Nikt dziś nie głosował na”, przy prośbach spóźnionych
- kolorowe paski, inna kolejność kawałków koła

## Architecture / Approach

Jedna czysta funkcja zamienia `view.players` w mapę nick → numer koloru (pozycja modulo 20). Odsłona, podsumowanie i listy biorą kolor z tej mapy, zamiast z numeru kawałka albo pozycji w topie. Klasy kolorów zostają w `chart-colors.ts`.

## Phases at a Glance

| Phase                         | What it delivers                                              | Key risk                                             |
| ----------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| 1. Kolor z miejsca przy stole | reguła + testy, kolor na wszystkich ekranach, słownik, zrzuty | ekran dalej z kolorem kawałka: łapią to tylko zrzuty |
| 2. PR i wdrożenie             | CI, scalenie, smoke, gra na produkcji                         | brak: bez bazy, revert PR wystarcza                  |

**Prerequisites:** PR #24 (archiwum S-15) scalony albo gałąź `player-colors` na jego bazie.
**Estimated effort:** jedna krótka sesja: faza 1 plus runda zrzutów, faza 2 to głównie czekanie na CI.

## Open Risks & Assumptions

- Zakładamy, że nikt nie znika z pokoju w trakcie gry. Dziś to prawda. Usuwanie gracza (S-09) będzie musiało zachować kolory pozostałych (zapis w słowniku).
- Na kole obok siebie mogą wypaść kolory, które nie są sąsiadami w palecie. Paleta trzyma odstęp między każdą parą (0.095 w OKLab), a zrzuty to sprawdzą.

## Success Criteria (Summary)

- W grze na produkcji każdy gracz ma ten sam kolor na liście „Gracze”, w każdej odsłonie i w podsumowaniu.
- Dwie odsłony z różnymi zwycięzcami nie zamieniają kolorów osób.
- Testy E2E zostają bez zmian i są zielone.
