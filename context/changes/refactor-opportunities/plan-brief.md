# Strażnicy bramy RPC i anonimowości w przeglądarce — Plan Brief

> Full plan: `context/changes/refactor-opportunities/plan.md`
> Research: `context/changes/refactor-opportunities/research.md`

## What & Why

Dwa strażniki zamiast przebudowy. **K1:** test, który pilnuje, z jaką nazwą funkcji bazy i jakimi argumentami Worker
woła bazę dla każdej akcji gry, plus krok smoke, który pierwszy raz prowadzi „Odsłoń wynik” przez Workera do prawdziwej
bazy. **D7:** reguła ESLint, która nie pozwala zapisać niczego w przeglądarce poza istniejącym znacznikiem
przeładowania, czyli mechaniczna osłona zasady „głos nigdzie się nie zapisuje”. Research pokazał, że kopie kontraktu
TS↔SQL są świadome i nośne; brakuje tylko sygnału, gdy się rozjadą.

## Starting Point

Worker woła 10 funkcji bazy przez `callRpc` (`src/lib/rooms/server.ts:82-98`) z nazwami i kluczami `p_*` jako
napisami; żaden test nie importuje `server.ts`, a ścieżki „Odsłoń wynik” przez Workera nie woła żaden test CI. W
przeglądarce gra zapisuje tylko znacznik przeładowania (`useRoomState.ts:99,100,110`), bez danych głosu, i nic tego
nie pilnuje.

## Desired End State

Literówka w nazwie funkcji, zgubiony parametr albo wartość podana do złego parametru świeci na czerwono lokalnie, w
hooku agenta i w CI. „Odsłoń wynik” przechodzi przez Workera w każdym smoke (54 kroki). Każdy nowy zapis w przeglądarce w
`src`, także w pliku ze znacznikiem, daje błąd lintu w chwili edycji (poza skryptami `<script>` w `.astro`, które lint
dziś pomija). Gra działa dokładnie jak dziś.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Opcja z rankingu | K1 + tani zysk D7 | K1 łata jedyną potwierdzoną dziurę, D7 kosztuje kilka linii i chroni miejsce, które S-04 może kusić zapamiętaniem głosu | Plan (Karol) |
| Kształt K1 | Strażnik (test), bez przebudowy | Kopie kontraktu są świadome: niezależna wyrocznia, obrona w głąb, kolejność wdrożeń | Research |
| Wyrocznia K1 | Ręczna tabela z sygnatur SQL | Prosta i niezależna od `server.ts` (`test-plan.md` §6.1); zmianę samego SQL łapią db i smoke w CI | Plan |
| Sprawdzenie wartości | Wartości-wartownicy w każdym przypadku | Zamiana dwóch argumentów miejscami też świeci, nie tylko nazwa i klucze | Plan |
| „Odsłoń wynik” w CI | Krok smoke po automatycznej odsłonie | Prawdziwa ścieżka bez zmiany scenariusza; drugie odsłonięcie niczego nie zmienia (SQL `:721`) | Plan (Karol) |
| Wyjątek D7 | Komentarz z powodem przy każdej z 3 linii | Nowy zapis, także w tym samym pliku, świeci; wyjątek widać przy kodzie | Plan (Karol) |
| Mechanizm D7 | ESLint z rdzenia (`no-restricted-globals`, `no-restricted-properties`) | Hooki i CI już go uruchamiają; wzór zakazu jest w `eslint.config.js:94-109` | Plan |
| Wejście D7 | Najpierw ostrzeżenie, potem błąd | Mechanizm przy zielonym lincie, egzekwowanie osobnym, odwracalnym krokiem | Plan (lekcja) |
| Weryfikacja W26 | Reguła nie może być „zero sessionStorage” | Znacznik przeładowania istnieje; bez wyjątku strażnik byłby czerwony od pierwszego dnia | Research |
| Zasięg D7 | `.ts`, `.tsx`, frontmatter `.astro`; skrypty `<script>` w `.astro` poza zasięgiem | Lint ich dziś nie parsuje (cichy błąd parsera); naprawa osobną zmianą, luka zapisana w §6.3 | Przegląd planu (F1) |
| Kolejność faz | Fazy lokalne (test bramy, D7) przed krokiem smoke | Pierwszy push dopiero w ostatniej fazie: jeden push i jeden przebieg CI mniej | Przegląd planu (F2) |
| Wynik w teście bramy | Każdy przypadek sprawdza też `ok: true` | Zła odpowiedź atrapy świeci, zamiast tylko zaśmiecić log | Przegląd planu (F3) |

## Scope

**In scope:**
- `tests/unit/room-rpc-gate.test.ts` (12 przypadków), krok w `scripts/smoke.mjs`
- reguła w `eslint.config.js`, 3 komentarze wyjątku w `src/components/room/useRoomState.ts`
- po jednym punkcie w `context/foundation/test-plan.md` §6.1, §6.3, §6.5

**Out of scope:**
- K3, K2, K4, K5, wygenerowane typy bazy, porównanie tabeli z tekstem migracji
- testy gałęzi awarii `server.ts` (P6), poprawka komentarza `server.ts:7-9` (P17)
- przebudowa rundy w smoke, P12 i P13 (decyzje S-04)
- migracje, `db push`, zmiany w `tests/db`, `tests/e2e`, `AGENTS.md`
- naprawa lintowania skryptów `<script>` w `.astro`

## Architecture / Approach

Atrapa klienta Supabase (`{ rpc(fn, args) }`) zapisuje wywołania 10 funkcji opakowujących z `server.ts`; test porównuje
je z ręczną tabelą sygnatur SQL. Smoke woła trasę `/api/rooms/<id>/reveal` jak ekran pokoju. Reguła ESLint obejmuje
`.ts`, `.tsx` i frontmatter `.astro` w `src`; skryptów `<script>` w `.astro` lint dziś nie widzi (znana luka). Jedna
gałąź, jeden PR, cztery commity faz; fazy 1–3 lokalnie, pierwszy push w fazie 4; push i scalenie tylko przez Karola.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Test bramy RPC (K1) | lokalny sygnał dla nazw, argumentów i wartości 10 akcji | zła odpowiedź atrapy (test sprawdza `ok: true`, więc świeci) |
| 2. Reguła D7 jako ostrzeżenie | mechanizm, dokładnie 3 ostrzeżenia, lint zielony | hooki lintu (`--quiet`) nie widzą ostrzeżeń, tylko `npx eslint src` |
| 3. Reguła D7 jako błąd | egzekwowanie z wyjątkiem przy 3 liniach | dotyka pliku gry (same komentarze) |
| 4. Krok smoke „Odsłoń wynik” (K1) | prawdziwa ścieżka Worker → baza w CI i na produkcji; pierwszy push i PR | próbny alarm w CI wymaga push gałęzi i revertu |

**Prerequisites:** research zweryfikowany (`eb0cb60`); `main` lokalnie ahead 2 bez push; zgoda Karola na push gałęzi.
**Estimated effort:** jedna sesja na 4 fazy plus czas CI (dwa przebiegi przy próbnym alarmie z fazy 2).

## Open Risks & Assumptions

- Tabela w teście bramy to ręczna kopia sygnatur: zmiana samego SQL nie zapali testu unit, tylko testy db i smoke w CI.
- Krok smoke sprawdza drugie odsłonięcie, nie odsłonę przed ostatnim głosem; to dalej pilnują testy bazy.
- Nowa potrzeba zapisu w przeglądarce (np. S-04) wymaga świadomej decyzji właściciela i nowego wyjątku z powodem.
- Skryptów `<script>` w `.astro` dziś nie sprawdza żadna reguła lintu (przegląd planu, F1); D7 ich nie pilnuje do czasu
  osobnej naprawy.

## Success Criteria (Summary)

- Literówka w `"reveal_round"` w `server.ts` świeci lokalnie (unit) i w CI (unit + smoke); zamiana argumentów też.
- `localStorage`, `document.cookie` albo nowe `sessionStorage` w `src` (`.ts`, `.tsx`, frontmatter `.astro`) dają błąd
  lintu w chwili edycji.
- CI PR zielone we wszystkich jobach, a gra po wdrożeniu działa jak dziś (smoke 54/54 na produkcji).
