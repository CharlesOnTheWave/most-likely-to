<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Pierwsza runda na żywo (S-02) z testami anonimowości i reguł rundy

- **Plan**: context/changes/first-live-round/plan.md
- **Mode**: Deep
- **Date**: 2026-10-14
- **Verdict**: REVISE → SOUND po triage (wszystkie ustalenia poprawione w planie)
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

13/13 paths ✓, 7/7 symbols ✓ (`parseLobby`, `hostOpenRoomId`, `normalize_nick`, `players_room_nick_key`, `room_lobby`, `LOBBY_POLL_MS`, `rooms.created_at`), brief↔plan ✓.

Weryfikacja w kodzie potwierdziła kolejność wdrożenia „najpierw baza”: Worker nie pisze do tabel bezpośrednio (tylko `select` w `src/lib/rooms/server.ts:161, :178`), a kod linku czyta z bazy (`src/pages/r/[id].astro:29-34`). Smoke (`scripts/smoke.mjs:244-250`) i E2E (`tests/e2e/support/room.ts:44`) biorą link ze strony.

F1 przeszło recenzję: adwokat diabła (zegar od startu gry, nie od założenia pokoju; osobna migracja; `skip locked`; przypadki negatywne) i krytyk faktów (pg_cron w obrazie każdego projektu Supabase przez `supautils`, włączany migracją `with schema pg_catalog`; lokalne odpalanie zadań niepotwierdzone, więc test woła funkcję wprost; `cron.job_run_details` zapisuje treść błędów; `cron.schedule` z nazwą nadpisuje zadanie).

## Findings

### F1 — Runda przerwana bez „Nowej gry” zostawia urnę na tygodnie

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Desired End State pkt 5; Faza 2 #1; Faza 1 #2 (dopisek PRD)
- **Detail**: Stan w toku znika przy odsłonie i przy `create_room` hosta. Wieczór przerwany w trakcie głosowania (ktoś wyszedł, nikt nie kliknął „Odsłoń wynik”) zostawia częściową urnę do następnej gry tego hosta, czyli nawet na tygodnie. Przy jednym głosie albo zgodnych głosach to para (`research.md:108`). Granica „twórca na żywo” zamieniała się w „twórca w dowolnej chwili później”.
- **Fix A ⭐ Recommended (po recenzji)**: zadanie pg_cron co godzinę zamyka gry rozpoczęte ponad 12 h temu (nowa kolumna `rooms.started_at`) i kasuje ich urnę; osobna migracja; pgTAP woła funkcję wprost.
  - Strength: obietnica „przy porzuceniu nic” obejmuje najczęstszy koniec wieczoru; granica ma górny limit ok. 13 h.
  - Tradeoff: rozszerzenie i zadanie w bazie, 4 przypadki pgTAP.
  - Confidence: MED — pg_cron w obrazie Supabase potwierdzony w kodzie `supautils`, plan darmowy nienazwany wprost w dokumentacji.
  - Blind spot: czy harmonogram odpala na produkcji; sprawdzenie w panelu dzień po wdrożeniu (6.8).
- **Fix B**: przyjąć i dopisać granicę „do następnej gry hosta” w PRD i AGENTS.md.
  - Strength: zero kodu.
  - Tradeoff: granica bez końca; para widoczna przy przypadkowym przeglądzie tabel.
  - Confidence: HIGH.
  - Blind spot: none significant.
- **Decision**: FIXED (Fix A po recenzji: zegar od startu gry, osobna migracja `close_stale_games`, `for update skip locked`, przypadki negatywne, krok 6.8)

### F2 — Kryterium 1.3 („każdy nowy test czerwony”) nie do uczciwego odhaczenia

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Faza 1 #6, #7; Progress 1.3
- **Detail**: REST do tabel `private` dostaje odmowę już dziś (`supabase/config.toml:13`). Pozostałe testy seedują przez nieistniejące `start_game`, więc cały plik jest czerwony z jednego powodu, niezależnie od asercji. pgTAP przy brakującej tabeli rzuca błąd i plik kończy się w tym miejscu.
- **Fix**: 1.3 opisuje oczekiwany powód czerwieni i strażników zielonych od początku; pgTAP pisany funkcjami, które dają `not ok` zamiast błędu, kontrola pozytywna pierwsza.
  - Strength: kryterium da się odhaczyć zgodnie z prawdą.
  - Tradeoff: faza 1 nie dowodzi, że asercje pilnują; to faza 2 i próbne alarmy.
  - Confidence: HIGH — config.toml:13, semantyka `beforeAll` (test-plan §6.2).
  - Blind spot: kształt raportu `supabase test db` przy `not ok` (pierwsze uruchomienie).
- **Decision**: FIXED

### F3 — Wycofanie samego kodu nie jest bezpieczne po pierwszej grze

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Migration Notes
- **Detail**: Przy pokoju `playing` stary Worker daje 500 na `/r/` (`server.ts:129`) i `/j/` (`:93-99`), a `hostOpenRoomId` (`:161`) blokuje założenie nowej gry.
- **Fix**: notatka: bezpieczne tylko przed pierwszą grą; potem naprawa do przodu albo cofnięcie z migracją zamykającą pokoje `playing`.
- **Decision**: FIXED

### F4 — Trzy szczegóły migracji i serwera

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2 #1, Faza 3 #5
- **Detail**: `normalize_nick` przed kolumną `stored` `nick_key`; `create_room` przez `create or replace` + `owner to postgres` (inaczej wraca `execute` dla `anon`); parser `room_link` (`server.ts:14-15, 93-99`) nie zna `started`.
- **Fix**: dopisane w kontraktach.
- **Decision**: FIXED

### F5 — Próbny alarm (b) może zaświecić dwa testy

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 1 #5, Faza 5 #3
- **Detail**: Kontrola pozytywna w `round-rules` porównana dokładnie z `{ok:true}` zaświeci razem z testem anonimowości.
- **Fix**: `round-rules` sprawdza tylko `ok: true`; dokładne klucze tylko `round-anonymity`.
- **Decision**: FIXED

### F6 — Dopisek do AGENTS.md obiecuje odmowę, której nie ma

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 #2
- **Detail**: `supabase test db` nie ma bezpiecznika jak `test:db`; z `--linked` trafiłby w produkcję, reguła tylko pyta.
- **Fix**: brzmienie „locally it needs Docker; with `--linked` it would run against production, so the command asks first”.
- **Decision**: FIXED

### F7 — „Wersja stanu” w ograniczniku niezdefiniowana

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 4 #1
- **Detail**: `room_lobby` nie zwraca wersji.
- **Fix**: zmiana = inny stan po parserze (porównanie JSON); ogranicznik dostaje tylko „zmieniło się / nie”.
- **Decision**: FIXED
