# Odłożone poprawki z przeglądów (F2, F3, F5): plan w skrócie

> Full plan: `context/changes/deferred-review-fixes/plan.md`
> Research: `context/changes/deferred-review-fixes/research.md`

## What & Why

Przed pierwszym prawdziwym wieczorem z ekipą zamykamy trzy poprawki odłożone w przeglądach S-02 i S-03:

- głos i „Odsłoń wynik” trafiają tylko w pytanie, które nadawca widzi (F2);
- lista kandydatów do następnej rundy ma limit (F3);
- host dostaje właściwą radę, gdy pytania skończą się w trakcie gry (F5).

Dziś drugi, nieodświeżony ekran hosta może odsłonić pytanie, którego nie pokazał, i to pytanie przepada.

## Starting Point

- **Głos.** Głos bez numeru pytania wpada do najnowszej rundy. Pozwalało na to okno wdrożenia S-03, które dawno się zamknęło.
- **Odsłona.** Odsłona nie zna numeru wcale. Na pominiętej rundzie odpowiada `ok` i nic nie robi.
- **Testy** utrwalają dziurę (`tests/db/game-rules.test.ts:150-154`).
- **F4** (granica błędów ekranu) i **F6** są już w kodzie od S-03.

## Desired End State

- **Ruchy rundy.** Każdy ruch rundy niesie numer pytania. Bez numeru albo ze starym numerem gra odmawia: Worker odpowiada 400, a baza `round_over` („To pytanie już się zmieniło.”). Stan rundy się wtedy nie zmienia.
- **Pominięta runda.** Odsłona pominiętej rundy dostaje odmowę.
- **Kandydaci.** Za długa lista (ponad 1000) kończy się błędem bez zapisu.
- **Koniec pytań.** „Następne pytanie” po wyczerpaniu pytań daje „Pytań już nie ma. Możesz zakończyć grę.”.
- **Wynik.** Smoke na produkcji potwierdza 3 nowe odmowy i udaną odsłonę z numerem, a Karol przeklikuje grę na telefonie i laptopie.

## Key Decisions Made

| Decision                  | Choice                                                                   | Why (1 sentence)                                                                                         | Source       |
| ------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------ |
| Wdrożenie F2              | Jeden PR, `db push` i od razu scalenie                                   | Dziś nikt nie gra, więc kilkuminutowe okno (odsłona odmawia, ostatni głos odsłania) nikogo nie dotknie   | Plan (Karol) |
| Numer obowiązkowy w bazie | Odmowa `round_over` w ciele funkcji, `default null` zostaje              | Postgres nie pozwala zdjąć defaultu z `p_round` po `p_player_token default null`; tak samo `next`/`skip` | Research     |
| `reveal_round`            | `drop` + `create (p_room_id, p_round default null)`                      | Jedna wersja (T1); stary Worker w oknie dostaje nazwaną odmowę zamiast `PGRST202`                        | Research     |
| Odsłona pominiętej rundy  | `round_over`                                                             | Ta sama odpowiedź co głos i „Pomiń” na pominiętej rundzie; nielegalny ruch nie udaje sukcesu             | Plan (Karol) |
| Limit F3                  | 1000, w `open_next_round`, wyjątek `22023`                               | Jedno miejsce, cofa całą transakcję; precedens zniekształconego tokenu gościa                            | Plan (Karol) |
| F5                        | Kod `questions_ran_out`, tekst „Pytań już nie ma. Możesz zakończyć grę.” | Zwykła ścieżka już chowa „Następne”; to tekst awaryjny, gdy Worker nie odczytał kategorii                | Plan (Karol) |
| Dowód testów              | Najpierw testy, draft PR, CI czerwone dokładnie na nowych przypadkach    | Dowód, że testy łapią dziurę; `it.fails` odpada, bo odsłona z numerem dziś daje błąd, nie dane           | Plan (Karol) |
| Smoke                     | Numery w głosach + 3 kroki odmów + udana odsłona                         | Odmowy widać też na produkcji; udana odsłona to kontrola pozytywna dla odmów                             | Plan (Karol) |
| Wyrocznia K1              | Notka o F2 na górze planu K1, bez przeliczania                           | Przed K1 wejdą S-08 i S-06, więc liczby i tak trzeba będzie przeliczyć przy starcie K1                   | Plan review  |

## Scope

**In scope:**

- migracja `*_round_number_required.sql` (`cast_vote`, `reveal_round`, `open_next_round`);
- Worker (`bodyRound`, `vote.ts`, `reveal.ts`, `next.ts`, `server.ts`);
- ekran („Odsłoń wynik” z numerem);
- testy bazy, pgTAP, smoke i test jednostkowy;
- teksty i opisy w `test-plan.md`, podgląd F5, notka o F2 w planie K1, wdrożenie.

**Out of scope:**

- agregat „Gra” (fazy 3–5 z `02-invariant-aggregate-refactor.md`);
- trzy fazy z przerwą 13 h;
- F4, F6 (zrobione) i F7 (ręcznie na wieczorze);
- zmiany notki o skończonych pytaniach;
- nowe testy E2E;
- smoke w oknie wdrożenia.

## Architecture / Approach

Reguła „ruch trafia w rundę, którą widzisz” zostaje wpisana w każdą funkcję osobno, ale głos i odsłona dostają ten sam warunek co „Następne” i „Pomiń”: `p_round is null or p_round <> v_number` daje `round_over`. Worker odmawia 400 bez numeru, zanim zawoła bazę. Ekran wysyła `{ round }` przy odsłonie, tak jak przy głosie. Limit kandydatów siedzi w jednym pomocniku. F5 to tylko zamiana kodu w trasie `next.ts`.

## Phases at a Glance

| Phase                                 | What it delivers                                                   | Key risk                                                                     |
| ------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1. Testy przed migracją               | Nowe testy bazy F2/F3; CI czerwone dokładnie na dziurze            | Kolejność w jednym wieczorze testów (dzisiejsze skutki probe zmieniają stan) |
| 2. Migracja, Worker i ekran (F2 + F3) | Jedna migracja, numer przy odsłonie, testy/pgTAP/smoke na numerach | Pominięte wywołanie bez numeru w testach albo pgTAP                          |
| 3. F5                                 | `questions_ran_out` z tekstem i podglądem                          | Tekst obok notki o skończonych pytaniach (świadomie przyjęte)                |
| 4. Dokumenty i wdrożenie              | notka w K1, `db push`, scalenie, smoke na produkcji, przeklikanie  | Scalenie przed `db push` albo `db push` w trakcie gry                        |

**Prerequisites:** gałąź `deferred-review-fixes` (jest), zgody Karola na push, draft PR, `db push` i smoke; `db push` nie z eduroam.
**Estimated effort:** 2–3 sesje: fazy 1–2 to większość pracy (migracja + ok. 30 miejsc w testach), fazy 3–4 krótkie.

## Open Risks & Assumptions

- Zakładamy, że w chwili `db push` nikt nie gra (potwierdza Karol). Inaczej przycisk „Odsłoń wynik” przez kilka minut odmawia.
- Ekran wczytany przed wdrożeniem pokaże przy odsłonie tekst ogólny, dopóki ktoś nie odświeży strony.
- Testy bazy biegną tylko w CI, więc każda poprawka testów kosztuje przebieg CI.

## Success Criteria (Summary)

- Drugi, nieodświeżony ekran hosta nie odsłoni już pytania, którego nie pokazał. Nikt nie odda głosu do pytania, którego nie widział.
- Smoke na produkcji zielony z 4 nowymi krokami. Karol na telefonie i laptopie gra jak wcześniej, a „Odsłoń wynik” działa w trakcie głosowania.
- Host, któremu skończą się pytania, nie dostanie rady „Załóż nową grę”.
