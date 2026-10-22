# Wpuszczanie spóźnionych (S-08) — Plan Brief

> Full plan: `context/changes/latecomer-admission/plan.md`
> Research: `context/changes/latecomer-admission/research.md`

## What & Why

Spóźniony, który otworzy link do trwającej gry, prosi o wejście z wybranym nickiem; host widzi prośbę na każdym ekranie gry i wpuszcza albo odrzuca, a wpuszczony głosuje od następnego pytania (FR-020, S-08). Dziś taka osoba dostaje „Gra już trwa” i do końca wieczoru tylko patrzy. Na razie wpuszcza sam host; współhosta dopisze S-07.

## Starting Point

Wejście do gry w toku blokują strona linku, Worker i baza (`join_room` → `game_started`). Baza już ustala uprawnionych do głosu przy otwarciu każdej rundy, więc „głosuje od następnej” jest wymuszone; ekran głosowania liczy jednak wszystkich graczy, a odświeżanie na żywo działa przez dzwonek i ponowne pobranie stanu.

## Desired End State

Na `/j/<link>` gry w toku jest formularz „Poproś o wejście”, potem ekran „Czekasz, aż host Cię wpuści”, który sam przechodzi do pokoju. Host ma nad pytaniem listę próśb z „Wpuść” i „Odrzuć”. Wpuszczony w bieżącej rundzie widzi pytanie i notkę „Zagłosujesz od następnego pytania”, a na liście graczy szary dopisek; licznik i kandydaci liczą tylko uprawnionych.

## Key Decisions Made

| Decision                      | Choice                                                                       | Why (1 sentence)                                                           | Source      |
| ----------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------- |
| Kto wpuszcza                  | Sam host; współhost w S-07                                                   | Spóźnieni są na wieczorze bardziej prawdopodobni niż wyjście hosta.        | Roadmapa    |
| Decyzja hosta                 | „Wpuść” i „Odrzuć”, bez wygasania po czasie                                  | Bez „Odrzuć” obca osoba z wyciekniętego linku wisiałaby do końca wieczoru. | Research    |
| Po odrzuceniu                 | „Host Cię nie wpuścił” i „Poproś jeszcze raz”, bez potwierdzenia             | Pomyłkowe odrzucenie kolegi naprawia się jednym kliknięciem.               | Plan        |
| Limit                         | 5 oczekujących próśb naraz, kolejna `requests_full`                          | Pasek z dziesiątkami próśb zasłoniłby grę.                                 | Research    |
| Nick prośby                   | Zasady jak przy wejściu; zajęty przez gracza albo oczekującą prośbę          | Dwie osoby o tym samym nicku pomyliłyby host i graczy.                     | Research    |
| Ekran czekania                | Bez treści pytania, odświeżanie na dzwonek i co 15 s                         | Pytania dostaje tylko ten, kto ma je teraz widzieć (`lessons.md`).         | Research    |
| Wygląd prośby u hosta         | Lista nad pytaniem, każdy nick z dwoma przyciskami                           | Jedno dotknięcie w trakcie rundy, scenariusz 21:30 z PRD.                  | Plan        |
| Wpuszczony w bieżącej rundzie | Na liście z dopiskiem „od następnego pytania”, poza licznikiem i kandydatami | Wszyscy widzą, że wszedł, i nikt nie czeka na jego głos.                   | Plan        |
| Gdzie trzymać prośby          | Tabela w `public` tylko przez funkcje, nie w `players`                       | Wiersz w `player_secrets` od razu wpuściłby osobę do pokoju.               | Plan        |
| Token spóźnionego             | Token prośby staje się tokenem gracza przy „Wpuść”                           | Bez podmiany ciasteczka; `/j/<link>` sam przekieruje do pokoju.            | Plan        |
| Odświeżanie ekranu czekania   | Własny mały efekt (dzwonek, limiter, timer 15 s), `useRoomState` bez zmian   | Ekran pokoju działa na produkcji; nie ruszamy go przed wieczorem.          | Plan review |
| Agregat „Gra”                 | Nie przed wieczorem                                                          | Baza już dobrze liczy uprawnionych; zmiana dotyczy ekranu.                 | Research    |

## Scope

**In scope:** tabela próśb i 4 funkcje bazy, `room_lobby` z prośbami i uprawnionymi, sprzątanie przy zamknięciu pokoju, prośba i ekran czekania na `/j/<link>`, trasy „Wpuść”/„Odrzuć”, lista próśb u hosta, głosowanie liczące uprawnionych, podglądy `/dev`, testy bazy, pgTAP, jednostkowe, E2E i smoke, wdrożenie.

**Out of scope:** współhost (S-07), powrót na stary nick po utracie ciasteczka (S-04), wygasanie i blokada próśb, prośby w poczekalni, powiadomienia poza ekranem, agregat „Gra”, zmiany w funkcjach rundy i w `join_room`.

## Architecture / Approach

Prośba to wiersz w `public.join_requests` (nick, hash tokenu z ciasteczka, `pending`/`rejected`), dostępny tylko przez funkcje `security definer`: `request_join` i `join_request_state` (publiczne, wszystkie sprawdzenia w środku) oraz `admit_latecomer` i `reject_latecomer` (tylko host). „Wpuść” przenosi hash do `player_secrets` i dopisuje gracza; następna runda sama włącza go do uprawnionych. `room_lobby` daje hostowi listę próśb, a rundzie głosowania listę uprawnionych; Worker dzwoni po każdej akcji, więc host i czekający widzą zmianę w ok. 2 s.

## Phases at a Glance

| Phase                        | What it delivers                                                                                                               | Key risk                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1. Baza                      | Migracja, testy bazy i pgTAP na draft PR, próbny alarm                                                                         | Publiczna funkcja `request_join` musi mieć wszystkie sprawdzenia w sobie |
| 2. Strona linku i serwer gry | Prośba, ekran czekania, „Poproś jeszcze raz”, trasy hosta, kody odmów, podglądy strony linku, krok smoke wejścia do gry w toku | Ekran czekania musi przejść do pokoju bez pętli przeładowań              |
| 3. Ekrany gry                | Lista próśb u hosta, głosowanie liczy uprawnionych, podglądy ekranów gry, E2E, smoke wpuszczenia                               | Pasek na telefonie spycha pytanie; dopisek nie może mylić graczy         |
| 4. Wdrożenie                 | `db push`, scalenie, smoke na produkcji, przeklikanie                                                                          | Kod przed bazą wyłożyłby ekrany (nowy parser wymaga nowych pól)          |

**Prerequisites:** S-03 na produkcji (jest), połączenie z bazą spoza eduroam do `db push`, zgody Karola na push, `db push` i smoke.
**Estimated effort:** ~3–4 sesje w 4 fazach; większa zmiana, więc przed implementacją `/10x-plan-review` w świeżej sesji.

## Open Risks & Assumptions

- Kto w trakcie gry stracił ciasteczko, wejdzie tylko pod nowym nickiem, a jego stary nick zostaje uprawniony w bieżącej rundzie, więc ta runda nie odsłoni się sama (host odsłania ręcznie); pełny powrót to S-04.
- Budżet logowań testów bazy rośnie do 12 z 30 na 5 minut.
- Strona linku dostaje adres i klucz publishable do subskrypcji dzwonka (dozwolone przez AGENTS.md); temat `live-sync:<roomId>` jest publiczny i dzwonek nie niesie danych.

## Success Criteria (Summary)

- Spóźniony na wieczorze prosi z linku i jest w grze po jednym dotknięciu hosta, bez pisania na Discordzie.
- Wpuszczony w trakcie rundy nie psuje licznika ani odsłony i głosuje od następnego pytania.
- CI zielone, smoke na produkcji zielony, przeklikanie Karola na telefonie i laptopie.
