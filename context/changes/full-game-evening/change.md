---
change_id: full-game-evening
title: Pełny wieczór (S-03): kolejne pytania, pominięcie rundy i koniec gry
status: impl_reviewed
created: 2026-10-15
updated: 2026-10-15
archived_at: null
---

## Notes

Folder roadmapy S-03 (`context/foundation/roadmap.md`).

- **S-03 Outcome:** prowadzący przechodzi do kolejnego pytania (bez powtórek w tej grze), może pominąć rundę (jej głosy przepadają i nie liczą się do jakości pytania) i kończy grę po potwierdzeniu; po ostatnim pytaniu ekipa widzi koniec wieczoru bez punktacji. PRD: FR-006, FR-015 (bez powtórek w grze; „bez pytań z ostatnich wieczorów hosta” to S-12), kryterium sukcesu „co najmniej 10 pytań w jednym wieczorze”.
- **Stan po S-02:** gra kończy się na odsłonie jednej rundy („Nowa gra” zamyka pokój); `close_stale_games` zamyka gry rozpoczęte ponad 12 h temu. Archiwum: `context/archive/2026-10-13-first-live-round/`.
- **Follow-upy z przeglądu S-02** (`context/archive/2026-10-13-first-live-round/follow-ups/review-fixes.md`):
  - F4 (granica błędów w `RoomScreen`, zgłoszenie `island_crash`) i F6 (`Content-Length` przed `request.text()` w `src/lib/rooms/json-route.ts`): w zakresie S-03, bo S-03 i tak zmienia te pliki;
  - F7 (czytnik ekranu: TalkBack albo VoiceOver): w ręcznej rundzie S-03.
- **Stare ścieżki:** komentarze w `src/`, `tests/`, `scripts/smoke.mjs` i `supabase/tests/` wskazują na `context/changes/first-live-round/`; poprawić w PR S-03 na `context/archive/2026-10-13-first-live-round/`. Wgranych migracji nie ruszamy.
- **Do rozstrzygnięcia w researchu:** ile pytań ma gra i co znaczy „ostatnie pytanie” (lista losowana na starcie czy losowanie na bieżąco); co, gdy w wybranych kategoriach skończą się pytania (Open Roadmap Question 5); kiedy wolno pominąć rundę (w trakcie głosowania, po odsłonie); czy faza 3 planu testów (ryzyka #2 i #7: ta sama odsłona i nowa runda na każdym ekranie, limit żądań) idzie razem z S-03, tak jak faza 2 szła z S-02.
- **Twarde zasady:** pominięta i porzucona runda nie zostawia urny ani pary „kto na kogo” (ryzyko #1, AGENTS.md Hard Rules); zmiany w `supabase/migrations/`, `src/lib/rooms/`, `src/pages/api/rooms/`, `tests/` tylko przez PR na zielonym CI.
