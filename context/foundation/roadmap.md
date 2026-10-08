---
project: "Most Likely To"
version: 1
status: draft
created: 2026-09-26
updated: 2026-10-08
prd_version: 1
main_goal: learn
top_blocker: skills
milestone_id: live-game-nights-v1
milestone_seq: 1
milestone_status: open
---

# Roadmap: Most Likely To

> Na podstawie `context/foundation/prd.md` (v1) i automatycznego przeglądu kodu.
> Edytuj w miejscu; archiwizuj, gdy zostanie zastąpiona.
> Elementy niżej są w kolejności zależności. Tabela „At a glance” to spis treści.

## Milestone

**M-01: Ekipa gra wieczory na żywo (v1)** — Status: open

Kamień milowy to zestaw elementów, który zamyka się, gdy wszystkie są zrobione, a nie w konkretnym terminie.

- **Intent:** Pierwsza wersja gry obsługuje prawdziwe wieczory: host zakłada grę, ekipa gra rundy na żywo z anonimowymi głosami, a pytania dobierają się coraz lepiej. Pierwszy punkt kontrolny to S-02 (w PRD: „pokój + runda działają z 3 osobami”).
- **Source materials:** `context/foundation/prd.md` (v1); pomocniczo `context/foundation/tech-stack.md`, `context/foundation/infrastructure.md` i `context/deployment/deploy-plan.md`.
- **Done when:** każdy element F-NN i S-NN niżej ma status `done`.
- **Scope anchors:** US-01 oraz wszystkie konieczne wymagania: FR-001–FR-009 i FR-011–FR-020. Dodatki FR-021–FR-023 są w Parked.

## Vision recap

Ekipa znajomych umawia się na Discordzie na „Kto z nas najprawdopodobniej…”, a jedynym narzędziem była ręcznie budowana ankieta w Google Forms, czytana tydzień później. Hipoteza hosta, czyli założenie, które gra ma dopiero sprawdzić, brzmi: brakuje wspólnej rundy na żywo (każdy z telefonem, odsłona i rozmowa od razu), puli pytań z kategoriami, która zostaje między wieczorami, oraz doboru pytań uczącego się z rozgrywek. Skala: do około stu użytkowników.

## North star

**S-02: Ekipa rozgrywa pierwszą rundę na żywo** — to gwiazda przewodnia, czyli najmniejszy element od początku do końca, którego działanie potwierdza hipotezę gry. Stoi tak wcześnie, jak pozwalają zależności, bo reszta ma sens tylko wtedy, gdy on działa. Przy celu „nauka” to także pierwsze prawdziwe użycie techniki na żywo sprawdzonej w F-01. Kryterium z US-01 o odświeżeniu strony domyka S-04.

## At a glance

| ID   | Change ID                    | Outcome (user can …)                                                                                            | Prerequisites    | PRD refs                                                  | Status   |
| ---- | ---------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------- | -------- |
| F-01 | live-sync-spike              | (foundation) Technika na żywo sprawdzona: kanał-dzwonek + stan z serwera, 20 graczy, 95% w ≤ 2 s, max 5 s      | —                | FR-007, FR-009, NFR (≤ 2 s, 20 graczy, prywatność głosów) | done     |
| F-02 | starter-question-base        | (foundation) Baza startowa pytań po polsku w kilku kategoriach, zatwierdzona przez twórcę gry                   | —                | FR-005, FR-015, Access Control (twórca gry)               | done     |
| S-01 | room-lobby                   | Host tworzy pokój z kategoriami (18+ osobno w każdej) i linkiem; goście wchodzą z nickiem, a host widzi ich na żywo | F-01, F-02       | US-01, FR-002, FR-005                                     | in-progress |
| S-02 | first-live-round             | Wszyscy widzą to samo pytanie, głosują anonimowo i widzą odsłonę po ostatnim głosie                             | S-01, F-01, F-02 | US-01, FR-006, FR-007, FR-008, FR-009, FR-015             | proposed |
| S-03 | full-game-evening            | Prowadzący przechodzi do kolejnych pytań, pomija rundę i kończy grę z potwierdzeniem                            | S-02             | FR-006, FR-015                                            | proposed |
| S-04 | rejoin-after-refresh         | Gracz po odświeżeniu wraca na swój nick w bieżącej rundzie, z oddanym głosem                                    | S-02             | US-01, FR-011                                             | proposed |
| S-05 | one-click-host-login         | Host loguje się jednym kliknięciem, bez hasła, z zapasową drogą logowania                                       | —                | FR-001                                                    | in-progress |
| S-06 | question-list-review         | Host może przed startem przejrzeć i poprawić wylosowaną listę pytań                                             | S-02             | FR-012                                                    | proposed |
| S-07 | co-host-role                 | Host nadaje i odbiera współhosta, który może prowadzić rundy                                                    | S-03             | FR-003, FR-006                                            | proposed |
| S-08 | latecomer-admission          | Spóźniony prosi o wejście, prowadzący go wpuszcza, a on głosuje od następnej rundy                              | S-07             | FR-020                                                    | proposed |
| S-09 | remove-player-new-link       | Prowadzący usuwa gracza, a pokój dostaje nowy link                                                              | S-07             | FR-004                                                    | proposed |
| S-10 | guest-question-proposals     | Gość proponuje pytania do limitu, a prowadzący zatwierdza je do listy tej gry                                   | S-07             | FR-013, FR-014                                            | proposed |
| S-11 | question-reactions-play-data | Gracz daje kciuk na ekranie odsłony, a gra zbiera zbiorcze dane o pytaniach                                     | S-03, S-06       | FR-016, FR-018                                            | proposed |
| S-12 | learning-question-selection  | Ekipa częściej dostaje pytania, które dobrze zagrały u innych, bez powtórek z ostatnich wieczorów               | S-11             | FR-015, FR-017                                            | proposed |
| S-13 | host-game-history            | Host widzi listę swoich gier i kasuje wybraną; anonimowe dane o pytaniach zostają                               | S-11             | FR-019                                                    | proposed |

## Streams

Pomoc w nawigacji: grupuje elementy o wspólnym łańcuchu zależności. Kanoniczna kolejność to graf zależności niżej; ta tabela to proponowana kolejność czytania równoległych ścieżek.

| Stream | Theme               | Chain                                      | Note                                                                                    |
| ------ | ------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| A      | Runda na żywo       | `F-01` → `S-01` → `S-02` → `S-03` → `S-04` | Najpierw technika na żywo (cel „nauka”), potem gwiazda przewodnia S-02 i pełny wieczór. |
| B      | Pytania i dane gier | `F-02` → `S-06` → `S-11` → `S-12` → `S-13` | F-02 dołącza do A przy S-01; S-06 rusza po S-02, a S-11 czeka też na S-03.              |
| C      | Prowadzący i goście | `S-07` → `S-08` → `S-09` → `S-10`          | Rusza po S-03 ze ścieżki A; S-08, S-09 i S-10 mogą iść równolegle.                      |
| D      | Logowanie hosta     | `S-05`                                     | Niezależne od reszty; czeka tylko na wybór dostawców logowania.                         |

## Baseline

Stan kodu na 2026-09-26 (automatyczny przegląd, potwierdzony przez właściciela projektu). Fundamenty niżej zakładają, że to istnieje, i nie budują tego od nowa.

- **Frontend:** present — Astro 7 SSR z wyspami React, Tailwind i shadcn/ui (`astro.config.mjs:11-12`); są tylko ekrany startera (`index`, `dashboard`, `auth/*`), po angielsku (`src/layouts/Layout.astro:14`), bez ekranów gry.
- **Backend / API:** present — trasy logowania i middleware (`src/pages/api/auth/*.ts`, `src/middleware.ts`); brak logiki gry i brak jakiegokolwiek mechanizmu na żywo (WebSocket, SSE, kanały, odpytywanie).
- **Data:** partial — klient Supabase podłączony (`src/lib/supabase.ts:9`), ale bez schematu, migracji i tabel (`supabase/` ma tylko `config.toml`); aplikacja korzysta wyłącznie z wbudowanego logowania.
- **Auth:** present — Supabase Auth, tylko e-mail i hasło (`src/pages/api/auth/signin.ts:13`, `src/pages/api/auth/signup.ts:13`), sesje w ciasteczkach, middleware chroni `/dashboard` (`src/middleware.ts:4`); brak logowania jednym kliknięciem i brak tożsamości gościa (nicku).
- **Deploy / infra:** present — Cloudflare Workers (`wrangler.jsonc`), produkcja pod https://most-likely-to.charlesonthewave.workers.dev; Workers Builds wdraża każdy push do `main`, a GitHub Actions uruchamia lint, `astro check`, build i smoke (`.github/workflows/ci.yml`, `context/deployment/deploy-plan.md`).
- **Observability:** partial — logi Workers włączone (`wrangler.jsonc:12-13`), test dymny w CI (`scripts/smoke.mjs`); brak logów w kodzie i śledzenia błędów.

## Foundations

### F-01: Test techniki na żywo (spike)

- **Outcome:** (foundation) Technika na żywo jest sprawdzona w prototypie: publiczny kanał Supabase Realtime niesie tylko sygnał „coś się zmieniło” (dzwonek), a stan przeglądarka pobiera z serwera. Dzwonek może nadać każdy, kto zna nazwę kanału, więc stan pochodzi wyłącznie z bazy, nigdy z treści dzwonka. W trakcie rundy stan pokazuje tylko, kto już zagłosował; liczby głosów dopiero przy odsłonie, nigdy „kto na kogo”. Kryterium: 95% dostarczeń do 20 graczy w ≤ 2 s, żadne powyżej 5 s; spełnione na produkcji 2026-10-04 (100% w 2 s, max 247 ms; `context/archive/2026-09-27-live-sync-spike/measurements.md`).
- **Change ID:** live-sync-spike
- **PRD refs:** FR-007, FR-009, NFR (≤ 2 s, 20 graczy, prywatność głosów)
- **Unlocks:** S-01 (goście pojawiają się u hosta na żywo), S-02 (wspólne pytanie i odsłona), ścieżka weryfikacji „20 graczy, odsłona w ≤ 2 s” dla S-02
- **Prerequisites:** —
- **Parallel with:** F-02, S-05
- **Blockers:** —
- **Unknowns:**
  - Jak gość bez konta odbiera zdarzenia pokoju, żeby kanał nie był otwarty dla obcych? Rozstrzygnięte w F-01 (2026-10-04): kanał jest publiczny, ale niesie tylko dzwonek, a stan gość pobiera z serwera. — Owner: Karol. Block: no.
- **Risk:** To pierwsze zetknięcie z techniką, której w projekcie nikt jeszcze nie budował (główne ryzyko: umiejętności); lepiej, żeby jej problemy wyszły w krótkim teście niż w środku rundy.
- **Status:** done

### F-02: Baza startowa pytań

- **Outcome:** (foundation) Pierwsza wspólna baza pytań po polsku, w kilku kategoriach, jest spisana, zatwierdzona przez twórcę gry i gotowa do wczytania.
- **Change ID:** starter-question-base
- **PRD refs:** FR-005, FR-015, Access Control (twórca gry)
- **Unlocks:** S-01 (wybór kategorii przy tworzeniu pokoju), S-02 (losowanie pytań do rundy)
- **Prerequisites:** —
- **Parallel with:** F-01, S-05
- **Blockers:** —
- **Unknowns:**
  - Ile pytań i jakie kategorie na start? — Owner: Karol. Block: no.
  - Jakie pytania „most likely to” działają najlepiej (Open Roadmap Question 7)? — Owner: Karol. Block: no.
- **Risk:** Bez pytań nie ma rundy, a słaba baza zepsuje pierwsze wieczory bardziej niż błąd w kodzie; to praca twórcy gry, którą można robić równolegle z F-01.
- **Status:** done

## Slices

### S-01: Pokój i poczekalnia

- **Outcome:** Host tworzy pokój, wybiera kategorie (przy każdej osobno decyduje, czy dołączyć jej pytania 18+) i dostaje link do wklejenia na Discordzie; gość otwiera link na telefonie, wpisuje nick (zajęty nick jest odrzucany) i trafia do pokoju, a host widzi dołączających na żywo.
- **Change ID:** room-lobby
- **PRD refs:** US-01, FR-002, FR-005
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pierwszy element, który łączy zalogowanego hosta, gości bez konta i działanie na żywo; od niego zależy każda późniejsza runda.
- **Status:** in-progress

### S-02: Pierwsza runda na żywo

- **Outcome:** Host klika „start”; wszyscy w pokoju widzą to samo pytanie z wybranych kategorii (18+ tylko z tych, w których host je dołączył), każdy wskazuje jedną osobę z listy nicków (także siebie) albo się wstrzymuje, wszyscy widzą, kto już zagłosował, a po ostatnim głosie lub przewinięciu przez prowadzącego widzą odsłonę: ile głosów dostała każda osoba.
- **Change ID:** first-live-round
- **PRD refs:** US-01, FR-006, FR-007, FR-008, FR-009, FR-015
- **Prerequisites:** S-01, F-01, F-02
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Tu pierwszy raz zapisujemy głosy, więc para „kto na kogo” nie może trafić do bazy, logów ani kanału na żywo; to twarda zasada gry, nie szczegół do poprawienia później. Z przeglądu S-01 (`room-lobby/follow-ups/review-fixes.md`, po archiwum w `context/archive/`): host ma dziś bezpośrednie `update (status)` na `rooms`, więc przy stanach gry musi dostać tylko dozwolone przejścia; dzwonek potrzebuje ogranicznika, bo pójdzie przy każdym głosie.
- **Status:** proposed

### S-03: Pełny wieczór

- **Outcome:** Prowadzący przechodzi do kolejnego pytania (bez powtórek w tej grze), może pominąć rundę (jej głosy przepadają i nie liczą się do jakości pytania) i kończy grę po potwierdzeniu; po ostatnim pytaniu ekipa widzi koniec wieczoru bez punktacji.
- **Change ID:** full-game-evening
- **PRD refs:** FR-006, FR-015
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zamienia jedną rundę w wieczór z 10 pytaniami, czyli główne kryterium sukcesu; przypadkowe „koniec gry” zabiłoby wieczór, stąd potwierdzenie.
- **Status:** proposed

### S-04: Powrót po odświeżeniu

- **Outcome:** Gracz, który odświeży stronę albo straci połączenie, w mniej niż 10 s wraca na swój nick w bieżącej rundzie i widzi swój oddany głos; nikt inny nie może w tym czasie przejąć jego nicku.
- **Change ID:** rejoin-after-refresh
- **PRD refs:** US-01, FR-011
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-05, S-06 i każdy późniejszy element (nic od niego nie zależy)
- **Blockers:** —
- **Unknowns:**
  - Czy przywrócenie oddanego głosu może działać tylko na tym samym urządzeniu (głos pamięta telefon gracza, a serwer nie przechowuje pary „kto na kogo”)? — Owner: Karol. Block: no.
- **Risk:** Przywracanie głosu ściera się z zasadą, że „kto na kogo” nigdy nie jest do odzyskania; trzeba to rozstrzygnąć przy planowaniu, zanim kod gdziekolwiek zapisze tę parę.
- **Status:** proposed

### S-05: Logowanie hosta jednym kliknięciem

- **Outcome:** Host loguje się jednym kliknięciem przez zewnętrznego dostawcę, bez rejestracji i hasła; ten sam e-mail oznacza tego samego hosta także przy zapasowej drodze logowania.
- **Change ID:** one-click-host-login
- **PRD refs:** FR-001
- **Prerequisites:** —
- **Parallel with:** każdy inny element (nie dzieli z nimi zależności)
- **Blockers:** —
- **Unknowns:**
  - Którzy dostawcy logowania i jaka droga zapasowa (drugi dostawca czy e-mail)? Rozstrzygnięte 2026-10-06: Discord (główny) + Google (zapasowy), „Confirm email” włączone; logowanie hasłem zostaje dla istniejących kont, rejestracja z hasłem w Parked (`context/changes/one-click-host-login/research.md`, sekcja „Decyzja”). — Owner: Karol. Block: no.
- **Risk:** Do tego czasu host loguje się e-mailem i hasłem ze startera, co wystarcza do gry z własną ekipą; przed zaproszeniem obcych hostów ten element musi być gotowy.
- **Status:** in-progress

### S-06: Przegląd listy pytań przed startem

- **Outcome:** Host może przed startem przejrzeć wylosowaną listę pytań tej gry: usunąć pytanie, dolosować nowe, poprawić treść albo dodać własne; domyślną ścieżką zostaje „start teraz” bez przeglądania.
- **Change ID:** question-list-review
- **PRD refs:** FR-012
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Przegląd nie może spowolnić ścieżki „gra w mniej niż 5 minut”, dlatego zostaje opcjonalny.
- **Status:** proposed

### S-07: Współhost

- **Outcome:** Host nadaje i odbiera rolę współhosta graczowi w pokoju; współhost może startować, pomijać i kończyć rundy, więc wieczór trwa dalej, gdy host wyjdzie.
- **Change ID:** co-host-role
- **PRD refs:** FR-003, FR-006
- **Prerequisites:** S-03
- **Parallel with:** S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Wprowadza drugą rolę prowadzącego, na której opierają się S-08, S-09 i S-10; lepiej ustalić uprawnienia raz, niż dokładać je w każdym z tych elementów.
- **Status:** proposed

### S-08: Wpuszczanie spóźnionych

- **Outcome:** Spóźniony gracz prosi o wejście do trwającej gry z wybranym nickiem; prośba jest widoczna dla hosta i współhosta na każdym ekranie, także w trakcie głosowania; wpuszczony widzi bieżącą rundę i głosuje od następnej.
- **Change ID:** latecomer-admission
- **PRD refs:** FR-020
- **Prerequisites:** S-07
- **Parallel with:** S-09, S-10, S-11
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Powiadomienie „na każdym ekranie” to kolejne zdarzenie na żywo; sprawdza, czy synchronizacja z F-01 działa także poza samą rundą.
- **Status:** proposed

### S-09: Usunięcie gracza i nowy link

- **Outcome:** Host lub współhost usuwa gracza z pokoju; pokój dostaje nowy link, a stary przestaje działać.
- **Change ID:** remove-player-new-link
- **PRD refs:** FR-004
- **Prerequisites:** S-07
- **Parallel with:** S-08, S-10, S-11
- **Blockers:** —
- **Unknowns:**
  - Co z głosami oddanymi na gracza i przez gracza usuniętego w środku rundy (Open Roadmap Question 3; propozycja: przepadają)? — Owner: Karol. Block: no.
- **Risk:** Zmiana linku w trakcie gry nie może wyrzucić pozostałych graczy, dlatego ten element idzie po rundzie na żywo i po współhoście.
- **Status:** proposed

### S-10: Propozycje pytań od gości

- **Outcome:** Gość proponuje pytania z linku do pokoju w trakcie wieczoru, do limitu na grę; host lub współhost zatwierdza albo odrzuca, a zatwierdzone trafiają do listy tej gry.
- **Change ID:** guest-question-proposals
- **PRD refs:** FR-013, FR-014
- **Prerequisites:** S-07
- **Parallel with:** S-08, S-09, S-11
- **Blockers:** —
- **Unknowns:**
  - Ile propozycji na gościa w jednej grze (Open Roadmap Question 4; propozycja: około 3)? — Owner: Karol. Block: no.
  - Gdzie czekają zatwierdzone propozycje na przegląd twórcy gry, skoro w v1 odbywa się on poza aplikacją (FR-021 w Parked)? — Owner: Karol. Block: no.
- **Risk:** Zalew propozycji odciąga prowadzącego od gry; limit i szybkie zatwierdzanie chronią rytm wieczoru.
- **Status:** proposed

### S-11: Reakcje i dane o pytaniach

- **Outcome:** Gracz jednym dotknięciem daje kciuk w górę lub w dół na ekranie odsłony (nieobowiązkowo, bez blokowania prowadzącego), a gra zapisuje zbiorcze dane o każdym pytaniu: skupienie głosów, pominięcia, reakcje i usunięcia z list przed startem.
- **Change ID:** question-reactions-play-data
- **PRD refs:** FR-016, FR-018
- **Prerequisites:** S-03, S-06
- **Parallel with:** S-07, S-08, S-09, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Dane o pytaniu muszą być wyłącznie zbiorcze (rozkład głosów, nigdy „kto na kogo”), bo zasila je każda ekipa i zostają po skasowaniu gry.
- **Status:** proposed

### S-12: Dobór pytań uczący się z rozgrywek

- **Outcome:** Ekipa częściej dostaje pytania, które dobrze zagrały u wszystkich ekip; nowe pytania dostają szansę przed oceną, słabe przestają się pojawiać i czekają na twórcę gry, a gra nie losuje pytań z ostatnich wieczorów tego hosta.
- **Change ID:** learning-question-selection
- **PRD refs:** FR-015, FR-017
- **Prerequisites:** S-11
- **Parallel with:** S-13
- **Blockers:** —
- **Unknowns:**
  - Od ilu zagrań pytanie jest oceniane i jak ważyć sygnały (Open Roadmap Question 6)? Na start proste wartości, strojenie po pierwszych wieczorach. — Owner: Karol. Block: no.
  - Co losuje gra, gdy w wybranych kategoriach skończą się pytania, których ekipa jeszcze nie grała (Open Roadmap Question 5)? — Owner: Karol. Block: no.
- **Risk:** Dobór ma sens dopiero na danych z kilku wieczorów, dlatego idzie po S-11; strojenie wag na małych liczbach byłoby zgadywaniem.
- **Status:** proposed

### S-13: Lista gier hosta i kasowanie

- **Outcome:** Host widzi minimalną listę swoich gier (data, liczba pytań, kto grał) i kasuje dowolną; kasowanie usuwa wszystko, co wiąże się z nickami, a anonimowe dane o pytaniach zostają we wspólnej bazie, o czym aplikacja mówi wprost.
- **Change ID:** host-game-history
- **PRD refs:** FR-019
- **Prerequisites:** S-11
- **Parallel with:** S-12
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Idzie po S-11, żeby kasowanie dało się sprawdzić na prawdziwych danych zbiorczych: nicki znikają, dane o pytaniach zostają.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                    | Suggested issue title                                                  | Ready for `/10x-plan` | Notes                                                                      |
| ---------- | ---------------------------- | ---------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------- |
| F-01       | live-sync-spike              | Test techniki na żywo: 20 graczy, odsłona w ≤ 2 s, tylko dane zbiorcze | yes                   | Run `/10x-plan live-sync-spike`; odblokowuje gwiazdę przewodnią S-02       |
| F-02       | starter-question-base        | Baza startowa pytań po polsku z kategoriami                            | yes                   | Run `/10x-plan starter-question-base`; praca twórcy gry, równolegle z F-01 |
| S-01       | room-lobby                   | Pokój z kategoriami, link i wejście gości z nickiem                    | no                    | Czeka na F-01 i F-02                                                       |
| S-02       | first-live-round             | Pierwsza runda na żywo: wspólne pytanie, anonimowy głos, odsłona       | no                    | Gwiazda przewodnia; czeka na S-01                                          |
| S-03       | full-game-evening            | Pełny wieczór: następne pytanie, pominięcie, koniec gry                | no                    | Czeka na S-02                                                              |
| S-04       | rejoin-after-refresh         | Powrót na swój nick po odświeżeniu, z oddanym głosem                   | no                    | Czeka na S-02                                                              |
| S-05       | one-click-host-login         | Logowanie hosta jednym kliknięciem                                     | no                    | Zablokowane: wybór dostawców logowania                                     |
| S-06       | question-list-review         | Opcjonalny przegląd listy pytań przed startem                          | no                    | Czeka na S-02                                                              |
| S-07       | co-host-role                 | Rola współhosta                                                        | no                    | Czeka na S-03                                                              |
| S-08       | latecomer-admission          | Wpuszczanie spóźnionych graczy                                         | no                    | Czeka na S-07                                                              |
| S-09       | remove-player-new-link       | Usunięcie gracza i nowy link do pokoju                                 | no                    | Czeka na S-07                                                              |
| S-10       | guest-question-proposals     | Propozycje pytań od gości z zatwierdzaniem                             | no                    | Czeka na S-07                                                              |
| S-11       | question-reactions-play-data | Kciuki na odsłonie i zbiorcze dane o pytaniach                         | no                    | Czeka na S-03 i S-06                                                       |
| S-12       | learning-question-selection  | Dobór pytań uczący się z rozgrywek                                     | no                    | Czeka na S-11                                                              |
| S-13       | host-game-history            | Lista gier hosta i kasowanie                                           | no                    | Czeka na S-11                                                              |

## Open Roadmap Questions

1. **Czy istniejące aplikacje „most likely to" już rozwiązują problem przygotowania?** — Owner: host. Sprawdzić 2–3 gotowe aplikacje przed budową; jeśli któraś daje pulę własną, rundę na żywo dla ekipy zdalnej i uczenie się z rozgrywki, hipoteza wglądu wymaga zmiany. Block: nie, ale wpływa na Vision.
2. **Kto w ostatnich miesiącach realnie organizował te wieczory i jak często udało się zagrać?** — Owner: host. Kalibruje, jak często panel hosta będzie używany. Block: nie.
3. **Co z głosami oddanymi na gracza (i przez gracza) wyrzuconego w środku rundy?** (FR-004) — Owner: host. Propozycja do rozważenia: głosy przepadają, odsłona liczy się bez niego. Block: nie.
4. **Ile propozycji pytań może wysłać jeden gość w jednej grze?** (FR-013) — Owner: host. Liczba do ustalenia; propozycja z rozmowy: około 3. Block: nie.
5. **Co losuje gra, gdy w wybranych kategoriach skończą się pytania, których ta ekipa jeszcze nie grała?** (FR-015) — Owner: host. Host uważa, że mała baza na start to nie problem (baza rośnie), ale zachowanie w tym przypadku nie jest opisane. Block: nie.
6. **Co znaczy „za mało zagrań, by oceniać" w FR-017 (próg liczby zagrań) i z jakich sygnałów FR-016 liczy się wynik jakości?** — Owner: host. Kierunek: pominięcia, reakcje, skupienie głosów; wagi i próg do ustalenia po pierwszych wieczorach. Block: nie (szczegół reguły, nie sama reguła).
7. **Jakie pytania „most likely to" działają najlepiej?** — Owner: host. Research poza aplikacją: artykuły, badania, istniejące gry; wynik zasili bazę startową i ewentualnie przyszłe generowanie pytań (poza v1). Block: nie.
8. **Po co gość miałby chcieć konta?** — Owner: host. Konto gościa dopuszczalne po v1, jeśli ktoś go chce, ale dopiero gdy wiadomo, co ma dawać (np. stały nick, własne propozycje między wieczorami). Do rozstrzygnięcia przed jakąkolwiek pracą nad kontami gości. Block: nie.
9. **Jak nie dopuścić do uśpienia darmowego projektu Supabase (po 7 dniach bez ruchu) przed pierwszym prawdziwym wieczorem gry?** — Owner: Karol. Opcje z `infrastructure.md` (ryzyko nr 1): ręczne budzenie z listą kontrolną hosta, cykliczne zapytanie albo plan płatny. Block: nie blokuje planowania; decyzja przed pierwszym prawdziwym wieczorem.

## Parked

- **Odsłona lub zapis „kto na kogo głosował”** — Why parked: PRD §Non-Goals; trwała zasada gry, wykluczona na zawsze, a nie odłożona.
- **Punkty i ranking między wieczorami** — Why parked: PRD §Non-Goals; zabawą jest odsłona i rozmowa.
- **Konta gości** — Why parked: PRD §Non-Goals; najpierw Open Roadmap Question 8.
- **Inne mini-gry** — Why parked: PRD §Non-Goals; jedna gra.
- **Generowanie pytań przez AI** — Why parked: PRD §Non-Goals; najpierw research z Open Roadmap Question 7.
- **Wielu kuratorów bazy i narzędzia moderacji** — Why parked: PRD §Non-Goals; bazę weryfikuje jedna osoba.
- **Czat głosowy i tekstowy w aplikacji** — Why parked: PRD §Non-Goals; rozmowa zostaje na Discordzie.
- **Wersja angielska** — Why parked: PRD §Non-Goals (decyzja hosta 2026-09-26); v1 po polsku, angielski ewentualnie po dopracowaniu gry.
- **Aplikacja ze sklepu i tryb offline** — Why parked: PRD §Non-Goals; tylko przeglądarka, tylko z siecią.
- **Skala powyżej około stu użytkowników** — Why parked: PRD §Non-Goals; przed taką skalą host chce przemyśleć grę od nowa.
- **FR-021: panel weryfikacji nowych pytań w aplikacji** — Why parked: PRD przesuwa panel do v2; w v1 twórca gry przegląda nowe pytania poza aplikacją.
- **FR-022: podsumowanie wieczoru** — Why parked: dodatek, niepotrzebny do sprawdzenia rundy na żywo; wrócić po pierwszych wieczorach.
- **FR-023: emotki i gify do pokoju** — Why parked: dodatek; rozmowa i tak toczy się na Discordzie.
- **Pełna historia wieczorów w panelu hosta** — Why parked: PRD przesuwa ją do v2; v1 ma minimalną listę gier (S-13).
- **Nick zapamiętany w przeglądarce** — Why parked: PRD przesuwa go do v2 (Access Control: „Poza MVP”).
- **Rejestracja e-mailem i hasłem dla nowych hostów** — Why parked: decyzja Karola 2026-10-06 przy S-05; bez własnej skrzynki nadawczej nie da się potwierdzić adresu, a bez potwierdzenia obcy może zarejestrować się na cudzy e-mail. Wrócić jako osobna zmiana z własnym SMTP (kandydat: Gmail gry z hasłem aplikacji, do sprawdzenia).
- **Śledzenie błędów i metryki** — Why parked: stan bazowy ma logi Workers i test dymny; przy celu „nauka” i skali do stu osób to wystarcza; wrócić, jeśli wieczory testowe pokażą błędy.

## Milestone History

_Brak: to pierwszy kamień milowy._

## Done

- **F-02: (foundation) Pierwsza wspólna baza pytań po polsku, w kilku kategoriach, jest spisana, zatwierdzona przez twórcę gry i gotowa do wczytania.** — Archived 2026-09-27 → `context/archive/2026-09-27-starter-question-base/`. Lesson: `context/foundation/lessons.md` → „Pytania gry tylko po stronie serwera”.
- **F-01: (foundation) Technika na żywo jest sprawdzona w prototypie: publiczny kanał Supabase Realtime niesie tylko sygnał „coś się zmieniło” (dzwonek), a stan przeglądarka pobiera z serwera. Dzwonek może nadać każdy, kto zna nazwę kanału, więc stan pochodzi wyłącznie z bazy, nigdy z treści dzwonka. W trakcie rundy stan pokazuje tylko, kto już zagłosował; liczby głosów dopiero przy odsłonie, nigdy „kto na kogo”. Kryterium: 95% dostarczeń do 20 graczy w ≤ 2 s, żadne powyżej 5 s; spełnione na produkcji 2026-10-04 (100% w 2 s, max 247 ms; `context/archive/2026-09-27-live-sync-spike/measurements.md`).** — Archived 2026-10-04 → `context/archive/2026-09-27-live-sync-spike/`. Lesson: —.
