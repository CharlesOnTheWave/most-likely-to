# Poprawki z przeglądu implementacji (question-list-review)

Źródło: `reviews/impl-review.md` (24.10.2026). Decyzja Karola: F2 i F3 na S-13, F1, F4 i F5 pominięte.

## F2: klucz obcy `rounds.list_position` bez kaskady

- **Kiedy**: przy planowaniu S-13 (sprzątanie starych gier).
- **Co**: `private.rounds.list_position` wskazuje `private.game_questions (room_id, position)` bez `on delete`
  (`supabase/migrations/20261024094002_question_list_review.sql:77-78`). Dziś usunięcie pokoju albo konta kasuje obie
  tabele jednym poleceniem, więc działa. Sprzątanie, które usunie same wiersze `game_questions`, padnie na 23503.
- **Zrób**: w S-13 przypadek pgTAP, który usuwa pokój z rundą zagraną z listy; jeśli S-13 usuwa wiersze listy osobno,
  najpierw rundy albo nowa migracja z `on delete cascade`.

## F3: własne pytania zostają w bazie bez terminu

- **Kiedy**: przy planowaniu S-13.
- **Co**: lista pytań gry zostaje po „Nowa gra” (decyzja planu dla S-11 i FR-021), poza godzinnym sprzątaniem 12 h.
  Własne albo poprawione pytanie może zawierać imię gościa („Kuba spóźniłby się…”).
- **Zrób**: objąć `private.game_questions` (kolumna `text`) zakresem przechowywania i usuwania S-13, zgodnie z FR-019.

## Przy `/10x-archive question-list-review`, w tym samym PR

- **Co**: 12 komentarzy w kodzie wskazuje `context/changes/question-list-review/`. Zmień je na ścieżkę w
  `context/archive/<data>-question-list-review/`: `scripts/smoke.mjs:15, 443`, `src/lib/rooms/shared.ts:21, 63`,
  `src/lib/rounds/draw.ts:86`, `supabase/tests/round_creator_view.test.sql:18`, `tests/db/question-list.test.ts:25`,
  `tests/db/support/rounds.ts:64`, `tests/unit/draw.test.ts:208`, `tests/unit/json-route.test.ts:158`,
  `tests/unit/room-errors.test.ts:26`, `tests/unit/room-state.test.ts:11`.
- **Bez zmian**: nagłówek wypchniętej migracji `20261024094002_question_list_review.sql`.
- **Wzór**: F2 w `context/archive/2026-10-20-deferred-review-fixes/follow-ups/review-fixes.md`.
