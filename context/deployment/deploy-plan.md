# Plan pierwszego wdrożenia: Most Likely To na Cloudflare Workers

## Stan po wdrożeniu (26.09.2026)

- **Gra:** https://most-likely-to.charlesonthewave.workers.dev
- **Kod:** https://github.com/CharlesOnTheWave/most-likely-to (publiczne repo), gałąź `main`.
- **Wdrażanie:** każdy push do `main` buduje i wdraża Cloudflare Workers Builds (`npm run build`, potem `npx wrangler deploy`). GitHub Actions (`ci`, `smoke`) tylko sprawdza kod i nie blokuje wdrożenia.
- **Worker `most-likely-to`** na koncie Cloudflare (plan Free), subdomena `charlesonthewave.workers.dev`:
  - sekrety `SUPABASE_URL` i `SUPABASE_KEY` (typ `secret_text`, klucz publishable), wgrane raz przez `npx wrangler deploy --secrets-file .dev.vars`; kolejne wdrożenia ich nie ruszają;
  - powiązania: `ASSETS` (pliki z `dist/client`), `IMAGES`, `SESSION` → KV `most-likely-to-session`. KV utworzył wrangler przy pierwszym wdrożeniu (sesje Astro), a Workers Builds używa tego samego.
- **Supabase:** projekt `most-likely-to` (Frankfurt), jedyny, więc wspólny dla rozwoju i produkcji.
  - → Od 07.10.2026 (S-05, faza 1): Confirm email **włączone** i ma takie zostać (wyłączone pozwala przejąć konto hosta przez logowanie dostawcą). Site URL `https://most-likely-to.charlesonthewave.workers.dev/auth/signin`, Redirect URLs `http://localhost:4321/**` i `http://localhost:4322/**`. W Authentication → Users są tylko 2 konta: Karola i testowe dla smoke (`SMOKE_EMAIL` w `.dev.vars`).
- **Wersje:** `c1c7a3b4` (ręczne wdrożenie), `4e3d91b8` (pierwsze z Workers Builds, commit `800c10d`). Próba cofnięcia `4e3d91b8 → c1c7a3b4 → 4e3d91b8` przeszła w kilka sekund.
- **Cofnięcie przy awarii:** `npx wrangler rollback` (ask) wraca do poprzedniej wersji. Nie cofa danych (KV, Supabase), a następny push do `main` znów wdroży najnowszy kod.

## Migracje Supabase (od 07.10.2026, S-01)

- **Połączenie CLI:** Karol raz uruchamia `npx supabase login` i `npx supabase link --project-ref xadljhxjgmckjlmsgmmj` (hasło do bazy wpisuje w podpowiedź, nie w czat). Stan połączenia leży w `supabase/.temp/` (poza gitem) katalogu, w którym je zrobiono, więc każdy worktree i nowy klon łączy się osobno.
- **Nowa migracja:** `npx supabase migration new <nazwa>`. Zasady dla tabel i funkcji są w `AGENTS.md` (Conventions).
- **Próba przed jedyną bazą:** bez Dockera lokalnie nie ma Postgresa. CI na PR do `main` (`supabase start`) wgrywa migracje na czystą bazę z `auto_expose_new_tables = false` i uruchamia smoke. Push gałęzi nie wdraża produkcji, choć Workers Builds wgrywa z niej wersję podglądową (`wrangler versions upload`).
- **Wgranie (ask, za zgodą Karola):** `npx supabase db push --dry-run` (lista plików do wgrania), `npx supabase db push`, potem `npx supabase migration list` (kolumny Local i Remote).
- **Nigdy SQL w panelu:** omija historię migracji i psuje następne `db push`. Wgranej migracji nie edytujemy; poprawka i wycofanie to nowa migracja.
- **Zmiana uprawnień w Supabase:** nowe tabele w `public` przestają dostawać uprawnienia dla `anon` i `authenticated` (istniejące projekty od 30.10.2026 według supabase/discussions#45329). Nasze migracje odbierają i nadają uprawnienia jawnie, więc działają przed zmianą i po niej.

## Context

Lekcja M1L5 kończy moduł 1: gra ma działać pod publicznym adresem.

- **Platforma:** decyzja zapisana w `context/foundation/infrastructure.md` (Cloudflare Workers, 2026-09-26).
- **Stack:** opisany w `context/foundation/tech-stack.md`.

**Stan na start:**

- **GitHub:** konto `CharlesOnTheWave`, jeszcze bez repozytorium gry.
- **Supabase:** projekt `most-likely-to` we Frankfurcie, z automatycznym RLS.
- **Cloudflare:** brak konta.
- **Narzędzia:** brak `gh`, wrangler 4.131.1 jest w projekcie.
- **Repo lokalne:** bez zdalnego repozytorium, a `wrangler.jsonc` ma jeszcze nazwę `10x-astro-starter`.

**Cel:**

- gra działa pod `https://most-likely-to.<subdomena>.workers.dev`;
- logowanie hosta korzysta z produkcyjnego Supabase;
- każdy push do `main` wdraża sam Cloudflare (Workers Builds);
- GitHub Actions tylko sprawdza kod;
- smoke przechodzi na publicznym adresie.

**Zasady obowiązujące w całym planie:**

- Sekrety nigdy nie przechodzą przez czat.
- Polecenia zmieniające produkcję wymagają Twojego „tak”, bo są w regułach ask: `wrangler deploy`, `secret`, `rollback`, `versions deploy`, `delete`, `git push`.
- Hasła, zgody OAuth i instalacje w systemie klikasz Ty. Agent otwiera strony w Chrome i patrzy na zrzuty ekranu.

Właściciel kroku: **Ty** albo **agent**. Zapis „(ask)” oznacza, że Claude Code zapyta Cię o zgodę przed uruchomieniem. Strzałka „→” opisuje, co wydarzyło się naprawdę, gdy różniło się od planu.

## Etap 0. Zapis planu

- [x] **Agent:** po zatwierdzeniu zapisuje ten plan w `context/deployment/deploy-plan.md`.

## Etap 1. Wymagania wstępne: konta i narzędzia

- [x] **Ty:** konto Cloudflare na dash.cloudflare.com/sign-up (plan Free) i potwierdzenie e-maila. Agent otwiera stronę w Chrome.
- [x] **Ty:** w panelu Workers & Pages sprawdź subdomenę `workers.dev` (Your subdomain → Change), np. `charlesonthewave`.
  - Będzie częścią adresu gry, a jej późniejsza zmiana zmienia adresy.
  - Ustawienie jej teraz chroni przed pytaniem wranglera przy pierwszym wdrożeniu.
  - → Cloudflare nadał sam `karol-5bb`; zmieniona na `charlesonthewave`.
- [x] **Ty:** `! npx wrangler login` w Claude Code. Otworzy się przeglądarka, a Ty zatwierdzasz dostęp.
  - → Token OAuth ma szerokie uprawnienia do całego konta (patrz „Decyzje na później”).
- [x] **Agent:** `npx wrangler whoami`, żeby sprawdzić, że to Twoje konto.
- [x] **Agent (po Twojej zgodzie, bo to instalacja programu):** `winget install --id GitHub.cli -e --source winget`. Windows może poprosić o uprawnienia administratora.
  - → Zainstalowany `gh` 2.101.0.
- [x] **Ty, w nowym oknie PowerShell w folderze projektu:** `gh auth login --hostname github.com --git-protocol https --web`. Przepisujesz jednorazowy kod w przeglądarce.
  - Nowe okno jest potrzebne, bo świeżo zainstalowany `gh` nie jest widoczny w już otwartej sesji Claude Code.
  - → Okno z menu Start, nie karta terminala w Devinie (ta też nie widzi nowego `gh`). Na „Authenticate Git with your GitHub credentials?” odpowiedź **n**.
  - → Potrzebne było też uprawnienie `workflow`: `gh auth refresh -h github.com -s workflow`. Bez niego GitHub odrzuca push z `.github/workflows/ci.yml`.
- [x] **Agent:** `gh auth setup-git` i `gh auth status`, wywoływane pełną ścieżką `C:\Program Files\GitHub CLI\gh.exe`, dopóki sesja nie zostanie zrestartowana.
  - → Zamiast `gh auth setup-git`, które zmienia globalną konfigurację gita (także dla innych projektów na komputerze), `gh` jest pomocnikiem logowania tylko w tym repo: `credential.https://github.com.helper` w `.git/config`.
- [x] **Poza planem, przed pierwszym pushem:** mail w commitach.
  - 11 commitów miało mail służbowy, który w publicznym repo byłby widoczny dla każdego.
  - → Repo ma `user.email = 334102526+CharlesOnTheWave@users.noreply.github.com`. Historia przepisana `git filter-branch` (treść i daty bez zmian, nowe hashe). Polecenie uruchomił Karol, bo strażnik trybu auto zablokował je agentowi.
  - → Na GitHubie włączone „Keep my email addresses private” i „Block command line pushes that expose my email”.

## Etap 2. Repozytorium na GitHubie (publiczne)

- [x] **Agent:** `gh repo create CharlesOnTheWave/most-likely-to --public --source . --remote origin`, bez wypychania.
- [x] **Agent (ask):** `git push -u origin main`.
  - Workers Builds nie jest jeszcze podpięty, więc ten push niczego nie wdraża. Uruchamia się tylko CI: lint, `astro check`, build i smoke na lokalnym Supabase w runnerze.
- [x] **Agent:** `gh run list` / `gh run watch`, aż CI będzie zielone. Jeśli padnie, poprawiamy przed wdrożeniem.
  - → Zielone: `ci` 39 s, `smoke` 2 min.

## Etap 3. Supabase: przygotowanie produkcji

- [x] **Ty:** Authentication → Sign In / Providers → Email → wyłącz **Confirm email**.
  - Darmowy serwer pocztowy Supabase wysyła maile tylko do członków zespołu projektu (2 na godzinę, https://supabase.com/docs/guides/auth/auth-smtp), więc obcy host nigdy nie dostałby potwierdzenia.
  - Smoke też wymaga logowania od razu po rejestracji.
  - → Przełącznik jest w sekcji „User Signups” na stronie Sign In / Providers.
  - → 07.10.2026 (S-05): Confirm email z powrotem **włączone**, a smoke loguje się stałym kontem testowym, więc nie potrzebuje już logowania od razu po rejestracji.
- [x] **Agent:** tworzy `.dev.vars` z pustymi liniami `SUPABASE_URL=` i `SUPABASE_KEY=`. Plik jest w `.gitignore`.
- [x] **Ty:** wklejasz do `.dev.vars` dwie wartości, nie do czatu:
  - Project URL;
  - klucz **publishable** z Project Settings → API Keys. Może to być `sb_publishable_…` albo starszy `anon`. **Nigdy** `secret` ani `service_role`.
  - → Adres projektu wpisał agent (nie jest tajny), klucz `sb_publishable_…` wkleił Karol.
- [x] **Agent:** `npm run dev` w tle i `npm run smoke`, czyli pierwszy smoke na prawdziwym Supabase. To domyka zaległość z M1L3.
  - → 8/8. Astro 7 uruchamia serwer deweloperski w tle i od razu kończy polecenie; zatrzymanie: `npx astro dev stop`.

## Etap 4. Zmiany w projekcie

- [x] **Agent:** w `wrangler.jsonc` ustawia `"name": "most-likely-to"`. Od tej nazwy zależy adres gry i musi się ona zgadzać z nazwą Workera w Workers Builds.
- [x] **Agent:** dopisuje do `AGENTS.md` jedną linię: push do `main` wdraża produkcję przez Workers Builds, także wtedy, gdy CI na GitHubie nie przejdzie. Dlatego przed pushem obowiązkowo lint, `astro check` i build, a po wdrożeniu `BASE_URL=<adres> npm run smoke`.
- [x] **Agent:** uruchamia bramkę (`npm run lint`, `npx astro check`, `npm run build`) i robi commit.
  - → Commit `52a4520` (hash po przepisaniu maili).

## Etap 5. Pierwsze wdrożenie z komputera

- [x] **Agent (ask):** `npx wrangler deploy --secrets-file .dev.vars`.
  - Tworzy Workera `most-likely-to` i od razu wgrywa oba sekrety z Twojego pliku. Wartości nie przechodzą przez czat.
  - Sekrety zostają przy kolejnych wdrożeniach, także tych z Workers Builds.
  - → Przed wdrożeniem agent sprawdził, że w `dist/` nie ma `.dev.vars` ani `.env` (dodatkowo wyklucza go `dist/client/.assetsignore`).
  - → Wrangler sam utworzył KV `most-likely-to-session` dla powiązania `SESSION` (sesje Astro). Nie było tego w planie.
- [x] **Agent:** `npx wrangler secret list` (pokazuje tylko nazwy) i `npx wrangler deployments list`.
- [x] **Agent:** `BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke`, a przy błędach `npx wrangler tail most-likely-to --format pretty`.
  - → 8/8, bez błędów.
- [x] **Ty:** otwierasz adres na telefonie i sprawdzasz, czy strona główna się ładuje.

## Etap 6. Automatyczne wdrażanie z main (Workers Builds)

- [x] **Ty, w panelu, bo to zgoda OAuth:** Workers & Pages → `most-likely-to` → Settings → Builds → Connect → GitHub.
  - Aplikację Cloudflare instalujesz **tylko dla repo `most-likely-to`**, a nie dla wszystkich repozytoriów. To minimalne uprawnienia.
  - Gałąź produkcyjna `main`, build command `npm run build`, deploy command `npx wrangler deploy` (domyślne).
  - Buildy innych gałęzi włączone (`npx wrangler versions upload`).
- [x] **Agent:** robi drobną, bezpieczną zmianę (np. link do gry w `README.md`), commit, potem `git push` (ask).
  - → Commit `800c10d`: adres produkcji w README.
- [x] **Agent:** sprawdza kolejno:
  - CI przez `gh run list`;
  - status buildu Cloudflare w commicie;
  - `npx wrangler deployments list`, gdzie nowe wdrożenie powinno pochodzić z gita;
  - smoke na publicznym adresie.
  - → Wszystko zielone: check „Workers Builds: most-likely-to” = success, CI `ci` 45 s i `smoke` 2 min, smoke na produkcji 8/8. Wdrożenie z Workers Builds ma na liście źródło „Unknown (deployment)”, nie „git”, ale wersję `4e3d91b8` 45 s po pushu.
- [x] **Opcjonalnie, Ty z agentem:** próba cofnięcia. `npx wrangler rollback` (ask) do poprzedniej wersji, sprawdzenie i powrót. Warto przećwiczyć na spokojnie przed pierwszą grą.
  - → `npx wrangler rollback <version-id> --message "…" --yes`: `4e3d91b8 → c1c7a3b4 → 4e3d91b8`, strona odpowiadała cały czas.

## Etap 7. Domknięcie lekcji

- [x] **Agent:** aktualizuje `context/deployment/deploy-plan.md` (odhaczone kroki, adres gry, co zostało), commituje i robi `git push` (ask). Ten push sam wdroży nową wersję, co jest w porządku.
- [x] **Ty:** odbierasz odznakę 1.5 w Mission Log.
  - → Wpis z adresem na Circle (10xDevs Arena) jest opcjonalny. Lekcja mówi tylko: odbierz odznakę, „a następnie pochwal się swoim osiągnięciem”. Karol go pominął.

## Sytuacje brzegowe

- **Wrangler zapyta o subdomenę albo wyświetli inne interaktywne pytanie.** Agent nie odpowie na nie z terminala. Ustawiasz subdomenę w panelu, jeśli trzeba uruchamiasz polecenie sam, i powtarzamy.
- **Build w Cloudflare pada:**
  - sprawdzić, czy nazwa Workera w panelu i `name` w `wrangler.jsonc` są identyczne;
  - sprawdzić wersję Node: `.nvmrc` to 22.14.0, a w razie potrzeby można dodać zmienną builda `NODE_VERSION=22`;
  - **nie** dodawać sekretów Supabase jako zmiennych builda. W `astro:env` są opcjonalne i czytane dopiero w działającej aplikacji.
- **Logowanie na produkcji nie działa:**
  - czy projekt Supabase nie jest uśpiony (panel pokazuje „Paused”);
  - czy `SUPABASE_KEY` to klucz publishable/anon;
  - czy konto ma potwierdzony e-mail. Confirm email jest **włączone** od 07.10.2026 (S-05) i ma takie zostać; konto testowe zakłada się z „Auto Confirm User”;
  - podgląd w `npx wrangler tail`.
- **Push odrzucony z komunikatem o `workflow` scope:** `gh auth refresh -h github.com -s workflow` w zwykłym oknie PowerShell.
- **Maile do hostów (linki, potwierdzenia):** wymagają własnego SMTP (np. Resend) oraz ustawienia Site URL i Redirect URLs w Supabase na adres produkcyjny i `http://localhost:4321/**`. To nie jest częścią tego wdrożenia.
  - → 07.10.2026 (S-05): Site URL i Redirect URLs ustawione (wartości w „Stan po wdrożeniu”). Własny SMTP nadal poza planem.
- **Konta testowe:** smoke tworzy konta `smoke-…@example.com` w jedynym projekcie Supabase, który na razie służy i do rozwoju, i do produkcji. To świadomy kompromis na MVP. Konta można usuwać w Authentication → Users.
  - → Od 07.10.2026 (S-05) smoke i sonda F-01 logują się stałym kontem testowym z `.dev.vars` (`SMOKE_EMAIL`, `SMOKE_PASSWORD`) i nie zakładają kont. Stare konta `smoke-…` i `probe-…` usunięte. W nowym worktree trzeba skopiować `.dev.vars`.
- **Paczki kursu w publicznym repo:** `.claude/skills/10x-*` trafiły do publicznego repo. Nie znalazłem w nich zastrzeżeń licencyjnych, a kurs zachęca do publicznego repo.

## Poza tym planem (decyzje na później)

- Usypianie darmowego Supabase po 7 dniach, czyli ryzyko nr 1 z `infrastructure.md`. Do rozstrzygnięcia przed pierwszym prawdziwym wieczorem gry.
- Własny SMTP, projekt rundy na żywo (kanały Realtime, goście), własna domena, Cloudflare Access dla podglądów.
- Minimalne uprawnienia: `wrangler login` dał token OAuth z dostępem do całego konta. Docelowo token API ograniczony do Workers tego projektu.
- Wtyczka Cloudflare dla Claude Code (zainstalowana lokalnie, tylko w tym projekcie): po `/reload-plugins` dopisać regułę ask dla serwerów MCP, które mogą zmieniać konto.
- Konta testowe smoke w Supabase (na 26.09: 3) usuwać co jakiś czas.
  - → Nieaktualne od 07.10.2026: smoke nie zakłada już kont (S-05).
- KV na darmowym planie ma niski dzienny limit zapisów. Sprawdzić przed trzymaniem stanu gry w sesjach Astro.
- Ostrzeżenia w GitHub Actions: akcje na Node 20 (`checkout@v4`, `setup-node@v4`, `supabase/setup-cli@v1`) są uruchamiane na Node 24, a `ubuntu-latest` przechodzi na Ubuntu 26 od 19.10.2026. Podbić wersje akcji, gdy wyjdą nowe.
- Ostrzeżenie builda: `@astrojs/sitemap` potrzebuje opcji `site` w `astro.config` (adres produkcji).
- Wrangler 4.141.0 jest dostępny (projekt: 4.131.1).
- Strona wciąż ma szatę startera („10x Astro Starter”); interfejs gry w kolejnych modułach.

## Pliki zmieniane

- `wrangler.jsonc`: pole `name`.
- `AGENTS.md`: linia o wdrożeniach, potem adres produkcji, sekcja Testing i uwaga o `astro dev`.
- `README.md`: adres produkcji (zmiana testowa w Etapie 6).
- `context/deployment/deploy-plan.md`: nowy plik, zaktualizowany po wdrożeniu.
- `.dev.vars`: tylko lokalnie, poza gitem.
- `.git/config` (lokalnie): `user.email` noreply i pomocnik logowania `gh`.

## Weryfikacja end-to-end

1. [x] `npm run lint`, `npx astro check` i `npm run build` przechodzą.
2. [x] Smoke lokalny na produkcyjnym Supabase kończy się „All smoke steps passed”.
3. [x] `npx wrangler deployments list` pokazuje najpierw wdrożenie z komputera, potem z Workers Builds.
4. [x] Smoke na `https://most-likely-to.charlesonthewave.workers.dev` kończy się „All smoke steps passed”.
5. [x] CI na GitHubie i build Cloudflare w commicie są zielone.
6. [x] Na telefonie działa strona główna. Rejestrację i logowanie sprawdził smoke na produkcji.
7. [ ] `npx wrangler tail` nie pokazuje błędów podczas smoke. → Nie uruchamiany; panel Workera pokazuje 0 błędów.
