---
change_id: room-lobby
title: Room lobby
status: implementing
created: 2026-10-07
updated: 2026-10-08
archived_at: null
---

## Notes

- **Roadmapa S-01** (`context/foundation/roadmap.md`): host tworzy pokój, wybiera kategorie (przy każdej osobno decyduje o pytaniach 18+) i dostaje link na Discorda; gość otwiera link na telefonie, wpisuje nick (zajęty jest odrzucany) i trafia do pokoju; host widzi dołączających na żywo. PRD: US-01, FR-002, FR-005. F-01 (technika na żywo) i F-02 (baza pytań) są `done`.
- **M2L6:** S-01 idzie równolegle z S-05 (`one-click-host-login`) w osobnych worktree. Przed założeniem worktree: research i plan S-01 na `main`, sprawdzenie styku, commit dokumentów i push za zgodą Karola (plan-review S-05, F1).
- **Styk z S-05 do sprawdzenia:** S-05 zmienia `/auth/signin`, `src/pages/api/auth/*` (nowe `oauth.ts`, `callback.ts` → przekierowanie na `/`), `auth-errors.ts`, `scripts/smoke.mjs`, `/dev/ui-kitchen-sink`, usuwa rejestrację (`/auth/signup` → 302 na `/auth/signin`). S-05 nie rusza `src/middleware.ts`, `Topbar.astro`, `Welcome.astro`, `dashboard.astro` ani strony `/` po zalogowaniu; to należy do S-01 (D2 z `context/archive/2026-10-04-ui-signin-contract/research.md:106`: przekierowanie zalogowanego z `/auth/*`, strona główna hosta).
- **Środowisko:** jeden projekt Supabase dla dev i produkcji, więc migracje S-01 zmieniają bazę produkcyjną (ask). Smoke loguje się kontem testowym z `.dev.vars` (S-05 faza 1, `bc5867c`); worktree potrzebuje kopii `.dev.vars`, a drugi serwer działa na porcie 4322. `context/foundation/lessons.md`: pytania gry tylko po stronie serwera.
- **Plan (07.10):** `/10x-plan` z wywiadem (5 pytań o grę, 4 decyzje techniczne po recenzji adwokata diabła i krytyka), 5 faz. `/10x-plan-review`: REVISE → SOUND, 0 krytycznych, 4 ostrzeżenia, 2 obserwacje, wszystkie poprawione (Karol: „zgoda”). Najważniejsze: migracja najpierw w CI na szkicu PR (Karol nie ma Dockera), `/10x-impl-review` przed scaleniem, `seat` zamiast `joined_at` (`reviews/plan-review.md`).
- **Do fazy 4 (ocena ekranów):** `AppHeader` pokazuje zalogowanemu hostowi jego e-mail. Gracze go nie widzą, ale przy udostępnianiu ekranu na Discordzie byłby widoczny (Karol nie chce swoich danych u graczy). Decyzja Karola na zrzutach: ukryć albo zostawić.
- **Faza 4 (08.10), ocena zrzutów:** Karol: „Nie mam zastrzeżeń, wszystko gra” na 25 stanów `/dev/room-states` i wszystkie rekomendacje. E: e-mail w nagłówku ukryty, zostaje samo „Wyloguj” (`AppHeader` ma prop `signedIn` tylko dla strony stanów). P1: tytuł ostrzeżenia o zamknięciu pokoju się zawija (`line-clamp-none`; na telefonie ucinało „zamknięty”). P2: nazwa gry w nagłówku w jednej linii. P3: `nick_taken` bez męskiej formy, „np. link otwarty w innej przeglądarce” (plan miał „otworzyłeś”). Do strony stanów wydzielone `RoomMessage`, `RoomCard`, `OpenRoomNotice`; `Landing` i `RoomLobby` (w preview) mają nagłówek `h2`.
- **Po rebase na S-05 (faza 5):** S-05 ustalił, że czytnik ekranu zwykle nie ogłasza `role="alert"`, który jest w HTML od początku (błąd po przekierowaniu). Dlatego `ServerError` dostaje `tabIndex={-1}` i `data-server-error`, a skrypt w `SignInCard.astro` przenosi na niego fokus po załadowaniu. Nasze `/?error=` i `/j/<kod>?error=` (`RoomCard`) potrzebują tego samego skryptu, inaczej „nick zajęty” nie zostanie przeczytany. S-05 zdejmuje też `role="alert"` z błędu pola w `FormField.tsx` (fokus i tak trafia na pole). Po rozwiązaniu konfliktów sprawdzić oba na `/dev/room-states` i na prawdziwym `?error=`.
