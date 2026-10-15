# Pierwsza runda na żywo (S-02) z testami anonimowości i reguł rundy — Plan Brief

> Full plan: `context/changes/first-live-round/plan.md`
> Research: `context/changes/first-live-round/research.md`

## What & Why

Gra dostaje swoją pierwszą prawdziwą rundę. Host klika „Zacznij grę”, wszyscy widzą to samo pytanie, każdy głosuje albo się wstrzymuje, widać, kto już zagłosował, a po ostatnim głosie albo przewinięciu przez hosta wszyscy widzą, ile głosów dostała każda osoba.

To gwiazda przewodnia roadmapy (S-02) i zarazem faza 2 planu testów. Pierwszy raz zapisujemy głosy, więc zasada „nigdy kto na kogo” musi być udowodniona testami, zanim powstanie kod głosowania.

## Starting Point

Dziś gra ma logowanie hosta, pokój z kategoriami, link, wejście gości z nickiem i lobby na żywo. Nie ma rund, tabeli głosów ani losowania pytań. Host pisze do tabel bezpośrednio (znane dziury F1), a reguła nicku przepuszcza 9 par wyglądających tak samo (F4). Oba problemy są opisane czerwonymi testami „znana dziura → S-02”.

## Desired End State

Na produkcji 3–20 graczy rozgrywa rundę na telefonach. W trakcie rundy stan „kto zagłosował” i liczniki żyją w urnie, która znika: przy odsłonie zostają same liczby, a przy porzuceniu rundy nic. F1 i F4 są domknięte. CI pilnuje reguł rundy, anonimowości (także z perspektywy właściciela bazy), ekranów w przeglądarce i rundy na produkcji (smoke). Karol rozgrywa rundę na laptopie, telefonie i w oknie incognito.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Gdzie żyją głosy (D1) | Tabele nielogowane w `private`, przy odsłonie tylko liczby, przy porzuceniu nic | Wspólny `xmin` w transakcji i komunikaty błędów łączyłyby głosującego z celem, więc stan w toku nie może przetrwać rundy | Research |
| Granica anonimowości (D1) | Twórca podglądający bazę na żywo albo włączający logowanie: przyjęte, zapisane w PRD i AGENTS.md | To baza twórcy, jak komisja stojąca nad urną; ochrona dotyczy stanu po rundzie, logów i ról w grze | Research |
| Przerwana runda | Zadanie pg_cron co godzinę zamyka gry rozpoczęte ponad 12 h temu i kasuje ich urnę (osobna migracja, `rooms.started_at`) | Bez tego urna z rundy przerwanej bez odsłony leżałaby do następnej gry hosta, czyli tygodniami | Plan review F1 |
| Zmiana głosu (D2) | Nie, ekran z potwierdzeniem | Urna nie wie, czyj głos jest czyj, więc nie umie go odjąć | Research |
| Próg odsłony (D3) | Brak, liczby zawsze, także po 1 głosie | Decyzja Karola, dosłownie według FR-009; skutek dopisany w PRD | Research |
| Awarie kanału (D4) | Napis na ekranie + filtrowane zgłoszenia do logów | Bez nich odsłona wisząca 15 s nie zostawia śladu; filtr chroni przed szumem z blokady telefonu | Research |
| Emotki w nicku (D5) | W2: porównanie po kolumnie `nick_key`, nick wyświetlany tak, jak wpisany | „Kasia❤️” zostaje czerwonym sercem, a podróbka i tak dostaje „zajęty” | Research |
| Testy bazy (D6) | CI, bez Dockera | Ok. 3 min na próbę, czeka agent | Research |
| Ruchy hosta (T1) | Tylko przez funkcje `security definer`; kod linku w SQL; sygnatura `create_room` bez zmian | Zamyka F1 i pozwala wgrać bazę przed kodem | Research |
| Losowanie (T3) | Czysta funkcja w Workerze z testem jednostkowym; baza pilnuje formatu i braku powtórki | Baza nie zna kategorii pytań, a host obchodząc to nie zyskuje nic ponad to, co może legalnie | Research |
| Ekran odsłony | Wszyscy gracze od największej liczby głosów, remis według kolejności dołączenia, zera przygaszone, „Wstrzymało się: N” | Kto dostał zero, to często najlepszy temat do rozmowy | Plan |
| Po odsłonie | Wynik zostaje, host widzi „Kolejne pytania wkrótce” i „Nowa gra” | S-02 zostaje małe, S-03 dokłada „Następne pytanie” | Plan |
| E2E | Jeden test „3 graczy rozgrywa rundę” w CI | Karol sam nie sprawdzi kodu; czasy i zrywanie połączenia zostają fazie 3 | Plan |
| Smoke | Z rundą na produkcji | Jedyny automatyczny dowód, że runda działa po wdrożeniu | Plan |
| Kolejność wdrożenia | `db push` → smoke na starym kodzie → scalenie → smoke | Stary Worker działa z nową bazą; odwrotna kolejność psuje start gry | Plan |

## Scope

**In scope:**

- migracja z urną, stanami gry, funkcjami start/głos/odsłona oraz poprawkami F1 i F4;
- migracja sprzątająca przerwane gry (pg_cron co godzinę);
- endpointy i stan rundy w Workerze;
- logi z listą dozwolonych pól;
- ekrany rundy z ogranicznikiem dzwonka i napisem o awarii;
- zgłoszenia z przeglądarki;
- testy: Vitest `db`, pgTAP, unit, E2E rundy, smoke z rundą;
- dopiski w PRD, AGENTS.md i planie testów;
- poprawki gołych odwołań do dokumentów.

**Out of scope:**

- następne pytanie, pominięcie i koniec gry (S-03);
- pokazanie własnego wyboru po odświeżeniu (S-04);
- spóźnieni (S-08) i inne późniejsze elementy roadmapy;
- pomiar 2 s sondą (faza 3 planu testów);
- Sentry, prywatne kanały, Durable Objects;
- usunięcie `p_link_token` i prototypu dzwonka.

## Architecture / Approach

Wszystkie reguły żyją w funkcjach bazy: host i gość mogą wołać je bezpośrednio, z pominięciem Workera. Głos to `POST` JSON do Workera z celem w treści. Worker woła `cast_vote`, a funkcja zapisuje tylko „ten gracz zagłosował” i licznik w nielogowanych tabelach. Po ostatnim głosie w tej samej transakcji przepisuje same liczby do wyników i kasuje urnę. Worker dzwoni na kanale pokoju (sygnał bez danych), a każdy ekran pobiera stan z bazy przez ogranicznik: w trakcie rundy tylko „kto zagłosował”, po odsłonie liczby.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Zasady i testy przed kodem | Czerwone testy reguł (#3) i anonimowości (#1), pgTAP widoku twórcy, dopiski w PRD i AGENTS.md | Kontrakt funkcji ustalony przed kodem musi wytrzymać fazę 2 |
| 2. Baza | Migracja rundy i sprzątająca, testy zielone, F1/F4 bez znaczników, smoke i E2E na starym kodzie | Kolizja nicków na produkcji przy nowym ograniczeniu; błąd niezmiennika urny |
| 3. Serwer rundy | Endpointy, losowanie, parser, komunikaty, logi, `/j/` w trakcie gry, zgłoszenia | Cel głosu w adresie albo w logu |
| 4. Ekrany rundy | Start, głosowanie, odsłona, napis o awarii, ogranicznik; zrzuty do oceny Karola | Budżet 2 s z pobraniem z bazy niezmierzony |
| 5. E2E i smoke | Test 3 graczy w CI, runda i FE0F w smoke, próbne alarmy, plan testów | Smoke zostawia na produkcji pokoje z wynikami (tylko liczby) |
| 6. Przegląd i wdrożenie | `/10x-impl-review`, `db push`, smoke, scalenie przez Karola, ręczna runda | Scalenie przed `db push` psuje start gry |

**Prerequisites:** `main` czysty (`0a9b6a6`), research z decyzjami D1–D6, zgoda Karola na push gałęzi, `db push` i smoke (każdy osobno).
**Estimated effort:** ok. 5–7 sesji. Najwięcej pracy w fazach 2 i 4; każda iteracja testów bazy to ok. 3 min CI.

## Open Risks & Assumptions

- Czas odsłony z pobraniem z bazy i `getUser()` hosta na produkcji jest niezmierzony; pierwszy sygnał da ręczna runda, a pomiar faza 3.
- `supabase test db` (pgTAP) w jobie `db` nie był jeszcze uruchamiany w tym repo. Gdyby nie ruszył, zastępstwem jest `psql` z adresem z `supabase status` (`research.md`, T7).
- Wygląd „Ola”+FE0F i flag po normalizacji na różnych platformach jest niesprawdzony; W2 wyświetla to, co wpisano.
- Po awarii bazy runda w toku traci głosy (koszt tabel nielogowanych).

## Success Criteria (Summary)

- Ekipa rozgrywa na produkcji rundę: to samo pytanie, głos z potwierdzeniem, widać, kto zagłosował, odsłona od razu po ostatnim głosie z poprawnymi liczbami.
- Po rundzie nikt, łącznie z właścicielem bazy przeglądającym tabele, nie połączy głosującego z celem; CI to sprawdza.
- 13 testów „znana dziura → S-02” przechodzi bez znacznika, a CI (z E2E i smoke rundy) jest zielone.
