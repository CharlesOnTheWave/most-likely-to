# Pomiary F-01: dzwonek + tablica

**Kryterium F-01** (`plan.md`, decyzja Karola 2026-09-27):
- 95% dostarczeń „dzwonek + tablica” mieści się w 2 s;
- żadne dostarczenie nie przekracza 5 s;
- każdy gracz dostał każdy dzwonek;
- w pomiarze nie było rozłączeń.

Rozstrzyga przebieg 1 pokój × 20 graczy × 10 prób na produkcji. Przebiegi z kilkoma pokojami są informacyjne.

**Jak mierzy sonda** (`npm run live-probe`, `scripts/live-sync-probe.mjs`):
- `t0` przed `POST /api/live-sync/ring`, potem czas odebrania dzwonka i czas pobrania tablicy u każdego gracza, jednym zegarem sondy;
- każdy gracz to osobny klient supabase-js z własnym połączeniem; tablicę pobiera bez ciasteczek, jak gość;
- brak pełnego dostarczenia (dzwonek + tablica) w 5 s liczy się jako zgubione;
- „Tablica” = czas od dzwonka do tablicy, liczony tylko dla dostarczonych.

## Przebiegi

| Data | Środowisko | Commit | Pokoje × gracze × próby | Dzwonek p50 / p95 / max (ms) | Tablica p50 / p95 / max (ms) | Łącznie p50 / p95 / max (ms) | W 2 s z oczekiwanych | Zgubione | Rozłączenia | Werdykt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-04 10:18 | lokalnie, `npm run dev` (Windows) | 3a8ad3f (sonda zacommitowana po pomiarze, bez zmian) | 1 × 20 × 10 | 1435 / 2364 / 2381 | 2027 / 2784 / 2791 | 2518 / 4242 / 4246 | — (sonda sprzed F1) | 40 z 200 | 0 | FAIL |
| 2026-10-04 10:31 | lokalnie, `npm run dev` (Windows) | 3a8ad3f (sonda zacommitowana po pomiarze, bez zmian) | 5 × 20 × 10 | 1479 / 2452 / 2505 | 1608 / 2956 / 2982 | 2077 / 4740 / 4748 | — (sonda sprzed F1) | 600 z 1000 | 0 | INFO |
| 2026-10-04 11:36 | produkcja, Workers (sonda z Windows) | 3746df6 (wdrożony); sonda 3746df6 + poprawka `Math.ceil` (commit fazy 5, SHA przy 5.2 w `plan.md`) | 1 × 20 × 10 | 138 / 189 / 191 | 28 / 64 / 73 | 170 / 235 / 247 | 200 z 200 (100%) | 0 z 200 | 0 | **PASS** |
| 2026-10-04 11:38 | produkcja, Workers (sonda z Windows) | 3746df6 (wdrożony); sonda 3746df6 + poprawka `Math.ceil` (commit fazy 5, SHA przy 5.2 w `plan.md`) | 5 × 20 × 10 | 130 / 327 / 541 | 33 / 145 / 313 | 186 / 393 / 598 | 1000 z 1000 (100%) | 0 z 1000 | 0 | INFO |

**Uwaga do lokalnych wierszy** (przegląd 2026-10-04, F1): „Tablica” i „Łącznie” liczą tylko dostarczone (160 z 200 i 400 z 1000), a „Dzwonek” wszystkie dzwonki odebrane w 5 s. Licząc po wszystkich oczekiwanych, p95 łącznie przekracza 5 s w obu przebiegach, a przy 5 pokojach także p50. Od poprawki F1 sonda drukuje też odsetek dostarczeń w 2 s, czas łączny po wszystkich oczekiwanych, przyczyny zgubionych i linię na każdą próbę.

**Uwaga do produkcyjnych wierszy:** zgubionych nie było, więc „tylko dostarczone” i „wszystkie oczekiwane” dają te same liczby. Przyczyny zgubionych w obu przebiegach: brak dzwonka w 5 s 0, tablica spóźniona 0, błąd tablicy 0; odrzucone dzwonki (502) 0.

Żądanie dzwonka (POST → odpowiedź):
- lokalnie: p50 1435 / p95 2389 / max 2389 ms (1 pokój), p50 1493 / p95 2475 / max 2508 ms (5 pokoi). W obu przebiegach 0 odrzuconych dzwonków (502) i 0 błędów tablicy: Supabase przyjął każde nadanie i utrzymał 100 połączeń bez rozłączeń;
- produkcja: p50 141 / p95 192 / max 192 ms (1 pokój), p50 134 / p95 392 / max 640 ms (5 pokoi).

**Nieudany przebieg produkcyjny 2026-10-04 11:35 (błąd sondy, nie wynik):** sonda padła przy pierwszym dzwonku na `RangeError: The value of "delay" is out of range. It must be an integer. Received 4824.8779`. `AbortSignal.timeout` przyjmuje tylko całe milisekundy, a limit czasu tablicy z poprawki F3 (3746df6) był ułamkowy. Proces skończył się kodem 1 zamiast 2, bo wyjątek poleciał w callbacku Realtime, poza `try` w `main`. Za zgodą Karola poprawka jednej linii (`Math.ceil`); progi, limity i liczenie bez zmian, bo o spóźnieniu dalej decyduje `totalMs <= 5000`. Przebieg zdążył zalogować konto `probe-1791106533229@example.com` i podłączyć 20 graczy, więc Supabase nie był uśpiony. Kod wyjścia przy takiej awarii zostaje 1 (decyzja Karola: tylko poprawka jednej linii).

**Wdrożenie przed pomiarem:** push `ce22a1a..3746df6` za zgodą Karola, smoke na produkcji 8/8, CI zielone (run 37192183193).

## Produkcja a lokalnie (2026-10-04)

- **Produkcja przechodzi z zapasem.** W przebiegu rozstrzygającym 200 z 200 dostarczeń zmieściło się w 2 s; najwolniejsze trwało 247 ms, czyli ok. 1/8 budżetu p95 (2000 ms) i 1/20 limitu max (5000 ms).
- **Dzwonek jest ok. 10 razy szybszy niż lokalnie** (p50 138 ms wobec 1435 ms). Dzwonek dalej przychodzi razem z odpowiedzią na żądanie dzwonka (p50 141 ms), czyli jego czas to droga sonda → Worker → Supabase → z powrotem.
- **Tablica dla gościa (bez ciasteczek) to na produkcji 28 ms (p50)** wobec ok. 2 s lokalnie, razem z przejściem przez middleware. Odłożona w planie zmiana middleware (`getUser()` przy każdym żądaniu) nie jest więc potrzebna dla gości; zalogowanych sonda nie mierzy.
- **100 graczy w 5 pokojach** (informacyjnie): 1000 z 1000 w 2 s, max 598 ms, bez rozłączeń. Najwolniejsza była próba 8 (żądanie dzwonka do 640 ms, dzwonek do 541 ms), nadal daleko w budżecie. Ok. 1050 wiadomości w ok. 35 s nie wywołało rozłączeń za przekroczenie limitu.
- **Lokalny FAIL to sprawa lokalnego łańcucha** (serwer deweloperski na Windows), a nie Supabase ani naszego kodu. Dokładnej przyczyny lokalnej nie sprawdzaliśmy; produkcja jej nie ma, więc dla werdyktu nie jest potrzebna. Do zapamiętania na S-02: lokalne czasy z `npm run dev` nie nadają się do oceny budżetu 2 s; o budżecie rozstrzyga sonda na produkcji.
- **Ograniczenie pomiaru:** sonda chodzi z laptopa Karola (Windows, domowa sieć) do Cloudflare i Supabase. Telefony graczy na danych komórkowych mogą mieć wolniejszą drogę; częściowo sprawdza to test telefonu.

## Diagnoza lokalnego FAIL (2026-10-04)

Fakty:
- **Nasz kod jest szybki.** Logi serwera deweloperskiego podają obsługę `POST /api/live-sync/ring` w 102–407 ms, a `GET /api/live-sync/state` w ok. 100–200 ms. Sonda widzi jednak dzwonek po ok. 1,4 s, a tablicę po ok. 2 s.
- **Dzwonek przychodzi razem z odpowiedzią na żądanie dzwonka** (p50 1435 ms w obu). Czas dzwonka to więc w praktyce czas drogi sonda → serwer lokalny → Supabase → z powrotem.
- **Sonda nie spowalnia sama siebie.** Osobny test bez kont: 20 równoległych pobrań tablicy trwa ok. 0,36 s zarówno bez klientów Realtime, jak i z 20 otwartymi; opóźnienie timerów w procesie do 18 ms.
- **Zgubione 40 z 200:** sonda nie rozróżnia, czy dzwonek nie doszedł, czy tablica nie zdążyła w 5 s. Maksymalne czasy dzwonka (2,4 s) i tablicy (2,8 s) razem przekraczają 5 s, więc prawdopodobnie to przekroczenia czasu, a nie zgubione dzwonki. Niezweryfikowane. Sonda w wersji z pomiaru miała te dane, ale ich nie drukowała; od poprawki F1 rozbija zgubione na przyczyny.

Hipoteza (niesprawdzona): ponad sekunda ginie w lokalnym łańcuchu serwera deweloperskiego (Vite → workerd na Windows) albo w połączeniach z lokalnego workerd do Supabase. Plan przewidywał to ryzyko („Pomiar z Windows może zawyżać czasy”, `plan-brief.md`). Produkcja (Cloudflare Workers) to inny łańcuch i to ona rozstrzyga.

Zgodnie z planem progi, limity czasu i sposób liczenia nie zmieniają się pod wynik.

## Test telefonu

2026-10-04, produkcja (`/dev/live-sync`, pokój `demo`), według „Manual Testing Steps” z `plan.md`.

- **Telefon (gość, bez logowania):** Pixel 9 Pro, Chrome, Wi-Fi.
- **Laptop Karola (zalogowany, dzwoni):** Windows.

| Krok | Wynik |
| --- | --- |
| 1. Laptop i telefon otwierają stronę | bez uwag; telefon łapał dzwonki od kroku 2, więc był połączony |
| 2. Trzy dzwonki z laptopa | telefon złapał 3 z 3; tablica pobrana w 32, 62 i 40 ms |
| 3. Ekran zgaszony na 1–2 min, w tym czasie jeden dzwonek | licznik powrotów przed zgaszeniem: 0 |
| 4. Odblokowanie | od razu „połączono”, bez „rozłączono” po drodze; widoczny numer dzwonka nadanego przy zgaszonym ekranie. Licznika po odblokowaniu Karol nie zanotował |
| 5. Kolejny dzwonek | złapany, ten sam numer co na laptopie, tablica w 142 ms. Uwaga: przed tym krokiem Karol odświeżył stronę na telefonie |

**Co z tego wynika:**
- **Połączenie przetrwało zgaszony ekran.** Telefon pokazał dzwonek nadany, gdy ekran był zgaszony, a publiczny kanał nie odtwarza przegapionych wiadomości. Dzwonek musiał więc dojść tym samym, żywym połączeniem. Telefon dostał nawet więcej, niż plan wymagał („tego dzwonka telefon nie musi nadrobić”).
- **Po odświeżeniu tablica jest pusta** („Czekam na dzwonek…”), aż do następnego dzwonka. Tak działa prototyp: strona nie pobiera stanu przy wejściu. Pobieranie stanu przy wejściu i po każdym powrocie połączenia należy do S-02 i S-04 („What We're NOT Doing”).
- **Krok 5 poszedł po odświeżeniu,** czyli na nowym połączeniu. Złapanie kolejnego dzwonka tym samym połączeniem po odblokowaniu pokazuje już krok 4.

**Czego test nie sprawdził:**
- iPhone i Safari, który mocniej usypia karty w tle;
- dane komórkowe;
- zgaszony ekran dłużej niż 1–2 min;
- ścieżkę powrotu po zerwaniu, bo licznik powrotów nie wzrósł.

To do sprawdzenia przy pierwszej rundzie z prawdziwymi telefonami (S-02, test z 3 osobami).

## Werdykt

**B spełnia kryterium F-01** (przebieg rozstrzygający 2026-10-04: produkcja, 1 × 20 × 10). Werdykt zaakceptowany przez Karola 2026-10-04.

| Warunek F-01 | Wymóg | Wynik |
| --- | --- | --- |
| „Dzwonek + tablica” w 2 s | ≥ 95% | 100% (200 z 200), p95 235 ms |
| Najwolniejsze dostarczenie | ≤ 5 s | 247 ms |
| Każdy gracz dostał każdy dzwonek | 0 zgubionych | 0 |
| Rozłączenia | 0 | 0 |

- Spełniona jest nawet dosłowna wersja z `prd.md:139` („u każdego gracza w ciągu 2 s”). Czy zaostrzyć kryterium, rozstrzyga S-02.
- 5 pokoi × 20 graczy (informacyjnie): 1000 z 1000 w 2 s, max 598 ms, bez rozłączeń.
- Telefon (Pixel 9 Pro, Chrome, Wi-Fi): połączenie przetrwało 1–2 min zgaszonego ekranu.

**Decyzja:** wariant B (publiczny kanał-dzwonek + stan z Workera) zostaje techniką na żywo dla S-01 i S-02. Plan awaryjny (Durable Objects przez PartyServer) nie jest potrzebny.

**Co przejmuje S-02:**
- stan tylko z bazy, nigdy z treści dzwonka (dzwonek może nadać każdy z kluczem publishable);
- pobranie stanu przy wejściu na stronę i po każdym powrocie połączenia;
- w trakcie rundy tylko „kto już zagłosował”, liczby dopiero przy odsłonie;
- budżet 2 s mierzy sonda na produkcji, nie `npm run dev`;
- test z prawdziwymi telefonami: iPhone z Safari, dane komórkowe, dłuższe uśpienie;
- decyzja o usypianiu darmowego Supabase (pytanie 9 roadmapy) przed pierwszym wieczorem.
