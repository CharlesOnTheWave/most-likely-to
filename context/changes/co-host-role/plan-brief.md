# Współhost (S-07) — Plan Brief

> Full plan: `context/changes/co-host-role/plan.md`
> Research: `context/changes/co-host-role/research.md`

## What & Why

Host nadaje i odbiera rolę współhosta graczowi w pokoju. Współhost prowadzi grę jak host: zaczyna grę, odsłania wynik, przechodzi dalej, pomija pytanie, wpuszcza spóźnionych i kończy grę. Cel z PRD: wieczór nie umiera, gdy host wyjdzie. Na S-07 czekają S-09 (usunięcie gracza) i S-10 (propozycje pytań).

## Starting Point

Każdy ruch prowadzącego sprawdza w bazie tylko `rooms.host_id` i jest przyznany tylko zalogowanym. Gość nie ma konta, więc dziś nie wykona żadnego ruchu. Trasy Workera czytają tylko sesję, a losowanie bierze kategorie przez RLS hosta. Ekrany pokazują kontrolki prowadzącego dla `role === "host"`. Gdy host wyjdzie, gra staje.

## Desired End State

Host przyciskiem przy nicku na liście „Gracze” robi gościa współhostem, a przy nicku pojawia się znaczek „współhost”. Współhost widzi te same kontrolki prowadzącego co host, bez listy pytań gry, linku, „Nowej gry” i nadawania roli. Zmiana roli dociera bez przeładowania i jest ogłaszana. Ruch po odebraniu roli dostaje własną odmowę. Teksty mówią „prowadzący” („Prowadzący pominął…”, „Czekamy, aż prowadzący zacznie.”).

## Key Decisions Made

| Decision              | Choice                                                                          | Why (1 sentence)                                                        | Source                  |
| --------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------- |
| Ilu współhostów       | dowolnie wielu                                                                  | Ekipa sama ustala, kto pilnuje wieczoru.                                | Research (Karol)        |
| Kto może zostać       | każdy gość, także wpuszczony spóźniony; host nie                                | Roli potrzebuje ten, kto zostaje do końca.                              | Research (Karol)        |
| Koniec gry            | współhost kończy, z tym samym „Na pewno?”                                       | Zgodnie z FR-006 i tabelą uprawnień PRD.                                | Research (Karol)        |
| Link dla graczy       | tylko u hosta                                                                   | Link widać tylko w poczekalni, a spóźnionym ekipa podsyła go z czatu.   | Research (Karol)        |
| Gdzie nadawać rolę    | przycisk przy nicku na liście „Gracze”, znaczek „współhost”; wygląd na zrzutach | Lista jest w poczekalni i w głosowaniu po głosie.                       | Research (Karol) / Plan |
| Host, który wyszedł   | dalej uprawniony do głosu; rundę odsłania współhost                             | Usuwanie gracza to S-09.                                                | Research (Karol)        |
| Miejsce roli          | `players.cohost` z `check` (tylko gość), zmiana tylko przez `set_cohost`        | Znika z graczem i pokojem, pozwala na wielu.                            | Research                |
| Kontrola prowadzącego | jedna funkcja `private.leader_refusal` w 7 ruchach                              | Jedna reguła zamiast siódmej kopii warunku (decyzja 7).                 | Research                |
| Tożsamość współhosta  | opcjonalny `p_player_token` + grant `anon`, jak przy głosie                     | Wzór „sesja albo ciasteczko” już działa w `vote.ts`.                    | Research                |
| Dane losowania        | klucz `leader_draw` w `room_lobby`, odcinany w Workerze                         | Gość nie widzi wiersza `rooms`, a pytania zostają na serwerze.          | Research                |
| Rola w widoku         | `role` bez zmian, nowe `leader: boolean`                                        | Nowa wartość roli zepsułaby stary Worker między `db push` a wdrożeniem. | Research                |
| Odmowy                | `not_leader`, `player_unknown` (409, z tekstem)                                 | Odebrana rola nie kończy się „Coś poszło nie tak”.                      | Research / Plan         |
| Kolejność i fazy      | baza → serwer → ekrany → wdrożenie, `db push` przed scaleniem                   | Ten sam układ co S-08, migracja addytywna.                              | Plan                    |

## Scope

**In scope:**

- migracja (kolumna, kontrola, 7 ruchów, `set_cohost`, `room_lobby`);
- trasy ruchów z ciasteczkiem i nowa trasa `cohost`;
- kontrolki według `leader`, teksty „prowadzący”, ogłoszenie roli;
- podglądy, testy bazy, pgTAP, jednostkowe, E2E `cohost.spec.ts` i krok smoke;
- follow-upy S-08 F1 (testy `request_join`) i F4 (wyszarzony wiersz prośby);
- słownik, zdanie w AGENTS.md, PRD i `test-plan.md`.

**Out of scope:**

- wykrywanie nieobecności hosta i samoczynne przekazanie roli;
- usuwanie gracza (S-09), propozycje pytań (S-10), wybór koloru;
- nowa wartość `role`;
- pełny agregat „Gra”;
- zmiany w `cast_vote`, `react_round`, `join_room`, `request_join`, `create_room` i funkcjach listy pytań.

## Architecture / Approach

Rolę rozstrzyga baza. Trasa przekazuje sesję hosta albo token z ciasteczka gracza, a funkcja `security definer` blokuje wiersz pokoju i pyta `leader_refusal`, czy to prowadzący. `room_lobby` daje prowadzącym prośby i `leader_draw` (kategorie i dwie liczby listy). Worker liczy z nich kandydatów i pozostałe pytania, a przeglądarce oddaje tylko `leader`. Ekrany przełączają kontrolki z `role` na `leader`, a rzeczy hosta zostają przy `role`.

## Phases at a Glance

| Phase         | What it delivers                                                                          | Key risk                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. Baza       | migracja, `cohost.test.ts`, pgTAP, próbny alarm, dokumenty z nazwami                      | skopiowanie starszej wersji którejś z 7 funkcji (cofnięcie F2/S-11/S-15)   |
| 2. Serwer gry | trasy „sesja albo ciasteczko”, `leader_draw`, trasa `cohost`, odmowy, smoke               | `leader_draw` wycieka do przeglądarki                                      |
| 3. Ekrany     | warianty → wybór Karola, kontrolki według `leader`, teksty, ogłoszenie, podglądy, E2E, F4 | e2e szukają starych tekstów dosłownie; scenariusz z zamkniętą stroną hosta |
| 4. Wdrożenie  | `db push` za zgodą, scalenie, smoke na produkcji, gra z ekipą                             | `db push` z eduroam nie przejdzie (porty bazy)                             |

**Prerequisites:** gałąź `co-host-role` od `1dd2a0e` (research `99a7b2e`), `.dev.vars` w folderze, `db push` z domu albo z hotspotu.
**Estimated effort:** ~4–5 sesji (faza 1 największa: 7 funkcji do odtworzenia i przepisane testy uprawnień).

## Open Risks & Assumptions

- Gdy host wyjdzie, rundy czekają na „Odsłoń wynik” współhosta, bo host dalej jest uprawniony do głosu. Świadomie, do S-09.
- Współhost, któremu odebrano rolę, widzi przyciski do odświeżenia (dzwonek albo 15 s). Jego kliknięcie dostaje „Nie jesteś już współhostem.”.
- Dwóch prowadzących klika naraz: numer pytania w każdym ruchu (`round_over`) i `game_started` przy starcie rozstrzygają, kto pierwszy.
- Siedem funkcji przyznanych `anon` to publiczne punkty wejścia, więc wszystkie kontrole zostają w środku. Advisors pokażą zamierzone ostrzeżenia.
- „Nowa gra” hosta zamyka jego otwarty pokój, także wieczór prowadzony przez współhosta (przy gościach z potwierdzeniem). Świadomie, do S-09 albo później.
- Wyjątek: pulę pytań (kategorie, 18+) sprawdza tylko Worker, więc współhost wołający RPC sam może ją obejść. Znana dziura F1, przypięta `test.fails`.

## Success Criteria (Summary)

- Na wieczorze z ekipą host nadaje rolę i wychodzi, a współhost prowadzi do końca: odsłania wynik, przechodzi dalej, wpuszcza spóźnionego i kończy grę.
- Odebranie roli działa od razu: pasek znika bez przeładowania, a ruch po odebraniu dostaje własny tekst.
- CI zielone (`ci`, `smoke`, `db`, `e2e`), smoke na produkcji zielony.
