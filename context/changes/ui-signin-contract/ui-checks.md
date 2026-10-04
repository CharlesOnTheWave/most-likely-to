# Sprawdzenia UI (fazy 4–5)

> Stan na 2026-10-04: faza 4 zakończona (bramki automatyczne i ręczne zielone). Dalej faza 5.

## Macierz stanów

Strona: `/dev/ui-kitchen-sink` (tylko `npm run dev`). Karty zbudowane z tych samych klocków co `/auth/signin` (`SignInCard.astro` + `SignInForm` z propem `preview`).

Zrzuty po krytyce i poprawkach mają przedrostek `p4k-`. Zrzuty `p4-*` to stan sprzed krytyki, na których oparta jest sekcja „Krytyka zrzutów”.

| Stan | Wynik | Gdzie widać | Zrzut |
|---|---|---|---|
| default | pokazany | karta 1 | `screens/p4k-states-desktop.png`, `screens/p4k-states-390.png`, `screens/p4k-signin-desktop.png`, `screens/p4k-signin-390.png` |
| hover | pokazany: link jaśnieje (`hover:text-foreground`), oko dostaje tło `accent`, nad przyciskami i okiem kursor „rączka”; tło przycisku zmienia się ledwo widocznie (K1, odłożone do S-01) | karta 1 i `/auth/signin` | `screens/p4k-hover-0-none.png`, `p4k-hover-link.png`, `p4k-hover-eye.png`, `p4k-hover-button.png` |
| focus-visible | pokazany (Tab): pole e-mail, pole hasła, oko, przycisk i link mają tę samą szarą ramkę z `--ring` | `/auth/signin` | `screens/p4k-focus-1-email.png` … `p4k-focus-5-link.png` |
| disabled | pokazany: przycisk zablokowany w trakcie wysyłania (pola zostają aktywne, bo zablokowane pola nie trafiłyby do formularza) | karta 4 | `screens/p4k-states-desktop.png`, `screens/p4k-states-390.png` |
| error | pokazany: błędy pól (karta 2: czerwona etykieta, obramowanie i tekst pod polem, wpisana wartość w zwykłym kolorze, `aria-invalid` i `aria-describedby`) i błąd serwera (karta 3: `Alert` `destructive` z tekstem z mapy `authErrorMessage`) | karty 2 i 3 | `screens/p4k-states-desktop.png`, `screens/p4k-states-390.png`, `screens/p4k-signin-390.png` (prawa ramka) |
| empty | nie dotyczy: widok nie ma listy ani pobieranych danych; puste pola po wysłaniu to stan error, a bez komunikatu serwera nic dodatkowego się nie renderuje | karta 5 (opis) | `screens/p4k-states-desktop.png`, `screens/p4k-states-390.png` |
| loading | pokazany: spinner i „Logowanie…” na zablokowanym przycisku; szerokość i wysokość przycisku bez zmian | karta 4 | `screens/p4k-states-desktop.png`, `screens/p4k-states-390.png` |

Link z obcym `?error=`: `screens/p4-foreign-error-signin.jpg` i `p4-foreign-error-signup.jpg` (komunikat ogólny zamiast tekstu z adresu).

Jak zrobione: zrzuty `p4-*` w Chrome Karola (390 px w ramce iframe na karcie localhost). Zrzuty `p4k-*` w osobnym, niewidocznym Chrome (`--headless=new`, osobny profil bez rozszerzeń, skala 2×). Fokus i hover przez protokół DevTools: prawdziwe naciśnięcia Tab i ruch myszy, bez wpisywania czegokolwiek w pola. Headless na Windows nie zwęża okna do 390 px, dlatego 390 px to ramki iframe na stronie-opakowaniu. Pasek narzędzi Astro na dole niektórych zrzutów to tylko tryb deweloperski.

## Sprawdzenia automatyczne

- 4.1 `authErrorMessage` i `authErrorCode`: 26 asercji przeszło (13 kodów z tabeli, 6 nieznanych, w tym `__proto__` i `toString`, `null`, 6 przypadków błędów Supabase z `AuthRetryableFetchError` i 5xx). Skrypt jednorazowy w scratchpadzie sesji.
- 4.2 na serwerze deweloperskim: pusty formularz daje `302 /auth/signin?error=missing_fields` (też bez samego hasła i na `/api/auth/signup`), złe hasło daje `302 /auth/signin?error=invalid_credentials`. W logu serwera: `sign-in failed: { name: 'AuthApiError', status: 400, code: 'invalid_credentials' }`, bez e-maila i hasła.
- 4.3 `useFormStatus` w `src/`: 0 trafień.
- 4.4 `/dev/ui-kitchen-sink`: 200 na serwerze deweloperskim, 404 w `npm run preview` (build produkcyjny). Na podglądzie `/auth/signin` daje 200, a obcy `?error=` daje komunikat ogólny.
- 4.5 `npm run lint`, `npx astro check` (0 błędów, 0 ostrzeżeń) i `npm run build` przechodzą (po poprawkach z krytyki uruchomione ponownie).
- 4.6 `npm run smoke` na serwerze deweloperskim: 8/8 (założyło jedno konto `smoke-…` w Supabase).
- 4.9 przez `fetch`: `/auth/signin?error=Twoje konto zostało zablokowane` i to samo na `/auth/signup` pokazują „Coś poszło nie tak. Spróbuj ponownie.”, a obcego tekstu w HTML nie ma; `?error=invalid_credentials` daje polski komunikat na obu stronach.
- Poprawki z krytyki sprawdzone w przeglądarce przez `getComputedStyle`: `cursor: pointer` na przycisku i oku, `color-scheme: dark` na `<html>`, link `text-decoration: underline`, opis alertu w pełnym `--destructive`, opis karty `text-wrap: balance`.

## Krytyka zrzutów

Recenzent: świeży pomocnik (osobny agent z wizją, nie pisał kodu, tylko odczyt). Obejrzał wszystkie zrzuty `p4-*` i `p0-signin-before-desktop.jpg` na tle C1–C5 (`research.md`), `change.md` i `theme.md`. Liczby sprawdzone potem osobnym skryptem kontrastu (OKLCH → sRGB, przezroczystość mieszana jak w przeglądarce); wszystkie się zgadzają. Decyzje: Karol przyjął wszystkie rekomendacje.

Werdykt C1–C5: na ekranie logowania nie widać już żadnego z zarzutów. Zostaje angielska rejestracja (C5), świadomie odłożona do S-05.

| Uwaga | Waga | Co było | Decyzja | Zmiana |
|---|---|---|---|---|
| R1 · tekst błędu serwera za słaby | średnia | opis `Alert` w `text-destructive/90`: 4,18:1 przy progu 4,5 (`theme.md` liczył tylko 100%) | poprawione | `src/components/ui/alert.tsx`: pełny `text-destructive` (4,86:1), wiersz w `theme.md` |
| R2 · link „Załóż je” zlewa się z tekstem obok, inny fokus | niska | `primary` przy `muted-foreground` to 1,37:1 jasności, podkreślenie tylko po hover; fokus jako biały prostokąt przeglądarki | poprawione | `SignInCard.astro`: stałe `underline`, `hover:text-foreground`, ramka `focus-visible:ring-[3px] ring-ring/50` jak w pozostałych kontrolkach |
| R3 · brak `color-scheme: dark` | niska | jasne paski przewijania; autouzupełnienie (RoboForm, Chrome) mogło dać jasne tło pola | poprawione | `global.css`: `color-scheme: dark` w `.dark` |
| R4 · słabe ramki pól | niska | `input` na `card` 1,23:1; pola rozpoznawalne po ikonach i podpowiedziach | odłożone do S-01 | powód: rozjaśnienie `--input`/`--border` to zmiana palety; w S-01 głównym elementem będzie pole na nick gościa, tam ustalimy ramki |
| R5 · wpisana wartość w błędnym polu czerwona | kosmetyka | `Field` z `data-[invalid=true]:text-destructive` barwi też wpisany tekst | poprawione | `FormField.tsx`: `InputGroupInput` z `text-foreground` |
| R6 · etykieta „Hasło” bliżej poprzedniego pola | kosmetyka | 12 px od etykiety do pola, 16 px między polami (`space-y-4`) | poprawione | `SignInForm.tsx` i `SignUpForm.tsx`: pola w `FieldGroup` z `field.tsx` (28 px między parami) |
| R7 · „Zaloguj się” trzy razy na karcie | kosmetyka | tytuł, opis i przycisk powtarzały to samo | poprawione | opis „Konto ma tylko osoba prowadząca. Goście grają bez konta.” (zgodnie z PRD: gość bez konta), `text-balance` przeciw osieroconemu słowu |
| R8 · rejestracja jako hybryda | niska | polski komunikat z mapy w angielskim formularzu, nieprzezroczysty `Alert` na półprzezroczystej karcie | odłożone do S-05 | powód: obudowa rejestracji bez zmian do S-05 (decyzja planu); zapisane w `change.md` |
| K1 · hover przycisku ledwo widoczny | niska | `hover:bg-primary/90` zmienia tło o 1,17:1; brak kursora „rączka” (Tailwind 4) | częściowo: kursor teraz, kolor w S-01 | `global.css` (`@layer base`): `cursor: pointer` dla `button` i `[role="button"]` (przepis z dokumentacji shadcn). Kolor hover zaprojektujemy razem z kolorem gry w S-01, żeby nie projektować go dwa razy |
| K2 · zablokowany przycisk 50% | nie problem | „Logowanie…” 2,68:1 na przygaszonym tle, czytelne | bez zmian | WCAG 1.4.3 nie obejmuje nieaktywnych kontrolek; stan trwa jedno żądanie i ma spinner oraz zmianę napisu |

Strona `/dev/ui-kitchen-sink`: bez uwag (nagłówek nie jest wyrównany z kartami, ale to strona deweloperska).

## Sprawdzenia ręczne (Karol, 2026-10-04)

Na serwerze deweloperskim, w przeglądarce Karola, wpisywał sam. Wynik: „wszystko działa”.

- 4.7 Strona ze stanami: 5 kart, każdy stan pokazany albo „nie dotyczy” z powodem. OK.
- 4.8 Tab przez pole e-mail, pole hasła, oko, przycisk i link z tą samą ramką; hover na linku, oku i przycisku (kursor „rączka”). OK.
- 4.9 Link z obcym `?error=` na logowaniu i rejestracji pokazuje komunikat ogólny. OK.
- 4.10 Złe hasło: „Logowanie…” i zablokowany przycisk, po „Wstecz” przycisk znów aktywny. OK. Uwaga Karola: logowanie trwało 2–3 s. Pomiar: serwer obsłużył tę próbę w ok. 0,3 s (`POST /api/auth/signin` 190 ms + strona z błędem 105 ms w logu serwera), a czysty Chrome bez rozszerzeń ładuje stronę po błędzie w 0,3–0,4 s nawet w trybie deweloperskim (53 skrypty). Reszta czasu jest po stronie przeglądarki Karola; najbardziej prawdopodobny jest menedżer haseł, który przechwytuje wysyłanie formularza logowania (nie sprawdzone). Stan ładowania zrobił to, do czego służy: pokazał, że coś się dzieje.

## Odstępstwa od planu (faza 4, do opisu w commicie)

- `src/components/auth/SignInCard.astro` (nowy): obudowa karty logowania wspólna dla `/auth/signin` i strony ze stanami, żeby strona ze stanami nie kopiowała klas karty. Tytuł jako `h2` na stronie ze stanami (tam `h1` ma sama strona).
- `src/components/auth/useSubmitPending.ts` (nowy): stan `pending` i zerowanie w `pageshow` z `persisted` w jednym miejscu dla obu formularzy.
- `SignInForm` ma prop `preview` (`idPrefix`, `email`, `password`, `showErrors`, `pending`) używany tylko przez stronę ze stanami; `idPrefix` daje unikalne `id` przy kilku formularzach na jednej stronie. Walidacja wydzielona do czystej funkcji `getFieldErrors`, żeby karta „błędy pól” pokazywała prawdziwe komunikaty.
- 404 strony ze stanami przez `Astro.response.status = 404` i warunkowy render zamiast `return new Response(...)`: wczesny `return` w frontmatterze wywraca regułę `@typescript-eslint/no-misused-promises` przy `npm run lint`.
- `authErrorCode()` w `src/lib/auth-errors.ts` zamienia błąd Supabase na kod (`isAuthRetryableFetchError` z `@supabase/supabase-js` albo status 5xx daje `service_unavailable`).
- `console.error` w API z `// eslint-disable-next-line no-console`, jak w `src/lib/live-sync/server.ts`.
- Po krytyce zrzutów (wyżej): zmiany w klockach `alert.tsx` (R1) i `global.css` (R3, K1), `FieldGroup` w obu formularzach (R6, dotyka też rejestracji), nowy opis karty (R7; plan w fazie 2 podawał „Zaloguj się, żeby poprowadzić grę.”).
- **Na fazę 5:** skan literałów musi objąć też `src/components/auth/SignInCard.astro` (plan wymienia `src/components/auth/*.tsx`), bo tam jest teraz karta logowania.
