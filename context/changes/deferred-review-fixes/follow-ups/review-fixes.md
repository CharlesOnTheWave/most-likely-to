# Poprawki z przeglądu implementacji (deferred-review-fixes)

Źródło: `reviews/impl-review.md` (21.10.2026).

## F2: ścieżki do folderu zmiany w kodzie po archiwizacji

- **Kiedy**: przy `/10x-archive deferred-review-fixes`, w tym samym PR.
- **Co**: sześć komentarzy wskazuje `context/changes/deferred-review-fixes/plan.md`. Zmień je na ścieżkę w
  `context/archive/<data>-deferred-review-fixes/`:
  - `src/pages/api/rooms/[id]/reveal.ts:12`;
  - `tests/db/game-rules.test.ts:28`;
  - `tests/unit/json-route.test.ts:97`;
  - `tests/unit/room-errors.test.ts:20`;
  - `scripts/smoke.mjs:268`;
  - `scripts/smoke.mjs:319`.
- **Bez zmian**: nagłówek wypchniętej migracji `20261020205751_round_number_required.sql`, bo wypchniętych migracji
  nie edytujemy.
- **Wzór**: commit `519bf3f`, który po archiwizacji full-game-evening poprawił 26 takich linii.
