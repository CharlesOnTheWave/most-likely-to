---
date: 2026-10-07T09:54:13Z
researcher: Claude (Opus 5.5) z Karolem
git_commit: bc5867c
branch: main
repository: most-likely-to
topic: "Pokój i poczekalnia (S-01, US-01, FR-002, FR-005): wymagania, co już jest w kodzie, drogi dla tożsamości gościa, zapisu i aktualizacji na żywo, styk z S-05"
tags: [research, s-01, room-lobby, supabase, realtime, guest-identity, s-05]
status: complete
last_updated: 2026-10-07
last_updated_by: Claude (Opus 5.5)
---

# Research: pokój i poczekalnia (S-01)

**Date**: 2026-10-07T09:54:13Z
**Researcher**: Claude (Opus 5.5) z Karolem
**Git Commit**: bc5867c
**Branch**: main
**Repository**: most-likely-to

## Research Question

Co S-01 (`room-lobby`) musi dostarczyć według PRD i roadmapy? Na czym może się oprzeć w obecnym kodzie (F-01, F-02, logowanie)? Jakie są drogi dla tożsamości gościa, zapisu pokoi i graczy oraz dla „host widzi dołączających na żywo” przy naszych ograniczeniach: serwer ma tylko klucz publishable, jeden projekt Supabase jest wspólny dla rozwoju i produkcji, a wszystko stoi na darmowych planach? Gdzie S-01 styka się z S-05 (`one-click-host-login`) przy pracy równoległej w osobnych worktree (M2L6)?

Research zbiera fakty i opcje. Wyboru dokonuje `/10x-plan` razem z Karolem.

## Summary

- **Zakres S-01.** Zalogowany host tworzy pokój, wybiera kategorie i przy każdej osobno decyduje o pytaniach 18+, a potem dostaje link. Gość otwiera link na telefonie bez konta i wpisuje nick; zajęty nick jest odrzucany. Host widzi dołączających na żywo (`roadmap.md:115-125`, `prd.md:55-59,84,94-96,161-162`). Poza S-01 zostają: start, głosowanie i odsłona (S-02), powrót po odświeżeniu (S-04), współhost, spóźnieni oraz usunięcie gracza z nowym linkiem (S-07–S-09) i lista gier (S-13).
- **Warstwa danych nie istnieje.** Brak `supabase/migrations/`, brak tabel i polityk RLS, a w `src/` nie ma wywołań `.from(` ani `.rpc(` (przeszukane grepem 07.10). Nie ma też tożsamości gościa, kodów pokoju ani endpointu tworzenia pokoju.
- **Technika na żywo jest gotowa i sprawdzona.** Dzwonek z F-01 to publiczny kanał Broadcast `live-sync:<room>`: serwer dzwoni przez `httpSend`, a telefony po dzwonku pobierają stan z serwera. Na produkcji przy 1 pokoju × 20 graczy × 10 prób 100% doręczeń zmieściło się w 2 s, najwolniejsze w 247 ms (`context/archive/2026-09-27-live-sync-spike/measurements.md:23`).
- **Trzy decyzje techniczne dla planu** (fakty w sekcjach 5–7):
  1. **Tożsamość gościa.** Do wyboru: losowe ciasteczko httpOnly z endpointu dołączenia (podpowiedź F-01), konta anonimowe Supabase albo sesje Astro w KV.
  2. **Zapis gościa do bazy.** Do wyboru: funkcja `security definer` wołana kluczem publishable albo klucz secret na serwerze. Zapisy hosta mogą iść zwykłym RLS jako `authenticated`, bez żadnej z tych dróg (wniosek z modelu ról, sekcja 6).
  3. **Lista graczy u hosta na żywo.** Do wyboru: dzwonek + stan z serwera (wzór F-01), Presence albo broadcast z bazy.
- **Otwarte pytania produktowe**, o których PRD milczy:
  - zasady nicku;
  - nick hosta (host też głosuje, `prd.md:170`);
  - czas życia pokoju i kilka pokoi naraz;
  - format linku;
  - domyślne kategorie;
  - co widzi gość w poczekalni;
  - wejście po starcie, zanim powstanie S-08.
- **Styk z S-05.**
  - Konflikty scalania grożą w czterech plikach: `scripts/smoke.mjs`, `src/pages/dev/ui-kitchen-sink.astro`, tabela tras w `README.md` i ewentualnie `scripts/ui-literals.mjs`.
  - Kontrakt: przekierowanie zalogowanego z `/auth/*` należy do S-01 (D2) i musi przepuszczać `/auth/signin?error=…`, bo S-05 kieruje tam błędy logowania, a Supabase błędy stanu OAuth.

## Detailed Findings

### 1. Wymagania i granice (PRD, roadmapa)

- **Przepływ US-01:**
  1. Host loguje się i klika „nowa gra”.
  2. Wybiera kategorie i dostaje link, który wkleja na Discordzie.
  3. Widzi, jak goście dołączają.
  4. Gość otwiera link na telefonie, wpisuje nick i „jest w pokoju”.

  Źródło: `prd.md:55-59`. Kliknięcie „start” z kroku 4 PRD należy do S-02 (`roadmap.md:129`).
- **FR-002:** gość wchodzi linkiem z nickiem, bez konta, a pokój odrzuca zajęty nick (`prd.md:84`). Uzasadnienie: duplikaty są „rare in practice”, a wyciek linku łata przyjmowanie spóźnionych (FR-020) (`prd.md:85`).
- **FR-005:** host tworzy pokój, wybiera kategorie i przy każdej osobno decyduje o pytaniach 18+ (poprawka z 27.09). Dostaje link do udostępnienia. Liczby pytań przy wyborze nie są wymagane (`prd.md:94-96`).
- **Dostęp:** trasy hosta (panel, tworzenie pokoju) przekierowują niezalogowanego do logowania, a link do pokoju działa bez logowania. Tożsamość gościa „żyje w tej sesji” (`prd.md:161-162`).
- **Czasy:** host zakłada grę w mniej niż 5 minut (`prd.md:37`), gość dołącza w mniej niż 30 sekund bez instrukcji (`prd.md:47`). Liczba 2 s dotyczy odsłony (`prd.md:139`). Dla listy dołączających PRD mówi tylko „na żywo”.
- **Urządzenia i skala:**
  - przeglądarka telefonu i komputera, dwie ostatnie główne wersje (`prd.md:140`);
  - brak limitu graczy, a 20 to poziom, na którym sprawdzamy (`prd.md:141`).
- **Prywatność:**
  - o gościu zostaje tylko nick i głosy (`prd.md:143`), o hoście tylko e-mail (`prd.md:144`);
  - Hard Rules: nigdy nie zapisujemy pary „kto na kogo”; bez punktów, rankingów i timerów (`AGENTS.md:7-8`).
- **Język i dostępność:** tylko polski (`prd.md:187`). PRD nie ma wymogu dostępności. Obowiązuje kontrakt UI z `AGENTS.md` (sekcja UI): tokeny, bez literałów i stany na stronie ze stanami.
- **Poza S-01:**
  - S-02: start, losowanie, głos, odsłona (`roadmap.md:129`);
  - S-04: powrót po odświeżeniu z ochroną nicku (`roadmap.md:153-154`);
  - S-08: spóźnieni (FR-020, `prd.md:90`);
  - S-09: usunięcie gracza i nowy link (FR-004, `prd.md:88`);
  - S-13: lista gier i kasowanie;
  - nick zapamiętany w przeglądarce to v2 (`prd.md:163`).

### 2. Co S-01 dziedziczy z F-01 (technika na żywo)

- **Dzwonek.**
  - `POST /api/live-sync/ring` zwraca 401 bez `locals.user` (`src/pages/api/live-sync/ring.ts:8-10`).
  - `ringRoom` wysyła `bell { seq }` przez `channel.httpSend` z limitem 5 s, a przy błędzie zwraca `{ ok: false }`, co daje 502 (`src/lib/live-sync/server.ts:9-25`).
  - Używa klucza publishable z klienta serwerowego (`src/lib/supabase.ts:5-21`).
- **Temat i treść.**
  - Temat to `live-sync:<room>`, a `room` musi pasować do `^[a-z0-9-]{1,64}$` (`src/lib/live-sync/shared.ts:3-18`).
  - W temacie ani w treści dzwonka nie ma danych graczy (`context/archive/2026-09-27-live-sync-spike/plan.md:96-98`).
- **Kanał publiczny.** Żadna strona nie ustawia `private: true` (`server.ts:12`, `src/components/live-sync/LiveSyncDemo.tsx:59-60`). Dzwonić może każdy, kto ma klucz publishable, z pominięciem naszego endpointu (`server.ts:28-30`).
- **Zasada „dzwonek jest niezaufaną podpowiedzią”.** Pytanie wyliczane z `seq` to skrót prototypu. Od S-02 stan pochodzi wyłącznie z bazy (`server.ts:28-30`, archiwum `plan.md:101-103`).
- **Przeglądarka.**
  - URL i klucz dostaje z `GET /api/live-sync/config` (`config.ts:6-11`) albo w propsach (`src/pages/dev/live-sync.astro:8`).
  - `getPublicSupabaseConfig` zwraca `null`, gdy klucz nie zaczyna się od `sb_publishable_` (`src/lib/supabase.ts:25-29`).
  - Klient w przeglądarce służy tylko do Realtime (`persistSession: false` i podobne, `LiveSyncDemo.tsx:35-37`).
- **Odłożone wprost do S-01/S-02:**
  - tabele, zapis głosów (`security definer` albo klucz secret) i tożsamość gościa (ciasteczko) (archiwum `plan.md:68`);
  - kanały prywatne i konta anonimowe odrzucone w F-01 (archiwum `plan.md:70`);
  - strona testowa i endpoint dzwonka zostają na produkcji „do czasu S-01” (archiwum `plan-brief.md:63`);
  - „host też jest graczem”, więc zapis musi obsłużyć rolę `anon` i `authenticated` (archiwum `research.md:91`).
- **Pomiary na produkcji:**
  - 1×20×10: 100% w 2 s, najwolniej 247 ms;
  - 5×20 (100 graczy): najwolniej 598 ms (`measurements.md:23-24`);
  - niesprawdzone: iPhone/Safari, dane komórkowe, długi sen telefonu (`measurements.md:80-83`).

### 3. Co S-01 dziedziczy z F-02 (baza pytań)

- **Kategorie.** `CATEGORIES` to 8 kategorii `{ id, name }` (`src/data/questions.ts:21-30`): `na-co-dzien`, `imprezy`, `przyszlosc`, `wpadki-i-obciach`, `gry-i-internet`, `podroze-i-przygody`, `sport-i-wyzwania`, `praca-i-szkola`.
- **Liczby.** Policzone 07.10 skryptem po parach `category`/`adult` w `QUESTIONS`: po 27 pytań w każdej kategorii, razem 216. Pytań 18+ (`adult: true`) jest 57: po 7 w siedmiu kategoriach i 8 w `przyszlosc`.
- **Decyzja per kategoria.** Nagłówek pliku mówi, że host decyduje o pytaniach 18+ osobno w każdej kategorii (S-01) (`questions.ts:15-16`).
- **Import tylko na serwerze.**
  - Jedynym importem bazy pytań jest `src/lib/live-sync/server.ts:2` (przeszukane grepem w `src/`).
  - Reguła z `context/foundation/lessons.md` (wpis 2): pytania importujemy tylko w kodzie serwera.
  - `CATEGORIES` i `QUESTIONS` są w jednym module (`questions.ts:21,40`). Wyspa React nie powinna go importować; kategorie mogą przyjść jako props albo z osobnego modułu (wniosek).
- **Pytania w bazie.** F-02 przewiduje przeniesienie ich do Supabase „S-01 albo S-11”, z tymi samymi identyfikatorami (`context/archive/2026-09-27-starter-question-base/plan.md:34,197`). Identyfikator pytania nigdy się nie zmienia (`questions.ts:4-8`).

### 4. Tożsamość, dane i konfiguracja dziś

- **Host.** Middleware woła `getUser()` przy każdym żądaniu i wpisuje `locals.user` (`src/middleware.ts:7-16`). Chroniona jest tylko trasa z prefiksem `/dashboard` (`middleware.ts:4,18-22`).
- **Przekierowanie zalogowanego.** Nic nie przekierowuje zalogowanego z `/auth/*`. Należy to do S-01 (D2, `context/archive/2026-10-04-ui-signin-contract/research.md:106`).
- **Gość.** Mechanizmu brak:
  - jedynym zapisem ciasteczek w `src/` jest `src/lib/supabase.ts:16` (ciasteczka Supabase);
  - `Astro.session` nie jest używane;
  - adapter Cloudflare i tak włącza sterownik sesji na KV z bindingiem `SESSION` (`node_modules/@astrojs/cloudflare/dist/index.js:108-116`), a KV `most-likely-to-session` istnieje na produkcji (`context/deployment/deploy-plan.md:10`).
- **Konta anonimowe.** Lokalnie wyłączone (`supabase/config.toml`, `[auth]`, `enable_anonymous_sign_ins = false`). Stan w projekcie zdalnym niesprawdzony.
- **Klucze.** Środowisko ma dwie zmienne, `SUPABASE_URL` i `SUPABASE_KEY` (`astro.config.mjs:17-21`). W `src/` nie ma `service_role` ani `sb_secret`, więc serwer nie omija RLS. Każde zapytanie działa jako `anon` (gość) albo `authenticated` (zalogowany host) (archiwum `research.md:91`).
- **Baza.** Nie ma `supabase/migrations/`. Plik `supabase/seed.sql`, wskazany w `config.toml`, też nie istnieje. Nie ma tabel, polityk RLS ani polityk na `realtime.messages`.
- **CI.**
  - Smoke w CI dostaje jako `SUPABASE_KEY` lokalny `ANON_KEY` (`.github/workflows/ci.yml:42,46`). Według pomocnika nie zaczyna się on od `sb_publishable_`, więc `getPublicSupabaseConfig` zwróci tam `null`. Wydruku CLI nie sprawdziłem.
  - Realtime jest w CI wyłączony (`ci.yml:41`, `-x … realtime`).
  - Skutek: smoke w CI nie sprawdzi niczego, co wymaga Realtime albo publicznej konfiguracji.
- **Strona testowa F-01 na produkcji.** `/dev/live-sync` nie ma blokady trybu deweloperskiego (`src/pages/dev/live-sync.astro:1-12`), w przeciwieństwie do strony ze stanami (`src/pages/dev/ui-kitchen-sink.astro:9-12`). Jest więc dostępna na produkcji, zgodnie z decyzją „do czasu S-01”.

### 5. Tożsamość gościa: fakty o opcjach

| Opcja | Fakty | Źródło |
| --- | --- | --- |
| Losowe ciasteczko httpOnly z endpointu dołączenia, odczytywane w middleware do `locals.guestId` | Podpowiedź z F-01: `crypto.randomUUID()`, `httpOnly`, `sameSite: "lax"`, `secure`. Nie wymaga KV ani kont. W bazie trzymamy hash tokenu. | archiwum `research.md:124-127`, `:93-102` |
| Konta anonimowe Supabase (`signInAnonymously`) | Wiersz w `auth.users` z rolą `authenticated` i claimem `is_anonymous`. Limit 30 na godzinę na IP; serwer Workera dzieliłby jeden adres między wszystkich gości. Brak automatycznego sprzątania. Zalecana CAPTCHA. Wliczanie do MAU niejasne. | https://supabase.com/docs/guides/auth/auth-anonymous, archiwum `external-research.md:85-97` |
| Sesje Astro (KV `SESSION`) | Darmowy KV: 1000 zapisów dziennie, najwyżej 1 zapis na sekundę na klucz. Spójność ostateczna, zmiana może być widoczna dopiero po „60 seconds or more”. Każde żądanie z `session.set()` to jeden zapis. Na stan pokoju się nie nadaje. | https://developers.cloudflare.com/kv/platform/limits/, https://developers.cloudflare.com/kv/concepts/how-kv-works/, archiwum `research.md:121` |

Ciasteczko gościa z S-01 jest podstawą S-04 (powrót na swój nick, „weryfikacja” z FR-011, `prd.md:105`) i S-02 (jeden głos na gracza). To wniosek z zależności w roadmapie (`roadmap.md:153-154`).

### 6. Zapis do bazy: fakty o opcjach

- **Host.** Klient serwerowy z ciasteczkami Supabase działa dla zalogowanego hosta jako `authenticated` (archiwum `research.md:91`). Tworzenie pokoju i wybór kategorii może więc chronić zwykłe RLS (np. `host_id = auth.uid()`), bez nowego klucza i bez funkcji `security definer` (wniosek; plan to potwierdzi).
- **Gość** (rola `anon`):
  - **(a) Funkcja `security definer`.**
    - Wymagania: `set search_path = ''`, nazwy z prefiksem schematu, odebranie `EXECUTE` od `public` i `anon` oraz nadanie wybiórcze (https://supabase.com/docs/guides/database/functions).
    - Funkcja z `EXECUTE` dla `anon` w schemacie wystawionym przez API jest dostępna pod `/rest/v1/rpc/<nazwa>` dla każdego z kluczem publishable. Advisor (lint 0028/0029) dopuszcza to przy starannej walidacji wejścia. Przewodnik RLS mówi: „Never create one in a schema listed under Exposed schemas” (https://supabase.com/docs/guides/database/postgres/row-level-security). Między tymi dwoma dokumentami jest napięcie.
    - Lokalnie wystawione są schematy `public` i `graphql_public` (`supabase/config.toml`, `[api]`).
    - Nie wymaga nowego sekretu.
  - **(b) Klucz secret `sb_secret_…` na serwerze.**
    - Działa jako `service_role` (omija RLS), o ile żądanie nie niesie tokenu użytkownika. Dokumentacja wskazuje go dla serwerów z własną kontrolą uprawnień. W przeglądarce Supabase go odrzuca (https://supabase.com/docs/guides/api/api-keys).
    - U nas wymaga: nowej zmiennej w `astro.config.mjs`, wpisu w `.dev.vars`, `npx wrangler secret put` (ask, od razu wdraża) i zmian w `AGENTS.md` (Hard Rules o kluczach) (archiwum `research.md:93-102`).
    - Sprawdzanie uprawnień przenosi się do kodu TS, a wyciek klucza otwiera cały projekt.
- **Ograniczenia z F-01 dla przyszłych głosów** (S-02, ale schemat z S-01 może je ułatwić albo utrudnić): flagi „oddał głos” osobno od liczników, bez `created_at` i kolejnych ID, tabele głosów poza publikacją Realtime (archiwum `research.md:104-110`).

### 7. Lista graczy u hosta na żywo: fakty o opcjach

- **Dzwonek + stan z serwera (wzór F-01).**
  - Po dołączeniu gościa serwer dzwoni na temat pokoju, a ekran hosta pobiera listę z serwera (z bazy).
  - Sprawdzone na produkcji (sekcja 2).
  - Dziś tylko zalogowany może dzwonić przez nasz endpoint (`ring.ts:8`). Przy dołączeniu gościa dzwoni serwer w endpoincie dołączenia, nie przeglądarka gościa (wniosek).
- **Presence.**
  - Spójność ostateczna. Zdarzenie `sync` może nieść `join` i `leave` „even though no users are joining or leaving”.
  - Darmowy plan: 20 wiadomości Presence na sekundę i 10 kluczy w obiekcie (https://supabase.com/docs/guides/realtime/presence, https://supabase.com/docs/guides/realtime/limits).
  - Pokazuje „kto jest teraz online”, a nie „kto dołączył do pokoju” w bazie.
- **Broadcast z bazy.**
  - Działa przez `realtime.send(payload, event, topic, private)`, a `private` domyślnie to `true`. Wiadomość publiczna trafia tylko do kanałów publicznych.
  - Partycje `realtime.messages` tworzy klient WebSocket, więc bez wcześniejszego połączenia `realtime.send` może zgłosić błąd partycji.
  - Dostępność na darmowym planie: żadne źródło jej nie wyklucza ani nie potwierdza (https://supabase.com/docs/guides/realtime/broadcast).
- **Limity darmowego planu Realtime:**
  - 200 równoczesnych połączeń, 100 wiadomości na sekundę, 100 dołączeń do kanałów na sekundę (https://supabase.com/docs/guides/realtime/limits);
  - broadcast liczy się jako 1 + N wiadomości (N odbiorców);
  - 2 mln wiadomości miesięcznie (https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages, https://supabase.com/pricing).

### 8. Ekrany i UI

- **Strona `/`.**
  - Pokazuje tylko starterowe `Welcome.astro` (`src/pages/index.astro:6-8`) z przyciskami Sign In i Sign Up dla wszystkich. Używa literałów kolorów i `bg-cosmic` (`src/components/Welcome.astro:5-40`).
  - `Topbar.astro:6-32` pokazuje zalogowanemu jego e-mail, link `/dashboard` i Sign out.
  - `dashboard.astro` to zaślepka startera.
- **Gdzie ląduje zalogowany host.** Po zalogowaniu hasłem trafia na `/` (`src/pages/api/auth/signin.ts:31`). Po S-05 callback dostawcy też prowadzi na `/` (`context/changes/one-click-host-login/plan.md`, faza 2, pkt 3). Co pokazuje `/` zalogowanemu hostowi, decyduje S-01.
- **Kontrakt UI.**
  - Skan literałów obejmuje `src/pages/auth/signin.astro`, `src/pages/dev/ui-kitchen-sink.astro` i każdy plik w `src/components/auth/` (`scripts/ui-literals.mjs:6-11`).
  - Pozostałe widoki (`index`, `Welcome`, `Topbar`, `dashboard`, `Banner`) są poza kontraktem.
- **Klocki shadcn.**
  - Są w `src/components/ui/`: alert, button, card, field, input, input-group, label, separator, spinner, textarea.
  - Do wyboru kategorii i 18+ zapewne potrzebne będą checkbox albo switch, a może badge (wniosek; `npx shadcn@latest add`).
- **Odłożone z M2L5 do S-01:**
  - słabe ramki pól, R4 (`context/archive/2026-10-04-ui-signin-contract/ui-checks.md:47`; „głównym elementem będzie pole na nick gościa”);
  - kolor hover przycisku, K1 (`ui-checks.md:52`; „zaprojektujemy razem z kolorem gry w S-01”).

### 9. Styk z S-05 (`one-click-host-login`)

S-05 w fazach 2–4 tworzy, zmienia albo usuwa pliki wymienione w `context/changes/one-click-host-login/plan.md`. Pliki, które S-01 też prawdopodobnie ruszy:

| Plik | S-05 | S-01 (prawdopodobnie) | Ryzyko konfliktu |
| --- | --- | --- | --- |
| `scripts/smoke.mjs` | nowe kroki OAuth, callback, `/auth/signup` (fazy 2–3) | kroki: utworzenie pokoju, dołączenie gościa | wysokie: ta sama tablica `steps` |
| `src/pages/dev/ui-kitchen-sink.astro` | tymczasowa sekcja (faza 2), przepisanie pod nowy ekran logowania (faza 3) | stany poczekalni | wysokie; mniejsze, jeśli S-01 dostanie osobną stronę stanów |
| `scripts/ui-literals.mjs` | dopisek tylko dla widoków spoza `src/components/auth` (faza 3) | nowe widoki | niskie, jeśli S-01 trzyma widoki w osobnym katalogu skanowanym przez `readdirSync` |
| `README.md` (tabela tras) | zmiana tras rejestracji (faza 3) | nowe trasy pokoju | wysokie: ta sama tabela |
| `src/pages/auth/signin.astro`, `SignInCard.astro`, `SignInForm.tsx` | przebudowa (fazy 2–4) | nic, jeśli przekierowanie zalogowanego idzie w middleware | wysokie tylko, gdy S-01 wstawi przekierowanie w te pliki |
| `src/middleware.ts`, `index.astro`, `Topbar.astro`, `Welcome.astro`, `dashboard.astro` | bez zmian (`plan.md`, „What We're NOT Doing”) | strona hosta, ochrona tras, przekierowanie z `/auth/*` | brak |
| `supabase/migrations/*`, nowe trasy i komponenty pokoju | bez zmian | nowe | brak |

**Kontrakty:**
- **Callback S-05.** Leży pod `/api/auth/callback`, a nie pod `/auth/*`, właśnie po to, żeby przekierowanie zalogowanych z S-01 go nie łamało (`one-click-host-login/plan.md`, faza 2, pkt 3). Sukces kończy się na `/`.
- **Błędy logowania S-05** wracają na `/auth/signin?error=<kod>`. Supabase wysyła błędy stanu OAuth na Site URL (`/auth/signin`) z parametrami `error` i `error_code` (`one-click-host-login/plan.md`, „Key Discoveries”).
- **Wyjątek w przekierowaniu.** Przekierowanie zalogowanego z `/auth/*` w S-01 musi przepuszczać adresy z `error` albo `error_code`, inaczej host z aktywną sesją nie zobaczy komunikatu. Żaden plan tego jeszcze nie zapisuje.
- **Smoke S-05** sprawdza błędy jako klient anonimowy, więc przekierowanie zalogowanych go nie dotyczy, dopóki działa tylko dla sesji.
- **Środowisko worktree.** Obie gałęzie potrzebują `.dev.vars` z kontem testowym (faza 1 S-05, `bc5867c`). Drugi serwer działa na porcie 4322 albo pod `127.0.0.1`, bo inaczej logowanie dostawcą odeśle na produkcję (`one-click-host-login/plan.md`, „Critical Implementation Details”).

### 10. Infrastruktura

- **Jeden projekt Supabase.** Migracje S-01 zmieniają bazę produkcyjną (`AGENTS.md`, Testing; `change.md`) i są nieodwracalne (`context/foundation/infrastructure.md:167`). Tabele muszą trafić na produkcję wcześniej niż kod, który ich używa, bo push na `main` od razu wdraża (archiwum `research.md:86-87`). Polecenia `npx supabase db *` i `migration up/down/repair` są w ask (`.claude/settings.json:33-36`).
- **Usypianie.** Darmowy projekt zasypia po 7 dniach małej aktywności. Wystarczy „a few user requests to the database each day” (https://supabase.com/docs/guides/platform/free-project-pausing). Decyzja, jak temu zapobiec, czeka przed pierwszym prawdziwym wieczorem (`roadmap.md:308`).
- **Cloudflare Workers (darmowy plan):** 100 tys. żądań dziennie, 10 ms CPU, 50 podżądań (`infrastructure.md:49-52`).

## Code References

- `src/lib/live-sync/server.ts:9-34`: dzwonek (`httpSend`, 5 s) i skrót „pytanie z `seq`” z komentarzem o zaufaniu.
- `src/lib/live-sync/shared.ts:3-18`: temat `live-sync:<room>`, walidacja `room` i `seq`.
- `src/pages/api/live-sync/{ring,state,config}.ts`: dzwonek tylko dla zalogowanych, stan i konfiguracja publiczne.
- `src/components/live-sync/LiveSyncDemo.tsx:35-81`: klient tylko Realtime, subskrypcja i pobieranie stanu.
- `src/lib/supabase.ts:5-29`: klient serwerowy z ciasteczkami, `getPublicSupabaseConfig`.
- `src/middleware.ts:4-22`: `locals.user`, ochrona `/dashboard`.
- `src/data/questions.ts:15-40`: zasady bazy pytań, `CATEGORIES`, typy.
- `scripts/ui-literals.mjs:6-11`: zakres skanu literałów.
- `scripts/smoke.mjs`: 7 kroków na koncie testowym (po `bc5867c`).
- `.github/workflows/ci.yml:41-46`: Supabase w CI bez Realtime, `SUPABASE_KEY` = `ANON_KEY`.
- `src/pages/dev/live-sync.astro:1-12`: strona testowa F-01 bez blokady DEV.

## Architecture Insights

- **Jedno źródło prawdy.** Wzór „dzwonek + stan z serwera” trzyma prawdę w bazie, a kanał jest tylko sygnałem „sprawdź”. Pasuje do listy graczy w poczekalni tak samo jak do rundy w S-02. Fałszywy dzwonek kosztuje najwyżej jedno zbędne pobranie stanu (wniosek z `server.ts:28-30`).
- **Furtka tylko dla gościa.** Host działa jako `authenticated` i jego zapisy mieszczą się w zwykłym RLS. Gość działa jako `anon`, więc jego dołączenie (i później głos) wymaga świadomej furtki: funkcji `security definer` albo klucza secret.
- **Fundament dla kolejnych slice'ów.** Tożsamość gościa z S-01 dziedziczą S-02 (jeden głos na gracza), S-04 (powrót na nick) i S-07–S-09 (role, usuwanie).
- **Link oddzielny od pokoju.** FR-004 wymaga nowego linku bez wyrzucania graczy (`prd.md:88`). Token linku powinien więc być oddzielny od identyfikatora pokoju (wniosek). Temat kanału nie powinien pochodzić z tokenu linku, bo nowy link nie może zmieniać kanału.

## Historical Context (from prior changes)

- `context/archive/2026-09-27-live-sync-spike/plan.md:68,70,96-107`: tabele, zapis i tożsamość gościa przekazane do S-01/S-02; kanał publiczny; dzwonek jako niezaufana podpowiedź. **Aktualne.**
- `context/archive/2026-09-27-live-sync-spike/research.md:86-127`: kolejność migracja → kod, opcje zapisu (a)/(b), ciasteczko gościa, KV nie na stan gry. **Aktualne.** Jedna różnica: odwołanie do `deploy-plan.md:161` (limit KV) wskazuje dziś linię 166.
- `context/archive/2026-09-27-live-sync-spike/plan-brief.md:62`: „Sonda i demo tworzą konta testowe”. **Nieaktualne dla sondy** od `bc5867c` (loguje się kontem testowym). Demo `/dev/live-sync` nie zakłada kont.
- `context/archive/2026-09-27-starter-question-base/plan.md:34,197`: pytania do bazy „S-01 albo S-11”, z tymi samymi identyfikatorami. **Aktualne, nierozstrzygnięte.**
- `context/archive/2026-10-04-ui-signin-contract/research.md:106` (D2), `ui-checks.md:47,52` (R4, K1): przekierowanie zalogowanego, strona hosta, ramki pól i kolor hover przekazane do S-01. **Aktualne.**
- `context/changes/one-click-host-login/plan.md`: callback → `/`, błędy → `/auth/signin?error=`, bez zmian w `middleware.ts`. **Aktualne** (07.10).

## Related Research

- `context/archive/2026-09-27-live-sync-spike/research.md` i `external-research.md`: technika na żywo, limity Realtime, konta anonimowe.
- `context/changes/one-click-host-login/research.md`: logowanie hosta, styk z S-01.

## Open Questions

**Produktowe (do wywiadu `/10x-plan` z Karolem):**
1. Zasady nicku: długość, dozwolone znaki, czy „Ola” i „ola” to ten sam nick, obcinanie spacji. PRD mówi tylko, że duplikat jest odrzucany (`prd.md:84-85`).
2. Nick hosta: host głosuje (`prd.md:170`), ale PRD nie mówi, jak dostaje nick.
3. Czas życia pokoju i kilka pokoi jednego hosta. Automatyczne kasowanie odrzucone, host kasuje sam (FR-019, `prd.md:146`).
4. Format linku i jego odgadywalność (sekcja „Architecture Insights”, FR-004).
5. Wybór kategorii: co jest domyślnie zaznaczone, czy wymagana co najmniej jedna, czy 18+ domyślnie wyłączone.
6. Co widzi gość w poczekalni, zanim host kliknie „start” (S-02).
7. Dołączenie po starcie, zanim powstanie S-08: blokada czy na razie bez ograniczeń.
8. Czy pytania trafiają do bazy już w S-01, czy pokój zapamiętuje tylko wybór kategorii i 18+, a losowanie (S-02) czyta z pliku po stronie serwera.

**Techniczne (decyzje w planie, z recenzją adwokata diabła i krytyka):**
9. Tożsamość gościa (sekcja 5).
10. Droga zapisu gościa (sekcja 6).
11. Aktualizacja listy graczy na żywo (sekcja 7).
12. Los `/dev/live-sync` i `POST /api/live-sync/ring`: usunąć, zablokować poza DEV czy przerobić na dzwonek pokoju.
13. Smoke w CI nie ma Realtime ani klucza `sb_publishable_` (sekcja 4): jak sprawdzić w CI tworzenie pokoju i dołączenie bez Realtime.

**Niesprawdzone:**
- stan przełączników w projekcie zdalnym (konta anonimowe, „Allow public access” dla Realtime);
- domyślne uprawnienia (`GRANT`) dla nowych tabel przy „automatycznym RLS” (archiwum `research.md:247`);
- czy CLI Supabase w CI wypisuje klucz `sb_publishable_` (np. `PUBLISHABLE_KEY`).

**Niespójności w dokumentach:**
- `roadmap.md:123` ma przy S-01 „Unknowns: —”, mimo pytań 1–8.
- Tabela „Backlog Handoff” jest nieaktualna: S-01 „Czeka na F-01 i F-02” (`roadmap.md:284`), S-05 „Zablokowane” (`roadmap.md:288`).
