# Pukanie do Supabase z GitHub Actions — Plan Brief

> Full plan: `context/changes/keep-supabase-awake/plan.md`
> Research: `context/changes/keep-supabase-awake/research.md`

## What & Why

Darmowy Supabase usypia projekt po 7 dniach bez ruchu w bazie. Gramy co 1–2 tygodnie, więc baza zasypiałaby prawie przed każdym wieczorem: 04.10.2026 tak się stało i logowanie nie działało. Karol wybrał 21.10.2026 opcję 2 z roadmapy (Open Question 9): GitHub co 6 godzin puka do bazy jednym niewinnym zapytaniem.

## Starting Point

Nic dziś nie budzi bazy. Wewnętrzny pg_cron według planu S-02 się nie liczy. Repo nie ma sekretów Actions, a `ci.yml` czyta puste `SUPABASE_URL` i `SUPABASE_KEY`. W `.claude/settings.json` nie ma reguł dla `gh`, a `node *` jest dozwolone bez pytania.

## Desired End State

- Workflow „Keep Supabase awake” co 6 godzin wywołuje `room_link` ze zmyślonym kodem i sprawdza odpowiedź `unknown`.
- Czerwony przebieg znaczy, że coś padło: uśpiona baza, zły klucz albo zmiana funkcji.
- Lokalnie to samo robi `npm run keep-awake`, za regułą „pytaj”.
- Decyzja jest zapisana w roadmapie, rejestrze ryzyk, planie wdrożenia, planie testów, README i AGENTS.md.

## Key Decisions Made

| Decision           | Choice                                                                            | Why (1 sentence)                                                                               | Source              |
| ------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------- |
| Jak nie usypiać    | Cykliczne zapytanie z GitHub Actions (opcja 2)                                    | 0 zł, bez kodu gry; ręczne budzenie łatwo zapomnieć, Pro to ~100 zł/mies.                      | Karol (21.10)       |
| Czym pukać         | `POST /rest/v1/rpc/room_link` z kodem `keep-awake-ping-000000`, nagłówek `apikey` | Funkcja `stable` z grantem dla `anon`: jeden odczyt, bez zapisu i bez logów; bez migracji      | Research            |
| Nie przez Workera  | Bezpośrednio do Supabase                                                          | `GET /` nie dotyka bazy, podgląd pokoju pisze `warn`; pukanie nie zależy od wdrożeń Workera    | Research            |
| Częstotliwość      | `17 */6 * * *` (UTC) + `workflow_dispatch`                                        | Supabase mówi o „kilku zapytaniach dziennie”, GitHub potrafi gubić zadania o pełnych godzinach | Karol (research Q1) |
| Sekrety            | `SUPABASE_URL` i `SUPABASE_KEY` (tylko `sb_publishable_`)                         | Takich nazw `ci.yml` już oczekuje; `access: "secret"` w buildzie, więc nic się nie wkleja      | Karol (research Q2) |
| Kto dodaje sekrety | Karol w ustawieniach repo                                                         | Wartość klucza nie przechodzi przez rozmowę ani logi agenta                                    | Karol (research Q3) |
| Reguły „pytaj”     | Skrypt + `gh workflow run/enable/disable`, `gh secret`, `gh variable`             | Lekcja: skrót, który dotyka bazy lub stanu zdalnego, dostaje regułę „ask”                      | Karol (research Q4) |
| Kształt kodu       | `scripts/keep-supabase-awake.mjs` + `npm run keep-awake`                          | Ten sam skrypt lokalnie i w Actions, wzorzec `smoke`/`live-probe`                              | Plan                |
| Zapis decyzji      | Roadmapa (`/10x-roadmap`), infrastructure, deploy-plan, test-plan, README, AGENTS | Pytanie 9 i ryzyko nr 1 wiszą dziś jako otwarte w czterech miejscach                           | Karol (research Q5) |

## Scope

**In scope:**

- skrypt, polecenie npm, workflow i reguły „ask”;
- dopiski w sześciu dokumentach;
- sekrety (Karol), PR i pierwszy przebieg.

**Out of scope:**

- Cron Trigger w Cloudflare, plan Pro, zmiany w grze, Workerze i bazie;
- monitoring poza mailami GitHuba;
- actionlint i testy jednostkowe skryptu;
- lokalne `settings.local.json` (`gh api *` zostaje dozwolone, tylko odnotowane).

## Architecture / Approach

GitHub Actions (`schedule` co 6 h albo przycisk) uruchamia `node scripts/keep-supabase-awake.mjs`, a ten wysyła jedno żądanie do Supabase. Skrypt najpierw odmawia (kod 2), gdy brakuje zmiennych, klucz nie jest `sb_publishable_` albo adres nie jest `https`. Potem wysyła `POST <SUPABASE_URL>/rest/v1/rpc/room_link` z nagłówkiem `apikey` i ciałem `{"p_link_token":"keep-awake-ping-000000"}`. Kod 0 i jedna linia „ok” tylko przy HTTP 200 i `status: "unknown"`, w każdym innym przypadku kod 1. Nigdy nie drukuje ciała odpowiedzi, klucza ani adresu.

## Phases at a Glance

| Phase                                        | What it delivers                                                                       | Key risk                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Skrypt, workflow i reguły „pytaj”         | Mechanizm sprawdzony lokalnie: odmowy bez sieci i jedno pukanie do produkcji za zgodą  | Nagłówek `apikey` bez Bearer odrzucony (zapas: `GET /j/<kod>` przez Workera) |
| 2. Dokumenty                                 | Pytanie 9 zamknięte, ryzyko nr 1 z opisem łagodzenia, nowe polecenie w README i AGENTS | Rozjazd treści między sześcioma plikami                                      |
| 3. Sekrety, PR, scalenie i pierwszy przebieg | Sekrety w repo, workflow na `main`, zielony przebieg ręczny i z harmonogramu           | Scalenie przed dodaniem sekretów daje czerwony przebieg i mail               |

**Prerequisites:** zgoda Karola na pukanie do produkcji (faza 1), na `/10x-roadmap` (faza 2) i na push oraz `gh workflow run` (faza 3); dwa sekrety dodane przez Karola przed scaleniem.
**Estimated effort:** jedna krótka sesja na fazy 1–3. Ostatnie sprawdzenie (przebieg z harmonogramu) w następnej sesji.

## Open Risks & Assumptions

- Supabase nie podaje progu „aktywności”. Zakładamy, że 4 wywołania RPC na dobę wystarczą („a few user requests … each day”).
- GitHub wyłączy harmonogram po 60 dniach bez commitów. Zapas to punkt listy przed wieczorem w `deploy-plan.md`.
- Maile o nieudanych przebiegach z harmonogramu idą (według dokumentacji GitHuba, czego nie sprawdziłem) do osoby, która ostatnio zmieniła harmonogram, czyli konta repo.

## Success Criteria (Summary)

- Baza nie zasypia mimo przerw między wieczorami, a zakładka Actions pokazuje zielone przebiegi co 6 godzin.
- Gdy coś padnie, przebieg jest czerwony, zanim ekipa usiądzie do gry.
- Żaden agent nie zapuka do produkcji ani nie zmieni ustawień repo bez pytania.
