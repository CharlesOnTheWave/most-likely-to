# Baza startowa pytań (F-02) — Plan Brief

> Full plan: `context/changes/starter-question-base/plan.md`

## What & Why

Gra nie ma jeszcze ani jednego pytania, a bez pytań nie ma rundy. F-02 daje pierwszą wspólną bazę pytań „Kto z nas najprawdopodobniej…” po polsku, zatwierdzoną przez twórcę gry. Z niej skorzystają S-01 (wybór kategorii przy zakładaniu pokoju) i S-02 (losowanie pytań do rundy).

## Starting Point

W projekcie nie ma żadnych danych gry: ani pliku z danymi, ani tabel w Supabase. Jedyny projekt Supabase to zarazem produkcja, a lokalnie nie ma Dockera.

## Desired End State

Plik `src/data/questions.ts` ma 8 kategorii. W każdej jest co najmniej 15 zwykłych pytań i 5 pytań 18+. Każde pytanie ma stały identyfikator, kategorię i znacznik 18+, a Karol zatwierdził je jedno po drugim na stronie przeglądu (w praktyce akceptacja zbiorcza w czacie, zob. nota w Fazie 2 planu). Bramka (lint, typy, build) przechodzi, a decyzja o checkboxie 18+ przy każdej kategorii jest zapisana w S-01 i w FR-005.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Gdzie żyje baza | Plik TypeScript w repo, baza Supabase później | Dziś nic nie ruszamy na produkcji, a istniejąca bramka sprawdza plik. |
| Kategorie | Na co dzień, Imprezy, Przyszłość, Wpadki i obciach, Gry i internet, Podróże i przygody, Sport i wyzwania, Praca i szkoła | Rdzeń uniwersalny plus dodatki wybrane przez Karola. |
| Rozmiar | Min. 15 zwykłych + 5 pytań 18+ na kategorię (ok. 160), szkic z zapasem | Wystarczy na pierwsze wieczory bez powtórek; zaakceptowane nadwyżki zostają. |
| Pytania 18+ | Znacznik przy każdym pytaniu; host zaznacza 18+ osobno przy każdej kategorii (S-01) | Pomysł Karola: ekipa sama decyduje, gdzie chce ostrzej. |
| Forma | Tryb przypuszczający, forma ogólna („…zasnąłby na własnej imprezie”) | Wybór Karola: klasyczne brzmienie tej gry. |
| Zapis tekstu | Tylko końcówka po „Kto z nas najprawdopodobniej”, max 90 znaków | Prefiks dokleja ekran, a krótki tekst mieści się na telefonie. |
| Tematy zakazane | Brak („wstępnie nie unikamy niczego”) | Decyzja Karola; filtrem jest jego przegląd. |
| Akceptacja | Prywatna strona z przyciskami „fajne / do poprawy / do usunięcia” i uwagą przy każdym pytaniu | Pomysł Karola: widzi każde pytanie, a oznaczenia wracają do Claude bez przepisywania. |
| Identyfikator pytania | `<kategoria>-<NNN>`, niezmienny i nigdy nieużywany ponownie | Pod tym identyfikatorem S-11 będzie trzymać statystyki pytania. |

## Scope

**In scope:**
- Typy, kategorie i zasady zapisu w `src/data/questions.ts`
- Szkic pytań, przegląd Karola i zapis przeglądu w `question-review.md`
- Zatwierdzone pytania w pliku; dopiski o 18+ w roadmapie (S-01) i PRD (FR-005)

**Out of scope:**
- Tabele i migracje Supabase, wgrywanie na produkcję
- Ekran wyboru kategorii i checkbox 18+ (S-01), losowanie (S-02), statystyki (S-11)
- Stały test danych (moduł 3), research „jakie pytania działają najlepiej”

## Architecture / Approach

Jeden moduł danych: `CATEGORIES` (identyfikator + polska nazwa) i `QUESTIONS` (obiekt kluczowany identyfikatorem pytania: kategoria, tekst, znacznik 18+). Typy pilnują kategorii i znacznika, a klucze obiektu pilnują unikalności identyfikatorów, bo powtórzony klucz to błąd `astro check`. Treść powstaje w pętli: szkic w `question-review.md`, potem strona przeglądu (artefakt), oznaczenia Karola, poprawki. Na końcu zatwierdzone pytania trafiają do pliku.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Szkielet bazy pytań | Plik z typami, 8 kategoriami i zasadami zapisu | Nazwy kategorii zmienione później rozjadą się z identyfikatorami (identyfikatory zostają). |
| 2. Szkic pytań i przegląd Karola | Min. 15 + 5 zatwierdzonych pytań w każdej kategorii | Kilka rund poprawek; oznaczenia muszą bezpiecznie wrócić ze strony do Claude. |
| 3. Baza w kodzie | Zatwierdzone pytania w pliku, dopiski o 18+ w roadmapie i PRD | Literówka przy przepisywaniu; łapie ją porównanie z zapisem przeglądu. |

**Prerequisites:** brak (F-02 nie ma zależności); do Fazy 2 potrzebny ok. 30–40 minut czasu Karola na przegląd, najlepiej w kilku podejściach.
**Estimated effort:** 1–2 sesje: Faza 1 i 3 krótkie, Faza 2 zależna od liczby rund przeglądu.

## Open Risks & Assumptions

- Zakładamy, że strona przeglądu może oddać oznaczenia Claude'owi przez wspólną bazę artefaktu. Jeśli ta funkcja nie jest dostępna, zapasową drogą jest przycisk „Kopiuj wynik” i wklejenie do czatu (w Devinie Ctrl+Shift+V).
- Brak zakazanych tematów oznacza, że o tonie decyduje wyłącznie przegląd Karola; na pierwszych wieczorach słabe pytanie pomija się w grze (FR-006).
- Tryb przypuszczający w formie ogólnej brzmi po męsku przy dziewczynach; to świadoma decyzja twórcy gry.

## Success Criteria (Summary)

- Karol zatwierdził każde pytanie w bazie, a zapis tego przeglądu leży w folderze zmiany.
- S-01 i S-02 mogą od razu korzystać z kategorii, pytań i znacznika 18+ bez przenoszenia pytań do bazy danych.
- Bramka przechodzi, a gra na produkcji działa bez zmian.
