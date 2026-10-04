# Paleta gry (faza 3)

## Źródło

- Motyw **Graphite** z rejestru tweakcn: `https://tweakcn.com/r/themes/graphite.json`, pobrany 2026-10-04 (tylko odczyt, bez `shadcn add`).
- Z motywu bierzemy tylko kolory ról i promień (`--radius`). Bez czcionek, cieni, wykresów (`--chart-*`) i sidebaru (`--sidebar-*`), które zostają z fabrycznego shadcn.
- Promień **0.75rem** zamiast 0.35rem z motywu: Karol chciał „ciutkę bardziej zaokrąglone, jak w nr 16 (Violet Bloom, 1.4rem)” i z dwóch wariantów na prawdziwym ekranie wybrał pośredni (B).
- Linia ze źródłem stoi w `src/styles/global.css` nad blokiem `:root`.

## Kandydaci

1. **Pierwsza trójka (imprezowa, według planu)**: `retro-arcade`, `sunset-horizon`, `bubblegum` z tweakcn, każdy z poprawkami jasności pod WCAG, zrzuty logowania z komunikatem błędu:
   - `screens/p3-candidate-1-retro-arcade.jpg`
   - `screens/p3-candidate-2-sunset-horizon.jpg`
   - `screens/p3-candidate-3-bubblegum.jpg`

   Karol: „żaden z proponowanych mi się po prostu nie podoba”; poprosił o szerszy wybór z wiarygodnych źródeł.
2. **Tablica 56 propozycji** (szkice karty logowania w wersji ciemnej, generowane skryptem w scratchpadzie sesji):
   - 1–14: imprezowe zestawienia z oficjalnej palety Tailwind CSS (na niej stoją motywy shadcn), w tym fioletowe tła w stylu Kahoot / Gartic Phone;
   - 15–56: wszystkie 42 gotowe motywy z rejestru tweakcn (`https://tweakcn.com/r/themes/registry.json`).

   Karol wybrał **nr 25 (Graphite)** z rogami „jak w nr 16”.
3. **Graphite, dwa promienie na prawdziwym ekranie**: `screens/p3-graphite-A-radius-1.4rem.png` (A) i `screens/p3-graphite-B-radius-0.75rem.png` (B).

## Wybór

- **Graphite, promień 0.75rem (wariant B)**, wybór Karola 2026-10-04.
- Zmiana względem planu: w planie klimat palety był „imprezowy”, a żaden imprezowy kandydat nie podpasował. Karol świadomie wybrał szarą, monochromatyczną bazę. Kolor gry może dojść później tylko do ważnych akcji (np. przycisk głosowania), bez zmiany reszty tokenów.
- Zrzuty ostatecznej palety: `screens/p3-final-desktop.png` i `screens/p3-final-390.png` (390 px, z komunikatem błędu).

## Poprawki jasności (WCAG)

Tylko jasność (L w OKLCH), ten sam odcień i nasycenie, tylko w `.dark` (aplikacja zawsze działa w ciemnym motywie):

| Token | Motyw | U nas | Powód |
|---|---|---|---|
| `--muted-foreground` | `oklch(0.5999 0 0)` | `oklch(0.6249 0 0)` | tekst pomocniczy na karcie: 4,5:1 |
| `--ring` | `oklch(0.7058 0 0)` | `oklch(0.7708 0 0)` | ramka fokusu przy 50% przezroczystości na karcie: 3:1 |

## Wartości

Pozostałe zmienne (`--chart-*`, `--sidebar-*`) bez zmian; `@theme inline` bez zmian.

| Rola | `:root` (jasny, nieużywany) | `.dark` (aplikacja) |
|---|---|---|
| `radius` | `0.75rem` | (z `:root`) |
| `background` | `oklch(0.9551 0 0)` | `oklch(0.2178 0 0)` |
| `foreground` | `oklch(0.3211 0 0)` | `oklch(0.8853 0 0)` |
| `card` | `oklch(0.9702 0 0)` | `oklch(0.2435 0 0)` |
| `card-foreground` | `oklch(0.3211 0 0)` | `oklch(0.8853 0 0)` |
| `popover` | `oklch(0.9702 0 0)` | `oklch(0.2435 0 0)` |
| `popover-foreground` | `oklch(0.3211 0 0)` | `oklch(0.8853 0 0)` |
| `primary` | `oklch(0.4891 0 0)` | `oklch(0.7058 0 0)` |
| `primary-foreground` | `oklch(1.0000 0 0)` | `oklch(0.2178 0 0)` |
| `secondary` | `oklch(0.9067 0 0)` | `oklch(0.3092 0 0)` |
| `secondary-foreground` | `oklch(0.3211 0 0)` | `oklch(0.8853 0 0)` |
| `muted` | `oklch(0.8853 0 0)` | `oklch(0.2850 0 0)` |
| `muted-foreground` | `oklch(0.5103 0 0)` | `oklch(0.6249 0 0)` |
| `accent` | `oklch(0.8078 0 0)` | `oklch(0.3715 0 0)` |
| `accent-foreground` | `oklch(0.3211 0 0)` | `oklch(0.8853 0 0)` |
| `destructive` | `oklch(0.5594 0.1900 25.8625)` | `oklch(0.6591 0.1530 22.1703)` |
| `border` | `oklch(0.8576 0 0)` | `oklch(0.3290 0 0)` |
| `input` | `oklch(0.9067 0 0)` | `oklch(0.3092 0 0)` |
| `ring` | `oklch(0.4891 0 0)` | `oklch(0.7708 0 0)` |

## Kontrasty

Policzone jednorazowym skryptem z wartości zapisanych w `global.css` (OKLCH → sRGB, przezroczystość mieszana jak w przeglądarce, wzór WCAG 2.x).

| Para | `.dark` | Próg | Wynik |
|---|---|---|---|
| `foreground` / `background` | 12,33 | 4,5 | OK |
| `card-foreground` / `card` | 11,54 | 4,5 | OK |
| `primary-foreground` / `primary` (przycisk) | 6,66 | 4,5 | OK |
| `primary` / `card` (link „Załóż je”) | 6,23 | 4,5 | OK |
| `muted-foreground` / `card` | 4,56 | 4,5 | OK |
| `destructive` / `card` (błędy) | 4,86 | 4,5 | OK |
| `ring` przy 50% / `card` (fokus) | 3,02 | 3 | OK |

`:root` nie jest używany (aplikacja ma zawsze `class="dark"`). Wszystkie pary tekstu przechodzą, ale ramka fokusu ma tam 2,12:1. Gdyby kiedyś doszedł jasny motyw, `--ring` w `:root` trzeba przyciemnić.

## Na później: wykresy i kolory graczy

- `--chart-1` … `--chart-5` zostają kolorowe (fabryczny shadcn: niebieski, zielony, bursztynowy, fioletowy, czerwony). Szara baza nie zmienia ich wyglądu, a kolorowe wycinki są na niej lepiej widoczne.
- Pomysł Karola: na ekranie wyniku (S-02) każda osoba ma swój kolor na wykresie kołowym. Pięć tokenów nie wystarczy przy kilkunastu graczach, więc przy S-02 dochodzi osobny zestaw „kolorów graczy” (np. 10–12 dobrze rozróżnialnych barw, sprawdzonych też dla zaburzeń widzenia kolorów) i podpisy przy wycinkach. Wykres pokazuje liczbę głosów na osobę, nie kto na kogo głosował (anonimowość z PRD).
