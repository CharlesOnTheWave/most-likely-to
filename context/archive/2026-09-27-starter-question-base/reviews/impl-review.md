<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Baza startowa pytań (F-02)

- **Plan**: context/changes/starter-question-base/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-09-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations
- **Werdykt Karola**: zatwierdzam (Approve), 27.09.2026, po triage. Naprawione: F1, F2, F3, F5, F7. F4 zapisane jako reguła. F6 i F8 pominięte z zapisanym powodem.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Evidence

- Zakres: commity `18292da`, `6069e39`, `a818518`, `b29ce02` (`git diff 71a4004..b29ce02`, 8 plików). Nazwa planu nie ma daty, więc zakres wyznaczyły commity ze `starter-question-base` w opisie. Późniejszy `c1c4cda` (paczka M2L3) nie należy do zmiany.
- Plan ↔ diff: każda zaplanowana zmiana jest na miejscu (MATCH). Poza planem są tylko pliki teczki zmiany, zmiana statusu F-02 w roadmapie przez `/10x-implement` i linia opisana w F8.
- Kryteria automatyczne, uruchomione ponownie 27.09:
  - `npm run lint`: PASS.
  - `npx astro check`: PASS, 0 błędów.
  - `npm run build`: PASS (znane ostrzeżenie sitemap o `site`).
  - 1.4: tymczasowy duplikat `imprezy-001` sprawia, że `astro check` pada z ts(1117); plik przywrócony.
  - 2.1 i 2.2 (`check-review.mjs`): PASS. 8 × (20 + 7) = 216 pytań, najdłuższe ma 70 znaków, bez powtórek.
  - 3.1 (`compare.mjs`): PASS. Plik zawiera dokładnie 216 zatwierdzonych wierszy, ID są poprawne.
- Kryteria ręczne: 1.5, 3.5 i 3.6 mają w rozmowie pytanie i odpowiedź Karola. O 2.3 i 2.4 zob. F3.
- Treść: wszystkie 216 tekstów przeczytane w całości i przeskanowane słowami kluczowymi.
  - Żadne pytanie bez znacznika 18+ nie dotyczy alkoholu, randek ani seksu. Żadne pytanie 18+ nie jest wulgarne.
  - Wszystkie pytania są w trybie przypuszczającym.
  - Brak znaków `< > & " '` i znaków niewidocznych.
  - ID są unikalne i idą 001–027 bez luk w każdej kategorii. Żaden identyfikator kategorii nie jest przedrostkiem innego.
- Pominięte jako kosmetyka: edytor przypisuje blok `/** … */` z góry `questions.ts` do `CATEGORIES`, a nie do `QUESTIONS`. Widać to tylko w podpowiedzi edytora.

## Findings

### F1 — Pytania nie da się wycofać bez ryzyka ponownego użycia ID

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/data/questions.ts:5-7
- **Detail**: Komentarz mówi, że ID „never changes and is never reused, even if … retired”, ale plik nie ma sposobu na wycofanie pytania. Zostaje tylko usunięcie wpisu, a razem z nim znika ochrona TS1117 dla tego klucza. Kolejne dopisane pytanie może wtedy po cichu dostać zwolniony numer i przejąć statystyki S-11 starego. FR-017 (prd.md:124) przewiduje właśnie odkładanie pytań „do przeróbki”. Nie wiadomo też, jaki numer dostaje nowe pytanie, gdy inne przeniesiono do innej kategorii. Przedrostek ID przestaje wtedy wskazywać kategorię.
- **Fix A ⭐ Recommended**: Dopisać w komentarzu zasady, bez zmiany kształtu danych:
  - wpisów się nie usuwa, a sposób pomijania wycofanych pytań ustalą S-11/S-12;
  - poprawka literówki zachowuje ID, zmiana sensu to nowe pytanie z nowym ID;
  - nowe ID dostaje numer o jeden wyższy od najwyższego z danym przedrostkiem;
  - kategorii nie odczytuje się z ID.

  Ocena:
  - Strength: zamyka lukę od razu, kosztem kilku linijek komentarza. Jest zgodne z planem („kształt i zasady z Fazy 1 bez zmian”, stały walidator dopiero w M3).
  - Tradeoff: to reguła w komentarzu, a nie mechaniczna ochrona; pilnuje jej przegląd.
  - Confidence: HIGH — dopóki pytania nie trafią do bazy, nic nie czyta ID, więc wystarczy dyscyplina zapisu.
  - Blind spot: S-11/S-12 i tak muszą zaprojektować wycofywanie po stronie bazy.
- **Fix B**: Dodać od razu opcjonalne pole `retired: true`. Wpis zostaje w pliku, a losowanie go pomija. Do tego te same zasady w komentarzu.
  - Strength: wycofanie jest jawne w danych, a klucz mechanicznie zostaje w literale.
  - Tradeoff: zmienia kształt danych zamrożony w planie i wyprzedza projekt S-12, które może trzymać „odłożone” pytania w bazie. Pole mogłoby zostać martwe.
  - Confidence: MED — zależy od tego, gdzie S-12 umieści stan pytań.
  - Blind spot: nie wiadomo jeszcze, czy po S-11 pytania w ogóle zostaną w pliku.
- **Decision**: FIXED via Fix A — dwie nowe zasady w komentarzu `src/data/questions.ts` (nie usuwamy wpisów; literówka zachowuje ID, zmiana sensu to nowe ID; nowe ID = najwyższe z danym przedrostkiem + 1; kategorii nie odczytujemy z ID). Karol wybrał po wyjaśnieniu na przykładzie.

### F2 — Wybór 18+ nie dotarł do reguły losowania pytań

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: context/foundation/prd.md:120 (FR-015), context/foundation/prd.md:74 (US-01), context/foundation/roadmap.md:129 (S-02)
- **Detail**: Plan kazał dopisać regułę 18+ tylko do FR-005 i S-01 („nic poza tym się nie zmienia”), więc luka jest w planie, nie w wykonaniu. Trzy miejsca nie wspominają o 18+:
  - FR-015: „draws questions … in the selected categories only”;
  - kryterium US-01: „Pytanie pochodzi tylko z wybranych kategorii…”;
  - Outcome S-02: „pytanie z wybranych kategorii”.

  S-02 zbudowane według tych zapisów mogłoby losować pytania 18+ z kategorii, w których host je wyłączył.
- **Fix**: Dopisać warunek 18+ we wszystkich trzech miejscach. Przykład dla FR-015: „…in the selected categories only (18+ questions only from categories where the host included them)…”. W US-01 i S-02 to samo po polsku.
- **Decision**: FIXED — dopiski w FR-015 (prd.md:120), US-01 (prd.md:74) i S-02 (roadmap.md:129)

### F3 — Plan i streszczenie opisują zatwierdzanie, które się nie odbyło

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md:18, plan.md:188, plan.md:231 (Progress 2.3), plan-brief.md:15
- **Detail**: Punkt 2.3 („Karol oznaczył każde pytanie na stronie przeglądu…”) jest odhaczony, choć Karol zaakceptował pytania w czacie, bez oznaczania („nie chce mi sie wypelniac formularza … wstępnie akceptuje wszystkie”). Odstępstwo jest opisane w nocie Fazy 2 (plan.md:127) i w `question-review.md` z cytatem, w tym samym commicie `6069e39`. Wciąż jednak trzy miejsca mówią o zatwierdzaniu na stronie:
  - Desired End State (plan.md:18);
  - Manual Testing Steps (plan.md:188);
  - plan-brief.md:15: „zatwierdził je jedno po drugim na stronie przeglądu”.

  Punkt 2.4 („wprost zatwierdza całą bazę”) opiera się na akceptacji „wstępnej”. Tytuł 2.3 zostaje bez zmian, bo tytuły w Progress są niezmienne.
- **Fix**: Dopisać krótką notę przy plan.md:18 i w plan-brief.md:15: „w praktyce akceptacja w czacie, zob. nota w Fazie 2”. W `question-review.md` zapisać, że Karol w przeglądzie kodu potwierdził akceptację jako ostateczną.
- **Decision**: FIXED — noty w plan.md:18, plan.md:188 i plan-brief.md:15. W question-review.md zapisane, że Karol potwierdził akceptację 216 pytań jako ostateczną.

### F4 — Pytania trzeba trzymać po stronie serwera

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/data/questions.ts (przyszłe użycie w S-01, S-02, S-06)
- **Detail**: Dziś nic nie importuje tego modułu, więc nic z niego nie trafia do paczki. Kiedy S-01 i S-02 zaczną go używać, import w wyspie React (komponencie działającym w przeglądarce) wyśle wszystkie 216 tekstów, także 18+, każdemu graczowi. Dałoby się je podejrzeć w narzędziach przeglądarki, nawet gdy host wyłączył 18+, a także przeczytać pytania z kolejnych rund. Teksty trzeba też wyświetlać jako zwykły tekst, nigdy przez `set:html` ani `dangerouslySetInnerHTML`.
- **Fix**: Zapisać regułę w `lessons.md` (Record as lesson): pytania importujemy tylko w kodzie serwera, a do przeglądarki trafia tylko to, co dana osoba ma teraz zobaczyć, jako zwykły tekst. Kod na razie bez zmian.
  - Strength: każdy kolejny `/10x-plan` i `/10x-implement` przeczyta regułę, zanim S-01 i S-02 w ogóle dotkną pytań.
  - Tradeoff: jedna reguła więcej w `lessons.md`, na razie jeszcze nieużywana.
  - Confidence: HIGH — tak działają wyspy Astro: import w komponencie `client:*` trafia do paczki przeglądarki.
  - Blind spot: S-06 (host przegląda wylosowaną listę) pokaże hostowi całą listę i to jest w porządku. Reguła musi to dopuszczać, stąd „to, co dana osoba ma zobaczyć”.
- **Decision**: ACCEPTED-AS-RULE: Pytania gry tylko po stronie serwera (lessons.md). Kod bez zmian, bo nic jeszcze nie importuje pytań.

### F5 — Trzy poprawki językowe w pytaniach

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/data/questions.ts:209 (wpadki-i-obciach-005), src/data/questions.ts:72 (na-co-dzien-013), src/data/questions.ts:103 (na-co-dzien-026)
- **Detail**: Gracze zobaczą te zdania na ekranie.
  - „zaciąłby się w drzwiach tramwaju”: o człowieku „zaciąć się” znaczy skaleczyć się, zająknąć albo uprzeć; zacinają się drzwi.
  - Przed „zamiast” z bezokolicznikiem stawia się przecinek, a brakuje go w dwóch pytaniach: „…po raz piąty zamiast zacząć nowy” i „przewijałby Tindera zamiast spać”.
- **Fix**: „utknąłby w drzwiach tramwaju”, „…po raz piąty, zamiast zacząć nowy”, „przewijałby Tindera, zamiast spać”. Te same wiersze w `question-review.md` dostają notę „poprawka po przeglądzie kodu”. ID bez zmian, bo to poprawka, a nie nowe pytanie.
- **Decision**: FIXED — trzy teksty poprawione w `src/data/questions.ts` i w `question-review.md` (z notą przy wierszu). Lint, `astro check`, 2.1, 2.2 i 3.1 ponownie PASS.

### F6 — Sześć par bardzo podobnych pytań

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/data/questions.ts:
  - imprezy-025 ↔ wpadki-i-obciach-027 (l.159, 309);
  - przyszlosc-025 ↔ gry-i-internet-023 (l.192, 408);
  - sport-i-wyzwania-002 ↔ -012 (l.555, 585);
  - sport-i-wyzwania-001 ↔ -020 (l.552, 605);
  - sport-i-wyzwania-003 ↔ -016 (l.560, 595);
  - na-co-dzien-008 ↔ -012 (l.59, 69).
- **Detail**: Plan zakładał, że pytania podobne znaczeniowo wyłapie szkic i przegląd Karola (plan.md:95). Szkic, który pisał Claude, ich nie wyłapał, a przegląd był zbiorczy (zob. F3). Przykład: „wyznawałby wszystkim miłość po trzecim drinku” i „wyznałby miłość po pijaku, a rano udawał, że nic nie pamięta”. Pary z tej samej kategorii mogą trafić na jeden wieczór.
- **Fix**: Przeredagować jedno pytanie z wybranych par albo zostawić je bez zmian. Dane z gier (S-11/S-12) pokażą, który wariant działa lepiej.
- **Decision**: SKIPPED — powód zaakceptowany przez Karola: to warianty jednego żartu z innym akcentem. Dane z gier (S-11/S-12) pokażą, który działa lepiej, a słabszy wtedy odłożymy.

### F7 — „Ślub w Las Vegas” jest zwykły, a „ślub z kimś z wakacji” 18+

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/data/questions.ts:174 (przyszlosc-011), src/data/questions.ts:184 (przyszlosc-021)
- **Detail**: Ten sam żart o spontanicznym ślubie ma dwa różne znaczniki. Reguła 18+ (aluzje, alkohol, randki) broni obu. W tekście z Vegas nie ma alkoholu ani randki, a „ktoś poznany na wakacjach” to temat randkowy. To przypadek graniczny, a nie wyciek pytania 18+.
- **Fix**: Ujednolicić znacznik (oba 18+ albo oba zwykłe) albo zostawić jak jest.
- **Decision**: FIXED — Karol wybrał „oba jako 18+” (rekomendacja brzmiała: zostawić). `przyszlosc-011` ma teraz `adult: true`, a wiersz d11 w `question-review.md` dostał notę. W Przyszłości jest teraz 19 zwykłych i 8 pytań 18+, minimum 15 + 5 jest zachowane.

### F8 — Dodatkowa linia „Amendment” w PRD

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/prd.md:96
- **Detail**: Kontrakt Fazy 3 mówił „nic poza tym się nie zmienia”, a pod FR-005 doszła linia `> Amendment 2026-09-27 (F-02 planning, game creator's decision): …`. To pierwsza notka tego typu w PRD; wcześniejsze to `> Socratic:`. Linia tylko powtarza regułę i mówi, skąd się wzięła. Karol widział ją przy odbiorze 3.6 („Do tego jedna linijka z datą…”) i ją zaakceptował.
- **Fix**: Zostawić linię jako zapis pochodzenia decyzji albo ją usunąć.
- **Decision**: SKIPPED — powód zaakceptowany przez Karola: linia została zaakceptowana przy odbiorze 3.6 i zapisuje pochodzenie decyzji.
