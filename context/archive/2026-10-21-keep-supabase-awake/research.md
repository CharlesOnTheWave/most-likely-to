---
date: 2026-10-21T08:24:54Z
researcher: Claude (Opus 5.5) z Karolem
git_commit: 3b8d050
branch: keep-supabase-awake
repository: CharlesOnTheWave/most-likely-to
topic: "Codzienne zapytanie z GitHub Actions, żeby darmowy Supabase nie usypiał (roadmapa, Open Question 9, opcja 2)"
tags: [research, supabase, github-actions, deployment, keep-awake]
status: complete
last_updated: 2026-10-21
last_updated_by: Claude (Opus 5.5)
---

# Research: zapytanie z GitHub Actions, które nie pozwala Supabase zasnąć

**Date**: 2026-10-21T08:24:54Z
**Researcher**: Claude (Opus 5.5) z Karolem
**Git Commit**: 3b8d050 (`origin/main` po scaleniu #11)
**Branch**: keep-supabase-awake
**Repository**: CharlesOnTheWave/most-likely-to

## Research Question

21.10.2026 Karol wybrał opcję 2 z roadmapy (Open Question 9, `context/foundation/roadmap.md:308`): cykliczne zapytanie zamiast ręcznego budzenia albo planu Pro. Workflow GitHub Actions z harmonogramem ma pukać do produkcyjnej bazy, żeby darmowy projekt Supabase nie usypiał po 7 dniach.

Do ustalenia:

- jakim zapytaniem pukać, żeby to była „user database activity” i żeby nie śmieciło w logach;
- gdzie trzymać adres i klucz;
- jak działają limity GitHuba;
- jak sprawdzić, że działa;
- gdzie zapisać decyzję;
- jakie reguły repo obowiązują (lekcja „ask”, PR dla `.github/workflows/`).

## Summary

- **Czym pukać:** `POST <SUPABASE_URL>/rest/v1/rpc/room_link` z kluczem publishable w nagłówku `apikey` i ciałem `{"p_link_token":"<zmyślony kod w formacie 22 znaków [A-Za-z0-9_-]>"}`.
  - Funkcja jest `stable`. Przy kodzie we właściwym formacie robi jeden odczyt `public.rooms` po `link_token` i dla nieznanego kodu oddaje `{"status":"unknown"}`. Niczego nie zapisuje ani nie loguje (`supabase/migrations/20261014101922_first_live_round.sql:384-421`).
  - Ma grant dla `anon` (`:801`).
  - Pozostałe sprawdzone kandydatury są gorsze:
    - `room_lobby` przez Workera pisze linię `warn` (`src/pages/api/rooms/[id]/lobby.ts:34`);
    - `GET /` bez sesji nie dotyka Supabase;
    - odczyt tabeli przez `anon` kończy się błędem 42501 w logu Postgresa;
    - `join_room` i `cast_vote` to ścieżki gry.
- **Adres i klucz:** repo nie ma dziś żadnych sekretów ani zmiennych Actions (`gh secret list` i `gh variable list` puste, 21.10).
  - `ci.yml:25-27` odwołuje się już do `secrets.SUPABASE_URL` i `secrets.SUPABASE_KEY`, które dziś są puste.
  - W `astro.config` obie zmienne mają `access: "secret"`, więc build ich nie wkleja (`astro.config.mjs:19-20`).
  - Dodanie tych dwóch sekretów (klucz tylko `sb_publishable_…`, AGENTS.md) to zmiana zdalnego stanu GitHuba, za zgodą Karola.
- **GitHub (dokumentacja „Events that trigger workflows”):**
  - `schedule` działa tylko na gałęzi domyślnej i w UTC;
  - o pełnych godzinach bywa opóźniony, a przy dużym obciążeniu zadanie może przepaść;
  - w publicznym repo harmonogram wyłącza się po 60 dniach bez aktywności w repo;
  - `workflow_dispatch` działa dopiero, gdy plik jest na gałęzi domyślnej. Pierwszy ręczny test jest więc możliwy dopiero po scaleniu.
- **Supabase (dokumentacja „Project Pausing”):**
  - projekt usypia po 7 dniach z niewystarczającą „user database activity”;
  - „typically a few user requests to the database each day” wystarcza, a wywołania API też się liczą;
  - tydzień przed uśpieniem właściciel dostaje mail;
  - budzenie to „Resume project” w panelu.
  - Dokumentacja nie definiuje progu, więc jedno zapytanie dziennie może być na granicy.
- **Gdzie zapisać decyzję:**
  - `roadmap.md:308` (OQ 9; zmiany w roadmapie przez `/10x-roadmap`, za zgodą);
  - `infrastructure.md:188` (rejestr ryzyk, wiersz 1);
  - `deploy-plan.md:204` („Poza tym planem”, wzór „→ data: …”);
  - `test-plan.md:53-55` i `:321` („Re-evaluate if pojawi się monitoring”).
- **Reguły:**
  - `.github/workflows/` zmieniamy tylko przez PR z zielonym CI (AGENTS.md:10);
  - lekcja „ask” (`lessons.md:5-10`) obejmuje workflow, który dotyka bazy produkcyjnej. `.claude/settings.json` nie ma dziś żadnej reguły dla `gh`.

## Detailed Findings

### Czym pukać do bazy

Kandydaci (badacz A, kotwice sprawdzone):

- **`room_link` wprost przez REST** (`20261014101922_first_live_round.sql:384-421`; grant `:801`). Wcześniejsza wersja i jej grant: `20261007122858_room_lobby.sql:269, :377`.
  - Zły format kodu: `{"status":"unknown"}` bez dotykania tabeli (`:394-396`). Taka próba może nie liczyć się jako aktywność bazy, więc kod musi mieć poprawny format.
  - Poprawny format: `select … from public.rooms where link_token = …` (`:398-400`), potem `unknown` (`:402-404`).
  - Brak zapisu, brak `raise`, brak logu w funkcji.
  - Przypadkowe trafienie w prawdziwy kod: kody mają 22 znaki z alfabetu 64 znaków, więc praktycznie niemożliwe. Gdyby jednak się zdarzyło, odpowiedź zawiera `room_id`. Workflow nie powinien więc drukować ciała odpowiedzi, tylko kod HTTP i pole `status`.
- **`room_lobby` wprost** (`20261015122252_full_game_evening.sql:403`, grant `:543`). Losowy uuid bez tokenu daje jeden odczyt po kluczu głównym i `null` (HTTP 200). Też czyste, ale nazwa sugeruje pokój. `room_link` jest prostszy.
- **`join_room` i `cast_vote`**: ścieżki dołączania i głosu. Przy złym tokenie `join_room` rzuca 22023, więc w logu Postgresa pojawia się ERROR. `cast_vote` to głos, czyli źle wygląda przy zasadzie anonimowości. Odrzucone.
- **Odczyt tabeli przez `anon`**: brak grantów (`20261007122858_room_lobby.sql:58`, `first_live_round.sql:33-34`), więc 42501 i błąd w logu. Odrzucone.
- **Przez Workera:**
  - `GET /`: middleware woła `readUser` (`src/middleware.ts:11`). Bez sesji auth-js kończy lokalnie, bez zapytania. Zero ruchu do Supabase, czyli nie budzi.
  - `GET /api/rooms/<uuid>/lobby` i `/r/<uuid>`: `room_lobby`, a potem `logEvent("warn", …)` (`lobby.ts:34`, `r/[id].astro:33`). Codzienna linia `warn` w logach. Odrzucone.
  - `GET /j/<kod 22 znaki>`: `room_link` (`src/pages/j/[token].astro:30`), bez `logEvent`, odpowiedź 404 „Nie znamy tego linku.”. Zostaje automatyczny wpis Workers Logs (`wrangler.jsonc`, `observability.enabled`), a całość zależy od działania Workera. To zapas, gdyby bezpośredni REST nie zadziałał.
- **Nagłówki dla klucza publishable:** `@supabase/supabase-js` 2.116.0 mówi, że klucze `sb_publishable_…` „must never be sent as a Bearer token — they belong only in the `apikey` header” (`node_modules/@supabase/supabase-js/dist/index.cjs:264-270`). Sam domyślnie dokłada Bearer, chyba że ustawiono `omitApiKeyAsBearer` (`:292-299`). Dla `curl` wystarczy więc `apikey: <klucz>` i `Content-Type: application/json`. Pierwsze ręczne uruchomienie po scaleniu to potwierdzi (oczekiwane HTTP 200 i `{"status":"unknown"}`).
- **Wzór w repo:** żaden skrypt nie składa nagłówków ręcznie, wszystkie idą przez `createClient` (`tests/db/support/clients.ts:15`, `scripts/live-sync-probe.mjs:164`). Strażnik formatu klucza (`startsWith("sb_publishable_")`) jest w `src/lib/supabase.ts` i `tests/db/support/env.ts`. Workflow potrzebuje własnego: odmowa, gdy klucz nie zaczyna się od `sb_publishable_`.

### Adres, klucz i ustawienia repo (badacz B, `gh` tylko do odczytu)

- **Sekrety i zmienne:** `gh secret list` i `gh variable list` (21.10, sprawdzone też przeze mnie) nie zwracają nic. Nie ma środowisk.
- **Repo:** publiczne, gałąź domyślna `main`, `default_workflow_permissions: read`. `main` nie ma ochrony gałęzi, więc zasada PR jest konwencją z AGENTS.md, a nie blokadą GitHuba.
- **`ci.yml`:**
  - jedyny workflow, triggery `push` i `pull_request` do `main` (`:3-7`);
  - brak `permissions:`, `concurrency:`, `schedule` i `workflow_dispatch`;
  - akcje przypięte tagami (`actions/checkout@v4` itd.).
- **Sekrety w CI:** `ci.yml:25-27` przekazuje `secrets.SUPABASE_URL` i `secrets.SUPABASE_KEY` do kroku build. Obie zmienne mają `access: "secret"` (`astro.config.mjs:19-20`), więc build ich nie wkleja, a odczyt jest w czasie działania. Dodanie sekretów o tych nazwach nie zmieni artefaktu buildu w CI. Wdrażanego Workera i tak buduje osobno Workers Builds.
- **Widoczność w logach:** w publicznym repo zmienne Actions są widoczne w logach, a sekrety maskowane. Klucz publishable jest jawny z założenia (trafia do przeglądarki), ale jako sekret nie pojawi się w publicznym logu.
- **Lint:** nic nie sprawdza plików `.yml`. Hooki lintują tylko `[cm]?[jt]sx?|astro` (`.claude/hooks/lib.mjs:15`), a w CI nie ma actionlint.

### GitHub Actions: harmonogram i ręczne uruchomienie

Dokumentacja GitHuba („Events that trigger workflows”, sekcje `schedule` i `workflow_dispatch`, odczyt 21.10):

- `schedule` uruchamia się tylko na gałęzi domyślnej i domyślnie w UTC. Najkrótszy odstęp to 5 minut.
- Opóźnienia przy dużym obciążeniu, zwłaszcza o pełnych godzinach; „some queued jobs may be dropped”. Minuta inna niż `:00` zmniejsza to ryzyko.
- „In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days.” Ponowne włączenie to przycisk w zakładce Actions, `gh workflow enable` albo commit, który zmienia harmonogram.
- `workflow_dispatch` działa dopiero, gdy plik jest na gałęzi domyślnej. Przed scaleniem nie da się więc uruchomić zadania ręcznie. W PR sprawdzi go tylko składnia: GitHub odrzuci zły YAML. Żadne zadanie z gałęzi się nie uruchomi.
- Uwaga, nie sprawdziłem tego: powiadomienia o nieudanych zadaniach z harmonogramem idą do osoby, która ostatnio zmieniła harmonogram. Czerwone zadanie dałoby więc Karolowi maila, jeśli projekt mimo wszystko zaśnie albo klucz przestanie działać.

### Supabase: co się liczy jako aktywność

- Dokumentacja „Project Pausing” (odczyt 21.10):
  - projekt jest nieaktywny, gdy „does not receive sufficient user database activity over the past week”;
  - „typically a few user requests to the database each day over the previous week is enough”;
  - aktywność dają też wejście w panel i „making API calls to your project or sending requests via your connected application”;
  - mail ostrzegawczy przychodzi około tydzień przed uśpieniem;
  - budzenie to „Resume project”;
  - przywrócenie jest możliwe „up to 1 year after it was paused” (nagłówek sekcji mówi jeszcze o 90 dniach).
- Progu dokumentacja nie podaje. Jedno zapytanie dziennie może być za mało („a few … each day”). Kilka zapytań na dobę jest bezpieczniejsze, a w publicznym repo minuty Actions nic nie kosztują.
- Wewnętrzny pg_cron (`close-stale-games` co godzinę, `20261014101925_close_stale_games.sql:42`) według planu „nie chroni projektu przed uśpieniem” (`context/archive/2026-10-13-first-live-round/plan.md:771`). Nikt tego nie sprawdził w praktyce. Uśpienie z 04.10 (`context/archive/2026-09-27-live-sync-spike/change.md:14`) było przed powstaniem pg_crona (14.10), więc niczego tu nie rozstrzyga.

### Gdzie zapisać decyzję (badacz C)

- **`context/foundation/roadmap.md`:**
  - `:308`, Open Question 9 (Owner: Karol, opcje, „decyzja przed pierwszym prawdziwym wieczorem”);
  - żadne pytanie z tej listy nie zostało dotąd zamknięte. Rozstrzygnięcia zapisywano w punktach „Unknowns” slice’ów, np. `:94` „Rozstrzygnięte w F-01 (2026-10-04): …” i `:173`;
  - frontmatter ma `updated: 2026-10-18`;
  - zmiany w roadmapie przez `/10x-roadmap`, za zgodą Karola (`C:\Users\karol\Desktop\10xdevs-gra.md`).
- **`context/foundation/infrastructure.md`:**
  - `:147`, Unknown Unknowns: projekt usypia po 7 dniach;
  - `:184`, rejestr ryzyk z kolumnami `Risk | Source | Likelihood | Impact | Mitigation`;
  - `:188`, wiersz 1, Mitigation: „Przed pierwszą prawdziwą grą wybrać jedno: … cykliczne zapytanie (Cron Trigger; najpierw sprawdzić zasady Supabase) …”;
  - `:227`, link do dokumentacji.
- **`context/deployment/deploy-plan.md`:**
  - `:191`, „Sytuacje brzegowe”, punkt o „Paused” przy logowaniu; zostaje bez zmian;
  - `:204`, „Poza tym planem”, punkt o usypianiu. Precedens zamknięcia to podpunkt „→ <data> (…): …” (`:198`, `:207`).
- **`context/foundation/test-plan.md`:**
  - `:53-55`: uśpienie poza mapą ryzyk testów;
  - `:321` (§7): „zamiast testu lista kontrolna … Re-evaluate if pojawi się monitoring albo płatny plan”. Czerwone zadanie z maila to lekki sygnał, więc to zdanie warto uaktualnić.

### Reguły repo

- **AGENTS.md:**
  - zmiany w `.github/workflows/` tylko przez PR z zielonym CI (`:10`);
  - lista „ask” wymienia git push, wrangler i `supabase db` (`:9`), nie ma na niej `gh`;
  - klucz tylko publishable.
- **Lekcja** (`context/foundation/lessons.md:5-10`) każe dodać regułę `ask` dla workflow, który w środku zmienia stan zdalny albo bazę. Tu dotyczy to:
  - `gh workflow run` (zdalne zadanie pukające do produkcyjnej bazy);
  - `gh workflow enable|disable`;
  - `gh secret` i `gh variable` (zmiana ustawień repo).
- **`.claude/settings.json`:** ani jednej reguły dla `gh` (allow `:3-18`, ask `:19-53`).
- **Luka spoza repo:** lokalne `.claude/settings.local.json` (git-ignored) pozwala na `Bash(gh api *)` i `Bash(gh run *)`, więc `gh api -X POST …/dispatches` przeszłoby bez pytania. Reguła `ask` w stylu `Bash(gh api -X *)` nie złapie `gh api <ścieżka> -X POST`. To plik maszyny Karola, poza zmianą w repo.
- **`tests/hooks/agent-hooks.test.ts`** czyta `settings.json` tylko dla komend hooków (`:15`, `:333`). Nowe reguły `ask` nie wymagają zmian w teście.

## Code References

- `supabase/migrations/20261014101922_first_live_round.sql:384-421`: `room_link`, odczyt po `link_token`, `unknown` bez zapisu
- `supabase/migrations/20261014101922_first_live_round.sql:801-802`: granty `room_link` i `room_lobby` dla `anon`
- `src/pages/api/rooms/[id]/lobby.ts:34`: linia `warn` przy nieznanym pokoju (powód odrzucenia)
- `src/pages/j/[token].astro:26-30`: format kodu, potem `room_link`
- `src/middleware.ts:11`: `readUser` bez zapytania przy braku sesji
- `node_modules/@supabase/supabase-js/dist/index.cjs:264-299`: klucz `sb_publishable_` należy do nagłówka `apikey`
- `.github/workflows/ci.yml:3-7, 25-27`: triggery CI i puste dziś sekrety
- `astro.config.mjs:19-20`: `SUPABASE_URL` i `SUPABASE_KEY` jako `access: "secret"`
- `.claude/settings.json:3-53`: allow i ask, brak `gh`
- `context/foundation/lessons.md:5-10`: lekcja o regule `ask`

## Architecture Insights

- **Bezpośrednio do Supabase, nie przez Workera:** pukanie nie zależy od kodu gry ani od wdrożeń Workera i nie zostawia wpisów w logach Workera. Wybór funkcji `stable` i tylko do odczytu, z istniejącym grantem dla `anon`, nie wymaga migracji.
- **Czerwone zadanie jako sygnał:** jeśli zadanie sprawdza kod HTTP i `status == "unknown"`, każda awaria daje czerwony przebieg: uśpiony projekt, zły klucz, zmiana funkcji. To brakujący dotąd lekki monitoring, o który pyta `test-plan.md:321`.
- **Zapas ręczny:** punkt „panel nie pokazuje Paused” zostaje na liście przed wieczorem (`deploy-plan.md:191`), na wypadek wyłączenia harmonogramu po 60 dniach.

## Historical Context (from prior changes)

- `context/archive/2026-09-27-live-sync-spike/change.md:14`: projekt zasnął 04.10.2026 po 7 dniach bez ruchu. Zniknął DNS i nie działało logowanie, Karol obudził projekt w panelu. Realtime wrócił kilka minut po DNS i Auth. Twierdzenie poparte, bo to zapis zdarzenia.
- `context/archive/2026-10-07-room-lobby/research.md:217`: cytat „a few user requests to the database each day” i odłożenie decyzji do OQ 9. Zgodne z dokumentacją z 21.10.
- `context/archive/2026-10-13-first-live-round/plan.md:771`: pg_cron „nie chroni projektu przed uśpieniem”. To ocena z planu, nie sprawdzona w praktyce. Zgodna z brzmieniem dokumentacji („user” activity).
- Kilka planów (`2026-10-04-ui-signin-contract`, `2026-10-04-one-click-host-login`, `2026-10-10-testing-lobby-foundation`) miało warunek wstępny „projekt nie śpi przed smoke”. Przy tamtych zmianach uśpienie było realnym, powtarzającym się kłopotem.
- Cloudflare Cron Trigger (`infrastructure.md:188`) nie był rozważany dalej, a `wrangler.jsonc` nie ma `triggers`. GitHub Actions nie wymaga zmian we Workerze ani `wrangler deploy`.

## Related Research

- `context/archive/2026-10-07-room-lobby/research.md` (sekcja o usypianiu, `:217`)
- `context/foundation/infrastructure.md` (rejestr ryzyk, pre-mortem `:143`)

## Open Questions

Wybory do planu (decyzje Karola, z moimi propozycjami):

1. **Częstotliwość:** raz dziennie, czy kilka razy na dobę? Propozycja: co 6 godzin o nieokrągłej minucie (np. `17 */6 * * *`), bo dokumentacja mówi o „kilku zapytaniach dziennie”, a GitHub może pojedyncze zadanie upuścić.
2. **Nazwy sekretów:** te same `SUPABASE_URL` i `SUPABASE_KEY`, których `ci.yml` już oczekuje (propozycja), czy osobne?
3. **Kto dodaje sekrety:** Karol w ustawieniach repo (klucz z panelu Supabase lub z `.dev.vars`), czy agent przez `gh secret set` za zgodą? Wartość klucza nie powinna trafić do rozmowy ani logów agenta.
4. **Zakres reguł `ask`:** `gh workflow run|enable|disable`, `gh secret`, `gh variable`. Co z lokalnym `gh api *` (plik maszyny Karola, poza repo)?
5. **Zapis w roadmapie:** zamknięcie OQ 9 przez `/10x-roadmap` w tej zmianie, czy osobno?

Luki: nie sprawdziłem, czy samo REST/RPC z kluczem publishable i bez Bearer przechodzi na produkcji. Pierwsze ręczne uruchomienie po scaleniu ma to potwierdzić, a zapasem jest `GET /j/<kod>` przez Workera. Nie potwierdziłem też w dokumentacji GitHuba, kto dostaje mail o nieudanym zadaniu z harmonogramem.
