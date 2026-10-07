---
date: 2026-10-04T18:56:00Z
researcher: Claude (Opus 5.5) z Karolem
git_commit: fe959b3
branch: main
repository: most-likely-to
topic: "Logowanie hosta jednym kliknięciem (S-05, FR-001): dostawcy, droga zapasowa, zmiany w kodzie i konfiguracji, styk z S-01"
tags: [research, auth, supabase, oauth, s-05, s-01]
status: complete
last_updated: 2026-10-06
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Decyzja C (2026-10-06), decyzje z wywiadu /10x-plan i fakty z kodu dopisane; fazy planu czekają na akceptację Karola, plan.md jeszcze niezapisany."
---

# Research: logowanie hosta jednym kliknięciem (S-05)

**Date**: 2026-10-04T18:56:00Z
**Researcher**: Claude (Opus 5.5) z Karolem
**Git Commit**: fe959b3
**Branch**: main
**Repository**: most-likely-to

## Research Question

Którzy dostawcy logowania jednym kliknięciem i jaka droga zapasowa dla hosta (FR-001), przy naszym stosie (Astro 7 SSR na Cloudflare Workers, Supabase Auth przez `@supabase/ssr`, jeden projekt Supabase wspólny z produkcją, gracze z Discorda, host trzyma tylko e-mail)? Co trzeba zmienić w kodzie i konfiguracji (Supabase, panele dostawców) i gdzie S-05 styka się z S-01 (room-lobby) przy pracy równoległej w worktree (M2L6)?

## Summary

- **Stan na checkpoint:** research jest `partial`. Fakty z trzech przeszukań (repo, Supabase Auth, dostawcy) są niżej. Recenzja rekomendacji przez adwokata diabła i krytyka oraz decyzja Karola o dostawcach są w toku (sekcja „Open Questions”).
- **Szkic rekomendacji (do recenzji, jeszcze nie przedstawiony Karolowi jako „polecam”):**
  - Discord (główny) + Google (druga droga), dwa przyciski.
  - Apple, Microsoft i GitHub odpadają w v1.
  - Link z e-maila później, gdy gra dostanie własną domenę.
  - Dziurę „przejęcie konta przed rejestracją” zamyka włączenie „Confirm email”.
  - Usunięcie rejestracji z hasłem z UI i przeróbka smoke na produkcji.
  - Callback przekierowuje na `/`, a S-01 przejmuje middleware i stronę po zalogowaniu.
- **Najważniejsze ryzyko (bezpieczeństwo):** przy wyłączonym „Confirm email” Supabase traktuje każdy e-mail jako zweryfikowany przy łączeniu tożsamości (`email.Verified || config.Mailer.Autoconfirm`, `supabase/auth` `internal/models/linking.go`).
  - Ktoś zakłada konto z hasłem na adres hosta.
  - Host loguje się potem przez Google lub Discorda, a konta łączą się w jedno.
  - Obcy zachowuje dostęp przez hasło.

  Dziś ta droga nie istnieje, bo nie ma OAuth; pojawi się w chwili włączenia dostawców. S-05 musi ją zamknąć w tej samej zmianie.
- **Droga zapasowa e-mailem nie jest dziś możliwa bez własnej domeny.** Wbudowany serwer pocztowy Supabase dostarcza tylko do członków zespołu projektu (2 wiadomości na godzinę). Własny SMTP (np. Resend) wymaga zweryfikowanej domeny, a `workers.dev` nią nie jest. FR-001 dopuszcza drugiego dostawcę jako drogę zapasową (`context/foundation/prd.md:82-83`).
- **Styk z S-01:** wspólne pliki to `src/middleware.ts` (chronione trasy, przekierowanie zalogowanego z `/auth/*`, D2) i strona po zalogowaniu. Wspólna usługa to Supabase:
  - S-01 dodaje tabele (migracje = baza produkcyjna);
  - S-05 zmienia ustawienia Auth w panelu (dostawcy, adresy przekierowań, ewentualnie „Confirm email”).

  Proponowany kontrakt: S-05 nie rusza `middleware.ts`, a callback kończy się `redirect("/")` jak dziś `api/auth/signin.ts`.

## Decyzja (2026-10-06)

Karol wybrał **opcję C**: „możemy na razie spróbować z Google i Discordem, a rejestrację normalną ewentualnie w przyszłości”.

- **Teraz (S-05):**
  - Discord (główny) + Google (zapasowy).
  - „Confirm email” ON, zanim włączymy dostawców w panelu. Wcześniej Karol usuwa stare konta poza swoim i jednym testowym.
  - Logowanie e-mailem i hasłem zostaje dla istniejących kont (konto Karola, konto testowe dla smoke i dla agenta S-01).
  - Link „Załóż konto” i strona rejestracji znikają z UI.
- **Później, ewentualnie:** rejestracja z hasłem dla nowych hostów jako osobna zmiana z własną skrzynką nadawczą. Kandydat za 0 zł to osobny Gmail gry z hasłem aplikacji; Supabase opisuje to tylko dla Google Workspace, więc wymaga testu. Wpis w Parked w roadmapie.
- **Rozważone i odrzucone:**
  - A: trzy drogi bez „Confirm email”. Zostaje dziura „rejestracja przed właścicielem adresu”, a bez własnej blokady także przejęcie istniejącego konta przez Discorda z niezweryfikowanym e-mailem.
  - B: trzy drogi od razu z własnym SMTP. S-05 urósłby prawie dwukrotnie, a Gmail jako SMTP jest niesprawdzony.
  - Sam Discord: brak drogi zapasowej, niezgodne z FR-001.
- **Zgodność z PRD:** FR-001 („bez rejestracji i hasła”) jest spełnione dla nowych hostów. Logowanie hasłem zostaje tylko dla kont założonych przed S-05.
- **Wejdzie do planu z recenzji:** test na telefonach (przeglądarka Discorda, Google w WebView, czas 300 s) jako pierwszy krok; Site URL na produkcję i serwery deweloperskie pod `127.0.0.1`; polskie komunikaty dla błędów callbacku; strona polityki prywatności; wylogowanie `scope: 'local'`; callback pod `/api/auth/callback` bez zmian w `middleware.ts`.
- **Przyjęte ryzyka v1:**
  - ekran zgody Google pokazuje `<ref>.supabase.co`;
  - różne e-maile u dostawców dają osobne konta hosta (po zalogowaniu widać „zalogowany jako … (dostawca)”);
  - nowi hosci mają dwie drogi logowania, dopóki nie wróci rejestracja.

### Decyzje z wywiadu `/10x-plan` (2026-10-06)

Złożoność: MEDIUM, 4 pytania (budżet zatwierdzony przez Karola). Plan nie jest jeszcze zapisany, bo fazy czekają na akceptację (sekcja „Proponowane fazy” niżej).

- **Ekran logowania:** na górze przyciski „Zaloguj przez Discord” i „Zaloguj przez Google”, pod nimi kreska „albo e-mailem i hasłem” i obecny formularz z M2L5, na dole „Nowe konto: przez Discord albo Google.” Karol wybrał tę wersję z podglądu.
- **Rejestracja z hasłem:** kod do usunięcia (`src/pages/api/auth/signup.ts`, `src/components/auth/SignUpForm.tsx`, `src/pages/auth/confirm-email.astro`). `/auth/signup` przekierowuje 302 na `/auth/signin`. `Welcome.astro` i `Topbar.astro` zostają bez zmian, bo należą do S-01; ich linki „Sign Up” trafią przez przekierowanie na logowanie.
- **Dane Karola:** imię, nazwisko i mail Karola nigdzie widoczne dla graczy. Zastępuje to pierwszą odpowiedź „imię, nazwisko i prywatny e-mail w polityce”, którą Karol zmienił, gdy dopytał, gdzie te dane się pokażą.
- **Projekt Google na osobnym Gmailu gry:** konto prywatne Karola, nie służbowe, z nazwą wyświetlaną „Most Likely To”. Karol (06.10): nowy adres „pewnie i tak się przyda do testów”.
  - Pole „User support email” na ekranie zgody przyjmuje tylko adres konta, na którym jest projekt, albo grupę tego konta. Użytkownik widzi je po kliknięciu nazwy aplikacji.
  - Karol zakłada Gmail gry na początku następnej sesji.
  - Kolejność prób na wypadek kłopotów (zaproponowana, jeszcze niepotwierdzona):
    1. Gmail gry na obecny numer Karola. Google pozwala zweryfikować jednym numerem kilka kont (https://support.google.com/accounts/answer/114129).
    2. Grupa Google z prywatnego konta jako e-mail wsparcia (niesprawdzone, czy konsola ją przyjmie).
    3. Google czeka, a S-05 idzie z samym Discordem.
- **Polityka prywatności:** pomijamy, bo gra jest na razie tylko dla znajomych. Przyjęte ryzyko (RODO art. 13), wraca przed otwarciem gry poza znajomych. Skutki:
  - Google zostaje w trybie „Testing” bez publikacji. Przy zakresach `email`/`profile`/`openid` nie ma limitu osób, ostrzeżenia ani wygasania zgody.
  - W Discordzie pola Privacy Policy URL i ToS są opcjonalne.
  - Logo w Google nie wgrywamy, bo może uruchomić weryfikację.
- **Site URL:** `https://most-likely-to.charlesonthewave.workers.dev/auth/signin`.
  - Błędy stanu OAuth (`bad_oauth_state`, w tym przekroczenie 300 s) Supabase odsyła kodem 303 na Site URL, nie na nasz callback. Lądują więc na ekranie logowania, który czyta `error_code ?? error`.
  - Inne ścieżki pod tym samym hostem przechodzą bez wpisów.
  - **Redirect URLs:** `http://localhost:4321/**` i `http://localhost:4322/**`. `http://127.0.0.1` przechodzi na dowolnym porcie bez wpisu.
- **„Zalogowany jako”:** `app_metadata.provider` to pierwszy dostawca konta, nie ostatnio użyty, więc S-05 dostawcy nie pokazuje. Kontrakt z S-01: strony hosta pokazują e-mail zalogowanego konta, jak dziś `Topbar.astro`. Przyjęte ryzyko „różne e-maile u dostawców = dwa konta” zmienia się na „po zalogowaniu widać e-mail konta”.

### Proponowane fazy (zatwierdzone 2026-10-07)

Karol przerwał pytanie o zatwierdzenie faz, żeby dopytać o e-mail wsparcia. Zatwierdził je 07.10 („zatwierdzam, dzialamy”); szczegóły są w `plan.md`.

1. **Porządek w Supabase i stałe konto testowe.**
   - Karol w panelu:
     - Add user z „Auto confirm” (konto testowe; hasło generuje agent i zapisuje w `.dev.vars` jako `SMOKE_EMAIL` i `SMOKE_PASSWORD`);
     - usunięcie wszystkich kont poza kontem Karola i testowym, łącznie z `smoke-*`;
     - „Confirm email” ON;
     - URL Configuration jak wyżej.
   - Agent:
     - `scripts/smoke.mjs` loguje się kontem testowym z env (`node --env-file-if-exists=.dev.vars`) i nie zakłada kont;
     - CI zakłada konto na lokalnym Supabase przez `/auth/v1/signup` z kluczem anon (lokalnie `enable_confirmations = false`);
     - aktualizacja `AGENTS.md` (Testing) i `deploy-plan.md`.
2. **Logowanie przez dostawcę (serwer).**
   - Karol:
     - aplikacja Discord (Redirect `https://<ref>.supabase.co/auth/v1/callback`);
     - Gmail gry i projekt Google (Testing; `openid`, `email`, `profile`; klient Web application z tym samym redirect URI);
     - dostawcy w Supabase (bez „Allow users without an email” i bez „Skip nonce checks”).
   - Agent:
     - `POST /api/auth/oauth`: dostawca tylko `discord` albo `google`, `redirectTo = <origin>/api/auth/callback`, dla Google `queryParams.prompt = select_account`, redirect na `data.url`.
     - `GET /api/auth/callback`: czyta `error_code ?? error`. `access_denied` bez `error_code` to anulowanie. Brak `code` daje `bad_oauth_callback`. Potem `exchangeCodeForSession`, a sukces przekierowuje na `/`.
     - Nowe kody w `auth-errors.ts`.
     - `signin.astro` czyta `error_code ?? error`.
     - `signOut({ scope: "local" })`.
   - Smoke:
     - start logowania daje 302 na `<SUPABASE_URL>/auth/v1/authorize` i ciasteczko `-code-verifier`;
     - kolejny krok, do discord.com i accounts.google.com, tylko z `SMOKE_OAUTH=1`, bo w CI dostawcy są wyłączeni;
     - callback bez parametrów daje `bad_oauth_callback`.
   - Ręcznie:
     - logowanie lokalne obiema drogami (`127.0.0.1:4321`, `localhost:4321`, drugi port 4322);
     - anulowanie zgody;
     - Google na mail konta Karola daje to samo `user_id`.
3. **Ekran logowania i porządki.**
   - Przyciski dostawców: `Button` outline, monochromatyczne SVG w `currentColor`, stan „Przekierowuję…”. Do tego `Separator` i stopka.
   - Usunięcie rejestracji, jak w decyzjach wyżej.
   - Stany przycisków w `/dev/ui-kitchen-sink`, nowe pliki w `scripts/ui-literals.mjs`.
   - Zrzuty do oceny Karola (headless Chrome).
4. **Produkcja i test na telefonach.**
   - PR z gałęzi worktree, zielone CI, scalenie za zgodą Karola (to jest wdrożenie), smoke na produkcji z `SMOKE_OAUTH=1`.
   - Test na telefonie Karola i telefonie z drugim systemem: link z Discorda w przeglądarce Discorda i w zwykłej, oba przyciski, logowanie dłuższe niż 300 s. Wyniki w `phone-test.md`.
   - Reakcja ustalona z góry: jeśli logowanie pada w przeglądarce Discorda, pod przyciskami pojawia się podpowiedź „otwórz stronę w Chrome lub Safari”.

## Detailed Findings

### Obecny kod logowania (sprawdzone pliki)

- `src/lib/supabase.ts:5-22`: `createServerClient` z `getAll`/`setAll` na `context.cookies`. `setAll` ignoruje drugi argument (nagłówki `Cache-Control` z `@supabase/ssr`); do oceny w planie.
- `src/middleware.ts:4,18-22`: `PROTECTED_ROUTES = ["/dashboard"]`, `getUser()` na każdym żądaniu.
- `src/pages/api/auth/signin.ts`, `signup.ts`: e-mail i hasło, błędy jako kody z `src/lib/auth-errors.ts`. `signout.ts:4-9`: `signOut()` i `redirect("/")`.
- `src/pages/auth/confirm-email.astro:4-18`: angielska strona po rejestracji (w trybie deweloperskim „Registration successful”).
- `src/pages/dashboard.astro`: starterowy panel z e-mailem i „Sign out”.
- `supabase/config.toml:150-209`: lokalna konfiguracja ze startera. `site_url = "http://127.0.0.1:3000"`, `enable_confirmations = false`; z dostawców jest tylko wyłączony blok `apple`. Używa jej smoke w CI (lokalny Supabase, `.github/workflows/ci.yml:27-55`). Projektu zdalnego nie zmienia, chyba że ktoś uruchomi `supabase config push`.
- Paczki: `@supabase/ssr ^0.12.7`, `@supabase/supabase-js ^2.114.0`, `astro ^7.3.2`, `@astrojs/cloudflare ^14.3.1` (`package.json`).

### Supabase Auth: OAuth po stronie serwera (PKCE)

- Domyślny przepływ to PKCE: `signInWithOAuth({ provider, options: { redirectTo } })` na serwerze daje `data.url`. Weryfikator kodu trafia do ciasteczka przez `setAll`, więc odpowiedź 302 musi nieść te ciasteczka. Trasa callback wywołuje `exchangeCodeForSession(code)`.
  - Źródła: https://supabase.com/docs/guides/auth/server-side/advanced-guide, https://supabase.com/docs/guides/auth/social-login/auth-github.
- Kod jest ważny 5 minut, jednorazowy, tylko w tej samej przeglądarce (https://supabase.com/docs/guides/auth/sessions/pkce-flow).
- Typowy błąd przy zgubionym weryfikatorze: „both auth code and code verifier should be non-empty” (https://github.com/supabase/supabase-js/issues/1686). Nie znaleziono zgłoszeń specyficznych dla Cloudflare Workers (to nie dowód, że ich nie ma).
- Panele dostawców dostają jeden adres zwrotny `https://<ref>.supabase.co/auth/v1/callback`. Przy jednym projekcie obsługuje on i dev, i produkcję.

### Adresy przekierowań

- „Site URL” to domyślny adres, a „Additional Redirect URLs” to lista dozwolonych. Wzorce: `*` (bez `.` i `/`) i `**` (wszystko); w produkcji zalecane dokładne adresy (https://supabase.com/docs/guides/auth/redirect-urls).
- **Adres spoza listy nie daje błędu, tylko po cichu wraca do Site URL** (`GetReferrer` w `supabase/auth` `internal/utilities/request.go`). ~~W naszym układzie (Site URL = produkcja) logowanie z serwera deweloperskiego na niewpisanym porcie wylądowałoby na produkcji.~~ Poprawka 2026-10-06: Site URL w projekcie zdalnym nie był ustawiany (`context/deployment/deploy-plan.md:150`, odłożone), więc założenie „Site URL = produkcja” było błędne; plan musi go ustawić. Adresy pętli zwrotnej jako IP (`127.0.0.1`, `::1`) przechodzą na dowolnym porcie bez wpisu na liście (`IsRedirectURLValid`: `ip.IsLoopback()`, wyjątek z RFC 8252; sprawdzone w kodzie z gałęzi master). Nazwa `localhost` tego wyjątku nie ma. Serwery deweloperskie pod `http://127.0.0.1:<port>` nie potrzebują więc wpisów, także drugi serwer w drugim worktree.
- `localhost` wymaga własnego wpisu. Działanie `http://localhost:*/**` wynika z reguł wzorców, ale nie znaleziono przykładu w dokumentacji; bezpieczniej dokładne wpisy dla 4321 i 4322.
- Konfiguracja: panel albo `supabase config push` (zmienia projekt zdalny, więc pytać), albo Management API `PATCH /v1/projects/{ref}/config/auth`.

### Łączenie tożsamości (bezpieczeństwo)

- Supabase automatycznie łączy tożsamości z tym samym e-mailem, jeśli e-mail jest zweryfikowany (https://supabase.com/docs/guides/auth/auth-identity-linking). W kodzie: `email.Verified || config.Mailer.Autoconfirm` (`internal/models/linking.go`).
- **Gdy „Confirm email” jest wyłączone (dziś, `context/deployment/deploy-plan.md:83-86`):**
  - użytkownicy z hasłem są potwierdzani przy rejestracji;
  - przy łączeniu każdy e-mail liczy się jako zweryfikowany, także niezweryfikowany e-mail z Discorda;
  - ochrona Supabase przed przejęciem konta założonego wcześniej z hasłem nie działa.
- **Gdy „Confirm email” jest włączone:**
  - niepotwierdzona tożsamość z hasłem jest usuwana, gdy loguje się zweryfikowana tożsamość OAuth (`internal/api/external.go`, warunek `!user.IsConfirmed()`);
  - niezweryfikowany e-mail od dostawcy blokuje logowanie i wysyła maila z potwierdzeniem, którego u nas nikt spoza zespołu nie dostanie.
- Wyłączenie „Allow new users to sign up” blokuje też nowych użytkowników OAuth, więc odpada (https://supabase.com/docs/guides/auth/general-configuration).
- Wyłączenie dostawcy „Email” blokuje logowanie hasłem istniejącym użytkownikom i link z e-maila (`token.go`, `magic_link.go`).
- Nie ma przełącznika „zakaz tylko rejestracji z hasłem”. Można to zrobić hookiem „Before User Created” (funkcja Postgres, darmowy plan: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook), ale to migracja w bazie wspólnej z produkcją.
- Ręczne łączenie (`linkIdentity`) wymaga włączenia „Allow manual linking” (wg dokumentacji Beta).

### Droga zapasowa e-mailem (link lub kod)

- Wbudowany serwer pocztowy: tylko adresy z zespołu projektu, od 26.09.2024 (https://supabase.com/changelog/29370-supabase-auth-changes-to-default-email-provider), 2 wiadomości na godzinę (https://supabase.com/docs/guides/auth/auth-smtp).
- Od 3.06.2026 nowe projekty na darmowym planie bez własnego SMTP nie mogą edytować szablonów maili (https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier). Nie sprawdzono, kiedy założono nasz projekt.
- Resend wymaga zweryfikowanej domeny (https://resend.com/docs/send-with-supabase-smtp). Darmowo 3000 maili miesięcznie, 100 dziennie (https://resend.com/pricing).
- Działa z PKCE po stronie serwera (`signInWithOtp` + `verifyOtp` z `token_hash` albo 6-cyfrowy kod; https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr). Limit: 1 prośba na 60 s, link ważny 1 h.

### Dostawcy

| Dostawca | Koszt | Konfiguracja | E-mail | Przeszkody przy obcych | Dopasowanie do ekipy |
|---|---|---|---|---|---|
| Discord | 0 | mała: aplikacja, jeden adres zwrotny, id i sekret | bywa `null` (konta tylko z telefonem, źródło trzecie) albo niezweryfikowany (`verified`) | nie znaleziono dla logowania bez bota | każdy z ekipy ma konto z definicji |
| Google | 0 | średnia: projekt, ekran zgody, publikacja | zweryfikowany (`email_verified`) | ~~w trybie „Testing” limit 100 wpisanych osób~~ (poprawka 2026-10-06: przy samych zakresach `email`/`profile`/`openid` limit, ostrzeżenie i wygasanie po 7 dniach nie obowiązują, https://support.google.com/cloud/answer/15549945); podstawowe zakresy bez weryfikacji; blokada logowania w WebView (`disallowed_useragent`); ekran zgody pokazuje `<ref>.supabase.co` zamiast nazwy gry (poprawka wymaga płatnej własnej domeny Supabase) | bardzo wysokie (Android ok. 64% odsłon w Polsce, StatCounter IX 2026) |
| GitHub | 0 | mała | zweryfikowany (`user:email`, flaga `verified`) | brak | niskie poza programistami |
| Apple | 99 USD/rok | duża; sekret odnawiany co ≤ 6 miesięcy | zawsze „zweryfikowany”, ale często adres przekaźnikowy, który nie połączy się z innym dostawcą | płatne członkostwo | wysokie na iPhone'ach |
| Microsoft | 0, ale wymaga dzierżawy Entra | duża | „nie gwarantowany” wg dokumentacji | ekran zgody „Unverified” | średnie |

Źródła: Discord https://supabase.com/docs/guides/auth/social-login/auth-discord, https://docs.discord.com/developers/resources/user; Google https://support.google.com/cloud/answer/15549945, https://support.google.com/cloud/answer/13463073, https://support.google.com/cloud/answer/15549049; GitHub https://github.com/supabase/auth/blob/master/internal/api/provider/github.go; Apple https://developer.apple.com/programs/whats-included/, https://supabase.com/docs/guides/auth/social-login/auth-apple; Microsoft https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview.

### Styk z S-01 (praca równoległa, M2L6)

- D2 z `ui-signin-contract` (`context/archive/2026-10-04-ui-signin-contract/research.md:106`): zalogowany host też dostaje formularz logowania, a po zalogowaniu `redirect("/")` prowadzi na stronę startera. Przekierowania z `/auth/*` i strona po zalogowaniu należą do S-01 (`plan.md:50`).
- PRD: niezalogowany na trasie hosta trafia do logowania, a link do pokoju działa bez logowania (`context/foundation/prd.md:162`).
- Wspólne miejsca:
  - `src/middleware.ts`: S-01 dopisze trasy hosta;
  - strona `/`, czyli miejsce, w które trafia host po zalogowaniu;
  - Supabase: migracje S-01 kontra ustawienia Auth S-05;
  - lista adresów przekierowań: drugi serwer deweloperski na innym porcie.

### Smoke i CI

- `scripts/smoke.mjs:5-6,43-57`: zakłada nowe konto e-mailem i hasłem, loguje, sprawdza `/dashboard` i wylogowanie. Działa tylko przy wyłączonym „Confirm email” (`AGENTS.md:23`, `deploy-plan.md:83-86`).
- Smoke w CI (`.github/workflows/ci.yml:27-55`) idzie na lokalnym Supabase z `supabase/config.toml`, więc zmiany w panelu go nie dotyczą. Smoke na produkcji zależy od panelu.
- Logowania OAuth nie da się przejść automatycznie bez konta u dostawcy. Smoke po S-05 sprawdzi najwyżej przekierowanie do dostawcy i ochronę tras, chyba że zostanie konto testowe z hasłem (do decyzji w planie).

### Fakty z kodu i paneli do planu (2026-10-06)

Dwa przeszukania tylko do odczytu: `node_modules` (auth-js 2.116.0, `@supabase/ssr` 0.12.7, astro 7.3.2) i `supabase/auth` master@ce9a8ee.

- **`signInWithOAuth` na serwerze** zwraca `{ url }` bez przekierowania (`isBrowser()` jest fałszywe).
  - Weryfikator PKCE zapisuje przez `setAll` z `await`, zanim zwróci URL (`@supabase/ssr` `cookies.js:372-391`).
  - Astro dokleja ciasteczka do odpowiedzi 302 (`astro-middleware.js:42`).
  - `skipBrowserRedirect` na serwerze jest zbędne.
- **`exchangeCodeForSession`, kody błędów:**
  - `pkce_code_verifier_not_found` (400, jeszcze przed żądaniem);
  - `validation_failed`;
  - `flow_state_not_found` (404, kod nieznany albo już zużyty);
  - `flow_state_expired` (422, po 300 s);
  - `bad_code_verifier`.

  Ciasteczka slotów PKCE (najwyżej 5) zostają do wylogowania i są nieszkodliwe.
- **Callback przy błędzie** dostaje w query `error`, `error_code` i `error_description`.
  - Anulowanie zgody u dostawcy daje tylko `error=access_denied` i `error_description`.
  - Możliwe `error_code`: `bad_oauth_callback`, `unexpected_failure` (m.in. brak e-maila), `signup_disabled`, `user_banned`, `provider_email_needs_verification`, `flow_state_already_used`, `email_address_not_authorized` (wbudowany SMTP przy niezweryfikowanym e-mailu u dostawcy).
  - **Błędy stanu** (`bad_oauth_state`, `bad_oauth_callback` bez `state`) idą kodem 303 na Site URL (`external_oauth.go:31-58`).
  - Wyłączony dostawca daje na `/authorize` JSON 400 „Unsupported provider”, bez przekierowania.
- **Google:** `queryParams: { prompt: "select_account" }` dociera do Google (`external.go:71-91`).
- **`signOut({ scope: "local" })`:** wysyła `POST /logout?scope=local` i czyści ciasteczka sesji przez `setAll` z `maxAge: 0`.
- **`app_metadata.provider`** to pierwszy dostawca konta (`models/user.go:262-274`). `getUser()` zwraca `identities[]`.
- **Brak przełącznika „tylko rejestracja e-mail”.**
  - `GOTRUE_EXTERNAL_EMAIL_ENABLED` (w CLI `[auth.email] enable_signup`) blokuje też logowanie hasłem istniejących kont.
  - `DISABLE_SIGNUP` blokuje też nowe konta OAuth.
  - Do zamknięcia rejestracji wystarcza „Confirm email” ON.
- **Panele:**
  - Discord: Redirect w zakładce OAuth2; pola Privacy i ToS opcjonalne.
  - Google Auth Platform: Get started (External), Branding (support email wymagany, logo nie), Data Access (`openid` dodać ręcznie), Clients (Web application; Client Secret widać tylko raz).
  - Supabase: „Confirm email” w sekcji „User Signups” na Sign In / Providers; Users → Add user → Create new user z „Auto confirm user?”.
  - Niepewne: czy Google przyjmie Authorized domains `<ref>.supabase.co` i `charlesonthewave.workers.dev`. Sprawdzić w konsoli.

## Code References

- `src/lib/supabase.ts:5-22`: serwerowy klient Supabase (ciasteczka).
- `src/middleware.ts:4,18-22`: chronione trasy.
- `src/pages/api/auth/signin.ts:6-30`, `signup.ts:6-30`, `signout.ts:4-9`: obecne endpointy.
- `src/lib/auth-errors.ts`: mapa kodów błędów na polskie komunikaty (tu dojdą kody z callbacku OAuth).
- `src/pages/auth/signin.astro`, `src/components/auth/SignInCard.astro`: ekran logowania na kontrakcie UI (M2L5).
- `scripts/smoke.mjs:5-57`: smoke e-mail + hasło.
- `supabase/config.toml:150-209`: lokalna konfiguracja Auth (CI).

## Architecture Insights

- Logowanie jest w całości po stronie serwera (endpointy API + ciasteczka). OAuth z PKCE pasuje do tego wzorca: endpoint startu (`signInWithOAuth` → 302) i trasa callback (`exchangeCodeForSession` → 302). Przeglądarka nie potrzebuje klienta Supabase do logowania.
- Kanał błędów z M2L5 (tylko kody w adresie, polski tekst z mapy) obejmie też błędy z callbacku, np. anulowanie zgody u dostawcy.
- Sekrety dostawców (client secret Discorda i Google) żyją tylko w panelu Supabase, a nie w repo ani w `.dev.vars`.

## Historical Context (from prior changes)

- `context/foundation/roadmap.md:164-175`: S-05 `blocked`, właściciel decyzji Karol; „logowanie linkiem z e-maila wymaga własnej skrzynki nadawczej”. Wspierane.
- `context/deployment/deploy-plan.md:150,157`: maile do hostów wymagają własnego SMTP, a Site URL i Redirect URLs trzeba ustawić na produkcję i `http://localhost:4321/**`. Odłożone na później. Wspierane.
- `context/foundation/shape-notes.md:59`: „np. przez Discord” jako jedyna wcześniejsza wskazówka dostawcy.
- `context/archive/2026-10-04-ui-signin-contract/`: D1 (formularz z hasłem kłóci się z FR-001), noty na S-05 (rejestracja po polsku, fokus, czytnik ekranu; F3 i F6 z przeglądu implementacji). Przeniesione do `change.md` tej zmiany.

## Related Research

- `context/archive/2026-10-04-ui-signin-contract/research.md` (D1, D2).
- `context/archive/2026-09-27-live-sync-spike/research.md:39,91` (tożsamość gościa przez ciasteczko, host jako gracz).

## Open Questions

1. ~~**Recenzja szkicu rekomendacji**~~: zrobiona (adwokat diabła 04.10, krytyk 06.10), sekcje na końcu pliku.
2. ~~**Decyzja Karola (blokuje S-05)**~~: podjęta 2026-10-06, opcja C (sekcja „Decyzja”).
3. ~~**Zamknięcie dziury przejęcia konta:**~~ rozstrzygnięte: „Confirm email” ON przed włączeniem dostawców, porządek kont w panelu (sekcja „Decyzja”). Pierwotne pytanie: włączyć „Confirm email” (bez migracji) czy hook „Before User Created” (migracja), czy wyłączyć dostawcę „Email”? Skutki dla smoke na produkcji i dla istniejącego konta Karola.
4. **Smoke po S-05:** co sprawdza na produkcji bez konta u dostawcy (przekierowanie do dostawcy, ochrona tras) i czy zostaje konto testowe z hasłem.
5. **Kontrakt z S-01:** callback → `/`, S-05 nie rusza `middleware.ts`; do potwierdzenia przy planie S-01. Adresy przekierowań dla dwóch serwerów deweloperskich (4321, 4322).
7. **Start następnej sesji:** Karol zakłada Gmail gry (kolejność prób w „Decyzje z wywiadu”) i zatwierdza 4 fazy, a `/10x-plan one-click-host-login` zapisuje `plan.md` i `plan-brief.md` bez ponownego wywiadu.
6. Nie sprawdzono: data utworzenia projektu Supabase (szablony maili), czy `setAll` powinien przekazywać nagłówki `Cache-Control` na Workers, zachowania Discorda dla kont tylko z telefonem (źródło trzecie).

## Recenzja szkicu: adwokat diabła (2026-10-04)

Werdykt: para Discord + Google przetrwała. Do zmiany są trzy rzeczy: test na telefonach przed planem, konto testowe zamiast zakładania nowych kont w smoke, ewentualnie przycisk Google z tokenem ID.

1. **Telefon i przeglądarka w Discordzie (ryzyko krytyczne, do sprawdzenia).**
   - Host otwiera link gry w przeglądarce wbudowanej w Discorda. Aplikacja Discord może przejąć stronę zgody i otworzyć powrót w innej przeglądarce, a wtedy ciasteczko PKCE zostaje w pierwszej i callback pada. Zgłoszenie https://github.com/discord/discord-api-docs/issues/6160 (iOS, 2023, zamknięte; nie sprawdzone, czy nadal występuje).
   - Druga ścieżka problemu: przeglądarka telefonu nie jest zalogowana do Discorda (host używa tylko aplikacji), więc musi podać hasło i przejść kontrolę „nowe miejsce logowania”.
   - Google chroni przed awarią Discorda, ale nie przed częstszymi awariami: naszym callbackiem, listą przekierowań, uśpionym Supabase.
   - **Do zrobienia przed `/10x-plan`:** około 30 minut testu na prawdziwym iPhonie i Androidzie, w przeglądarce Discorda i w zwykłej.
2. **Różne e-maile u dostawców to dwa osobne konta hosta, bez ostrzeżenia.**
   - Przykład: Discord na starym Hotmailu, Google na Gmailu.
   - Akceptowalne w v1, jeśli po zalogowaniu widać „zalogowany jako <e-mail> (Discord)”.
   - Ręczne łączenie (`linkIdentity`) później; dziś wyłączone (`supabase/config.toml:173`).
3. **„Confirm email” ON zmienia projekt, na którym pracuje też S-01.**
   - Po przełączeniu rejestracja z hasłem przestaje działać i agent S-01 traci sposób na zalogowanego hosta (OAuth nie da się przejść bez przeglądarki).
   - Kolejność:
     1. W panelu jedno wcześniej potwierdzone konto testowe (Auto Confirm).
     2. Endpoint `/api/auth/signin` zostaje bez UI. Hosty z OAuth nie mają hasła, więc nic nie odsłania.
     3. Wdrożenie kodu.
     4. Dopiero potem przełącznik.
     5. `enable_confirmations` w `config.toml` jako dokumentacja.
4. **Smoke na produkcji przestałby sprawdzać miejsca, w których OAuth pęka** (zły sekret, adres spoza listy, callback na Workers). Propozycja:
   - smoke idzie jeden skok dalej (Supabase `/authorize` → discord.com lub accounts.google.com z naszym client_id);
   - callback bez kodu daje czysty błąd;
   - kompletne logowanie przez konto testowe z hasłem, bez zakładania nowego konta przy każdym uruchomieniu.
5. **Zapasowy e-mail „po zakupie domeny” przy zerowym budżecie oznacza w praktyce „nigdy”.**
   - Uczciwy powód odłożenia: „nie warto w v1”.
   - Jeśli kiedyś, to 6-cyfrowy kod (OTP), a nie link: link otwarty z aplikacji Gmail trafia do innej przeglądarki i PKCE pada.
   - Wysyłka z konta Gmail z hasłem aplikacji jako SMTP bez domeny jest niesprawdzona.
6. **Ekran Google pokazuje `<ref>.supabase.co`, co wygląda jak phishing.**
   - Alternatywa warta spike'a: przycisk „Sign in with Google” od Google, token ID na nasz endpoint i `signInWithIdToken`.
   - Omija adres supabase.co i nie potrzebuje ciasteczka PKCE.
   - Koszt: skrypt Google, endpoint, nonce.
7. **Styk z S-01.**
   - Callback pod `/api/auth/callback`, nie pod `/auth/*`, bo przekierowanie zalogowanych z `/auth/*` w S-01 by go przechwyciło.
   - Parametr `next` tylko ze ścieżką względną.
   - Adresy podglądów i serwerów deweloperskich spoza listy lądują na produkcji.

## Recenzja szkicu: krytyk (2026-10-06)

Werdykt: szkic Discord + Google + „Confirm email” się trzyma i jest spójny z FR-001 oraz Hard Rules z `AGENTS.md`. Krytyk czytał `supabase/auth` z gałęzi master (hostowany Supabase może działać na starszej wersji) i paczki z `node_modules`. Oznaczenie „[sprawdzone]” znaczy, że powtórzyłem sprawdzenie sam u źródła.

### Potwierdzone fakty

- Łączenie tożsamości przy wyłączonym „Confirm email” idzie bez czyszczenia, bo konto z hasłem jest potwierdzane przy rejestracji. Przy włączonym niepotwierdzone tożsamości i hasło są usuwane (`external.go:412-417`, `models/user.go:1020-1043`).
- Discord przekazuje `verified`. Konto bez e-maila kończy się błędem „Error getting user email from external provider”, chyba że włączy się „Allow users without an email”. Tego nie włączamy, bo konto bez e-maila łamie FR-001.
- PKCE: weryfikator trafia do ciasteczka `<storageKey>-code-verifier` (SameSite=lax) przez `setAll`. Ten sam mechanizm 302 + Set-Cookie działa już na produkcji (smoke).
- `signInWithIdToken` dla Google działa w kodzie (nonce: oba albo żaden). Przy FedCM Google pokazuje domenę strony (`charlesonthewave.workers.dev`), a nie nazwę gry.
- [sprawdzone] `signOut()` ma domyślnie zasięg `global` (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:3412`).

### Błędy w dokumentach

- Założenie „Site URL = produkcja” (poprawione wyżej). [sprawdzone: `deploy-plan.md:150`]
- „Limit 100 testerów Google” jako przeszkoda (poprawione wyżej). [sprawdzone: support.google.com/cloud/answer/15549945]
- `context/deployment/deploy-plan.md:84`: „do 30 na godzinę”. Wbudowany SMTP wysyła 2 maile na godzinę (https://supabase.com/docs/guides/auth/auth-smtp). [sprawdzone: treść pliku]
- „Kod ważny 5 minut” jest nieprecyzyjne. Licznik 300 s rusza w chwili kliknięcia przycisku (`models/flow_state.go:210-215`). Wolne logowanie do Discorda na telefonie (hasło, 2FA, „nowe miejsce logowania”) może przekroczyć ten czas i skończyć się błędem „OAuth state has expired”.

### Braki do planu

1. **„Confirm email” nie działa wstecz.** Konta z hasłem założone od wdrożenia są potwierdzone, więc dla ich adresów droga przejęcia zostaje otwarta. Przed włączeniem dostawców Karol przegląda Authentication → Users i usuwa wszystko poza swoim kontem i kontem testowym, łącznie z `smoke-*`. Kolejność: najpierw „Confirm email” ON, potem dostawcy. Uściśla to kolejność adwokata: przełącznik na końcu prac nad kodem, ale przed włączeniem dostawców. Wniosek z `signup.go:191-252`: przy włączonym przełączniku rejestracja na adres spoza zespołu pada na wysyłce maila, więc hook „Before User Created” jest zbędny.
2. **Site URL ustawić na produkcję**, a serwery deweloperskie uruchamiać pod `http://127.0.0.1:<port>`.
3. **Kanał błędów callbacku.** Supabase odsyła `?error=…&error_code=…` zamiast `code`: przy anulowaniu zgody, braku e-maila, niezweryfikowanym e-mailu (`provider_email_needs_verification`, wbudowany SMTP odrzuca adres) i wygasłym stanie (`bad_oauth_state`). Każdy przypadek potrzebuje polskiego komunikatu w mapie z `auth-errors.ts`. Wniosek: niezweryfikowany e-mail z Discorda równy adresowi istniejącego konta może zostawić konto-sierotę bez e-maila (`linking.go:109-111`).
4. **Google blokuje logowanie w WebView** (`disallowed_useragent`, https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/). Nie wiadomo, czy przeglądarka wbudowana w Discorda to WebView. Do testu na telefonach dopisać Google w przeglądarce Discorda i rozważyć podpowiedź „otwórz w przeglądarce”.
5. **Polityka prywatności.** Wymaga jej Discord Developer Policy, link do niej chce ekran zgody Google, a e-maile hostów podlegają obowiązkowi informacyjnemu z art. 13 RODO. Wystarczy statyczna strona w grze, za darmo. `workers.dev` i `supabase.co` są na Public Suffix List, więc weryfikacja marki w Google jest niedostępna. Przy podstawowych zakresach nie jest potrzebna.
6. **Wspólne urządzenia.** Wylogowanie na telewizorze wylogowuje hosta także z telefonu (`global`). Propozycja: `signOut({ scope: 'local' })` i `prompt=select_account` dla Google.
7. **Konto Karola** jest potwierdzone, więc logowanie dostawcą na ten sam adres dołączy tożsamość do tego samego konta. Inny adres u dostawcy oznacza nowe konto. Do sprawdzenia: jakich adresów Karol używa w Discordzie i w Google.
8. **CI:** bloki dostawców w `supabase/config.toml` zostają wyłączone, bo inaczej `supabase start` w CI potrzebowałby sekretów.
