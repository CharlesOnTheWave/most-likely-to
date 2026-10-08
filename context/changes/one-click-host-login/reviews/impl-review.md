<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Logowanie hosta jednym kliknięciem (one-click-host-login)

- **Plan**: context/changes/one-click-host-login/plan.md
- **Scope**: Full plan (przegląd po scaleniu i wdrożeniu, przed archiwum)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 6 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Zgodność z planem: wszystkie punkty faz 1–4 MATCH. Udokumentowane adaptacje: grupa Google zamiast Gmaila gry (faza 2), komunikat serwera pod przyciskami (faza 3, decyzja Karola), dokładne dopasowanie `/` w smoke (nota w `change.md`), 3 konta zamiast 2 (decyzja 07.10). Poza zakresem nic nie ruszone (`middleware.ts`, migracje, bloki dostawców w `config.toml`). `plan.md:206` ma adres grupy Google tylko jako przykład (`np. …`); prawdziwy adres jest inny i nie ma go w repozytorium.

Kryteria automatyczne powtórzone 08.10 na `main` (`90136b2`, kod identyczny z `f6764a1`): bramka zielona na tym kodzie, smoke bez `SMOKE_*` kończy się kodem 1 z nazwami zmiennych, `git grep` rejestracji/sekretów czysty (zostaje tylko krok smoke `/auth/signup`), smoke na produkcji z `SMOKE_OAUTH=1` 34/34 (z krokami S-01), `/dev/ui-kitchen-sink` na produkcji 404, fokus na komunikacie serwera po `/auth/signin?error=invalid_credentials` na produkcji i błędy pól bez `role="alert"` (headless Chrome). Sonda `live-probe` (1.4) nie powtarzana (ask, obciąża produkcję). Ręczne 1.6–4.7 odhaczone przez Karola w trakcie faz.

Sprawdzone i bez uwag: brak otwartego przekierowania (każdy `Location` to stała ścieżka albo `data.url` z `SUPABASE_URL`), `redirectTo` z `context.url` nie da się przekierować (Workers, allow-lista Supabase), CSRF na POST (Astro `checkOrigin`), login CSRF przez spreparowany callback blokuje PKCE, ciasteczko PKCE wychodzi z 302, logi bez e-maila, `code`, tokenów i `error_description`, `config_missing` przy braku klienta, `signOut` lokalny unieważnia refresh token, XSS (brak `set:html`/`innerHTML`, ikony SVG statyczne), brak sekretów i prywatnych adresów w repo i historii, hasło konta testowego w CI z `openssl rand -hex 16` bez echa, lekcje 1 i 3.

## Findings

### F1 — Ciasteczka sesji i PKCE nie mają `httpOnly`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/supabase.ts:9
- **Detail**: `createServerClient` bez `cookieOptions`, więc obowiązują domyślne opcje `@supabase/ssr` (`httpOnly: false`, `maxAge` 400 dni). Przeglądarka tych ciasteczek nie czyta (brak klienta auth w przeglądarce, Realtime używa tylko adresu i klucza), więc tokeny dostępu i odświeżania są dostępne dla JS bez potrzeby. Kod sprzed S-05 (starter), ale S-05 dokłada ciasteczka PKCE. Dziś brak miejsca na XSS; to utwardzenie na przyszłość.
- **Fix**: `cookieOptions: { httpOnly: true }` w `createServerClient`, potem smoke i jedno logowanie dostawcą.
- **Decision**: FIXED — `cookieOptions: { httpOnly: true }`; smoke sprawdza `HttpOnly` przy logowaniu i starcie OAuth (test zepsucia czerwony)

### F2 — Smoke nie sprawdza ciasteczka PKCE, które czyta callback

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/smoke.mjs (kroki „oauth start …”), src/pages/api/auth/callback.ts:30
- **Detail**: auth-js 2.116 zapisuje przy starcie trzy ciasteczka weryfikatora, a stały `<storageKey>-code-verifier` tylko w „okresie przejściowym” (`helpers.js:338`). Callback (`exchangeCodeForSession(code)` bez `flowId`) czyta właśnie stały klucz. Smoke akceptuje dowolne ciasteczko kończące się na `-code-verifier`, więc po aktualizacji biblioteki, która przestanie zapisywać stały klucz, każde logowanie Discordem/Google padnie (`pkce_code_verifier_not_found`), a smoke zostanie zielony.
- **Fix**: Smoke sprawdza dokładnie ciasteczko kończące się na `-auth-token-code-verifier`.
- **Decision**: FIXED — smoke sprawdza `-auth-token-code-verifier`

### F3 — Callback loguje i przekazuje surowy `error` z adresu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/callback.ts:12-17
- **Detail**: `?error=<cokolwiek>` trafia bez ograniczeń do logów Workers i do `/auth/signin?error=…`. Strona jest bezpieczna (`Object.hasOwn`, nieznany kod daje komunikat ogólny), ale każdy może wpisać do logów dowolny, długi tekst.
- **Fix**: Przepuszczać tylko `^[a-z0-9_]{1,64}$`, inaczej `unknown`.
- **Decision**: FIXED — callback przepuszcza tylko `^[a-z0-9_]{1,64}$`, inaczej `unknown`; nowy krok smoke (test zepsucia czerwony)

### F4 — Rejestracja e-mailem nadal możliwa przez API Supabase; komunikat odsyła do maila, który nie przychodzi

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/auth-errors.ts (`email_not_confirmed`, `over_email_send_rate_limit`), context/deployment/deploy-plan.md
- **Detail**: S-05 usunęło rejestrację z aplikacji, ale `POST https://<ref>.supabase.co/auth/v1/signup` z kluczem publishable (wysyłanym do przeglądarek dla Realtime) nadal działa, dopóki dostawca Email jest włączony dla logowania hasłem. Przy „Confirm email” ON takie konto zostaje niepotwierdzone, więc przejęcia nie ma. Komunikat `email_not_confirmed` mówi „Link jest w wiadomości od nas”, a gra żadnych maili nie wysyła.
- **Fix**: Zapisać w `deploy-plan.md` jako przyjęte ryzyko i zmienić komunikat na wskazanie logowania przez Discord albo Google.
- **Decision**: FIXED — nowy komunikat `email_not_confirmed`, przyjęte ryzyko opisane w `deploy-plan.md`

### F5 — Wylogowanie ignoruje błąd `signOut`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signout.ts:6-9
- **Detail**: Wynik `signOut({ scope: "local" })` nie jest sprawdzany ani logowany (inne endpointy logują `name`, `status`, `code`). Gdy token wygasł, a Supabase chwilowo nie odpowiada, ciasteczka zostają, a 302 na `/` wygląda jak udane wylogowanie; na wspólnym urządzeniu (telewizor) sesja wraca po powrocie Supabase. Wąskie okno.
- **Fix**: Logować błąd jak w `signin.ts` i przy błędzie usunąć ciasteczka `sb-*` samemu.
- **Decision**: ACCEPTED — rzadki przypadek (Supabase niedostępny przy wylogowaniu), poprawki nie da się dziś sensownie przetestować (Karol)

### F6 — Lista dostawców i znacznik „Przekierowuję…” zdublowane

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/auth/ProviderButtons.tsx:7-12, 43-55; src/pages/api/auth/oauth.ts:7
- **Detail**: `type Provider` w przeglądarce i `PROVIDERS` na serwerze to dwie kopie tej samej listy (repo ma już wzorzec `src/lib/*/shared.ts`). `ProviderButtons` odtwarza znacznik oczekiwania z `SubmitButton`, bo ten nie ma propa `variant`.
- **Fix**: Wspólny moduł z identyfikatorami dostawców i `variant` w `SubmitButton`; bez pośpiechu.
- **Decision**: SKIPPED — kosmetyka; wraca przy trzecim dostawcy (Karol)
