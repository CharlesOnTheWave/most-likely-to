<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Logowanie hosta jednym kliknięciem (one-click-host-login)

- **Plan**: context/changes/one-click-host-login/plan.md
- **Mode**: Deep
- **Date**: 2026-10-07
- **Verdict**: REVISE → SOUND po poprawkach
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

23/23 ścieżek ✓, symbole 6/7 ✓ (`authErrorCode`, `MESSAGES`, `useSubmitPending`, `TechnicalError`, `readdirSync` w `ui-literals.mjs`, `role="alert"` w `alert.tsx:21`; `signIn` sondy jest w `:107-119`, nie w `:58-70`), linie `deploy-plan.md` 11/147/150/151/160 ✓, brief↔plan ✓, Progress↔fazy ✓ (29/29). Brak `docs/reference/contract-surfaces.md` (pominięte). Weryfikacja kodu: jeden subagent (5 pytań), kluczowe twierdzenia sprawdzone ponownie u źródła (`live-sync-probe.mjs:107-119`, archiwum `change.md:22`, `reviews/impl-review.md` F3, `README.md:132-148`). W repo brak `supabase/migrations/`, więc nic nie blokuje usuwania kont.

## Findings

### F1 — Faza 1 kończy się bez pusha, a z niej wychodzą dwie gałęzie

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 1 (Overview, Implementation Note); Critical Implementation Details, „Faza 1 przed worktree”
- **Detail**: Faza 1 zostaje na `main` jako commit lokalny bez pusha, a potem od `main` powstają worktree S-01 i S-05. (1) Nowy krok w `ci.yml` (zakładanie konta testowego na lokalnym Supabase) pierwszy raz uruchomi się dopiero w PR pierwszej gałęzi. Jeśli ma błąd, poprawkę trzeba wnieść do obu gałęzi. (2) `origin/main` (`fe959b3`) nie ma commita fazy 1, więc po scaleniu pierwszego PR (zwłaszcza przez squash) lokalny `main` rozjedzie się z GitHubem. (3) Smoke na produkcji kontem testowym (AGENTS.md: po każdym pushu) pójdzie pierwszy raz dopiero po scaleniu PR.
- **Fix A ⭐ Recommended**: Po fazie 1, za zgodą Karola, `git push` `main`, potem zielone CI (`ci` i `smoke` z nowym krokiem) i smoke na produkcji kontem testowym. Worktree dopiero od tego `main`.
  - Strength: obie gałęzie startują od sprawdzonego CI i od historii zgodnej z GitHubem. Kolejność jak w AGENTS.md (bramka → push → smoke prod).
  - Tradeoff: jedno dodatkowe wdrożenie (ask), bez zmian w kodzie aplikacji (tylko skrypty, CI, dokumenty). CI trwa około 2 minut.
  - Confidence: HIGH — wdrożenie z samymi dokumentami już było (`fe959b3`), a Workers Builds wdraża wtedy ten sam kod gry.
  - Blind spot: nie ustaliliśmy, jak scalamy PR (merge czy squash).
- **Fix B**: Zostawić commit lokalny, a CI sprawdzić w pierwszym PR.
  - Strength: teraz nie ma żadnego wdrożenia.
  - Tradeoff: ewentualny błąd w CI poprawiamy w dwóch gałęziach, a lokalny `main` trzeba potem wyrównać z GitHubem.
  - Confidence: MED — zależy od tego, czy krok CI zadziała za pierwszym razem.
  - Blind spot: none significant.
- **Decision**: FIXED — Fix A (Karol: „zgoda”)

### F2 — Nota o czytniku ekranu nie jest „zamknięta przez usunięcie”

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Faza 3, pkt 2 (Karta logowania) i pkt 3 („Noty z `change.md` … zamknięte przez usunięcie”)
- **Detail**: Nota F3 z przeglądu M2L5 (archiwum `change.md:22`, `reviews/impl-review.md` F3) mówi wprost „Dotyczy formularza, który zostanie po S-05”: (a) komunikat serwera w `role="alert"` jest w HTML od razu po przeładowaniu i większość czytników go nie ogłasza; (b) błąd pola słychać dwa razy (`role="alert"` w `FieldError`, `field.tsx:203`, i fokus na polu z `aria-describedby`). Plan przenosi `ServerError` do statycznej karty Astro. To zostawia (a) bez zmian, bo wyspa i tak renderuje się na serwerze. Mimo to plan uznaje noty za zamknięte.
- **Fix A ⭐ Recommended**: W fazie 3 komunikat nad przyciskami dostaje `tabindex="-1"` i fokus po załadowaniu strony (mały skrypt w `SignInCard.astro`). Błąd pola traci `role="alert"`, bo fokus na polu i `aria-describedby` wystarczą. Dochodzi kryterium: po przeładowaniu z `?error=` fokus jest na komunikacie (sprawdzone skryptem CDP w headless Chrome).
  - Strength: zamyka notę, którą świadomie odłożyliśmy właśnie do S-05. Zmiana ma kilka linii i nie wymaga instalowania czytnika.
  - Tradeoff: po błędzie fokus jest na komunikacie, a nie na pierwszym przycisku. Jeden Tab dalej jest przycisk Discorda.
  - Confidence: MED — czytniki czytają element z fokusem niezawodnie, ale NVDA, JAWS i VoiceOver nie są sprawdzone na żywo.
  - Blind spot: `FieldError` to klocek shadcn; trzeba sprawdzić, czy `role` da się nadpisać propem bez edycji `field.tsx`.
- **Fix B**: Odłożyć jeszcze raz, ale jawnie: w planie zapisać jako przyjęte ryzyko i przenieść notę do następnej zmiany UI.
  - Strength: brak pracy teraz.
  - Tradeoff: host z czytnikiem ekranu po złym haśle albo anulowaniu nie usłyszy, co się stało.
  - Confidence: HIGH — to tylko zapis decyzji.
  - Blind spot: none significant.
- **Decision**: FIXED — Fix A (Karol: „zgoda”)

### F3 — Smoke z `SMOKE_OAUTH=1` nie wykryje złego client id ani sekretu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Faza 2, pkt 7 (Intent); brief, „Success Criteria”
- **Detail**: Plan obiecuje, że smoke „z flagą także [łapie] zły client id lub wyłączony dostawca”, a brief, że „łapie zepsutą konfigurację dostawcy”. Supabase przy `/auth/v1/authorize` sprawdza tylko, czy dostawca jest włączony i ma niepuste id i sekret, a potem od razu odsyła 302 do discord.com albo accounts.google.com, także ze złym client id. Sekret sprawdza dopiero wymiana kodu po zgodzie użytkownika. Smoke złapie więc wyłączonego dostawcę albo puste pola, ale nie zły client id, zły sekret ani zły adres zwrotny u dostawcy. Na podstawie kodu GoTrue (`ValidateOAuth`), niesprawdzone na żywo.
- **Fix**: Poprawić zdanie w fazie 2, pkt 7 i w briefie na „łapie wyłączonego dostawcę i brak danych dostawcy”. W `deploy-plan.md` (faza 2, pkt 9) dopisać, że po każdej zmianie ustawień dostawcy robimy ręczne logowanie na laptopie.
- **Decision**: FIXED (Karol: „zgoda”)

### F4 — Dokumenty nadal każą wyłączyć „Confirm email”

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 1, pkt 6 (Dokumenty); Faza 3
- **Detail**: Po fazie 1 „Confirm email” jest ON, ale: (a) `AGENTS.md`, Testing: „needs … a reachable Supabase with email confirmation off”, a plan zmienia tylko zdanie o `smoke-<timestamp>`; (b) `README.md:132-140` („Email confirmation in local development”) każe je wyłączyć; (c) `README.md:146-148` ma w tabeli tras `/auth/signup` i `/auth/confirm-email`. Agent, który naprawia smoke, może posłuchać i wyłączyć „Confirm email”, a to otwiera dziurę przejęcia konta.
- **Fix**: Faza 1, pkt 6: w `AGENTS.md` zastąpić całe zdanie (smoke potrzebuje konta testowego z `.dev.vars`; „Confirm email” zostaje ON, nie wyłączać), a w README zastąpić sekcję o potwierdzaniu. Faza 3: poprawić tabelę tras w README.
- **Decision**: FIXED (Karol: „zgoda”)

### F5 — Kryterium 3.3 nie przejdzie w obecnym brzmieniu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 3, Success Criteria (3.3)
- **Detail**: Nowy krok smoke `GET /auth/signup` (faza 3, pkt 5) wpisuje `auth/signup` do `scripts/smoke.mjs`, więc `git grep` zwróci też smoke. Za to `src/pages/auth/signup.ts` trafi do wyniku tylko wtedy, gdy będzie miał ten napis w treści.
- **Fix**: Oczekiwany wynik: `Topbar.astro`, `Welcome.astro` i krok w `scripts/smoke.mjs`.
- **Decision**: FIXED (Karol: „zgoda”)

### F6 — Złe numery linii przy sondzie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries; Faza 1, pkt 4
- **Detail**: `signIn` jest w `live-sync-probe.mjs:107-119`, a nie w `:58-70`, a wywołanie rejestracji jest w `:108`, nie w `:59`. Adres `probe-…`, stałe hasło i komentarz o zakładaniu konta są w `main()` (`:266`, `:272`, `:274`), czego plan nie wymienia. Sama zmiana jest wykonalna: endpointy F-01 istnieją, loguje się tylko host, a gracze są anonimowi.
- **Fix**: Poprawić odwołania na `:107-119` i `:108` oraz dopisać `main()` `:266-274` do pkt 4.
- **Decision**: FIXED (Karol: „zgoda”)

### F7 — Nie wiadomo, jak `ProviderButtons` zapamiętuje kliknięty przycisk

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 3, pkt 1 (Przyciski dostawców)
- **Detail**: `useSubmitPending` zwraca jedną flagę `[pending, setPending]` (`useSubmitPending.ts:5-18`), a `pageshow` zeruje tylko ją. Spinner ma się pokazać przy klikniętym dostawcy, więc potrzebny jest drugi stan. Bez opisu implementer może zmienić wspólny hook.
- **Fix**: Jedno zdanie w kontrakcie: `ProviderButtons` trzyma w `useState` klikniętego dostawcę (ustawianego w `onSubmit`), a spinner pokazuje się przy `pending && clicked === provider`. Reset `pending` z bfcache gasi więc też spinner, a hook się nie zmienia.
- **Decision**: FIXED (Karol: „zgoda”)
