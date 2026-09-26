# Plan pierwszego wdrożenia: Most Likely To na Cloudflare Workers

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

Właściciel kroku: **Ty** albo **agent**. Zapis „(ask)” oznacza, że Claude Code zapyta Cię o zgodę przed uruchomieniem.

## Etap 0. Zapis planu

- [ ] **Agent:** po zatwierdzeniu zapisuje ten plan w `context/deployment/deploy-plan.md`.

## Etap 1. Wymagania wstępne: konta i narzędzia

- [ ] **Ty:** konto Cloudflare na dash.cloudflare.com/sign-up (plan Free) i potwierdzenie e-maila. Agent otwiera stronę w Chrome.
- [ ] **Ty:** w panelu Workers & Pages sprawdź subdomenę `workers.dev` (Your subdomain → Change), np. `charlesonthewave`.
  - Będzie częścią adresu gry, a jej późniejsza zmiana zmienia adresy.
  - Ustawienie jej teraz chroni przed pytaniem wranglera przy pierwszym wdrożeniu.
- [ ] **Ty:** `! npx wrangler login` w Claude Code. Otworzy się przeglądarka, a Ty zatwierdzasz dostęp.
- [ ] **Agent:** `npx wrangler whoami`, żeby sprawdzić, że to Twoje konto.
- [ ] **Agent (po Twojej zgodzie, bo to instalacja programu):** `winget install --id GitHub.cli -e --source winget`. Windows może poprosić o uprawnienia administratora.
- [ ] **Ty, w nowym oknie PowerShell w folderze projektu:** `gh auth login --hostname github.com --git-protocol https --web`. Przepisujesz jednorazowy kod w przeglądarce.
  - Nowe okno jest potrzebne, bo świeżo zainstalowany `gh` nie jest widoczny w już otwartej sesji Claude Code.
- [ ] **Agent:** `gh auth setup-git` i `gh auth status`, wywoływane pełną ścieżką `C:\Program Files\GitHub CLI\gh.exe`, dopóki sesja nie zostanie zrestartowana.

## Etap 2. Repozytorium na GitHubie (publiczne)

- [ ] **Agent:** `gh repo create CharlesOnTheWave/most-likely-to --public --source . --remote origin`, bez wypychania.
- [ ] **Agent (ask):** `git push -u origin main`.
  - Workers Builds nie jest jeszcze podpięty, więc ten push niczego nie wdraża. Uruchamia się tylko CI: lint, `astro check`, build i smoke na lokalnym Supabase w runnerze.
- [ ] **Agent:** `gh run list` / `gh run watch`, aż CI będzie zielone. Jeśli padnie, poprawiamy przed wdrożeniem.

## Etap 3. Supabase: przygotowanie produkcji

- [ ] **Ty:** Authentication → Sign In / Providers → Email → wyłącz **Confirm email**.
  - Darmowy serwer pocztowy Supabase wysyła maile tylko do członków zespołu projektu (do 30 na godzinę), więc obcy host nigdy nie dostałby potwierdzenia.
  - Smoke też wymaga logowania od razu po rejestracji.
- [ ] **Agent:** tworzy `.dev.vars` z pustymi liniami `SUPABASE_URL=` i `SUPABASE_KEY=`. Plik jest w `.gitignore`.
- [ ] **Ty:** wklejasz do `.dev.vars` dwie wartości, nie do czatu:
  - Project URL;
  - klucz **publishable** z Project Settings → API Keys. Może to być `sb_publishable_…` albo starszy `anon`. **Nigdy** `secret` ani `service_role`.
- [ ] **Agent:** `npm run dev` w tle i `npm run smoke`, czyli pierwszy smoke na prawdziwym Supabase. To domyka zaległość z M1L3.

## Etap 4. Zmiany w projekcie

- [ ] **Agent:** w `wrangler.jsonc` ustawia `"name": "most-likely-to"`. Od tej nazwy zależy adres gry i musi się ona zgadzać z nazwą Workera w Workers Builds.
- [ ] **Agent:** dopisuje do `AGENTS.md` jedną linię: push do `main` wdraża produkcję przez Workers Builds, także wtedy, gdy CI na GitHubie nie przejdzie. Dlatego przed pushem obowiązkowo lint, `astro check` i build, a po wdrożeniu `BASE_URL=<adres> npm run smoke`.
- [ ] **Agent:** uruchamia bramkę (`npm run lint`, `npx astro check`, `npm run build`) i robi commit.

## Etap 5. Pierwsze wdrożenie z komputera

- [ ] **Agent (ask):** `npx wrangler deploy --secrets-file .dev.vars`.
  - Tworzy Workera `most-likely-to` i od razu wgrywa oba sekrety z Twojego pliku. Wartości nie przechodzą przez czat.
  - Sekrety zostają przy kolejnych wdrożeniach, także tych z Workers Builds.
- [ ] **Agent:** `npx wrangler secret list` (pokazuje tylko nazwy) i `npx wrangler deployments list`.
- [ ] **Agent:** `BASE_URL=https://most-likely-to.<subdomena>.workers.dev npm run smoke`, a przy błędach `npx wrangler tail most-likely-to --format pretty`.
- [ ] **Ty:** otwierasz adres na telefonie i sprawdzasz, czy strona główna się ładuje.

## Etap 6. Automatyczne wdrażanie z main (Workers Builds)

- [ ] **Ty, w panelu, bo to zgoda OAuth:** Workers & Pages → `most-likely-to` → Settings → Builds → Connect → GitHub.
  - Aplikację Cloudflare instalujesz **tylko dla repo `most-likely-to`**, a nie dla wszystkich repozytoriów. To minimalne uprawnienia.
  - Gałąź produkcyjna `main`, build command `npm run build`, deploy command `npx wrangler deploy` (domyślne).
  - Buildy innych gałęzi włączone (`npx wrangler versions upload`).
- [ ] **Agent:** robi drobną, bezpieczną zmianę (np. link do gry w `README.md`), commit, potem `git push` (ask).
- [ ] **Agent:** sprawdza kolejno:
  - CI przez `gh run list`;
  - status buildu Cloudflare w commicie;
  - `npx wrangler deployments list`, gdzie nowe wdrożenie powinno pochodzić z gita;
  - smoke na publicznym adresie.
- [ ] **Opcjonalnie, Ty z agentem:** próba cofnięcia. `npx wrangler rollback` (ask) do poprzedniej wersji, sprawdzenie i powrót. Warto przećwiczyć na spokojnie przed pierwszą grą.

## Etap 7. Domknięcie lekcji

- [ ] **Agent:** aktualizuje `context/deployment/deploy-plan.md` (odhaczone kroki, adres gry, co zostało), commituje i robi `git push` (ask). Ten push sam wdroży nową wersję, co jest w porządku.
- [ ] **Ty:** wrzucasz publiczny adres na Circle (10xDevs Arena) i odbierasz odznakę 1.5 w Mission Log.

## Sytuacje brzegowe

- **Wrangler zapyta o subdomenę albo wyświetli inne interaktywne pytanie.** Agent nie odpowie na nie z terminala. Ustawiasz subdomenę w panelu, jeśli trzeba uruchamiasz polecenie sam, i powtarzamy.
- **Build w Cloudflare pada:**
  - sprawdzić, czy nazwa Workera w panelu i `name` w `wrangler.jsonc` są identyczne;
  - sprawdzić wersję Node: `.nvmrc` to 22.14.0, a w razie potrzeby można dodać zmienną builda `NODE_VERSION=22`;
  - **nie** dodawać sekretów Supabase jako zmiennych builda. W `astro:env` są opcjonalne i czytane dopiero w działającej aplikacji.
- **Logowanie na produkcji nie działa:**
  - czy projekt Supabase nie jest uśpiony (panel pokazuje „Paused”);
  - czy `SUPABASE_KEY` to klucz publishable/anon;
  - czy Confirm email jest wyłączone;
  - podgląd w `npx wrangler tail`.
- **Maile do hostów (linki, potwierdzenia):** wymagają własnego SMTP (np. Resend) oraz ustawienia Site URL i Redirect URLs w Supabase na adres produkcyjny i `http://localhost:4321/**`. To nie jest częścią tego wdrożenia.
- **Konta testowe:** smoke tworzy konta `smoke-…@example.com` w jedynym projekcie Supabase, który na razie służy i do rozwoju, i do produkcji. To świadomy kompromis na MVP. Konta można usuwać w Authentication → Users.
- **Paczki kursu w publicznym repo:** `.claude/skills/10x-*` trafią do publicznego repo. Nie znalazłem w nich zastrzeżeń licencyjnych, a kurs zachęca do publicznego repo. Jeśli wolisz inaczej, decyzja należy do Ciebie przed pierwszym pushem.

## Poza tym planem (decyzje na później)

- Usypianie darmowego Supabase po 7 dniach, czyli ryzyko nr 1 z `infrastructure.md`. Do rozstrzygnięcia przed pierwszym prawdziwym wieczorem gry.
- Własny SMTP, projekt rundy na żywo (kanały Realtime, goście), własna domena, Cloudflare Access dla podglądów.

## Pliki zmieniane

- `wrangler.jsonc`: pole `name`.
- `AGENTS.md`: jedna linia o wdrożeniach.
- `README.md`: zmiana testowa w Etapie 6.
- `context/deployment/deploy-plan.md`: nowy plik.
- `.dev.vars`: tylko lokalnie, poza gitem.

## Weryfikacja end-to-end

1. `npm run lint`, `npx astro check` i `npm run build` przechodzą.
2. Smoke lokalny na produkcyjnym Supabase kończy się „All smoke steps passed”.
3. `npx wrangler deployments list` pokazuje najpierw wdrożenie z komputera, potem z Workers Builds.
4. Smoke na `https://most-likely-to.<subdomena>.workers.dev` kończy się „All smoke steps passed”.
5. CI na GitHubie i build Cloudflare w commicie są zielone.
6. Na telefonie działa strona główna oraz rejestracja i logowanie hosta.
7. `npx wrangler tail` nie pokazuje błędów podczas smoke.
