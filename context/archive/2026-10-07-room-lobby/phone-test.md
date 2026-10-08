# Test na telefonach (S-01, faza 5)

Produkcja: https://most-likely-to.charlesonthewave.workers.dev. Wdrożenie z merge `ecbf211` (PR #1), test 2026-10-08. Urządzenia: laptop (host i drugi gość w oknie incognito) i telefon z Androidem (gość z Discorda i z Chrome). iPhone'a nie było.

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

| #   | Urządzenie | Przeglądarka | Wynik | Czas | Uwagi                                                                   |
| --- | ---------- | ------------ | ----- | ---- | ----------------------------------------------------------------------- |
| H1  | laptop     | Chrome       | OK    | 30 s | Logowanie przez Discorda, kategorie domyślne. Bez niejasności i zacięć. |

## Goście

| #   | Urządzenie | Przeglądarka                              | Wynik         | Czas dołączenia | Lista na żywo | Uwagi                                                                                                                                            |
| --- | ---------- | ----------------------------------------- | ------------- | --------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | Android    | Discord (link z wiadomości na Discordzie) | OK            | ok. 10 s        | od razu       | Bez instrukcji: nick, „Dołącz”, poczekalnia z „Jesteś w grze jako …”.                                                                            |
| G2  | Android    | Chrome                                    | OK            | od razu         | bez zmian     | Ten sam telefon co G1, link wklejony w zwykły Chrome: od razu poczekalnia jako gość z G1, bez formularza; u hosta nadal 2 osoby.                 |
| G3  | laptop     | Chrome, okno incognito                    | OK            | „minimalny”     | od razu       | Drugi gość z linku skopiowanego przyciskiem „Kopiuj”; wszedł jako nowy gracz, bez błędów. Lista uzupełniła się sama u hosta i na telefonie (G1). |
| G4  | iOS        | Discord (link z wiadomości na Discordzie) | niesprawdzone | —               | —             | Brak iPhone'a (08.10). Ryzyko otwarte, jak w S-05.                                                                                               |

## Przejście do innej przeglądarki (5.6)

| #   | Urządzenie | Z                     | Do     | Wynik         | Uwagi                                                                                                                                                                                       |
| --- | ---------- | --------------------- | ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0  | Android    | przeglądarka Discorda | Chrome | OK            | Gość rozpoznany bez ponownego wpisywania nicku: Discord na Androidzie otwiera linki w Chrome (Custom Tab) i dzieli z nim ciasteczka (jak w S-05, `one-click-host-login/phone-test.md`).     |
| P1  | iOS        | przeglądarka Discorda | Safari | niesprawdzone | Brak iPhone'a. Oczekiwane (znane ograniczenie do S-04): przeglądarka Discorda na iOS trzyma ciasteczka osobno od Safari, więc gość w Safari widzi przy swoim nicku „zajęty” z podpowiedzią. |

## Zamknięcie pokoju z gośćmi

| #   | Urządzenie                   | Kto    | Wynik | Uwagi                                                                                                                                         |
| --- | ---------------------------- | ------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Z1  | laptop                       | host   | OK    | „Załóż grę” przy 3 graczach najpierw pokazało ostrzeżenie o zamknięciu starego pokoju, potem „Zamknij stary pokój i załóż grę” założyło nowy. |
| Z2  | Android i laptop (incognito) | goście | OK    | Oba ekrany gości same, bez odświeżania, przełączyły się na „Ta gra jest zamknięta. Poproś hosta o nowy link.”                                 |

## Wniosek

Na Androidzie i laptopie wszystko zgodnie z założeniem: host do linku w 30 s, gość w ok. 10 s bez instrukcji, lista na żywo u hosta i gości, zamknięcie pokoju widoczne od razu. Zmiana przeglądarki na Androidzie nie gubi gościa. Otwarte ryzyko: iOS (przeglądarka Discorda, przejście do Safari) niesprawdzony; wraca, gdy będzie iPhone do testu albo gdy gracz z iPhone'em zgłosi problem.
