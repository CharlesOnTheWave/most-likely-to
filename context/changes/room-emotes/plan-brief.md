# S-16 Emotki do pokoju — Plan Brief

> Full plan: `context/changes/room-emotes/plan.md`
> Research: `context/changes/room-emotes/research.md`

## What & Why

Gracze chcą reagować na odsłony i pytania bez pisania: jedno dotknięcie wysyła emotkę, którą cały pokój widzi przez chwilę
z nickiem nadawcy. To dodatek z PRD (FR-023) w wersji bez gifów i tekstu; rozmowa dalej toczy się na Discordzie.

## Starting Point

Kanał na żywo niesie dziś tylko „dzwonek” (sygnał „pobierz stan”), nadawany wyłącznie przez Worker. Worker umie rozpoznać
gracza i jego nick (`room_lobby`), a S-11 dał gotowy wzór przycisku jednym dotknięciem i endpointu akcji bez dzwonka.

## Desired End State

Na każdym ekranie pokoju (poczekalnia, gra, koniec wieczoru) gracz ma pasek ❤️ 👍 👎 😭 🤬 💀. Dotknięcie wysyła emotkę,
a wszyscy, nadawca też, widzą przez ok. 3 s dymek z kolorową kropką gracza, nickiem i emotką; naraz najwyżej 5 dymków. Po
wysłaniu pasek gaśnie na 3 s. Nic nie trafia do bazy.

## Key Decisions Made

| Decision             | Choice                                                                             | Why (1 sentence)                                                                         | Source                              |
| -------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| Nick przy emotce     | Tak, z nickiem                                                                     | Więcej zabawy „kto się śmieje”; podróbka z nickiem gracza tego pokoju przyjęta świadomie | Karol (po researchu)                |
| Zestaw i kolejność   | ❤️ 👍 👎 😭 🤬 💀                                                                  | Wybór Karola na stronie z emotkami                                                       | Karol                               |
| Przerwa po emotce    | 3 s, widoczna (przyciski gasną)                                                    | Chroni limit wiadomości Realtime całego projektu                                         | Karol / Research                    |
| Droga emotki         | Przycisk → endpoint Workera → `room_lobby` → kanał (`httpSend`, zdarzenie `emote`) | Zgodne z zasadą „klucz w przeglądarce tylko do subskrypcji” i „nadaje tylko Worker”      | Research / Plan                     |
| Baza                 | Bez migracji i zapisu                                                              | `room_lobby` już daje nick pytającego i listę graczy                                     | Plan                                |
| Walidacja u odbiorcy | Tylko emotka z listy i nick z bieżącej listy graczy                                | Obcy nie wstawi tekstu ani wymyślonego nicku                                             | Plan                                |
| Przerwa na serwerze  | Nie                                                                                | Fałszerz i tak omija Worker; uczciwy klient pilnuje sam                                  | Plan                                |
| Ekrany               | Poczekalnia, gra, koniec wieczoru; bez czekającego spóźnionego                     | Spóźniony nie jest jeszcze graczem                                                       | Plan (do potwierdzenia na zrzutach) |
| Wygląd               | Warianty na zrzutach, wybiera Karol                                                | Wygląd ekranu to decyzja Karola                                                          | Karol                               |

## Scope

**In scope:** lista i walidacja emotek, endpoint `emote`, zdarzenie na kanale, pasek z przerwą 3 s, dymki (z ograniczeniem
ruchu), komunikat dla czytnika ekranu, podglądy, testy jednostkowe, E2E, kroki w smoke, hasło w słowniku, dopisek w
rejestrze ryzyka.

**Out of scope:** gify, tekst, historia i liczniki emotek; podpisywanie emotek i kanały prywatne; przerwa na serwerze;
zapis w bazie; emotki u czekającego spóźnionego; zmiany dzwonka.

## Architecture / Approach

Dotknięcie → `POST /api/rooms/<id>/emote {emote}` → Worker: ochrona POST, ciasteczko gościa albo sesja hosta,
`room_lobby` (null = 404) → `httpSend("emote", {emote, nick})` przez `waitUntil` → każdy ekran w pokoju (`useRoomState`)
odbiera zdarzenie, `parseEmoteMessage` sprawdza emotkę i nick względem bieżącej listy graczy → dymek na 3 s.

## Phases at a Glance

| Phase                            | What it delivers                                  | Key risk                                                           |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Emotka przez serwer do kanału | Moduł emotek, endpoint, zdarzenie, testy, smoke   | Dzwonek musi działać bez zmian po wydzieleniu wspólnej wysyłki     |
| 2. Pasek i dymki na ekranie      | Pasek, dymki, warianty na zrzutach, podglądy, E2E | Kolizja z przyklejonym paskiem hosta od `lg`; fokus po ruchu hosta |
| 3. Wdrożenie                     | PR, CI, scalenie, smoke, zbiorcza gra             | Bez bazy, więc niskie                                              |

**Prerequisites:** S-02 (pokój na żywo) wdrożone; gałąź `room-emotes`.
**Estimated effort:** ok. 2 sesje (faza 2 z rundą zrzutów do wyboru).

## Open Risks & Assumptions

- Na publicznym kanale ktoś z UUID pokoju może wysłać emotkę z nickiem gracza tego pokoju (przyjęte przez Karola).
- Ciągłe klikanie 20 osób przez minutę przekroczyłoby średni limit Realtime projektu; zwykła gra jest daleko od limitu.
- Emoji wyglądają inaczej na iPhonie, Androidzie i Windows; czytnik ekranu dostaje polską nazwę emotki.

## Success Criteria (Summary)

- W zbiorczej grze każdy widzi cudze emotki z nickiem na telefonie i laptopie, a host prowadzi grę bez przeszkód.
- Smoke i E2E zielone; w bazie i logach nie ma nadawcy ani emotki.
