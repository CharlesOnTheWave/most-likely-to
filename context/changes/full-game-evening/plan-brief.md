# Pełny wieczór (S-03) — Plan Brief

> Full plan: `context/changes/full-game-evening/plan.md`
> Research: `context/changes/full-game-evening/research.md`

## What & Why

S-03 zamienia jedną rundę w wieczór: host przechodzi do kolejnego pytania (bez powtórek w grze), może pominąć pytanie w trakcie głosowania (głosy przepadają) i kończy grę po potwierdzeniu, a na końcu wszyscy widzą „Koniec wieczoru”, bez punktów. To główne kryterium sukcesu z PRD: co najmniej 10 pytań w jednym wieczorze bez awarii.

## Starting Point

Po S-02 gra kończy się na odsłonie jednej rundy („Kolejne pytania wkrótce.” i „Nowa gra”). Baza już dopuszcza wiele rund i blokuje powtórkę pytania, ale funkcje otwierają tylko rundę 1, a głos niesie tylko „na kogo”, więc w wieczorze spóźniony ekran oddałby głos do pytania, którego gracz nie widział.

## Desired End State

Host prowadzi wieczór trzema przyciskami: „Następne pytanie” (jedno kliknięcie), „Pomiń pytanie” i „Zakończ grę” (oba z drugim kliknięciem i pełnym zdaniem). Po pominięciu każdy ekran nowej rundy pokazuje notkę, że głosy przepadły. Na końcu „Koniec wieczoru” i „Dzięki za grę!”, host ma „Nowa gra”, gość prośbę o nowy link. Głos i akcje hosta niosą numer pytania, więc nic nie trafia do pytania, którego ktoś nie widział. Czytnik ekranu słyszy numer pytania, pominięcie i koniec.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Skąd kolejne pytanie | Worker podaje pulę w losowej kolejności, baza bierze pierwsze niezagrane | Bez nowej tabeli i bez zmiany startu gry, więc stary serwer działa w czasie wdrożenia | Research (D1, po recenzji) |
| Pominięcie | Tylko w trakcie głosowania, od razu następne pytanie; ostatnie nie kończy gry samo | Po odsłonie nie ma czego „przepadać”, a koniec gry wymaga potwierdzenia | Research (D2) |
| Ślad pominięcia | Runda `skipped` bez liczb, urna usunięta | Numeracja i bezpiecznik „bez powtórek”; dane o jakości to S-11 | Research (D3) |
| Koniec gry | Stan `closed`, ekran „Koniec wieczoru” dla wszystkich | Nowy stan pokoju psuł trzy miejsca i nic nie dawał | Research (D4) |
| Faza 3 planu testów | Osobno, z S-04 | Pomiar 2 s i sonda piszą do produkcji; S-03 niesie #1, #3, #4 | Research (D5) |
| Numer pytania w głosie, pominięciu i „Następnym” | Tak; inny numer to odmowa `round_over` | Inaczej spóźniony głos albo podwójne kliknięcie trafia w złe pytanie | Research (T1) |
| Notka po pominięciu | Na każdym ekranie rundy po pominięciu, z flagi w bazie | Ekran, który przespał odsłonę, nie weźmie zwykłego „Następnego” za pominięcie | Plan |
| Ekran końca | „Koniec wieczoru” + „Dzięki za grę!”; host „Nowa gra”, gość prośba o link | Ciepłe zakończenie i jasne „co dalej” | Plan |
| Potwierdzenia | Pełne zdania z „Anuluj”, jak przy odsłonie | Host wie, co straci | Plan |
| „Następne pytanie” | Jedno kliknięcie; po wyczerpaniu puli tekst i tylko „Zakończ grę” | Nic nie przepada, wieczór płynie | Plan |
| Próbne alarmy | Trzy: spóźniony głos, urna po pominięciu, sygnał po „Następnym” | Każdy nowy strażnik udowadnia, że umie zaświecić | Plan |

## Scope

**In scope:**
- funkcje bazy: następne pytanie, pominięcie, koniec gry; głos z numerem pytania; stan z rundą pominiętą i flagą `after_skip`
- akcje serwera, tasowanie puli, „czy zostały pytania” dla hosta, nowe kody odmów
- przyciski hosta z potwierdzeniami, notka, ekran końca, ogłoszenia z numerem, strona linku po końcu
- F4 (granica błędów ekranu pokoju), F6 (limit treści przed czytaniem), F7 (czytnik w ręcznej rundzie)
- testy: baza, pgTAP (z naprawą pomocników liczących tylko rundę 1), unit, e2e kilku pytań, smoke z przełącznikiem `SMOKE_GAME=0`
- stare ścieżki `context/changes/first-live-round/` w komentarzach

**Out of scope:**
- podsumowanie wieczoru (FR-022, Parked), liczba pytań na ekranie końca
- lista pytań przed startem (S-06), dane o jakości (S-11), współhost (S-07), pytania z ostatnich wieczorów (S-12)
- pomiar 2 s i zerwane połączenie (faza 3 planu testów)
- punkty, rankingi, minutniki

## Architecture / Approach

Jak S-02: każda zmiana stanu gry to funkcja bazy, która najpierw blokuje pokój, sprawdza wszystko przed zapisem i odpowiada `{ok, reason}`. Worker woła ją po sprawdzeniu sesji i dzwoni dzwonkiem; ekrany pobierają stan z serwera. Pominięcie w jednej transakcji usuwa urnę, oznacza rundę jako pominiętą i otwiera następną. Głos trafia wyłącznie do bieżącej rundy w fazie głosowania.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Testy przed kodem | Zasady wieczoru, role i anonimowość jako czerwone testy bazy i pgTAP | pgTAP zielony bez względu na kod, jeśli pomocnicy nie zostaną naprawieni najpierw |
| 2. Baza | Migracja: next, skip, end, głos z numerem, stan `skipped` | Stary serwer musi dalej wołać głos starymi argumentami |
| 3. Serwer | Akcje, tasowanie puli, kody odmów, F6 | Stary ekran wysyła głos bez numeru (przyjęty) |
| 4. Ekrany | Przyciski, notka, koniec wieczoru, ogłoszenia, F4, zrzuty | Tłok trzech przycisków na telefonie (ocena na zrzutach) |
| 5. E2E, smoke, alarmy | `game.spec.ts`, kroki smoke, trzy próbne alarmy | Końcowe kroki smoke zakładają otwarty pokój |
| 6. Przegląd i wdrożenie | `db push`, smoke starym serwerem, scalenie, smoke, wieczór Karola z czytnikiem | Scalenie przed `db push` psuje produkcję |

**Prerequisites:** S-02 na produkcji (tak); `db push` z domu, nie z eduroam; CI z jobami `db` i `e2e`.
**Estimated effort:** ok. 4–6 sesji, jak S-02 (6 faz, jeden PR).

## Open Risks & Assumptions

- Zachowanie PostgREST przy zamianie `cast_vote` na wersję z `p_round` potwierdza dopiero test w CI (faza 1); jeśli stare wywołanie nie przejdzie, wdrożenie „baza, potem kod” wymaga innej drogi.
- Cofnięcie samego kodu jest bezpieczne tylko do pierwszego pominięcia na produkcji (stary parser nie zna fazy `skipped`).
- Budżet żądań ok. 26 tys. na 3-godzinny wieczór 20 osób to rachunek, nie pomiar.

## Success Criteria (Summary)

- Ekipa gra wieczór z wieloma pytaniami: następne, pominięte, koniec, na wszystkich ekranach to samo.
- Żaden głos nie trafia do niewłaściwego pytania, a po pominięciu i końcu nie zostaje urna ani liczba.
- Karol rozgrywa wieczór na 3 urządzeniach i słyszy go czytnikiem ekranu.
