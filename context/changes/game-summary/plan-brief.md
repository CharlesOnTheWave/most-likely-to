# Podsumowanie wieczoru (S-15, FR-022) — Plan Brief

> Full plan: `context/changes/game-summary/plan.md`
> Research: `context/changes/game-summary/research.md`

## What & Why

Gdy gra się kończy, ekran „Koniec wieczoru” pokazuje krótkie podsumowanie tej gry: kto zebrał najwięcej głosów (do 3
osób), na kogo nikt dziś nie głosował i ile pytań odsłonięto. To dodatek z PRD (FR-022), zdjęty z Parked 2026-10-25:
ma dać ekipie temat do rozmowy na koniec, bez punktów i bez tabeli wyników.

## Starting Point

Liczby z każdej odsłony zostają w bazie także po końcu gry, ale stan zamkniętego pokoju ich nie oddaje, a ekran końca
pokazuje tylko „Koniec wieczoru”, „Dzięki za grę!” i „Nowa gra” / prośbę o nowy link.

## Desired End State

Po końcu gry z co najmniej jedną odsłoną host i goście widzą sekcję „Podsumowanie”: „Odsłoniliście dziś N pytań”,
„Najwięcej głosów dziś” (1–3 osoby z liczbą głosów) i „Nikt dziś nie głosował na: …”. Gra bez odsłony wygląda jak
dziś. Nigdzie nie ma pary „kto na kogo”.

## Key Decisions Made

| Decision                | Choice                                                                       | Why (1 sentence)                                                  | Source   |
| ----------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| „Najwięcej głosów dziś” | Top 3 graczy z największą sumą głosów z całej gry; zera nie wchodzą          | Nie robimy rywalizacji ani listy 20 graczy, tylko krótki akcent   | Plan     |
| Remis                   | Najwyższa grupa zawsze cała; kolejne tylko, gdy cała zmieści się w 3 osobach | Nikt nie wypada przez kolejność miejsc, lista zostaje krótka      | Plan     |
| Zestaw wyróżnień        | Top 3, „Nikt dziś nie głosował na…”, liczba pytań                            | Dwa przykłady z PRD plus liczba pytań odłożona przy S-03          | Plan     |
| „Nikt nie głosował na”  | Każdy z sumą 0, kto mógł dostać głos w co najmniej jednej odsłonie           | Spóźniony bez szans nie trafia tu niesłusznie                     | Plan     |
| Liczba pytań            | Tylko odsłonięte                                                             | Spójne z tym, z czego liczymy głosy                               | Plan     |
| Gra bez odsłony         | Ekran jak dziś                                                               | Nie ma czego podsumować                                           | Plan     |
| Skąd dane               | Nowe pole w stanie pokoju (`room_lobby`), bez nowego zapytania               | Ta sama droga i te same kontrole dostępu; liczby już tam leżą     | Research |
| Co dostaje przeglądarka | Tylko wyróżnienia; wybór robi serwer                                         | Do przeglądarki trafia tylko to, co widać (jak lista pytań hosta) | Plan     |
| Anonimowość             | Same sumy liczb z odsłon, które ekipa widziała                               | Suma nie zawiera głosującego, więc nie tworzy pary                | Research |

## Scope

**In scope:**

- Migracja `room_lobby` z polem `game_totals` (tylko w zamkniętym pokoju), testy bazy, zestaw kluczy, plan testów §6
- Reguła wyboru wyróżnień z testami jednostkowymi, odmiana „głos/głosy/głosów” i „pytanie/pytania/pytań”
- Sekcja „Podsumowanie” na ekranie końca, podglądy `/dev/room-states` i `/dev/room-window`, hasło w słowniku
- Asercje w istniejącym teście E2E wieczoru; wdrożenie z migracją przed kodem

**Out of scope:**

- Punkty, numery miejsc, medale, ranking między wieczorami; pełna lista sum wszystkich graczy
- Wyróżnienia z pojedynczego pytania, teksty pytań i liczba wstrzymań się na ekranie końca
- Odróżnianie drogi zamknięcia gry, retencja danych (S-13), zmiana szerokości ekranu

## Architecture / Approach

Baza (migracja) → `room_lobby` oddaje przy `closed` surowe sumy: liczba odsłon i suma głosów każdego gracza, który miał
wynik w odsłonie → Worker (`roomView()`) wybiera z tego top 3 i listę zer jedną czystą funkcją → ekran „Koniec
wieczoru” pokazuje sekcję „Podsumowanie”. Ten sam wzór co lista pytań hosta: surowe dane w bazie, widok w Workerze.

## Phases at a Glance

| Phase                                  | What it delivers                                                  | Key risk                                                       |
| -------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Podsumowanie w stanie pokoju (baza) | Migracja + testy bazy z ręczną wyrocznią, nowy klucz w kontrakcie | Testy bazy tylko w CI; błąd w sumie wyjdzie dopiero tam        |
| 2. Wybór wyróżnień i ekran końca       | Reguła top 3 i zer, ekran, podglądy, słownik                      | Brzmienie napisów; ocena na zrzutach                           |
| 3. Test E2E i wdrożenie                | Podsumowanie na 3 ekranach w CI, `db push`, scalenie, smoke       | Kolejność: migracja musi być na produkcji przed scaleniem kodu |

**Prerequisites:** gałąź `game-summary`; `db push` z domu albo przez hotspot (nie z eduroam).
**Estimated effort:** ~2 sesje w 3 fazach (jedna migracja, jeden nowy moduł, jedna sekcja ekranu).

## Open Risks & Assumptions

- Napis „Nikt dziś nie głosował na…” może być komuś przykry; świadomie zostaje, bo jest w PRD.
- Remis wielu osób na szczycie pokaże więcej niż 3 imiona (np. 4 osoby po tyle samo).
- Parser wymaga nowego klucza, więc kod scalony przed `db push` zablokowałby wejście gościa i ekrany pokoju (pięć
  miejsc czyta `room_lobby`); kolejność jest w fazie 3, a wycofanie idzie odwrotnie: najpierw kod, potem baza.

## Success Criteria (Summary)

- Po „Zakończ grę” wszyscy gracze widzą podsumowanie zgodne z odsłonami tego wieczoru.
- Gra bez odsłony i ekrany w trakcie gry wyglądają jak dziś.
- Testy bazy, jednostkowe i E2E pilnują sum, remisów, spóźnionych i braku par „kto na kogo”.
