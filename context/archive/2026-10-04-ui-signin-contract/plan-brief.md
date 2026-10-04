# Kontrakt UI na ekranie logowania — Plan Brief

> Full plan: `context/changes/ui-signin-contract/plan.md`
> Research: `context/changes/ui-signin-contract/research.md`

## What & Why

Ekran logowania przechodzi na kontrakt UI: kolory z tokenów, klocki shadcn, imprezowa paleta wybrana przez Karola, 7 działających stanów i kody błędów z polskimi komunikatami. Chodzi o to, żeby lobby (S-01) i runda (S-02) powstały od razu na tym kontrakcie, a nie na fiolecie i granacie ze startera, które pierwszy nasz ekran (`/dev/live-sync`) już skopiował. To praktyka lekcji M2L5 (`/10x-ui`).

## Starting Point

Plik tokenów `src/styles/global.css` jest kompletny, ale logowanie go nie czyta. Ma 13 linii z kolorami wpisanymi na sztywno i 0 klas semantycznych, a ciemny wygląd daje tylko `bg-cosmic`. Formularz ma własne klocki bez powiązania błędu z polem, pokazuje dowolny tekst z `?error=` i nie włącza ładowania. Wszystko jest po angielsku (`research.md`, zarzuty C1–C5).

## Desired End State

Host widzi polski ekran logowania w ciemnej, imprezowej palecie, zbudowany z tokenów i klocków shadcn. Przycisk pokazuje ładowanie i blokuje drugie kliknięcie, fokus jest widoczny, a błędy przychodzą jako kody tłumaczone z mapy, więc link nie podrzuci cudzego tekstu. Lokalna strona `/dev/ui-kitchen-sink` pokazuje wszystkie stany. `AGENTS.md` i `npm run lint` (więc też CI) pilnują, żeby następny agent nie wrócił do literałów.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Ekran do lekcji | Logowanie (`/auth/signin`) | Ekrany gry jeszcze nie istnieją, a logowanie ma prawie wszystkie stany i wspólne klocki dla S-01. | Research |
| Wariant kontraktu | Świeży starter z martwym plikiem tokenów | Tokeny są, ale ekran ich nie czyta; najpierw przepięcie, potem nowe wartości. | Research |
| Motyw | Ciemny przez klasę `dark` na `<html>` | Zgodne z shadcn (style `dark:`), gra zostaje ciemna jak dziś. | Plan |
| Klimat palety | Imprezowy | Gra ma wyglądać jak gra, a nie jak panel; bez fioletowo-niebieskiego „stylu AI”. | Plan |
| Źródło kolorów | 3 gotowe motywy pokazane na zrzutach, wybór Karola | Wybór po wyglądzie, wartości i źródło zapisane w repo. | Plan |
| Wspólne klocki auth | Przebudowa na shadcn w miejscu | Jedna wersja klocków; rejestracja i S-01 zyskują od razu. | Plan |
| Napisy | Logowanie po polsku i `lang="pl"` | PRD: v1 po polsku (`prd.md:187`). | Plan |
| Błędy z adresu | Tylko kody, mapa „kod → komunikat” w logowaniu i rejestracji | Zamyka podmianę komunikatu przez link na obu ekranach. | Plan |
| Tło | Jednolite z tokenu `background` | W pełni z tokenów i spójne z przyszłymi ekranami. | Plan |
| Obudowa rejestracji | Bez zmian do S-05 | FR-001 zakłada logowanie bez rejestracji, więc ekran pewnie zniknie. | Plan |
| Strona ze stanami | Tylko lokalnie, na produkcji 404 | Produkcja bez stron testowych. | Plan |
| Zabezpieczenie | Reguła w `AGENTS.md`, skan w `npm run lint` i sprawdzian `claude -p` | Błąd łapie automat (też CI), bez nowej zależności. | Plan |

## Scope

**In scope:**
- klocki shadcn, `<html lang="pl" class="dark">`, logowanie i wspólne klocki auth na tokenach, polskie napisy logowania;
- imprezowa paleta w `global.css` i `theme.md` (źródło, wartości, kontrasty);
- kody błędów w API logowania i rejestracji, sprawdzanie pustych pól na serwerze, ładowanie i blokada, fokus, hover, `/dev/ui-kitchen-sink`, zrzuty;
- sekcja `## UI` w `AGENTS.md`, `scripts/ui-literals.mjs` w `npm run lint`, sprawdzian świeżą sesją.

**Out of scope:** sposób logowania (S-05); przekierowanie zalogowanego i strona po zalogowaniu (S-01); obudowa i napisy rejestracji; inne ekrany startera i `bg-cosmic`; czcionki i cienie z motywu, przełącznik jasny/ciemny; Playwright; fokus w trybie wysokiego kontrastu.

## Architecture / Approach

Tokeny (`:root`, `.dark`, publikowane przez `@theme inline`) zasilają klocki shadcn w `src/components/ui`, a z nich składa się widok. Kolejność według `/10x-ui` z poprawką dla martwego pliku tokenów: klocki i tryb ciemny, potem ekran na istniejących tokenach, potem paleta, potem stany, na końcu zabezpieczenie. Błędy idą z API jako kod w adresie, strona tłumaczy go przez `src/lib/auth-errors.ts`, a do wyspy trafia tylko tekst z mapy.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Klocki i tryb ciemny | Klocki shadcn, `lang="pl"`, `class="dark"` | Wygenerowane pliki trzeba dopasować do lintu; `button.tsx` przywracamy z gita |
| 2. Logowanie na tokenach | Ekran i wspólne klocki bez literałów, polskie napisy | Zagnieżdżona wyspa w `Card`; rejestracja po zmianie API klocków |
| 3. Paleta gry | Wybrany motyw w tokenach, `theme.md` z kontrastami | Słaby kontrast ramki fokusu (`ring` przy 50%) |
| 4. Stany i błędy | Kody błędów, ładowanie i blokada, strona ze stanami | Przycisk zablokowany po „Wstecz” (pułapka bfcache) |
| 5. Zabezpieczenie | Reguła UI, skan w lincie i CI, sprawdzian świeżą sesją | Skan łapie klasy z komponentów spoza zakresu |

**Prerequisites:** Supabase aktywny (uśpienie ok. 11.10 bez ruchu); serwer deweloperski (`npm run dev`); dostęp do rejestru shadcn i tweakcn przez sieć.
**Estimated effort:** ok. 2 sesje na 5 faz; w fazie 3 Karol potrzebuje ok. 15 minut na wybór palety.

## Open Risks & Assumptions

- S-05 może zastąpić formularz z hasłem. Kontrakt (tokeny, klocki, reguła) zostaje, a stracimy tylko część pracy nad formularzem.
- Rejestracja do S-05 wygląda „pół na pół”: nowe pola, stara obudowa, angielskie napisy, polskie komunikaty błędów.
- Rzadkie błędy Supabase dostaną komunikat ogólny. Każdy błąd trafia do logów Workera, a brak połączenia (np. uśpiony projekt) ma własny komunikat.
- Klocki shadcn mają `outline-none`, więc w trybie wysokiego kontrastu Windows fokus znika; świadomie poza zakresem.
- Znikanie tekstu wpisanego przed hydratacją (D5) jest niepotwierdzone; sprawdzamy je tylko przy bramce wizualnej.

## Success Criteria (Summary)

- Skan literałów spada z 14 do 0 (13 na ekranie logowania, 1 w podpowiedzi rejestracji), a `npm run lint` zawodzi, gdy ktoś doda literał.
- Każdy z 7 stanów jest pokazany na `/dev/ui-kitchen-sink` albo opisany jako „nie dotyczy”, a zrzuty z komputera i z 390 px są w folderze zmiany.
- Link z obcym `?error=` nie wyświetla cudzego tekstu, a świeża sesja agenta przy drobnej zmianie sięga po tokeny.
