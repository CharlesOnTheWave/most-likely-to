# Kontrakt UI na ekranie logowania (ui-signin-contract) — plan implementacji

## Overview

Ekran logowania `/auth/signin` przechodzi na kontrakt UI: kolory z tokenów w `src/styles/global.css` (ciemny motyw przez klasę `dark`), klocki shadcn z `src/components/ui`, imprezową paletę wybraną przez Karola na zrzutach, wszystkie 7 stanów i kody błędów z polskimi komunikatami zamiast tekstu z adresu. Na koniec reguła w `AGENTS.md` i skan literałów w `npm run lint` pilnują, żeby następne ekrany (lobby S-01, runda S-02) powstały od razu na tym kontrakcie, a nie na literałach ze startera.

To praktyka lekcji M2L5 (`/10x-ui`): zadanie 1 (lista zarzutów) jest w `research.md`; ten plan realizuje zadania 2–4.

## Current State Analysis

Z `research.md` (audyt 2026-10-04):

- **Martwy plik tokenów.** `global.css` ma kompletne `:root`, `.dark` i `@theme inline` (`:6-111`), ale pliki widoku logowania używają 0 klas semantycznych i mają 13 linii z klasami palety. Jedynym konsumentem tokenów w `src/` jest `src/components/ui/button.tsx`.
- **Ciemny tylko na wierzchu.** Klasa `.dark` nie jest nigdzie włączana. Ekran jest ciemny dzięki `bg-cosmic` (hexy w `global.css:113-115`) i `text-white`. Fokus przycisku używa jasnego `--ring` i na ciemnej karcie jest ledwo widoczny.
- **Własne klocki.** `FormField.tsx` (bez `aria-invalid` i `aria-describedby`), `ServerError.tsx` (bez roli), karta z `div`. `SubmitButton.tsx` przemalowuje shadcn `Button` na fiolet (`:18`).
- **Kanał błędów.** `signin.astro:5,14` pokazuje dowolny tekst z `?error=` (potwierdzone na produkcji). API wkłada tam surowe angielskie `error.message` z Supabase (`api/auth/signin.ts:16`, `signup.ts:16`) i nie sprawdza pustych pól.
- **Stany.** `useFormStatus` (`SubmitButton.tsx:12`) przy natywnym `action="/api/auth/signin"` (`SignInForm.tsx:43`) się nie włącza (react-dom 19.3.0), więc spinner i blokada się nie pokazują i można wysłać formularz ponownie.
- **Język.** Cały ekran po angielsku i `lang="en"` (`Layout.astro:14`), a PRD mówi „Bez wersji angielskiej w v1” (`prd.md:187`).
- **Wspólne klocki.** `FormField`, `SubmitButton`, `ServerError` i `PasswordToggle` używa też `SignUpForm` (`SignUpForm.tsx:3-6`).

Ustalenia z planowania (2026-10-04):

- Rejestr shadcn (CLI 4.21.1) ma `field` (zależności rejestru `label`, `separator`; `FieldError` z `role="alert"`), `input`, `input-group` (zależności rejestru `button`, `input`, `textarea`), `label` i `separator` (paczka `radix-ui`), `card`, `alert`, `spinner`. Żadna pozycja nie ma `cssVars`, więc `add` nie ruszy `global.css`. CLI ma `--dry-run`. Bez `-o` pyta o nadpisanie istniejącego pliku, który różni się od wersji z rejestru (`button.tsx`), a w powłoce agenta nie ma kto odpowiedzieć. Wygenerowane pliki nie przechodzą naszego lintu (Prettier ze średnikami, `no-unnecessary-condition` w `field.tsx`), a część z nich dostaje `"use client"` mimo `rsc: false` (przegląd planu, F1).
- Supabase zwraca kody błędów (`AuthError.code`, `@supabase/auth-js/dist/module/lib/error-codes.d.ts`), m.in. `invalid_credentials`, `email_not_confirmed`, `over_request_rate_limit`, `over_email_send_rate_limit`, `validation_failed`, `email_address_invalid`, `user_already_exists`, `email_exists`, `weak_password`, `signup_disabled`. `code` bywa `undefined`: brak połączenia i odpowiedzi 502/503/504 dają `AuthRetryableFetchError` bez kodu. Tak wygląda m.in. uśpiony projekt Supabase (po 7 dniach bez ruchu; zdarzyło się 04.10).
- Smoke sprawdza tylko prefiks `/auth/signin?error=` (`scripts/smoke.mjs:49`, `:66`), więc kody go nie zepsują.
- `npm run lint` to `eslint .` (`package.json`), a CI uruchamia `npm run lint` (`.github/workflows/ci.yml:20`). ESLint ma osobną konfigurację dla `scripts/**/*.mjs` (`eslint.config.js:73-77`).
- `import.meta.env.DEV` ma precedens w `confirm-email.astro` (przełącza treść w trybie deweloperskim). Reguła z AGENTS.md o `import.meta.env` dotyczy tylko zmiennych Supabase.

## Desired End State

- `/auth/signin` jest zbudowany wyłącznie z tokenów i klocków shadcn: karta `Card`, pola `Field` i `InputGroup`, przycisk `Button` w wariancie domyślnym, komunikat `Alert`. Ma jednolite tło `bg-background` i polskie napisy. Skan literałów na plikach widoku daje 0 (było 13 na ekranie logowania, a z podpowiedzią hasła w `SignUpForm.tsx` 14).
- Cała aplikacja działa w ciemnym motywie przez `<html lang="pl" class="dark">`. Wartości `:root` i `.dark` pochodzą z imprezowego motywu wybranego przez Karola z 3 kandydatów, a źródło i surowe wartości leżą w folderze zmiany.
- Wszystkie 7 stanów działa i widać je na stronie `/dev/ui-kitchen-sink` (tylko lokalnie): domyślny, hover, focus-visible, zablokowany, błąd, ładowanie oraz „pusty: nie dotyczy” z powodem. Zrzuty z komputera i z 390 px leżą w `screens/`.
- W adresie idą tylko kody błędów; strona pokazuje polski komunikat z mapy, a nieznany kod daje komunikat ogólny. Link z dowolnym `?error=` nie wyświetla już cudzego tekstu (logowanie i rejestracja).
- `AGENTS.md` ma blok `## UI`, a `npm run lint` (więc też CI) zawodzi przy literale koloru w oczyszczonych plikach. Świeża sesja agenta przy drobnej zmianie sięga po tokeny.

Weryfikacja: kryteria sukcesu faz poniżej i `ui-quality-checklist` skilla `/10x-ui`.

### Key Discoveries:

- `SubmitButton.tsx:3,15,18`: shadcn `Button` przemalowany na fiolet. `cn` (paczka `cn` 0.4.0, zachowanie tailwind-merge) wyrzuca przy tym `bg-primary text-primary-foreground hover:bg-primary/90` z `button.tsx:12`.
- `global.css:4`: `@custom-variant dark (&:is(.dark *))`, więc klasa `dark` na `<html>` włącza warianty `dark:` w klockach shadcn dla całej strony.
- `global.css:119`: `outline-ring/50` dla wszystkich elementów; fokus shadcn to `ring-ring/50` (`button.tsx:8`). Kontrast ramki liczy się dla koloru z 50% przezroczystością.
- `SignUpForm.tsx:57-63`: podpowiedź hasła to element `<p>` z literałem `text-blue-100/50` przekazywany jako `hint`. Przy `FieldDescription` (też `<p>`) musi stać się tekstem.
- `scripts/smoke.mjs:47-50`: test złego hasła oczekuje tylko prefiksu `/auth/signin?error=`.

## What We're NOT Doing

- **Sposobu logowania** (hasło, rejestracja) nie zmieniamy. FR-001 (logowanie jednym kliknięciem) to S-05 (`research.md` D1). Nie szlifujemy elementów specyficznych dla hasła ponad to, czego wymaga macierz stanów.
- **Przekierowania zalogowanego z `/auth/*` i strony po zalogowaniu** nie ruszamy; to S-01 (D2).
- **Obudowa rejestracji** (`signup.astro`: tło, karta, nagłówek, napisy) i angielskie napisy w `SignUpForm` zostają do S-05 (decyzja Karola). Rejestracja dostaje tylko poprawione wspólne klocki, kody błędów i usunięcie jedynego literału z podpowiedzi.
- **Pozostałe ekrany startera** (`/`, `/dashboard`, `/auth/confirm-email`, `/dev/live-sync`) i utility `bg-cosmic` (wciąż przez nie używane) zostają (D4). `Banner.astro` też (D3).
- **Z motywu bierzemy tylko kolory ról i promień:** bez czcionek, cieni, wykresów i sidebaru. Bez przełącznika jasny/ciemny.
- **Bez testów zrzutowych i Playwrighta** (przyjdą w module 3) i bez nowej zależności lintu.
- **Fokusu w trybie wysokiego kontrastu Windows nie naprawiamy.** Klocki shadcn mają `outline-none`; poprawka wymagałaby zmian w `src/components/ui` (ryzyko w briefie).
- **Znikania tekstu wpisanego przed hydratacją** (D5) tylko szukamy przy bramce wizualnej; bez osobnej poprawki.

## Implementation Approach

Kolejność według `/10x-ui` z poprawką dla wariantu „martwy plik tokenów” (sekcja „Kontrakt” skilla):

1. narzędzia i tryb ciemny;
2. ekran na tokenach, które już są;
3. dopiero potem nowe wartości (paleta), wybierane na zrzutach prawdziwego ekranu;
4. stany i kanał błędów;
5. zabezpieczenie.

Wspólne klocki auth przebudowujemy w miejscu, zachowując ich propsy, więc `SignInForm` i `SignUpForm` zmieniają się minimalnie. Każda faza wizualna kończy się zrzutem z komputera i z 390 px oraz ponownym skanem literałów. Każda faza kończy się bramką (`npm run lint`, `npx astro check`, `npm run build`), ręcznym sprawdzeniem Karola i commitem.

## Critical Implementation Details

- **Kolejność faz.** Paleta (faza 3) przychodzi po przepięciu ekranu (faza 2). Inaczej zrzuty kandydatów pokazałyby stary ekran z literałami i porównanie byłoby bez sensu.
- **Timing & lifecycle.** `pending` ustawia się w `onSubmit` dopiero po udanej walidacji i nie blokuje pól (wyłączone pola nie są wysyłane w formularzu). Po powrocie przyciskiem „Wstecz” (zdarzenie `pageshow` z `persisted`) stan wraca do `false`, inaczej przycisk zostałby zablokowany.
- **Kontrast fokusu.** Klocki shadcn rysują fokus przez `ring-ring/50` (50% przezroczystości). Wartość `--ring` dobieramy tak, żeby ramka na `--card` miała co najmniej 3:1, a nie zmieniamy klas w `src/components/ui`.
- **`shadcn add`.** `input-group` dociąga `button` z rejestru. Uruchamiamy `add -o`, żeby CLI nie utknęło na pytaniu o nadpisanie, i zaraz przywracamy nasz przycisk (`git checkout -- src/components/ui/button.tsx`, potem `git diff` pusty). `separator` i `textarea` dochodzą jako zależności rejestru i zostają. Wygenerowane pliki dopasowujemy do repo: `npm run lint:fix`, ręczne poprawki tego, czego `--fix` nie naprawi, i usunięcie `"use client"`.
- **Wyspa w karcie.** `SignInForm client:load` siedzi wewnątrz statycznego `Card` w stronie `.astro`; Astro pozwala zagnieżdżać wyspy w dzieciach komponentów frameworka. Gdyby renderowanie zawiodło, kartę przenosimy do wyspy (to samo `Card`, inne miejsce).

## Faza 1: Klocki i tryb ciemny

### Overview

Dodajemy brakujące klocki shadcn i przełączamy całą aplikację na ciemne wartości tokenów i język polski. Wygląd ekranów startera nie powinien się zmienić, bo mają własne tła z literałów. Wyjątek: przycisk „Zadzwoń” na `/dev/live-sync` (`LiveSyncDemo.tsx:130`, `Button` bez nadpisań) przechodzi z ciemnego na jasny `--primary` z `.dark`. To zamierzone, bo od teraz bierze kolor z tokenu.

### Changes Required:

#### 1. Klocki shadcn

**File**: `src/components/ui/` (nowe pliki), `package.json`, `package-lock.json`

**Intent**: Dodać z rejestru prymitywy, których potrzebuje logowanie i S-01 (pole, etykieta, grupa pola z dodatkami, karta, komunikat, spinner), zgodnie z regułą „shadcn tylko przez CLI” (`AGENTS.md:27`). Zamyka część C3.

**Contract**:
- Najpierw `npx shadcn@latest add field input input-group label card alert spinner --dry-run`. Pokazuje 9 nowych plików i `button.tsx` jako „overwrite”, bo `input-group` dociąga `button` z rejestru.
- Potem to samo bez `--dry-run`, ale z `-o`. Bez `-o` CLI zatrzymuje się na pytaniu o nadpisanie `button.tsx`, a w powłoce agenta nikt na nie nie odpowie. Zaraz potem `git checkout -- src/components/ui/button.tsx`, żeby wrócił nasz przycisk.
- Wynik: nowe `field.tsx`, `input.tsx`, `input-group.tsx`, `label.tsx`, `card.tsx`, `alert.tsx`, `spinner.tsx`, `separator.tsx` i `textarea.tsx` oraz zależność `radix-ui`. `button.tsx` i `global.css` bez zmian.
- Dopasowanie nowych plików do repo:
  - `npm run lint:fix` (średniki i przecinki według `.prettierrc.json`);
  - ręczna, minimalna poprawka tego, czego `--fix` nie naprawi (np. `uniqueErrors?.length == 1` w `field.tsx`, reguła `no-unnecessary-condition`);
  - usunięcie `"use client"`, które CLI zostawia w części plików mimo `rsc: false` (AGENTS.md: bez dyrektyw Next.js).

#### 2. Ciemny motyw, język i tytuł

**File**: `src/layouts/Layout.astro`

**Intent**: Cała aplikacja czyta wartości z `.dark` (decyzja: ciemny motyw przez klasę), a czytniki ekranu czytają po polsku (C2, C5). Domyślny tytuł karty przeglądarki przestaje mówić „10x Astro Starter”.

**Contract**: `<html lang="pl" class="dark">` (dziś `:14`); domyślny `title` to „Most Likely To” (dziś `:10`).

### Success Criteria:

#### Automated Verification:

- `--dry-run` i `git diff --quiet -- src/components/ui/button.tsx src/styles/global.css` po dodaniu potwierdzają, że `button.tsx` i `global.css` są nietknięte
- W `src/components/ui/` istnieją `field.tsx`, `input.tsx`, `input-group.tsx`, `label.tsx`, `card.tsx`, `alert.tsx`, `spinner.tsx`, `separator.tsx`, `textarea.tsx`, a `"use client"` nie występuje w `src/` (grep)
- `npm run lint`, `npx astro check` i `npm run build` przechodzą
- HTML `/auth/signin` z serwera deweloperskiego zaczyna się od `<html lang="pl" class="dark">` (sprawdzone `node` + `fetch`)

#### Manual Verification:

- Zrzuty `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email` i `/dev/live-sync`, zrobione przed zmianą `Layout.astro` i po niej, wyglądają tak samo (tło i napisy czytelne); jedyna oczekiwana różnica to jasny przycisk „Zadzwoń” na `/dev/live-sync`

**Implementation Note**: Po fazie i zielonej bramce czekamy na potwierdzenie Karola, zanim przejdziemy dalej.

---

## Faza 2: Logowanie na tokenach i klockach

### Overview

Przepinamy ekran logowania i wspólne klocki auth na tokeny i shadcn, z polskimi napisami. Paleta to jeszcze fabryczne szarości shadcn w ciemnym wariancie. Ta faza ma pokazać, że ekran czyta tokeny.

### Changes Required:

#### 1. Pole formularza

**File**: `src/components/auth/FormField.tsx`

**Intent**: Zastąpić własne pole klockami shadcn, żeby kolory, fokus i stan błędu szły z tokenów, a komunikat był powiązany z polem (C1, C3).

**Contract**:
- Propsy bez zmian (`id`, `name`, `label`, `type`, `value`, `onChange`, `placeholder`, `error`, `icon`, `endContent`), z wyjątkiem `hint`, który staje się `string | undefined`.
- Budowa: `Field`, `FieldLabel`, `InputGroup` z `InputGroupAddon` (ikona na początku, `endContent` na końcu) i `InputGroupInput`. Pod polem `FieldError` (błąd) albo `FieldDescription` (podpowiedź).
- Input ma `aria-invalid` przy błędzie i `aria-describedby` wskazujące `<id>-error` albo `<id>-hint`. Tekst nie wchodzi pod ikonę oka.
- Brak klas palety.

#### 2. Przełącznik hasła

**File**: `src/components/auth/PasswordToggle.tsx`

**Intent**: Przycisk oka z tokenów, z większym obszarem kliknięcia i polską nazwą dla czytników (C1, C3).

**Contract**: propsy `visible` i `onToggle` bez zmian; `InputGroupButton` (albo `Button` w wariancie `ghost`) o obszarze kliknięcia co najmniej 24 px; `type="button"`; `aria-label` „Pokaż hasło” albo „Ukryj hasło”.

#### 3. Przycisk wysyłania

**File**: `src/components/auth/SubmitButton.tsx`

**Intent**: Domyślny wariant `Button` bez nadpisywania kolorów, czyli `--primary` (C1), oraz spinner z klocka `Spinner`. Działające ładowanie dochodzi w fazie 4.

**Contract**: usunięte klasy palety z `:18` i `:22`; propsy bez zmian w tej fazie.

#### 4. Komunikat serwera

**File**: `src/components/auth/ServerError.tsx`

**Intent**: `Alert` w wariancie `destructive` zamiast własnego `<p>` z czerwieniami (C1, C3).

**Contract**: prop `message: string | null | undefined` bez zmian; brak komunikatu oznacza brak renderu.

#### 5. Strona logowania

**File**: `src/pages/auth/signin.astro`

**Intent**: Tło z tokenu zamiast `bg-cosmic`, karta shadcn zamiast `div` z literałami i polskie napisy (C1, C5).

**Contract**:
- `bg-background` na kontenerze.
- `Card` z `CardHeader`, `CardTitle` „Zaloguj się”, `CardDescription` „Zaloguj się, żeby poprowadzić grę.”, `CardContent` (wyspa `SignInForm client:load`) i `CardFooter` z tekstem „Nie masz konta?” i linkiem „Załóż je” (`/auth/signup`, `text-primary`, podkreślenie przy hover).
- `Layout title="Zaloguj się"`.

#### 6. Formularz logowania

**File**: `src/components/auth/SignInForm.tsx`

**Intent**: Polskie napisy i walidacja oraz fokus na pierwszym błędnym polu po nieudanej walidacji, żeby użytkownik i czytnik ekranu od razu trafili na błąd (C3, C5).

**Contract**:
- Etykiety „E-mail” i „Hasło”; placeholdery „ty@przyklad.pl” i „Twoje hasło”.
- Komunikaty walidacji: „Podaj adres e-mail”, „Podaj poprawny adres e-mail”, „Podaj hasło”.
- Przycisk „Zaloguj się”, `pendingText` „Logowanie…”.
- Natywny `POST` na `/api/auth/signin` bez zmian.

#### 7. Formularz rejestracji (tylko dopasowanie)

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: Dopasować do nowego API wspólnych klocków i usunąć jedyny literał. Napisy zostają angielskie (decyzja: obudowa rejestracji czeka na S-05).

**Contract**: `passwordHint` (`:57-63`) zwraca tekst (`string | undefined`) zamiast elementu z `text-blue-100/50`; reszta bez zmian.

### Success Criteria:

#### Automated Verification:

- Skan `/10x-ui` na `src/pages/auth/signin.astro` i `src/components/auth/*.tsx` daje 0 trafień (przed zmianą 14: 13 na ekranie logowania i 1 w podpowiedzi hasła `SignUpForm.tsx`)
- `signin.astro` nie zawiera `bg-cosmic`, a pliki widoku nie importują już własnego `input`/`p` z kolorami (grep)
- `npm run lint`, `npx astro check` i `npm run build` przechodzą

#### Manual Verification:

- Zrzut logowania (komputer i 390 px): karta z tokenów, polskie napisy, wpisany tekst nie wchodzi pod ikonę oka
- Rejestracja renderuje nowe pola i da się wysłać formularz (zrzut), napisy angielskie zgodnie z decyzją

**Implementation Note**: Po fazie i zielonej bramce czekamy na potwierdzenie Karola, zanim przejdziemy dalej.

---

## Faza 3: Paleta gry

### Overview

Karol wybiera imprezową paletę z 3 kandydatów pokazanych na zrzutach prawdziwego ekranu logowania. Wartości trafiają do tokenów, a źródło i kontrasty do folderu zmiany.

### Changes Required:

#### 1. Kandydaci i wybór

**File**: (bez zmian w repo do czasu wyboru)

**Intent**: Trzy gotowe motywy pasujące do klimatu „imprezowy” (decyzja Karola), z rejestru tweakcn albo shadcn. Każdy musi mieć wariant ciemny, żywy akcent i nie może być fioletowo-niebieskim gradientem „stylu AI” (`/10x-ui`, „Błędy, których należy odmawiać”).

**Contract**:
- Wartości kandydatów pobrane z rejestru (`npx shadcn@latest view <adres>` albo `curl` za zgodą).
- Każdy kandydat tymczasowo wpisany w `.dark` i `:root`, potem zrzut logowania.
- Karol wybiera jednego. Kandydaci nie trafiają do commita.

#### 2. Wartości w tokenach

**File**: `src/styles/global.css`

**Intent**: Wybrany motyw w istniejących nazwach zmiennych. `:root` dostaje wariant jasny tego samego motywu, `.dark` ciemny (C1, C2).

**Contract**:
- Role: `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `border`, `input`, `ring`, `radius`.
- Nad blokiem `:root` linia komentarza ze źródłem (nazwa, adres, data).
- `@theme inline` bez zmian (publikacja już jest). Bez czcionek, cieni, wykresów i sidebaru.
- Kontrasty: tekst co najmniej 4,5:1 (`foreground`/`background`, `card-foreground`/`card`, `primary-foreground`/`primary`, `muted-foreground`/`card`, `destructive`/`card`); `--ring` przy 50% na `--card` co najmniej 3:1.

#### 3. Plik z wartościami

**File**: `context/changes/ui-signin-contract/theme.md`

**Intent**: Wartości nie mogą żyć tylko w czacie: źródło, surowe wartości, mapowanie na role, tabela kontrastów, trzej kandydaci z decyzją Karola i nazwami zrzutów.

**Contract**: sekcje: Źródło, Kandydaci, Wybór, Wartości (`:root`, `.dark`), Kontrasty.

### Success Criteria:

#### Automated Verification:

- `theme.md` istnieje i zawiera źródło, surowe wartości i tabelę kontrastów; tekst ma co najmniej 4,5:1, a ramka fokusu (50%) na karcie co najmniej 3:1 (wyliczone jednorazowym skryptem)
- `global.css` ma linię ze źródłem palety; skan `/10x-ui` na plikach widoku nadal daje 0
- `npm run lint`, `npx astro check` i `npm run build` przechodzą

#### Manual Verification:

- Karol wybrał jednego z 3 kandydatów na zrzutach logowania (wybór zapisany w `theme.md`)
- Zrzut logowania w wybranej palecie (komputer i 390 px) wygląda dobrze według Karola

**Implementation Note**: Po fazie i zielonej bramce czekamy na potwierdzenie Karola, zanim przejdziemy dalej.

---

## Faza 4: Stany i błędy

### Overview

Zamykamy kanał błędów przez adres, włączamy działające ładowanie i blokadę, dopinamy fokus i hover. Budujemy lokalną stronę ze wszystkimi stanami jako bramkę wizualną.

### Changes Required:

#### 1. Mapa błędów

**File**: `src/lib/auth-errors.ts` (nowy)

**Intent**: Jedno miejsce „kod → polski komunikat” dla logowania i rejestracji. Do wyspy trafia tylko tekst z mapy (C4).

**Contract**: `export function authErrorMessage(code: string | null): string | null`. Brak kodu daje `null`, nieznany kod daje „Coś poszło nie tak. Spróbuj ponownie.”

| Kod | Komunikat |
|---|---|
| `missing_fields` | Podaj e-mail i hasło. |
| `invalid_credentials` | Nieprawidłowy e-mail lub hasło. |
| `email_not_confirmed` | Najpierw potwierdź adres e-mail. Link jest w wiadomości od nas. |
| `over_request_rate_limit`, `over_email_send_rate_limit` | Za dużo prób. Odczekaj chwilę i spróbuj ponownie. |
| `validation_failed`, `email_address_invalid` | Sprawdź adres e-mail i hasło. |
| `user_already_exists`, `email_exists` | Konto z tym adresem już istnieje. Zaloguj się. |
| `weak_password` | Hasło jest za słabe. Użyj co najmniej 6 znaków. |
| `signup_disabled` | Zakładanie kont jest wyłączone. |
| `config_missing`, `service_unavailable` | Serwer jest chwilowo niedostępny. Spróbuj za kilka minut. |

#### 2. API logowania i rejestracji

**File**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`

**Intent**: W adresie tylko kod, a puste pola są sprawdzane na serwerze przed wywołaniem Supabase. To ścieżka bez JS i przed hydratacją (C4).

**Contract**:
- Puste `email` lub `password` przekierowuje z `?error=missing_fields`.
- Brak konfiguracji daje `?error=config_missing`.
- Brak połączenia z Supabase (`AuthRetryableFetchError`, bez `code`) albo status 5xx daje `?error=service_unavailable`, np. uśpiony projekt.
- Pozostałe błędy Supabase dają `?error=<error.code ?? "unknown">` (kod zakodowany w URL).
- Każdy błąd Supabase trafia do logów Workera (`console.error`, widoczne w Workers Logs) z `name`, `status` i `code`, bez e-maila i hasła. Surowy komunikat znika z adresu, więc to jedyny ślad przy diagnozie.
- Sukces bez zmian (`/` i `/auth/confirm-email`). Prefiks `/auth/signin?error=` zostaje (smoke).

#### 3. Strony logowania i rejestracji

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro` (tylko frontmatter)

**Intent**: Strona tłumaczy kod przez mapę, więc tekst z adresu nigdy nie trafia na ekran (C4). Obudowa rejestracji bez zmian.

**Contract**: `serverError={authErrorMessage(Astro.url.searchParams.get("error"))}`.

#### 4. Ładowanie i blokada

**File**: `src/components/auth/SubmitButton.tsx`, `SignInForm.tsx`, `SignUpForm.tsx`

**Intent**: Zastąpić `useFormStatus`, który przy natywnym `action` się nie włącza, stanem ustawianym przez formularz. Przycisk pokazuje spinner i tekst ładowania i blokuje drugie wysłanie.

**Contract**:
- `SubmitButton` dostaje `pending: boolean` (obok `pendingText`, `icon`, `children`). Przy `pending` ma `disabled`, `Spinner` i `pendingText`.
- Formularze ustawiają `pending` w `onSubmit` po udanej walidacji i zerują go w `pageshow` z `persisted`.
- `useFormStatus` znika z `src/`.

#### 5. Strona ze wszystkimi stanami (kitchen sink)

**File**: `src/pages/dev/ui-kitchen-sink.astro` (nowy)

**Intent**: Jedna strona z kartą logowania we wszystkich stanach obok siebie, jako bramka wizualna (`/10x-ui`). Tylko lokalnie (decyzja Karola).

**Contract**:
- Trasa `/dev/ui-kitchen-sink`. Poza trybem deweloperskim zwraca 404 (`import.meta.env.DEV`).
- Stany budowane z tych samych klocków co logowanie, bez kopiowania stylów:
  - domyślny;
  - błędy pól;
  - błąd serwera;
  - ładowanie i blokada;
  - „pusty: nie dotyczy, widok nie ma listy ani pobieranych danych”.
- Hover i fokus sprawdzane interaktywnie na tej stronie.

#### 6. Zrzuty i macierz stanów

**File**: `context/changes/ui-signin-contract/screens/*.jpg`, `context/changes/ui-signin-contract/ui-checks.md` (nowy)

**Intent**: Dowód do przeglądu: zrzuty strony ze stanami (komputer i 390 px), fokusu z klawiatury i linku z obcym `?error=`, oraz macierz 7 stanów z wynikiem dla każdej komórki.

**Contract**:
- W `ui-checks.md` sekcja „Macierz stanów” z wierszem na stan (pokazany / nie dotyczy z powodem) i odnośnikiem do zrzutu.
- Sekcja „Krytyka zrzutów” (zadanie 3 lekcji): model z wizją ogląda zrzuty strony ze stanami i logowania (komputer i 390 px) i porównuje je z zarzutami C1–C5 oraz `change.md`. Każda uwaga jest poprawiona albo odłożona z powodem; po poprawkach nowe zrzuty.

### Success Criteria:

#### Automated Verification:

- Jednorazowy skrypt `node` sprawdza `authErrorMessage`: każdy kod z tabeli daje swój komunikat, nieznany kod daje komunikat ogólny, `null` daje `null`
- `POST` na `/api/auth/signin` z pustymi polami daje 302 na `/auth/signin?error=missing_fields`, a złe hasło daje `?error=invalid_credentials` (`node` + `fetch` na serwerze deweloperskim)
- `useFormStatus` nie występuje w `src/` (grep)
- `/dev/ui-kitchen-sink` daje 200 na serwerze deweloperskim i 404 w `npm run preview` (build produkcyjny)
- `npm run lint`, `npx astro check` i `npm run build` przechodzą
- `npm run smoke` na serwerze lokalnym przechodzi 8/8

#### Manual Verification:

- Strona ze stanami pokazuje każdy z 7 stanów albo „nie dotyczy” z powodem; zrzuty komputer i 390 px są w `screens/`, a każda uwaga z „Krytyki zrzutów” w `ui-checks.md` jest poprawiona albo odłożona z powodem
- Tab przechodzi przez wszystkie kontrolki z widocznym fokusem, a hover zmienia przycisk, link i oko (zrzut fokusu)
- Link z dowolnym `?error=` pokazuje komunikat ogólny zamiast tekstu z adresu (logowanie i rejestracja)
- Po kliknięciu „Zaloguj się” przycisk pokazuje „Logowanie…” i jest zablokowany do przeładowania, a po „Wstecz” znów jest aktywny

**Implementation Note**: Po fazie i zielonej bramce czekamy na potwierdzenie Karola, zanim przejdziemy dalej.

---

## Faza 5: Zabezpieczenie

### Overview

Kontrakt ma przetrwać sesję. Służą do tego reguła w `AGENTS.md`, skan literałów w `npm run lint` (a więc w CI) i sprawdzian świeżą sesją agenta.

### Changes Required:

#### 1. Reguła UI

**File**: `AGENTS.md`

**Intent**: Następny agent ma wiedzieć, gdzie są tokeny i klocki i czego nie wpisywać w widokach (`/10x-ui`, „Utrwal to”). Treść zatwierdza Karol.

**Contract**: nowa sekcja `## UI` po `## Conventions`, po angielsku (szkic do akceptacji):

```markdown
## UI

- Tokens live in `src/styles/global.css` (`:root`, `.dark`, published in `@theme inline`); the app always runs dark (`class="dark"` on `<html>`). A new colour is a new token, never a literal: no palette classes (`bg-purple-600`), hex/rgb/oklch or arbitrary values in views.
- Components live in `src/components/ui` (shadcn). Check that directory before writing a component; add missing ones with `npx shadcn@latest add <name>`.
- Sign-in states are shown at `/dev/ui-kitchen-sink` (dev only). `npm run lint` runs `scripts/ui-literals.mjs` on the cleaned views.
```

#### 2. Skan literałów

**File**: `scripts/ui-literals.mjs` (nowy), `package.json`

**Intent**: Automat zamiast pamięci agenta: wzorzec ze skilla `/10x-ui` na plikach oczyszczonych w tej zmianie, w lincie i CI, bez nowej zależności.

**Contract**:
- Pliki: `src/pages/auth/signin.astro`, `src/components/auth/*.tsx` i `src/pages/dev/ui-kitchen-sink.astro`.
- Przy trafieniu wypisuje `plik:linia: tekst` i kończy się kodem 1.
- `"lint": "eslint . && node scripts/ui-literals.mjs"`; `lint:fix` bez zmian.
- Wzorzec identyczny z sekcją „Skanowanie zakodowanych na stałe wartości” w `.claude/skills/10x-ui/SKILL.md`.

#### 3. Sprawdzian świeżą sesją

**File**: `context/changes/ui-signin-contract/ui-checks.md`

**Intent**: Sprawdzić, czy reguła działa (lekcja, zadanie 4). Świeża sesja `claude -p` w tymczasowym worktree dostaje drobną zmianę w logowaniu, np. tekst pomocy pod przyciskiem.

**Contract**:
- Kolejność: najpierw commit reguły `## UI` i skanu (kroki 1–2, po akceptacji Karola), dopiero potem worktree z tego commita. `git worktree add` bierze zacommitowany stan, więc bez tego świeża sesja nie zobaczyłaby reguły. Wynik sprawdzianu i liczby (krok 4) idą w drugim commicie fazy.
- Worktree bez `node_modules`: sesja ma tylko zmienić plik, a skan to czysty `node`. Gdyby jednak był w nim podpięty junction do `node_modules`, najpierw rozpinamy go nierekurencyjnie (`[IO.Directory]::Delete(p, $false)`), a dopiero potem usuwamy worktree. Inaczej skasujemy `node_modules` głównego projektu.
- W `ui-checks.md` zapisujemy: polecenie, czy agent użył tokenów i klocków, wynik skanu na jego zmianie i koszt sesji.
- Worktree zostaje usunięty. Zmiana agenta nie trafia do repo.

#### 4. Liczby przed i po

**File**: `context/changes/ui-signin-contract/ui-checks.md`

**Intent**: Wynik skanu przed zmianą i po niej, wymagany przez lekcję.

**Contract**: sekcja „Skan literałów” z listą plików skanu: przed 14 (13 na ekranie logowania według `change.md`, 2026-10-04, plus 1 w podpowiedzi hasła `SignUpForm.tsx`), po 0.

### Success Criteria:

#### Automated Verification:

- `npm run lint` uruchamia `scripts/ui-literals.mjs` i przechodzi; celowo dodany literał (`bg-purple-600`) w pliku widoku sprawia, że `npm run lint` zawodzi (sprawdzone i cofnięte)
- `AGENTS.md` zawiera sekcję `## UI` z tokenami, komponentami, zakazem literałów i stroną ze stanami
- `ui-checks.md` zawiera wynik skanu przed (14: 13 na ekranie logowania + 1 w `SignUpForm.tsx`) i po (0)
- `npm run lint`, `npx astro check` i `npm run build` przechodzą

#### Manual Verification:

- Karol zatwierdził treść sekcji `## UI` w `AGENTS.md`
- Świeża sesja `claude -p` przy drobnej zmianie w logowaniu użyła tokenów i klocków, a skan jej zmiany daje 0 (wynik w `ui-checks.md`, worktree usunięty)

**Implementation Note**: Po fazie czekamy na potwierdzenie Karola. Potem `/10x-impl-review ui-signin-contract`. Po poprawkach z przeglądu uruchamiamy zmieniony kod przed pushem (`lessons.md`, wpis 3). Następnie push za zgodą Karola, smoke na produkcji i sprawdzenie, że `/dev/ui-kitchen-sink` daje tam 404.

---

## Testing Strategy

### Unit Tests:

- Brak frameworka testów. Jednorazowy skrypt `node` (typy TypeScript usuwa sam Node 24) sprawdza `authErrorMessage` dla każdego kodu z tabeli, nieznanego kodu i `null`.

### Integration Tests:

- `npm run smoke` lokalnie w fazie 4 i na produkcji po pushu. Każde uruchomienie zakłada konto `smoke-…` w jedynym projekcie Supabase (AGENTS.md, Testing).
- `node` + `fetch` na serwerze deweloperskim: `POST` z pustymi polami i ze złym hasłem sprawdza kody w `Location`.

### Manual Testing Steps:

1. Otwórz `/auth/signin`. Karta, tło, napisy i paleta są z tokenów, po polsku, bez fioletowego „stylu AI”.
2. Wyślij pusty formularz. Przy polach pojawiają się polskie komunikaty, a fokus trafia na pierwsze błędne pole.
3. Wpisz złe hasło. Po przeładowaniu widać „Nieprawidłowy e-mail lub hasło.” w komunikacie z tokenem `destructive`.
4. Otwórz `/auth/signin?error=Twoje konto zostało zablokowane`. Widać komunikat ogólny, a nie ten tekst.
5. Kliknij „Zaloguj się” z poprawnymi danymi. Przycisk pokazuje „Logowanie…” i jest zablokowany. Wróć „Wstecz”: przycisk znów jest aktywny.
6. Przejdź Tabem przez pola, oko, przycisk i link. Fokus jest widoczny na każdej kontrolce.
7. Otwórz `/auth/signup`. Pola są nowe, formularz działa, a błąd z adresu też idzie przez mapę.
8. Zrób zrzuty `/dev/ui-kitchen-sink` z komputera i z 390 px. Każdy stan jest pokazany albo opisany jako „nie dotyczy”.

## Performance Considerations

Bez istotnego wpływu. Dochodzi paczka `radix-ui` (używana przez `label` i `separator`), a w wyspie logowania kilka małych komponentów. Rozmiar buildu zerkamy przy fazie 1.

## Migration Notes

Brak danych do migracji. Klasa `dark` na `<html>` zmienia tokeny na wszystkich stronach z `Layout.astro`. Ekrany startera mają własne tła (`bg-cosmic`), więc ich wygląd sprawdzamy zrzutami w fazie 1. Wyjątki: przycisk na `/dev/live-sync` (bierze `--primary`) i nieco ciemniejszy obrys fokusu (`outline-ring/50`). Wycofanie: `git revert` commitów faz, a każda faza jest osobnym commitem.

## References

- Research: `context/changes/ui-signin-contract/research.md` (zarzuty C1–C5, odroczone D1–D5, macierz stanów)
- Skill i checklista: `.claude/skills/10x-ui/SKILL.md`, `.claude/skills/10x-ui/references/ui-quality-checklist.md`
- PRD: `context/foundation/prd.md:82` (FR-001), `:187` (v1 po polsku)
- Roadmapa: `context/foundation/roadmap.md:46-50` (S-01, S-02, S-05)
- Lekcja M2L5: `https://platforma.przeprogramowani.pl/courses/10xdevs-4/pl/a86b21e0-4b87-493d-a0fa-49edc26d4c9d`
- Wzorzec planu z poprzedniej zmiany: `context/archive/2026-09-27-live-sync-spike/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Klocki i tryb ciemny

#### Automated

- [x] 1.1 `--dry-run` i `git diff --quiet -- src/components/ui/button.tsx src/styles/global.css` po dodaniu potwierdzają, że `button.tsx` i `global.css` są nietknięte — bb90b7f
- [x] 1.2 W `src/components/ui/` istnieją `field.tsx`, `input.tsx`, `input-group.tsx`, `label.tsx`, `card.tsx`, `alert.tsx`, `spinner.tsx`, `separator.tsx`, `textarea.tsx`, a `"use client"` nie występuje w `src/` (grep) — bb90b7f
- [x] 1.3 `npm run lint`, `npx astro check` i `npm run build` przechodzą — bb90b7f
- [x] 1.4 HTML `/auth/signin` z serwera deweloperskiego zaczyna się od `<html lang="pl" class="dark">` (sprawdzone `node` + `fetch`) — bb90b7f

#### Manual

- [x] 1.5 Zrzuty `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email` i `/dev/live-sync`, zrobione przed zmianą `Layout.astro` i po niej, wyglądają tak samo (tło i napisy czytelne); jedyna oczekiwana różnica to jasny przycisk „Zadzwoń” na `/dev/live-sync` — bb90b7f

### Phase 2: Logowanie na tokenach i klockach

#### Automated

- [x] 2.1 Skan `/10x-ui` na `src/pages/auth/signin.astro` i `src/components/auth/*.tsx` daje 0 trafień (przed zmianą 14: 13 na ekranie logowania i 1 w podpowiedzi hasła `SignUpForm.tsx`) — 77c380f
- [x] 2.2 `signin.astro` nie zawiera `bg-cosmic`, a pliki widoku nie importują już własnego `input`/`p` z kolorami (grep) — 77c380f
- [x] 2.3 `npm run lint`, `npx astro check` i `npm run build` przechodzą — 77c380f

#### Manual

- [x] 2.4 Zrzut logowania (komputer i 390 px): karta z tokenów, polskie napisy, wpisany tekst nie wchodzi pod ikonę oka — 77c380f
- [x] 2.5 Rejestracja renderuje nowe pola i da się wysłać formularz (zrzut), napisy angielskie zgodnie z decyzją — 77c380f

### Phase 3: Paleta gry

#### Automated

- [x] 3.1 `theme.md` istnieje i zawiera źródło, surowe wartości i tabelę kontrastów; tekst ma co najmniej 4,5:1, a ramka fokusu (50%) na karcie co najmniej 3:1 (wyliczone jednorazowym skryptem)
- [x] 3.2 `global.css` ma linię ze źródłem palety; skan `/10x-ui` na plikach widoku nadal daje 0
- [x] 3.3 `npm run lint`, `npx astro check` i `npm run build` przechodzą

#### Manual

- [x] 3.4 Karol wybrał jednego z 3 kandydatów na zrzutach logowania (wybór zapisany w `theme.md`)
- [x] 3.5 Zrzut logowania w wybranej palecie (komputer i 390 px) wygląda dobrze według Karola

### Phase 4: Stany i błędy

#### Automated

- [ ] 4.1 Jednorazowy skrypt `node` sprawdza `authErrorMessage`: każdy kod z tabeli daje swój komunikat, nieznany kod daje komunikat ogólny, `null` daje `null`
- [ ] 4.2 `POST` na `/api/auth/signin` z pustymi polami daje 302 na `/auth/signin?error=missing_fields`, a złe hasło daje `?error=invalid_credentials` (`node` + `fetch` na serwerze deweloperskim)
- [ ] 4.3 `useFormStatus` nie występuje w `src/` (grep)
- [ ] 4.4 `/dev/ui-kitchen-sink` daje 200 na serwerze deweloperskim i 404 w `npm run preview` (build produkcyjny)
- [ ] 4.5 `npm run lint`, `npx astro check` i `npm run build` przechodzą
- [ ] 4.6 `npm run smoke` na serwerze lokalnym przechodzi 8/8

#### Manual

- [ ] 4.7 Strona ze stanami pokazuje każdy z 7 stanów albo „nie dotyczy” z powodem; zrzuty komputer i 390 px są w `screens/`, a każda uwaga z „Krytyki zrzutów” w `ui-checks.md` jest poprawiona albo odłożona z powodem
- [ ] 4.8 Tab przechodzi przez wszystkie kontrolki z widocznym fokusem, a hover zmienia przycisk, link i oko (zrzut fokusu)
- [ ] 4.9 Link z dowolnym `?error=` pokazuje komunikat ogólny zamiast tekstu z adresu (logowanie i rejestracja)
- [ ] 4.10 Po kliknięciu „Zaloguj się” przycisk pokazuje „Logowanie…” i jest zablokowany do przeładowania, a po „Wstecz” znów jest aktywny

### Phase 5: Zabezpieczenie

#### Automated

- [ ] 5.1 `npm run lint` uruchamia `scripts/ui-literals.mjs` i przechodzi; celowo dodany literał (`bg-purple-600`) w pliku widoku sprawia, że `npm run lint` zawodzi (sprawdzone i cofnięte)
- [ ] 5.2 `AGENTS.md` zawiera sekcję `## UI` z tokenami, komponentami, zakazem literałów i stroną ze stanami
- [ ] 5.3 `ui-checks.md` zawiera wynik skanu przed (14: 13 na ekranie logowania + 1 w `SignUpForm.tsx`) i po (0)
- [ ] 5.4 `npm run lint`, `npx astro check` i `npm run build` przechodzą

#### Manual

- [ ] 5.5 Karol zatwierdził treść sekcji `## UI` w `AGENTS.md`
- [ ] 5.6 Świeża sesja `claude -p` przy drobnej zmianie w logowaniu użyła tokenów i klocków, a skan jej zmiany daje 0 (wynik w `ui-checks.md`, worktree usunięty)
