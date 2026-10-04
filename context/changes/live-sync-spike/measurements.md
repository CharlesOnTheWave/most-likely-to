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

| Data | Środowisko | Commit | Pokoje × gracze × próby | Dzwonek p50 / p95 / max (ms) | Tablica p50 / p95 / max (ms) | Łącznie p50 / p95 / max (ms) | Zgubione | Rozłączenia | Werdykt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-04 10:18 | lokalnie, `npm run dev` (Windows) | 3a8ad3f (sonda zacommitowana po pomiarze, bez zmian) | 1 × 20 × 10 | 1435 / 2364 / 2381 | 2027 / 2784 / 2791 | 2518 / 4242 / 4246 | 40 z 200 | 0 | FAIL |
| 2026-10-04 10:31 | lokalnie, `npm run dev` (Windows) | 3a8ad3f (sonda zacommitowana po pomiarze, bez zmian) | 5 × 20 × 10 | 1479 / 2452 / 2505 | 1608 / 2956 / 2982 | 2077 / 4740 / 4748 | 600 z 1000 | 0 | INFO |

**Uwaga do lokalnych wierszy** (przegląd 2026-10-04, F1): „Tablica” i „Łącznie” liczą tylko dostarczone (160 z 200 i 400 z 1000), a „Dzwonek” wszystkie dzwonki odebrane w 5 s. Licząc po wszystkich oczekiwanych, p95 łącznie przekracza 5 s w obu przebiegach, a przy 5 pokojach także p50. Od poprawki F1 sonda drukuje też odsetek dostarczeń w 2 s, czas łączny po wszystkich oczekiwanych, przyczyny zgubionych i linię na każdą próbę.

Żądanie dzwonka (POST → odpowiedź): p50 1435 / p95 2389 / max 2389 ms (1 pokój), p50 1493 / p95 2475 / max 2508 ms (5 pokoi). W obu przebiegach 0 odrzuconych dzwonków (502) i 0 błędów tablicy: Supabase przyjął każde nadanie i utrzymał 100 połączeń bez rozłączeń.

## Diagnoza lokalnego FAIL (2026-10-04)

Fakty:
- **Nasz kod jest szybki.** Logi serwera deweloperskiego podają obsługę `POST /api/live-sync/ring` w 102–407 ms, a `GET /api/live-sync/state` w ok. 100–200 ms. Sonda widzi jednak dzwonek po ok. 1,4 s, a tablicę po ok. 2 s.
- **Dzwonek przychodzi razem z odpowiedzią na żądanie dzwonka** (p50 1435 ms w obu). Czas dzwonka to więc w praktyce czas drogi sonda → serwer lokalny → Supabase → z powrotem.
- **Sonda nie spowalnia sama siebie.** Osobny test bez kont: 20 równoległych pobrań tablicy trwa ok. 0,36 s zarówno bez klientów Realtime, jak i z 20 otwartymi; opóźnienie timerów w procesie do 18 ms.
- **Zgubione 40 z 200:** sonda nie rozróżnia, czy dzwonek nie doszedł, czy tablica nie zdążyła w 5 s. Maksymalne czasy dzwonka (2,4 s) i tablicy (2,8 s) razem przekraczają 5 s, więc prawdopodobnie to przekroczenia czasu, a nie zgubione dzwonki. Niezweryfikowane. Sonda w wersji z pomiaru miała te dane, ale ich nie drukowała; od poprawki F1 rozbija zgubione na przyczyny.

Hipoteza (niesprawdzona): ponad sekunda ginie w lokalnym łańcuchu serwera deweloperskiego (Vite → workerd na Windows) albo w połączeniach z lokalnego workerd do Supabase. Plan przewidywał to ryzyko („Pomiar z Windows może zawyżać czasy”, `plan-brief.md`). Produkcja (Cloudflare Workers) to inny łańcuch i to ona rozstrzyga.

Zgodnie z planem progi, limity czasu i sposób liczenia nie zmieniają się pod wynik.

## Test telefonu

Wypełniane w fazie 5.

## Werdykt

Wypełniany w fazie 5, po pomiarze na produkcji.
