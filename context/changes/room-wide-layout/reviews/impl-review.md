<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Szeroki układ strony pokoju

- **Plan**: context/changes/room-wide-layout/plan.md
- **Scope**: Full plan (ukończone fazy; faza 3 to ten przegląd i wdrożenie)
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-16
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Kryteria automatyczne faz 1–2 uruchomione ponownie 2026-10-16: `npm run lint` (0 literałów w 35 widokach), `npx astro check` (0 błędów), `npm test` (336), `npm run build`, `git grep` po prototypie (nic), `npx playwright test --list` (`game.spec.ts` w `chromium` i `phone`, 6 testów), stare ścieżki w `src tests scripts supabase` (tylko 2 linie wgranej migracji). CI zielone na `0ed1d4e` (38881112980), `519bf3f` (38883974332), `7fa4c80` (38886006144) i `e56592a`. Porównanie telefonu: wyniki z fazy 1 i 2 (kod od tamtej pory bez zmian). Ręczne 1.5, 1.6 i 2.6 potwierdzone przez Karola.

Zgodność z planem: każdy plik z planu ma zmianę zgodną z intencją, nic nieplanowanego (agent odchyleń: same MATCH; `lg:flex-2` przy pytaniu „Na pewno…?” to zatwierdzony dodatek w granicach kontraktu). Bezpieczeństwo: `/dev/room-window` w buildzie produkcyjnym odpowiada pustym 404, bez `set:html`, bez nowych logów, bez pary „kto na kogo”; żaden przodek paska nie ucina `overflow`; brak przewijania w poziomie przy 1024 px; `cn` (tailwind-merge) zachowuje wszystkie klasy, `lg:flex-2` jest w zbudowanym CSS; konteksty gości dziedziczą okno projektu (Playwright 1.64, `runBeforeCreateBrowserContext`).

## Findings

### F1 — „Gracze” przyklejeni przy przewijaniu nigdy nie działa; w długiej poczekalni „Zacznij grę” ucieka nad ekran

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/room/RoomLobby.tsx:154
- **Detail**: Plan (Desired End State, faza 1 pkt 4) chce „Graczy” przyklejonych przy przewijaniu. Element `sticky` w siatce przesuwa się tylko w swoim obszarze siatki, a ten jest tak wysoki jak wyższa kolumna. Strona przewija się tylko przy długiej liście graczy, a wtedy to „Gracze” są najwyższym elementem i nie mają gdzie się przesunąć. Pomiar (1280×600, `/dev/room-window?state=lobby-host` z 23 graczami, przewinięcie o 300 px): obie kolumny jadą w górę, „Zacznij grę” na y −21, poza ekranem. Ten sam pomiar z `lg:sticky lg:top-6` na kolumnie gry zamiast na „Graczach”: tytuł, link i „Zacznij grę” zostają (przycisk na y 214), lista przewija się obok. Zrzuty z galerii (8 graczy) się nie zmieniają, bo tam strona się nie przewija. Brak próbki z długą poczekalnią w `/dev/room-window` i `/dev/room-states`, więc żadna bramka tego nie widziała. Telefon bez zmian (tylko `lg:`).
- **Fix A ⭐ Recommended**: przykleić kolumnę gry (`lg:sticky lg:top-6` na grupie z tytułem, linkiem i „Zacznij grę”), zdjąć z „Graczy”, poprawić komentarz; dodać próbkę `lobby-host-20` do `/dev/room-window`
  - Strength: host z dużą ekipą ma „Zacznij grę” i link zawsze na ekranie; sprawdzone pomiarem powyżej.
  - Tradeoff: odstępstwo od litery planu („Gracze” przyklejeni) na rzecz jego celu; drobna edycja i jedna próbka.
  - Confidence: HIGH — zmierzone w Chrome na prawdziwym komponencie.
  - Blind spot: przy bardzo niskim oknie (poniżej ok. 350 px wysokości) przyklejona kolumna gry sama nie zmieści się na ekranie.
- **Fix B**: zdjąć przyklejenie i komentarz, opisać w planie, że w poczekalni nic nie jest przyklejone
  - Strength: najmniejsza zmiana; wygląd identyczny z galerią.
  - Tradeoff: w dużej ekipie host przewija do góry, żeby kliknąć „Zacznij grę”.
  - Confidence: HIGH — usuwa martwą klasę.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A): `lg:sticky lg:top-6` na kolumnie gry zamiast na „Graczach” (`RoomLobby.tsx`), próbka `lobby-host-20` w `/dev/room-window`. Sprawdzone w Chrome: przy przewijaniu w oknie 1280×600 „Zacznij grę” zostaje na y 214; telefon bez zmian (`/dev/room-window` 11/11, `/dev/room-states` 72/72).

### F2 — Nic nie pilnuje, że pasek hosta naprawdę przykleja się do dołu okna

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/room/HostActions.tsx:82
- **Detail**: Pasek to główny cel zmiany (Z2: przyciski hosta pod krawędzią ekranu). W e2e `chromium` (1280×720, 3 graczy) odsłona mieści się w oknie, więc „Następne pytanie” jest widoczne z paskiem i bez niego. Gdyby ktoś dodał `overflow-hidden` albo `overflow-x-hidden` na `body`, `<main>` albo kolumnie stanu (typowa „naprawa” przewijania w poziomie), `sticky` wyłączy się po cichu, a lint, unit, e2e i smoke zostaną zielone. Plan świadomie nie ma testu zrzutów w CI; ręcznie pasek sprawdzają zrzuty fazy 1 i krok 3.3 na produkcji.
- **Fix A ⭐ Recommended**: krok w `game.spec.ts` tylko dla okien od 1024 px: przy odsłonie pytania 1 okno 1280×400, przewinięcie na górę, `expect(„Następne pytanie”).toBeInViewport()`, potem okno z powrotem; próbny alarm w CI (pasek bez `sticky` → czerwony tylko ten krok w `chromium`)
  - Strength: strażnik głównego zachowania zmiany za kilka linii w istniejącym specu; ten sam wzorzec co projekt `phone` (alarm dowodzi, że łapie).
  - Tradeoff: warunek w specu zależny od szerokości okna; jeszcze jeden cykl CI z alarmem i revertem (pushe za zgodą).
  - Confidence: MED — przy 400 px wysokości odsłona 3 graczy (ok. 640 px) na pewno wychodzi poza okno, ale pierwszy przebieg CI to potwierdzi.
  - Blind spot: nie pilnuje paska w głosowaniu (po głosie hosta), tylko po odsłonie.
- **Fix B**: wpisać w `test-plan.md` (§7 albo §6.4), że przyklejenie paska sprawdza się ręcznie (`/dev/room-window`, krok 3.3), z powodem
  - Strength: zero kodu; plan i tak zakłada ręczne sprawdzenie na produkcji.
  - Tradeoff: regresja `overflow` przejdzie przez CI niezauważona aż do ręcznego sprawdzenia.
  - Confidence: HIGH — tylko dokumentacja.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A): krok „Host's bar” w `game.spec.ts` (okno 1280×400 przy odsłonie, `toBeInViewport({ ratio: 1 })`), opis w test-plan §6.4. Próbny alarm `18f2638` (pasek bez `lg:sticky`): czerwony tylko ten krok w `chromium` (linia 99, 3 próby, run 38896274126); `phone` i reszta zielone; revert `cfe158f`.

### F3 — Kontrola okna w `game.spec.ts` nie złapie projektu `phone` bez rozmiaru 390×844

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/e2e/game.spec.ts:55-62; context/foundation/test-plan.md §6.4
- **Detail**: Kontrola porównuje okno każdego gracza z oknem z ustawień projektu. Łapie gości bez okna projektu i projekt bez okna, ale gdyby ktoś usunął z `phone` nadpisanie `viewport`, projekt odziedziczy 1280×720 z `Desktop Chrome` i przejdzie na zielono w układzie laptopa. Zdanie w §6.4 („projekt, który po cichu zagrałby w oknie laptopa… świeci na czerwono”) obiecuje więcej, niż kontrola sprawdza.
- **Fix**: dopisać w kontroli `expect(viewport.width < 1024, "phone plays below lg").toBe(test.info().project.name === "phone")` (1 linia) i zostawić zdanie w §6.4.
- **Decision**: FIXED: `expect(viewport.width < LG_WIDTH).toBe(project.name === "phone")` w kontroli okna; test-plan §6.4 doprecyzowany.

### F4 — Pasek jest o 16 px szerszy od kolumny z każdej strony; po głosie hosta rząd zmienia się w pasek z przeskokiem

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/room/HostActions.tsx:82
- **Detail**: `lg:-mx-4 lg:px-4 lg:pb-4` tylko w `bar`: linia nad przyciskami wystaje 16 px poza tabelę odsłony, a przy przejściu `row` → `bar` (głos hosta) blok rośnie o 16 px w bok i w dół. Wygląd pochodzi z wariantu C i jest na zrzutach zatwierdzonych przez Karola (galeria M, kadry 6–10); przejście po głosie i tak zmienia cały ekran (formularz → „Głos oddany”).
- **Fix**: zostawić (wygląd zatwierdzony); gdyby przeszkadzał, linię `border-t` przenieść na element wewnętrzny o szerokości kolumny.
- **Decision**: SKIPPED: wygląd z wariantu C zatwierdzony przez Karola na zrzutach (galeria M, kadry 6–10).

### F5 — `roomColumn` powtarza wybór widoku z `RoomScreen` i nic tego nie testuje

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/room/room-frame.ts:22-28
- **Detail**: Dziś obie gałęzie się zgadzają (zamknięty → wąsko, brak rundy → poczekalnia, odsłona → 768 px, głosowanie hosta → 768 px, pominięta runda i głosowanie gościa → wąsko). Nowy widok albo faza spadnie po cichu do wąskiej kolumny (bezpieczna wartość domyślna). Plan świadomie nie ma testu unit („lustro implementacji”, Testing Strategy); reguła w AGENTS.md §UI każe dać nowemu stanowi podgląd w `/dev/room-states`.
- **Fix**: zostawić zgodnie z planem (bez testu); nowy stan łapie reguła AGENTS.md i bramka wizualna.
- **Decision**: SKIPPED: zgodnie z planem bez testu unit (lustro implementacji); nowy stan łapie reguła AGENTS.md §UI i bramka wizualna.
