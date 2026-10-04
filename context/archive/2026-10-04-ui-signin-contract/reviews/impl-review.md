<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Kontrakt UI na ekranie logowania

- **Plan**: context/changes/ui-signin-contract/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Grounding

- Zakres: 7 commitów `bb90b7f..35b4479`, 30 plików poza `context/` (9 nowych klocków w `src/components/ui`, 8 plików w `src/components/auth`, API, strony, `global.css`, `Layout.astro`, `AGENTS.md`, `scripts/ui-literals.mjs`). Wszystkie pliki z planu są w diffie. Dwa pliki spoza planu (`SignInCard.astro`, `useSubmitPending.ts`) są opisane w `ui-checks.md`.
- Odstępstwa od planu: wszystkie udokumentowane (`ui-checks.md`: „Krytyka zrzutów”, „Odstępstwa od planu” fazy 4 i 5; `theme.md`: „Wybór”) i zatwierdzone przez Karola w trakcie faz, więc traktuję je jak aneks do planu. Granice „What We're NOT Doing” zachowane (obudowa rejestracji, ekrany startera, `bg-cosmic`, `Banner.astro`, brak czcionek, cieni i nowych zależności poza `radix-ui`).
- Wzorzec w `scripts/ui-literals.mjs` jest identyczny ze skillem `/10x-ui` (porównane skryptem).
- Kryteria automatyczne uruchomione ponownie 2026-10-04: `npm run lint` (w tym `ui-literals: 0 literals in 10 view files`), `npx astro check` (0/0/0), `npm run build` przechodzą; grep: `"use client"` 0, `useFormStatus` 0, `bg-cosmic` w `signin.astro` 0, `button.tsx` bez zmian; mapa błędów: 13 znanych kodów, 6 obcych (w tym `__proto__`, `toString`, `constructor`) i `null`; serwer deweloperski: `<html lang="pl" class="dark">`, `/dev/ui-kitchen-sink` 200, pusty formularz → `missing_fields`, złe hasło → `invalid_credentials`, obcy `?error=` na logowaniu i rejestracji → komunikat ogólny; `npm run preview`: `/dev/ui-kitchen-sink` 404 z pustą treścią, `/auth/signin` 200. Smoke (4.6) nie powtarzany (zakłada konto w Supabase); idzie na produkcji po push.
- Kryteria ręczne: wszystkie `[x]` mają dowody w `ui-checks.md` i zrzutach w `screens/`.

## Findings

### F1 — API logowania i rejestracji daje 500 na żądanie bez formularza

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signin.ts:7, src/pages/api/auth/signup.ts:7
- **Detail**: `await context.request.formData()` bez zabezpieczenia. `POST` z treścią JSON albo bez `Content-Type` rzuca `TypeError` i kończy się 500 (odtworzone na serwerze deweloperskim: oba endpointy 500, w logu „FormData can only parse…” i „Parsing a Body as FormData requires a Content-Type header”). `checkOrigin` Astro sprawdza tylko typy formularzy, więc takie żądanie dochodzi do handlera. Błąd był przed zmianą, ale zmiana utwardzała właśnie tę granicę („post without JS … lands here as is”). Sąsiedni endpoint `src/pages/api/live-sync/ring.ts:12` używa `.catch(() => null)`.
- **Fix**: `const form = await context.request.formData().catch(() => null);` i `null` traktowane jak puste pola (`missing_fields`), w obu plikach.
- **Decision**: FIXED — `formData().catch(() => null)` w obu plikach (Karol: „zgoda”)

### F2 — Link „Załóż je” traci fokus w trybie wysokiego kontrastu Windows

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/auth/SignInCard.astro:27
- **Detail**: Poprawka R2 dała linkowi `outline-none` i fokus jako `ring` (cień). Tryb wymuszonych kolorów usuwa cienie, a `outline-none` w Tailwind 4.3 to samo `outline-style: none`, więc link nie ma tam żadnego fokusu. Przed zmianą miał natywny obrys. Plan godził się na brak fokusu w tym trybie tylko w klockach shadcn (`src/components/ui`), nie w nowym kodzie. `outline-hidden` w Tailwind 4.3 dokłada w `@media (forced-colors: active)` obrys `2px solid transparent`, który system rysuje widocznym kolorem.
- **Fix**: `outline-none` → `outline-hidden` w klasie linku.
- **Decision**: FIXED — `outline-hidden` (Karol: „zgoda”)

### F3 — Czytnik ekranu: błąd serwera może nie zostać odczytany, błąd pola czytany dwa razy

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/auth/ServerError.tsx:12, src/components/auth/FormField.tsx:34, src/components/ui/field.tsx:203
- **Detail**: (a) Komunikat serwera („Nieprawidłowy e-mail lub hasło.”) jest w HTML od razu po przeładowaniu, w `role="alert"`. Większość czytników nie ogłasza regionów `alert` obecnych przy ładowaniu strony, a fokus na niego nie trafia i żadne pole go nie wskazuje. (b) `FieldError` ma `role="alert"`, a to samo pole jest w `aria-describedby` pola, na które `SignInForm` przenosi fokus, więc pierwszy błąd słychać dwa razy.
- **Fix**: Pominąć teraz i zrobić przy S-05 (logowanie jednym kliknięciem z FR-001 zastąpi ten formularz), dopisując notę do `change.md`.
  - Strength: nie szlifujemy formularza hasła, który S-05 wymieni; plan już mówi „nie szlifujemy elementów specyficznych dla hasła ponad macierz stanów”.
  - Tradeoff: do S-05 osoba z czytnikiem ekranu po złym haśle może nie usłyszeć powodu.
  - Confidence: MED — zachowanie czytników przy `alert` z ładowania strony różni się między NVDA, JAWS i VoiceOver; nie sprawdzone czytnikiem.
  - Blind spot: nie wiemy, czy którykolwiek host gry używa czytnika ekranu.
- **Decision**: SKIPPED — do S-05, nota w `change.md` (Karol: „zgoda”)

### F4 — Przycisk zostaje zablokowany po „Stop” lub Esc w trakcie logowania

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/auth/useSubmitPending.ts:8-16, src/components/auth/SignInForm.tsx:70
- **Detail**: `pending` zeruje tylko `pageshow` z `persisted` (powrót „Wstecz”). Gdy ktoś przerwie wysyłanie (Esc, „Stop”), strona zostaje, a przycisk „Logowanie…” zostaje zablokowany; pomaga tylko przeładowanie. Nie ma zdarzenia przeglądarki „nawigacja przerwana”, więc jedyna poprawka to limit czasu.
- **Fix**: Pominąć (rzadki przypadek, przeładowanie naprawia, S-05 zmienia logowanie).
- **Decision**: SKIPPED (Karol: „zgoda”)

### F5 — Skan literałów ma dziury względem reguły w AGENTS.md

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/ui-literals.mjs:7-15
- **Detail**: Wzorzec (identyczny ze skillem `/10x-ui`, jak chciał plan) nie łapie m.in. `border-t-red-500`, `ring-offset-blue-500`, `placeholder-…`, wartości arbitralnych innych niż liczba z `px`/`rem` (`w-[37%]`, `bg-[var(--x)]`), `color-mix(`, `oklab(`. Reguła w `AGENTS.md` zabrania wszystkich wartości arbitralnych, więc skan jest węższy niż reguła. Sprawdzian świeżą sesją przeszedł (agent sam sięgnął po klocek).
- **Fix**: Pominąć (wzorzec świadomie skopiowany z kursu; reguła w AGENTS.md prowadzi agenta, skan to siatka na typowe wpadki).
- **Decision**: SKIPPED (Karol: „zgoda”)

### F6 — Ekrany wciąż po angielsku czytane jako polskie; rejestracja mieszana

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/layouts/Layout.astro:14, src/components/auth/SignUpForm.tsx:54-60
- **Detail**: `lang="pl"` obejmuje też angielskie ekrany (`/auth/signup`, `/auth/confirm-email`, `/`, `/dashboard`), więc czytnik czyta angielski z polską wymową. Rejestracja ma angielskie etykiety i błędy pól, polskie komunikaty serwera i polskie „Pokaż hasło”, a przy błędzie nie przenosi fokusu na pierwsze błędne pole jak logowanie. Zgodne z planem (obudowa i napisy rejestracji czekają na S-05; R8 w `ui-checks.md`, nota w `change.md`); ekrany startera zostają poza zakresem (D4 w `research.md`).
- **Fix**: Pominąć; przy S-05 dopisać fokus na pierwszym błędnym polu do istniejącej noty w `change.md`.
- **Decision**: SKIPPED — do S-05, nota w `change.md` (Karol: „zgoda”)

### F7 — Rejestracja zdradza, czy e-mail ma konto

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/auth-errors.ts:14-15
- **Detail**: `user_already_exists` / `email_exists` daje „Konto z tym adresem już istnieje. Zaloguj się.”, więc każdy może sprawdzić, czy adres ma konto prowadzącego. Dzieje się tak, bo potwierdzanie e-maila jest wyłączone (wymaga tego smoke, a produkcja używa tego samego projektu Supabase). Nie jest to regresja: wcześniej to samo szło surowym tekstem Supabase w adresie.
- **Fix**: Zaakceptować (konta mają tylko prowadzący, gra nie trzyma w nich nic poufnego); wrócić do tego, gdy włączymy potwierdzanie e-maila.
- **Decision**: ACCEPTED — konta mają tylko prowadzący; wrócić przy włączeniu potwierdzania e-maila (Karol: „zgoda”)

## Triage

| Decyzja | Ustalenia |
|---|---|
| Fixed | F1, F2 (2) |
| Skipped | F3, F4, F5, F6 (4; F3 i F6 jako nota na S-05 w `change.md`) |
| Accepted | F7 (1) |

## Sprawdzenie po poprawkach (lessons.md, wpis 3)

2026-10-04, przed push:

- Bramka: `npm run lint` (`ui-literals: 0 literals in 10 view files`), `npx astro check` (0/0/0), `npm run build` przechodzą.
- F1 na serwerze deweloperskim (`node` + `fetch`): `POST` z JSON-em i bez `Content-Type` na `/api/auth/signin` i `/api/auth/signup` daje teraz `302 …?error=missing_fields` (przed poprawką 500). Zwykłe ścieżki bez zmian: pusty formularz → `missing_fields`, złe hasło → `invalid_credentials`, rejestracja z błędnym e-mailem → `validation_failed` (bez zakładania konta); w logu tylko `name`, `status`, `code`.
- F2 w niewidocznym Chrome (DevTools Protocol, bez wpisywania w pola): Tab idzie e-mail → hasło → „Pokaż hasło” → „Zaloguj się” → „Załóż je”. Fokus linku w zwykłym trybie bez zmian (szara ramka, `screens/ir-link-focus-normal.png`); przy emulacji `forced-colors: active` link ma obrys `solid 2px` (`screens/ir-link-focus-forced.png`).
- Przeklikane: `/auth/signin` (tytuł i `h1` „Zaloguj się”, pusty formularz → „Podaj adres e-mail / Podaj hasło” i fokus na polu e-mail, `?error=invalid_credentials` → „Nieprawidłowy e-mail lub hasło.”), `/auth/signup` (renderuje się, 3 pola), `/dev/ui-kitchen-sink` (4 karty i opis „Pusty: nie dotyczy”).
