<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Współhost (S-07)

- **Plan**: `context/changes/co-host-role/plan.md`
- **Mode**: Deep
- **Date**: 2026-10-27
- **Verdict**: REVISE → SOUND po triage (F1 przez Fix A, F2–F4 poprawione w planie)
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

45/45 paths ✓, 8/8 symbols ✓ (latest definitions of the 7 moves + `room_lobby`), brief↔plan ✓, Progress↔Phases ✓.
Verified in code: a signed-in guest falls through to the token branch (`cast_vote`, `react_round`, `room_lobby`); `questionsLeft` needs only `base_count`, `entries.length` and the round number; no migration after `20261026074427` redefines the moves; old parsers copy only known keys; a `not_leader` refusal maps to 409 in `statusFor`.

## Findings

### F1 — Współhost obchodzi pulę pytań (18+) przez REST

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 1 — Migracja (grant `anon` dla 7 ruchów)
- **Detail**: Plan: „Wszystkie kontrole zostają w środku”. Pulę pytań (kategorie, 18+ tylko z wybranych, FR-005) sprawdza jednak tylko Worker (`poolFrom`, `src/lib/rounds/draw.ts:26-33`). `start_game`, `next_round` i `skip_round` sprawdzają tylko format id (`question_play_data.sql:316`, `open_next_round`). Dziś obejść to może tylko host we własnym pokoju. Po grancie `anon` współhost (token z własnego ciasteczka, publiczny URL i klucz publishable, id pytań w publicznym repo) wywoła `next_round` z dowolnym `p_candidates`, np. pytaniem 18+ w pokoju bez 18+.
- **Fix A ⭐ Recommended**: Przyjąć jako znaną dziurę. Plan (ryzyka i „Czego nie robimy”) mówi o niej wprost, a `cohost.test.ts` dostaje `test.fails` „znana dziura …”: `next_round` współhosta z id 18+ spoza wyboru hosta → oczekiwana odmowa.
  - Strength: Zakres bez zmian; konwencja repo dla znanych dziur; dziura widoczna w logu CI.
  - Tradeoff: Dziura zostaje; trzeba celowego obejścia przez współhosta, którego wybrał host.
  - Confidence: HIGH — sprawdzone w kodzie bazy i Workera.
  - Blind spot: Konwencja chce „→ <zmiana>”, a zmiany naprawczej jeszcze nie ma w roadmapie.
- **Fix B**: Sprawdzać pulę w bazie: baza dostaje kategorię i flagę 18+ każdego pytania (albo zapisaną pulę pokoju), a `open_next_round` i `start_game` odrzucają kandydatów spoza niej.
  - Strength: Zamyka dziurę dla hosta i współhosta; reguła AGENTS.md spełniona dosłownie.
  - Tradeoff: Kopia bazy pytań (58 pytań 18+) w SQL do synchronizacji z `src/data/questions.ts`; nowy zakres, raczej osobna zmiana.
  - Confidence: MED — kształt nieprzemyślany.
  - Blind spot: Własne i przeredagowane pytania listy S-06.
- **Decision**: FIXED (Fix A)

### F2 — Faza 2 nie przejdzie `astro check` ani `npm test`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2 — Typy i parsery stanu
- **Detail**: Wymagane `LobbyPlayer.cohost` i `RoomView.leader` psują typowane literały (`tsconfig.json` obejmuje `**/*`): `src/pages/dev/room-states.astro:49-107,158-290`, `src/pages/dev/room-window.astro:28-63,111-160`, `tests/unit/announce.test.ts:11-115`, `tests/unit/chart.test.ts:149-151`, a w czasie testu fikstury `tests/unit/room-state.test.ts:15-19,443-448`. Plan rusza budowniczych stanów dopiero w fazie 3 (3.5), a testów `announce` i `chart` nie wymienia wcale.
- **Fix**: W fazie 2 dopisać te pliki z domyślnymi polami (`cohost: false`, `leader` = rola host); nowe stany współhosta zostają w fazie 3.
- **Decision**: FIXED

### F3 — „Obcy host” w `cohost.test.ts` wymaga drugiego konta

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 — Testy bazy; Dokumenty (`test-plan.md` §6.2)
- **Detail**: §6.2: „jeden host na plik”, plan liczy 16 rejestracji (`cohost` 1). Odmowa `set_cohost` dla obcego hosta wymaga jednak drugiego konta. `round-rules.test.ts` ma `hostA` i `hostB` (`:63`). „Token z innego pokoju” i „zamknięty pokój” wychodzą z jednym hostem (`seedRoom` z `confirmClose`, jak `reactions.test.ts:121-127`).
- **Fix**: Przypadek „obcy host → `room_unknown`” dla `set_cohost` do `round-rules.test.ts` (`hostB`); licznik zostaje 16.
- **Decision**: FIXED

### F4 — „Nowa gra” hosta zamyka wieczór współhosta

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: What We're NOT Doing / brief: Open Risks
- **Detail**: Research (`research.md:150-151`) to zauważył: `create_room` zamyka otwarty pokój hosta (`first_live_round.sql:262-279`, przy gościach z potwierdzeniem), także wieczór prowadzony przez współhosta. Plan o tym milczy, a „wieczór trwa dalej” działa tylko do „Nowej gry” hosta.
- **Fix**: Jedno zdanie w ryzykach planu i briefu (świadomie, do S-09 albo później).
- **Decision**: FIXED
