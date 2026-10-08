---
change_id: one-click-host-login
title: One click host login
status: impl_reviewed
created: 2026-10-04
updated: 2026-10-08
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- **Roadmapa S-05** (`context/foundation/roadmap.md`): host loguje się jednym kliknięciem przez zewnętrznego dostawcę, bez rejestracji i hasła; ten sam e-mail = ten sam host także przy zapasowej drodze logowania (PRD FR-001). Status `blocked`: Karol wybiera dostawców i drogę zapasową (drugi dostawca czy e-mail); logowanie linkiem z e-maila wymaga własnej skrzynki nadawczej.
- **Przeniesione z `context/archive/2026-10-04-ui-signin-contract/change.md`** (noty na S-05 z krytyki zrzutów R8 i przeglądu implementacji F3, F6): rejestracja jest hybrydą (polskie komunikaty serwera w angielskim formularzu, nieprzezroczysty `Alert` na `bg-cosmic`); przy S-05 spolszczyć albo usunąć rejestrację i przenieść obudowę na `Card` jak `SignInCard.astro`; fokus na pierwszym błędnym polu; czytnik ekranu ma usłyszeć błąd serwera po przeładowaniu, a błąd pola tylko raz.
- **M2L6:** S-05 ma iść równolegle z S-01 (room-lobby) w osobnych worktree. Styk do sprawdzenia: S-01 przekierowuje zalogowanego hosta z `/auth/*` (D2 z ui-signin-contract), S-05 wymienia logowanie; obie zmiany ruszają Supabase, który jest wspólny z produkcją.
- **Decyzja 2026-10-06 (opcja C):** Discord + Google teraz, „Confirm email” ON, logowanie hasłem zostaje dla istniejących kont, rejestracja znika z UI; rejestracja z hasłem ewentualnie później jako osobna zmiana z własną skrzynką nadawczą. Szczegóły: `research.md`, sekcja „Decyzja”.
- **Wywiad `/10x-plan` 2026-10-06 (przerwany na koniec sesji):**
  - Decyzje i proponowane fazy są w `research.md`, w sekcjach „Decyzje z wywiadu `/10x-plan`” i „Proponowane fazy”. `plan.md` jeszcze nie istnieje.
  - Start następnej sesji: Karol zakłada Gmail gry i zatwierdza fazy, potem zapis planu.
  - Przed założeniem worktree (M2L6) dokumenty tej zmiany muszą trafić do commita na `main`, bo inaczej kopie ich nie zobaczą.
- **Plan 2026-10-07:** fazy zatwierdzone, `plan.md` i `plan-brief.md` zapisane. Faza 1 idzie na `main` przed założeniem worktree, fazy 2–4 w worktree S-05.
- **Plan-review 2026-10-07** (`reviews/plan-review.md`): REVISE → SOUND, 0 krytycznych, 4 ostrzeżenia, 3 obserwacje; Karol: „zgoda” na wszystkie rekomendacje. Najważniejsze: faza 1 kończy się pushem za zgodą, zielonym CI i smoke na produkcji przed założeniem worktree (F1); fokus na komunikacie błędu dla czytnika ekranu w fazie 3 (F2).
- **Faza 1 2026-10-07:** commit `bc5867c`, push za zgodą Karola, CI zielone, smoke na produkcji 7/7 na koncie testowym. W Supabase: Confirm email ON, 2 konta (Karol, `smoke-host@example.com`), Site URL i Redirect URLs ustawione.
- **Decyzja 2026-10-07 (konto hosta):** Discord i Google Karola są na innych adresach niż jego konto z hasłem (adres z pracy). Od fazy 2 Karol gra jako host przez Discorda; konto z hasłem zostaje na zapas do końca fazy 4, potem usunięte (adres z pracy znika z gry). Test „ten sam e-mail = to samo konto” (2.7) robimy na Gmailu gry. Gmail gry jeszcze nie założony; potrzebny przed fazą 2.
- **Adaptacja 2026-10-07 wieczór (faza 2):** Gmaila gry nie będzie, Google odrzuciło konto. Projekt Google na prywatnym koncie Karola, e-mail wsparcia na ekranie zgody to grupa Google z tego konta z ukrytą listą członków, test 2.7 na prywatnym Gmailu. Szczegóły w `plan.md`, Overview fazy 2. S-01 idzie równolegle na tym samym koncie testowym, więc smoke tylko po pytaniu Karola, czy tamten akurat nie leci.
- **Faza 2 2026-10-07:** commit `71d2d9b` (bez pusha). Grupa Google gry przyjęta przez konsolę jako e-mail wsparcia, Authorized domains niepotrzebne. Smoke lokalny 14/14 z `SMOKE_OAUTH=1`. Karol przeszedł 2.5–2.8: oba logowania na `localhost:4321`, `127.0.0.1:4321` i `localhost:4322`, anulowanie po polsku, Google dołączyło się do konta z hasłem na prywatnym Gmailu, wylogowanie lokalne. Konto z Discorda Karola to osobne konto (inny adres).
- **Nota na fazę 3 (smoke):** oczekiwanie `location: "/"` przechodzi dla każdego adresu zaczynającego się od `/`. Przy sprawdzianie zepsucia „signin accepts correct password” dało PASS przy `/auth/signin?error=invalid_credentials`, a run złapał to dopiero przez krok z `/dashboard`. Błąd był przed S-05. Poprawić przy kroku smoke z fazy 3: `/` ma pasować dokładnie.
- **Decyzja 2026-10-07 (faza 3, ocena zrzutów):** komunikat błędu jest pod przyciskami dostawców. Formularz z hasłem zostaje na ekranie także po S-05. Karol: „to logowanie zwykłe zostawiamy”, więc nie proponować jego usunięcia.
- **Przyjęte w fazie 2 (z raportu implementacji):** start Discorda, potem Google i powrót z Discorda daje „Logowanie wygasło albo się urwało” (stały klucz weryfikatora PKCE). Callback loguje `error` i `error_code` z adresu tak, jak przyszły: to tekst od dowolnej osoby, ale bez danych hosta.
- **Faza 4 2026-10-08:** PR #2, CI zielone, scalenie za zgodą Karola (merge commit `1a40af4` na `main`, SHA faz zachowane), Workers Builds `main` OK, smoke na produkcji z `SMOKE_OAUTH=1` 15/15, kitchen sink 404. Karol zalogował się na produkcji Discordem i Google na laptopie i na Androidzie, także z linku w Discordzie (Discord otwiera linki w Chrome Custom Tab, Google nie blokuje). Logowanie po ponad 300 s kończy się polskim komunikatem. iOS niesprawdzony (brak iPhone'a), podpowiedź o Chrome/Safari: nie dotyczy (`phone-test.md`). Konto z adresem z pracy usunięte, zostały 3 konta. Buildy gałęzi w Workers Builds padają na `wrangler preview` bez `id` KV `SESSION` (opis i decyzja do podjęcia w `deploy-plan.md`, Etap 6); produkcji to nie dotyczy.
- **Przegląd implementacji (08.10, po wdrożeniu, przed archiwum):**
  - wynik: APPROVED, 6 obserwacji (`reviews/impl-review.md`); plan wykonany w całości, odstępstwa to udokumentowane decyzje Karola;
  - poprawione (decyzja Karola): ciasteczka sesji i PKCE z `HttpOnly`; smoke sprawdza ciasteczko PKCE, które czyta callback; callback przepuszcza tylko krótkie kody; nowy komunikat `email_not_confirmed`; rejestracja przez API Supabase opisana jako przyjęte ryzyko w `deploy-plan.md`;
  - błąd `signOut` przyjęty jako ryzyko, a zdublowana lista dostawców pominięta.
