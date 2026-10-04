# Live sync spike (F-01) — Plan Brief

> Full plan: `context/changes/live-sync-spike/plan.md`
> Research: `context/changes/live-sync-spike/research.md` (wewnętrzny), `context/changes/live-sync-spike/external-research.md` (zewnętrzny, recenzja, decyzja)

## What & Why

Sprawdzamy w małym prototypie technikę na żywo wybraną po researchu, czyli wariant B: serwer nadaje na publicznym kanale Supabase tylko „coś się zmieniło” (dzwonek), a telefon po dzwonku pobiera stan z naszego serwera (tablica). Wynik pomiaru rozstrzyga, czy B zostaje dla S-01 i S-02, czy przechodzimy na plan awaryjny (Durable Objects). Robimy to przed budową pokoju, żeby problemy wyszły w teście, a nie w środku wieczoru gry.

## Starting Point

W grze nie ma jeszcze nic na żywo: brak stron gry, endpointów JSON, klienta Supabase w przeglądarce i tabel. Klucz Supabase to publishable, dziś czytany tylko na serwerze (`src/lib/supabase.ts`); reguła w AGENTS.md zabrania go w React.

## Desired End State

- **Strona demo:** `/dev/live-sync` działa lokalnie i na produkcji. Gość widzi status połączenia i pytanie po każdym dzwonku, a zalogowany ma przycisk „Zadzwoń”.
- **Sonda:** `npm run live-probe` udaje 20 graczy osobnymi połączeniami i mówi PASS albo FAIL.
- **Wynik:** `measurements.md` zawiera liczby z komputera i z produkcji, test telefonu ze zgaszonym ekranem i werdykt.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Technika na żywo | B: publiczny kanał-dzwonek + stan z serwera | Limit Supabase to średnia z 60 s, a supabase-js sam wznawia połączenie | Research (ext.) + Karol |
| Zakres spike'a | Mały: sam transport, bez tabel i migracji | Tabele i tak powstaną w S-01/S-02; zero zmian w produkcyjnej bazie | Karol |
| Klucz w przeglądarce | Publishable w runtime (props/JSON), secret nigdy; nowe brzmienie reguły w AGENTS.md | `deploy-plan.md:143` zakazuje zmiennych buildu Supabase | Research (int.) |
| Gdzie mierzymy | Lokalnie i na produkcji | Produkcja to to, czego użyją gracze; lokalnie łapiemy błędy przed pushem | Plan (Karol) |
| Kto dzwoni | Tylko zalogowany; słucha każdy | Układ jak w grze, bez nowego sekretu | Plan (Karol) |
| Kryterium „≤ 2 s” | 95% w 2 s, max 5 s, zero zgubionych, zero rozłączeń | Odróżnia problem od czkawki sieci; luźniej niż `prd.md:139`, więc zapisane świadomie | Plan (Karol) |
| Skala | 20 graczy decyduje, 5 × 20 informacyjnie | Zapas na piątkowy szczyt (PRD: ok. 100 osób, limit 200 połączeń) | Plan (Karol) |
| Po pomiarze | Kod zostaje jako fundament; sonda posłuży S-02 | Nie piszemy dwa razy | Plan (Karol) |
| Test ręczny | Telefon + laptop + zgaszony ekran: powrót w < 10 s i kolejny dzwonek | Główna obawa z recenzji; nadrabianie dochodzi w S-02 | Plan (Karol) |
| Luka w uprawnieniach | Ask dla sondy i `supabase migration up/down/repair` | `lessons.md:9`, zanim S-01 zacznie migracje | Plan (Karol) |
| Middleware | Bez zmian; sonda rozbija czas na dzwonek i tablicę | Najpierw pomiar, potem ewentualna optymalizacja | Plan |

## Scope

**In scope:** reguła o kluczach i sprzeczne z nią dokumenty; reguły ask; moduł `live-sync`; 3 endpointy (config, ring, state); strona demo; sonda; pomiary lokalne i produkcyjne; test telefonu; werdykt oraz aktualizacja roadmapy i `infrastructure.md`.

**Out of scope:** tabele, migracje, zapis głosów i tożsamość gościa (S-01/S-02); nadrabianie przegapionego dzwonka; kanały prywatne i Durable Objects; zmiany middleware; sonda w CI; sprzątanie kont testowych; zmiana PRD.

## Architecture / Approach

Zalogowany (host albo sonda) woła `POST /api/live-sync/ring`. Worker nadaje przez `httpSend` na `live-sync:<room>` zdarzenie `bell` z samym `{ seq }`. Każdy subskrybent (gość w przeglądarce albo klient sondy) po dzwonku woła `GET /api/live-sync/state`. Worker odpowiada jednym zwykłym pytaniem z bazy (import tylko w module serwerowym). Przeglądarka dostaje URL i klucz publishable jako props strony, a sonda z `GET /api/live-sync/config`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Zasady, uprawnienia i zależności | Nowa reguła o kluczach, 6 reguł ask, globale lintu, supabase-js ≥ 2.114 | Brzmienie reguły musi być jednoznaczne dla kolejnych agentów |
| 2. Dzwonek i tablica (serwer) | Moduł `live-sync` i 3 endpointy JSON | `httpSend` w Workerze niesprawdzony w praktyce |
| 3. Strona demo | `/dev/live-sync` z wyspą (status, powroty, „Zadzwoń”) | Przez nieuwagę wyciek bazy pytań do bundla (sprawdza grep) |
| 4. Sonda i pomiar lokalny | `npm run live-probe`, wyniki lokalne | Pomiar z Windows może zawyżać czasy |
| 5. Produkcja i telefon | Pomiar na produkcji, test telefonu, werdykt, dokumenty | Wymaga pusha (wdrożenie) po `/10x-impl-review` |

**Prerequisites:** `.dev.vars` z URL i kluczem publishable (jest); email confirmation wyłączone w Supabase (jak dla smoke); przełącznik „Allow public access” w Realtime włączony (domyślnie); telefon do testu.
**Estimated effort:** ok. 2–3 sesje. Fazy 1–4 lokalnie, potem przegląd kodu, potem faza 5 z pushem.

## Open Risks & Assumptions

- **Decyzja Karola jako laika:** oparta na researchu i recenzji agentów; przyjęte ryzyko „możemy się kiedyś przejechać”, z warunkami powrotu w `external-research.md`.
- **Limit 100/s liczony jako średnia** wynika z kodu open source, nie z dokumentacji; pomiar 5 × 20 go sprawdzi.
- **Sonda i demo tworzą konta testowe** w produkcyjnym Supabase (jak smoke) i zużywają trochę limitu wiadomości.
- **Strona testowa i endpoint dzwonka** zostają na produkcji do czasu S-01; przez nasz endpoint dzwonić może tylko zalogowany.
- **Dzwonek może nadać każdy** z kluczem publishable, z pominięciem endpointu (publiczny kanał). Pytanie wyliczane z numeru dzwonka to skrót prototypu; od S-02 stan pochodzi wyłącznie z bazy.
- **Nadrabianie przegapionego dzwonka** jest niesprawdzone do S-02.

## Success Criteria (Summary)

- Sonda na produkcji: 1 pokój × 20 graczy × 10 prób daje PASS (95% w 2 s, max 5 s, bez zgubionych i rozłączeń).
- Telefon po zgaszonym ekranie wraca w < 10 s i łapie kolejny dzwonek.
- Karol akceptuje werdykt dla B, a roadmapa i `infrastructure.md` opisują sprawdzoną technikę.
