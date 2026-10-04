---
date: 2026-09-27T14:35:30+02:00
researcher: Claude Code (claude-opus-5-5) z Karolem
git_commit: 8f3ad5a
branch: main
repository: CharlesOnTheWave/most-likely-to
topic: "Jak w obecnym kodzie zbudować prototyp F-01 w wariancie B (publiczny kanał Supabase Realtime jako „dzwonek” + stan pokoju z serwera)"
tags: [research, codebase, live-sync-spike, supabase-realtime, astro-env, middleware, migrations, anonymity]
status: complete
last_updated: 2026-09-27
last_updated_by: Claude Code (claude-opus-5-5)
---

# Research: prototyp F-01 w wariancie B w obecnym kodzie

**Date**: 2026-09-27T14:35:30+02:00
**Researcher**: Claude Code (claude-opus-5-5) z Karolem
**Git Commit**: 8f3ad5a (drzewo robocze: niezacommitowany folder `context/changes/live-sync-spike/`)
**Branch**: main
**Repository**: CharlesOnTheWave/most-likely-to

## Research Question

Jak w obecnym kodzie zbudować prototyp F-01 w wariancie B (Supabase Realtime: publiczny kanał jako „dzwonek” + stan pokoju pobierany z naszego serwera na Cloudflare Workers), zgodnie z decyzją w `context/changes/live-sync-spike/external-research.md`. Sześć pytań:

1. Klient Supabase dziś i droga klucza publishable do przeglądarki a reguła z AGENTS.md.
2. Gdzie trzymać stan pokoju i rundy (migracje, RLS) i jak bezpiecznie zapisywać głosy gości bez pary kto→na kogo.
3. Tożsamość gościa bez konta.
4. Symulacja 20 graczy i pomiar ≤ 2 s.
5. Wyspy React i wzorce UI.
6. Reguły ask, logi, CI oraz pytania z `src/data/questions.ts`.

Metoda: czterech równoległych pracowników tylko do odczytu (UI; klient Supabase i tożsamość; warstwa danych; pomiar, CI i uprawnienia), a potem synteza. Kotwice rozstrzygające dla planu sprawdziłem osobno: `astro.config.mjs:19-20`, `src/lib/supabase.ts:9`, `src/middleware.ts:4-12`, `wrangler.jsonc:1-15`, `deploy-plan.md:10,143`, `eslint.config.js:73-78`, `RealtimeClient.ts:462-473`, `supabase/config.toml:171,186`, `README.md:115`.

## Summary

- **Stan wyjściowy:** w sprawdzonym zakresie `src/` nie ma kodu realtime, stron gry, endpointów JSON ani klienta Supabase dla przeglądarki. Nie ma też katalogu `supabase/migrations/`. Prototyp buduje więc pierwszą wersję każdego z tych elementów.
- **Klucz do przeglądarki:** najmniej inwazyjna droga to strona `.astro`, która czyta `SUPABASE_URL` i `SUPABASE_KEY` z `astro:env/server` w czasie działania i przekazuje je wyspie React jako props. Zmienne `astro:env/client` są wpisywane do bundla przy buildzie. Na Workers Builds wymagałoby to zmiennych buildu, a te dla Supabase zakazuje `deploy-plan.md:143`. Obie drogi wymagają zmiany reguły `AGENTS.md:10`.
- **Tożsamość gościa:** binding KV `SESSION` dla sesji Astro istnieje już na produkcji (`deploy-plan.md:10`), ale w sprawdzonym zakresie `src/` nie ma użycia `Astro.session`. Najprostszy punkt zaczepienia to losowy identyfikator w ciasteczku httpOnly ustawiany w endpoincie dołączenia i odczytywany w middleware.
- **Zapis głosów gości:** są dwa podejścia i oba mają koszt:
  - funkcja Postgres `security definer` sprawdzająca token gościa: bez nowego sekretu, ale granicą zaufania staje się SQL wywoływalny z kluczem publishable;
  - klucz secret na serwerze: nowy sekret oznacza wdrożenie za zgodą i zmianę trzech dokumentów.

  Model danych bez pary to osobne flagi „zagłosował” i osobne liczniki. Istnieje jednak pułapka `xmin` (niżej).
- **Pomiar:** Node 24 ma globalny `WebSocket`, a realtime-js go używa. Sonda musi utworzyć 20 osobnych klientów, bo `channel()` zwraca istniejący kanał dla tego samego tematu (`RealtimeClient.ts:462-473`). Bez zmiany workflowu sonda nie ruszy w CI, bo job smoke uruchamia lokalny Supabase z wyłączonym realtime (`.github/workflows/ci.yml:41`).
- **Do rozstrzygnięcia w planie:**
  - czy spike w ogóle potrzebuje tabel w produkcyjnej bazie, czy wystarczy zmierzyć sam transport (dzwonek + pobranie stanu);
  - droga klucza do przeglądarki;
  - sposób zapisu głosów;
  - źródło konfiguracji dla sondy;
  - nowa reguła ask dla sondy.

## Detailed Findings

### 1. Klient Supabase dziś i klucz publishable w przeglądarce

- **Klient działa na serwerze.** W sprawdzonym zakresie `src/` (grep `createClient|createServerClient|createBrowserClient`) jedyną fabryką jest `createServerClient` z `@supabase/ssr` z ciasteczkami z nagłówka `Cookie` (`src/lib/supabase.ts:9-20`). Bez zmiennych zwraca `null` (`:6-8`).
- **Schemat env:** `SUPABASE_URL` i `SUPABASE_KEY` mają `context: "server", access: "secret", optional: true` (`astro.config.mjs:19-20`). Pracownik UI podał tu błędnie linie 26–27.
- **Middleware przy każdym żądaniu SSR, które przez nie przechodzi,** tworzy klienta i woła `auth.getUser()`, o ile zmienne Supabase są ustawione (`src/middleware.ts:6-12`). Wykonuje więc zapytanie sieciowe do Supabase Auth. Bez wyjątku w middleware dotyczy to też przyszłego endpointu stanu pokoju: każde pobranie stanu po dzwonku dostaje dodatkowe zapytanie, co ma znaczenie dla budżetu ≤ 2 s. Pliki statyczne z `ASSETS` nie były tu sprawdzane.
- **`App.Locals`** ma tylko `user` (`src/env.d.ts:1-5`).
- **Astro 7.3.2 dopuszcza** `client/public`, `server/public` i `server/secret` (`node_modules/astro/dist/env/schema.d.ts:69-80`). Dla zmiennych `public` wartość trafia do bundla jako literał przy buildzie (`astro/dist/env/vite-plugin-env.js:134-137`), a `server/secret` jest czytane w runtime z `env` Workera (`vite-plugin-env.js:142-150`). Tak wynika z tego jednego pliku w wersji 7.3.2.
- **Workers Builds nie ma `.dev.vars`.** `wrangler.jsonc` nie ma dziś `vars` (`wrangler.jsonc:1-15`), a `deploy-plan.md:143` mówi: „**nie** dodawać sekretów Supabase jako zmiennych builda”. Droga przez props z runtime omija ten problem.
- **Dokumenty do doprecyzowania przy zmianie reguły** (plan decyduje o treści):
  - `AGENTS.md:10`;
  - `README.md:76`, gdzie stoi „never exposed to the client”;
  - `context/foundation/infrastructure.md:127,160-162`;
  - `context/deployment/deploy-plan.md:9,143`.

  `CLAUDE.md` i `tech-stack.md` tej reguły nie zawierają.
- **Zewnętrznie** (`external-research.md`, sekcja o kluczu publishable): `SUPABASE_KEY` to klucz publishable, a Supabase opisuje go jako „Safe to expose online”.

### 2. Stan pokoju i rundy, migracje, zapis głosów

**Repo dziś:**
- `supabase/` zawiera `config.toml`, `.gitignore` i `.temp/cli-latest`. Nie ma `migrations/` ani `seed.sql`.
- `.temp` nie zawiera `project-ref`, więc CLI nie jest połączone z projektem zdalnym.
- `README.md:115` mówi: „No database tables or migrations are required”, a `roadmap.md:77` zapisuje bazę jako „bez schematu, migracji i tabel”.

**Konwencja migracji:**
- `npx supabase migration new <name>` i RLS z politykami dla każdej operacji (`AGENTS.md:28`).
- Migracji się nie cofa, poprawia się je kolejną (`infrastructure.md:167`).
- `db push` robi człowiek (`infrastructure.md:172`) i jest w ask (`.claude/settings.json:33`).
- Według `--help` (CLI 2.117.0) `migration new` tworzy tylko pusty plik, więc działa bez Dockera. Nie uruchamiałem go.

**Braki w ścieżce na produkcję:**
- Nigdzie nie opisano kroku `supabase link` → `db push`: `deploy-plan.md` nie ma kroku z bazą.
- Kolejność ma znaczenie: push na `main` od razu wdraża kod, a migracja trafia do bazy osobno. Tabele muszą więc być na produkcji wcześniej niż kod, który ich używa.

**Luka w uprawnieniach wobec `lessons.md:9`:** polecenia `npx supabase migration up/down/repair --linked` zmieniają bazę zdalną. Łapie je allow `Bash(npx *)` (`.claude/settings.json:5`), a ask ma tylko `npx supabase db` (`:33`).

**Role zapytań:** serwer używa klucza publishable z ciasteczkami (`src/lib/supabase.ts:9`). Gość bez ciasteczka Supabase działa jako `anon`, zalogowany host jako `authenticated` (`sb-api-keys.md:82-86`, scratchpad). Host też jest graczem, więc zapis głosu musi obsłużyć obie role albo użyć osobnego klienta bez ciasteczek.

**Dwa podejścia do zapisu głosów gości** (wybór należy do planu):
- **(a) Funkcja `security definer`.**
  - Tabele niedostępne dla `anon` przez API: RLS bez polityk dla anon albo schemat spoza `api.schemas`, a `config.toml:13` wystawia `public` i `graphql_public`.
  - Funkcje z `set search_path = ''` sprawdzają hash tokenu gościa.
  - Postgres domyślnie daje prawo `EXECUTE` roli `PUBLIC`, więc funkcjom pomocniczym trzeba je odebrać.
  - Bez nowego sekretu. Jeśli funkcja ma prawo `EXECUTE` dla `anon`, może ją wołać każdy, kto ma klucz publishable, z pominięciem Workera.
- **(b) Klucz secret na serwerze.**
  - Wymaga nowego pola w `astro.config.mjs:17-21`, wpisu w `.dev.vars` i `wrangler secret put`. To polecenie jest w ask i od razu wdraża (`infrastructure.md:150`).
  - Trzeba zmienić `AGENTS.md:10`, `infrastructure.md:162` i `deploy-plan.md:90`, a CI pobiera dziś tylko `API_URL|ANON_KEY` (`ci.yml:42`).
  - Sprawdzanie uprawnień przenosi się do kodu TS. Wyciek klucza otwiera cały projekt (`sb-api-keys.md:101`).

**Model bez pary kto→na kogo** (ograniczenia, nie schemat):
- flagi `(runda, gracz)` osobno i liczniki `(runda, cel, n)` osobno;
- bez `created_at` i bez kolejnych ID;
- bez dodawania tych tabel do publikacji Realtime (Postgres Changes);
- liczniki niewidoczne do odsłony, cel głosu tylko w treści POST.

`rpc(..., { get: true })` wkłada argumenty do URL-a (`node_modules/@supabase/postgrest-js/dist/index.mjs:3975-3990`), a Worker ma włączone logi (`wrangler.jsonc:12-14`).

**Pułapka `xmin`** (wniosek pracownika z wiedzy o Postgresie, niesprawdzony na bazie):
- Flaga i licznik zmienione w jednej transakcji dostają ten sam `xmin`. Osoba z dostępem SQL mogłaby wtedy powiązać ostatniego głosującego z celem, a kolejne transakcje dostają kolejne numery.
- Łagodzenie: przy odsłonie przepisać liczniki i usunąć flagi rundy, albo przyjąć to jako ryzyko w trakcie rundy.
- Dotyczy NFR „nigdy… możliwe do odzyskania, także przez hosta i twórcę gry” (`prd.md:143`).

### 3. Tożsamość gościa bez konta

- **Sesje Astro:** `astro.config.mjs` nie ustawia `session`, więc adapter włącza sterownik KV z bindingiem `SESSION` (`node_modules/@astrojs/cloudflare/dist/index.js:108-118`). Na produkcji binding wskazuje KV `most-likely-to-session`, który wrangler utworzył przy pierwszym wdrożeniu (`deploy-plan.md:10,108`).
- **Ciasteczko sesji:** `astro-session` jest httpOnly i sameSite lax (`astro/dist/core/session/runtime.js:6,82-86`). W `src/` nikt nie używa `Astro.session`.
- **KV nie nadaje się na stan gry:** „KV na darmowym planie ma niski dzienny limit zapisów” (`deploy-plan.md:161`), a do tego ma spójność ostateczną. Nadaje się najwyżej do identyfikatora gościa, nie do stanu pokoju.
- **Ochrona tras:** tylko prefiks `/dashboard` (`src/middleware.ts:4,18-22`).
- **Tokeny i losowość:** w sprawdzonym zakresie `src/` nie ma tokenów, `randomUUID` ani crypto. Jedyny zapis ciasteczek to `src/lib/supabase.ts:16`.
- **Punkty zaczepienia:**
  - endpoint dołączenia ustawia `context.cookies.set(…, crypto.randomUUID(), { httpOnly, sameSite: "lax", secure, path })`;
  - middleware wpisuje identyfikator do nowego pola `locals.guestId` (typ w `src/env.d.ts`);
  - opcjonalnie middleware pomija `getUser()` dla endpointu stanu pokoju.

### 4. Symulacja 20 graczy i pomiar ≤ 2 s

- **Wzorzec smoke:**
  - adres z `process.env.BASE_URL` (`scripts/smoke.mjs:4`), bez zależności (`:2`), globalny `fetch` i własny słoik ciasteczek (`:9-36`);
  - 8 kroków w tablicy (`:38-59`), PASS/FAIL i kod wyjścia 1 (`:61-75`);
  - uruchomienie przez `"smoke": "node scripts/smoke.mjs"` (`package.json:13`);
  - smoke nie czyta kluczy Supabase.
- **WebSocket w Node:**
  - lokalnie Node 24.19 ma globalny `WebSocket` (sprawdzone przez `typeof`);
  - realtime-js bierze natywny konstruktor (`@supabase/realtime-js/src/lib/websocket-factory.ts:67-69`) i ma `engines: node >=22`, więc `ws` nie jest potrzebne.
- **Wersja supabase-js:** w lockfile 2.116.0, a `package.json:23` dopuszcza `^2.99.1`. `httpSend` wymaga ≥ 2.107.0, więc warto podnieść dolną granicę.
- **20 osobnych klientów:** `RealtimeClient.channel()` zwraca istniejący kanał dla tego samego tematu (`node_modules/@supabase/realtime-js/src/RealtimeClient.ts:462-473`). Jeden klient z 20 subskrypcjami to więc jedno połączenie i jedna kopia wiadomości, a to fałszuje i opóźnienie, i licznik limitu.
- **Zegar:** jeden proces z `performance.now()` ma jeden zegar. `t0` trzeba brać w sondzie przed wywołaniem API, nie z Workera (wniosek pracownika, niesprawdzony).
- **`httpSend` zwraca 202,** czyli „przyjęte”, nie „dostarczone” (`RealtimeChannel.ts:944-983`).
- **Rozłączenia** można liczyć po statusie z `subscribe()` i przez `heartbeatCallback` (`RealtimeClient.ts:68`). Heartbeat idzie co 25 s (`:46`); czy liczy się do limitu 100/s, nie ustalono.
- **Test limitu:** według rachunku z `external-research.md` runda z 20 graczami to ok. 460 wiadomości, a przekroczenie wymaga ok. 6000 na minutę. Jedna sonda limitu nie przekroczy. Celowe przekroczenie obciążyłoby jedyny, produkcyjny projekt.
- **Źródło konfiguracji sondy:** `.dev.vars` ma nazwy `SUPABASE_URL` i `SUPABASE_KEY` (wartości nie czytano). Node ma `--env-file` i `process.loadEnvFile`. Reguła `AGENTS.md:10` wprost nie obejmuje skryptów. Wariant zgodny z B: sonda pobiera publiczną konfigurację z endpointu aplikacji, tak jak zrobi to przeglądarka.

### 5. Wyspy React i wzorce UI

- **Strony:**
  - `src/pages/index.astro` (Welcome);
  - `dashboard.astro`, chroniona i czytająca `Astro.locals.user` (`:4`);
  - `auth/signin`, `signup`, `confirm-email`;
  - API: `api/auth/signin|signup|signout.ts`, tylko `POST`.
- **Layout:** jeden, `src/layouts/Layout.astro` z propem `title` (`:6-10`) i `<slot />` (`:36`).
- **Wyspy:** dwie, obie `client:load`: `SignInForm` (`src/pages/auth/signin.astro:14`) i `SignUpForm` (`signup.astro:14`). Innych dyrektyw `client:*` w `src/` nie ma.
- **Dane do wysp** idą przez props z frontmattera (`signin.astro:5`). W komponentach nie ma `fetch()`, a formularze to natywny `POST` (`SignInForm.tsx:43`).
- **Wzorzec API:**
  - `export const POST: APIRoute` (`api/auth/signin.ts:4`), `formData()` z rzutowaniem (`:5-7`), odpowiedź przez `context.redirect` (`:11,16,19`);
  - brak precedensu dla odpowiedzi JSON, dla `GET`, dla `prerender` i dla dynamicznych tras `[id].astro`;
  - całość to SSR (`astro.config.mjs:11`).
- **shadcn:** w `src/components/ui/` jest tylko `button.tsx`.
- **Język:** UI po angielsku (`Layout.astro:14`, `SignInForm.tsx:21`). Po polsku są banery konfiguracji (`Layout.astro:24,29`) i treść pytań. Alias `@/*` wskazuje na `./src/*` (`tsconfig.json:9`), a `cn` jest re-eksportowane w `src/lib/utils.ts:1`.
- **Brak kodu gry:** w `src/` nie ma strony ani komponentu pokoju, rundy czy głosowania. Zakres: grep `room|pokój|runda|round|vote|głos|game|lobby|player|gracz|host`. Trafienia są tylko w treści `questions.ts` i w atrybutach SVG.

### 6. Reguły ask, logi, CI i pytania

**Uprawnienia** (`.claude/settings.json`):
- allow: `npm *`, `npx *`, `node *` (`:4-6`);
- ask: `curl`, `wget`, `git push`, `npx wrangler deploy/secret/rollback/versions deploy/delete`, `npx supabase db *` (`:19-33`);
- deny: `rm -rf *` (`:36`).

Pokryte już dziś: `npx supabase db push` i `npx wrangler secret put`. Według `lessons.md:9` nowej reguły ask wymagałaby sonda uruchamiana przez `npm run …` albo `node scripts/…`, jeśli zakłada pokoje lub głosy albo nadaje na projekt produkcyjny. Czy wzorce z `*` w środku i z prefiksem env pasują, pracownik nie był pewien.

**CI:**
- job `ci` na Node 22: `npm ci`, `astro sync`, `lint`, `astro check`, `build` (`.github/workflows/ci.yml:9-25`);
- job `smoke` stawia lokalny Supabase z `-x` wykluczającym realtime (`:41`);
- sonda nie uruchomi się w CI bez zmiany workflowu.

**Lint dla `scripts/`:**
- `eslint.config.js:73-78` wyłącza reguły z typami i `no-console`;
- globale to tylko `console, process, fetch, URLSearchParams` (`:76`);
- użycie `setTimeout`, `performance` czy `URL` w nowym `.mjs` wymaga dopisania globali, bo `no-undef` z eslint:recommended obejmuje `.mjs` (wniosek z konfiguracji, ESLinta nie uruchamiano);
- Prettier jest częścią lintu: printWidth 120, podwójne cudzysłowy, LF.

**Logi:**
- `observability.enabled: true` (`wrangler.jsonc:12-14`), a w sprawdzonym zakresie `src/` nie ma `console.*`;
- `no-console` to tylko ostrzeżenie (`eslint.config.js:25`);
- plan musi pilnować, żeby cel głosu nie trafił do URL, logów ani payloadu `httpSend` na publicznym kanale.

**Pytania:**
- `src/data/questions.ts`: `CATEGORIES` (8, `:21-30`), `QuestionEntry { category, text, adult }` (`:34-38`), `QUESTIONS` jako jeden literał (`:40-716`);
- 216 pytań (159 zwykłych, 57 z `adult: true`, według liczenia pracownika);
- w `src/` i `scripts/` nikt ich nie importuje;
- zgodnie z `lessons.md:12-16` prototyp importuje pytania tylko po stronie serwera, a do wyspy trafia tekst jednego pytania jako zwykły tekst.

## Code References

- `astro.config.mjs:11` — `output: "server"`.
- `astro.config.mjs:17-22` — schemat env; `SUPABASE_URL`/`SUPABASE_KEY` jako `server`/`secret` (`:19-20`).
- `src/lib/supabase.ts:3,9-20` — import z `astro:env/server`, `createServerClient` z ciasteczkami.
- `src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard"]`.
- `src/middleware.ts:6-12` — klient i `auth.getUser()` przy każdym żądaniu SSR przechodzącym przez middleware (gdy są zmienne Supabase).
- `src/env.d.ts:1-5` — `App.Locals` tylko z `user`.
- `src/pages/api/auth/signin.ts:4-19` — wzorzec endpointu (POST, formData, redirect).
- `src/pages/auth/signin.astro:5,14` — props z frontmattera do wyspy `client:load`.
- `src/data/questions.ts:21-38,40-716` — kategorie, typ wpisu, literał pytań.
- `wrangler.jsonc:1-15` — brak `vars`; `observability.enabled` (`:12-14`).
- `supabase/config.toml:13,81-82,171,186` — schematy API, realtime włączony, anonimowe logowanie wyłączone, limit 30/h (tylko lokalny stos).
- `scripts/smoke.mjs:4,9-36,38-75` — wzorzec skryptu z BASE_URL, ciasteczkami, krokami i kodem wyjścia.
- `eslint.config.js:73-78` — konfiguracja lintu dla `scripts/**/*.mjs` i jej globale.
- `.github/workflows/ci.yml:9-25,41-42` — bramka CI; smoke bez realtime; pobierane klucze.
- `.claude/settings.json:4-6,19-33,36` — allow, ask i deny.
- `node_modules/@supabase/realtime-js/src/RealtimeClient.ts:462-473` — `channel()` zwraca istniejący kanał tego samego tematu.
- `node_modules/astro/dist/env/vite-plugin-env.js:134-150` — publiczne zmienne wpisywane przy buildzie, sekretne czytane w runtime.

## Architecture Insights

- **Serwer jako źródło prawdy** pasuje do obecnego kodu: w sprawdzonym zakresie `src/` klient Supabase jest tylko serwerowy (`src/lib/supabase.ts:9`), a strony dostają dane przez props z frontmattera. W wariancie B przeglądarka potrzebuje tylko drugiego, minimalnego klienta do subskrypcji kanału; stan dalej przychodzi z serwera.
- **W repo jest brama jakości, ale nie ma bramy dla bazy.** CI sprawdza lint, typy i build. Migracje nie mają opisanej ścieżki na produkcję, a CI uruchamia Supabase bez realtime. Pierwsza migracja będzie więc ustanawiać konwencję.
- **Anonimowość to ograniczenie w kilku warstwach naraz:** model danych (osobne flagi i liczniki, pułapka `xmin`), transport (publiczny kanał bez treści), HTTP (cel tylko w treści POST) i logi (`observability`).

## Historical Context (from prior changes)

- `context/archive/2026-09-27-starter-question-base/plan-brief.md:21`: „Plik TypeScript w repo, baza Supabase później”. Wspierane: pytania są w pliku, bez tabel.
- `context/archive/2026-09-27-starter-question-base/reviews/plan-review.md:61`: S-01 „i tak będzie potrzebować tabel na pokoje”. To wciąż aktualne i dotyczy S-01. Czy F-01 potrzebuje tabel, rozstrzyga plan.
- `context/foundation/infrastructure.md:195`: „Najpierw Supabase Realtime; Durable Objects dopiero wtedy, gdy test z 20 graczami go obali”. Wspierane i zgodne z decyzją ścieżki 1 w `external-research.md`.
- `context/foundation/infrastructure.md:162` i `context/deployment/deploy-plan.md:90`: `SUPABASE_KEY` to klucz publishable, nigdy secret/service_role. Wspierane: prefiks sprawdzony w tej zmianie bez wyświetlania wartości.
- `context/deployment/deploy-plan.md:161`: niski dzienny limit zapisów KV. Wspierane jako ostrzeżenie; tego limitu w tej zmianie nie weryfikowano.
- `context/changes/live-sync-spike/external-research.md`, sekcje „Recenzja” i „Decyzja”: liczby głosów dopiero przy odsłonie, własny głos tylko w przeglądarce gracza, ścieżka 1 wybrana 2026-09-27 z zastrzeżeniem Karola.

## Related Research

- `context/changes/live-sync-spike/external-research.md`: research zewnętrzny, kandydaci A/B/C, recenzja i decyzja.
- Poza tym brak innych plików `research.md` w `context/changes/**` i `context/archive/**` (sprawdzone listingiem 2026-09-27).

## Open Questions

1. **Zakres spike'a:** czy F-01 mierzy sam transport (dzwonek przez `httpSend` do 20 klientów + pobranie stanu z endpointu, bez tabel w produkcyjnej bazie), czy od razu buduje tabele pokoju, rundy i głosów, które S-01 i S-02 i tak będą potrzebować? Pierwsza wersja nie wymaga migracji na produkcji.
2. **Klucz w przeglądarce:** props z runtime czy `astro:env/client` ze zmiennymi buildu? Jak dokładnie przeredagować `AGENTS.md:10` (publishable dozwolony, secret nigdy)?
3. **Zapis głosów:** funkcja `security definer` czy klucz secret? Jeśli spike nie zapisuje głosów w bazie, decyzja przechodzi do S-02.
4. **Źródło konfiguracji sondy:** endpoint aplikacji czy `--env-file .dev.vars`? Czy sonda działa lokalnie, na produkcji, czy w obu miejscach?
5. **Nowa reguła ask** dla polecenia sondy według `lessons.md:9`. Czy przy okazji dopisać ask dla `npx supabase migration up/down/repair`?
6. **Middleware:** czy pominąć `auth.getUser()` dla endpointu stanu pokoju, żeby nie dokładać zapytania do budżetu ≤ 2 s?
7. **Niesprawdzone:**
   - czy heartbeaty i joiny liczą się do limitu 100/s;
   - co dokładnie zapisują Workers Logs i logi Supabase (URL, nagłówki);
   - domyślne uprawnienia `anon`/`authenticated` do nowych tabel w produkcyjnym projekcie („automatic RLS”, `deploy-plan.md:25`);
   - wersja Postgresa na produkcji;
   - pułapka `xmin` na realnej bazie.
