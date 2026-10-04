---
date: 2026-10-04T14:30:52+02:00
researcher: Claude Code (claude-opus-5-5) z Karolem
git_commit: 2442ccf
branch: main
repository: CharlesOnTheWave/most-likely-to
topic: "Audyt UI ekranu logowania /auth/signin pod kontrakt tokenów i komponentów (/10x-ui, M2L5)"
tags: [research, codebase, ui, 10x-ui, tokens, shadcn, auth, signin, a11y]
status: complete
last_updated: 2026-10-04
last_updated_by: Claude Code (claude-opus-5-5)
---

# Research: audyt UI ekranu logowania `/auth/signin`

**Date**: 2026-10-04T14:30:52+02:00
**Researcher**: Claude Code (claude-opus-5-5) z Karolem
**Git Commit**: 2442ccf (drzewo robocze: niezacommitowany folder `context/changes/ui-signin-contract/`)
**Branch**: main
**Repository**: CharlesOnTheWave/most-likely-to

## Research Question

Dwukierunkowy audyt jednego widoku, `/auth/signin`, według `/10x-ui`:

1. Źródło → widoki: gdzie leżą wartości i komponenty i które widoki je czytają.
2. Widok → źródło: który token albo komponent powinien pokryć każdy literał w widoku.

Do tego przypadkowa architektura (wejście wylogowanym i zalogowanym, prosto z linku, przed hydratacją, język), macierz 7 stanów i reguły agenta. Wynik: 3–5 zarzutów z plikiem, linią i jednym zdaniem o wpływie na hosta. Bez zmian w kodzie.

Metoda: przed-audyt i skan `/10x-ui` lokalnie; dwóch równoległych pracowników tylko do odczytu (wejścia, API i język; macierz stanów i dostępność); rejestr shadcn przez `npx shadcn@latest search` (CLI 4.21.1, bez zmian w plikach); oględziny produkcji w przeglądarce 2026-10-04 (`/auth/signin`, wstrzyknięty `?error=`, fokus z klawiatury). Kotwice rozstrzygające sprawdziłem osobno: `src/middleware.ts:4-24`, `src/pages/api/auth/signin.ts:5-19`, `context/foundation/prd.md:82,159,187`, `src/components/ui/button.tsx:8,12`, `src/layouts/Layout.astro:22-35`, fragment `react-dom-client.development.js` 20756-20795 (react-dom 19.3.0).

## Summary

- **Wariant kontraktu: świeży starter z martwym plikiem tokenów.** `src/styles/global.css` ma kompletne `:root`, `.dark` i `@theme inline` (`:6-111`). W plikach widoku jest jednak 0 linii z klasami semantycznymi i 13 linii z klasami palety (skan z 2026-10-04). W sprawdzonych plikach `.astro`/`.tsx` w `src/` jedyny plik z klasami semantycznymi to `src/components/ui/button.tsx` (7 linii).
- **Ekran wygląda na ciemny tylko dzięki literałom** (`bg-cosmic` z kolorami hex, `text-white`). `body` dostaje jasne tokeny (`global.css:121-123`), a w sprawdzonym `src/` nic nie włącza klasy `.dark`. Skutek widać już dziś: słaba ramka fokusu, bo szary `--ring` pochodzi z jasnego motywu.
- **Formularz ma własne klocki** (`FormField`, `ServerError`, karta z `div`) zamiast shadcn `Field`/`Input`/`Label`/`InputGroup`/`Alert`/`Card`, które są w rejestrze. Własne pole nie łączy komunikatu błędu z polem dla czytników ekranu.
- **Komunikat błędu bierze się z adresu (`?error=`)**, bez listy dozwolonych tekstów (potwierdzone na produkcji), a API wkłada tam surowe angielskie komunikaty Supabase. Cały ekran jest po angielsku, choć v1 ma być po polsku (`prd.md:187`).
- **Macierz stanów:** „ładowanie” i „zablokowany” są w kodzie, ale w sprawdzonej ścieżce (react-dom 19.3.0, formularz z `action` jako adresem) się nie włączają, więc formularz da się wysłać ponownie w trakcie logowania. Stan „pusty” tego widoku nie dotyczy.
- **Odroczone:** logowanie hasłem jest sprzeczne z FR-001 (`prd.md:82`) i należy do S-05 (zablokowane). Pierwszy ekran zbudowany w projekcie (F-01, `/dev/live-sync`) skopiował literały startera (13 linii), czyli dryf opisany w lekcji już się zaczął.

## Charges

| # | Kategoria | Główne miejsca | Wpływ na hosta |
|---|---|---|---|
| C1 | Brakujące tokeny | `SubmitButton.tsx:18`, `signin.astro:9-11`, `FormField.tsx:6,53`, `ServerError.tsx:11` | wygląd „szablonu AI”; każdy nowy ekran kopiuje fiolet i granat |
| C2 | Brakujące tokeny | `global.css:8,25,121-123`, `Layout.astro:14`, `signin.astro:9-10` | ledwo widoczny fokus; po podpięciu tokenów ekran zrobi się biały |
| C3 | Brakujący współdzielony komponent | `FormField.tsx:35-67`, `ServerError.tsx:10-15`, `signin.astro:10` | czytnik ekranu nie wiąże błędu z polem; S-01 skopiuje własne pole |
| C4 | Przypadkowa architektura | `signin.astro:5,14`, `ServerError.tsx:13`, `api/auth/signin.ts:11,16` | fałszywy komunikat z cudzego linku na prawdziwej stronie; surowe angielskie błędy |
| C5 | Przypadkowa architektura | `Layout.astro:14`, `signin.astro:8,12,16,18`, `SignInForm.tsx:21-83` | angielski formularz w polskiej grze |

### C1 · Brakujące tokeny: ekran nie czyta ani jednego tokenu

- **Dowód (widok → źródło):**
  - `src/components/auth/SubmitButton.tsx:18`: przycisk shadcn (`:3`, `:15`) przemalowany na `bg-purple-600 … hover:bg-purple-500`. Przy łączeniu klas `cn` (paczka `cn` 0.4.0, zachowanie tailwind-merge) wyrzuca przez to `bg-primary text-primary-foreground hover:bg-primary/90` z `button.tsx:12` (pracownik sprawdził to, uruchamiając `cn` w node). Powinien zostać domyślny wariant `Button` (`--primary`, `--primary-foreground`).
  - `src/pages/auth/signin.astro:11`: nagłówek z gradientem `from-blue-200 to-purple-200`. Pokrycie: `text-foreground`.
  - `signin.astro:10`: karta `border-white/10 bg-white/10 text-white backdrop-blur-xl`. Pokrycie: `Card` (`--card`, `--card-foreground`, `--border`).
  - `signin.astro:15`, `:17`: opis `text-blue-100/60`, link `text-purple-300`. Pokrycie: `text-muted-foreground`, `text-primary`.
  - `FormField.tsx:6`, `:37`, `:41`, `:53`, `:59`: pole `bg-white/10 text-white placeholder-white/40`, etykieta `text-blue-100/80`, ikona `text-white/40`, ramka i fokus `border-white/20 focus:ring-purple-400` albo `border-red-400/60 focus:ring-red-400`, komunikat `text-red-300`. Pokrycie: `--input`, `--border`, `--ring`, `--muted-foreground`, `--destructive`.
  - `ServerError.tsx:11`: `border-red-500/30 bg-red-900/30 text-red-300`. Pokrycie: `--destructive` (np. `Alert` w wariancie `destructive`).
  - `PasswordToggle.tsx:13`: `text-white/40 hover:text-white/70`. Pokrycie: `text-muted-foreground hover:text-foreground`.
  - `signin.astro:9`: tło `bg-cosmic`, czyli `linear-gradient(to bottom, #0a0e1a, #0f1529, #0a0e1a)` z `global.css:113-115`, poza systemem tokenów. Pokrycie: `bg-background`.
- **Źródło → widoki:** tabela w sekcji „Źródło → widoki”: w każdym z 6 sprawdzonych widoków 0 linii z klasami semantycznymi.
- **Wpływ:** zmiana wyglądu gry wymaga przemalowania każdego pliku z osobna. Nowe ekrany (lobby S-01, runda S-02) skopiują fiolet z granatem, tak jak zrobiło już `/dev/live-sync` z F-01. Host dostaje wygląd domyślnego szablonu AI zamiast wyglądu gry.

### C2 · Brakujące tokeny: ciemny wygląd bez ciemnego motywu

- **Dowód:**
  - `body` ma `bg-background text-foreground` (`global.css:121-123`), czyli jasne wartości z `:root` (`--background: oklch(1 0 0)`, `global.css:8`).
  - `.dark` (`global.css:41-73`) nie jest włączany. Na `<html>` nie ma klasy `dark` (`Layout.astro:14`), a w `src/` nie ma `classList.add/toggle("dark")` ani `prefers-color-scheme` (grep 2026-10-04). Na produkcji `document.documentElement.className` jest pusty (sprawdzenie w przeglądarce 2026-10-04).
  - Ciemność dają tylko `bg-cosmic` (`signin.astro:9`) i `text-white` (`signin.astro:10`).
  - Fokus przycisku to `focus-visible:ring-ring/50 focus-visible:ring-[3px]` (`button.tsx:8`) z jasnym `--ring: oklch(0.708 0 0)` (`global.css:25`). Na produkcji wyliczony styl to `oklab(0.708 0 0 / 0.5) 0 0 0 3px`, widoczny jako szara, półprzezroczysta obwódka na ciemnej karcie (zrzut 2026-10-04). Pracownik oszacował kontrast na około 2,4:1 przy progu 3:1; to wyliczenie, nie pomiar. Przełącznik hasła i link dostają domyślny obrys przeglądarki przebarwiony przez `outline-ring/50` (`global.css:119`).
- **Wpływ:** host, który przechodzi formularz klawiaturą, ledwo widzi, gdzie jest fokus. Podpięcie widoku pod tokeny bez decyzji o motywie zamieni ciemny ekran na biały.
- **Kierunek naprawy:** decyzja „ciemny czy jasny” przed fazą wartości. Przy ciemnym: klasa `.dark` na `<html>` albo ciemne wartości w `:root`, a `--ring` dobrany pod tło.

### C3 · Brakujący współdzielony komponent: własne klocki formularza

- **Dowód:**
  - `FormField.tsx:35-67`: własne pole (etykieta, ikona, `input`, komunikat) zamiast shadcn `Field` z `Label` i `Input` (plus `InputGroup` na ikonę i przycisk oka). Pole nie ma `aria-invalid` ani `aria-describedby` (`:42-55`), a komunikat błędu nie ma `id` ani roli (`:58-62`).
  - `ServerError.tsx:10-15`: własny `<p>` zamiast `Alert`, bez `role="alert"` (`:11`).
  - `signin.astro:10`: karta jako `div` z klasami zamiast `Card`.
  - `PasswordToggle.tsx:13,16`: ikona 16 px leży nad polem, które ma z prawej tylko `px-3` (`FormField.tsx:6`), więc wpisany tekst wchodzi pod ikonę. Obszar kliknięcia jest mniejszy niż 24 px (WCAG 2.5.8; ocena pracownika).
  - Rejestr shadcn (CLI 4.21.1, `npx shadcn@latest search @shadcn`, 2026-10-04) ma pozycje typu `ui`: `field` (zależności rejestru: `label`, `separator`; paczka npm: `cn`), `input`, `input-group`, `label`, `card`, `alert`, `spinner`, `empty`.
- **Wpływ:** host z czytnikiem ekranu nie dowie się, które pole jest źle wypełnione. Przy `noValidate` (`SignInForm.tsx:43`) komunikaty pojawiają się bez ogłoszenia i bez przeniesienia fokusu (`:36-40`). Pole na nick gościa w S-01 powstałoby jako kopia `FormField`.
- **Uwaga do zakresu:** `FormField`, `SubmitButton`, `ServerError` i `PasswordToggle` używa też `SignUpForm` (`/auth/signup`). Naprawa komponentów wspólnych poprawi oba formularze.

### C4 · Przypadkowa architektura: komunikat błędu z adresu, surowy i po angielsku

- **Dowód:**
  - Ścieżka: `signin.astro:5` (`searchParams.get("error")`) → `:14` → `SignInForm.tsx:80` → `ServerError.tsx:8,13`. Nie ma listy dozwolonych komunikatów, limitu długości ani mapy kodów. Grep `error.message|error.code|i18n|translate|locale` w `src/` (pracownik) daje tylko `api/auth/signin.ts:16` i `api/auth/signup.ts:16`.
  - Na produkcji adres `/auth/signin?error=Test audytu: ten komunikat pochodzi z adresu strony` pokazał ten tekst w czerwonej ramce, jak prawdziwy błąd (2026-10-04). React wstawia go jako tekst, więc to podmiana treści, nie XSS.
  - `api/auth/signin.ts:16` wkłada do adresu surowe `error.message` z Supabase, a `:11` angielskie „Supabase is not configured”. Serwer nie sprawdza pustych pól (`:5-7`, `:13`). Bez JS albo przed hydratacją (`noValidate`, `SignInForm.tsx:43`) host dostaje więc surowy komunikat Supabase zamiast walidacji z formularza.
  - Ten sam wzór: `signup.astro:5,14` i `api/auth/signup.ts:16`.
- **Wpływ:** ktoś może wysłać hostowi link z fałszywym ostrzeżeniem (np. „konto zablokowane, napisz do…”), które wyświetli się na naszej prawdziwej stronie logowania. Host widzi też angielskie komunikaty w polskiej grze.
- **Kierunek naprawy:** w adresie tylko kod (np. `?error=invalid_credentials`), na stronie mapa „kod → polski komunikat”, a nieznany kod daje komunikat ogólny.

### C5 · Przypadkowa architektura: ekran po angielsku w polskiej grze

- **Dowód:** `Layout.astro:14` (`lang="en"`); `signin.astro:8,12,16,18`; `SignInForm.tsx:21,23,26,47,53,60,67,82,83`; `PasswordToggle.tsx:14`. PRD: „Bez wersji angielskiej w v1 — gra i baza pytań są po polsku” (`prd.md:187`). Roadmapa odnotowuje angielskie ekrany startera (`roadmap.md:75`).
- **Wpływ:** host widzi angielski formularz w polskiej grze, a przy `lang="en"` czytnik ekranu przeczyta polski tekst angielską wymową.
- **Uwaga:** `lang` i domyślny tytuł (`Layout.astro:10,14`) są wspólne dla stron korzystających z `Layout.astro`, więc zmiana na `pl` obejmie je wszystkie.

### Odroczone (deferred)

- **D1 · Logowanie hasłem a FR-001.** FR-001 mówi, że host loguje się jednym kliknięciem przez zewnętrznego dostawcę, bez rejestracji i hasła (`prd.md:82`, też `:159`). Dziś jest e-mail z hasłem i link do rejestracji (`signin.astro:15-20`). To zakres S-05 (`roadmap.md:50`, status `blocked`). **Powód:** zmiana sposobu logowania to osobny slice. W tej zmianie nie inwestujemy w elementy specyficzne dla hasła ponad to, czego wymaga macierz stanów.
- **D2 · Wejście zalogowanego i strona po zalogowaniu.** Middleware chroni tylko `/dashboard` (`middleware.ts:4,18-22`), więc zalogowany host też dostaje formularz logowania. Po zalogowaniu `redirect("/")` (`api/auth/signin.ts:19`) prowadzi na stronę startera z przyciskami „Sign In” i „Sign Up” (`Welcome.astro:29-40`). **Powód:** inny widok; stronę główną hosta zbuduje S-01.
- **D3 · `Banner.astro:28-40`:** 9 kolorów hex w `<style>`. Baner renderuje się tylko dla elementów `missingConfigs` (`Layout.astro:22-35`). **Powód:** poza widokiem.
- **D4 · Pozostałe widoki startera** (`signup`, `confirm-email`, `dashboard`, strona główna, `/dev/live-sync`) mają te same literały i `bg-cosmic` (tabela niżej). **Powód:** zasada „jeden widok i globalne tokeny”. Skorzystają z globalnych tokenów i poprawionych komponentów wspólnych, resztę porządkują osobne zmiany.
- **D5 · Tekst wpisany przed hydratacją może zniknąć.** To wniosek pracownika z kodu react-dom, nieodtworzony. **Powód:** niepotwierdzone; do sprawdzenia przy bramce wizualnej.

## Macierz 7 stanów (stan na 2026-10-04)

| Stan | Dziś | Dowód |
|---|---|---|
| default | zbudowany z literałów, 0 tokenów | C1 |
| hover | literały: przycisk `hover:bg-purple-500` (`SubmitButton.tsx:18`), oko `hover:text-white/70` (`PasswordToggle.tsx:13`), link `hover:underline` (`signin.astro:17`); pola bez hover | pracownik |
| focus-visible | pola: `focus:ring-2` z `focus:ring-purple-400` albo `red-400` (`FormField.tsx:6,53`); oko i link: domyślny obrys przebarwiony przez `outline-ring/50` (`global.css:119`); przycisk: `ring-ring/50` 3 px (`button.tsx:8`), słaby na ciemnej karcie (C2). `outline-none` (`FormField.tsx:6`, `button.tsx:8`) to w Tailwind 4.3.3 samo `outline-style: none`, więc w trybie wysokiego kontrastu Windows wskaźnik fokusu znika; `outline-hidden` by go zostawił | pracownik, zrzut |
| disabled | w sprawdzonej ścieżce się nie włącza. `useFormStatus()` (`SubmitButton.tsx:12`) czyta stan formularza, który react-dom 19.3.0 ustawia tylko dla `action` będącego funkcją (`react-dom-client.development.js` ok. 20777-20793; build produkcyjny ok. 13600-13662 według pracownika), a formularz ma `action="/api/auth/signin"` (`SignInForm.tsx:43`). Gdyby się włączył: `disabled:pointer-events-none disabled:opacity-50` (`button.tsx:8`) | pracownik, fragment źródła sprawdzony |
| error | pola: komunikat pod polem, czerwień jako literał, bez `aria-invalid` i `aria-describedby` (`FormField.tsx:42-62`); serwer: `ServerError` bez roli, tekst z adresu (C4) | C3, C4 |
| empty | nie dotyczy: widok nie ma listy ani pobieranych danych; bez `serverError` nic się nie renderuje (`ServerError.tsx:8`); puste pola to przypadek „error” (`SignInForm.tsx:20-27`) | pracownik |
| loading | spinner „Signing in...” (`SubmitButton.tsx:20-24`) w sprawdzonej ścieżce się nie pokazuje (jak wyżej). Przycisk zostaje aktywny, więc drugie kliknięcie albo Enter wysyła kolejny POST; czy `signInWithPassword` (`api/auth/signin.ts:13`) wykona się dwa razy, zależy od czasu. Pojawiający się komunikat pola przesuwa układ o linię (`FormField.tsx:58-65`) | pracownik |

## Źródło → widoki (skan `/10x-ui`, 2026-10-04)

| Widok (pliki) | Linie z literałami | Linie z klasami semantycznymi | Importy z `src/components/ui` | `bg-cosmic` |
|---|---|---|---|---|
| `/auth/signin` (strona i 5 komponentów auth) | 13 | 0 | 1 (`Button` w `SubmitButton.tsx:3`) | 1 |
| `/auth/signup` (strona, `SignUpForm` i 4 wspólne komponenty) | 14 | 0 | 1 | 1 |
| `/auth/confirm-email` | 4 | 0 | 0 | 1 |
| `/dashboard` | 6 | 0 | 0 | 1 |
| `/` (`index`, `Welcome`, `Topbar`) | 27 | 0 | 0 | 1 |
| `/dev/live-sync` (strona i `LiveSyncDemo`) | 13 | 0 | 1 | 1 |

Liczone `grep -cE` po liniach: wzorzec skanu z `/10x-ui`; klasy semantyczne to prefiksy `bg|text|border|ring|outline` z nazwami tokenów shadcn. `Layout.astro` daje 0 trafień, `Banner.astro` 9 (D3).

## Kontrakt: źródła wartości i komponentów

- **Wartości:** `src/styles/global.css`: `:root` (`:6-39`), `.dark` (`:41-73`), `@theme inline` (`:75-111`, publikuje kolory shadcn i promienie), `@utility bg-cosmic` (`:113-115`), warstwa base (`:117-124`). Paleta to shadcn `neutral` (`components.json`: `style: new-york`, `baseColor: neutral`, `css: src/styles/global.css`).
- **Komponenty:** `src/components/ui/button.tsx` (shadcn) i `LibBadge.astro` (odznaka startera, nie shadcn). Dodawanie: `npx shadcn@latest add <name>` (`AGENTS.md:27`). CLI zapisuje pliki i może uruchomić `npm install` (kontekst w `lessons.md:8`).
- W repo nie ma drugiej palety ani drugiego `shadcn init`.

## Reguły agenta

- `AGENTS.md`: jedyna reguła UI dotyczy dodawania komponentów przez CLI shadcn i `cn` z paczki `cn` (`AGENTS.md:27`). Nie ma reguły zachęcającej do wartości jednorazowych ani reguły o tokenach (grep `AGENTS.md` i `CLAUDE.md`, 2026-10-04).
- `CLAUDE.md`: import `@AGENTS.md` (`:1`) i blok 10x-cli (`:3-14`), który CLI nadpisuje przy każdej paczce. Reguła UI musi więc trafić do `AGENTS.md`.
- Plików `.cursor/rules`, `.windsurfrules` ani `.github/copilot-instructions.md` w repo nie ma.

## Code References

- `src/styles/global.css:6-124`: tokeny, `bg-cosmic`, warstwa base
- `src/pages/auth/signin.astro:5-20`: `?error=`, tło, karta, nagłówek, link
- `src/components/auth/SignInForm.tsx:18-43`, `:80-84`: walidacja, natywny formularz, `ServerError`, `SubmitButton`
- `src/components/auth/FormField.tsx:5-67`: własne pole
- `src/components/auth/SubmitButton.tsx:12-31`: `useFormStatus`, przemalowany `Button`
- `src/components/auth/ServerError.tsx:7-15`: komunikat z adresu
- `src/components/auth/PasswordToggle.tsx:10-17`: przełącznik hasła
- `src/components/ui/button.tsx:8-12`: klasy bazowe, fokus i wariant domyślny shadcn
- `src/layouts/Layout.astro:10,14,22-35`: domyślny tytuł, `lang`, baner konfiguracji
- `src/middleware.ts:4-24`: ochrona tylko `/dashboard`
- `src/pages/api/auth/signin.ts:5-19`: brak walidacji, `?error=`, przekierowanie na `/`
- `context/foundation/prd.md:82,159,187`: FR-001, host bez hasła, v1 po polsku

## Architecture Insights

- Formularze auth to natywne `POST` z przekierowaniem. React dokłada tylko walidację po stronie klienta i przełącznik hasła, więc stany oparte na React Actions (`useFormStatus`) do tego wzorca nie pasują.
- Błędy idą z serwera na stronę przez adres (`?error=`); signin i signup mają ten sam wzorzec.
- Komponenty auth są wspólne dla dwóch widoków, więc to naturalne miejsce na naprawę kontraktu.
- Ekrany startera i ekran z F-01 mają ten sam „ciemny wygląd z literałów”, a tokeny ciemnego motywu leżą nieużywane.

## Historical Context (from prior changes)

- `context/foundation/roadmap.md:75`: „są tylko ekrany startera (`index`, `dashboard`, `auth/*`), po angielsku (`src/layouts/Layout.astro:14`), bez ekranów gry”. Nadal zgodne (2026-10-04).
- `context/archive/2026-09-27-live-sync-spike/research.md:161`: „w `src/components/ui/` jest tylko `button.tsx`”. Zgodne dla komponentów shadcn; w katalogu leży też `LibBadge.astro` ze startera.
- `context/archive/2026-09-27-live-sync-spike/research.md:162`: „UI po angielsku (`Layout.astro:14`, `SignInForm.tsx:21`)”. Zgodne.
- F-01 dodało `/dev/live-sync` (`src/pages/dev/live-sync.astro`, `src/components/live-sync/LiveSyncDemo.tsx`) z `bg-cosmic` i 13 liniami literałów (tabela wyżej). To przykład dryfu: nowy ekran przejął styl startera.

## Related Research

- `context/archive/2026-09-27-live-sync-spike/research.md`, sekcja 5 „Wyspy React i wzorce UI”.

## Open Questions (decyzje do `/10x-plan`)

1. Motyw: ciemny czy jasny. Przy ciemnym: klasa `.dark` na `<html>` czy ciemne wartości w `:root` (C2)?
2. Źródło wartości motywu: generator motywów shadcn czy preset z tweakcn. Mapowanie na istniejące nazwy (`primary`, `background`, `card`, `border`, `input`, `muted`, `destructive`, `ring`, `radius`); surowe wartości i ich źródło trafiają do folderu zmiany.
3. Co z `bg-cosmic`: usunąć na rzecz `bg-background` czy zostawić gradient jako token?
4. Zakres komponentów wspólnych: przebudowa `FormField`, `SubmitButton`, `ServerError` i `PasswordToggle` na shadcn (zmienia też `/auth/signup`) czy nowe pola tylko w `SignInForm`?
5. Polskie napisy i mapa błędów (C4, C5) w tej zmianie czy osobno? `lang="pl"` zmienia wszystkie strony korzystające z `Layout.astro`.
6. Jak włączyć stan ładowania i blokady przy natywnym formularzu (np. stan ustawiany w `onSubmit` zamiast `useFormStatus`)?
7. Kitchen sink tylko lokalnie czy też na produkcji?
8. Skan literałów w `npm run lint` (skrypt bez nowej zależności): na których plikach?
