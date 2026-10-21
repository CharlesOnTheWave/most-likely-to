---
change_id: deferred-review-fixes
title: Deferred review fixes before the first real game evening
status: implemented
created: 2026-10-20
updated: 2026-10-21
archived_at: null
---

## Notes

Odłożone poprawki z przeglądów, jeden PR.

- F2: numer pytania obowiązkowy przy głosie (`cast_vote` bez `default null`) i przy „Odsłoń wynik” (`reveal_round` z `p_round`, stary numer → `round_over`). Okno wdrożenia S-03 (15.10) już minęło. Test `tests/db/game-rules.test.ts:154` dziś utrwala dziurę wbrew `test-plan.md:173`. To też niezmiennik #1 z `context/domain/02-invariant-aggregate-refactor.md` (N3): weź z niego przypadki testowe, ale bez całego agregatu.
- F4: granica błędów w ekranie pokoju (napis „Coś się popsuło — odśwież” + zgłoszenie `island_crash`), stan na `/dev/room-states`.
- F5: osobny kod i tekst, gdy pytania skończą się w trakcie gry.
- F3 (tania przy tej samej migracji): limit długości listy kandydatów + test filtra formatu id.
- Źródła (archiwum tylko do odczytu): `context/archive/2026-10-15-full-game-evening/follow-ups/review-fixes.md` (F2, F3, F5), `context/archive/2026-10-13-first-live-round/follow-ups/review-fixes.md` (F4; F6 i F7 zostają na później).
