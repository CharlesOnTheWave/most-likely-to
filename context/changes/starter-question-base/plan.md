# Baza startowa pytań (F-02) Implementation Plan

## Overview

Pierwsza wspólna baza pytań „Kto z nas najprawdopodobniej…” po polsku: 8 kategorii, w każdej co najmniej 15 zwykłych pytań i 5 pytań 18+, zatwierdzona pytanie po pytaniu przez twórcę gry (Karola). Baza żyje w jednym pliku TypeScript w kodzie gry, ze stałym identyfikatorem i znacznikiem 18+ przy każdym pytaniu. Dzięki temu S-01 (wybór kategorii i checkbox 18+ przy tworzeniu pokoju) i S-02 (losowanie pytań do rundy) mają gotowe dane, a produkcyjna baza Supabase zostaje nietknięta.

## Current State Analysis

- W projekcie nie ma żadnych danych gry: brak `src/data`, brak kolekcji treści Astro, brak tabel i migracji Supabase (`supabase/` ma tylko `config.toml`; `context/foundation/roadmap.md:77`).
- Jedyny projekt Supabase obsługuje jednocześnie dev i produkcję (`AGENTS.md:22`, `context/deployment/deploy-plan.md:11`), lokalnie nie ma Dockera, a CLI nie jest połączone z projektem. Każda zmiana w bazie to decyzja „ask” (`AGENTS.md:9`).
- Brak frameworka testów (`AGENTS.md:22`). Bramka to `npm run lint`, `npx astro check`, `npm run build` (`AGENTS.md:15`, `.github/workflows/ci.yml`).
- Repo jest publiczne, więc treść pytań będzie publicznie widoczna; to akceptowalne (pytania nie są tajne).
- Późniejsze elementy potrzebują stabilnej tożsamości pytania: S-11 zbiera zbiorcze dane o każdym pytaniu (FR-016), S-12 dobiera pytania według jakości (FR-017), a FR-021 mówi, że twórca dodaje nowe pytania „tak samo jak buduje bazę startową” (`context/foundation/prd.md:130`).

## Desired End State

- `src/data/questions.ts` eksportuje listę 8 kategorii (stały identyfikator + polska nazwa, w ustalonej kolejności) oraz słownik pytań kluczowany identyfikatorem pytania; każde pytanie ma kategorię, tekst i znacznik `adult` (18+).
- W każdej kategorii jest co najmniej 15 pytań z `adult: false` i co najmniej 5 z `adult: true`; każde z nich Karol zatwierdził na stronie przeglądu, a zapis przeglądu leży w `context/changes/starter-question-base/question-review.md`.
- Bramka (`npm run lint`, `npx astro check`, `npm run build`) przechodzi; zdublowany identyfikator pytania wywala `astro check`.
- Decyzja „checkbox 18+ przy każdej kategorii” jest zapisana w S-01 w roadmapie i w FR-005 w PRD.

Weryfikacja: tabela liczby pytań (zwykłe / 18+) na kategorię z pliku zgadza się z zapisem przeglądu, a Karol ją potwierdza.

### Key Discoveries:

- `tsconfig.json:2-10`: tryb `astro/tsconfigs/strict`, alias `@/*` → `src/*`; plik w `src/` jest sprawdzany przez `astro check`.
- `eslint.config.js:17-20`: `strictTypeChecked` + `stylisticTypeChecked` z `projectService`; plik danych w `src/` przejdzie pełny typowany lint i Prettiera (szerokość 120).
- `astro.config.mjs:11,16`: `output: "server"` z adapterem Cloudflare; moduł importowany w kodzie serwera jest dołączany do paczki Workera, więc nie ma odczytu plików w czasie działania.
- `supabase/config.toml:60-65` wskazuje nieistniejący `seed.sql`, a CI stawia lokalny Supabase (`.github/workflows/ci.yml:41`); to przyda się dopiero przy przenosinach do bazy (S-01 albo S-11).
- `AGENTS.md:28`: nowe tabele dostają RLS z politykami per operacja; dotyczy przyszłego kroku z bazą, nie tej zmiany.

## What We're NOT Doing

- Tabel i migracji w Supabase oraz wgrywania pytań na produkcję; pytania trafią do bazy, gdy będą tam potrzebne (S-01 albo S-11), z tymi samymi identyfikatorami.
- Ekranu wyboru kategorii i checkboxa 18+ (S-01), losowania pytań i wyświetlania prefiksu (S-02), statystyk pytań (S-11).
- Stałego testu lub skryptu walidującego dane; sprawdzenia w tej zmianie są jednorazowe, a stały test dojdzie w module 3 razem z frameworkiem testów.
- Listy zakazanych tematów: decyzja twórcy gry z 27.09 brzmi „wstępnie nie unikamy niczego”; filtrem jest przegląd Karola.
- Formy neutralnej płciowo: pytania są w trybie przypuszczającym, w formie ogólnej („…zasnąłby…”), zgodnie z decyzją Karola.
- Researchu „jakie pytania działają najlepiej” (Open Roadmap Question 7); odpowiedzą na to dane z gier (S-11, S-12).
- Pushowania commitów; zostają lokalnie, push tylko za zgodą Karola.

## Implementation Approach

Najpierw kształt danych (typy, kategorie, reguły zapisane w pliku), potem treść: szkic z zapasem, przegląd Karola na prywatnej stronie (artefakt) aż do akceptacji, na końcu wpisanie zatwierdzonych pytań do pliku i sprawdzenie. Typy TypeScript pilnują kategorii i znacznika 18+, a klucze obiektu pilnują unikalności identyfikatorów, więc istniejąca bramka (`astro check`) wyłapuje błędy danych bez dokładania nowych narzędzi.

## Critical Implementation Details

- **Unikalność identyfikatorów przez klucze obiektu.** Słownik pytań musi być literałem obiektu kluczowanym identyfikatorem, bo TypeScript zgłasza błąd TS1117 przy powtórzonym kluczu w literale; tablica obiektów z polem `id` tego nie da. `QUESTIONS` zostaje **jednym** literałem: sklejenie części przez spread (`{ ...imprezy, ...przyszlosc }`) po cichu przepuszcza duplikat. Duplikat łapie wyłącznie `npx astro check` (ESLint ma `no-dupe-keys` wyłączone dla TS, a build nie sprawdza typów).
- **Identyfikator to kontrakt na zawsze.** Po wejściu do pliku identyfikator pytania nigdy się nie zmienia i nie jest używany ponownie, także gdy pytanie zmieni kategorię albo zostanie kiedyś wycofane; S-11 będzie pod nim trzymać statystyki.
- **Każdy push na `main` wdraża produkcję.** Plik danych nie jest jeszcze nigdzie importowany, więc gra się nie zmienia; commity zostają lokalnie do decyzji Karola.

## Phase 1: Szkielet bazy pytań

### Overview

Plik z typami, 8 kategoriami i zasadami zapisu pytań, na razie bez pytań. Po tej fazie wiadomo, jak wygląda pytanie, i to przed napisaniem pierwszego z nich.

### Changes Required:

#### 1. Moduł danych pytań

**File**: `src/data/questions.ts`

**Intent**: Jedno źródło prawdy o kategoriach i pytaniach, z którego skorzystają S-01 i S-02, a później także przeniesienie do bazy. Komentarz na górze pliku zapisuje zasady, żeby każde kolejne dopisywanie pytań (FR-021) szło tą samą drogą.

**Contract**:
- `CATEGORIES`: tablica tylko do odczytu `{ id, name }` w kolejności wyświetlania: `na-co-dzien` „Na co dzień”, `imprezy` „Imprezy”, `przyszlosc` „Przyszłość”, `wpadki-i-obciach` „Wpadki i obciach”, `gry-i-internet` „Gry i internet”, `podroze-i-przygody` „Podróże i przygody”, `sport-i-wyzwania` „Sport i wyzwania”, `praca-i-szkola` „Praca i szkoła”.
- `CategoryId`: unia identyfikatorów kategorii wyprowadzona z `CATEGORIES`.
- `QUESTIONS`: literał obiektu `Record<string, { category: CategoryId; text: string; adult: boolean }>` (przez `satisfies`), na razie pusty; `QuestionId` = klucze `QUESTIONS`.
- Zasady w komentarzu: `QUESTIONS` to jeden literał, bez sklejania części przez spread; identyfikator `<id-kategorii>-<NNN>` (trzy cyfry, kolejno w kategorii), niezmienny i nieużywany ponownie; `text` to końcówka po stałym prefiksie „Kto z nas najprawdopodobniej”, zaczyna się małą literą, bez „?” i kropki na końcu, w trybie przypuszczającym w formie ogólnej, najwyżej 90 znaków; ekran (S-02) składa „Kto z nas najprawdopodobniej {text}?”; `adult: true` oznacza pytanie 18+ (aluzje, alkohol, randki; bez wulgaryzmów i dosłowności).

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi
- `npm run build` przechodzi
- Tymczasowo zdublowany identyfikator pytania wywala `npx astro check` (sprawdzone raz i cofnięte)

#### Manual Verification:

- Karol akceptuje nazwy kategorii i ich kolejność

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Szkic pytań i przegląd Karola

### Overview

Szkic z zapasem (ok. 20 zwykłych i 7 pytań 18+ na kategorię), przegląd na prywatnej stronie z przyciskami przy każdym pytaniu, poprawki i dopiski aż do spełnienia minimum 15 + 5 w każdej kategorii. Zapis przeglądu w folderze zmiany jest dowodem „zatwierdzone przez twórcę gry”.

Kryteria automatyczne tej fazy (i 3.1) sprawdza jednorazowy skrypt `node` w scratchpadzie sesji, bez commitu; jego wynik trafia do raportu fazy. „Powtórzony tekst” znaczy: identyczny po zamianie na małe litery i przycięciu spacji. Pytania podobne znaczeniowo wyłapuje szkic i przegląd Karola.

### Changes Required:

#### 1. Zapis przeglądu

**File**: `context/changes/starter-question-base/question-review.md`

**Intent**: Trwały zapis szkicu i decyzji Karola, który przetrwa zamknięcie sesji i trafi potem do archiwum razem ze zmianą.

**Contract**: Sekcja na każdą kategorię; w niej tabela z kolumnami: numer, tekst (końcówka), 18+, status (`propozycja` / `fajne` / `do poprawy` / `usunięte`), uwaga Karola, runda. Pytanie „do poprawy” dostaje nową wersję w nowym wierszu, a stary wiersz zostaje z historią. Zatwierdzone są tylko wiersze ze statusem `fajne`.

#### 2. Strona przeglądu (artefakt, poza repo)

**File**: prywatny artefakt claude.ai generowany z `question-review.md` (źródło HTML w scratchpadzie sesji, nie w repo)

**Intent**: Karol przy każdym pytaniu klika „fajne”, „do poprawy” albo „do usunięcia” i może dopisać, co mu nie pasuje; Claude odczytuje te oznaczenia bez przepisywania ich ręcznie przez Karola.

**Contract**: Pytania pogrupowane po kategoriach, pytania 18+ wyraźnie oznaczone; pełne zdanie z prefiksem „Kto z nas najprawdopodobniej…?”; trzy przyciski i pole uwagi przy każdym pytaniu; licznik oznaczonych. Oznaczenia trafiają do Claude przez wspólną bazę artefaktu (preferowane; przed napisaniem strony wczytać skill `artifact-capabilities`) albo przez przycisk „Kopiuj wynik”, którego zawartość Karol wkleja do czatu. Kolejne rundy pokazują tylko pytania nowe i poprawione.

### Success Criteria:

#### Automated Verification:

- W każdej kategorii `question-review.md` ma co najmniej 15 zwykłych i co najmniej 5 pytań 18+ ze statusem `fajne`
- Zatwierdzone pytania nie mają powtórzonych tekstów, a każdy tekst spełnia zasady zapisu (najwyżej 90 znaków, mała litera na początku, bez „?” i kropki na końcu)

#### Manual Verification:

- Karol oznaczył każde pytanie na stronie przeglądu, a każde „do poprawy” wróciło w nowej wersji i zostało zaakceptowane
- Karol wprost zatwierdza całą bazę

Nota z realizacji (27.09.2026): Karol przejrzał wszystkie 216 pytań i zaakceptował je w czacie, bez oznaczania na stronie przeglądu; żadne nie było do poprawy ani do usunięcia. Zapis i cytat: `question-review.md`, sekcja „Wynik rundy 1”.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Baza w kodzie

### Overview

Zatwierdzone pytania trafiają do `src/data/questions.ts` z identyfikatorami, a decyzja o checkboxie 18+ do roadmapy i PRD.

### Changes Required:

#### 1. Pytania w module danych

**File**: `src/data/questions.ts`

**Intent**: Wpisanie wszystkich pytań ze statusem `fajne` (także ponad minimum) do `QUESTIONS`.

**Contract**: Identyfikatory nadawane kolejno w obrębie kategorii (`imprezy-001`, `imprezy-002`, …) w kolejności z zapisu przeglądu; teksty identyczne z zatwierdzonymi; kształt i zasady z Fazy 1 bez zmian. Przed `npm run lint` uruchomić `npm run lint:fix`: przy szerokości 120 znaków Prettier rozbije dłuższe wpisy na kilka linii (przy `podroze-i-przygody-NNN` już od ok. 33 znaków tekstu).

#### 2. Decyzja o 18+ w dokumentach produktu

**File**: `context/foundation/roadmap.md`, `context/foundation/prd.md`

**Intent**: Zapisać decyzję twórcy gry z planowania, żeby S-01 ją zbudował: host przy każdej wybranej kategorii decyduje, czy dołączyć pytania 18+.

**Contract**: Outcome S-01 w roadmapie (blok `### S-01` i wiersz w „At a glance”, jeśli mieści się w jednym zdaniu) oraz treść FR-005 w PRD dostają tę regułę; nic poza tym się nie zmienia.

### Success Criteria:

#### Automated Verification:

- `src/data/questions.ts` zawiera dokładnie zatwierdzone pytania z `question-review.md` (ta sama liczba zwykłych i 18+ w każdej kategorii, identyczne teksty)
- `npm run lint` przechodzi
- `npx astro check` przechodzi
- `npm run build` przechodzi

#### Manual Verification:

- Karol potwierdza tabelę liczby pytań (zwykłe / 18+) na kategorię
- Karol akceptuje dopiski o checkboxie 18+ w S-01 (roadmapa) i FR-005 (PRD)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Brak frameworka testów (`AGENTS.md:22`); stały test bazy (unikalne teksty, limity długości, minimalne liczby w kategoriach) dojdzie w module 3.

### Integration Tests:

- Nie dotyczy: plik nie jest jeszcze nigdzie importowany.

### Manual Testing Steps:

1. Faza 1: Karol czyta listę kategorii i ich kolejność.
2. Faza 2: Karol oznacza każde pytanie na stronie przeglądu, aż wszystkie kategorie spełnią minimum.
3. Faza 3: Karol porównuje tabelę liczb z zapisem przeglądu i czyta dopiski w roadmapie i PRD.

## Performance Considerations

Około 160–200 krótkich tekstów to kilkanaście KB w paczce Workera (obecnie ok. 2,1 MB bez kompresji); bez znaczenia.

## Migration Notes

Gdy pytania trafią do Supabase (S-01 albo S-11), identyfikatory z pliku zostają kluczami w tabeli, a tabela dostaje RLS zgodnie z `AGENTS.md:28`. Wgranie na produkcję wymaga zgody Karola (`npx supabase db push` jest w „ask”).

## References

- Roadmapa: `context/foundation/roadmap.md` (F-02, S-01, S-02, S-11, S-12)
- PRD: `context/foundation/prd.md` (FR-005, FR-015, FR-016, FR-017, FR-021, Access Control)
- Tożsamość zmiany: `context/changes/starter-question-base/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Szkielet bazy pytań

#### Automated

- [x] 1.1 `npm run lint` przechodzi — 18292da
- [x] 1.2 `npx astro check` przechodzi — 18292da
- [x] 1.3 `npm run build` przechodzi — 18292da
- [x] 1.4 Tymczasowo zdublowany identyfikator pytania wywala `npx astro check` (sprawdzone raz i cofnięte) — 18292da

#### Manual

- [x] 1.5 Karol akceptuje nazwy kategorii i ich kolejność — 18292da

### Phase 2: Szkic pytań i przegląd Karola

#### Automated

- [x] 2.1 W każdej kategorii `question-review.md` ma co najmniej 15 zwykłych i co najmniej 5 pytań 18+ ze statusem `fajne`
- [x] 2.2 Zatwierdzone pytania nie mają powtórzonych tekstów, a każdy tekst spełnia zasady zapisu (najwyżej 90 znaków, mała litera na początku, bez „?” i kropki na końcu)

#### Manual

- [x] 2.3 Karol oznaczył każde pytanie na stronie przeglądu, a każde „do poprawy” wróciło w nowej wersji i zostało zaakceptowane
- [x] 2.4 Karol wprost zatwierdza całą bazę

### Phase 3: Baza w kodzie

#### Automated

- [ ] 3.1 `src/data/questions.ts` zawiera dokładnie zatwierdzone pytania z `question-review.md` (ta sama liczba zwykłych i 18+ w każdej kategorii, identyczne teksty)
- [ ] 3.2 `npm run lint` przechodzi
- [ ] 3.3 `npx astro check` przechodzi
- [ ] 3.4 `npm run build` przechodzi

#### Manual

- [ ] 3.5 Karol potwierdza tabelę liczby pytań (zwykłe / 18+) na kategorię
- [ ] 3.6 Karol akceptuje dopiski o checkboxie 18+ w S-01 (roadmapa) i FR-005 (PRD)
