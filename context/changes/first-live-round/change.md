---
change_id: first-live-round
title: Pierwsza runda na żywo (S-02) z testami anonimowości i reguł rundy (faza 2)
status: implemented
created: 2026-10-13
updated: 2026-10-15
archived_at: null
---

## Notes

Wspólny folder roadmapy S-02 (`context/foundation/roadmap.md`) i fazy 2 planu testów (`context/foundation/test-plan.md` §3: „Anonimowość i reguły rundy”).

- **S-02 Outcome:** host klika „start”; wszyscy widzą to samo pytanie z wybranych kategorii (18+ tylko tam, gdzie host je dołączył), każdy wskazuje jedną osobę z listy (także siebie) albo się wstrzymuje, wszyscy widzą, kto już zagłosował, a po ostatnim głosie albo przewinięciu przez prowadzącego widzą odsłonę: ile głosów dostała każda osoba. PRD: US-01, FR-006, FR-007, FR-008, FR-009, FR-015.
- **Faza 2 test-planu:** ryzyka #1 i #3, unit + integration (DB). Testy powstają przed kodem głosowania.
  - #1: po rundzie żadna rola (gość, host, twórca gry) i żaden kanał (baza, odpowiedź serwera, zdarzenie na żywo, log) nie pozwala połączyć głosującego z osobą, na którą głosował; para może wyciec kolejnością zapisów, znacznikami czasu, logiem albo zestawieniem „kto już zagłosował” z liczbami w trakcie rundy.
  - #3: jeden głos na gracza na rundę (także po odświeżeniu), głos na siebie i wstrzymanie się dozwolone, głos tylko na osobę z listy, liczby w odsłonie równe oddanym głosom; pytania tylko z wybranych kategorii, 18+ tylko tam, gdzie host je włączył, bez powtórek w grze. Wyrocznia z reguł PRD, nie z implementacji.
- **Kryteria akceptacji z roadmapy:** testy „znana dziura F1 → S-02” (`tests/db/roles.test.ts`) i „znana dziura F4 → S-02” (`tests/db/nicks.test.ts`) przechodzą, znacznik `test.fails` zdjęty. Ta sama migracja: host tylko z dozwolonymi przejściami stanów (dziś bezpośrednie `update (status)` na `rooms`), ogranicznik dzwonka (głos = dzwonek), reguła nicku F4 (selektory wariantu, znaczniki, limit długości przed normalizacją; decyzja o emotkach z FE0F przy tej poprawce).
- **Z audytu** `context/audits/observability/2026-10-11_guest-join-live-lobby.md`: L1 (stany błędu kanału na żywo ignorowane, przy odsłonie łamie 2 s), L3 (null → 404 → przeładowanie), P6 (nowe stany pokoju vs `parseLobby`), G2 (nowe kody odmów bez komunikatu), RC1 (kanał błędów z przeglądarki do logów: decyzja projektowa, nowa publiczna droga dla ryzyk #1 i #7).
- **Decyzje z recenzją** (adwokat diabła + krytyk, potem tabela ścieżek i jedna rekomendacja): m.in. kanał błędów z przeglądarki, przejścia stanów gry.
- **Proces:** zmiany w `supabase/migrations/`, `src/lib/rooms/`, `src/pages/api/rooms/`, `src/pages/j/`, `src/pages/r/`, `tests/` i CI tylko przez PR na zielonym CI (z jobem `db`); scala Karol (`! gh pr merge <n> --merge`). Przy tym PR poprawić gołe odwołania „research.md §…” w `tests/db/*` i `roadmap.md:173`.
