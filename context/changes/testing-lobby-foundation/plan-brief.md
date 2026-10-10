# Fundament testów i zabezpieczenie lobby — Plan Brief

> Full plan: `context/changes/testing-lobby-foundation/plan.md`
> Research: `context/changes/testing-lobby-foundation/research.md`

## What & Why

Faza 1 planu testów (`context/foundation/test-plan.md` §3) dla ryzyk #4 (ktoś działa ponad swoją rolę) i #6 (gość nie wchodzi albo traci nick). Stawiamy pierwszy runner testów i udowadniamy w istniejącym lobby dwie rzeczy:

- role dostają odmowę, nawet gdy wołają bazę z pominięciem Workera;
- identycznie wyglądające nicki są odrzucane.

Właściciel nie zweryfikuje kodu sam, więc oczekiwania pochodzą z PRD, ze źródeł Unicode i z jego decyzji, a nie z kodu.

## Starting Point

Projekt nie ma żadnego runnera, jest tylko `npm run smoke` przez Workera. Reguły pokoju i nicku żyją w SQL (`supabase/migrations/20261007122858_room_lobby.sql`), a znane dziury z przeglądu S-01 są wciąż otwarte:

- **F1:** host przez REST otwiera zamknięty pokój, wybiera kod linku i zapisuje nick z pominięciem reguły;
- **F4:** niektóre niewidoczne znaki przechodzą, brak limitu długości.

Lokalnie nie ma Dockera, więc testy bazy mogą chodzić tylko w CI.

## Desired End State

- `npm test` (unit) chodzi lokalnie i w CI.
- `npm run test:db` chodzi w nowym jobie CI `db`, na lokalnym Supabase, i odmawia startu poza nim.
- Na `main` są strażnicy ról i 23 przypadki par nicków.
- Dziury F1 i F4 są zapisane jako oczekiwane porażki „znana dziura … → S-02”. Gdy S-02 je naprawi, CI samo każe zdjąć znacznik.
- Próbny alarm pokazał, że strażnicy łapią otwarte uprawnienie.
- Smoke sprawdza, że otwarcie linku niczego nie zmienia i że po odświeżeniu gracz wraca na swój nick.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| F1 i F4 | Znana porażka (`test.fails`), naprawa w migracji S-02 | Migracja na jedynej bazie poszerzałaby fazę „postaw testy”, a F1 i tak zmieni S-02 | Research (decyzja Karola) |
| Runner | Vitest 5, osobny `vitest.config.ts` bez `getViteConfig` | Styk z adapterem Cloudflare niepotwierdzony, a testy nie potrzebują `astro:*` | Research |
| Drzwi testów bazy | REST/RPC kluczem publishable jako `anon` i jako host po `signUp`, bez klucza secret | Te same drzwi co atakujący; klucz uprzywilejowany daje fałszywą zieleń | Research |
| Gdzie testy bazy | Tylko CI, osobny job `db` równolegle ze `smoke` | Brak Dockera lokalnie; osobny sygnał bez dłuższego czekania, minuty darmowe (repo publiczne) | Research + Plan |
| Dowód, że strażnicy potrafią zawieść | Tymczasowa migracja na gałęzi otwiera 3 dziury, CI czerwone, potem revert | Dowód na prawdziwej bazie, odpowiedź na ryzyko #5 | Plan (Karol) |
| Push gałęzi | Okno uprawnień wystarczy; main, PR i scalenie zawsze z pytaniem w czacie | Iteracje CI bez czekania; gałąź nie wdraża | Plan (Karol) |
| „Ola❤” vs „Ola❤️” | Bez testu; decyzja przy poprawce F4 w S-02 | Skutek (jak nick się wyświetla) widać dopiero przy poprawce | Plan (Karol) |
| Formy zgodności („Ｏｌａ”) | Różne nicki, przyjęte ryzyko, bez testu | Zgodne z decyzją S-01 o podobnych literach | Plan (Karol) |
| Co znaczy „wymagane” | Reguła w `AGENTS.md`: zmiany bazy i pokoju tylko przez PR na zielonym CI | Technicznie `main` wdraża mimo czerwonego CI aż do fazy 4 planu testów | Plan (Karol) |

## Scope

**In scope:**

- Vitest, bezpieczniki zestawu db, job `db` w CI;
- testy ról (H1–H3, H6–H8, G1–G3);
- tabela par nicków, długość, pusty nick;
- 4 kroki smoke;
- cookbook §6, `AGENTS.md`, `README.md`, roadmapa S-02;
- scalenie i smoke na produkcji.

**Out of scope:**

- naprawa F1/F4 i jakakolwiek trwała migracja;
- przejścia etapów gry i kategorie (faza 2);
- pary zależne od decyzji o emotkach;
- formy zgodności i liczenie emotek do limitu;
- „< 30 s z telefonu” i iOS (ręcznie);
- Docker, pgTAP, Stryker, hermetyczne stuby;
- blokada wdrożenia przy czerwonym CI (faza 4).

## Architecture / Approach

Testy bazy tworzą własnych klientów supabase-js z `TEST_SUPABASE_URL`/`TEST_SUPABASE_KEY`. Gość to klient bez sesji, host to klient po `signUp` (lokalnie bez potwierdzania maila). Seedowanie idzie prawdziwymi drzwiami: `create_room` jako host, `join_room` jako gość. Odmowę sprawdzamy kodem `42501` albo skutkiem, czyli ponownym odczytem przez właściciela, a każdy plik ma kontrolę pozytywną.

Znane dziury mają warunki wstępne w hookach, atak bez rzucania błędów i asercję z wyroczni jako jedyne miejsce porażki. To dlatego, że `test.fails` odwraca każdy błąd. Każda faza kończy się pushem gałęzi `testing-lobby-foundation` i zielonym CI w szkicu PR.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Runner i potok testów | Vitest, bezpieczniki, unit, kanarek bazy, job `db` w CI | Bezpiecznik albo zmienne źle ustawione, przez co testy biegną nie tam albo „przechodzą” bez bazy |
| 2. Role (#4) | Strażnicy ról, znane dziury F1, próbny alarm | Asercja „brak błędu” przy cichym RLS; próbny alarm zostawiony na gałęzi |
| 3. Nicki i wejście gościa (#6) | 23 wiersze par, długość, pusty nick, 4 kroki smoke | Niewidoczne znaki zgubione w źródle; niestabilny bardzo długi nick |
| 4. Cookbook, reguły i scalenie | Cookbook §6, reguły w `AGENTS.md`, roadmapa S-02, `main` i smoke na produkcji | Scalenie = wdrożenie; tekst reguł do akceptacji Karola |

**Prerequisites:** Karol jest przy oknie uprawnień przy pushach gałęzi i odpowiada w czacie przy otwarciu PR, scaleniu i smoke na produkcji. `gh` jest zalogowany. Supabase na produkcji nie śpi przed smoke (ruch ostatnio 08.10, ryzyko uśpienia ok. 11.10 i później).
**Estimated effort:** około 3–4 sesji (faza 1 ok. 1, faza 2 ok. 1, faza 3 ok. 1, faza 4 ok. 0,5), w tym 6–8 rund CI po ok. 3 min.

## Open Risks & Assumptions

- Zakładamy, że błąd w `beforeAll` nie jest odwracany przez `test.fails`. Faza 1 sprawdza to wprost; jeśli jest odwracany, trzeba zmienić wzór warunków wstępnych.
- Bardzo długi nick (10 000 znaków) może dziś trafić w limit czasu instrukcji dla `anon`. Stale czerwony oznacza znaną dziurę F4, a niestabilny to stop i pytanie.
- Limit 30 rejestracji/logowań na 5 min (`supabase/config.toml:194`) ogranicza liczbę kont hostów na przebieg do około 10.
- Poprawka F1 w S-02 zepsuje helper seedowania (`p_link_token`). To oczekiwane, helper zmienia się razem z kontraktem.
- Do fazy 4 planu testów czerwone CI na `main` nadal nie zatrzymuje wdrożenia. Chroni tylko reguła PR w `AGENTS.md`.

## Success Criteria (Summary)

- Zepsucie uprawnienia albo reguły nicku w przyszłej migracji zapala CI na czerwono, co pokazał próbny alarm.
- Naprawa F1/F4 w S-02 zmusza do zdjęcia znacznika znanej dziury, więc nie da się jej przemilczeć.
- Kolejny agent dodaje test według cookbooka §6 bez zgadywania, gdzie i jak.
