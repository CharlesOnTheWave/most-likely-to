# Raport 10xArchitect: moduł 4

2026-10-20 · repo `most-likely-to` (ta gra) · HEAD `0fad991`

## 1. Opisane projekty

Wszystkie artefakty modułu powstały na jednym repozytorium, tej grze. Innych projektów nie było.

- **Projekt:** „Most Likely To”, imprezowa gra w przeglądarce.
- **Stack:** Astro 7 (SSR) z wyspami React 19 i Tailwind 4, logika gry w funkcjach SQL Supabase, dzwonek przez Supabase Realtime, hosting Cloudflare Workers (`repo-map.md:7`, `:194`; `03-anti-corruption-layer.md:41`).
- **Skala (z mapy):** 93 pliki w `src/`, 34 pliki testów, 4 migracje (`evidence/3-structure.md:9`, `:12`, `:13`); 16 funkcji SQL (`repo-map.md:197`); 9 możliwości biznesowych, 155 commitów w 3,5 tygodnia, jeden autor, 9 PR (`repo-map.md:15`, `:82`, `:168`).

Lekcja nazywa mapę domeny `01-domain-distillation.md`; skill zapisał ją jako `context/domain/domain-distillation.md`, bez numeru.

## 2. Mapa projektu (L2)

- **Logika gry siedzi w SQL, TypeScript ma do niej jedną bramę.** `src/lib/rooms/server.ts` woła 10 funkcji bazy po nazwach w napisach, ma 381 linii i nie importuje go żaden test (`repo-map.md:78`, `:95`).
- **Strefa ryzyka 1: logowanie hosta.** Realny defekt po wydaniu (`d4bff27a`) i poprawki prosto na `main` (`957bb6d3`) (`repo-map.md:121-124`).
- **Strefa ryzyka 2: pokój, poczekalnia i wejście gościa.** Jedyne publiczne wejście bez logowania, wydane ze znanymi dziurami F1/F4, około 5–7 dni na produkcji (`inference`, `repo-map.md:134`, `:140`).
- **Entry pointy i centra:** strona pokoju `src/pages/r/[id].astro`, wejście gościa `src/pages/j/[token].astro` → `join.ts`, middleware logowania (`repo-map.md:179-183`). Największy zasięg ma dzwonek Realtime: mapa liczy 14 wejść, a ast-grep w L3 doprecyzował, że dzwoni 9 miejsc (`repo-map.md:152`; `research.md:247`).
- **Unknowns:** brak grafu SQL, kontrakt TS↔SQL bez typów bazy, kontrakt dzwonka, niechroniony `main` (`repo-map.md:208-210`, `:214`).

## 3. Analiza ficzera (L3)

**Co i dlaczego.** Badałem przepływ gościa od linku do pokoju do głosu: skąd gość ma tożsamość gracza (nick i token gościa) i jak wraca ona przy głosie. Wybrałem go, bo mapa wskazała tu strefę ryzyka 2 i obserwację „runda” (`research.md:28-32`).

**Feature overview.** Wejście to link do pokoju z adresu i nick z formularza (`research.md:64-68`). `join_room` zapisuje gracza i hash tokenu gościa, a surowy token trafia do ciasteczka na 24 h. `cast_vote` wpisuje głosującego do `private.round_voters` bez celu, a cel do urny (`private.ballot_boxes`) bez głosującego; ostatni głos uprawnionych odsłania rundę w tej samej transakcji (`research.md:36-39`). Wraca tylko `{ok:true}` i dzwonek `{seq}`, po którym każdy ekran pobiera stan pokoju z `/api/rooms/<id>/lobby` (`research.md:40-41`, `:101`).

**Technical debt.** Weryfikacja ast-grep: 22 twierdzenia, 16 potwierdzonych, 6 doprecyzowanych, 0 obalonych (`research.md:55`).

1. **Kontrakt Worker↔SQL na napisach, potwierdzony ast-grepem.** 10 wywołań `callRpc`, jedno `.rpc(` (`server.ts:89`), brak typów bazy, testy db wołają własne kopie nazw (C1, C2, C17, C18 w „Weryfikacja ast-grep”, `research.md:243-260`). Job `db` bywa więc zielony przy literówce w Workerze; łapią ją dopiero smoke i e2e w CI (D1, `:190`). Blast radius: 12 importerów runtime, 0 importów w testach (C15, C16, `:257-258`).
2. **Zasada „głos tylko w pamięci” bez strażnika.** Nic nie pilnuje, że głos nie trafia do storage, ciasteczka ani URL. Dziś jedyny zapis w przeglądarce to znacznik przeładowania w `useRoomState.ts:99,100,110` (D7; C9, C10, `research.md:196`, `:251-252`).
3. **Kody odmów kopiowane ręcznie.** Nowy kod z SQL dostaje tekst ogólny bez sygnału. Żywy przykład: `not_signed_in` nie ma komunikatu w `errors.ts` (D3, C22, `research.md:192`, `:264`).

## 4. Plan refaktoryzacji (L4)

**Wybrana opcja: K1 i tani zysk D7, strażnicy zamiast przebudowy** (`plan.md:5-8`). Kopie kontraktu TS↔SQL okazały się w większości świadome i nośne (niezależna wyrocznia, obrona w głąb), więc gra zostaje Transaction Scriptem (`refactor-opportunities/research.md:67-76`). K1 wygrał jako jedyna potwierdzona dziura: ścieżki Workera dla odsłony nie woła żaden test CI (W7, `:366`).

**Docelowy kształt** (`plan.md:35-43`, `:130`): test unit z atrapą klienta (12 przypadków, wyrocznia to ręczna tabela sygnatur SQL), krok smoke z odsłoną przez Workera (54 kroki zamiast 53) i reguła ESLint zakazująca zapisu w przeglądarce w `src` poza 3 liniami znacznika przeładowania. W `src` przybywają tylko 3 komentarze.

**Czego nie robimy** (`plan.md:63-77`): K2–K5, wygenerowane typy bazy (10/10 funkcji zwraca `jsonb`), testy gałęzi awarii i zmiany w `server.ts`, migracje, decyzje produktowe S-04, lint skryptów `<script>` w `.astro`. Przegląd planu: REVISE → SOUND; jedyne ustalenie krytyczne (D7 nie widzi `<script>` w `.astro`) stało się jawną luką, a pierwszy push przesunięto do ostatniej fazy (`plan-review.md:7`, `:56`, `:66`).

| Faza | Co | Auto | Ręcznie |
| --- | --- | --- | --- |
| 1 | test bramy RPC (K1) | 12 testów zielonych, `src` bez zmian | próbne alarmy: literówka w `reveal_round`, zamiana argumentów |
| 2 | D7 jako ostrzeżenie | lint zielony, dokładnie 3 ostrzeżenia | lektura komunikatu reguły |
| 3 | D7 jako błąd, 3 komentarze wyjątku | lint czysty, diff to same komentarze | próbny alarm w trzech formach |
| 4 | krok smoke z odsłoną, pierwszy push i PR | CI zielone, smoke 54 kroki | próbny alarm w CI i revert |

Status `plan_reviewed`, Progress bez odhaczeń: plan nie jest wdrożony (`change.md:4`, `plan.md:346-400`).

## 5. Domena wg DDD (L5)

**Ubiquitous language** (`glossary.md:15-38`):

- **runda**: jedno pytanie u wszystkich, od otwarcia do odsłony albo pominięcia pytania;
- **głos**: nie istnieje jako rekord; zostają ślady w **urnie**, czyli stanie rundy w toku, który znika przy każdym jej końcu;
- **gość ≠ gracz**: gość wchodzi bez konta, gracz to każdy z nickiem, także **host**;
- **pominięcie pytania** (prowadzący) ≠ **wstrzymanie się** (gracz) (`domain-distillation.md:101`).

W Core nie brakuje żadnego terminu (0 z 12), w Supporting brakuje 8 z 27, wszystkich z niezbudowanych slice'ów (`domain-distillation.md:85`). Rozjazdy model-vs-kod: 4 do naprawy w kodzie, 2 w dokumentach, 3 do decyzji (`:23`). Najostrzejszy, D-01: PRD każe po odświeżeniu pokazać graczowi jego głos, a zasada anonimowości zabrania zwracać parę „kto na kogo”; kod trzyma się zasady (`:179`).

**Statusy niezmienników:**

- egzekwowane: prawie cały Core (`:21`), m.in. głos ostateczny (R-01), anonimowość (R-08), znikanie urny (R-09) (`:129`, `:141-142`);
- deklarowane: numer pytania przy głosie i odsłonie (R-05), powrót gracza z oddanym głosem (R-21), pytania tylko z wybranych kategorii (R-22) (`:133`, `:159`, `:165`);
- ignorowane: prawo hosta do skasowania historii (R-12, `:145`);
- sprzeczne z kodem: logi poza listą pól (R-13, `:146`).

**Niezmiennik #1 i agregat.** N3: ruch w rundzie (głos, odsłona, pominięcie, następne) trafia tylko w najnowszą rundę o numerze z ekranu nadawcy i tylko w fazie, która na ten ruch pozwala (`02-invariant-aggregate-refactor.md:105`). Dziś „Pomiń” i „Następne” sprawdzają numer, głos tylko wtedy, gdy ekran go poda, a odsłona wcale (`02-…:20-22`). Właścicielem ma być agregat-strażnik **Gra** w bazie: korzeń to wiersz `public.rooms`, wewnątrz encja Runda, granica spójności to blokada wiersza pokoju (`02-…:286-294`). W bazie, bo funkcje SQL da się wołać z pominięciem Workera (`02-…:296-298`). Mapa domeny daje tej pozycji #4, a #1 decyzji D-01 (`domain-distillation.md:204`, `:207`).

**Anti-Corruption Layer.** Przecieka `@supabase/supabase-js`, najbardziej jego Realtime (dzwonek pokoju): 7 warstw, 21 plików w `src` i 2 poza nim (`03-anti-corruption-layer.md:171-172`). Osiem tras trzyma klienta Supabase tylko po to, żeby zadzwonić, a telefon gracza pobiera cały SDK (ok. 55 KB gzip) (`03-…:17-21`). Dokumenty deklarują plan B (Durable Objects), którego kod nie ułatwia (`03-…:23-24`).

02 i 03 to plany, nie wdrożona zmiana: oba piszą wprost, że kod jest nietknięty (`02-…:9`, `03-…:9`).

## 6. Decyzje, które należą do mnie

Agent zbudował mapę, research, ranking i oba plany, a przy każdym wyborze dawał rekomendację; ja wybierałem spośród opcji i stawiałem granice. Do analizy (L3) wziąłem przepływ gościa do głosu, a nie dzwonek ani logowanie hosta, bo zasila następny plaster gry (powrót po odświeżeniu, S-04). W planie (L4) zostawiłem ranking agenta, ale zakres zawęziłem do dwóch strażników (K1 i tani D7), a K2/K3 odłożyłem, bo gra działa na produkcji i ma jednego autora; z przeglądu planu przyjąłem wszystkie trzy poprawki, w tym jawne zapisanie luki w `.astro` zamiast udawania pełnej ochrony. Z domeny (L5) do kodu wezmę tylko jedną małą zmianę (numer pytania przy głosie i odsłonie, F2) przez PR z zielonym CI, a agregatu w SQL i warstwy ACL świadomie nie wdrażam: to materiał na decyzję, gdy gra urośnie. Konflikt PRD z anonimowością (D-01) rozstrzygnę sam przed S-04, bo to decyzja o produkcie, a anonimowość głosu jest twardą regułą gry (`AGENTS.md:7`).
