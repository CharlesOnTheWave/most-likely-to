<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Pokój i poczekalnia (room-lobby)

- **Plan**: context/changes/room-lobby/plan.md
- **Scope**: Full plan (fazy 1–4 ukończone; z fazy 5 kod sprzed PR: fokus w `RoomCard`, README, szkielet `phone-test.md`, commit `adba792`)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Kryteria automatyczne powtórzone 08.10 na kodzie `adba792`: bramka (lint z `ui-literals: 0 literals in 23 view files`, `astro check` 0/0/0, build), smoke lokalny 32/32, CI na PR #1 (`ci` 41 s, `smoke` z migracją 2 min 23 s), REST z kluczem publishable na trzech tabelach 401 `42501`, RPC (`room_link` → `unknown`, `join_room` → `room_unknown`, `room_lobby` → `null`, `create_room` jako anon 401), build produkcyjny 404 na `/dev/live-sync`, `/dev/room-states`, `/dev/ui-kitchen-sink`. Fokus na błędzie serwera: 5/5 w headless Chrome, test zepsucia czerwony bez skryptu. Workers Builds gałęzi czerwony ze znanej przyczyny (`deploy-plan.md`, Etap 6). Ręczne 1.6–4.4 odhaczone przez Karola w trakcie faz.

Sprawdzone i bez uwag: CSRF (Astro 7 `security.checkOrigin` domyślnie włączone, ciasteczka `SameSite=Lax`), XSS (brak `set:html`/`dangerouslySetInnerHTML`, `?error=` przez stałą mapę), przekierowania (tylko sprawdzone wzorce, UUID z bazy i stałe ścieżki), funkcje `security definer` (`search_path = ''`, nazwy ze schematem, właściciel `postgres`, `revoke` + wybiórczy `grant`), brak wycieku hashy i identyfikatorów, logi bez nicku i tokenów, `rpc` zawsze POST, wyścigi (`for update`, częściowy indeks + `try_again`), dzwonek przez `waitUntil`, lekcje 1–3, wzorce (`rooms/errors.ts` ↔ `auth-errors.ts`, `api/rooms/*` ↔ `api/auth/*`, formularze ↔ `SignInForm`, `RoomCard` ↔ `SignInCard`).

## Findings

### F1 — Host przez bezpośredni dostęp do tabel omija reguły `create_room`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261007122858_room_lobby.sql:59-61, 73-76, 184
- **Detail**: `authenticated` ma `insert` na `rooms` i `players` oraz `update (status)` na `rooms`, a polityka zmiany sprawdza tylko `host_id` (bez statusu). Zalogowany host może swoim tokenem wywołać REST z pominięciem Workera: otworzyć z powrotem zamknięty pokój (`PATCH status=lobby`, o ile nie ma innego otwartego), sam wybrać kod linku (`create_room` przyjmuje `p_link_token` od wołającego) i zapisać dowolne nazwy kategorii (sprawdza je tylko Worker). Dotyczy wyłącznie jego własnych pokoi; danych innych osób nie odsłania. Ryzyko rośnie w S-02: gdy `status` dostanie stany gry, ten sam grant pozwoli hostowi przeskakiwać etapy. Plan zakładał „Wszystkie reguły gry pilnuje baza” — to luka w planie, nie w wykonaniu.
- **Fix A ⭐ Recommended**: Zapisać jako wymaganie dla S-02 (follow-up), a S-02 w swojej migracji zawęża politykę zmiany do przejść, które gra dopuszcza, generuje kod linku w SQL i filtruje kategorie przy odczycie.
  - Strength: S-02 i tak przebudowuje stany pokoju i doda migrację; jedna zmiana zamiast dwóch, bez dodatkowego `db push` przed scaleniem.
  - Tradeoff: Do czasu S-02 host może „odmrozić” własny zamknięty pokój.
  - Confidence: HIGH — dziś nikt poza hostem nie traci; brak stanów gry do przeskoczenia.
  - Blind spot: Nie sprawdzaliśmy, czy S-02 będzie miało czas na tę migrację w swoim zakresie.
- **Fix B**: Nowa migracja teraz (`using (… and status = 'lobby') with check (… and status = 'closed')`, kod linku z `gen_random_bytes` w SQL), CI na PR, `db push` za zgodą, potem scalenie.
  - Strength: Baza od razu pilnuje reguły „zamknięty pokój się nie otwiera”.
  - Tradeoff: Dodatkowa migracja na produkcji tuż przed scaleniem, zmiana `create_room` i `server.ts`, ponowny smoke.
  - Confidence: MED — `create_room` przechodzi przez nową politykę (zmienia `lobby` → `closed`), ale zmiana sygnatury funkcji wymaga zgrania z kodem.
  - Blind spot: Każda poprawka migracji to kolejny nieodwracalny krok na jedynej bazie.
- **Decision**: ACCEPTED — Fix A: wymaganie dla S-02 (`follow-ups/review-fixes.md`, roadmapa S-02 Risk)

### F2 — Każdy dzwonek to natychmiastowe pobranie listy na każdym ekranie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/room/RoomLobby.tsx:93-95
- **Detail**: Kanał `live-sync:<roomId>` jest publiczny (tak jak w F-01), a `room_id` zna każdy gość. Ktoś złośliwy może dzwonić seriami, a każdy dzwonek to N żądań do Workera i N wywołań `room_lobby` (N = liczba ekranów). Dane są bezpieczne (dzwonek tylko mówi „sprawdź”), ale seria może zjeść dzienny limit 100 tys. żądań. Przy legalnym starcie (10 gości w kilka sekund) każdy ekran też pobiera listę 10 razy.
- **Fix**: W `refresh()` najwyżej jedno pobranie naraz plus jedno „na koniec”, z odstępem ok. 1 s.
- **Decision**: ACCEPTED — odłożone do S-02 (`follow-ups/review-fixes.md`)

### F3 — Po 404 lista odpytuje dalej co 15 s z komunikatem „Nie udało się odświeżyć listy”

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/room/RoomLobby.tsx:60-74
- **Detail**: 404 z `/api/rooms/<id>/lobby` jest trwałe (wygasłe ciasteczko gościa po 24 h, host wylogowany w innej karcie), a ekran traktuje je jak chwilowy błąd i pokazuje komunikat bez wyjścia.
- **Fix**: Przy 404 przeładować stronę; serwer pokaże wtedy „Nie jesteś w tym pokoju. Poproś hosta o link.”
- **Decision**: FIXED — przeładowanie przy 404 w `RoomLobby.tsx`

### F4 — Reguła nicku w bazie: inna niż w planie i z lukami

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261007122858_room_lobby.sql:114-123, 204-266
- **Detail**: Wgrana funkcja `private.normalize_nick` ma szersze zestawy znaków niż plan (m.in. U+000B–000D, U+0085, U+2800 na spację; U+034F, wypełniacze Hangul, U+2065–206F usuwane; NFC na końcu) — zgłoszone Karolowi w fazie 1, ale niezapisane w `change.md`. Nadal przechodzą niektóre niewidoczne znaki (selektory wariantu U+FE00–FE0F, znaczniki U+E0000–E007F, U+061C), więc „Ola”+U+FE0F to osobny nick wyglądający jak „Ola”. `join_room` nie ma też limitu długości nicku przed wyrażeniami regularnymi. Plan przyjął podobne ryzyko dla liter z innych alfabetów.
- **Fix**: Zapisać faktyczną regułę i luki w `change.md`; domknąć je w następnej migracji, która rusza nicki (S-02 albo S-04), razem z odrzuceniem nicku dłuższego niż 100 znaków przed normalizacją.
- **Decision**: ACCEPTED — reguła zapisana w `change.md`, luki w `follow-ups/review-fixes.md` (S-02/S-04)

### F5 — Smoke zapisuje do bazy produkcyjnej i pyta o zgodę, a AGENTS.md o tym nie mówi

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: .claude/settings.json:42-48, AGENTS.md (Testing)
- **Detail**: Faza 2 dodała reguły `ask` dla smoke (lekcja 1), bo smoke zakłada pokoje i gości w jedynej bazie. AGENTS.md (Testing) mówi tylko, że smoke „creates no accounts”. Następny agent nie wie, że zostawia dane na produkcji.
- **Fix**: Jedno zdanie w AGENTS.md (Testing): smoke zakłada pokoje i gości na koncie testowym w bazie produkcyjnej (zostają do S-13) i dlatego pyta o zgodę.
- **Decision**: FIXED — zdanie w AGENTS.md (Testing)
