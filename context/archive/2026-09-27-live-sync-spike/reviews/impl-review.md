<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Live sync spike (F-01)

- **Plan**: context/changes/live-sync-spike/plan.md
- **Scope**: Full plan (ukończone fazy 1–4 z 5; faza 5 czeka na push)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 5 observations
- **Triage**: 2026-10-04, z Karolem. Naprawione wszystkie 7 (F1 przez Fix A). Po poprawkach przechodzą `npm run lint`, `npx astro check` i `npm run build`. Sonda nie była uruchamiana po zmianach; pierwszy przebieg na nowej wersji to pomiar produkcyjny w fazie 5.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- **Zakres:** commity `7bcb4ea`, `e3a0555`, `af8e69c`, `3a8ad3f` (`git diff 7bcb4ea^..HEAD`, 20 plików). Niezacommitowana zmiana w `plan.md` to tylko SHA w Progress fazy 4.
- **Plan ↔ diff:** każda zaplanowana zmiana faz 1–4 jest na miejscu (MATCH). Brakujących nie ma.
  - Poza planem są tylko pliki teczki zmiany, status F-01 w roadmapie (`in-progress`, ustawiony przez `/10x-implement`) i linia o `npm run live-probe` w README (AGENTS.md odsyła po skrypty do README).
  - Drobne dodatki w kodzie mieszczą się w kontraktach:
    - `isValidSeq` w `shared.ts`: jedna walidacja `seq` dla dzwonka, tablicy i wyspy;
    - 503 w `ring.ts`, gdy brak klienta;
    - w wyspie ochrona przed starszą tablicą nadpisującą nowszą i komunikat dla gościa.
- **Faza 1** sprawdzona po diffie:
  - reguła o kluczu w AGENTS.md, README i `infrastructure.md:17`;
  - 6 wpisów ask w `.claude/settings.json`;
  - 4 globale w `eslint.config.js`;
  - w lockfile zmienia się tylko zakres `@supabase/supabase-js`.
- **Kryteria automatyczne**, uruchomione ponownie 04.10:
  - 1.1, 2.1, 3.1, 4.1: `npm run lint` PASS. `npx astro check`: 0 błędów, 0 ostrzeżeń. `npm run build`: PASS (znane ostrzeżenie sitemap o `site`).
  - 2.2 na `npm run dev`:
    - `GET /api/live-sync/state?room=demo&seq=1` → 200, `no-store`, niepuste pytanie;
    - zły pokój → 400, `seq=0` → 400;
    - `POST /api/live-sync/ring` bez logowania → 401, także przy złym JSON-ie (auth przed parsowaniem);
    - `GET /api/live-sync/config` → 200, `no-store`, klucz `sb_publishable_`.
  - 2.3: `@/data/questions` importuje tylko `src/lib/live-sync/server.ts:2`.
  - 3.2: 216 tekstów pytań szukanych w 13 plikach `dist/client` daje 0 trafień. Literałów klucza `sb_…` też jest 0.
  - 3.3: `GET /dev/live-sync` → 200, tytuł „Test dzwonka”, gość nie widzi „Zadzwoń”.
  - 4.2–4.4 nie były uruchamiane ponownie: każde uruchomienie sondy zakłada konto w produkcyjnym Supabase (reguła ask). Dowodem jest `measurements.md`: 1×20×10 FAIL (kod 1), 5×20×10 INFO (kod 0, bez błędu technicznego), oba wiersze w tabeli.
- **Kryteria ręczne:** 1.4, 3.4 i 4.5 są odhaczone. Nic nie wskazuje na pozorne odhaczenie: test dwóch okien z fazy 3 zostawił ślad w notatce `change.md` o uśpionym Supabase, a reguła ask dla sondy istnieje.
- **Sprawdzone i w porządku:**
  - Klucz:
    - strażnik `sb_publishable_` w `getPublicSupabaseConfig`;
    - brak `import.meta.env` dla Supabase;
    - brak klucza w `dist/client`;
    - sonda redaguje klucz w błędach.
  - Pytania są tylko na serwerze. Tekst idzie przez React, bez `set:html` i `dangerouslySetInnerHTML`.
  - CSRF na dzwonku: Astro 7.3.2 ma domyślnie `checkOrigin`, cross-site JSON wymaga preflightu, a ciasteczka mają `SameSite=Lax`.
  - `removeChannel` siedzi w `finally`. Endpointy nie logują treści żądań. Payload to tylko `{ seq }`.
  - Wzorce: endpointy jak `api/auth/*`, strona jak `signin.astro`, wyspa jak `components/auth/*`, sonda jak `smoke.mjs`. LF, bez `"use client"`.
- **Lokalny FAIL nie jest ustaleniem.** Plan przewiduje FAIL jako uczciwy wynik. Obaj recenzenci nie znaleźli błędu pomiaru, który odwróciłby werdykt:
  - `t0` jest brane tuż przed POST;
  - tablice pobierają się równolegle, pokoje dzwonią równolegle;
  - percentyl nearest-rank jest poprawny;
  - PASS wymaga 0 zgubionych.

## Findings

### F1 — Sonda podaje czasy tylko dostarczonych i nie mówi, dlaczego reszta przepadła

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: scripts/live-sync-probe.mjs:197-212, 255-263
- **Detail**:
  - **Percentyle pomijają zgubione.** Zgubione dostarczenia nie trafiają do tablic czasów (`:206-210`), więc p50/p95/max liczą się tylko z dostarczonych. Werdykt jest poprawny, bo PASS wymaga `lost === 0` (`:275`), ale liczby w `measurements.md` wyglądają lepiej, niż jest:
    - 1×20×10: przepadło 40 z 200 (20%), więc prawdziwe p95 „dzwonek + tablica” przekracza 5 s, a tabela pokazuje 4242 ms;
    - 5×20×10: przepadło 60%, a „Łącznie p50 2077” opisuje 400 dostarczonych, więc ten wiersz wygląda lepiej niż przebieg z 1 pokojem.
  - **Kolumny liczą różne grupy graczy.** „Dzwonek” obejmuje też graczy, których tablica przepadła, a „Tablica” i „Łącznie” tylko dostarczonych. Stąd 1435 + 2027 ≠ 2518.
  - **Przepadłe nie są rozbite na przyczyny, choć dane są w pamięci.** `expected − bellMs.length` to dzwonki, które nie doszły; błędy tablicy już są liczone; reszta to spóźnione tablice. Domysł z diagnozy („prawdopodobnie przekroczenia czasu… Niezweryfikowane”) zostaje domysłem bez potrzeby.
  - **Przepadały całe próby.** 40 i 600 to wielokrotności 20, więc ginęły całe pokoje w danej próbie. Wydruk z rozbiciem na próby pokazałby, czy to np. pierwsze próby. Hipoteza niesprawdzona: zimny serwer deweloperski, bo Vite przebudowuje zależności przy pierwszych żądaniach.
  - **Diagnoza nie tłumaczy czasu tablicy.** W sondzie tablica zajmuje ok. 2 s, a w osobnym teście 20 równoległych pobrań trwało ok. 0,36 s; tego testu nie ma w repo.
  - **Poprawka zmienia tylko wydruk.** Plan (linia 398) zakazuje zmian w sondzie po FAIL bez decyzji Karola. Poprawka nie rusza progów, limitów ani sposobu liczenia.
- **Fix A ⭐ Recommended**: Rozszerzyć wydruk sondy przed pomiarem produkcyjnym. Progi, limity, liczenie i logika werdyktu zostają bez zmian. Wydruk ma pokazywać:
  - metrykę F-01 wprost: „w 2 s: X z Y oczekiwanych”, z percentylami po wszystkich oczekiwanych i zgubionymi jako „> 5000”;
  - przepadłe rozbite na trzy grupy: dzwonek nie doszedł / tablica spóźniona / błąd tablicy;
  - jedną linię na próbę: odpowiedź na dzwonek, pierwszy i ostatni dzwonek, pierwsza i ostatnia tablica.

  W `measurements.md` istniejące kolumny dostają podpis „tylko dostarczone (n = 160 z 200 / 400 z 1000)”.

  Ocena:
  - Strength: przebieg produkcyjny rozstrzyga o wariancie B. Przy FAIL od razu będzie widać, czy padł dzwonek (problem po stronie Supabase, w stronę planu awaryjnego), czy tablica (nasz Worker, do naprawienia), a od tego zależy decyzja.
  - Tradeoff: to zmiana sondy po FAIL, czyli dokładnie to, co plan oddaje decyzji Karola. Ok. 20–30 linii. Lokalne wiersze nie dostaną nowych liczb, chyba że powtórzyć pomiar, co oznacza kolejne konto `probe-…` w produkcyjnym Supabase.
  - Confidence: HIGH — dane już są w `results`, zmienia się tylko wydruk; obaj recenzenci niezależnie wskazali to samo.
  - Blind spot: nie wiadomo, czy produkcja w ogóle coś zgubi. Przy czystym PASS rozbicie nie będzie potrzebne.
- **Fix B**: Tylko dokumentacja. W `measurements.md` podpisać kolumny „tylko dostarczone (n = 160 z 200 / 400 z 1000)” i dopisać, że p95 po wszystkich oczekiwanych przekracza 5 s. Sondy nie ruszać.
  - Strength: litera planu zachowana (zero zmian w sondzie po FAIL), kilka minut pracy.
  - Tradeoff: przy FAIL na produkcji znów nie będzie wiadomo, co padło. Trzeba będzie wtedy zmienić sondę i powtórzyć pomiar: kolejne konto, kolejne podejście.
  - Confidence: MED — wystarczy, jeśli produkcja przejdzie czysto.
  - Blind spot: jak wyżej.
- **Decision**: FIXED via Fix A. W `scripts/live-sync-probe.mjs` doszły: linia na każdą próbę, przyczyny zgubionych (brak dzwonka w 5 s / tablica spóźniona / błąd tablicy), „Within 2 s: X of Y expected” i „Total, all expected” (zgubione jako „> 5000 ms”). Progi, limity i warunek PASS bez zmian. Uwagi dopisane w `measurements.md` i `plan.md` (faza 4, „Wynik”). Lint przechodzi; sonda nie była uruchamiana (zakłada konto w produkcyjnym Supabase).

### F2 — Reguła „ask” nie łapie sondy uruchomionej pełną ścieżką

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .claude/settings.json:37-39
- **Detail**:
  - Reguły ask dla sondy dopasowują tylko początek polecenia: `npm run live-probe*`, `node scripts/live-sync-probe*` i `node ./scripts/live-sync-probe*`.
  - Inne formy trafiają w allow `Bash(node *)` / `Bash(npm *)` (`:4,6`) i ruszają bez pytania:
    - `node C:/Users/karol/10xdevs/scripts/live-sync-probe.mjs`;
    - `node /c/Users/karol/10xdevs/scripts/live-sync-probe.mjs`;
    - `cd scripts && node live-sync-probe.mjs`;
    - `npm run-script live-probe`.
  - Pełna ścieżka to realne ryzyko, bo instrukcje agentów zalecają ścieżki bezwzględne.
  - Każde uruchomienie zakłada konto w jedynym, produkcyjnym Supabase, nawet z localhost. To luka w regule z `lessons.md:9` i w założeniu planu („Każde uruchomienie zaczyna się wtedy od…”, `plan.md:94`).
- **Fix**: Dopisać w `permissions.ask` reguły `Bash(node *live-sync-probe*)` i `Bash(npm *live-probe*)`. Obecne trzy mogą zostać.
- **Decision**: FIXED. W `.claude/settings.json` (`permissions.ask`) doszły `Bash(node *live-sync-probe*)` i `Bash(npm *live-probe*)`; plik parsuje się jako JSON.

### F3 — Sonda bez limitów czasu na żądania; błąd w środku przebiegu wyrzuca pomiary

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/live-sync-probe.mjs:77, 106, 121, 188-190
- **Detail**:
  - Żaden `fetch` w sondzie nie ma limitu czasu: logowanie, config, dzwonek, tablica ani wylogowanie w `cleanup`.
    - Serwer, który zawiśnie zamiast odmówić, zostawia sondę bez werdyktu.
    - Spóźnione pobrania tablicy nie są przerywane po 5 s i mogą nachodzić na następną próbę, bo przerwa trwa tylko 3 s.
  - Status dzwonka inny niż 200/502 rzuca błąd techniczny w środku prób, a to, co już zmierzono, nie zostaje wydrukowane. Przykłady: 500 albo 503 z Workera, 401 po wygaśnięciu sesji.
- **Fix**: `signal: AbortSignal.timeout(…)` na każdym `fetch` (dla tablicy do końca okna 5 s), a przed kodem 2 wydruk, ile prób przeszło i z jakim wynikiem.
- **Decision**: FIXED. `AbortSignal.timeout` na każdym `fetch` sondy: 10 s (`REQUEST_TIMEOUT_MS`) dla logowania, configu, dzwonka i wylogowania, a koniec okna 5 s dla tablicy. Tablica przerwana na końcu okna liczy się jako spóźniona, nie jako błąd (`TimeoutError`, sprawdzone na lokalnym wolnym serwerze, także przy przerwaniu w trakcie odczytu treści). `AbortSignal` dopisany do globali skryptów w `eslint.config.js`. Wydruk częściowy przed kodem 2 pominięty, bo od F1 linie wcześniejszych prób są już na ekranie.

### F4 — Sonda nie ma bezpieczników przed produkcyjnym projektem

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/live-sync-probe.mjs:44-58, 237-239
- **Detail**: Brakuje trzech bezpieczników:
  1. Konto `probe-…` powstaje przed sprawdzeniem configu (`:237` przed `:239`). Gdy config zwróci 503 (np. stary klucz anon), zostaje osierocone konto.
  2. `--rooms` i `--players` nie mają górnej granicy. `--rooms 11` to 220 połączeń, ponad limit 200 jednoczesnych połączeń planu darmowego, na jedynym projekcie.
  3. `BASE_URL` jest po cichu ignorowany. Nawyk z AGENTS.md (`BASE_URL=https://… npm run smoke`) przeniesiony na sondę zmierzy localhost; adres widać tylko w pierwszej linii wydruku.
- **Fix**: W `main` najpierw `fetchConfig()`, potem `signIn()`. W `parseArgs` limit `rooms × players ≤ 200` i błąd, gdy ustawiony jest `BASE_URL`.
- **Decision**: FIXED. `main` pobiera config przed założeniem konta. `parseArgs` odrzuca `rooms × players > 200` (`MAX_PLAYERS`) i ustawiony `BASE_URL`, kodem 2, zanim cokolwiek pójdzie do sieci. Sprawdzone offline na kopii `parseArgs` (1×20, 5×20, 10×20 przechodzą; 11×20, 1×201 i `BASE_URL` dają błąd techniczny); lint przechodzi.

### F5 — Dzwonek gubi przyczynę błędu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/live-sync/server.ts:17-19
- **Detail**:
  - `catch { return { ok: false }; }` wyrzuca powód błędu: timeout, 429 albo odrzucenie przez Realtime.
  - Na produkcji logi Workera (observability włączone) pokażą samo 502 bez przyczyny, a w fazie 5 może być potrzebna właśnie przyczyna.
  - Komunikat błędu `httpSend` nie zawiera klucza ani treści żądania.
  - Istniejące endpointy nic nie logują, więc to byłby nowy wzorzec, a reguła `no-console` wymaga wyłączenia w tej linii.
- **Fix**: W `catch (error)` dopisać `console.error("live-sync ring failed:", error instanceof Error ? error.message : error)` z komentarzem wyłączającym eslint.
- **Decision**: FIXED. `ringRoom` loguje `live-sync ring failed: <name>: <message>`, bez pokoju, `seq` i treści żądania. Komunikaty `httpSend` sprawdzone w `RealtimeChannel.ts:982-1001`: `statusText`, `error`/`message` z odpowiedzi Realtime albo `AbortError`, nigdy klucz ani nagłówki. Lint przechodzi.

### F6 — Sonda kopiuje nazwy z shared.ts zamiast z nich korzystać

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: scripts/live-sync-probe.mjs:10-12
- **Detail**:
  - Plan nazywa `shared.ts` „jednym źródłem nazw i walidacji dla serwera, strony i sondy”. Sonda ma jednak własne `TOPIC_PREFIX` i `BELL_EVENT` z komentarzem „Mirrors src/lib/live-sync/shared.ts”.
  - Odstępstwo nie jest zapisane w planie.
  - Ryzyko jest małe, ale po zmianie nazwy sonda po cichu przestanie słyszeć dzwonek. Wszystko będzie wtedy „zgubione”, a wynik pokaże FAIL zamiast błędu technicznego.
- **Fix**: Zapisać odstępstwo w planie (faza 4, #1) jako świadome: skrypt `.mjs` nie importuje TypeScriptu z `src/`.
- **Decision**: FIXED. W `plan.md` (faza 4, #1) doszedł punkt „Nazwy kanału”: kopia w sondzie jest świadoma, a przy zmianie nazw w `shared.ts` trzeba poprawić też sondę.

### F7 — Kolumna „Commit” w measurements.md nie wskazuje commita

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/live-sync-spike/measurements.md:21-22
- **Detail**: Oba lokalne wiersze mają „af8e69c + sonda”, bo pomiary (10:18, 10:31) poszły przed commitem sondy `3a8ad3f` (10:37). Plan wymaga commita, żeby S-02 mógł porównać wynik z konkretnym kodem.
- **Fix**: Wpisać `3a8ad3f` z dopiskiem „sonda zacommitowana po pomiarze, bez zmian”, jeśli sonda nie zmieniła się od pomiaru; inaczej zostawić wpis z wyjaśnieniem.
- **Decision**: FIXED. Oba lokalne wiersze mają „3a8ad3f (sonda zacommitowana po pomiarze, bez zmian)”; Karol potwierdził poprawkę.
