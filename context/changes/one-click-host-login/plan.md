# Logowanie hosta jednym kliknięciem (one-click-host-login) — plan implementacji

## Overview

Host loguje się do gry jednym kliknięciem przez Discorda albo Google, bez rejestracji i hasła (PRD FR-001, roadmapa S-05). Logowanie e-mailem i hasłem zostaje tylko dla kont założonych wcześniej, a rejestracja z hasłem znika. W tej samej zmianie zamykamy dziurę „przejęcie konta przez dostawcę”: w Supabase włączamy „Confirm email”, zanim włączymy dostawców. Smoke przestaje zakładać nowe konto przy każdym uruchomieniu i loguje się stałym kontem testowym.

Zmiana idzie równolegle z S-01 (room-lobby) w osobnym worktree (lekcja M2L6). Wszystkie decyzje zapadły w `research.md` (sekcje „Decyzja”, „Decyzje z wywiadu `/10x-plan`”, „Proponowane fazy”). Karol zatwierdził fazy 07.10.

## Current State Analysis

- Logowanie działa w całości po stronie serwera: endpointy API plus ciasteczka sesji z `@supabase/ssr` (`src/lib/supabase.ts:5-21`). Przeglądarka nie ma klienta Supabase do logowania.
- `src/pages/api/auth/signin.ts:6-31` loguje e-mailem i hasłem. Błąd trafia do adresu tylko jako kod, a polski tekst daje mapa `src/lib/auth-errors.ts:5-33`. `signup.ts` zakłada konto, a `signout.ts:7` wylogowuje z zasięgiem `global` (domyślnym).
- Ekran `/auth/signin` (`src/pages/auth/signin.astro:7-15`) składa się z `SignInCard.astro` i wyspy `SignInForm.tsx`. Błąd serwera pokazuje `ServerError` wewnątrz formularza (`SignInForm.tsx:114`). Stopka karty prowadzi do rejestracji (`SignInCard.astro:23-31`).
- Rejestracja to hybryda sprzed M2L5: angielski ekran (`signup.astro`), `SignUpForm.tsx`, strona `confirm-email.astro`, literały kolorów i `bg-cosmic`.
- `scripts/smoke.mjs:5-6,41-45` zakłada konto `smoke-<timestamp>@example.com` przy każdym uruchomieniu i działa tylko przy wyłączonym „Confirm email”. `scripts/live-sync-probe.mjs:107-119` zakłada konto `probe-…` przez `/api/auth/signup`.
- CI (`.github/workflows/ci.yml:27-55`) uruchamia smoke na lokalnym Supabase z `supabase/config.toml` (`enable_confirmations = false`, brak włączonych dostawców).
- Projekt Supabase jest jeden, wspólny dla rozwoju i produkcji. Dziś „Confirm email” jest wyłączone, a Site URL nie był ustawiany (`context/deployment/deploy-plan.md:11,150`).
- Kod OAuth ani callback nie istnieją. `middleware.ts` chroni tylko `/dashboard` i należy do S-01.

## Desired End State

- Na `/auth/signin` są na górze przyciski „Zaloguj przez Discord” i „Zaloguj przez Google”. Pod nimi kreska „albo e-mailem i hasłem”, obecny formularz z hasłem, a na dole „Nowe konto: przez Discord albo Google.”
- Kliknięcie przycisku prowadzi przez Supabase do dostawcy. Po zgodzie host wraca na `/` zalogowany. Anulowanie albo błąd kończy się polskim komunikatem na ekranie logowania.
- `/auth/signup` przekierowuje na `/auth/signin`. Endpoint i ekrany rejestracji nie istnieją.
- W Supabase:
  - „Confirm email” jest włączone;
  - Site URL to produkcyjne `/auth/signin`;
  - Redirect URLs zawierają `http://localhost:4321/**` i `http://localhost:4322/**`;
  - jest tylko konto Karola i konto testowe;
  - Discord i Google są włączone.
- Smoke i sonda logują się kontem testowym z `.dev.vars`. Smoke sprawdza start logowania przez dostawcę, callback bez kodu, przekierowanie rejestracji, a z `SMOKE_OAUTH=1` także skok do discord.com i accounts.google.com.
- Na produkcji działa logowanie obiema drogami. Wynik testu na telefonach jest zapisany w `phone-test.md`.

Weryfikacja: kryteria sukcesu faz poniżej. Rozstrzyga smoke na produkcji z `SMOKE_OAUTH=1` oraz test na telefonach.

### Key Discoveries:

- `signInWithOAuth` na serwerze zwraca `{ url }` bez przekierowania. Weryfikator PKCE zapisuje przez `setAll` przed zwróceniem adresu, więc 302 z `context.redirect` niesie ciasteczko `<storageKey>-code-verifier` (`research.md`, „Fakty z kodu”).
- Błędy stanu OAuth (`bad_oauth_state`, w tym przekroczenie 300 s) Supabase odsyła na Site URL, a nie na nasz callback. W query są `error`, `error_code` i `error_description` (`research.md`, „Fakty z kodu”, `external_oauth.go:31-58`).
- Anulowanie zgody daje na callbacku tylko `error=access_denied`, bez `error_code`.
- Adres spoza listy przekierowań po cichu wraca do Site URL, czyli na produkcję. `127.0.0.1` przechodzi na każdym porcie bez wpisu, a `localhost` tylko na wpisanych portach (`research.md`, „Adresy przekierowań”).
- „Confirm email” nie działa wstecz. Wcześniejsze konta z hasłem są potwierdzone, dlatego przed włączeniem dostawców trzeba usunąć wszystkie konta poza kontem Karola i testowym (`research.md`, „Recenzja: krytyk”, brak 1).
- Zablokowany przycisk wysyłania wypada z danych formularza. Stan „Przekierowuję…” blokuje przyciski zaraz po kliknięciu, więc dostawcy nie wolno przekazywać przez `name`/`value` przycisku.
- `scripts/live-sync-probe.mjs:108` też używa `/api/auth/signup`. Bez przeróbki sonda przestanie działać po fazie 1 (rejestracja na obcy adres pada na wysyłce maila).
- `Alert` ma `role="alert"` (`src/components/ui/alert.tsx:21`). Komunikat serwera da się wyrenderować statycznie w karcie Astro, bez wyspy.

## What We're NOT Doing

- Rejestracja e-mailem i hasłem dla nowych hostów (Parked w roadmapie, osobna zmiana z własną skrzynką nadawczą).
- Logowanie linkiem albo kodem z e-maila, własny SMTP, własna domena.
- Polityka prywatności, publikacja aplikacji Google, logo i weryfikacja marki. To przyjęte ryzyko, bo gra jest na razie tylko dla znajomych. Wraca przed otwarciem gry dla obcych.
- Apple, Microsoft, GitHub. Przycisk Google z tokenem ID (`signInWithIdToken`).
- Zmiany w `src/middleware.ts`, na stronie po zalogowaniu (`/`), w `Topbar.astro`, `Welcome.astro` i `dashboard.astro`. Należą do S-01; ich linki do rejestracji obsłuży przekierowanie.
- Ręczne łączenie kont (`linkIdentity`) i pokazywanie dostawcy przy „zalogowany jako”.
- Bloki dostawców w `supabase/config.toml`. Zostają wyłączone, inaczej `supabase start` w CI potrzebowałby sekretów.
- Migracje bazy.
- Nagłówki `Cache-Control` z `setAll` (pytanie otwarte w `research.md`, poza zakresem).

## Implementation Approach

Kolejność wynika z bezpieczeństwa i z pracy równoległej:

1. **Faza 1: porządek w Supabase i stałe konto testowe.** Robimy ją na `main`, zanim powstaną worktree S-01 i S-05, bo obie gałęzie potrzebują nowego smoke i konta testowego. Kończy ją push za zgodą Karola, zielone CI i smoke na produkcji.
2. **Faza 2: logowanie przez dostawcę po stronie serwera.** Endpoint startu i callback.
3. **Faza 3: ekran logowania.** Przyciski, usunięcie rejestracji, stany i zrzuty.
4. **Faza 4: produkcja i telefony.** PR, scalenie za zgodą (wdrożenie), smoke na produkcji, test na telefonach.

Fazy 2–4 idą w worktree S-05.

Przepływ OAuth trzyma się wzorca z `signin.ts`:

1. `POST /api/auth/oauth` woła `signInWithOAuth` i odpowiada 302 do Supabase.
2. Supabase prowadzi do dostawcy.
3. Dostawca wraca do Supabase, a Supabase do `GET /api/auth/callback`.
4. Callback woła `exchangeCodeForSession` i przekierowuje 302 na `/`.

Błędy idą istniejącym kanałem `?error=<kod>`, a polski tekst daje mapa. Sekrety dostawców żyją tylko w panelu Supabase.

## Critical Implementation Details

**Kolejność w panelach.** „Confirm email” ON i usunięcie starych kont muszą nastąpić przed włączeniem Discorda i Google, bo inaczej zostaje dziura przejęcia konta. Po włączeniu „Confirm email” rejestracja na wdrożonej produkcji pada aż do wdrożenia fazy 3. To oczekiwane, bo rejestracja i tak znika.

**Faza 1 przed worktree.** Commit fazy 1 idzie na `origin/main` (push za zgodą Karola; wdrożenie bez zmian w kodzie gry, tylko skrypty, CI i dokumenty), zanim powstaną gałęzie. Dzięki temu nowy krok CI jest sprawdzony raz, a nie poprawiany w dwóch gałęziach, i lokalny `main` nie rozjeżdża się z GitHubem po scaleniu pierwszego PR. `.dev.vars` jest poza gitem, więc nowy worktree go nie ma. Przy zakładaniu worktree S-01 i S-05 trzeba go skopiować, inaczej smoke i dev nie mają ani Supabase, ani konta testowego.

**Port drugiego serwera.** Serwer deweloperski w drugim worktree uruchamiamy na porcie 4322 (`localhost`) albo pod `127.0.0.1`. Inny port na `localhost` po cichu odeśle logowanie na produkcję.

**Przyciski dostawców.** Każdy dostawca dostaje własny `<form>` z ukrytym polem `provider`. Nie robimy jednego formularza z `name`/`value` na przyciskach, bo zablokowany przycisk wypada z wysyłanych danych.

## Faza 1: Porządek w Supabase i stałe konto testowe

### Overview

Konto testowe zamiast zakładania kont przez smoke i sondę, „Confirm email” ON, porządek kont i adresów przekierowań. Faza idzie na `main` przed założeniem worktree: commit, push za zgodą Karola, zielone CI i smoke na produkcji.

### Changes Required:

#### 1. Dane konta testowego

**File**: `.dev.vars` (poza gitem), `.env.example`, `README.md`

**Intent**: Agent generuje losowe hasło i dopisuje do `.dev.vars` `SMOKE_EMAIL` (np. `smoke-host@example.com`) oraz `SMOKE_PASSWORD`. Hasła nie wypisuje w czacie ani w logach. `.env.example` i krok konfiguracji w README dostają puste wpisy, żeby świeży klon wiedział, czego brakuje.

**Contract**: Zmienne `SMOKE_EMAIL` i `SMOKE_PASSWORD` w `.dev.vars` (format dotenv). Konto o tych danych istnieje w projekcie Supabase.

#### 2. Panel Supabase (Karol, agent prowadzi krok po kroku)

**File**: brak (panel Supabase); zapis stanu w `context/deployment/deploy-plan.md`

**Intent**: Stan projektu, w którym włączenie dostawców w fazie 2 nie otwiera dziury przejęcia konta. Karol wykonuje kroki sam, w tej kolejności:

1. Authentication → Users → Add user → Create new user: e-mail i hasło z `.dev.vars`, „Auto confirm user?” włączone.
2. Usuwa wszystkie konta poza swoim i testowym, łącznie z `smoke-*` i `probe-*`. Przed usunięciem patrzy na listę.
3. Sign In / Providers → User Signups: „Confirm email” ON.
4. URL Configuration:
   - Site URL: `https://most-likely-to.charlesonthewave.workers.dev/auth/signin`;
   - Redirect URLs: `http://localhost:4321/**` i `http://localhost:4322/**`.

**Contract**: W Authentication → Users są 2 konta. „Confirm email” jest ON. Site URL i Redirect URLs mają wartości jak wyżej.

#### 3. Smoke na koncie testowym

**File**: `scripts/smoke.mjs`, `package.json`

**Intent**: Smoke loguje się kontem testowym zamiast zakładać konto. Brak danych kończy się czytelnym błędem, a nie testem na `undefined`.

**Contract**:
- Skrypt `smoke` uruchamia `node --env-file-if-exists=.dev.vars scripts/smoke.mjs`. Zmienne środowiska mają pierwszeństwo przed plikiem, co wykorzystuje CI.
- Krok „signup creates account” znika. Kroki ze złym i dobrym hasłem, `/dashboard` i wylogowanie używają `SMOKE_EMAIL` i `SMOKE_PASSWORD`.
- Brak którejś zmiennej daje komunikat z nazwą zmiennej i kod wyjścia 1, zanim padnie pierwsze żądanie.

#### 4. Sonda na koncie testowym

**File**: `scripts/live-sync-probe.mjs`, `package.json`, `README.md`

**Intent**: Sonda F-01 nie zakłada konta `probe-…`, tylko loguje się kontem testowym. Inaczej po „Confirm email” ON przestaje działać.

**Contract**:
- `signIn` (`live-sync-probe.mjs:107-119`) woła tylko `/api/auth/signin` z `SMOKE_EMAIL` i `SMOKE_PASSWORD`. Brak zmiennych daje `TechnicalError` (kod wyjścia 2).
- W `main()` (`:266-274`) znikają adres `probe-…`, stałe hasło i komentarz o zakładaniu konta.
- Skrypt `live-probe` dostaje `--env-file-if-exists=.dev.vars`.
- Komentarz na górze pliku i opis w README (linia 59) mówią o koncie testowym.
- Reguły ask w `.claude/settings.json` się nie zmieniają; nadal pasują do `npm run live-probe*`.

#### 5. CI zakłada konto testowe na lokalnym Supabase

**File**: `.github/workflows/ci.yml`, `supabase/config.toml`

**Intent**: Smoke w CI dostaje konto testowe bez sekretów. Lokalny Supabase ma `enable_confirmations = false`, więc konto zakłada zwykłe `POST /auth/v1/signup`.

**Contract**:
- W jobie `smoke` po „Start local Supabase” jest krok, który:
  - generuje hasło;
  - zakłada konto przez `$API_URL/auth/v1/signup` z nagłówkiem `apikey: $ANON_KEY`;
  - dopisuje `SMOKE_EMAIL` i `SMOKE_PASSWORD` do `.dev.vars`, po kroku, który ten plik tworzy.
- `config.toml` przy `enable_confirmations = false` dostaje komentarz: na produkcji ON (S-05), lokalnie OFF, bo CI zakłada konto testowe przez signup.

#### 6. Dokumenty

**File**: `AGENTS.md` (sekcja Testing), `README.md` (sekcja o smoke), `context/deployment/deploy-plan.md`

**Intent**: Następny agent wie, że smoke używa konta testowego i nie zakłada kont, a `.dev.vars` musi mieć `SMOKE_*`. Nigdzie nie zostaje rada, żeby wyłączyć „Confirm email”, bo to otwiera dziurę przejęcia konta. `deploy-plan.md` opisuje nowy stan Supabase:
- „Confirm email” ON;
- Site URL i Redirect URLs;
- 2 konta;
- wpisy o kontach `smoke-…` jako historia.

Historycznych checkboxów nie przepisujemy. Dopisujemy notę z datą.

**Contract**:
- `AGENTS.md`, Testing: znika wymóg „with email confirmation off”, a zdanie o `smoke-<timestamp>@example.com` zastępuje zdanie o koncie testowym z `.dev.vars`. Dochodzi zakaz: „Confirm email” zostaje ON, nie wyłączać go, żeby naprawić smoke.
- `README.md`: sekcja „Email confirmation in local development” (`:132-140`, każe wyłączyć potwierdzanie) zastąpiona opisem: ON w projekcie Supabase, lokalnie smoke loguje się kontem testowym.
- `deploy-plan.md`: linie 11, 147, 150–151 i 160 zaktualizowane albo opatrzone notą.
- Treść zmiany w `AGENTS.md` agent pokazuje Karolowi przed commitem.

### Success Criteria:

#### Automated Verification:

- Bramka przechodzi: `npm run lint`, `npx astro check`, `npm run build`
- Smoke lokalny (`npm run dev`, potem `npm run smoke`) kończy się „All smoke steps passed” bez zakładania konta
- Smoke bez danych konta (`SMOKE_EMAIL= npm run smoke`) kończy się kodem 1 i komunikatem z nazwą zmiennej
- Sonda lokalnie z małymi parametrami (`npm run live-probe -- --players 2 --trials 1`, ask) loguje się kontem testowym i kończy pomiar
- `git grep -n "api/auth/signup" -- scripts` nic nie zwraca
- Po pushu `main` (za zgodą Karola) CI zielone: `ci` i `smoke` z krokiem, który zakłada konto testowe na lokalnym Supabase
- Smoke na produkcji (`BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke`) kończy się „All smoke steps passed” na koncie testowym

#### Manual Verification:

- Karol wykonał kroki w panelu Supabase w podanej kolejności
- Authentication → Users pokazuje 2 konta (Karol i testowe), także po uruchomieniu smoke i sondy
- Karol loguje się na produkcji swoim e-mailem i hasłem po włączeniu „Confirm email”

**Implementation Note**: Po fazie 1 commit na `main`, bramka, push za zgodą Karola (wdrożenie bez zmian w kodzie gry), zielone CI i smoke na produkcji. Dopiero potem worktree S-01 i S-05 od aktualnego `main`, z kopią `.dev.vars`. Przed fazą 2 pauza na potwierdzenie Karola.

---

## Faza 2: Logowanie przez dostawcę (serwer)

### Overview

Aplikacje u dostawców, dostawcy w Supabase, endpoint startu logowania, callback, polskie komunikaty błędów i smoke dla nowych tras. Bez zmian w wyglądzie ekranu: przyciski dochodzą w fazie 3. Wymaga Gmaila gry.

**Adaptacja 07.10 (wieczór): grupa Google zamiast Gmaila gry.** Google odrzuciło zakładanie Gmaila gry, więc wszędzie, gdzie ta faza mówi o Gmailu gry, obowiązuje:

- Projekt Google jest na prywatnym koncie Karola. Gracze go nie widzą.
- „User support email” na ekranie zgody to grupa Google założona na tym samym koncie (np. `most-likely-to@googlegroups.com`), nazwana „Most Likely To”, z listą członków widoczną tylko dla właściciela. Gracz po kliknięciu nazwy aplikacji widzi tylko nazwę gry i adres grupy.
- Adres w „Contact information” widzi tylko Google, więc może to być prywatny Gmail.
- Test 2.7 robimy na prywatnym Gmailu Karola: konto z tym adresem przez Add user (Auto Confirm User) przed pierwszym logowaniem Google'em.
- Dokumenty (pkt 9) nie zawierają prywatnego adresu Karola ani adresu grupy (repo jest publiczne).
- Zasady trybu Testing sprawdzone 07.10: przy samych zakresach `openid`, `userinfo.email` i `userinfo.profile` logować się może każdy, bez listy testerów i bez wygasania zgody po 7 dniach (https://support.google.com/cloud/answer/15549945).

### Changes Required:

#### 1. Panele dostawców i Supabase (Karol, agent prowadzi krok po kroku)

**File**: brak (panele); zapis w `context/deployment/deploy-plan.md` bez sekretów

**Intent**: Dostawcy działają dla dev i produkcji przez jeden adres zwrotny Supabase. Sekrety wkleja Karol prosto do panelu Supabase. Nie trafiają do repo, do `.dev.vars` ani do czatu.

**Contract**:
- **Discord** (Developer Portal):
  - nowa aplikacja „Most Likely To”;
  - OAuth2 → Redirects: `https://<ref>.supabase.co/auth/v1/callback`;
  - pola Privacy Policy i ToS puste.
- **Google** (Google Auth Platform na Gmailu gry):
  - projekt, Get started: External, nazwa „Most Likely To”, e-mail wsparcia to Gmail gry;
  - Data Access: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`;
  - Clients: Web application z tym samym redirect URI;
  - tryb Testing, bez logo i bez publikacji;
  - Authorized domains: sprawdzić w konsoli, czy są wymagane i czy przyjmie `supabase.co`.
- **Supabase** → Providers: Discord i Google włączone z id i sekretem. „Allow users without an email” i „Skip nonce checks” wyłączone.

#### 2. Start logowania

**File**: `src/pages/api/auth/oauth.ts` (nowy)

**Intent**: `POST` z formularza na ekranie logowania wysyła hosta do Supabase i dalej do dostawcy. Ciasteczko PKCE musi wyjść w tej samej odpowiedzi 302.

**Contract**:
- `POST`, pole formularza `provider` tylko `discord` albo `google`.
- Błędy:
  - inny dostawca daje 302 na `/auth/signin?error=unsupported_provider`;
  - brak klienta daje `config_missing`.
- `signInWithOAuth({ provider, options: { redirectTo, queryParams } })`:
  - `redirectTo` to `new URL("/api/auth/callback", context.url).href`;
  - dla Google `queryParams: { prompt: "select_account" }`.
- Błąd logujemy jak w `signin.ts:24-26` (`name`, `status`, `code`) i przekierowujemy z kodem z `authErrorCode`.
- Sukces to `context.redirect(data.url)`.

#### 3. Callback

**File**: `src/pages/api/auth/callback.ts` (nowy)

**Intent**: Powrót od dostawcy zamienia kod na sesję albo zamienia każdy błąd na kod dla ekranu logowania. Callback leży pod `/api/auth/`, a nie pod `/auth/*`, bo S-01 przekierowuje zalogowanych z `/auth/*`. `middleware.ts` się nie zmienia.

**Contract**: `GET`, w tej kolejności:
1. Jest `error_code` albo `error` w query: 302 na `/auth/signin?error=<error_code ?? error>`.
2. Brak `code`: `bad_oauth_callback`.
3. Brak klienta: `config_missing`.
4. `exchangeCodeForSession(code)` z błędem: kod z `authErrorCode`.
5. Sukces: 302 na `/`.

Do logów trafiają tylko `name`, `status`, `code` oraz `error` i `error_code` dostawcy. Nigdy e-mail, `code`, tokeny ani `error_description`.

#### 4. Komunikaty błędów

**File**: `src/lib/auth-errors.ts`

**Intent**: Każdy kod z callbacku i ze strony Site URL ma polski komunikat. Komentarz pliku mówi, że kody przychodzą też z OAuth.

**Contract**: nowe klucze `MESSAGES`, z jednym komunikatem na grupę:
- **Anulowanie:** `access_denied`. Np. „Logowanie przerwane. Spróbuj jeszcze raz.”
- **Wygasłe lub zepsute logowanie:** `bad_oauth_state`, `bad_oauth_callback`, `flow_state_expired`, `flow_state_not_found`, `flow_state_already_used`, `pkce_code_verifier_not_found`, `bad_code_verifier`. Np. „Logowanie wygasło albo się urwało. Zacznij od nowa.”
- **Niepotwierdzony e-mail u dostawcy:** `provider_email_needs_verification`, `email_address_not_authorized`. Komunikat: potwierdź e-mail u dostawcy albo użyj drugiej drogi.
- **Inne błędy:** `unexpected_failure` (m.in. brak e-maila u dostawcy), `user_banned`.

`unsupported_provider` dostaje komunikat ogólny (brak klucza). Dokładne brzmienie Karol ocenia na zrzutach w fazie 3.

#### 5. Ekran logowania czyta kod Supabase

**File**: `src/pages/auth/signin.astro`

**Intent**: Błędy, które Supabase odsyła na Site URL, pokazują się po polsku.

**Contract**: kod komunikatu to `searchParams.get("error_code") ?? searchParams.get("error")`.

#### 6. Wylogowanie lokalne

**File**: `src/pages/api/auth/signout.ts`

**Intent**: Wylogowanie na wspólnym urządzeniu (np. telewizor) nie wylogowuje hosta z telefonu.

**Contract**: `signOut({ scope: "local" })`.

#### 7. Smoke dla nowych tras

**File**: `scripts/smoke.mjs`

**Intent**: Smoke łapie miejsca, w których OAuth pęka bez konta u dostawcy: start, ciasteczko PKCE, callback, a z flagą także wyłączonego dostawcę albo brak jego danych w Supabase. Złego client id, sekretu ani adresu zwrotnego u dostawcy smoke nie wykryje: Supabase przy `/auth/v1/authorize` odsyła do dostawcy bez sprawdzania tych wartości, a sekret sprawdza dopiero wymiana kodu po zgodzie. To łapie tylko prawdziwe logowanie.

**Contract**:
- **Nowe kroki:**
  - `POST /api/auth/oauth` z `provider=discord` i z `provider=google`: 302, `Location` zawiera `/auth/v1/authorize?provider=<dostawca>` (dla Google także `prompt=select_account`), a w słoiku jest ciasteczko kończące się na `-code-verifier`;
  - nieznany dostawca: `/auth/signin?error=unsupported_provider`;
  - `GET /api/auth/callback` bez parametrów: `/auth/signin?error=bad_oauth_callback`;
  - `GET /api/auth/callback?error=access_denied`: `/auth/signin?error=access_denied`.
- **Z `SMOKE_OAUTH=1`:** smoke idzie jeden skok dalej, na adres Supabase z `Location`, i oczekuje 302 na `https://discord.com/` albo `https://accounts.google.com/`. W CI flagi nie ma, bo dostawcy są tam wyłączeni.
- Porównanie `Location` dopuszcza sprawdzenie „zawiera” obok obecnego „zaczyna się od”. Bez zależności.

#### 8. Tymczasowe przyciski do testu ręcznego

**File**: `src/pages/dev/ui-kitchen-sink.astro`

**Intent**: Karol może przejść logowanie dostawcą w fazie 2, zanim powstanie prawdziwy ekran.

**Contract**: sekcja „Tymczasowo (faza 2)” z dwoma zwykłymi formularzami `POST /api/auth/oauth` (ukryte pole `provider`, `Button`). W fazie 3 zastępuje ją `ProviderButtons`.

#### 9. Dokumenty

**File**: `context/deployment/deploy-plan.md`

**Intent**: Gdzie są skonfigurowani dostawcy, na jakich kontach (aplikacja Discord, projekt Google na Gmailu gry), że sekrety są tylko w Supabase, jak wymienić sekret, oraz że polityka prywatności wraca przed otwarciem gry dla obcych. Po każdej zmianie ustawień dostawcy (sekret, client id, adres zwrotny) Karol loguje się raz ręcznie na laptopie, bo smoke takiej pomyłki nie wykryje.

**Contract**: nowa podsekcja o dostawcach logowania, bez wartości sekretów i bez adresu Gmaila gry.

### Success Criteria:

#### Automated Verification:

- Bramka przechodzi: `npm run lint`, `npx astro check`, `npm run build`
- Smoke lokalny kończy się „All smoke steps passed”, z nowymi krokami OAuth
- Smoke lokalny z `SMOKE_OAUTH=1` dochodzi do discord.com i accounts.google.com
- `git grep -niE "GOCSPX|client.?secret" -- src scripts` nic nie zwraca

#### Manual Verification:

- Karol loguje się lokalnie Discordem i Google na `http://localhost:4321`, `http://127.0.0.1:4321` i na drugim serwerze na porcie 4322, i trafia na `/` zalogowany (`/dashboard` pokazuje e-mail). Start z tymczasowych przycisków w `/dev/ui-kitchen-sink`.
- Anulowanie zgody u Discorda i u Google kończy się polskim komunikatem na ekranie logowania
- Logowanie dostawcą na adres konta Karola dołącza tożsamość do tego samego konta (to samo `user_id` w Authentication → Users). Inny adres u dostawcy daje nowe konto, co jest przyjętym ryzykiem; zapisujemy, jak było. Nota 07.10: Discord i Google Karola są na innych adresach niż jego konto z hasłem, więc ten test robimy na Gmailu gry. Karol dodaje konto z tym adresem w Authentication → Users (Add user, Auto Confirm User), potem loguje się Google'em na ten sam Gmail i sprawdza, że na liście jest jedno konto z dwiema tożsamościami, a nie dwa konta. → Adaptacja 07.10 wieczór: zamiast Gmaila gry prywatny Gmail Karola (Overview fazy 2).
- Wylogowanie w jednej przeglądarce nie wylogowuje drugiej

**Implementation Note**: Logowanie u dostawców przeprowadza Karol, nie agent (ekrany logowania obcych serwisów). Przed fazą 3 pauza na potwierdzenie Karola.

---

## Faza 3: Ekran logowania i porządki

### Overview

Przyciski dostawców na górze karty, kreska, formularz z hasłem, nowa stopka i błąd serwera nad przyciskami. Rejestracja znika, a `/auth/signup` przekierowuje. Stany trafiają do kitchen sinka, zrzuty do oceny Karola.

### Changes Required:

#### 1. Przyciski dostawców

**File**: `src/components/auth/ProviderButtons.tsx` (nowy), `src/components/auth/ProviderIcons.tsx` (nowy)

**Intent**: Dwa pełnej szerokości przyciski `Button variant="outline"` z monochromatycznymi ikonami w `currentColor` i stanem „Przekierowuję…”. Działają bez JS, bo to zwykły POST formularza.

**Contract**:
- Osobny `<form method="POST" action="/api/auth/oauth">` dla każdego dostawcy, z `<input type="hidden" name="provider">`.
- Wspólny stan oczekiwania z `useSubmitPending`: klikniętemu przyciskowi `Spinner` i „Przekierowuję…”, oba przyciski zablokowane. Powrót „Wstecz” z bfcache odblokowuje przyciski.
- Klikniętego dostawcę `ProviderButtons` trzyma we własnym `useState`, ustawianym w `onSubmit`. Spinner pokazuje się przy `pending && clicked === provider`, więc reset `pending` z bfcache gasi też spinner. Hook `useSubmitPending` się nie zmienia.
- Prop `preview` (wzór z `SignInForm.tsx:15-22`) dla kitchen sinka, np. oczekiwanie na wybranego dostawcę.
- Ikony: ścieżki SVG Discorda i Google z Simple Icons (CC0), `fill="currentColor"`, `aria-hidden`.

#### 2. Karta logowania

**File**: `src/components/auth/SignInCard.astro`, `src/components/auth/SignInForm.tsx`, `src/pages/auth/signin.astro`

**Intent**: Układ z wywiadu: przyciski na górze, kreska „albo e-mailem i hasłem”, formularz z hasłem, stopka „Nowe konto: przez Discord albo Google.”. Komunikat serwera przenosimy nad przyciski, bo dotyczy już obu dróg logowania.

**Contract**:
- `SignInCard` dostaje propsy `serverError?: string | null` i `providerPreview?`.
- Kolejność renderu: `ServerError` (statycznie, `role="alert"`), `ProviderButtons client:load`, kreska z `Separator` i tekstem `text-muted-foreground`, `<slot />` z formularzem.
- `SignInForm` traci prop `serverError` i render `ServerError`. Błędy pól i fokus na pierwszym błędnym polu zostają.
- Link „Załóż je” znika.
- Czytnik ekranu słyszy błąd serwera po przeładowaniu (nota F3 z przeglądu M2L5, archiwum `ui-signin-contract/change.md:22`). `role="alert"` obecny w HTML od załadowania strony większość czytników pomija, więc komunikat dostaje `tabindex="-1"` i znacznik `data-server-error`. Mały `<script>` w `SignInCard.astro` przenosi fokus na pierwszy taki element po załadowaniu strony. Ramka fokusu na komunikacie nie jest potrzebna, bo to nie element do klikania.
- Błąd pola słychać raz: `FormField` przekazuje do `FieldError` `role={undefined}` (props są rozwijane po `role="alert"`, `field.tsx:203-205`), bo fokus trafia na pole, które wskazuje błąd przez `aria-describedby`. `field.tsx` się nie zmienia.

**Adaptacja 07.10 (ocena zrzutów, Karol):** komunikat serwera jest pod przyciskami dostawców, a nie nad nimi. Kolejność renderu: `ProviderButtons`, `ServerError`, kreska, formularz. Karol chciał też formularz z hasłem nad przyciskami. Wybrał jednak przyciski na górze, bo po fazie 4 żaden prawdziwy host nie ma hasła i formularz zostaje tylko dla konta testowego smoke.

#### 3. Usunięcie rejestracji

**File**: usunąć `src/pages/api/auth/signup.ts`, `src/components/auth/SignUpForm.tsx`, `src/pages/auth/confirm-email.astro`, `src/pages/auth/signup.astro`; nowy `src/pages/auth/signup.ts`; `src/lib/auth-errors.ts`; `README.md`

**Intent**: Nowi hosci zakładają konto tylko przez dostawcę. Stare linki do rejestracji (`Topbar.astro`, `Welcome.astro`) prowadzą na logowanie bez zmian w plikach S-01.

**Contract**:
- `src/pages/auth/signup.ts`: `GET` odpowiada `context.redirect("/auth/signin")` (302). Endpoint, a nie `.astro`, bo wczesny `return` w frontmatterze `.astro` wywraca ESLint.
- `MESSAGES` traci klucze używane tylko przez rejestrację: `user_already_exists`, `email_exists`, `weak_password`. Komentarz pliku przestaje mówić o rejestracji.
- Noty z `change.md` o rejestracji (hybryda, fokus w `SignUpForm`) są zamknięte przez usunięcie. Nota o czytniku ekranu dotyczy formularza, który zostaje, i zamyka ją pkt 2.
- `README.md`, tabela tras (`:146-148`): bez `/auth/confirm-email`; `/auth/signup` opisane jako przekierowanie na logowanie; `/auth/signin` jako logowanie przez Discord, Google albo hasło.

#### 4. Strona ze stanami

**File**: `src/pages/dev/ui-kitchen-sink.astro`

**Intent**: Wszystkie stany nowego ekranu obok siebie. Tymczasowa sekcja z fazy 2 znika.

**Contract**: sekcje:
- domyślny (hover i focus-visible na przyciskach dostawców);
- błąd pól;
- błąd serwera nad przyciskami: `access_denied` oraz `invalid_credentials`;
- oczekiwanie na dostawcę („Przekierowuję…”);
- ładowanie formularza z hasłem;
- „pusty: nie dotyczy”.

Tekst wstępu opisuje, że kliknięcie przycisku dostawcy naprawdę prowadzi do dostawcy.

#### 5. Skan literałów i smoke

**File**: `scripts/ui-literals.mjs`, `scripts/smoke.mjs`

**Intent**: Nowe pliki widoków są skanowane. Smoke pilnuje przekierowania rejestracji.

**Contract**:
- Pliki w `src/components/auth` skanuje już `readdirSync`. Do `VIEWS` dopisujemy tylko nowe pliki widoków spoza tego katalogu, jeśli powstaną.
- Nowy krok smoke: `GET /auth/signup` daje 302 na `/auth/signin`.

#### 6. Zrzuty do oceny

**File**: `context/changes/one-click-host-login/screens/` (nowy katalog)

**Intent**: Karol ocenia wygląd na dużych zrzutach, bez zabierania mu okna.

**Contract**:
- Headless Chrome (wzór z `ui-signin-contract`), szerokość desktop i 390 px.
- Zrzuty:
  - `/auth/signin` domyślny;
  - `/auth/signin?error=access_denied`;
  - kitchen sink;
  - fokus na przycisku Discord.
- Strona HTML z sekcją „Co oceniasz / czego nie oceniasz”, otwierana w Chrome Karola.

### Success Criteria:

#### Automated Verification:

- Bramka przechodzi: `npm run lint` (z `ui-literals: 0 literals`), `npx astro check`, `npm run build`
- Smoke lokalny kończy się „All smoke steps passed”, z krokiem `/auth/signup` → `/auth/signin`
- `git grep -nE "auth/signup|SignUpForm|confirm-email" -- src scripts` zwraca tylko linki w `Topbar.astro` i `Welcome.astro` oraz krok `/auth/signup` w `scripts/smoke.mjs`
- `/dev/ui-kitchen-sink` daje 200 na dev i 404 w `npm run preview`
- Po załadowaniu `/auth/signin?error=invalid_credentials` fokus jest na komunikacie serwera, a `FieldError` nie ma `role="alert"` (skrypt CDP w headless Chrome)

#### Manual Verification:

- Karol ocenia zrzuty desktop i 390 px: kolejność, przyciski i ikony, kreska, stopka, błąd nad przyciskami, „Przekierowuję…”, fokus, brzmienie komunikatów
- Karol klika lokalnie oba przyciski: widać „Przekierowuję…”, a „Wstecz” z ekranu dostawcy odblokowuje przyciski

**Implementation Note**: Po fazie 3 pauza na potwierdzenie Karola, zanim PR i wdrożenie.

---

## Faza 4: Produkcja i test na telefonach

### Overview

PR z gałęzi worktree S-05, zielone CI, scalenie za zgodą Karola (to jest wdrożenie), smoke na produkcji i test na telefonach z ustaloną z góry reakcją na awarię w przeglądarce Discorda.

### Changes Required:

#### 1. PR i wdrożenie

**File**: brak zmian w kodzie

**Intent**: Kod trafia na produkcję tylko za zgodą Karola. Każde polecenie publikujące jest w ask (`AGENTS.md`, Hard Rules).

**Contract**:
1. Przed pushem bramka (lint, check, build) i lessons wpis 3: uruchomić zmieniony kod.
2. `git push` gałęzi (ask), PR do `main`, CI `ci` i `smoke` zielone.
3. Scalenie za zgodą Karola.
4. Po wdrożeniu `BASE_URL=https://most-likely-to.charlesonthewave.workers.dev SMOKE_OAUTH=1 npm run smoke`.

#### 2. Test na telefonach

**File**: `context/changes/one-click-host-login/phone-test.md` (nowy)

**Intent**: Sprawdzić ryzyko krytyczne z recenzji: przeglądarkę wbudowaną w Discorda, WebView przy Google (`disallowed_useragent`) i czas 300 s.

**Contract**: macierz w pliku:
- urządzenia: telefon Karola (Android) i telefon z iOS;
- przeglądarki: link z wiadomości na Discordzie (przeglądarka Discorda) i zwykła przeglądarka;
- dostawcy: Discord i Google;
- dodatkowo jedno logowanie dłuższe niż 300 s.

Przy każdej próbie: wynik, czas i zrzut przy błędzie. Gdy telefonu z iOS nie ma, wpisujemy „niesprawdzone” jako ryzyko.

#### 3. Reakcja na awarię w przeglądarce Discorda (warunkowo)

**File**: `src/components/auth/SignInCard.astro`

**Intent**: Jeśli logowanie pada w przeglądarce Discorda, host dostaje prostą wskazówkę, bo zgadywanie przeglądarki po nagłówku `User-Agent` jest zawodne.

**Contract**: tylko gdy test to wykaże. Pod przyciskami stały tekst `text-muted-foreground`, np. „Logowanie nie działa? Otwórz stronę w Chrome lub Safari.”. Osobny commit, PR i wdrożenie za zgodą, potem powtórka zawodzącej próby.

### Success Criteria:

#### Automated Verification:

- CI na PR zielone (`ci` i `smoke` z kontem testowym na lokalnym Supabase)
- Smoke na produkcji z `SMOKE_OAUTH=1` kończy się „All smoke steps passed”
- `/dev/ui-kitchen-sink` na produkcji daje 404

#### Manual Verification:

- Karol loguje się na produkcji na laptopie Discordem i Google
- Test na telefonach wg macierzy, wyniki w `phone-test.md`
- Logowanie dłuższe niż 300 s kończy się polskim komunikatem na ekranie logowania
- Podpowiedź o Chrome i Safari wdrożona i sprawdzona na telefonie, albo w `phone-test.md` zapisane „nie dotyczy”

**Implementation Note**: Od fazy 2 Karol gra jako host przez Discorda (decyzja 07.10). Jego konto z hasłem jest na adresie z pracy, który pasek u góry pokazałby ekipie na telewizorze. Po teście na telefonach Karol sprawdza, że loguje się Discordem, i usuwa to konto w Authentication → Users.

---

## Testing Strategy

### Unit Tests:

- Brak frameworka testów (AGENTS.md, Testing). Mapę kodów sprawdza smoke przez adresy przekierowań, a teksty przegląda Karol w kitchen sinku.

### Integration Tests:

- `npm run smoke` lokalnie po każdej fazie. W CI na lokalnym Supabase z kontem testowym zakładanym w workflow. Na produkcji z `SMOKE_OAUTH=1` po wdrożeniu.
- Sonda `npm run live-probe` lokalnie z małymi parametrami po fazie 1, żeby sprawdzić logowanie kontem testowym.

### Manual Testing Steps:

1. Panel Supabase po fazie 1: 2 konta, „Confirm email” ON, Site URL i Redirect URLs.
2. Lokalnie: Discord i Google na `localhost:4321`, `127.0.0.1:4321` i porcie 4322, anulowanie zgody, wylogowanie lokalne.
3. Zrzuty i klikanie przycisków (stan „Przekierowuję…”, „Wstecz”).
4. Produkcja: laptop, potem telefony wg macierzy, logowanie dłuższe niż 300 s.

## Performance Considerations

Brak nowych kosztów na żądanie. Callback dokłada jedno wywołanie Supabase przy logowaniu, a middleware i tak woła `getUser()` przy każdym żądaniu.

## Migration Notes

- Usunięcie kont w panelu Supabase jest nieodwracalne. Robi to Karol po obejrzeniu listy. Konto Karola i konto testowe zostają.
- Brak migracji bazy. Wycofanie zmiany wymaga: wyłączenia dostawców w panelu, przywrócenia rejestracji (revert faz 3 i 2) i decyzji, czy „Confirm email” zostaje ON. Zostawienie go ON jest bezpieczne.

## References

- Research: `context/changes/one-click-host-login/research.md`
- Roadmapa: `context/foundation/roadmap.md` (S-05, Parked: rejestracja z hasłem)
- Wzorzec endpointu: `src/pages/api/auth/signin.ts:6-31`
- Mapa błędów: `src/lib/auth-errors.ts:5-33`
- Stan oczekiwania: `src/components/auth/useSubmitPending.ts:5-19`
- Kontrakt UI i kitchen sink: `context/archive/2026-10-04-ui-signin-contract/` (`ui-checks.md`, `theme.md`)
- Stan wdrożenia: `context/deployment/deploy-plan.md`
- Nauczki: `context/foundation/lessons.md` (wpis 1: ask; wpis 3: uruchom kod po poprawkach)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Porządek w Supabase i stałe konto testowe

#### Automated

- [x] 1.1 Bramka przechodzi: `npm run lint`, `npx astro check`, `npm run build` — bc5867c
- [x] 1.2 Smoke lokalny kończy się „All smoke steps passed” bez zakładania konta — bc5867c
- [x] 1.3 Smoke bez danych konta kończy się kodem 1 i komunikatem z nazwą zmiennej — bc5867c
- [x] 1.4 Sonda lokalnie z małymi parametrami loguje się kontem testowym i kończy pomiar — bc5867c
- [x] 1.5 `git grep -n "api/auth/signup" -- scripts` nic nie zwraca — bc5867c
- [x] 1.9 Po pushu `main` CI zielone (`ci` i `smoke` z kontem testowym) — bc5867c
- [x] 1.10 Smoke na produkcji kończy się „All smoke steps passed” na koncie testowym — bc5867c

#### Manual

- [x] 1.6 Karol wykonał kroki w panelu Supabase w podanej kolejności — bc5867c
- [x] 1.7 Authentication → Users pokazuje 2 konta, także po smoke i sondzie — bc5867c
- [x] 1.8 Karol loguje się na produkcji swoim e-mailem i hasłem po włączeniu „Confirm email” — bc5867c

### Phase 2: Logowanie przez dostawcę (serwer)

#### Automated

- [x] 2.1 Bramka przechodzi: `npm run lint`, `npx astro check`, `npm run build` — 71d2d9b
- [x] 2.2 Smoke lokalny kończy się „All smoke steps passed”, z nowymi krokami OAuth — 71d2d9b
- [x] 2.3 Smoke lokalny z `SMOKE_OAUTH=1` dochodzi do discord.com i accounts.google.com — 71d2d9b
- [x] 2.4 `git grep -niE "GOCSPX|client.?secret" -- src scripts` nic nie zwraca — 71d2d9b

#### Manual

- [x] 2.5 Karol loguje się lokalnie Discordem i Google na trzech adresach deweloperskich i trafia na `/` zalogowany — 71d2d9b
- [x] 2.6 Anulowanie zgody u Discorda i u Google kończy się polskim komunikatem — 71d2d9b
- [x] 2.7 Logowanie dostawcą na adres konta Karola daje to samo `user_id` — 71d2d9b
- [x] 2.8 Wylogowanie w jednej przeglądarce nie wylogowuje drugiej — 71d2d9b

### Phase 3: Ekran logowania i porządki

#### Automated

- [x] 3.1 Bramka przechodzi: `npm run lint` (z `ui-literals: 0 literals`), `npx astro check`, `npm run build` — 1bcdb9d
- [x] 3.2 Smoke lokalny kończy się „All smoke steps passed”, z krokiem `/auth/signup` → `/auth/signin` — 1bcdb9d
- [x] 3.3 `git grep` rejestracji zwraca tylko linki w plikach S-01 i krok smoke — 1bcdb9d
- [x] 3.4 `/dev/ui-kitchen-sink` daje 200 na dev i 404 w `npm run preview` — 1bcdb9d
- [x] 3.7 Po załadowaniu z `?error=` fokus jest na komunikacie serwera, a `FieldError` nie ma `role="alert"` — 1bcdb9d

#### Manual

- [x] 3.5 Karol ocenia zrzuty desktop i 390 px — 1bcdb9d
- [x] 3.6 Karol klika lokalnie oba przyciski: „Przekierowuję…” i odblokowanie po „Wstecz” — 1bcdb9d

### Phase 4: Produkcja i test na telefonach

#### Automated

- [ ] 4.1 CI na PR zielone (`ci` i `smoke`)
- [ ] 4.2 Smoke na produkcji z `SMOKE_OAUTH=1` kończy się „All smoke steps passed”
- [ ] 4.3 `/dev/ui-kitchen-sink` na produkcji daje 404

#### Manual

- [ ] 4.4 Karol loguje się na produkcji na laptopie Discordem i Google
- [ ] 4.5 Test na telefonach wg macierzy, wyniki w `phone-test.md`
- [ ] 4.6 Logowanie dłuższe niż 300 s kończy się polskim komunikatem
- [ ] 4.7 Podpowiedź o Chrome i Safari wdrożona i sprawdzona albo „nie dotyczy”
