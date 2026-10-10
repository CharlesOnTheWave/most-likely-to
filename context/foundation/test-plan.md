# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-10

## 1. Strategy

Testy w tym projekcie trzymają się trzech zasad, od których nie ma wyjątków:

1. **Koszt × sygnał.** Wygrywa najtańszy test, który daje prawdziwy sygnał
   dla danego ryzyka. Nie przenoś testu do e2e tylko dlatego, że e2e
   „wydaje się bezpieczniejsze”. Nie kładź modelu wizji na deterministyczny
   diff wizualny, który już wyłapuje regresję.
2. **Obawy użytkownika są pełnoprawnym dowodem.** Ryzyka zakotwiczone w
   „właściciel obawia się X, a awaria ujawniłaby się gdzieś w <obszarze>”
   ważą tyle samo co linie PRD albo dane z hot-spotów.
3. **Ryzyka to scenariusze, nie miejsca w kodzie.** Ten plan dokumentuje,
   *co może się zepsuć* i *dlaczego uważamy to za prawdopodobne* — na
   podstawie dokumentów, wywiadu i *sygnału* z bazy kodu (częstotliwość
   zmian, struktura, stan testów). NIE twierdzi, że wie, która linia
   odpowiada za awarię. Tę wiedzę wytwarza `/10x-research` w każdym etapie
   wdrożenia. Jeśli plan i research nie zgadzają się co do tego, gdzie
   mieszka awaria, rozstrzyga research.

Właściciel projektu nie weryfikuje kodu sam (wywiad Q3), więc każdy test
musi sprawdzać zachowanie opisane w PRD, z oczekiwanym wynikiem
pochodzącym z PRD, roadmapy albo wywiadu, nigdy z implementacji.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/migrations/`,
`scripts/` (27 commitów w oknie 2026-09-08 → 2026-10-08).

## 2. Risk Map

Najważniejsze scenariusze awarii, uporządkowane według wpływ ×
prawdopodobieństwo. Kolumna Source cytuje *dowód, który podniósł ryzyko*,
nigdy plik jako „miejsce awarii” (§1, zasada 3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Gracz, host albo twórca gry może odtworzyć, kto na kogo głosował: z bazy, z kanału na żywo, z odpowiedzi serwera, z logów albo z kolejności zdarzeń | High | High | PRD Non-Goals i Non-Functional Requirements („kto na kogo” nigdy, także dla hosta i twórcy); roadmap S-02 Risk i S-04 Unknowns; AGENTS.md Hard Rules; interview Q1 |
| 2 | Odsłona albo nowy stan rundy nie dociera do wszystkich graczy w 2 s, także po odświeżeniu strony albo uśpieniu telefonu; część ekipy wisi na „czekamy na głosy” | High | High | PRD Non-Functional Requirements (2 s, 10 s) i US-01; interview Q1; archive live-sync-spike (mierzony tylko sygnał zmiany, nie prawdziwe głosy; powrót po uśpieniu i iOS niesprawdzone); roadmap S-02; hot-spot dir `src/lib/` (11 commits/30d) |
| 3 | Runda łamie reguły gry: pytanie spoza wybranych kategorii, pytanie 18+ wbrew decyzji hosta, powtórka w tej grze, albo wynik odsłony niezgodny z oddanymi głosami (podwójny głos po powrocie, zgubiony głos, głos na osobę spoza listy) | High | High | PRD FR-008, FR-009, FR-011, FR-015 i US-01 Acceptance Criteria; roadmap S-02 |
| 4 | Ktoś działa ponad swoją rolę: host przeskakuje etapy gry, otwiera zamknięty pokój, sam wybiera kod linku albo zapisuje sobie nick z pominięciem reguły nicku; gość działa w cudzym pokoju albo jako inny gracz | High | High | archive room-lobby (impl-review F1: host omija reguły przez REST); roadmap S-02 Risk; PRD Access Control; AGENTS.md Conventions (funkcje bazy przyznane `anon` to publiczne wejścia); uprawnienia w migracji pokoju (`supabase/migrations/`). Research fazy 1 (2026-10-10): ścieżka awarii omija Workera, więc hot-spot `src/pages/api/` (10 commits/30d, głównie logowanie) nie jest tu dowodem |
| 5 | Zepsuta wersja gry trafia do graczy, choć sprawdzenia są zielone: test niczego nie pilnuje, narzędzie sprawdzające samo się psuje albo produkcja wdraża mimo czerwonego CI | High | Medium | interview Q3 (właściciel nie zweryfikuje kodu sam); AGENTS.md Commands (Workers Builds wdraża `main` nawet przy czerwonym CI); lessons.md (poprawka przeszła bramkę, a decydujący przebieg sondy na produkcji padł); tech-stack.md (auto-deploy on merge); hot-spot dir `scripts/` (13 commits/30d) |
| 6 | Gość nie wchodzi do pokoju albo traci nick: link z Discorda nie działa na telefonie, dwa identycznie wyglądające nicki przechodzą, po odświeżeniu ktoś inny zajmuje jego nick | High | Medium | PRD FR-002, FR-011 i Guardrails (dołączenie < 30 s); archive room-lobby (impl-review F4: niewidoczne znaki w nicku; iOS niesprawdzony); roadmap S-04; reguła nicku w bazie (`supabase/migrations/`). Research fazy 1 (2026-10-10): hot-spot `src/components/room/` (5 commits/30d, zmiany ekranów) dotyczy tylko formularza wejścia, nie reguły nicku |
| 7 | Gra przestaje działać dla wszystkich do końca dnia, bo seria sygnałów zmiany (spam albo zwykły ruch rundy z głosami) wyczerpuje dzienny limit żądań | High | Medium | archive room-lobby (impl-review F2: brak ogranicznika); infrastructure.md (100 tys. żądań dziennie na konto); roadmap S-02 Risk |

Poza mapą świadomie: awaria dostawcy logowania albo uśpiony projekt
Supabase to wysoki wpływ × niskie prawdopodobieństwo; należy do listy
kontrolnej przed wieczorem i obserwowalności, nie do testu. Logowanie
hosta pokrywa już smoke (§4).

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Po zakończonej rundzie żadna rola (gość, host, twórca gry) i żaden kanał (baza, odpowiedź serwera, zdarzenie na żywo, log) nie pozwala połączyć głosującego z osobą, na którą głosował | „Tabela głosów nie ma kolumny głosującego, więc jest anonimowo” — para może wyciec kolejnością zapisów, znacznikami czasu, logiem albo zestawieniem „kto już zagłosował” z liczbami w trakcie rundy | gdzie głos jest zapisywany i liczony; co niesie sygnał na żywo i sygnał „kto już zagłosował”; co trafia do logów; jak S-04 ma przywracać oddany głos | integration (baza w CI) + integration na odpowiedziach serwera | test sprawdzający tylko kolumny tabeli; test uruchamiany rolą, która omija uprawnienia |
| #2 | Po ostatnim głosie albo przewinięciu przez prowadzącego każdy ekran w pokoju pokazuje tę samą odsłonę w 2 s, także ekran, który dołączył albo wrócił w trakcie | „Sygnał zmiany doszedł, więc gracz widzi wynik” — sygnał to tylko podpowiedź, stan musi zostać pobrany; spóźniony ekran może czekać na kolejny sygnał | moment, w którym serwer uznaje rundę za zamkniętą; jak ekran pobiera stan po sygnale i po powrocie; budżet czasu na produkcji vs lokalnie | integration (stan rundy po ostatnim głosie) + e2e z kilkoma przeglądarkami; ręczna sonda na produkcji dla 2 s | pomiar 2 s na lokalnym serwerze dev (sam nie mieści się w budżecie); całkowite mockowanie kanału na żywo |
| #3 | Reguły z PRD: jeden głos na gracza na rundę (także po odświeżeniu), głos na siebie dozwolony, wstrzymanie się dozwolone, głos tylko na osobę z listy, liczby w odsłonie równe oddanym głosom; pytania tylko z wybranych kategorii, 18+ tylko tam, gdzie host je włączył, bez powtórek w grze | „Interfejs blokuje drugi głos, więc serwer też” | gdzie serwer przyjmuje i liczy głos; jak losowane jest pytanie i skąd bierze kategorie | unit (losowanie pytań) + integration (przyjmowanie i liczenie głosów) | problem wyroczni: oczekiwane liczby przepisane z implementacji zamiast z reguł PRD |
| #4 | Każda rola dostaje odmowę tam, gdzie PRD Access Control i decyzje właściciela (triage F1) jej zabraniają, sprawdzane tymi drzwiami, którymi wszedłby atakujący (REST/RPC z pominięciem Workera): host nie otworzy zamkniętego pokoju, nie wybierze kodu linku, nie zapisze sobie nicku z pominięciem reguły nicku, nie dotknie cudzego pokoju; gość nie zadziała w cudzym pokoju ani jako inny gracz. Przejścia etapów gry sprawdza faza 2 (S-02), bo dopiero tam powstają | „Uprawnienia w bazie są włączone i smoke przechodzi, więc jest bezpiecznie” — smoke chodzi przez Workera i sprawdza ścieżki szczęśliwe; „Worker sprawdza, więc baza nie musi” — host i gość mogą wołać bazę bezpośrednio | uprawnienia i polityki per rola; funkcje bazy otwarte dla gości; przejścia stanów gry z S-02 | integration (baza w CI przez REST/RPC kluczem publishable, z rolą gościa i rolą zalogowanego hosta; bez klucza secret) | test na roli administratora albo kluczu secret, które omijają uprawnienia (fałszywie zielony); asercja „brak błędu” tam, gdzie uprawnienia po cichu zwracają 0 wierszy; test, który zapisuje znaną dziurę jako dozwolone zachowanie (znana dziura = oczekiwana porażka z odwołaniem do naprawy) |
| #5 | Celowo zepsute zachowanie z §2 robi bramkę czerwoną, a czerwona bramka zatrzymuje wdrożenie na produkcję | „CI zielone, więc produkcja bezpieczna” i „skrypt sprawdzający działa, bo przeszedł lint” | co i kiedy wdraża się na produkcję; które bramki blokują; czy smoke i sonda wykonują zmieniony kod | gates (CI + blokada wdrożenia) + hook po edycji + ręczna próba „czy test potrafi zawieść” | testy, których nikt nie uruchamia przed pushem; zielone, bo pominięte |
| #6 | Nick wyglądający identycznie jak zajęty (lista par z Unicode: niewidoczne znaki, selektor wariantu, znaczniki) jest odrzucany, a widocznie inny przechodzi; za długi nick, także bardzo długi, dostaje czytelną odmowę; samo otwarcie linku (podgląd Discorda) nie tworzy gracza ani ciasteczka; po odświeżeniu gracz wraca na swój nick i nikt inny go nie zajmie; gość z ważnym linkiem wchodzi z telefonu w < 30 s (ręcznie, także iOS) | „Normalizacja usuwa niewidoczne znaki” — znane są wyjątki; „< 30 s udowodni test automatyczny” — to czas człowieka, nie serwera | reguła normalizacji nicku i gdzie działa; zachowanie ciasteczka gościa; plany S-04 | integration (wejście gościa w bazie przez RPC) + kroki smoke (otwarcie linku, powrót na nick); ręczny test telefonu (iOS) dla < 30 s | oczekiwany wynik skopiowany z funkcji normalizującej zamiast z listy par identycznie wyglądających nicków; asercja dla par, których wygląd zależy od decyzji właściciela (emotka z selektorem i bez), zanim ta decyzja zapadnie |
| #7 | Seria sygnałów zmiany z jednego pokoju daje ograniczoną liczbę żądań na ekran, a wieczór z 20 graczami mieści się w dziennym limicie z zapasem | „Kanał jest nasz, więc sygnały są prawdziwe” — kanał jest publiczny | jak ekran reaguje na sygnał; ile żądań generuje runda z głosami; konfiguracja kanału | unit (ogranicznik po stronie ekranu, z kontrolowanym czasem) + szacunek żądań na wieczór | test obciążeniowy na produkcji (zjada limit); e2e do sprawdzania reguły czasowej |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Fundament testów i zabezpieczenie lobby | Postawić pierwszy runner i udowodnić w istniejącym lobby, że role dostają odmowę tam, gdzie PRD zabrania, a identycznie wyglądające nicki są odrzucane | #4, #6 | unit + integration (DB) | planned | testing-lobby-foundation |
| 2 | Anonimowość i reguły rundy | Udowodnić, że po rundzie nie da się odtworzyć „kto na kogo”, a runda spełnia reguły PRD; testy powstają przed kodem głosowania S-02 | #1, #3 | unit + integration (DB) | not started | — |
| 3 | Odsłona na żywo w przeglądarkach | Udowodnić, że każdy ekran dostaje tę samą odsłonę w budżecie czasu, a sygnały zmiany nie zjadają limitu żądań | #2, #7 | e2e + unit + AI-native exploratory | not started | — |
| 4 | Bramki, które naprawdę zatrzymują | Udowodnić, że zepsute zachowanie z §2 zapala bramkę na czerwono, a czerwona bramka zatrzymuje produkcję | #5 | gates + post-edit-hook | not started | — |

Faza 2 dzieje się razem z S-02 z roadmapy: przy przekazaniu `/10x-new`
użyć change-id `first-live-round` (wspólny folder z S-02), a nie
`testing-…`. Testy bazy wymagają lokalnego Supabase, który dziś działa
tylko w CI (lokalnie brak Dockera), więc biegną w jobie `db` (patrz §6.2).

## 4. Stack

Klasyczna baza testów tego projektu. Narzędzia AI-native mają datę
`checked:`, żeby było widać, które wiersze wymagają ponownej weryfikacji.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + integration | Vitest (checked: 2026-10-10) | 5.0.x (zainstalowana 5.0.3) | własny `vitest.config.ts` bez `getViteConfig` (styk z adapterem Cloudflare niepotwierdzony); dwa projekty: `unit` (`npm test`, lokalnie i w CI) i `db` (`npm run test:db`, tylko CI); Node 22 w CI i 24 lokalnie (Vitest 5 wymaga Node ≥ 22.12) |
| DB (uprawnienia, funkcje) | Vitest, projekt `db`: integracja przez REST/RPC (supabase-js) kluczem publishable, jako gość i jako zalogowany host; pgTAP (`supabase test db`) nie wybrany, bo potrzebuje Dockera także przy `--db-url` (checked: 2026-10-10) | Supabase CLI 2.120.0 w CI (stała wersja) | tylko w CI: job `db` uruchamia `supabase start` na jednorazowej bazie; lokalnie brak Dockera; bez klucza secret i `service_role` |
| HTTP smoke | `npm run smoke` (własny skrypt Node) | Node 22 w CI, 24 lokalnie | 37 kroków (14 logowania + 23 pokoju; z `SMOKE_OAUTH=1` jeszcze 2): logowanie, start i powrót OAuth, pokój, wejście gościa, otwarcie linku bez ciasteczka i bez nowego gracza, powrót na nick; CI na lokalnym Supabase i produkcja po pushu; zostawia pokoje w bazie produkcyjnej |
| sonda live-sync | `npm run live-probe` | Node 24 lokalnie | ręcznie, na produkcji; nie w CI |
| e2e | none yet — see Phase 3 (kandydat kategorii: Playwright, checked: 2026-10-08) | — | kilka kontekstów przeglądarki = kilku graczy w jednym pokoju |
| accessibility | none yet | — | lint `jsx-a11y` w `npm run lint`; kontrast sprawdzany ręcznie przy zmianach UI |
| (optional) AI-native | agent rozgrywa rundę w przeglądarce (Claude in Chrome — checked: 2026-10-08) | n/a | When NOT to use: zamiast testów deterministycznych; do pomiaru 2 s; na produkcji z prawdziwymi graczami |
| (optional) AI-native | hook po edycji w pętli agenta (checked: 2026-10-08) | n/a | When NOT to use: jako zamiennik CI albo do wolnych testów bazy |

**Stack grounding tools (current session):**
- Docs: none — Context7 i MCP dokumentacji not available in current session; wersje narzędzi do potwierdzenia w research; checked: 2026-10-08
- Search: wbudowane wyszukiwanie w sieci (nie MCP; Exa.ai not available in current session) — potwierdzone: Supabase testuje uprawnienia przez pgTAP i `supabase test db` (supabase.com/docs/guides/database/testing); dokumentacji Astro 7 dla Vitest nie znaleziono; checked: 2026-10-08
- Runtime/browser: Claude in Chrome (przeglądarka właściciela) — możliwy dla rundy prowadzonej przez agenta; Playwright MCP not available in current session; checked: 2026-10-08
- Provider/platform: Cloudflare MCP obecny, ale niezalogowany; GitHub przez CLI `gh` (nie MCP); Supabase MCP not available in current session — not used; checked: 2026-10-08

## 5. Quality Gates

Pełny zestaw bramek, które zmiana musi przejść, zanim trafi na produkcję.
„Required after §3 Phase <N>” znaczy, że bramka obowiązuje od momentu
wdrożenia tej fazy; wcześniej jest `planned`.

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint (z kontrolą literałów UI) + `astro check` + build | local + CI | required | błędy składni i typów, kolory spoza tokenów |
| HTTP smoke | CI (lokalny Supabase) + produkcja po pushu | required | zepsute logowanie, wejście do pokoju, konfiguracja środowiska |
| unit (`npm test`) | local + CI | required | regresje reguł w kodzie TS (dziś: czytelne odmowy na drodze gościa) |
| integracja bazy (`npm run test:db`: uprawnienia ról, reguła nicku) | CI only (job `db`; lokalnie brak Dockera) | required w sensie reguły PR z `AGENTS.md`: zmiany bazy i pokoju są scalane tylko na zielonym CI, także `db`; technicznie bramka zatrzyma wdrożenie dopiero po §3 Phase 4 | regresje uprawnień ról i reguły nicku; znane dziury F1 i F4 jako oczekiwane porażki do naprawy w S-02 |
| e2e na rundzie z kilkoma graczami | CI | required after §3 Phase 3 | zepsuta runda widziana przez graczy |
| czerwone CI zatrzymuje wdrożenie | GitHub → Cloudflare | required after §3 Phase 4 | dziś Workers Builds wdraża `main` mimo czerwonego CI |
| post-edit hook | local (agent loop) | recommended after §3 Phase 4 | regresje w chwili edycji |
| sonda live-sync | produkcja, ręcznie | optional (przed prawdziwym wieczorem) | budżet 2 s w prawdziwej sieci |
| agent rozgrywa rundę (AI-native) | ręcznie, przed wieczorem | optional after §3 Phase 3 | problemy, których nie opisał żaden test |

## 6. Cookbook Patterns

Jak dodawać testy w tym projekcie. Każda podsekcja wypełnia się, gdy
odpowiednia faza wdrożenia zostanie dowieziona; do tego czasu brzmi
„TBD — see §3 Phase <N>”.

### 6.1 Adding a unit test

- **Location**: `tests/unit/**/*.test.ts` (projekt `unit` w `vitest.config.ts`). Wzór: `tests/unit/room-errors.test.ts`.
- **Run**: `npm test`, lokalnie i w CI (job `ci`). Skrypty testów nie podają `--env-file`, bo `.dev.vars` wskazuje na produkcję.
- **Imports**: `describe`, `it` i `expect` jawnie z `vitest` (bez globals). Kod aplikacji przez alias `@/` (→ `src/`). Bez modułów `astro:*` i bez `src/lib/supabase.ts`, bo ten importuje `astro:env/server`, a konfiguracja testów nie zna Astro.
- **Oracle**: oczekiwanie z PRD, roadmapy albo decyzji właściciela. Nigdy nie licz go tą samą logiką co testowany kod.
- **Assert**: sprawdzaj zachowanie, nie tekst. Przykład: każda odmowa gościa ma tekst inny niż ogólny „coś poszło nie tak”; polskich tekstów nie przepisujemy do asercji, bo to byłoby lustro.
- **Cases**: jedna właściwość to jeden `it.each`, a do tego przypadek brzegowy, np. `null` albo nieznany kod (w tym `"constructor"`, który siedzi w `Object.prototype`).

### 6.2 Adding a database permission or function test

- **Location**: `tests/db/**/*.test.ts` (projekt `db`). Wzory:
  - `canary.test.ts`: jedna odmowa i jedna kontrola pozytywna;
  - `roles.test.ts`: role gościa i hosta, znane dziury F1;
  - `nicks.test.ts`: reguła nicku z tabeli par, znane dziury F4.
- **Helpers** (`tests/db/support/`):
  - `clients.ts`: `anonClient()` (gość bez sesji), `newHost()` (rejestracja, od razu z sesją) oraz `newLinkToken` i `newPlayerToken` (te same generatory co Worker);
  - `rooms.ts`: `seedRoom`, `seedGuest`, `readOwnRoom`, `hostLobbyNicks`. Seedują prawdziwymi drzwiami: pokój przez `create_room` jako host, gość przez `join_room` jako `anon`. Przy błędzie rzucają, więc używaj ich tylko w `beforeAll`;
  - `nick-pairs.ts`: tabela par nicków (same dane). `node tests/db/support/print-nick-pairs.ts` wypisuje ją do porównania przez człowieka z `research.md` §3.1.
- **Oracle**: z researchu fazy (PRD Access Control, decyzje właściciela, pliki Unicode), nigdy z implementacji. `private.normalize_nick` nie jest przyznana `anon`, więc testy nicku idą przez `join_room` jako gość.
- **Roles**: tylko klucz publishable (`sb_publishable_…`), jako `anon` albo jako host po `signUp`. Nigdy klucz secret ani `service_role`, także do seedowania: omija uprawnienia i daje fałszywą zieleń.
- **Refusal**: odmowa to konkretny wynik, nigdy „jakiś błąd”.
  - Brak grantu albo nieudane `with check`: `error.code` równe `42501`.
  - Gdy funkcja jest przyznana, a coś w jej środku nie, rola też dostaje `42501`, tylko z innym komunikatem. Test, że odmówiła konkretna funkcja, sprawdza więc także, że komunikat ją nazywa (G2 w `roles.test.ts`).
  - Cicha RLS (`using`) zwraca 0 wierszy bez błędu. Sprawdzaj skutek: właściciel czyta ponownie, `room_link` daje ten sam status, lista graczy się nie zmienia.
- **Positive control**: każdy plik ma test, w którym rola robi coś dozwolonego i to działa. Bez niego zły adres albo brak sesji wyglądałyby jak odmowa wszędzie.
- **Known hole**: `it.fails` z prawdziwym oczekiwaniem z wyroczni i nazwą zaczynającą się od „znana dziura <F> → <zmiana>: ” (dziś F1 i F4 → S-02).
  - Nigdy test, który zapisuje dziurę jako dozwolone zachowanie. Nigdy `skip` ani `todo`, bo milczą w wyniku.
  - Gdy naprawa przyjdzie, test zrobi się czerwony. Zdejmij znacznik, nigdy nie usuwaj testu.
- **Preconditions**: `test.fails` odwraca każdy błąd, nie tylko asercję: awaria sieci albo padnięte seedowanie też dałyby „oczekiwaną porażkę”. Dlatego:
  - warunki wstępne (konta, pokoje, zajęty nick) powstają tylko w `beforeAll`, bo jego błąd oblewa cały blok i zostaje czerwony;
  - w pliku z `it.fails` nigdy `beforeEach` ani `afterEach`: Vitest uruchamia je w środku testu, więc ich błąd liczy się jako oczekiwana porażka. Tak samo przekroczony czas w ciele `it.fails`;
  - ciało testu nigdy nie rzuca, tylko zbiera `{ data, error }` (supabase-js sam nie rzuca);
  - jedyne, co może zawieść, to końcowe `expect`;
  - gdy wyrocznia oczekuje danych, a nie odmowy błędem: jeśli końcowe wywołanie zwróciło `error` (awaria, a nie odpowiedź funkcji), ciało robi `return` przed `expect`. Test wtedy przechodzi i `test.fails` pokazuje go na czerwono, zamiast liczyć awarię jako oczekiwaną porażkę;
  - asercja sprawdza tylko pola z wyroczni (`toMatchObject`, nie `toEqual`), żeby po naprawie test zrobił się czerwony, nawet gdy odpowiedź dostanie nowe pole.
- **Sign-up limit**: lokalny Supabase przyjmuje 30 rejestracji i logowań na 5 minut z jednego IP (`sign_in_sign_ups` w `supabase/config.toml`). Jeden przebieg zakłada dziś 7 kont: `canary` 0, `roles` 6, `nicks` 1.
  - Nowy plik: jeden host na plik.
  - Host ma najwyżej jeden otwarty pokój, więc kolejny pokój tego samego hosta zakładaj przez `seedRoom(host, { confirmClose: true })`; zamyka on poprzedni.
  - Pliki biegną po kolei (`fileParallelism: false`).
- **Run**: tylko w CI, w jobie `db`. Job uruchamia `supabase start`, zapisuje `API_URL` i `PUBLISHABLE_KEY` jako `TEST_SUPABASE_URL` i `TEST_SUPABASE_KEY`, a potem `npm run test:db -- --reporter=verbose`, więc log wymienia z nazwy każdą znaną dziurę. Lokalnie nie ma Dockera.
  - Bezpiecznik (`tests/db/support/env.ts`, wołany w `globalSetup`) przerywa przebieg przed pierwszym żądaniem, gdy brakuje zmiennych, adres nie jest `127.0.0.1` ani `localhost` albo klucz nie zaczyna się od `sb_publishable_`.
  - Poluzowanie bezpiecznika wymaga w tej samej zmianie reguły `ask` dla `Bash(npm run test:db*)` w `.claude/settings.json` (lessons.md, wpis 1), bo zestaw zakłada konta i pokoje.
- **Invisible characters**: w źródle tylko jako ucieczki `\u{…}`, nigdy dosłownie. Edytor albo formatter może je zgubić, a przegląd ich nie zobaczy.
- **Break-check** (próbny alarm): dowód, że nowy strażnik potrafi zaświecić na czerwono.
  1. Tymczasowy commit na gałęzi psuje dokładnie jedną rzecz (tymczasowa migracja albo edycja strony). Opis commita wymienia testy, które mają zaświecić na czerwono.
  2. Push gałęzi i porównanie CI z listą. Inny czerwony test albo przewidziany, który został zielony, znaczy, że test nie pilnuje tego, co deklaruje: zatrzymaj się i wyjaśnij przyczynę.
  3. `git revert` tego commita, push, CI znów zielone.
  4. Nigdy `npx supabase db push` tymczasowej migracji. Na końcu `git diff main...HEAD -- supabase/migrations` jest pusty.

### 6.3 Adding an anonymity check

- TBD — see §3 Phase 2 (wzorzec: po rundzie żaden kanał nie pozwala połączyć głosującego z celem głosu).

### 6.4 Adding an e2e multi-player test

- TBD — see §3 Phase 3 (wzorzec: kilku graczy w jednym pokoju widzi tę samą odsłonę).

### 6.5 Adding a smoke step

- **Location**: `scripts/smoke.mjs` (lista kroków; kroki pokoju po krokach logowania).
- **Run locally**: `npm run smoke` przy działającym serwerze; potrzebuje `.dev.vars` z `SMOKE_EMAIL` / `SMOKE_PASSWORD`; pyta przed uruchomieniem, bo zostawia pokoje w bazie produkcyjnej.
- **Production**: `BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke` po każdym pushu na `main`.
- **Expectations**: trzeci element kroku to obiekt oczekiwań albo funkcja, gdy wartość znana jest dopiero po wcześniejszych krokach (np. id pokoju). Klucze (`status`, `location`, `exact`, `contains`, `body`, `cookie`, `noCookie`, `httpOnly`) opisuje komentarz nad pętlą porównań. Przy porażce skrypt wypisuje oczekiwanie, także wyrażenie dla `body`.
- **No cookie**: `noCookie: "<tekst>"` znaczy, że żadne ciasteczko ustawione w tym kroku nie ma tego tekstu w nazwie. Liczą się tylko ciasteczka ustawione przez ten krok, a nie te, które zostały w słoiku. Krok z kilkoma żądaniami zbiera ciasteczka wszystkich odpowiedzi. Wzór: `openLinkThreeTimes` (otwarcie linku trzy razy nie ustawia `mlt_player_`).
- **Jars**: każdy gracz ma własny słoik ciasteczek (`hostJar`, `olaJar`, `new Map()` dla jednorazowego gościa).
- **Break-check**: nowy krok, który pilnuje zakazu, sprawdź raz próbnym alarmem jak w §6.2 (tymczasowa edycja strony zamiast migracji).

### 6.6 Per-rollout-phase notes

(Uzupełniane przez `/10x-implement` po każdej fazie: 2–3 linie o tym, co faza pokazała.)

- **Phase 1** (`testing-lobby-foundation`, 2026-10-10):
  - Runner stoi, a testy bazy biegną tylko w CI (job `db`): 53 testy, 40 zielonych i 13 oczekiwanych porażek (4 × „znana dziura F1 → S-02”, 9 × „znana dziura F4 → S-02”). Te 13 to kryteria akceptacji migracji S-02. Nick z 10 000 znaków dostaje dziś `invalid_nick`, więc to zwykły strażnik, a nie znana dziura.
  - Próbne alarmy trafiły dokładnie. Tymczasowa migracja otworzyła 3 uprawnienia i zaświeciła 3 przewidziane testy (kanarek, odczyt cudzego pokoju z H6, G2). Ciasteczko gracza na stronie linku zaświeciło 1 przewidziany krok smoke. Samo `42501` nie mówi, kto odmówił, dlatego G2 sprawdza też nazwę funkcji w komunikacie.
  - `supabase/setup-cli` z wersją `latest` pyta API GitHuba i czasem pada na „rate limit exceeded”, zanim ruszy jakikolwiek test. Supabase CLI jest więc przypięty (2.120.0) w jobach `smoke` i `db` i podbijany ręcznie.

## 7. What We Deliberately Don't Test

Wykluczenia uzgodnione podczas wdrożenia. Kolejne osoby i agenci trzymają
się ich, dopóki nie zmieni się założenie.

- **Treść i jakość pytań** — czy pytanie jest dobre i śmieszne, ocenia ręcznie twórca gry. Format bazy pytań i stałe numery pytań NIE są wykluczone. Re-evaluate if pytania zaczną trafiać do bazy bez ręcznego przeglądu (propozycje gości, generowanie). (Source: Phase 2 interview Q5.)
- **Awaria dostawców logowania i uśpienie Supabase** — wysoki wpływ × niskie prawdopodobieństwo; zamiast testu lista kontrolna przed prawdziwym wieczorem (obudzenie projektu, próbne logowanie). Re-evaluate if pojawi się monitoring albo płatny plan. (Source: brief zaakceptowany 2026-10-08, kontrola challengera.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-10
- Stack versions last verified: 2026-10-10
- AI-native tool references last verified: 2026-10-08

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
