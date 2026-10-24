# Przegląd listy pytań przed startem (S-06) — Plan Brief

> Full plan: `context/changes/question-list-review/plan.md`
> Research: `context/changes/question-list-review/research.md`

## What & Why

Host w poczekalni może przejrzeć listę pytań tej gry: usunąć pytanie, poprawić treść, dodać własne i dolosować kolejne. To FR-012 z PRD, a przy okazji pełny CRUD na danych gry, którego brakowało do zgłoszenia 10xBuilder. Przegląd jest opcjonalny: „Zacznij grę” bez niego działa jak dziś.

## Starting Point

Gra nie ma dziś listy pytań. Każde pytanie losuje Worker w chwili startu, „Następnego pytania” albo „Pomiń”, a baza zna tylko numer pytania z `src/data/questions.ts` (`<kategoria>-<NNN>`) i nie przechowuje treści. Pytanie własne albo poprawione nie ma takiego numeru.

## Desired End State

Pod „Zacznij grę” host ma „Przejrzyj pytania”. Lista 15 pytań rozwija się na tym samym ekranie, z „Popraw” i „Usuń” w każdym wierszu, a pod nią są „Dolosuj pytanie” i „Dodaj własne pytanie”. Gra gra najpierw pytania z listy, potem losuje dalej, a usunięte nie wracają. Goście widzą pytania hosta w rundzie jak każde inne, ale samej listy nie widzą.

## Key Decisions Made

| Decision                  | Choice                                                                       | Why (1 sentence)                                                                     | Source          |
| ------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------- |
| Kiedy powstaje lista      | Po kliknięciu „Przejrzyj pytania”                                            | Ścieżka „start teraz” i stary Worker w oknie wdrożenia zostają bez zmian.            | Plan (Karol)    |
| Długość listy             | 15 pytań                                                                     | Mieści się na 1–2 ekranach telefonu i starcza na ok. pół godziny.                    | Plan (Karol)    |
| Po końcu listy            | Gra losuje dalej z kategorii, bez usuniętych i poprawionych                  | Wieczór się nie urywa (decyzja D1 z S-03).                                           | Plan (Karol)    |
| „Dolosuj pytanie”         | +1 na koniec listy                                                           | Proste i przewidywalne.                                                              | Plan (Karol)    |
| Miejsce na ekranie        | Zwinięta sekcja w poczekalni                                                 | Host widzi naraz graczy, link i start.                                               | Plan (Karol)    |
| Limit własnego pytania    | 90 znaków                                                                    | Tyle co w bazie pytań, ekran rundy jest pod to zrobiony.                             | Plan (Karol)    |
| Poprawione pytanie z bazy | Gra jako własne (bez numeru z bazy)                                          | Przyszłe statystyki pytania (S-11) nie mieszają dwóch brzmień.                       | Plan            |
| Usunięcie                 | Oznaczenie w wierszu, bez potwierdzenia                                      | Usunięte nie wraca w tej grze i S-11 może je policzyć; pomyłkę naprawia „Dolosuj”.   | Plan            |
| Pusta lista przy starcie  | Odmowa „Lista pytań jest pusta. Dolosuj albo dodaj pytanie.”                 | Host świadomie wyczyścił listę, więc gra nie zgaduje za niego.                       | Plan            |
| Gdzie lista w bazie       | `private.game_questions`, pozycja jako uchwyt, wiersze zostają po zamknięciu | Bez kolumn czasu, więc obejmuje ją skan pgTAP; własne pytania czekają na twórcę gry. | Research + Plan |

## Scope

**In scope:**

- tabela listy, zmiana tabeli rund, 5 funkcji listy, nowe wersje `start_game`, `open_next_round`, `room_lobby`;
- 5 tras hosta, treść pytania własnego w rundzie, licznik pozostałych pytań z listą, 5 nowych odmów;
- sekcja w poczekalni, podglądy `/dev`, zrzuty do oceny, testy (baza, pgTAP, unit, smoke, E2E), słownik;
- dwie zaległe poprawki dokumentów: zdanie w AGENTS.md o rulesecie i 3 numery commitów w raporcie Architect.

**Out of scope:**

- zmiana kolejności na liście i przywracanie usuniętych;
- lista dla współhosta i propozycje gości (S-07, S-10);
- dane o pytaniach i oceny (S-11, S-12), panel twórcy gry (FR-021);
- pilnowanie kategorii kandydatów w bazie (Q-04).

## Architecture / Approach

Baza dostaje listę pytań gry (pozycja, numer z bazy albo własna treść, znacznik „usunięte”). Funkcje startu i kolejnego pytania biorą najpierw kolejny nieusunięty wpis listy, a dopiero potem kandydatów od Workera, z pominięciem wszystkiego, co było na liście. `room_lobby` daje hostowi listę (`question_list`), a rundzie treść własnego pytania (`question_text`). Worker rozwiązuje treść pytań z bazy, wysyła listę do przeglądarki tylko hostowi w poczekalni, a pozostałe pytania liczy wzorem `P − B + E − n`. Ekran wysyła 5 akcji przez `act()` bez dzwonienia do gości.

## Phases at a Glance

| Phase               | What it delivers                                                  | Key risk                                                                      |
| ------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. Baza             | Migracja, testy bazy, pgTAP, dwa próbne alarmy, słownik, draft PR | Zmiana `private.rounds` i trzech funkcji gry bez lokalnej bazy (tylko CI)     |
| 2. Serwer gry       | Parsery, 5 tras, treść rundy, licznik, odmowy, smoke              | Kroki smoke listy w osobnym pokoju po wieczorze (obie gałęzie `closingSteps`) |
| 3. Ekran poczekalni | Sekcja „Przejrzyj pytania”, podglądy, zrzuty, E2E                 | Długa lista w przyklejonej lewej kolumnie na laptopie                         |
| 4. Wdrożenie        | Poprawki dokumentów, `db push`, scalenie, smoke, przeklikanie     | `db push` tylko z domu (eduroam blokuje porty bazy)                           |

**Prerequisites:** gałąź `question-list-review` od `origin/main` (`d141baa`); push, `db push` i smoke za zgodą Karola; scala Karol.
**Estimated effort:** ok. 3 sesje (faza 1, fazy 2–3, faza 4 z domu); cel: scalenie najpóźniej 31.10.2026.

## Open Risks & Assumptions

- Po pierwszej grze z listą `wrangler rollback` psuje pokoje z pytaniem własnym w bieżącej rundzie; błąd naprawiamy do przodu.
- Lista zostaje w bazie po zamknięciu pokoju (do S-13); nie zawiera par głosujący → cel, więc twarda reguła anonimowości jej nie dotyczy.
- Kandydaci po końcu listy nadal pochodzą od Workera (Q-04 otwarte).

## Success Criteria (Summary)

- Host w poczekalni przegląda listę, usuwa, poprawia, dodaje i dolosowuje pytania, a gracze grają jego wersję listy.
- „Zacznij grę” bez przeglądu działa jak dawniej; smoke i E2E zielone na produkcji i w CI.
- Gość nigdy nie widzi listy, a usunięte pytanie nie pada w tej grze.
