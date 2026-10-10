# Fundament testów i zabezpieczenie lobby (faza 1 planu testów) — plan implementacji

## Overview

Pierwsza faza wdrożenia z `context/foundation/test-plan.md` §3. Pokrywa ryzyka #4 (ktoś działa ponad swoją rolę) i #6 (gość nie wchodzi albo traci nick). Zmiana stawia pierwszy runner testów, Vitest 5, w dwóch zestawach:

- **unit** — lokalnie i w CI;
- **db** — tylko w CI, na lokalnym Supabase, przez REST/RPC kluczem publishable, jako gość i jako zalogowany host.

Tymi drzwiami wszedłby atakujący z F1. Testy udowadniają w istniejącym lobby, że role dostają odmowę tam, gdzie PRD i decyzje właściciela tego wymagają, a identycznie wyglądające nicki są odrzucane.

Znane dziury F1 i F4 nie są w tej zmianie naprawiane (decyzja Karola, ścieżka B w `research.md`). Testy dla nich powstają z oczekiwaniem z wyroczni i są oznaczone jako oczekiwana porażka (`test.fails`) z odwołaniem do S-02 (`first-live-round`). Zmiana nie zawiera migracji ani `db push`.

## Current State Analysis

- **Brak runnera.** `package.json` nie ma skryptu `test` ani `vitest`. `AGENTS.md:23` mówi wprost: „No unit or e2e framework yet”.
- **Reguły lobby żyją w SQL** (`supabase/migrations/20261007122858_room_lobby.sql`), a Worker to tylko jedne z drzwi (`:9-10`).
- **F1 jest w kodzie:**
  - `authenticated` ma `insert` na `rooms`/`players` i `update (status)` na `rooms` (`:59-61`);
  - polityka zmiany nie patrzy na status (`:73-76`);
  - `create_room` przyjmuje kod linku od wołającego (`:133,184`).
- **F4 jest w kodzie:** klasy znaków w `private.normalize_nick` (`:114,116`) pomijają selektory wariantu, znaczniki i kilka znaków Default_Ignorable, a `join_room` nie ma limitu długości przed normalizacją (`:241`).
- **Smoke** (`scripts/smoke.mjs:203-274`) chodzi przez Workera:
  - sprawdza spację na końcu, ZWSP i wielkość liter (`:252-254`);
  - nie sprawdza, że otwarcie linku niczego nie zmienia, nie sprawdza `"me":"Ola"` i nie ma zwykłego duplikatu „Ola”.
- **CI** (`.github/workflows/ci.yml`) ma job `ci` (lint, check, build) i job `smoke`. Job `smoke` uruchamia `supabase start` z wyłączonymi zbędnymi usługami, bierze `API_URL`/`PUBLISHABLE_KEY` z `supabase status -o env` i zakłada konto zwykłą rejestracją, bo lokalnie `enable_confirmations = false` (`supabase/config.toml:215`).
- **Lokalnie nie ma Dockera ani WSL 2**, więc testy bazy da się uruchomić tylko w CI. `.dev.vars` wskazuje na jedyny projekt Supabase, czyli produkcję (AGENTS.md, Testing).
- **Repo jest publiczne** (`gh repo view`, 10.10), więc minuty GitHub Actions są darmowe. Buildy gałęzi w Workers Builds są wyłączone (`context/deployment/deploy-plan.md:164-165`), więc push gałęzi nie wdraża. Push na `main` wdraża zawsze, także przy czerwonym CI.
- **`lessons.md`:** wpis 1 („ask” dla skrótów zmieniających bazę) i wpis 3 (uruchomić zmieniony kod przed pushem, który wdraża) dotyczą tej zmiany; patrz fazy 1 i 4.

## Desired End State

- `npm test` uruchamia lokalnie zestaw unit.
- `npm run test:db` uruchamia zestaw db wyłącznie na lokalnym Supabase. Odmawia startu bez zmiennych, z adresem spoza `127.0.0.1`/`localhost` i z kluczem spoza `sb_publishable_`, zanim wyśle jakiekolwiek żądanie.
- CI ma trzeci job, `db`, który biegnie równolegle z `smoke`. Job `ci` uruchamia też `npm test`.
- W `tests/db/` są:
  - strażnicy ról, dziś zieloni:
    - gość nie czyta tabel, nie zakłada pokoju i nie widzi cudzej poczekalni;
    - host nie czyta ani nie zmienia cudzego pokoju, nie czyta hashy tokenów i nie dopisuje fałszywego gościa;
  - znane dziury F1 (H1–H3) jako oczekiwane porażki „znana dziura F1 → S-02”.
- W `tests/db/` jest też tabela 22 par nicków z `research.md` §3.1:
  - 13 przechodzi dziś;
  - 9 to oczekiwane porażki „znana dziura F4 → S-02”;
  - do tego zwykły duplikat, granica 20/21 znaków, bardzo długi nick i nick, który wygląda na pusty.
- **Próbny alarm wykonany i opisany.** Tymczasowa migracja na gałęzi otworzyła trzy dziury i CI zaświeciło na czerwono dokładnie przewidziane testy. Potem migrację cofnięto i nie trafiła ona ani na `main`, ani do bazy produkcyjnej.
- **Smoke ma 4 nowe kroki:**
  - otwarcie linku nie ustawia ciasteczka gracza;
  - otwarcie linku nie dodaje gracza;
  - poczekalnia Oli mówi „to Ola”;
  - drugie zwykłe „Ola” jest zajęte.
- **Dokumenty:**
  - plan testów: cookbook §6.1, §6.2, §6.5, §6.6 oraz §4, §5 i §8;
  - `AGENTS.md`: Testing, Commands i reguła „zmiany bazy i pokoju tylko przez PR na zielonym CI”;
  - `README.md`;
  - roadmapa S-02: F4 obok F1, a znane porażki jako kryteria akceptacji.
- PR scalony na zielonym CI, Workers Builds wdrożył `main` (kod gry bez zmian), smoke na produkcji przechodzi.

### Key Discoveries:

- **Limit rejestracji i logowań.** Lokalny Supabase pozwala na 30 takich zapytań na 5 minut z jednego IP (`supabase/config.toml:194`). Testy muszą oszczędzać konta hostów, bo inaczej zaczną padać losowo.
- **Jeden otwarty pokój na hosta** (`…room_lobby.sql:32`). Kolejne `create_room` tego samego hosta z `p_confirm_close` zamyka poprzedni pokój, więc pokoje jednego hosta da się zakładać tylko po kolei.
- **RLS przy `using` milczy.** Zmiana albo odczyt cudzego wiersza zwraca 0 wierszy bez błędu, a odmowa `with check` przy `insert` daje `42501` (`research.md` §5, pułapka 3).
- **Odmowa przez brak grantu:** REST odpowiada 401 z kodem `42501` (sondy z 08.10, `context/archive/2026-10-07-room-lobby/reviews/impl-review.md:23`).
- **Kod aplikacji nie rzuca błędów z supabase-js,** tylko czyta `{ data, error, status }` i typuje wynik jako `unknown` (`src/lib/rooms/server.ts:33-48`). Testy idą tym samym wzorem, bo `strictTypeChecked` w ESLint odrzuci `any`.
- **`tsconfig.json` obejmuje `**/*`,** więc `npx astro check` i ESLint (`projectService`) sprawdzą też `tests/` i `vitest.config.ts`.
- **`src/lib/supabase.ts:3` importuje `astro:env/server`,** więc testy go nie importują i tworzą własnego klienta (`research.md` §6).

## What We're NOT Doing

- **Naprawy F1 i F4, nowej migracji (poza tymczasowym próbnym alarmem na gałęzi) ani `db push`.** Naprawa idzie do migracji S-02 (`first-live-round`).
- **Testów przejść etapów gry (H5):** stany powstaną w S-02, więc to faza 2 planu testów. **Kategorii spoza bazy (H4):** to ryzyko #3, również faza 2.
- **Asercji dla par, których wygląd zależy od decyzji o emotkach:** „Ola❤” i „Ola❤️”, „#” i „#️”, flaga Szkocji i czarna flaga. Wybór sposobu poprawki zapada przy poprawce F4 w S-02 (decyzja Karola 10.10).
- **Form zgodności** („Ｏｌａ”, „ﬁ”, „Ⅰ”): to różne nicki, przyjęte ryzyko jak podobne litery z innych alfabetów, bez testu (decyzja Karola 10.10).
- **Tego, ile znaków z limitu 20 zajmuje emotka.** Granicę sprawdzamy na zwykłych literach.
- **„< 30 s z telefonu” i iPhone'a:** to czas człowieka, ręcznie przed prawdziwym wieczorem, a nie test automatyczny.
- **Uruchamiania testów bazy w innych miejscach:** bez Docker Desktop lokalnie, bez pgTAP, bez drugiego projektu Supabase i nigdy na bazie produkcyjnej. Bez klucza secret/service_role, także do seedowania.
- **Innej konfiguracji testów:** bez `getViteConfig()`, bez `@cloudflare/vitest-plugin` i bez renderowania `.astro`.
- **Hermetycznych stubów:** w lobby nie ma nieatomowych sekwencji zapisu, bo `create_room` i `join_room` to po jednej transakcji.
- **Strykera:** nie mutuje SQL, a logika TS w zakresie (`roomErrorMessage`) jest trywialna. Rolę bramki jakości pełni próbny alarm w fazie 2.
- **Blokady wdrożenia przy czerwonym CI i branch protection:** to faza 4 planu testów (ryzyko #5). Tu tylko reguła procesu w `AGENTS.md`.
- **Testu `nickLength`:** to tylko podpowiedź w UI. Bez e2e i bez hooków (lekcje M3L3/M3L4). Bez podbijania `supabase/setup-cli@v1`: odnotowane w researchu, nie blokuje.

## Implementation Approach

**Drzwi atakującego, nie Workera.** Testy bazy wołają Supabase przez supabase-js kluczem publishable, czyli tym samym REST/RPC, którym host albo gość mógłby ominąć Workera. Gość to klient bez sesji (`anon`). Host to klient po `signUp`: lokalnie bez potwierdzania maila, więc rejestracja od razu daje sesję. Seedowanie też idzie prawdziwymi drzwiami: pokój zakłada `create_room` jako host, gościa wpuszcza `join_room` jako `anon`.

**Wyrocznia z researchu, nie z implementacji.** Oczekiwane wyniki pochodzą z tabel `research.md` §2 (H1–H8, G1–G4) i §3.1 (pary nicków ze źródeł Unicode) oraz z decyzji Karola. `private.normalize_nick` nie jest dostępna dla `anon`, więc nie da się jej użyć do policzenia oczekiwania.

**Znane dziury jako oczekiwane porażki.** Test zapisuje prawdziwe oczekiwanie i ma znacznik `test.fails`, a w nazwie dopisek „znana dziura F1 → S-02” albo „znana dziura F4 → S-02”. Gdy S-02 naprawi dziurę, test sam zrobi się czerwony i wymusi zdjęcie znacznika. Nigdy nie piszemy testu, który zapisuje dziurę jako dozwolone zachowanie, i nigdy nie używamy `skip`/`todo`.

**Gałąź i szkic PR.** Cała zmiana idzie na gałęzi `testing-lobby-foundation` w głównym katalogu (bez worktree), ze szkicem PR do `main`. Testy bazy chodzą tylko w CI, więc każda faza kończy się pushem gałęzi i zielonym CI.

Zasady pushowania (decyzja Karola 10.10):

- **Push gałęzi:** bez osobnego pytania w czacie, wystarczy okno uprawnień z `.claude/settings.json`. Zgoda obejmuje tylko tę gałąź i tę zmianę.
- **Pierwsze otwarcie szkicu PR, przełączenie PR na gotowy, scalenie (= wdrożenie) i smoke na produkcji:** zawsze najpierw pytanie w czacie.

**Kolejność faz:**

1. rura (runner, bezpieczniki, CI) udowodniona testem-kanarkiem;
2. reguły ról z próbnym alarmem;
3. nicki i wejście gościa;
4. cookbook, reguły i scalenie.

Wszystkie fazy realizuje `/10x-implement`. `/10x-tdd` się nie nadaje, bo testujemy istniejący kod i nie ma implementacji, którą czerwony test miałby wymusić.

## Critical Implementation Details

**`test.fails` odwraca każdy błąd, nie tylko asercję.** Awaria sieci, zmieniona nazwa funkcji albo upadek seedowania wewnątrz takiego testu też dają „oczekiwaną porażkę”, czyli fałszywą zieleń. Dlatego obowiązują trzy zasady:

- warunki wstępne (konta, pokoje, nick zajęty) powstają w `beforeAll`/`beforeEach`, bo błąd w hooku zostaje czerwony (sprawdzane raz w fazie 1);
- w ciele testu atak nigdy nie rzuca, tylko zbiera `{ data, error }`;
- jedynym miejscem, które może zawieść, jest końcowa asercja z wyroczni.

**„Odmowa” to konkretny kod, nigdy „jakiś błąd”.** Zasady:

- odmowa z braku grantu albo z `with check` to `42501`;
- cicha odmowa RLS (0 wierszy) sprawdzana jest skutkiem: ponownym odczytem jako właściciel albo przez `room_link`;
- każdy plik db ma kontrolę pozytywną, czyli dozwolone wywołanie, które musi się udać (np. `room_link` dla nieznanego kodu zwraca `unknown`). Inaczej źle ustawiony adres dałby „odmowę” wszędzie.

**Limit 30 rejestracji/logowań na 5 minut.** Na jeden przebieg najwyżej około 10 kont hostów. `signUp` od razu daje sesję, więc logowanie osobno nie jest potrzebne. Pliki projektu db biegną po kolei (`fileParallelism: false`), co upraszcza też jeden otwarty pokój na hosta.

**Zmienne i bezpieczniki.**

- Testy bazy czytają tylko `TEST_SUPABASE_URL` i `TEST_SUPABASE_KEY`, czyli nazwy inne niż aplikacyjne `SUPABASE_*`.
- Skrypty testów nie używają `--env-file`, bo `.dev.vars` wskazuje na produkcję.
- Bezpiecznik działa w pliku setup projektu db, przed utworzeniem pierwszego klienta.
- Brak zmiennych to błąd (czerwony przebieg), a nie pominięcie testów.

**Niewidoczne znaki w źródle** zapisujemy wyłącznie jako ucieczki `\u{…}`, nigdy dosłownie. Edytor albo formatter może je zgubić, a przegląd ich nie zobaczy.

**Seedowanie podaje `p_link_token` tak jak Worker** (`src/pages/api/rooms/index.ts:40`). Poprawka F1 w S-02 (kod linku z SQL) zepsuje helper seedowania. To oczekiwane: helper zmienia się razem z kontraktem `create_room`, w tej samej zmianie S-02.

## Faza 1: Runner i potok testów

### Overview

Postawić Vitest 5 z dwoma zestawami, bezpieczniki zestawu db, pierwszy test unit, test-kanarek bazy i job `db` w CI. Faza dowodzi, że cała rura działa od `npm test` do zielonego sprawdzenia w PR, zanim powstanie pierwszy test reguły.

### Changes Required:

#### 1. Gałąź i szkic PR

**Intent**: Cała zmiana żyje na gałęzi z CI, bo testy bazy da się uruchomić tylko tam. Pierwszy commit zabiera też niezacommitowane dokumenty: folder zmiany i poprawki `test-plan.md` z researchu.

**Contract**:

- Gałąź `testing-lobby-foundation` z lokalnego `main`.
- Szkic PR do `main` (pierwsze otwarcie po pytaniu w czacie); kolejne pushe gałęzi po oknie uprawnień.

#### 2. Vitest i skrypty

**File**: `package.json`, `vitest.config.ts` (nowy)

**Intent**: Jeden runner na unit i integrację. Konfiguracja jest osobna, bez `getViteConfig()`, bo styk z adapterem Cloudflare jest niepotwierdzony (`research.md` §6), a testy fazy 1 nie potrzebują modułów `astro:*`.

**Contract**:

- `vitest` ^5 w `devDependencies`.
- `vitest.config.ts` z aliasem `@` → `./src` (jak `tsconfig.json` `paths`) i dwoma projektami:
  - `unit`: `tests/unit/**/*.test.ts`, środowisko node;
  - `db`: `tests/db/**/*.test.ts`, plik setup z bezpiecznikami, dłuższy `testTimeout`, `fileParallelism: false`.
- Skrypty:
  - `"test"` uruchamia tylko projekt `unit`;
  - `"test:db"` uruchamia tylko projekt `db`;
  - żaden nie ładuje `.dev.vars`/`.env`.
- Importy `describe`/`it`/`expect` jawnie z `vitest` (bez globals).

#### 3. Bezpieczniki i klienci zestawu db

**File**: `tests/db/support/` (nowy katalog: setup, klienci)

**Intent**: Zestaw db nie może ruszyć produkcji ani biec na kluczu, który omija uprawnienia, bo to dałoby fałszywą zieleń (`research.md` §5, pułapki 1–2).

**Contract**:

- Setup przerywa przebieg z czytelnym komunikatem po polsku, gdy:
  - brakuje `TEST_SUPABASE_URL` albo `TEST_SUPABASE_KEY`;
  - host adresu nie jest `127.0.0.1` ani `localhost`;
  - klucz nie zaczyna się od `sb_publishable_` (wzór jak `src/lib/supabase.ts:28`).
- Fabryki klientów:
  - `anon` (bez sesji, `persistSession: false`, `autoRefreshToken: false`);
  - nowy host: `signUp` z losowym adresem `@example.com` i losowym hasłem, zwraca klienta z sesją i `user.id`.
- Losowy token gracza tego samego kształtu co Workera: 32 losowe bajty, base64url, 43 znaki.

#### 4. Pierwszy test unit

**File**: `tests/unit/room-errors.test.ts` (nowy)

**Intent**: Udowodnić, że runner działa z importem `@/`, i przy okazji pilnować, że gość dostaje czytelną odmowę (#6). Każdy z pięciu kodów odmowy z drogi wejścia gościa ma tekst inny niż ogólny „Coś poszło nie tak.”.

**Contract**:

- Dla `invalid_nick`, `nick_taken`, `room_closed`, `room_unknown`, `service_unavailable`: `roomErrorMessage(kod)` nie jest `null` i różni się od wyniku dla nieznanego kodu.
- Nieznany kod daje tekst ogólny (nie `null`), a `null` daje `null`.
- Bez przepisywania polskich tekstów do asercji, bo to byłoby lustro.

#### 5. Test-kanarek bazy

**File**: `tests/db/canary.test.ts` (nowy)

**Intent**: Pierwszy dowód, że klient z kluczem publishable naprawdę dostaje odmowę od prawdziwej bazy. Jeśli kanarek kiedyś przejdzie na kluczu uprzywilejowanym albo po otwarciu grantu, całe db jest podejrzane.

**Contract**:

- `anon` czytający `player_secrets` dostaje błąd `42501` i żadnych danych.
- Kontrola pozytywna: `anon` woła `room_link` z nieznanym kodem i dostaje `{ status: "unknown" }`.

#### 6. CI

**File**: `.github/workflows/ci.yml`

**Intent**: Unit biegnie w jobie `ci`. Testy bazy biegną w osobnym jobie `db`, równolegle ze `smoke`: osobny czerwony sygnał i osobna nazwa sprawdzenia pod przyszłą bramkę z fazy 4 planu testów. Czas czekania na wynik się nie wydłuża, a minuty są darmowe (repo publiczne).

**Contract**:

- Job `ci`: krok `npm test`.
- Nowy job `db` jak `smoke`:
  - checkout, Node 22, `supabase/setup-cli@v1`, `npm ci`;
  - `supabase start` z tą samą listą `-x`;
  - `API_URL` i `PUBLISHABLE_KEY` z `supabase status -o env` przekazane jako `TEST_SUPABASE_URL`/`TEST_SUPABASE_KEY` (np. przez `$GITHUB_ENV`);
  - `npm run test:db`;
  - `supabase stop --no-backup` z `if: always()`.

#### 7. `lessons.md`, wpis 1

**Intent**: `test:db` zapisuje do bazy, ale bezpiecznik wpuszcza wyłącznie lokalny Supabase, więc skrypt nie zmienia stanu zdalnego i reguła `ask` nie jest potrzebna.

**Contract**:

- Jedno zdanie komentarza przy bezpieczniku: poluzowanie bezpiecznika wymaga w tej samej zmianie reguły `ask` dla `Bash(npm run test:db*)`.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check` i `npm run build` przechodzą z nowymi plikami
- `npm test` przechodzi lokalnie (projekt unit)
- Celowe psucie unit: usunięty `nick_taken` z mapy w `src/lib/rooms/errors.ts` daje czerwony `npm test`, a po przywróceniu zielony
- Błąd w `beforeAll` w pliku z testem `test.fails` daje czerwony przebieg (tymczasowy plik, potem usunięty)
- `npm run test:db` lokalnie odmawia startu bez zmiennych, z adresem spoza localhost i z kluczem spoza `sb_publishable_`, zanim wyśle żądanie
- CI na szkicu PR: joby `ci`, `smoke` i `db` zielone, a w logu `db` przechodzi kanarek

#### Manual Verification:

- Karol widzi w szkicu PR trzy sprawdzenia: `ci`, `smoke` i `db`

**Implementation Note**: Po zielonym CI zatrzymaj się na potwierdzenie Karola przed fazą 2. Bloki faz mają zwykłe wypunktowania, a checkboxy są tylko w `## Progress`.

---

## Faza 2: Role (#4)

### Overview

Testy uprawnień przez REST/RPC jako gość i jako host:

- **strażnicy:** zielone dziś przypadki H6–H8 i G1–G3 z `research.md` §2;
- **znane dziury:** H1–H3 jako oczekiwane porażki „znana dziura F1 → S-02”;
- **próbny alarm:** dowód, że strażnicy łapią prawdziwie otwarte uprawnienie.

### Changes Required:

#### 1. Seedowanie przez drzwi ról

**File**: `tests/db/support/` (helpery pokoju i gościa)

**Intent**: Pokoje i goście powstają tylko tak, jak w prawdziwej grze, żeby test nie omijał reguł, które sprawdza.

**Contract**:

- Założenie pokoju: host woła `create_room` ze świeżym kodem linku (jak Worker), nickiem hosta i kategoriami; opcja `p_confirm_close`.
- Odczyt własnego pokoju hosta (id, kod linku, status) przez `select` hosta.
- Wejście gościa: `anon` woła `join_room` ze świeżym tokenem; wynik i token wracają do testu.

#### 2. Strażnicy ról

**File**: `tests/db/roles.test.ts` (nowy)

**Intent**: Każdy test łapie inną regresję, jaką mogłaby wprowadzić migracja S-02 albo późniejsza (otwarty grant, poluzowana polityka, funkcja przyznana `anon`).

**Contract** (wyrocznia: `research.md` §2, PRD Access Control `prd.md:156-175`):

- **H6.** Host B wobec pokoju hosta A:
  - `select` pokoju i jego graczy zwraca 0 wierszy;
  - `update` statusu nie zmienia statusu (A czyta ponownie);
  - `insert` gracza do pokoju A daje `42501`, a poczekalnia A się nie zmienia.
- **H7.** Host czytający `player_secrets` dostaje `42501`.
- **H8.** Host wstawiający do własnego pokoju gracza z `user_id` null (fałszywy gość z pominięciem reguły nicku) dostaje `42501`.
- **G1.** `anon` dostaje `42501` przy `select` z `rooms` i `players` oraz przy `insert` do nich (tabela parametryzowana).
- **G2.** `anon` wołający `create_room` dostaje odmowę uprawnień do funkcji.
- **G3.** Gość z tokenem z pokoju A:
  - `room_lobby` pokoju B daje `null`;
  - kontrola pozytywna: `room_lobby` pokoju A ma `me` równe jego nickowi (to także powrót na nick po odświeżeniu na poziomie bazy);
  - losowy token i brak tokenu dają `null`.

#### 3. Znane dziury F1

**File**: `tests/db/roles.test.ts`

**Intent**: Zapisać wymaganie z triage F1 i roadmapy S-02 jako test, który dziś pada, z odwołaniem do naprawy. Nie zapisywać dziury jako dozwolonego zachowania.

**Contract** (każdy test `test.fails`, nazwa z „znana dziura F1 → S-02”; atak bez rzucania, asercja skutku):

- **H1, zamknięty pokój zostaje zamknięty.**
  - Warunek wstępny w hooku: host zakłada pokój A, potem B z `p_confirm_close`, więc A jest zamknięty.
  - Atak: `update` B na `closed`, potem `update` A na `lobby`.
  - Asercja: `room_link` kodu A zwraca `closed`.
- **H2, host nie wybiera kodu linku.** Dwa osobne testy, po jednym na drzwi:
  - `create_room` z kodem wybranym przez test;
  - `insert` do `rooms` z kodem wybranym przez test.
  
  Asercja w obu: `room_link` wybranego kodu zwraca `unknown`. Zostaje prawdziwa także po naprawie, w której `create_room` straci parametr i wywołanie skończy się błędem.
- **H3, host nie zapisze nicku z pominięciem reguły.**
  - Atak: host bez pokoju wstawia przez REST własny pokój i własny wiersz gracza z nickiem `Ola` + U+200B; potem gość wchodzi jako „Ola”.
  - Asercja: w pokoju jest najwyżej jeden z nicków „Ola” i „Ola”+U+200B (para z `research.md` §3.1, nie z funkcji).

#### 4. Próbny alarm (decyzja Karola 10.10)

**File**: `supabase/migrations/<timestamp>_break_check_tmp.sql` (tymczasowa, przez `npx supabase migration new break_check_tmp`)

**Intent**: Udowodnić na prawdziwej bazie, że zieloni strażnicy zaświecą na czerwono, gdy ktoś otworzy uprawnienie. To odpowiedź na ryzyko #5 („test niczego nie pilnuje”).

**Contract**:

- Jeden commit na gałęzi z migracją, która otwiera trzy dziury:
  - grant `select` na `player_secrets` dla `anon`;
  - grant `execute` na `create_room` dla `anon`;
  - polityka `select` na `rooms` przepuszczająca każdego hosta.
- Nagłówek pliku: „TEMPORARY break-check, never `db push`, reverted in the next commit”.
- Przed pushem lista przewidzianych czerwonych testów: kanarek (odczyt `player_secrets`), G2 i ten przypadek H6, w którym host B czyta pokój hosta A. Reszta H6 zostaje zielona, bo polityki zmiany i graczy pilnują właściciela niezależnie. Po CI porównanie z faktycznie czerwonymi.
- Potem `git revert` tego commita (bez przepisywania historii) i push. CI zielone.
- Migracja nigdy nie trafia na `main` w stanie obecnym ani do `db push`.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check`, `npm run build` i `npm test` przechodzą
- CI `db` zielone: strażnicy ról przechodzą, a H1–H3 to oczekiwane porażki z dopiskiem „znana dziura F1 → S-02”
- Próbny alarm: commit z tymczasową migracją daje czerwone dokładnie przewidziane testy i żadne inne
- Po cofnięciu próbnego alarmu CI zielone, a `git diff main...HEAD -- supabase/migrations` jest pusty

#### Manual Verification:

- Karol zatwierdza zestawienie „przewidziane czerwone vs faktycznie czerwone” z próbnego alarmu

**Implementation Note**: Jeśli próbny alarm zaświeci inne testy niż przewidziane, albo któryś przewidziany zostanie zielony, zatrzymaj się i wyjaśnij przyczynę przed cofnięciem. To znaczy, że któryś test nie pilnuje tego, co deklaruje.

---

## Faza 3: Nicki i wejście gościa (#6)

### Overview

Tabela par nicków przez `join_room` jako gość, przypadki długości i pustego nicku oraz 4 kroki smoke dla otwarcia linku i powrotu na nick.

### Changes Required:

#### 1. Pary nicków

**File**: `tests/db/nicks.test.ts` (nowy)

**Intent**: Udowodnić regułę „co wygląda tak samo, to ten sam nick” na wyroczni z Unicode, a nie z `normalize_nick`. Tabela pilnuje obu kierunków: podróbki są odrzucane, a widocznie inne nicki wchodzą (ochrona przed zbyt agresywną poprawką w S-02).

**Contract**:

- **Dane:** 22 wiersze z `research.md` §3.1, plus zwykły duplikat „Ola” wobec „Ola” (`nick_taken`). Każdy wiersz ma:
  - nick zajęty;
  - nick próbny (ucieczki `\u{…}`);
  - oczekiwanie `nick_taken` albo „wchodzi”;
  - krótkie „dlaczego” ze źródłem;
  - znacznik znanej dziury F4.
- **Podział:** 14 wierszy zielonych i 9 jako `test.fails` z „znana dziura F4 → S-02”:
  - selektory wariantu po literze: U+FE0F i U+FE0E;
  - VS-17 (U+E0100);
  - znacznik U+E0041;
  - U+061C, U+180F, U+1BCA0, U+1D173;
  - „Ola😀” wobec „Ola😀”+U+FE0F.
- **Izolacja:** każdy wiersz we własnym `describe` z `beforeAll`, który zakłada świeży pokój (ten sam host, kolejne `create_room` z `p_confirm_close`) i wpuszcza nick zajęty. Sam test robi tylko próbę i asercję.

#### 2. Długość i pusty nick

**File**: `tests/db/nicks.test.ts`

**Intent**: Za długi nick, także bardzo długi, dostaje czytelną odmowę `invalid_nick`, a nie ogólny błąd (test-plan §2, #6). Granica pochodzi z decyzji S-01 „1–20 znaków” i z komunikatu „Nick musi mieć od 1 do 20 znaków.”.

**Contract**:

- 20 zwykłych liter wchodzi; 21 daje `invalid_nick`; 10 000 znaków daje `invalid_nick`.
- `""`, spacja, U+200B i U+3000 dają `invalid_nick` (nick, który wygląda na pusty).
- Bez przybijania progu 100 z F4.
- Jeśli bardzo długi nick jest dziś stale czerwony, oznaczyć go jako znaną dziurę F4. Jeśli bywa raz czerwony, raz zielony, zatrzymać się i zapytać.

#### 3. Kroki smoke

**File**: `scripts/smoke.mjs`

**Intent**: Dwie rzeczy z #6, których nie da się uczciwie sprawdzić w bazie, bo dotyczą strony `GET /j/<kod>` i ciasteczka gościa. Kroki biegną w CI i na produkcji, nie tworzą nowych pokoi ani graczy.

**Contract**:

- Po kroku „room page shows host the link”, przed wejściem Oli:
  - świeży słoik ciasteczek trzy razy otwiera `/j/<kod>`; odpowiedź 200 i żadne ciasteczko `mlt_player_` (nowe oczekiwanie w porównywarce, np. `noCookie`);
  - poczekalnia hosta ma dokładnie jednego gracza.
- Po wejściu Oli:
  - poczekalnia z jej słoikiem ma `"me":"Ola"` (powrót po odświeżeniu);
  - drugie zwykłe „Ola” z nowego słoika trafia na `?error=nick_taken`.
- Komentarz nad krokami gości zaktualizowany.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check`, `npm run build` i `npm test` przechodzą
- CI `db` zielone: 14 par i przypadki długości przechodzą, a 9 par to oczekiwane porażki „znana dziura F4 → S-02”
- CI `smoke` zielone z 4 nowymi krokami

#### Manual Verification:

- Karol przegląda wypis par z testu (punkty kodowe i oczekiwanie) obok tabeli z `research.md` §3.1: ten sam zestaw, te same oczekiwania

**Implementation Note**: Wypis par generuje skrypt z danych testu, nie przepisuje się go ręcznie, bo inaczej porównanie niczego nie dowodzi.

---

## Faza 4: Cookbook, reguły i scalenie

### Overview

Zapisać, jak dodawać testy w tym projekcie, zmienić reguły dla agentów i zamknąć zmianę na `main` z zielonym CI i smoke na produkcji.

### Changes Required:

#### 1. Plan testów

**File**: `context/foundation/test-plan.md`

**Intent**: Kolejne fazy i agenci dodają testy według jednego wzoru.

**Contract**:

- **§4 Stack:**
  - Vitest 5.0.x (checked: data) dla unit i integracji, bez `getViteConfig`;
  - wiersz DB: integracja przez REST/RPC kluczem publishable, tylko w CI, pgTAP nie wybrany (Docker potrzebny także przy `--db-url`);
  - Node 22 w CI i 24 lokalnie;
  - liczba kroków smoke.
- **§5:**
  - wiersz unit: `local + CI`, `required`;
  - wiersz integracji bazy: `CI only` (lokalnie brak Dockera), `required` w sensie reguły PR z `AGENTS.md`; technicznie bramka zatrzyma wdrożenie dopiero po fazie 4 planu.
- **§6.1** (unit): lokalizacja, uruchomienie, wyrocznia z PRD, asercja zachowania, nie tekstu.
- **§6.2** (uprawnienia i funkcje bazy):
  - lokalizacja i helpery;
  - role przez klucz publishable, bez secret;
  - odmowa jako `42501` albo skutek;
  - kontrola pozytywna;
  - znana dziura jako `test.fails` z „znana dziura <F> → <zmiana>”;
  - warunki wstępne w hookach;
  - limit rejestracji;
  - uruchamianie tylko w CI (`TEST_SUPABASE_*`);
  - wzór próbnego alarmu.
- **§6.5:** nowe oczekiwanie „brak ciasteczka”.
- **§6.6:** 2–3 linie o tym, co pokazała faza.
- **§8:** daty weryfikacji stosu.

#### 2. Reguły dla agentów (decyzja Karola 10.10)

**File**: `AGENTS.md`

**Intent**: Zastąpić nieprawdziwe „No unit or e2e framework yet” i dać testom bazy realną moc procesu, zanim faza 4 planu testów zablokuje wdrożenie technicznie.

**Contract** (tekst do akceptacji Karola przed commitem):

- **Testing:**
  - `npm test` (unit, lokalnie) i `npm run test:db` (tylko lokalny Supabase, w praktyce CI; odmawia innego adresu i klucza);
  - odnośnik do cookbooka test-plan §6;
  - zasada: test `test.fails` dokumentuje znaną dziurę; gdy po naprawie zrobi się czerwony, zdejmij znacznik, nigdy nie usuwaj testu.
- **Commands:** bramka przed przekazaniem obejmuje `npm test`.
- **Nowa reguła:** zmiany w `supabase/migrations/`, `src/lib/rooms/`, `src/pages/api/rooms/`, `src/pages/j/` i `src/pages/r/` idą tylko przez PR i są scalane wyłącznie na zielonym CI, także `db`. Nigdy push prosto na `main`.

#### 3. README

**File**: `README.md`

**Intent**: Lista skryptów i opis CI zgodne ze stanem po zmianie.

**Contract**:

- Skrypty `npm test` i `npm run test:db` w liście skryptów (okolice `:60`).
- Job `db` w opisie CI (okolice `:216`).

#### 4. Roadmapa S-02

**File**: `context/foundation/roadmap.md`

**Intent**: Decyzja Karola z 10.10: F4 idzie do migracji S-02 razem z F1, a testy oznaczone jako znane dziury są jej kryteriami akceptacji.

**Contract**:

- Punktowa edycja linii `- **Risk:**` w `### S-02` (bez Prettiera na całym pliku).
- Dopisane: reguła nicku i limit długości (F4), oraz „kryteria akceptacji: testy »znana dziura F1/F4 → S-02« w `tests/db/` przechodzą, a znacznik `test.fails` zostaje zdjęty”.

#### 5. Scalenie i produkcja

**Intent**: Testy stają się bramką dopiero na `main`. Kod gry się nie zmienia, więc wdrożenie po scaleniu niesie tylko testy, CI, smoke i dokumenty. Wpis 3 z `lessons.md` jest spełniony przez przebieg zmienionego smoke w CI na gałęzi.

**Contract**:

- PR przełączony na gotowy (pytanie w czacie).
- Scalenie `gh pr merge --merge` (pytanie w czacie, bo to wdrożenie).
- Workers Builds `main`, CI na `main`.
- `BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke` (pytanie w czacie; jak zawsze zostawia pokoje na koncie testowym).

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check`, `npm run build` i `npm test` przechodzą
- CI na PR zielone (`ci`, `smoke`, `db`), a `git diff main...HEAD -- supabase/migrations` jest pusty
- Po scaleniu Workers Builds wdrożył `main`, CI na `main` zielone, a smoke na produkcji przechodzi z nowymi krokami

#### Manual Verification:

- Karol akceptuje tekst nowych reguł w `AGENTS.md` przed commitem
- Karol zgadza się na scalenie PR (= wdrożenie)

**Implementation Note**: Przed scaleniem warto uruchomić `/10x-impl-review testing-lobby-foundation`, jak przy S-01. Lekcja wymaga przeglądu każdej zmiany.

---

## Testing Strategy

### Unit Tests:

- `roomErrorMessage`: pięć kodów odmowy z drogi gościa ma tekst inny niż ogólny, nieznany kod daje tekst ogólny, `null` daje `null`.
- Główna wartość unit w tej fazie to runner gotowy pod fazę 2 (losowanie pytań, #3).

### Integration Tests:

- Role (#4): strażnicy H6–H8 i G1–G3, znane dziury H1–H3 (F1).
- Nicki (#6):
  - 23 wiersze par (14 zielonych, 9 jako F4);
  - długość 20/21/10 000;
  - nick, który wygląda na pusty;
  - powrót na nick (`me`) przez `room_lobby`.
- Kanarek z kontrolą pozytywną w każdym pliku db.
- Próbny alarm w fazie 2.

### Manual Testing Steps:

1. Szkic PR pokazuje sprawdzenia `ci`, `smoke` i `db` (faza 1).
2. Zestawienie z próbnego alarmu: przewidziane czerwone testy to faktycznie czerwone (faza 2).
3. Wypis par z testu zgadza się z tabelą w `research.md` §3.1 (faza 3).
4. Tekst reguł w `AGENTS.md` zaakceptowany, scalenie za zgodą, smoke na produkcji (faza 4).

## Performance Considerations

Job `db` dokłada około 2–3 minut, ale biegnie równolegle ze `smoke`, więc czas czekania na wynik PR się nie zmienia. Bardzo długi nick (10 000 znaków) to jedyne potencjalnie wolne wywołanie. Jego niestabilność to sygnał do zatrzymania (faza 3), a nie powód do podnoszenia limitu czasu.

## Migration Notes

Brak migracji w stanie końcowym. Tymczasowa migracja próbnego alarmu powstaje i jest cofana na gałęzi (faza 2), nigdy nie idzie do `db push`, a na końcu `git diff main...HEAD -- supabase/migrations` jest pusty.

## References

- Research: `context/changes/testing-lobby-foundation/research.md` (§2 role, §3.1 pary nicków, §5 pułapki, §6 runner, §7 CI, §8 ścieżka B)
- Plan testów: `context/foundation/test-plan.md` §2 (#4, #6), §5, §6
- Migracja lobby: `supabase/migrations/20261007122858_room_lobby.sql:32,58-93,97-125,131-266,302-378`
- Przegląd S-01: `context/archive/2026-10-07-room-lobby/reviews/impl-review.md` (F1, F4, sondy `:23`), `context/archive/2026-10-07-room-lobby/follow-ups/review-fixes.md`
- CI i smoke: `.github/workflows/ci.yml:27-67`, `scripts/smoke.mjs:203-274`
- Limit rejestracji: `supabase/config.toml:194`; potwierdzanie maila lokalnie: `supabase/config.toml:215`
- Wzór wywołań bazy: `src/lib/rooms/server.ts:33-48`
- Reguły: `context/foundation/lessons.md` (wpisy 1 i 3), `AGENTS.md` (Hard Rules, Testing)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Runner i potok testów

#### Automated

- [x] 1.1 `npm run lint`, `npx astro check` i `npm run build` przechodzą z nowymi plikami — 4c50599
- [x] 1.2 `npm test` przechodzi lokalnie (projekt unit) — 4c50599
- [x] 1.3 Celowe psucie unit: usunięty `nick_taken` z mapy w `src/lib/rooms/errors.ts` daje czerwony `npm test`, a po przywróceniu zielony — 4c50599
- [x] 1.4 Błąd w `beforeAll` w pliku z testem `test.fails` daje czerwony przebieg (tymczasowy plik, potem usunięty) — 4c50599
- [x] 1.5 `npm run test:db` lokalnie odmawia startu bez zmiennych, z adresem spoza localhost i z kluczem spoza `sb_publishable_`, zanim wyśle żądanie — 4c50599
- [x] 1.6 CI na szkicu PR: joby `ci`, `smoke` i `db` zielone, a w logu `db` przechodzi kanarek — 4c50599

#### Manual

- [x] 1.7 Karol widzi w szkicu PR trzy sprawdzenia: `ci`, `smoke` i `db` — 4c50599

### Phase 2: Role (#4)

#### Automated

- [x] 2.1 `npm run lint`, `npx astro check`, `npm run build` i `npm test` przechodzą — 0174ff0
- [x] 2.2 CI `db` zielone: strażnicy ról przechodzą, a H1–H3 to oczekiwane porażki z dopiskiem „znana dziura F1 → S-02” — 0174ff0
- [x] 2.3 Próbny alarm: commit z tymczasową migracją daje czerwone dokładnie przewidziane testy i żadne inne — 0174ff0
- [x] 2.4 Po cofnięciu próbnego alarmu CI zielone, a `git diff main...HEAD -- supabase/migrations` jest pusty — 0174ff0

#### Manual

- [x] 2.5 Karol zatwierdza zestawienie „przewidziane czerwone vs faktycznie czerwone” z próbnego alarmu — 0174ff0

### Phase 3: Nicki i wejście gościa (#6)

#### Automated

- [x] 3.1 `npm run lint`, `npx astro check`, `npm run build` i `npm test` przechodzą — 2f566bf
- [x] 3.2 CI `db` zielone: 14 par i przypadki długości przechodzą, a 9 par to oczekiwane porażki „znana dziura F4 → S-02” — 2f566bf
- [x] 3.3 CI `smoke` zielone z 4 nowymi krokami — 2f566bf

#### Manual

- [x] 3.4 Karol przegląda wypis par z testu (punkty kodowe i oczekiwanie) obok tabeli z `research.md` §3.1: ten sam zestaw, te same oczekiwania — 2f566bf

### Phase 4: Cookbook, reguły i scalenie

#### Automated

- [x] 4.1 `npm run lint`, `npx astro check`, `npm run build` i `npm test` przechodzą
- [ ] 4.2 CI na PR zielone (`ci`, `smoke`, `db`), a `git diff main...HEAD -- supabase/migrations` jest pusty
- [ ] 4.3 Po scaleniu Workers Builds wdrożył `main`, CI na `main` zielone, a smoke na produkcji przechodzi z nowymi krokami

#### Manual

- [x] 4.4 Karol akceptuje tekst nowych reguł w `AGENTS.md` przed commitem
- [ ] 4.5 Karol zgadza się na scalenie PR (= wdrożenie)
