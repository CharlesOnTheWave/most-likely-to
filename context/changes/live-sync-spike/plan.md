# Live sync spike (F-01) — plan implementacji

## Overview

Budujemy mały prototyp rundy na żywo w wariancie B, wybranym w `external-research.md` (decyzja Karola 2026-09-27, ścieżka 1). Działa tak:

- serwer nadaje na publicznym kanale Supabase Realtime sam sygnał „coś się zmieniło” (dzwonek);
- przeglądarka po dzwonku pobiera stan z naszego endpointu na Workerze (tablica);
- sonda z 20 osobnymi połączeniami mierzy, czy to mieści się w budżecie czasu, lokalnie i na produkcji;
- Karol sprawdza na telefonie, czy połączenie wraca po zgaszeniu ekranu.

Wynik rozstrzyga, czy B zostaje techniką dla S-01 i S-02, czy przechodzimy na plan awaryjny (Durable Objects przez PartyServer, osobną zmianą).

Zakres jest „mały” (decyzja Karola): bez tabel, bez migracji i bez zmian w produkcyjnej bazie. Tabele pokoju, rundy i głosów powstaną w S-01 i S-02.

## Current State Analysis

Według `research.md`:

- **Brak kodu na żywo.** W `src/` nie ma kodu realtime, stron gry, endpointów JSON ani klienta Supabase dla przeglądarki (research §1, §5). Jedyna fabryka klienta to `createServerClient` w `src/lib/supabase.ts:9-20`. Klucze czyta się z `astro:env/server` (`astro.config.mjs:19-20`, `server`/`secret`).
- **Reguła `AGENTS.md:10`** zabrania kluczy Supabase w komponentach React. `SUPABASE_KEY` to klucz publishable, który Supabase opisuje jako „Safe to expose online” (`external-research.md`).
- **Zmienne `astro:env/client` trafiają do bundla przy buildzie,** a `deploy-plan.md:143` zakazuje zmiennych buildu dla Supabase. Klucz musi więc trafić do przeglądarki w runtime: przez props strony albo JSON z endpointu.
- **Middleware** przy każdym żądaniu SSR woła `auth.getUser()` (`src/middleware.ts:6-12`), a `locals.user` pozwala sprawdzić, czy ktoś jest zalogowany. Chroniony jest tylko `/dashboard` (`:4,18-22`).
- **Wzorce API i stron:**
  - endpointy to `export const POST: APIRoute` z przekierowaniem (`src/pages/api/auth/signin.ts:4-19`), bez precedensu dla JSON i `GET`;
  - wyspy React dostają dane przez props i są montowane z `client:load` (`src/pages/auth/signin.astro:5,14`);
  - w `src/components/ui/` jest tylko `button.tsx`.
- **Pytania:** `src/data/questions.ts` ma 216 pytań (57 z `adult: true`) i nikt ich nie importuje. `lessons.md:12-16` pozwala importować je tylko w kodzie serwera, a do przeglądarki wysyłać tylko bieżące pytanie jako zwykły tekst.
- **Wzorzec sondy:** `scripts/smoke.mjs`, czyli BASE_URL, własny słoik ciasteczek, PASS/FAIL i kod wyjścia. Test zakłada konto `smoke-…@example.com` w produkcyjnym Supabase.
- **Lint skryptów:** globale to tylko `console, process, fetch, URLSearchParams` (`eslint.config.js:76`).
- **Uprawnienia:**
  - allow `npm *`, `npx *`, `node *` (`.claude/settings.json:4-6`);
  - ask obejmuje `npx supabase db *` (`:33`), ale nie `npx supabase migration up/down/repair`, co jest wbrew `lessons.md:9`.
- **Realtime w Node:** Node 24 ma globalny `WebSocket`. `RealtimeClient.channel()` zwraca istniejący kanał dla tego samego tematu (`node_modules/@supabase/realtime-js/src/RealtimeClient.ts:462-473`), więc 20 graczy wymaga 20 osobnych klientów. `httpSend(event, payload)` jest w supabase-js 2.116.0 (`RealtimeChannel.d.ts:511`), a `package.json:23` dopuszcza `^2.99.1`.
- **Wymagania z PRD:**
  - odsłona u każdego gracza w ciągu 2 s (`prd.md:139`);
  - powrót po utracie połączenia w mniej niż 10 s (`prd.md:142`).

## Desired End State

- Strona `/dev/live-sync` działa lokalnie i na produkcji:
  - gość widzi status połączenia, licznik powrotów i po każdym dzwonku pytanie pobrane z tablicy;
  - zalogowany ma przycisk „Zadzwoń”.
- `npm run live-probe` mierzy 1 pokój × 20 graczy w 10 próbach i wydaje werdykt: kod 0, gdy spełnione jest kryterium F-01 (niżej), kod 1, gdy nie, kod 2 przy błędzie technicznym. Przebieg `--rooms 5` (100 graczy) daje wynik informacyjny.
- `measurements.md` zawiera wyniki lokalne i produkcyjne, test telefonu i werdykt dla B.
- Reguła o kluczu jest doprecyzowana w AGENTS.md i dokumentach: publishable wolno podać przeglądarce w runtime, secret nigdy.
- Polecenia sondy i `npx supabase migration up/down/repair` wymagają zgody (ask).
- Roadmapa (F-01) i `infrastructure.md` opisują wynik.

**Kryterium F-01 (decyzja Karola 2026-09-27):**
- 95% dostarczeń „dzwonek + pobranie tablicy” mieści się w 2 s;
- żadne dostarczenie nie przekracza 5 s;
- każdy gracz dostał każdy dzwonek;
- w pomiarze 1 pokój × 20 graczy × 10 prób nie było rozłączeń.

Kryterium jest świadomie luźniejsze niż dosłowne „u każdego gracza w ciągu 2 s” z `prd.md:139`. Czy doprecyzować PRD, rozstrzyga S-02.

### Key Discoveries:

- `deploy-plan.md:143`: zakaz zmiennych buildu dla Supabase, więc klucz trafia do przeglądarki w runtime (props lub JSON).
- `RealtimeClient.ts:462-473`: jeden klient nie zasymuluje 20 graczy.
- `httpSend` zwraca 202, czyli „przyjęte”, nie „dostarczone” (`RealtimeChannel.ts:944-983`). Czas trzeba mierzyć po stronie odbiorców.
- `lessons.md:9`: każde polecenie, które zmienia stan zdalny (sonda zakłada konto i nadaje), dostaje ask w tej samej zmianie.
- `infrastructure.md:195`: Durable Objects dopiero, gdy test z 20 graczami obali Supabase.

## What We're NOT Doing

- **Tabele, migracje i zmiany w produkcyjnej bazie.** Tabele pokoju, rundy i głosów, zapis głosów (funkcja `security definer` albo klucz secret) i tożsamość gościa (ciasteczko) należą do S-01 i S-02.
- **Nadrabianie dzwonka przegapionego przy zgaszonym ekranie.** Sprawdzamy powrót połączenia i złapanie kolejnego dzwonka; nadrabianie dojdzie w S-02 razem ze stanem w bazie (decyzja Karola).
- **Kanały prywatne, anonimowe konta (A) i Durable Objects (C).** C tylko wtedy, gdy pomiar obali B, i to osobną zmianą przez `/10x-new`.
- **Zmiana middleware** (`getUser()` przy każdym żądaniu). Najpierw pomiar, który rozbija czas na dzwonek i tablicę.
- **Uruchamianie sondy w CI** (job smoke ma wyłączone realtime) i test celowego przekroczenia limitu 100/s, który obciążyłby jedyny, produkcyjny projekt.
- **Reguła ask dla `npm run smoke`.** Zakładanie kont przez smoke to udokumentowane zachowanie (AGENTS.md, Testing).
- **Sprzątanie kont `smoke-…` i `probe-…`** zostaje na liście „na później” w `deploy-plan.md`.
- **Zmiana PRD i podbicie adaptera `@astrojs/cloudflare`.** Adapter byłby potrzebny tylko dla Durable Objects.

## Implementation Approach

Kolejność idzie od zasad do pomiaru:

1. Najpierw zasady i uprawnienia, żeby kod prototypu od początku był zgodny z regułami, a sonda od pierwszego uruchomienia pytała o zgodę.
2. Potem serwer (biblioteka i trzy endpointy).
3. Potem strona demo.
4. Na koniec sonda z pomiarem lokalnym.

Faza 5 (produkcja i telefon) rusza dopiero po `/10x-impl-review` i zgodzie Karola na push. To zasada z M2L3: push na `main` to wdrożenie. Moduł wspólny dla przeglądarki i serwera zawiera tylko stałe; import bazy pytań siedzi wyłącznie w module serwerowym.

## Critical Implementation Details

**Pomiar czasu:**
- Sonda bierze `t0` przed wysłaniem żądania „zadzwoń”, a czasy dostarczenia mierzy w callbackach 20 osobnych klientów tym samym zegarem `performance.now()`.
- Znaczniki czasu z Workera i odpowiedź `httpSend` się nie nadają: 202 znaczy tylko „przyjęte”.

**Reguła ask musi łapać każde uruchomienie sondy.** Sonda przyjmuje adres serwera wyłącznie flagą `--base-url` (domyślnie `http://localhost:4321`), a nie zmienną środowiskową. Każde uruchomienie zaczyna się wtedy od `npm run live-probe` albo `node scripts/live-sync-probe.mjs`. Wzorce z prefiksem env (`BASE_URL=… npm run …`) mogłyby ominąć ask.

**Anonimowość i reguła pytań:**
- Temat kanału (`live-sync:<room>`), nazwa zdarzenia (`bell`) i payload (`{ seq }`) nie niosą danych o graczach.
- Endpointy nie logują treści żądań; `observability` Workera jest włączone.
- Wyspa React nie importuje `src/data/questions.ts` ani modułu serwerowego. Sprawdza to grep po zbudowanym `dist/client`.

**Dzwonek jest niezaufaną podpowiedzią:**
- Na publicznym kanale każdy z kluczem publishable może sam nadać `bell` z dowolnym `seq` („any user can subscribe to the channel, send and receive messages”, `external-research.md:65`; przyjęte ryzyko `:153,186`). Zasada „dzwoni tylko zalogowany” pilnuje wyłącznie naszego endpointu `POST /api/live-sync/ring`, nie kanału.
- Wyliczanie pytania z `seq` z dzwonka (`stateFor(room, seq)`) to skrót tylko na prototyp bez tabel. Od S-02 tablica czyta bieżącą rundę z bazy i nie bierze z dzwonka niczego, co decyduje o treści; fałszywy dzwonek może wtedy wywołać najwyżej zbędne odświeżenie (pre-mortem `infrastructure.md:143`).

**Klient przeglądarki tylko do Realtime:** `createClient` z supabase-js z `auth.persistSession: false`, `autoRefreshToken: false` i `detectSessionInUrl: false`. Nie może ruszać sesji hosta, którą obsługuje serwer przez ciasteczka.

**Publiczne kanały muszą być dozwolone** w ustawieniach Realtime projektu (przełącznik „Allow public access”, według docs domyślnie włączony). Jeśli subskrypcja kończy się `CHANNEL_ERROR`, Karol sprawdza przełącznik w panelu; agent go nie zmienia.

## Faza 1: Zasady, uprawnienia i zależności

### Overview

Doprecyzowanie reguły o kluczu, reguły ask, globale lintu i dolna granica wersji supabase-js (^2.114.0). Bez kodu aplikacji.

### Changes Required:

#### 1. Reguła o kluczach Supabase

**File**: `AGENTS.md`

**Intent**: Zastąpić zakaz „never in React components” regułą rozróżniającą klucze. Wariant B wymaga subskrypcji kanału z przeglądarki, a klucz publishable jest do tego przeznaczony.

**Contract**: Punkt w `## Hard Rules` (dziś `AGENTS.md:10`) mówi:
- `SUPABASE_URL` / `SUPABASE_KEY` czytamy tylko przez `astro:env/server` (zob. `src/lib/supabase.ts`), nigdy przez `import.meta.env`;
- `SUPABASE_KEY` musi być kluczem publishable (`sb_publishable_…`);
- kod serwera może przekazać URL i ten klucz przeglądarce w runtime (props strony albo JSON z endpointu) wyłącznie do subskrypcji Realtime;
- klucz secret/service_role nigdy nie trafia do przeglądarki, repo ani logów;
- `.env` i `.dev.vars` nigdy w commicie (bez zmian).

#### 2. Dokumenty powtarzające starą regułę

**File**: `README.md`, `context/foundation/infrastructure.md`

**Intent**: Usunąć twierdzenia sprzeczne z nową regułą, żeby agent w kolejnych zmianach nie dostał dwóch wersji.

**Contract**:
- `README.md:76` („never exposed to the client”) dostaje zdanie zgodne z punktem 1;
- `infrastructure.md:17` („Runda na żywo idzie przez Supabase Realtime prosto z przeglądarki”) mówi: przeglądarka subskrybuje publiczny kanał kluczem publishable, a stan pochodzi z serwera;
- `infrastructure.md:127`, `:160-162` i `:191` są zgodne z nową regułą (odczyt przez `astro:env/server`, klucz publishable) i zostają bez zmian;
- zapis wyniku F-01 dochodzi w fazie 5.

#### 3. Reguły ask

**File**: `.claude/settings.json`

**Intent**: Zgodnie z `lessons.md:9` sonda (zakłada konto i nadaje na produkcyjny projekt) i polecenia migracji zmieniające bazę zdalną mają wymagać zgody (decyzja Karola: naprawić przy okazji).

**Contract**: W `permissions.ask` dochodzą:
- `Bash(npm run live-probe*)`;
- `Bash(node scripts/live-sync-probe*)`;
- `Bash(node ./scripts/live-sync-probe*)`;
- `Bash(npx supabase migration up*)`;
- `Bash(npx supabase migration down*)`;
- `Bash(npx supabase migration repair*)`.

Plik pozostaje poprawnym JSON-em.

#### 4. Globale lintu dla skryptów

**File**: `eslint.config.js`

**Intent**: Sonda używa zegara i timerów, a `no-undef` obejmuje `scripts/**/*.mjs`.

**Contract**: `scriptsConfig.languageOptions.globals` (`eslint.config.js:76`) zawiera dodatkowo `performance`, `setTimeout`, `clearTimeout` i `URL`.

#### 5. Dolna granica supabase-js

**File**: `package.json`, `package-lock.json`

**Intent**: `httpSend` wymaga supabase-js ≥ 2.107.0, a zakres `^2.99.1` na to pozwala, ale tego nie gwarantuje. `@supabase/ssr` 0.12.7 i tak wymaga już `^2.114.0` (`package-lock.json:3034-3036`), więc dolna granica idzie do tej wartości.

**Contract**:
- `dependencies["@supabase/supabase-js"]` = `^2.114.0`;
- `npm install` synchronizuje lock, a rozwiązana wersja zostaje 2.116.0 (bez podbijania innych paczek).

### Success Criteria:

#### Automated Verification:

- Bramka przechodzi: `npm run lint`, `npx astro check`, `npm run build`
- `.claude/settings.json` parsuje się jako JSON i zawiera 6 nowych wpisów ask
- W zmianach lockfile zmienia się tylko zakres `@supabase/supabase-js` w pakiecie głównym; zainstalowana wersja to 2.116.0

#### Manual Verification:

- Karol akceptuje nowe brzmienie reguły o kluczach w AGENTS.md

**Implementation Note**: Po automatycznej weryfikacji pauza na potwierdzenie Karola, potem kolejna faza.

---

## Faza 2: Dzwonek i tablica (serwer)

### Overview

Moduły `live-sync` (wspólny i serwerowy) oraz trzy endpointy JSON: konfiguracja, dzwonek i tablica.

### Changes Required:

#### 0. Publiczna konfiguracja z serwera

**File**: `src/lib/supabase.ts`

**Intent**: Jedno miejsce, które wydaje URL i klucz publishable do przekazania przeglądarce. Nowa reguła z AGENTS.md wskazuje ten plik. Powstaje w tej fazie, bo korzysta z niego endpoint konfiguracji (#3), a w fazie 3 strona demo.

**Contract**:
- `getPublicSupabaseConfig(): { supabaseUrl: string; supabaseKey: string } | null`, czytane z `astro:env/server`;
- zwraca `null`, gdy brak którejś wartości albo gdy klucz nie zaczyna się od `sb_publishable_`. Strażnik mechanicznie pilnuje reguły z fazy 1: pomyłka w konfiguracji (np. klucz secret w `SUPABASE_KEY`) daje komunikat i 503, a nie klucz pod publicznym adresem.

#### 1. Moduł wspólny

**File**: `src/lib/live-sync/shared.ts`

**Intent**: Jedno źródło nazw i walidacji dla serwera, strony i sondy. Bez importów serwerowych, więc wolno go użyć w wyspie.

**Contract**: Eksportuje:
- prefiks tematu `live-sync:`;
- nazwę zdarzenia `bell`;
- `isValidRoomId(room)`, czyli `^[a-z0-9-]{1,64}$`;
- `topicFor(room)`;
- typ `LiveSyncState = { room: string; seq: number; question: string }`.

#### 2. Moduł serwerowy

**File**: `src/lib/live-sync/server.ts`

**Intent**: Nadawanie dzwonka przez REST (`httpSend`) i wyznaczanie stanu tablicy bez przechowywania. Stan jest deterministyczną funkcją `(room, seq)`, bo w małym zakresie nie ma tabel.

**Contract**:
- `ringRoom(supabase, room, seq)` wysyła przez `httpSend` na `topicFor(room)` zdarzenie `bell` z payloadem dokładnie `{ seq }` i opcją `timeout: 5000` (limit „max 5 s” z kryterium F-01; domyślne 10 s zawiesiłoby żądanie hosta). Po wysłaniu usuwa kanał z klienta.
- Zwraca `{ ok: true }` albo `{ ok: false }`. `httpSend` rozwiązuje się sukcesem tylko przy 202, a każdy inny wynik i timeout rzuca zwykły `Error` bez statusu (`RealtimeChannel.ts:982-1002`), więc `ringRoom` łapie wyjątek i nie udaje statusu, którego nie ma.
- `stateFor(room, seq): LiveSyncState` wybiera pytanie spośród wpisów `QUESTIONS` z `adult: false` indeksem `seq` modulo ich liczba. Zwraca tekst w formie „Kto z nas najprawdopodobniej {text}?” (`src/data/questions.ts:14-16`). To skrót tylko na prototyp: komentarz w kodzie odsyła do „Dzwonek jest niezaufaną podpowiedzią” w Critical Implementation Details.
- To jedyne miejsce importu bazy pytań w tej zmianie.

#### 3. Konfiguracja dla sondy

**File**: `src/pages/api/live-sync/config.ts`

**Intent**: Sonda bierze URL i klucz publishable z aplikacji tak jak przeglądarka, bez czytania `.dev.vars`.

**Contract**:
- `GET` → `200 { supabaseUrl, supabaseKey }` z `getPublicSupabaseConfig()` (#0);
- `503` z komunikatem, gdy zwraca `null`;
- nagłówek `Cache-Control: no-store`.

#### 4. Dzwonek

**File**: `src/pages/api/live-sync/ring.ts`

**Intent**: Dzwonić może tylko zalogowany (decyzja Karola: układ jak w grze, host przewija, goście słuchają).

**Contract**: `POST` z JSON `{ room: string, seq: number }`:
- `401` JSON bez `locals.user`;
- `400` przy niepoprawnym `room` albo `seq`, który nie jest dodatnią liczbą całkowitą;
- w pozostałych przypadkach `ringRoom` z klientem z `createClient(headers, cookies)`;
- odpowiedź `200 { ok: true }` albo `502 { ok: false }`;
- bez logowania treści żądania.

#### 5. Tablica

**File**: `src/pages/api/live-sync/state.ts`

**Intent**: Stan, który przeglądarka pobiera po dzwonku. Dostępny dla gości.

**Contract**:
- `GET ?room=&seq=` → `200 LiveSyncState`;
- `400` przy niepoprawnych parametrach;
- `Cache-Control: no-store`.

### Success Criteria:

#### Automated Verification:

- Bramka przechodzi: `npm run lint`, `npx astro check`, `npm run build`
- Na `npm run dev`: `GET /api/live-sync/state?room=demo&seq=1` zwraca 200 i JSON z niepustym `question`, a `POST /api/live-sync/ring` bez logowania zwraca 401 (sprawdzenie przez `node` + `fetch`)
- Import `@/data/questions` występuje w `src/` tylko w `src/lib/live-sync/server.ts` (grep)

**Implementation Note**: Po automatycznej weryfikacji pauza na potwierdzenie Karola, potem kolejna faza.

---

## Faza 3: Strona demo (przeglądarka)

### Overview

Strona `/dev/live-sync` z wyspą React, która słucha kanału pokoju, pokazuje status i licznik powrotów, a po dzwonku pobiera tablicę. Zalogowany widzi przycisk „Zadzwoń”. Teksty po polsku.

### Changes Required:

#### 1. Strona

**File**: `src/pages/dev/live-sync.astro`

**Intent**: Strona testowa dostępna dla gości (bez ochrony w middleware). Dane idą do wyspy przez props, jak w `signin.astro:5,14`.

**Contract**:
- konfiguracja z `getPublicSupabaseConfig()` (faza 2, #0);
- `?room=` walidowane przez `isValidRoomId`, domyślnie `demo`;
- props wyspy: `{ supabaseUrl, supabaseKey, room, canRing: Boolean(Astro.locals.user) }`;
- `client:load`;
- `Layout` z tytułem „Test dzwonka”;
- komunikat, gdy brak konfiguracji.

#### 2. Wyspa

**File**: `src/components/live-sync/LiveSyncDemo.tsx`

**Intent**: Pokazać na żywo to, co mierzy sonda, na prawdziwym telefonie.

**Contract**:
- tworzy jednego klienta supabase-js tylko do Realtime (opcje z Critical Implementation Details);
- subskrybuje `topicFor(room)`;
- pokazuje status (łączenie / połączono / rozłączono) i licznik ponownych `SUBSCRIBED` po pierwszym;
- po `bell` pobiera `/api/live-sync/state` i pokazuje numer dzwonka, pytanie (zwykły tekst) i czas pobrania tablicy w ms;
- przy `canRing` ma przycisk „Zadzwoń”, który wysyła `POST /api/live-sync/ring` z `seq = Date.now()`;
- sprząta kanał przy odmontowaniu;
- z kodu projektu importuje tylko `live-sync/shared` i `components/ui/button` (z paczek: React i `@supabase/supabase-js`).

### Success Criteria:

#### Automated Verification:

- Bramka przechodzi: `npm run lint`, `npx astro check`, `npm run build`
- `dist/client` nie zawiera tekstu pytań: grep fragmentu dowolnego pytania z `src/data/questions.ts` po zbudowanych plikach daje 0 trafień
- Na `npm run dev`: `GET /dev/live-sync` zwraca 200

#### Manual Verification:

- Lokalnie, dwa okna przeglądarki na `/dev/live-sync`: w obu status „połączono”; w oknie zalogowanym „Zadzwoń” zmienia numer dzwonka i pytanie w drugim, niezalogowanym oknie; niezalogowane okno nie ma przycisku

**Implementation Note**: Po automatycznej weryfikacji pauza na potwierdzenie Karola, potem kolejna faza.

---

## Faza 4: Sonda i pomiar lokalny

### Overview

Skrypt `scripts/live-sync-probe.mjs` symuluje graczy osobnymi połączeniami, dzwoni jako zalogowane konto testowe i mierzy czas „dzwonek + tablica”. Wyniki lokalne trafiają do `measurements.md`.

### Changes Required:

#### 1. Sonda

**File**: `scripts/live-sync-probe.mjs`

**Intent**: Powtarzalny pomiar kryterium F-01 i ścieżka weryfikacji dla S-02 (roadmapa, F-01 „Unlocks”). Wzorzec z `scripts/smoke.mjs`.

**Contract**:
- **Flagi:** `--base-url` (domyślnie `http://localhost:4321`), `--rooms` (domyślnie 1), `--players` (20), `--trials` (10), `--pause-ms` (3000).
- **Przebieg:**
  - zakłada i loguje konto `probe-<timestamp>@example.com` przez endpointy auth aplikacji (jak smoke);
  - pobiera `/api/live-sync/config`;
  - tworzy `rooms × players` osobnych klientów supabase-js, każdy subskrybuje swój pokój (`probe-<timestamp>-<n>`);
  - subskrypcje rozkłada w czasie, maksymalnie 20 na sekundę, bo darmowy plan ma limit 100 dołączeń do kanału na sekundę („Channel joins per second”, https://supabase.com/docs/guides/realtime/limits);
  - czeka na `SUBSCRIBED` wszystkich (limit 15 s);
  - w każdej próbie dla każdego pokoju bierze `t0` przed `POST /api/live-sync/ring`, a każdy klient po `bell` z tym `seq` pobiera tablicę;
  - ciasteczka sesji idą tylko z logowaniem (z nagłówkiem `Origin`, jak `scripts/smoke.mjs:29`) i z dzwonkiem; klienci-gracze pobierają tablicę bez ciasteczek, jak goście. Inaczej middleware przy każdym z 20 żądań pytałby Supabase Auth o użytkownika, czego prawdziwi goście nie robią, i pomiar tablicy wyszedłby zawyżony;
  - zapisuje czas dzwonka i czas łączny;
  - brak dostarczenia w 5 s liczy jako zgubiony;
  - każdy status inny niż `SUBSCRIBED` po starcie liczy jako rozłączenie.
- **Wynik:** p50, p95 i max czasu dzwonka i czasu łącznego, liczba zgubionych i rozłączeń. Po `/10x-impl-review` (F1) także odsetek dostarczeń w 2 s ze wszystkich oczekiwanych, czas łączny po wszystkich oczekiwanych (zgubione jako „> 5000 ms”), przyczyny zgubionych i linia na każdą próbę; progi, limity i werdykt bez zmian.
- **Werdykt i kod wyjścia:** przy `--rooms 1` PASS (kod 0) albo FAIL kryterium F-01 (kod 1); przy `--rooms > 1` „INFO” (kod 0). Błąd techniczny, czyli sonda nie zdołała zmierzyć (logowanie, config, subskrypcje nie doszły do `SUBSCRIBED` w 15 s, wyjątek), daje kod 2 w każdym trybie. FAIL to uczciwy wynik spike'a, a nie błąd do naprawienia: progi, limity czasu i sposób liczenia są ustalone w tym planie i nie zmieniają się pod wynik.
- **Porządki:** na koniec zamyka kanały i wylogowuje. Nie wypisuje klucza.
- **Nazwy kanału:** prefiks tematu i nazwę zdarzenia sonda kopiuje z `shared.ts` (komentarz „Mirrors”), zamiast go importować. To świadome odstępstwo od „jednego źródła” (`/10x-impl-review`, F6): skrypt `.mjs` nie importuje TypeScriptu z `src/`. Przy zmianie nazw w `shared.ts` trzeba poprawić też sondę; inaczej przestanie słyszeć dzwonek i pokaże FAIL.

#### 2. Polecenie npm

**File**: `package.json`

**Intent**: Jedno polecenie, które łapie reguła ask z fazy 1.

**Contract**: `scripts["live-probe"] = "node scripts/live-sync-probe.mjs"`.

#### 3. Wyniki pomiarów

**File**: `context/changes/live-sync-spike/measurements.md`

**Intent**: Dowód dla werdyktu B i punkt odniesienia dla S-02.

**Contract**:
- tabela przebiegów: data, środowisko (lokalnie / produkcja), commit, pokoje × gracze × próby, p50/p95/max dzwonka i czasu łącznego, zgubione, rozłączenia, werdykt;
- sekcja „Test telefonu” (wypełniana w fazie 5);
- sekcja „Werdykt”.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- Na `npm run dev`: `npm run live-probe` kończy się kodem 0 albo 1 (nie 2), a werdykt PASS/FAIL jest zapisany w `measurements.md`
- Na `npm run dev`: `npm run live-probe -- --rooms 5` kończy przebieg informacyjny bez błędu technicznego
- `measurements.md` ma wiersze obu lokalnych przebiegów

#### Manual Verification:

- Claude Code poprosił Karola o zgodę przed pierwszym uruchomieniem sondy (reguła ask działa)

**Implementation Note**: Po automatycznej weryfikacji pauza na potwierdzenie Karola. Przy FAIL (kod 1) agent zapisuje wynik z rozbiciem na dzwonek i tablicę i czeka na decyzję Karola (diagnoza, ponowny pomiar albo plan awaryjny); nie zmienia kodu ani sondy pod wynik. Potem `/10x-impl-review live-sync-spike` i triage, zanim ruszy faza 5.

---

## Faza 5: Produkcja i telefon

### Overview

Pomiar na produkcji, test telefonu ze zgaszonym ekranem, werdykt dla B i aktualizacja dokumentów. **Warunek startu:** zakończony `/10x-impl-review` z triage oraz zgoda Karola na `git push` (push na `main` = wdrożenie).

### Changes Required:

#### 1. Wdrożenie i pomiar na produkcji

**File**: brak zmian w kodzie; wyniki w `context/changes/live-sync-spike/measurements.md`

**Intent**: Zmierzyć dokładnie to, czego użyją gracze (Worker w Cloudflare).

**Contract**: Kolejne kroki:
1. Push za zgodą Karola.
2. Smoke na produkcji według AGENTS.md.
3. `npm run live-probe -- --base-url https://most-likely-to.charlesonthewave.workers.dev`.
4. To samo z `--rooms 5` (informacyjnie).
5. Wiersze w tabeli.

Przy `CHANNEL_ERROR` Karol sprawdza w panelu przełącznik „Allow public access”.

#### 2. Test telefonu

**File**: `context/changes/live-sync-spike/measurements.md`

**Intent**: Sprawdzić obawę z recenzji: czy telefon wraca po zgaszeniu ekranu (decyzja Karola: powrót + kolejny dzwonek).

**Contract**: Sekcja „Test telefonu” zawiera urządzenie i przeglądarkę, sieć (Wi-Fi albo dane komórkowe) oraz wynik każdego kroku z „Manual Testing Steps”.

#### 3. Werdykt i dokumenty

**File**: `context/changes/live-sync-spike/measurements.md`, `context/changes/live-sync-spike/external-research.md`, `context/foundation/roadmap.md`, `context/foundation/infrastructure.md`

**Intent**: Zamknąć decyzję z dowodem, tak żeby S-01 i S-02 startowały z jasnej techniki.

**Contract**:
- **`measurements.md`, sekcja „Werdykt”:** B spełnia albo nie spełnia kryterium F-01.
- **`external-research.md`:** w sekcji „Rekomendacja i decyzja” wynik pomiaru.
- **`roadmap.md`, F-01 Outcome:**
  - kanał niesie tylko sygnał „coś się zmieniło”;
  - dzwonek może nadać każdy, więc stan pochodzi wyłącznie z bazy, nigdy z treści dzwonka;
  - w trakcie rundy tylko „kto już zagłosował”, liczby dopiero przy odsłonie;
  - kryterium 95% w 2 s, max 5 s.
- **`infrastructure.md`:** zapis „runda na żywo: publiczny kanał-dzwonek + stan z serwera, sprawdzone w F-01” z linkiem do `measurements.md`.

Przy wyniku negatywnym werdykt opisuje, co nie przeszło. Przejście na plan awaryjny to osobna zmiana.

### Success Criteria:

#### Automated Verification:

- Smoke na produkcji przechodzi 8/8
- `npm run live-probe -- --base-url https://most-likely-to.charlesonthewave.workers.dev` kończy się kodem 0 albo 1 (nie 2), a werdykt PASS/FAIL jest zapisany w `measurements.md`
- Przebieg produkcyjny `--rooms 5` zapisany w `measurements.md`

#### Manual Verification:

- Test telefonu przechodzi: telefon (gość) łapie 3 dzwonki z laptopa; po 1–2 min zgaszonego ekranu strona pokazuje „połączono” w mniej niż 10 s od odblokowania i łapie kolejny dzwonek
- Karol akceptuje werdykt i aktualizacje roadmapy oraz `infrastructure.md`

**Implementation Note**: Commit dokumentów z tej fazy wychodzi z najbliższym pushem (np. przy archiwizacji), za zgodą Karola.

---

## Testing Strategy

### Unit Tests:

- Brak frameworka testów w repo (AGENTS.md, Testing). Walidacja `room` i `seq` jest sprawdzana przez endpointy w fazie 2 i przez sondę.

### Integration Tests:

- Sonda `npm run live-probe`: realny kanał Supabase, realne endpointy, 20 osobnych połączeń, lokalnie i na produkcji.
- Smoke na produkcji po wdrożeniu (bez regresji logowania).

### Manual Testing Steps:

1. Laptop: zaloguj się i otwórz `/dev/live-sync` na adresie gry. Telefon (bez logowania): otwórz ten sam adres. Oba pokazują „połączono”.
2. Na laptopie naciśnij „Zadzwoń” 3 razy. Telefon za każdym razem pokazuje nowy numer dzwonka i pytanie.
3. Zgaś ekran telefonu na 1–2 min. W tym czasie zadzwoń raz z laptopa; tego dzwonka telefon nie musi nadrobić.
4. Odblokuj telefon. W mniej niż 10 s status pokazuje „połączono”, a licznik powrotów wzrósł albo połączenie przetrwało.
5. Zadzwoń z laptopa. Telefon pokazuje nowy numer i pytanie.

## Performance Considerations

- Budżet: 95% w 2 s na „dzwonek + tablica”.
- Sonda rozbija czas na dzwonek i tablicę, więc wolne `auth.getUser()` w middleware (`src/middleware.ts:10-12`) będzie widoczne jako wolna tablica.
- Limit Supabase 100 wiadomości/s to średnia z okna do 60 s (`external-research.md`). Przebieg 5 × 20 × 10 prób to ok. 5 × 10 × 21 = 1050 wiadomości w ok. 30 s, czyli poniżej limitu według tego rachunku. Wynik informacyjny pokaże, czy tak jest naprawdę.

## Migration Notes

Nie dotyczy: brak zmian w bazie. Nowe endpointy i strona są addytywne; wycofanie to cofnięcie commitów, bez danych do przenoszenia.

## References

- Research wewnętrzny: `context/changes/live-sync-spike/research.md`
- Research zewnętrzny, recenzja i decyzja: `context/changes/live-sync-spike/external-research.md`
- Wzorzec sondy: `scripts/smoke.mjs:4-75`
- Wzorzec endpointu i wyspy: `src/pages/api/auth/signin.ts:4-19`, `src/pages/auth/signin.astro:5,14`
- Reguły: `context/foundation/lessons.md` (ask dla skrótów do stanu zdalnego; pytania tylko po stronie serwera)
- Wymagania: `context/foundation/prd.md:139,142`; roadmapa F-01 `context/foundation/roadmap.md:84-96`
- Plan awaryjny: `context/foundation/infrastructure.md:195`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Zasady, uprawnienia i zależności

#### Automated

- [x] 1.1 Bramka przechodzi: `npm run lint`, `npx astro check`, `npm run build` — 7bcb4ea
- [x] 1.2 `.claude/settings.json` parsuje się jako JSON i zawiera 6 nowych wpisów ask — 7bcb4ea
- [x] 1.3 W zmianach lockfile zmienia się tylko zakres `@supabase/supabase-js` w pakiecie głównym; zainstalowana wersja to 2.116.0 — 7bcb4ea

#### Manual

- [x] 1.4 Karol akceptuje nowe brzmienie reguły o kluczach w AGENTS.md — 7bcb4ea

### Phase 2: Dzwonek i tablica (serwer)

#### Automated

- [x] 2.1 Bramka przechodzi: `npm run lint`, `npx astro check`, `npm run build` — e3a0555
- [x] 2.2 Na `npm run dev`: `GET /api/live-sync/state?room=demo&seq=1` zwraca 200 i JSON z niepustym `question`, a `POST /api/live-sync/ring` bez logowania zwraca 401 — e3a0555
- [x] 2.3 Import `@/data/questions` występuje w `src/` tylko w `src/lib/live-sync/server.ts` — e3a0555

### Phase 3: Strona demo (przeglądarka)

#### Automated

- [x] 3.1 Bramka przechodzi: `npm run lint`, `npx astro check`, `npm run build` — af8e69c
- [x] 3.2 `dist/client` nie zawiera tekstu pytań — af8e69c
- [x] 3.3 Na `npm run dev`: `GET /dev/live-sync` zwraca 200 — af8e69c

#### Manual

- [x] 3.4 Lokalnie dwa okna: „Zadzwoń” w oknie zalogowanym odświeża niezalogowane okno, które nie ma przycisku — af8e69c

### Phase 4: Sonda i pomiar lokalny

#### Automated

- [x] 4.1 `npm run lint` przechodzi — 3a8ad3f
- [x] 4.2 Na `npm run dev`: `npm run live-probe` kończy się kodem 0 albo 1, werdykt zapisany — 3a8ad3f
- [x] 4.3 Na `npm run dev`: `npm run live-probe -- --rooms 5` kończy przebieg informacyjny bez błędu technicznego — 3a8ad3f
- [x] 4.4 `measurements.md` ma wiersze obu lokalnych przebiegów — 3a8ad3f

#### Manual

- [x] 4.5 Claude Code poprosił Karola o zgodę przed pierwszym uruchomieniem sondy — 3a8ad3f

### Phase 5: Produkcja i telefon

#### Automated

- [ ] 5.1 Smoke na produkcji przechodzi 8/8
- [ ] 5.2 `npm run live-probe -- --base-url https://most-likely-to.charlesonthewave.workers.dev` kończy się kodem 0 albo 1, werdykt zapisany
- [ ] 5.3 Przebieg produkcyjny `--rooms 5` zapisany w `measurements.md`

#### Manual

- [ ] 5.4 Test telefonu przechodzi: 3 dzwonki, powrót w mniej niż 10 s po zgaszonym ekranie, kolejny dzwonek złapany
- [ ] 5.5 Karol akceptuje werdykt i aktualizacje roadmapy oraz `infrastructure.md`
