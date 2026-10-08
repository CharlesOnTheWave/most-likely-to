# Test na telefonach (S-01, faza 5)

Produkcja: https://most-likely-to.charlesonthewave.workers.dev. Wdrożenie i data testu: do uzupełnienia po scaleniu PR #1.

Co sprawdzamy (plan, faza 5, Manual Verification):

- 5.4: każdy gość dołącza w mniej niż 30 s bez instrukcji, a lista u hosta i u gości uzupełnia się na żywo;
- 5.5: host zakłada grę w mniej niż 5 minut, od wejścia na stronę do linku;
- 5.6: iPhone, przejście z przeglądarki Discorda do Safari: przy swoim nicku gość widzi „zajęty” z podpowiedzią (znane ograniczenie do S-04).

Jak liczymy czas:

- host: od wejścia na `/` do skopiowanego linku `/j/<kod>`;
- gość: od dotknięcia linku w wiadomości na Discordzie do ekranu „Jesteś w grze jako …”;
- lista na żywo: od kliknięcia „Dołącz” do nowego nicku na liście hosta, bez odświeżania.

Przy błędzie zrzut ekranu.

## Host

| #   | Urządzenie | Przeglądarka | Wynik | Czas | Uwagi |
| --- | ---------- | ------------ | ----- | ---- | ----- |
| H1  | laptop     |              |       |      |       |

## Goście

| #   | Urządzenie | Przeglądarka                              | Wynik | Czas dołączenia | Lista na żywo | Uwagi |
| --- | ---------- | ----------------------------------------- | ----- | --------------- | ------------- | ----- |
| G1  | Android    | Discord (link z wiadomości na Discordzie) |       |                 |               |       |
| G2  | Android    | Chrome                                    |       |                 |               |       |
| G3  | iOS        | Discord (link z wiadomości na Discordzie) |       |                 |               |       |

## Przejście do innej przeglądarki (5.6)

| #   | Urządzenie | Z                     | Do     | Wynik | Uwagi |
| --- | ---------- | --------------------- | ------ | ----- | ----- |
| P1  | iOS        | przeglądarka Discorda | Safari |       |       |
