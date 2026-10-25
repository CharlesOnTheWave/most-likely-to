---
change_id: game-summary
title: Podsumowanie wieczoru na ekranie końca gry
status: implementing
created: 2026-10-25
updated: 2026-10-25
archived_at: null
---

## Notes

S-15 (FR-022, zdjęte z Parked 2026-10-25, PRD bez zmian): gdy gra się kończy, wszyscy gracze na ekranie „Koniec wieczoru” widzą kilka wyróżnień z tej gry, np. „najwięcej głosów dziś” i „nikt dziś nie głosował na X”. Bez punktów, miejsc i porównań z innymi wieczorami (PRD §Non-Goals). Liczone wyłącznie z odsłon, które ekipa już widziała, nigdy z par „kto na kogo”.

Faza 1 (2026-10-25): krok ręczny 1.4 (czytanie diffu migracji przez Karola) pominięty za jego zgodą; zastępują go dokładne zbiory kluczy w `tests/db/game-summary.test.ts` i próbny alarm w CI (`82065d3`, cofnięty w `a4fb439`): czerwone dokładnie 8 przewidzianych przypadków tego pliku, reszta CI zielona.
