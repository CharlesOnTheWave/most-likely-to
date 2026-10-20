---
title: "Niezmiennik #1 i agregat-strażnik: ruch trafia w rundę, którą widzisz"
created: 2026-10-20
type: refactor-plan
---

# Niezmiennik #1 i agregat-strażnik: ruch trafia w rundę, którą widzisz

> To plan refaktoru, a nie implementacja: w kodzie nic się nie zmieniło. Analiza jest niezależna. Celowo nie czytałem
> niczego w `context/domain/` (także `glossary.md`), więc proponowane nazwy trzeba przed `/10x-plan` porównać ze
> słownikiem (`CLAUDE.md:27`). Każdy cytat `plik:linia` sprawdziłem w tej sesji. Przy funkcji SQL z kilkoma wersjami
> cytuję najnowszą.

## W skrócie (dla gry)

- **Reguła #1.** Każdy ruch w rundzie (głos, „Odsłoń wynik”, „Pomiń pytanie”, „Następne pytanie”) dotyczy pytania,
  które gracz albo prowadzący ma na ekranie. Działa tylko w fazie rundy, która na ten ruch pozwala. To jest sedno gry z
  PRD: wszyscy widzą to samo pytanie, każdy oddaje jeden głos, a odsłona przychodzi po ostatnim głosie albo na ruch
  prowadzącego.
- **Stan obecny.** Regułę pilnują cztery osobno napisane funkcje bazy i każda robi to trochę inaczej. „Pomiń” i
  „Następne” zawsze sprawdzają numer pytania. Głos sprawdza go tylko wtedy, gdy ekran go poda. „Odsłoń wynik” nie
  sprawdza go wcale.
- **Dziura jest prawdziwa, ale dziś mała.** Drugi, nieodświeżony ekran hosta może odsłonić pytanie, którego nie
  pokazał (np. z zerem głosów), i to pytanie przepada. Po dodaniu współhosta (S-07) stanie się to zwykłym wyścigiem
  dwóch prowadzących. Problem jest znany od S-03 jako F2 i został odłożony bez daty.
- **Rekomendacja.**
  - Najpierw testy.
  - Potem mała zmiana zachowania: numer obowiązkowy w głosie i w odsłonie, dokładnie według F2.
  - Przed S-07 przeniesienie całej reguły do jednego agregatu w bazie („Gra”). Wtedy współhost, spóźnieni i usuwanie
    gracza zmieniają jedno miejsce, a nie pięć.
- **Decyzje dla Karola (tak/nie):**
  1. Czy domykamy F2 teraz?
  2. Czy fazy agregatu robimy przed S-07?
  3. Czy „Odsłoń wynik” na pominiętym pytaniu ma dostać odmowę zamiast cichego „ok”?

---

## Krok 0: kontekst

### Przeczytane źródła

- Wymagania:
  - `context/foundation/prd.md`: Business Logic `:148-154`, US-01 `:67-77`, FR `:79-135`, NFR `:137-144`, Access
    Control `:156-175`, Non-Goals `:177-191`;
  - `tech-stack.md`, `roadmap.md`, `test-plan.md`, `lessons.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`.
- Historia decyzji:
  - `context/archive/2026-10-13-first-live-round/research.md` (D1–D3);
  - `context/archive/2026-10-15-full-game-evening/` (`research.md`, `plan.md`, `reviews/impl-review.md`,
    `follow-ups/review-fixes.md`);
  - `context/changes/refactor-opportunities/` (`change.md`, `plan-brief.md`, `research.md`).
- Kod:
  - 4 migracje w `supabase/migrations/`;
  - `src/lib/rooms/*`, `src/pages/api/rooms/**`, `src/components/room/*`, `src/lib/rounds/draw.ts`,
    `src/lib/log.ts`;
  - testy: `tests/db/*`, `supabase/tests/round_creator_view.test.sql`, `scripts/smoke.mjs`.

Skróty migracji używane niżej:

- **RL**: `supabase/migrations/20261007122858_room_lobby.sql`;
- **FLR**: `supabase/migrations/20261014101922_first_live_round.sql`;
- **CSG**: `supabase/migrations/20261014101925_close_stale_games.sql`;
- **FGE**: `supabase/migrations/20261015122252_full_game_evening.sql`.

### Stack i warstwy, w których żyje logika biznesowa

Stack: Astro 7 SSR na Cloudflare Workers, wyspy React 19, Supabase (Postgres + Realtime), zob. `AGENTS.md:3` i
`context/foundation/tech-stack.md:22-24`.

| Warstwa | Gdzie | Rola wobec reguł gry |
| --- | --- | --- |
| Persystencja i domena | funkcje `security definer` w migracjach (`start_game`, `cast_vote`, `reveal_round`, `next_round`, `skip_round`, `end_game`, `create_room`, `join_room`, `room_lobby`) i pomocnicy `private.*` | **Tylko tutaj reguły są egzekwowane.** Każda funkcja sama blokuje wiersz pokoju, sprawdza rolę, stan i fazę, a odmowę zwraca jako dane (FLR:4-16). |
| API (Worker) | `src/pages/api/rooms/[id]/*.ts`, `src/lib/rooms/json-route.ts` | parsowanie treści, sprawdzenie `Origin` i `Content-Type`, zamiana kodu odmowy na status HTTP (`json-route.ts:118-138`) |
| Klient RPC (Worker) | `src/lib/rooms/server.ts` | jedno miejsce wywołań bazy, kontrola kształtu odpowiedzi, log bez danych (`server.ts:7-11`) |
| Losowanie (Worker) | `src/lib/rounds/draw.ts` | pula pytań z wybranych kategorii i z 18+ (`draw.ts:23-33`) |
| UI | `src/components/room/*` | przyciski zależne od fazy; numer rundy dołączany do głosu, „Następnego” i „Pomiń” (`RoomScreen.tsx:123-128`) |

**Granica zaufania.** Według `AGENTS.md:24` funkcja `security definer` przyznana `anon` jest publicznym wejściem z
pominięciem Workera, więc wszystkie sprawdzenia muszą być w niej. Funkcje hosta są przyznane `authenticated`
(FGE:539-541, FLR:803-805), więc host też może je wołać wprost, kluczem publishable. Wniosek: jedyny strażnik
niezmiennika może stać tylko w bazie.

### Język: terminy i ich źródło

| Termin | Źródło w dokumentach | Źródło w kodzie |
| --- | --- | --- |
| gra, pokój | US kroki 2–4 (`prd.md:56-58`), FR-005 (`:94`) | `public.rooms`, `start_game`, `end_game`; UI „Zacznij grę”, „Zakończ grę” |
| runda | US-01 (`prd.md:67`) | `private.rounds` (FLR:112-126) |
| numer rundy (pytania) | PRD nie ma; decyzja T1 (`full-game-evening/research.md:153`) | `rounds.number`, `p_round`; „Pytanie N” (`announce.ts:24-26`) |
| faza rundy: głosowanie, odsłona, pominięcie | FR-006, FR-009 (`prd.md:97,103`), bez słowa „faza” | `phase in ('voting', 'revealed', 'skipped')` (FGE:29) |
| głos, wstrzymanie się | FR-008 (`prd.md:101`) | `cast_vote`, `abstained`; UI „Wstrzymuję się” |
| odsłona | US krok 8 (`prd.md:62`), FR-009 | `reveal_round`, `finish_round`; UI „Odsłoń wynik” |
| pominięcie | FR-006 (`prd.md:97`) | `skip_round`; UI „Pomiń pytanie” |
| prowadzący (host albo współhost) | FR-009 i Business Logic (`prd.md:103,150`), Access Control (`:160`) | dziś tylko host: `v_user <> v_host` (np. FGE:98-101) |
| uprawnieni do głosu | US krok 7 „z listy nicków” (`prd.md:61`), FR-020 „od następnej” (`:90`) | `rounds.eligible` (FLR:119-120) |
| urna | PRD nie ma; decyzja D1 (`first-live-round/research.md:288`) | `private.ballot_boxes`, `private.round_voters` (FLR:137-153) |

---

## Krok 1: niezmienniki biznesowe

| ID | Niezmiennik (musi być zawsze prawdziwy) | Źródło w dokumentach | Źródło w kodzie |
| --- | --- | --- | --- |
| N1 | Para „kto na kogo” nigdy nie jest zapisana, zalogowana ani zwrócona | Non-Goals `prd.md:180`, NFR `:143`; `AGENTS.md:7` | urna bez głosującego i bez celu (FLR:128-153), lista dozwolonych pól logu (`log.ts:13-27`), `cast_vote` zwraca tylko `{ok: true}` (FGE:390) |
| N2 | Stan rundy w toku (urna) znika przy każdym końcu rundy: odsłonie, pominięciu, końcu gry, „Nowej grze”, sprzątaniu po 12 h | D1 (`first-live-round/research.md:277,288`); `AGENTS.md:7` | `finish_round` FLR:210-211, `skip_round` FGE:195-196, `drop_round_state` FLR:166-178 wołana w FLR:278, FGE:238, CSG:33 |
| **N3** | **Ruch w rundzie (głos, odsłona, pominięcie, następne) trafia tylko w najnowszą rundę o numerze z ekranu nadawcy i tylko w fazie, która na ten ruch pozwala; inaczej odmowa z nazwą i bez zapisu** | Business Logic `prd.md:150`, FR-006, FR-007, FR-009 (`:97-103`), US-01 Then (`:71`); T1 (`full-game-evening/research.md:153`) | FGE:10-12 (deklaracja), `cast_vote` FGE:328-340, `next_round` FGE:119-126, `skip_round` FGE:181-193, `reveal_round` FLR:751-767 |
| N4 | Każdy uprawniony gracz oddaje w rundzie co najwyżej jeden głos, ostateczny | FR-008 (`prd.md:101`), D2 (`first-live-round/research.md:278`) | FGE:348-351 (sprawdzenie przed zapisem), klucz `round_voters` (FLR:152) |
| N5 | Odsłona następuje po ostatnim uprawnionym głosie albo na ruch prowadzącego; liczby widać dopiero po odsłonie | FR-009, US-01 AC „natychmiast po trzecim głosie” (`prd.md:76`), D3 (`first-live-round/research.md:282`) | FGE:381-388, gałęzie `room_lobby` FGE:461-501, parser kopiuje tylko klucze kontraktu (`shared.ts:119-163`) |
| N6 | Głos pada na osobę z listy uprawnionych (także na siebie) albo jest wstrzymaniem się | FR-008 (`prd.md:101`) | FGE:353-361 |
| N7 | Pytanie pochodzi tylko z wybranych kategorii, 18+ tylko tam, gdzie host je włączył, i nie powtarza się w grze | FR-015 (`prd.md:120`), US-01 AC (`:74`) | kategorie: tylko Worker (`draw.ts:23-33`); baza sprawdza format id (FLR:572-574, FGE:50) i brak powtórek (FGE:51-53, klucz FLR:125) |
| N8 | Przebieg gry (start, odsłona, pominięcie, następne, koniec) zmienia tylko prowadzący | Access Control (`prd.md:169`), FR-006 | 5 kopii sprawdzenia hosta: FLR:559-562, FLR:742-745, FGE:98-101, FGE:160-163, FGE:224-227 |
| N9 | Gra startuje przy co najmniej 3 graczach | US-01 Given (`prd.md:69`) | FLR:580-582; kopia w UI: `shared.ts:5-6`, `RoomLobby.tsx:43,129` |
| N10 | Nikt nie wchodzi do trwającej gry; uprawnieni są ustalani przy otwarciu rundy | FR-020 (`prd.md:90`), S-08 jeszcze nie zrobione | FLR:341-344, FLR:576-578, FGE:61-63 |
| N11 | Host ma najwyżej jeden otwarty pokój; zamknięty nigdy się nie otwiera | `room-lobby` (archiwum), `roadmap.md` S-01 | indeks FLR:45-47, brak grantu zapisu FLR:33-38 |
| N12 | Nick jest unikalny w pokoju według wyglądu | FR-002 (`prd.md:84`) | `nick_key` i ograniczenie FLR:103-107 |
| N13 | Bez punktów, rankingu i timera | Non-Goals (`prd.md:181`), FR-010 usunięte (`:108`); `AGENTS.md:8` | brak kodu; pilnuje tylko przegląd |

---

## Krok 2: klasyfikacja i wybór #1

Skala:

- **(a) rdzeń:** jak bardzo reguła trzyma sens produktu (Vision, Business Logic, US-01);
- **(b) rozsmarowanie:** w ilu plikach produkcyjnych i warstwach żyje;
- **(c) egzekwowanie:** **E** egzekwowany w bazie, **K** egzekwowany, ale tylko konwencją (każda nowa ścieżka musi
  pamiętać), **C** częściowo, **D** tylko deklarowany, **N** naruszalny (da się go złamać legalnym wywołaniem).

| ID | (a) rdzeń | (b) rozsmarowanie | (c) egzekwowanie | Słaby punkt |
| --- | --- | --- | --- | --- |
| N1 | najwyższy (trwała zasada, Hard Rule) | ok. 8 plików, 4 warstwy (SQL, log, Worker, UI) | **E**, silnie strukturalnie, testy ról i pgTAP | pamięć przeglądarki bez strażnika; to już zaplanowane jako D7 (`refactor-opportunities/plan-brief.md:10-12`) |
| N2 | wysoki (część N1) | 3 migracje, 6 miejsc | **K**: każda ścieżka końca ma test pgTAP (`round_creator_view.test.sql:610-611, 624-625, 646-651, 674-675`) | D1 przewidywał „kasowanie w trzech miejscach” (`first-live-round/research.md:288`), dziś jest ich więcej; S-09 i S-13 muszą o tym pamiętać |
| **N3** | **wysoki: to dosłownie Business Logic (`prd.md:150`)** | **2 migracje (6 funkcji), 6 plików Workera, 5 plików UI, 4 warstwy** | **C/N:** next i skip egzekwują; głos tylko z numerem; odsłona wcale; dla pominiętej rundy ciche `ok` | klient jest jedynym strażnikiem dla głosu i odsłony; test utrwala dziurę; S-07 ją powiększy |
| N4 | wysoki | SQL i UI | **E** | — |
| N5 | wysoki | SQL, parser, UI | **E** | — |
| N6 | średni | SQL i UI | **E** | — |
| N7 | średni (reguła pomocnicza, `prd.md:154`) | Worker i SQL | **C**: brak powtórek w bazie; kategorie i 18+ tylko w Workerze | host wołający RPC wprost może otworzyć pytanie spoza swojego wyboru; szkodzi tylko własnej grze |
| N8 | wysoki | 5 kopii w SQL, trasy, UI | **E**, ale 5 kopii | S-07 musi zmienić 5 funkcji (`roadmap.md:198`) |
| N9 | średni | SQL, `shared.ts`, UI | **E** | stała 3 w dwóch językach |
| N10 | średni | SQL (2 kopie listy uprawnionych) | **E** | S-08 to zmieni |
| N11 | średni | SQL | **E** | — |
| N12 | średni | SQL | **E** | — |
| N13 | średni | brak kodu | **D** | nie ma czego egzekwować w kodzie |

### Wybór: N3 („ruch trafia w rundę, którą widzisz”)

N3 jest jedynym niezmiennikiem, który jednocześnie:

1. **jest rdzeniem produktu.** Business Logic opisuje dokładnie ten cykl: to samo pytanie u wszystkich w tej samej
   chwili, jeden głos od każdego, odsłona „w momencie, gdy zagłosuje ostatnia osoba (albo prowadzący przewinie)”
   (`prd.md:150`);
2. **jest egzekwowany niespójnie i da się go złamać legalnym wywołaniem.** Szczegóły w kroku 3. Nagłówek migracji
   deklaruje: „a vote and the host's moves carry the number of the question on the screen” (FGE:11), a „Odsłoń
   wynik” numeru nie niesie;
3. **jest najbardziej rozsmarowany.** Każda z sześciu funkcji SQL sama blokuje pokój, szuka najnowszej rundy,
   sprawdza numer i fazę. Trzy kolejne slice'y (S-07, S-08, S-09) zmienią prowadzącego, uprawnionych i próg odsłony,
   czyli właśnie te kopie.

**Adwokat diabła: „#1 powinna być anonimowość (N1)”.** N1 jest bardziej rdzeniowa, ale najlepiej egzekwowana:

- urna leży w tabelach nielogowanych, bez grantów i bez kolumn czasu (FLR:128-161);
- log przepuszcza tylko pola z listy (`log.ts:13-27`);
- testy przechodzą przez drzwi ról, a pgTAP sprawdza resztki.

Jej słaby punkt (D7) ma już plan. Projekt niżej i tak wzmacnia N1, bo zamyka zapis i kasowanie urny w czterech
nazwanych funkcjach (N2).

**Krytyk: „Dziura jest za mała na agregat”.** Sama dziura tak. Dlatego F2 idzie osobno i najpierw (faza 2). Agregat
zwraca się dopiero przy S-07, S-08 i S-09. Dziś sprawdzenie hosta ma 5 kopii, a odczyt „najnowszej rundy” 5 kopii
(4 w ruchach i 1 w odczycie stanu).

**Na drugim miejscu jest N7** (kategorie i 18+ tylko w Workerze). Szkodzić może tylko host własnej grze, więc to
osobna, mniejsza zmiana (poza zakresem).

---

## Krok 3: diagnoza N3

### 3.1 Reguła w jednym zdaniu i dzisiejsza tabela przejść

> Ruch w rundzie wskazuje numer rundy z ekranu nadawcy. Jest przyjmowany tylko wtedy, gdy to najnowsza runda gry, a
> jej faza na ten ruch pozwala: w `voting` głos, odsłona i pominięcie, w `revealed` albo `skipped` następne pytanie.
> Każdy inny ruch kończy się odmową z nazwanym kodem i niczego nie zapisuje.

Odpowiedzi baz danych dzisiaj (sprawdzone w kodzie). Pogrubione komórki łamią N3.

| Ruch ↓ / stan → | lobby | voting, numer zgodny | revealed | skipped | numer niezgodny | closed |
| --- | --- | --- | --- | --- | --- | --- |
| głos `cast_vote` | `no_round` (FGE:314-316) | przyjęty; ostatni uprawniony odsłania (FGE:381-388) | `round_revealed` (FGE:333-335) | `round_over` (FGE:337-340) | `round_over`, **ale tylko gdy numer podano** (FGE:328-331) | `room_closed` (FGE:310-312) |
| głos bez numeru | `no_round` | **przyjęty do najnowszej rundy** (FGE:252-253, :259) | `round_revealed` | `round_over` | **nie dotyczy, bo nie ma czego porównać** | `room_closed` |
| odsłona `reveal_round` | `no_round` (FLR:751-761) | odsłania (FLR:763-765) | `ok`, bez zmian (D3, FLR:721-722) | **`ok`, nic się nie dzieje** (FLR:763-767) | **brak numeru: odsłania najnowszą, jakakolwiek jest** | `room_closed` (FLR:747-749) |
| pominięcie `skip_round` | `no_round` (FGE:177-179) | pomija i otwiera następne (FGE:195-199) | `round_revealed` (FGE:186-189) | `round_over` (FGE:191-193) | `round_over`, także bez numeru (FGE:181-184) | `room_closed` |
| następne `next_round` | `no_round` (FGE:115-117) | `round_in_progress` (FGE:124-126) | otwiera n+1 (FGE:128-131) | otwiera n+1 albo `no_questions` | `round_over`, także bez numeru (FGE:119-122) | `room_closed` |
| koniec `end_game` | `no_round` (FGE:233-235) | zamyka, urna usunięta (FGE:237-238) | zamyka | zamyka | nie dotyczy | `room_closed` (FGE:229-231) |

### 3.2 Gdzie reguła żyje dziś, warstwa po warstwie

**Baza: egzekucja w sześciu kopiach.**

- Blokada wiersza pokoju jako pierwsza: FGE:285-288, FGE:93-96, FGE:155-158, FGE:219-222, FLR:554-557, FLR:737-740.
- „Najnowsza runda” (`order by r.number desc limit 1`): `cast_vote` FGE:318-322, `next_round` FGE:107-113,
  `skip_round` FGE:169-175, `reveal_round` FLR:751-757; w odczycie `room_lobby` FGE:452-459.
- Numer z ekranu, za każdym razem inaczej:
  - obowiązkowy w `next_round` (FGE:119-122) i `skip_round` (FGE:181-184);
  - opcjonalny w `cast_vote` (FGE:328-331);
  - brak parametru w `reveal_round` (FLR:723).
- Faza: FGE:124-126 (next), FGE:186-193 (skip), FGE:333-340 (vote), FLR:763-765 (reveal).
- Wyjście z `voting` i kasowanie urny, trzy style:
  - `finish_round` (FLR:182-213, kasowanie :210-211);
  - kasowanie wpisane wprost w `skip_round` (FGE:195-197);
  - `drop_round_state` (FLR:166-178) po `update … set status = 'closed'` w trzech miejscach: FLR:276-278, FGE:237-238,
    CSG:32-33.
- Uprawnieni liczeni dwa razy: FLR:576-578 i FGE:61-63.

**Worker: przepuszcza brak numeru.**

- `bodyRound` zwraca `null`, gdy treść nie ma `round`: „a vote takes either” (`json-route.ts:109-116`).
- `vote.ts` odmawia tylko przy `undefined`, więc `null` przechodzi (`vote.ts:33-37`). Komentarz wprost:
  „a screen loaded before S-03 sends none and still votes” (`vote.ts:23`).
- `castVote` pomija `p_round`, gdy `round === null` (`server.ts:239-257`, warunek :253).
- `reveal.ts` nie czyta treści i woła `revealRound(supabase, roomId)` (`reveal.ts:22`). `revealRound` nie ma
  parametru rundy (`server.ts:259-263`).
- Dla porównania `next.ts:25-26` i `skip.ts:24-25` zwracają `invalid_body` bez numeru.

**UI: jedyny strażnik w dwóch miejscach.**

- Głos niesie numer tylko dlatego, że ekran go wysyła: `act("vote", { target, round })` (`RoomScreen.tsx:124`).
- Odsłona go nie niesie: `act("reveal", {})` (`RoomScreen.tsx:125`), `run: onReveal` (`RoundVoting.tsx:276-284`).
  Komentarz `RoundVoting.tsx:40-41` mówi wprost: numer idzie „with the vote, the skip and nothing else”.
- Zakaz odsłony pominiętej rundy istnieje tylko w UI: ekran pominiętej rundy pokazuje tylko „Następne” i „Zakończ”
  (`RoundSkipped.tsx:40`). Baza odpowiada `ok`.
- Jeden ruch naraz na jednym ekranie pilnuje `HostActions.tsx:100-120` (przycisk czeka na nowy stan). Wystarcza na
  jednym urządzeniu, ale nie chroni przed drugim ekranem.

**Testy: utrwalają dziurę.**

- `tests/db/game-rules.test.ts:152-156`: „a vote with no question number in round 2 gets ok: true, as the Worker
  before S-03 sends it”. Narusza to zasadę `test-plan.md:173`: „Nigdy test, który zapisuje dziurę jako dozwolone
  zachowanie”.
- Pomocnicy głosują bez numeru:
  - `tests/db/support/rounds.ts:96-111` (komentarz :18-21);
  - pgTAP `round_creator_view.test.sql:193-212` („must keep working once cast_vote takes p_round”);
  - smoke `scripts/smoke.mjs:272-274`.
- Odsłona bez numeru: `rounds.ts:113-115`, pgTAP `:160-165`.

### 3.3 Diagnoza: co jest nie tak i gdzie

| Problem | Miejsce | Skutek |
| --- | --- | --- |
| Warstwa, która nie egzekwuje | `reveal_round` (FLR:723-769) nie zna numeru rundy; Worker `reveal.ts:22` i `server.ts:259-263` też nie | odsłania „najnowszą”, nie „tę z ekranu” |
| Egzekucja niespójna | numer: obowiązkowy w next i skip, opcjonalny w głosie, brak w odsłonie (3.2); ten sam stan `skipped` daje `round_over` dla głosu i pominięcia, a `ok` dla odsłony | ta sama reguła ma trzy wersje; nagłówek FGE:11-12 obiecuje więcej, niż kod robi |
| Klient jedynym strażnikiem | numer głosu (`RoomScreen.tsx:124`), odsłona tylko z widoku `voting` (`RoundVoting.tsx:271-301`, `RoundSkipped.tsx:40`) | jeśli ekran przestanie wysyłać numer (np. przy przeróbce ekranu w S-04), nic nie zaświeci na czerwono: baza i Worker przyjmą, a `game-rules.test.ts:154` nawet to potwierdzi |
| Błąd „połknięty” zamiast zatrzymania | odsłona pominiętej rundy daje `{ok: true}` bez zmiany stanu (FLR:763-767); Worker dzwoni wtedy do pokoju na darmo (`reveal.ts:23`) | nielegalny ruch zgłasza sukces |
| Warunek przed zapisem tylko z dyscypliny | „everything is checked before the first write” (FLR:11) to konwencja powtarzana w każdej funkcji | nowa funkcja (S-07, S-09) może sprawdzić coś za późno i zostawić pół zapisu |

Poza tym na ścieżce N3 żaden `catch` nie połyka awarii. Błędy RPC kończą się jawnym 500 lub 503 (`server.ts:57-63`,
`json-route.ts:118-124`). Dzwonek, który nie zadzwonił, jest tylko logowany, celowo, bo nadrabia go polling
(`server.ts:365-381`). To nie dotyczy N3.

### 3.4 Czy to realna dziura?

**Tak, ale dziś o małej wadze.** Nie dotyczy anonimowości.

1. **Odsłona z nieaktualnego ekranu** (najważniejsza).
   - Scenariusz: host ma grę otwartą na dwóch urządzeniach. Na telefonie pomija pytanie N, więc otwiera się N+1. Laptop
     jeszcze pokazuje N, bo dzwonek zawiódł, a polling ma odstęp 15 s (`src/lib/live-sync/shared.ts:8`). Na laptopie
     host klika dwa razy „Odsłoń wynik”. `reveal_round` odsłania N+1 z zerem głosów, a pytanie przepada (bez powtórek,
     FR-015).
   - Ten opis jest zapisany jako F2 w `context/archive/2026-10-15-full-game-evening/reviews/impl-review.md:70-78`.
   - Po S-07 współhost może też odsłaniać (FR-009, `prd.md:103`). Gdy host kliknie „Pomiń”, a współhost w tej samej
     sekundzie „Odsłoń”, kolejność blokady rozstrzyga: przy wygranej pominięcia odsłona trafia w nowe pytanie.
   - Po S-11 taka runda zapisałaby fałszywe „0 głosów” do danych o jakości pytań (FR-016, `prd.md:122`).
2. **Głos bez numeru.** Trafia do najnowszej rundy. Nikt na tym nie zyskuje (gracz zawsze może wysłać właściwy numer),
   ale klient jest jedynym strażnikiem, a test utrwala dziurę.
   - Okno wdrożenia, które to uzasadniało, już się zamknęło. Migracja S-03 jest w repozytorium od 2026-10-15 (commit
     `ecb290d`), a każdą grę zaczętą przed wdrożeniem S-03 zamknęło już sprzątanie po 12 h (CSG:29).
   - Notatka o odłożeniu nie ma daty zamknięcia okna: `follow-ups/review-fixes.md:7-10`.
3. **Ciche `ok` dla odsłony pominiętej rundy.** Stan się nie psuje, ale nielegalny ruch zgłasza sukces. Dziś da się go
   wywołać tylko wprost, przez RPC.

---

## Krok 4: projekt agregatu-strażnika „Gra”

### 4.1 Granica agregatu i nazwy

- **Korzeń: Gra** (`game`), wiersz `public.rooms`. Nazwa pochodzi z kodu (`start_game`, `end_game`,
  `close_stale_games`) i z UI („Zacznij grę”, „Zakończ grę”). „Pokój” zostaje nazwą miejsca i członkostwa (lobby,
  link, gracze). Nazwę trzeba jeszcze sprawdzić ze słownikiem.
- **Encja wewnątrz: Runda** (`private.rounds`). Zmieniać się może tylko najnowsza runda.
- **Wartości:** numer rundy, faza, lista uprawnionych (`eligible`, migawka z chwili otwarcia rundy; to inny agregat,
  członkostwo, trzymane jako lista identyfikatorów), urna (`ballot_boxes` + `round_voters`, istnieje tylko w fazie
  `voting`).
- **Granica spójności:** blokada wiersza pokoju. Już dziś szereguje każdy ruch w pokoju (FGE:14-15). Repozytorium robi z
  niej jedyne wejście: żadna metoda nie działa na niezablokowanej Grze.

**Dlaczego w bazie, a nie w TypeScripcie.** Agregat w Workerze nie byłby jedynym strażnikiem, bo funkcje bazy da się
wołać z pominięciem Workera (`AGENTS.md:24`). Nie byłby też atomowy: każde wywołanie RPC to osobna transakcja, a między
wywołaniami nie ma blokady. W TS zostaje tylko model odczytu (`shared.ts:16-73`) i cienkie trasy.

### 4.2 Nazwane błędy domenowe

- Jeden SQLSTATE dla każdej spodziewanej odmowy gry: `MLT01` (klasa `ML` leży w zakresie zostawionym implementacji).
  Komunikat to sam kod z zamkniętej listy, tej samej co dziś (`errors.ts:7-18` plus `room_unknown`, `room_closed`).
- Odmowy zgłasza jeden pomocnik:

```sql
-- Nazwana odmowa domeny. Komunikat to tylko kod, bez DETAIL, HINT i wartości wiersza.
create function private.refuse(p_reason text) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'MLT01', message = p_reason;
end $$;
```

- Fasada publiczna łapie **tylko** `MLT01` i oddaje to samo `{ok: false, reason}` co dziś. Kontrakt z Workerem i z
  `test-plan.md` się nie zmienia. Każdy inny błąd leci dalej (fail-fast; zakaz połykania, `AGENTS.md:20`).
- Zgodność z regułą „odmowa to dane, nie wyjątek, którego DETAIL niósłby wartości wiersza” (FLR:11-12):
  - wyjątek nie wychodzi poza funkcję, więc nie trafia do PostgREST, do logów ani do `cron.job_run_details`;
  - komunikat nie niesie nicku, celu ani identyfikatora.
- Zysk: blok `exception` w fasadzie to punkt zapisu (savepoint). Odmowa zgłoszona nawet po zapisie cofa ten zapis.
  Zasada „sprawdzaj przed pierwszym zapisem” (FLR:11) staje się gwarancją, a nie dyscypliną.
- Wariant zapasowy (decyzja 0.4): funkcje warunków zwracają `text` (kod albo `null`), a fasada robi
  `if v_reason is not null then return refusal`. Działa bez wyjątków, ale nie daje cofnięcia ani fail-fast w
  zagnieżdżonych wywołaniach.

### 4.3 Repozytorium: ładowanie Gry zamiast rozsianych zapytań

```sql
-- Stan agregatu: korzeń i jego najnowsza runda. Typ w schemacie private (role API nie mają do niego usage, FLR:797).
create type private.game as (
  room_id uuid, host_id uuid, status text,
  round_id uuid, round_number integer, round_phase text, eligible uuid[]
);

-- Ładuje Grę. Zawsze najpierw blokuje wiersz pokoju (FLR:14-16), potem czyta najnowszą rundę.
-- To jedyna definicja „najnowszej rundy” po stronie poleceń.
create function private.game_lock(p_room_id uuid) returns private.game
language plpgsql set search_path = '' as $$
declare g private.game;
begin
  select r.id, r.host_id, r.status into g.room_id, g.host_id, g.status
  from public.rooms r where r.id = p_room_id
  for update;
  if g.room_id is null then perform private.refuse('room_unknown'); end if;
  if g.status = 'playing' then
    select x.id, x.number, x.phase, x.eligible
      into g.round_id, g.round_number, g.round_phase, g.eligible
    from private.rounds x where x.room_id = p_room_id
    order by x.number desc limit 1;
  end if;
  return g;
end $$;

-- Kto głosuje: host po auth.uid(), gość po skrócie tokenu (dziś FGE:294-303). Wiersza gracza nigdy nie blokuje (FLR:14-16).
create function private.game_voter(g private.game, p_player_token text) returns uuid … ;  -- obcy: refuse('room_unknown')

-- Prowadzący. Dziś to host. S-07 (współhost) zmienia tylko tę funkcję.
create function private.game_require_leader(g private.game) returns void … as $$
begin
  if (select auth.uid()) is distinct from g.host_id then perform private.refuse('room_unknown'); end if;
end $$;
```

„Zapis” agregatu to zapisy wewnątrz metod, w tej samej transakcji, pod tą samą blokadą. Osobnej funkcji `save` nie
ma, bo jednostką pracy jest jedno wywołanie RPC.

### 4.4 Metody domenowe z warunkami wstępnymi

```sql
-- Wspólny warunek ruchu w rundzie: gra w toku, runda istnieje, numer z ekranu jest numerem najnowszej rundy.
create function private.round_require_current(g private.game, p_round integer) returns void … as $$
begin
  if g.status = 'closed' then perform private.refuse('room_closed'); end if;
  if g.status <> 'playing' or g.round_id is null then perform private.refuse('no_round'); end if;
  if p_round is null or p_round <> g.round_number then perform private.refuse('round_over'); end if;  -- T1, bez wyjątków
end $$;

-- Głos (FR-008, D2): dziś FGE:255-392.
create function private.round_vote(g private.game, p_voter uuid, p_round integer, p_target text) returns void … as $$
declare v_target uuid;
begin
  perform private.round_require_current(g, p_round);
  if g.round_phase = 'revealed' then perform private.refuse('round_revealed'); end if;
  if g.round_phase <> 'voting' then perform private.refuse('round_over'); end if;
  if not (p_voter = any (g.eligible)) then perform private.refuse('no_round'); end if;
  if exists (select 1 from private.round_voters v where v.round_id = g.round_id and v.player_id = p_voter) then
    perform private.refuse('already_voted');
  end if;
  if p_target is not null then
    select p.id into v_target from public.players p
    where p.room_id = g.room_id and p.nick = p_target and p.id = any (g.eligible);
    if v_target is null then perform private.refuse('unknown_target'); end if;
  end if;
  -- Skutki dopiero po wszystkich warunkach; te same zapisy co dziś (FGE:363-379).
  insert into private.round_voters (round_id, player_id) values (g.round_id, p_voter);
  insert into private.ballot_boxes (round_id) values (g.round_id) on conflict (round_id) do nothing;
  -- … licznik celu albo abstained, jak dziś
  if (select count(*) from private.round_voters v where v.round_id = g.round_id) >= cardinality(g.eligible) then
    perform private.round_leave_voting(g.round_id, 'revealed');   -- ostatni uprawniony głos odsłania (N5)
  end if;
end $$;

-- Odsłona (FR-009, D3): dziś FLR:723-769.
create function private.round_reveal(g private.game, p_round integer) returns void … as $$
begin
  perform private.round_require_current(g, p_round);
  if g.round_phase = 'voting' then perform private.round_leave_voting(g.round_id, 'revealed'); return; end if;
  if g.round_phase = 'revealed' then return; end if;  -- D3: ten sam ruch drugi raz (podwójne kliknięcie) nic nie zmienia
  perform private.refuse('round_over');               -- pominięta runda nie ma czego odsłonić (decyzja 0.3)
end $$;

-- Pominięcie (FR-006, D2, D3 z S-03): dziś FGE:140-203.
create function private.round_skip(g private.game, p_round integer, p_candidates text[]) returns void … as $$
begin
  perform private.round_require_current(g, p_round);
  if g.round_phase = 'revealed' then perform private.refuse('round_revealed'); end if;
  if g.round_phase <> 'voting' then perform private.refuse('round_over'); end if;
  perform private.round_leave_voting(g.round_id, 'skipped');               -- głosy przepadają
  perform private.open_next_round(g.room_id, g.round_number + 1, p_candidates);
  -- false = pula wyczerpana; gra trwa świadomie (D2), to nie odmowa
end $$;

-- Następne pytanie (FR-015, D1 z S-03): dziś FGE:79-135.
create function private.round_next(g private.game, p_round integer, p_candidates text[]) returns void … as $$
begin
  perform private.round_require_current(g, p_round);
  if g.round_phase = 'voting' then perform private.refuse('round_in_progress'); end if;
  if not private.open_next_round(g.room_id, g.round_number + 1, p_candidates) then
    perform private.refuse('no_questions');
  end if;
end $$;

-- Start (US-01): dziś FLR:540-594. Listę uprawnionych liczy już tylko open_next_round (FGE:61-63).
create function private.game_start(g private.game, p_question text) returns void … as $$
begin
  if g.status = 'closed' then perform private.refuse('room_closed'); end if;
  if g.status <> 'lobby' then perform private.refuse('game_started'); end if;
  if p_question is null or p_question !~ '^[a-z0-9-]+-[0-9]{3}$' then perform private.refuse('invalid_question'); end if;
  if (select count(*) from public.players p where p.room_id = g.room_id) < 3 then
    perform private.refuse('not_enough_players');
  end if;
  perform private.open_next_round(g.room_id, 1, array[p_question]);
  update public.rooms set status = 'playing', started_at = now() where id = g.room_id;
end $$;

-- Koniec gry (FR-006, D4): dziś FGE:207-242.
create function private.game_end(g private.game) returns void … as $$
begin
  if g.status = 'closed' then perform private.refuse('room_closed'); end if;
  if g.status <> 'playing' then perform private.refuse('no_round'); end if;
  perform private.game_close(g.room_id);
end $$;

-- Jedyne zamknięcie gry: „Zakończ grę”, „Nowa gra” (create_room) i sprzątanie (close_stale_games).
-- Bez odmów, bo sprzątanie nie może niczego rzucić (CSG:14-16).
create function private.game_close(p_room_id uuid) returns void … as $$
begin
  update public.rooms set status = 'closed' where id = p_room_id;
  perform private.drop_round_state(p_room_id);       -- urna każdej rundy pokoju (FLR:166-178)
end $$;

-- Jedyne wyjście z fazy voting i jedyne miejsce, które kasuje urnę jednej rundy (N2).
create function private.round_leave_voting(p_round_id uuid, p_phase text) returns void … as $$
begin
  if p_phase = 'revealed' then
    -- dzisiejsze ciało finish_round (FLR:192-208): liczby dla każdego uprawnionego, zera też, abstained, ballots
  elsif p_phase = 'skipped' then
    update private.rounds set phase = 'skipped' where id = p_round_id;
  else
    raise exception 'unexpected phase';   -- błąd programisty, nie odmowa domeny, więc nikt go nie łapie
  end if;
  delete from private.round_voters where round_id = p_round_id;
  delete from private.ballot_boxes where round_id = p_round_id;
end $$;
```

Kolejność odmów odpowiada dzisiejszej, więc testy z fazy 1 nie zmieniają oczekiwań. Przykład dla głosu: obcy
(`room_unknown`), potem `room_closed`, `no_round`, `round_over`, `round_revealed`, `round_over`, `no_round`,
`already_voted`, `unknown_target` (FGE:290-361). Jedyny wyjątek to brak numeru, który zmienia faza 2.

### 4.5 Atomowość: całość w jednej transakcji

- Jedno wywołanie RPC to jedna transakcja. Na tym opiera się już dziś „Nowa gra” (FLR:217-219) i „Pomiń”, które
  otwiera następne pytanie „in the same transaction” (FGE:7-9).
- Blokada wiersza pokoju (`game_lock`) szereguje każde polecenie danego pokoju: głos, odsłonę, pominięcie, następne,
  koniec, dołączenie (`join_room` FLR:330-335) i sprzątanie (`for update skip locked`, CSG:30).
- Odmowa `MLT01` cofa wszystko, co polecenie zdążyło zapisać (punkt zapisu fasady).
- Mechanizm nie dodaje kolumny, czasu, sekwencji ani blokady wiersza gracza, a fasada nie zwraca celu ani liczb.
  Wszystkie reguły z nagłówków FLR:4-16 i FGE:14-17 zostają w mocy.

### 4.6 Cienkie fasady SQL i trasy Workera

```sql
-- Fasada: wejście → ładowanie Gry → metoda → odpowiedź. Tak samo dla next_round, skip_round, end_game, start_game.
create or replace function public.reveal_round(p_room_id uuid, p_round integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g private.game;
begin
  g := private.game_lock(p_room_id);
  perform private.game_require_leader(g);
  perform private.round_reveal(g, p_round);
  return jsonb_build_object('ok', true);
exception
  when sqlstate 'MLT01' then                                     -- tylko odmowy domeny
    return jsonb_build_object('ok', false, 'reason', sqlerrm);
end $$;

-- Głos: format tokenu zostaje błędem 22023 jak dziś (FGE:278-281), bo to nie odmowa domeny.
create or replace function public.cast_vote(p_room_id uuid, p_target text, p_player_token text default null,
                                            p_round integer default null) …
begin
  if p_player_token is not null and p_player_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid player token' using errcode = '22023';
  end if;
  g := private.game_lock(p_room_id);
  perform private.round_vote(g, private.game_voter(g, p_player_token), p_round, p_target);
  return jsonb_build_object('ok', true);
exception when sqlstate 'MLT01' then return jsonb_build_object('ok', false, 'reason', sqlerrm);
end …;
```

Trasa Workera robi: parsowanie, metodę agregatu (RPC) i zamianę odmowy na odpowiedź. Trasy są już cienkie, dochodzi
tylko numer:

```ts
// src/pages/api/rooms/[id]/reveal.ts po fazie 2c (wzór: skip.ts:22-25)
const body = await readJsonBody(context, OP);
if (!body.ok) return body.response;
const round = bodyRound(body.body);
if (typeof round !== "number") return actionAnswer(OP, roomId, { ok: false, reason: "invalid_body" });
if (!context.locals.user) return actionAnswer(OP, roomId, OUTSIDE_ROOM);
// …
const result = await revealRound(supabase, roomId, round);   // server.ts: p_round zawsze wysłany
if (result.ok) await ringLobby(context.locals, supabase, roomId);
return actionAnswer(OP, roomId, result);
```

Zamiana odmowy na odpowiedź zostaje bez zmian (`json-route.ts:118-138`):

| Odmowa | Odpowiedź |
| --- | --- |
| `room_unknown` | 404 `{error: "not_found"}` |
| `invalid_body` | 400 |
| `service_unavailable` | 503 |
| `unexpected` | 500 |
| każda inna (`round_over` i reszta) | 409 `{error: kod}`; tekst dla gracza z `errors.ts:22-43`, np. „To pytanie już się zmieniło.” |

**Egzekucja przechodzi z klienta na serwer:**

- ekran wysyła numer przy odsłonie: `act("reveal", { round })` i `onReveal(round.number)`;
- ukrywanie przycisków (`RoundVoting.tsx:271-301`, `RoundSkipped.tsx:40`) zostaje tylko podpowiedzią dla gracza, tak
  jak `MIN_PLAYERS` („start_game has the final word”, `shared.ts:5`);
- o regule decyduje wyłącznie `private.round_require_current`.

### 4.7 Zgodność z AGENTS.md

- Anonimowość (`AGENTS.md:7`):
  - nowy mechanizm nie zapisuje, nie loguje i nie zwraca pary „kto na kogo”;
  - urnę piszą tylko `open_next_round` i `round_vote`, a kasują tylko `round_leave_voting` i `drop_round_state`
    (przez `game_close`);
  - sprzątanie po 12 h zostaje, wywołuje `game_close`.
- Bez punktów, rankingu i timera (`AGENTS.md:8`): nic takiego nie dochodzi.
- Funkcje i migracje (`AGENTS.md:21-25`):
  - każda nowa funkcja `private.*` ma `set search_path = ''`, nazwy z prefiksem schematu, `revoke execute … from
    public, anon, authenticated` i żadnych grantów;
  - fasady zostają `security definer` z właścicielem `postgres` i dotychczasowymi grantami;
  - `create or replace` zachowuje granty, ale projekt powtarza `revoke` i `grant` przy każdej funkcji, którą plik
    tworzy albo podmienia (FLR:782-783);
  - typ `private.game`: na wszelki wypadek `revoke usage on type … from public`.
- Każda poprawka to nowa migracja z `npx supabase migration new <nazwa>`. Żadna wypchnięta migracja nie jest
  edytowana. `db push` tylko po pytaniu (`AGENTS.md:9,25`).
- Zmiany w `supabase/migrations/`, `src/lib/rooms/`, `src/pages/api/rooms/` i `tests/` idą tylko przez PR, scalane
  przy zielonym CI z jobem `db` (`AGENTS.md:10`).

---

## Krok 5: przed i po, plan faz, testy

### 5.1 Przed i po: każde dzisiejsze miejsce reguły

| Miejsce | Dziś | Po zmianie |
| --- | --- | --- |
| `cast_vote` (FGE:255-392) | ok. 135 linii: blokada, głosujący, stan, najnowsza runda, **numer opcjonalny** (:328-331), faza, uprawnieni, raz, cel, zapis, odsłona | fasada ok. 10 linii: format tokenu, `game_lock`, `game_voter`, `round_vote`; numer obowiązkowy |
| `reveal_round` (FLR:723-769) | brak numeru; `skipped` daje `ok` (:763-767) | fasada z `p_round`; `round_reveal`: inny numer i `skipped` dają `round_over`; drugie odsłonięcie dalej `ok` (D3) |
| `next_round` (FGE:79-135) | własna blokada, sprawdzenie hosta, najnowsza runda, numer, faza | fasada i `round_next` |
| `skip_round` (FGE:140-203) | kasuje urnę wprost (:195-197) | fasada i `round_skip`, kasowanie przez `round_leave_voting` |
| `end_game` (FGE:207-242) | `update` i `drop_round_state` (:237-238) | fasada, `game_end`, `game_close` |
| `start_game` (FLR:540-594) | uprawnieni (:576-578), próg 3 (:580-582), własny zapis rundy | fasada, `game_start` i `open_next_round` (uprawnieni liczeni w jednym miejscu) |
| `finish_round` (FLR:182-213) | osobny pomocnik odsłony | ciało przechodzi do `round_leave_voting('revealed')`; funkcja usunięta po przełączeniu |
| `drop_round_state` (FLR:166-178) | wołana w 3 miejscach po `update` statusu | wołana tylko przez `game_close` |
| `open_next_round` (FGE:38-73) | otwiera rundę n+1 | bez zmian; teraz też runda 1 przy starcie |
| `create_room` (FLR:269-280) | sam zamyka stary pokój | zamyka go przez `game_close`; reszta bez zmian |
| `close_stale_games` (CSG:26-34) | `update` i `drop_round_state` | pętla woła `game_close` |
| sprawdzenie hosta ×5 (FLR:559-562, :742-745, FGE:98-101, :160-163, :224-227) | 5 kopii | `game_require_leader` (S-07 zmienia tylko ją) |
| najnowsza runda ×4 w poleceniach | 4 kopie | `game_lock` |
| `room_lobby` (FGE:403-519) | strona odczytu | bez zmian (to nie polecenie) |
| `json-route.ts:109-116` | „a vote takes either” | funkcja bez zmian; komentarz: numer obowiązkowy dla każdego ruchu rundy |
| `vote.ts:33-37` | `round === null` przechodzi | `typeof round !== "number"` daje `invalid_body` (jak `next.ts:26`) |
| `reveal.ts:11-25` | bez treści | czyta `{round}` |
| `server.ts:239-263` | `castVote(…, round: number \| null)`, `revealRound(roomId)` | `castVote(…, round: number)`, `revealRound(roomId, round)` |
| `RoomScreen.tsx:124-125` | odsłona wysyła `{}` | odsłona wysyła `{ round }` |
| `RoundVoting.tsx:40-45, 276-284` | `onReveal: () => …` | `onReveal: (round: number) => …`, `run: () => onReveal(round.number)` |
| `RoundSkipped.tsx:40`, `HostActions.tsx:100-120` | ukrywanie przycisków i „busy” | bez zmian, już tylko podpowiedź |
| `tests/db/game-rules.test.ts:152-156` | utrwala dziurę (`ok: true`) | faza 1: `it.fails("znana dziura F2 → …")` z oczekiwaniem `round_over`; faza 2c: znacznik zdjęty |
| `tests/db/support/rounds.ts:96-115` | głos i odsłona bez numeru | numer obowiązkowy w `castVote` i `revealRound` (także w seedach) |
| pgTAP `round_creator_view.test.sql:160-165, 193-212` | pomocnicy bez numeru | z numerem rundy; nowy test „jedna wersja `reveal_round`” na wzór `:586-595` |
| `scripts/smoke.mjs:272-274` | głosy S-02 bez numeru | `round: 1`; nowy krok „głos bez numeru dostaje 400” |

### 5.2 Plan faz

Zasady planu:

- najpierw zabezpieczenie;
- każda faza to osobny PR i osobna migracja, którą da się cofnąć sama;
- zmiana zachowania jest osobną zmianą;
- przełączanie funkcja po funkcji (Strangler Fig), nowe funkcje obok starych (Branch by Abstraction), od liści w górę
  (kolejność Mikado).

Projekt ma dyscyplinę test-first: „Testy bazy powstały przed migracją i świeciły na czerwono” (`test-plan.md:306`),
znane dziury jako `it.fails` (`test-plan.md:172-174`), próbne alarmy (`test-plan.md:190-194`). Fazy oznaczone
**[TF]** zaczynają się od czerwonego testu.

| Faza | Co | [TF] | Zmienia zachowanie? | Wdrożenie | Jak cofnąć |
| --- | --- | --- | --- | --- | --- |
| **0. Decyzje** | Karol odpowiada na 0.1–0.4 (niżej); nazwy sprawdzone ze słownikiem | — | — | — | — |
| **1. Zabezpieczenie** | nowy `tests/db/round-lifecycle.test.ts` (jeden host, `test-plan.md:183`): tabela 3.1 przypadek po przypadku z dzisiejszymi kodami (bez utrwalania dziur); 3× `it.fails("znana dziura F2 → round-number-required: …")` (głos bez numeru, odsłona ze starym numerem, odsłona pominiętej rundy); `game-rules.test.ts:154` przerobiony na `it.fails` z wyrocznią T1; dwie luki: głos i odsłona w zamkniętej grze dają `room_closed` | to jest sam test | nie | PR tylko z testami | revert PR |
| **2. Domknięcie F2** (osobna zmiana, np. `round-number-required`; dokładnie według `review-fixes.md:9`) | **2a:** migracja: `drop function public.reveal_round(uuid)` i `create … reveal_round(p_room_id uuid, p_round integer default null)` w jednej migracji (jedna wersja; lekcja T1, `full-game-evening/plan.md:83`); inny numer daje `round_over`, brak numeru działa jak dziś. **2b:** Worker i ekran wysyłają numer przy odsłonie; trasy jeszcze przyjmują brak numeru. **2c:** migracja: brak numeru daje `round_over` w `cast_vote` i `reveal_round`; odsłona `skipped` daje `round_over`; trasy odpowiadają `invalid_body`; pomocnicy testów, pgTAP i smoke z numerem | tak: `it.fails` z fazy 1 i pgTAP „jedna wersja `reveal_round`” czerwone przed 2a/2c | **tak** (dlatego osobna zmiana) | „baza, potem kod” (FGE:19-21): 2a, potem 2b, potem 2c co najmniej 13 h po 2b (każda gra sprzed 2b zamknięta przez sprzątanie, CSG:29) | 2c: nowa migracja przywracająca tolerancję braku numeru; 2b: `wrangler rollback` (pytanie); 2a jest zgodna wstecz |
| **3. Jedno wyjście z głosowania, jedno zamknięcie** | migracja: `private.round_leave_voting`, `private.game_close`; przełączenie `cast_vote`, `reveal_round`, `skip_round`, `end_game`, `create_room`, `close_stale_games`; `finish_round` usunięta | tak: strażnicy strukturalni S1–S2 (5.4) czerwoni przed | nie | tylko baza, Worker bez zmian | przed `db push`: revert PR; po: nowa migracja z poprzednimi ciałami (kopie z FLR, FGE, CSG) |
| **4. Repozytorium Gry** | migracja: typ `private.game`, `private.game_lock`, `private.game_voter`, `private.game_require_leader`; 6 fasad ładuje Grę przez repozytorium, sprawdzenia jeszcze wpisane w fasady | tak: S4 (katalog nowych funkcji) czerwone przed | nie | tylko baza | jak w fazie 3 |
| **5. Metody domenowe i nazwane odmowy** | migracja: `private.refuse`, `private.round_require_current`, `round_vote`, `round_reveal`, `round_skip`, `round_next`, `game_start`, `game_end`; fasady łapią tylko `MLT01`; przełączanie od najmniej ryzykownej: `end_game`, `next_round`, `skip_round`, `start_game`, `reveal_round`, `cast_vote`, każda w osobnym commicie | tak: S3 („fasady łapią tylko `MLT01`”) czerwone przed; tabela z fazy 1 zielona przez całą fazę | nie | tylko baza | jak w fazie 3; przed `db push` revert pojedynczego commitu |

**Kolejność.** Rekomendacja to 1 → 2 → 3 → 4 → 5:

- faza 2 jest mała, zamyka jedyną realną dziurę i daje wartość w grze od razu;
- fazy 3–5 to czysta struktura, która zwraca się przy S-07, więc trzeba je skończyć przed nim (decyzja 0.2);
- kolejność 1 → 3 → 4 → 5 → 2 też jest poprawna. Wtedy `round_require_current` w fazie 5 dostaje jawny, nazwany
  parametr `p_allow_missing_round` (true tylko dla głosu i odsłony), a faza 2 sprowadza się do jego usunięcia.

**Zależność.** Strażnik bramy RPC K1 z `refactor-opportunities` (ręczna tabela sygnatur,
`refactor-opportunities/plan-brief.md:16-19,34`) w fazie 2b musi dostać `p_round` przy `reveal_round`.

**Po planie.** S-07 dopisuje współhosta tylko w `private.game_require_leader`. S-09 (głosy usuniętego gracza,
`roadmap.md:222`) zmienia `round_vote` i `round_leave_voting`, nie pięć funkcji.

### 5.3 Przypadki testowe niezmiennika

Wyrocznie pochodzą z PRD i z decyzji właściciela, nigdy z implementacji (`test-plan.md:30-32,140`).
Kolumna „Dziś”:

- **jest**: test już istnieje, cytuję go;
- **nowy**: dochodzi w fazie 1;
- **it.fails**: znana dziura, czerwona do fazy 2c.

**Legalne przejścia**

| ID | Ruch i stan | Oczekiwane | Wyrocznia | Dziś |
| --- | --- | --- | --- | --- |
| L1 | start w lobby, 3 graczy | `ok`; runda 1 w `voting`; gra `playing` | US-01 (`prd.md:69-71`) | jest: pgTAP `:604` |
| L2 | głos z bieżącym numerem: na kogoś, na siebie, wstrzymanie | dokładnie `{ok: true}` | FR-008 (`prd.md:101`) | jest: `round-rules.test.ts:107-119`, `round-anonymity.test.ts:118`, `game-rules.test.ts:208` |
| L3 | ostatni uprawniony głos | `revealed`; liczby równe głosom, zera też; urna pusta | FR-009, US-01 AC (`prd.md:76`) | jest: pgTAP `:608-611` |
| L4 | odsłona z bieżącym numerem po 1 głosie | `revealed`, urna pusta | FR-009, D3 (`first-live-round/research.md:282`) | jest bez numeru: `round-rules.test.ts:276-280`; nowy: z numerem |
| L5 | druga odsłona z tym samym numerem | `ok`, wynik bez zmian | D3, FLR:721-722 | jest bez numeru: `round-rules.test.ts:288-294`; nowy: z numerem |
| L6 | pominięcie z bieżącym numerem w `voting` | `skipped`, bez liczb, urna pusta, następne pytanie otwarte, `after_skip` | FR-006; D2, D3 (`full-game-evening/research.md:145-146`) | jest: `game-rules.test.ts:178-191`, pgTAP `:646-651` |
| L7 | pominięcie ostatniego pytania | `ok`; najnowsza runda `skipped`; gra trwa | D2 | jest: `game-rules.test.ts:262-270` |
| L8 | następne z bieżącym numerem po odsłonie | runda n+1 w `voting`, pierwszy niezagrany kandydat | FR-015, D1 S-03 | jest: `game-rules.test.ts:137-152` |
| L9 | następne po pominiętej, z nowym kandydatem | runda n+1 | `full-game-evening/plan.md:214` | nowy |
| L10 | koniec w `voting`, po odsłonie, po ostatnim pominięciu | `closed`, urna pusta, brak rundy w stanie | FR-006, D4 | jest: `game-rules.test.ts:281-288, 313-347`, pgTAP `:672-675` |
| L11 | „Nowa gra” w trakcie głosowania | stara gra `closed`, urna pusta | D1 S-02 | jest: pgTAP `:618-625` |
| L12 | sprzątanie gry starszej niż 12 h | `closed`, urna pusta | `AGENTS.md:7` | jest: pgTAP `:711-718` i dalej |

**Nielegalne ruchy** (każdy: nazwana odmowa, stan i urna bez zmian)

| ID | Ruch i stan | Oczekiwane | Wyrocznia | Dziś |
| --- | --- | --- | --- | --- |
| I1 | głos z numerem rundy N-1, gdy głosuje N | `round_over` | T1 | jest: `game-rules.test.ts:174` |
| I2 | głos bez numeru | `round_over` (Worker: 400 `invalid_body`) | T1, F2 | **it.fails** (przeróbka `game-rules.test.ts:154`) |
| I3 | głos po odsłonie | `round_revealed` | D2 S-02 | jest: `round-rules.test.ts:284` |
| I4 | głos na pominiętą rundę | `round_over` | D3 S-03 | jest: `game-rules.test.ts:193, 272` |
| I5 | drugi głos | dokładnie `{ok: false, reason: "already_voted"}` | FR-008, D2 | jest: `round-rules.test.ts:127-128`, `round-anonymity.test.ts:124-125` |
| I6 | głos na nick spoza uprawnionych | `unknown_target` | FR-008 („z listy nicków”) | jest: `round-rules.test.ts:134-135` |
| I7 | głos w lobby; głos w zamkniętej grze | `no_round`; `room_closed` | FR-006 (koniec gry) | jest: `round-rules.test.ts:316`; nowy: zamknięta |
| I8 | odsłona z numerem N, gdy głosuje N+1 | `round_over`; N+1 dalej w `voting` z nietkniętymi głosami | T1, F2 (`impl-review.md:76`) | **it.fails** |
| I9 | odsłona pominiętej najnowszej rundy | `round_over` | decyzja 0.3 | **it.fails** |
| I10 | odsłona w lobby / w zamkniętej / przez gościa / przez obcego hosta | `no_round` / `room_closed` / `42501` / `room_unknown` | Access Control (`prd.md:169`) | jest: `round-rules.test.ts:322, 203`; nowy: zamknięta |
| I11 | pominięcie ze starym numerem, dwa razy, po odsłonie, w lobby | `round_over`, `round_over`, `round_revealed`, `no_round` | T1, D2 | jest: `game-rules.test.ts:197, 235, 290-312` |
| I12 | następne w `voting`, ze starym numerem, bez kandydatów, po końcu | `round_in_progress`, `round_over`, `no_questions`, `room_closed` | T1, D1, D2 | jest: `game-rules.test.ts:158, 162, 239, 276, 353-361` |
| I13 | koniec w lobby; po końcu | `no_round`; `room_closed` | FR-006 | jest: `game-rules.test.ts:290-312, 353-361` |
| I14 | start drugi raz, w zamkniętym, przy 2 graczach, ze złym id | `game_started`, `room_closed`, `not_enough_players`, `invalid_question` | US-01 | jest: `round-rules.test.ts:175, 328-331, 346, 337-341` |
| I15 | po każdej odmowie z I1, I8, I9 | `voted`, liczby i faza bez zmian | fail-fast | częściowo jest: `game-rules.test.ts:166`; nowy: wspólna asercja |

**Worker i smoke.** Trasy nie mają testów jednostkowych, bo importują `astro:*` (`test-plan.md:139`). Dlatego w
fazie 2c dochodzą kroki smoke: głos bez `round` i odsłona bez `round` dostają 400 `invalid_body`, odsłona ze starym
numerem dostaje 409 `round_over`. `bodyRound` ma już test jednostkowy (`tests/unit/json-route.test.ts`).

### 5.4 Strażnicy strukturalni (pgTAP, widok twórcy)

Pilnują, że agregat jest **jedynym** miejscem egzekwowania. Działają jak ast-grep, tylko dla SQL: przez
`pg_proc.prosrc` w schemacie `public` i `private`.

- **S1.** Do urny (`insert`/`update`/`delete` na `private.ballot_boxes` i `private.round_voters`) piszą tylko
  `open_next_round`, `round_vote`, `round_leave_voting` i `drop_round_state`.
- **S2.** `private.rounds.phase` zmienia tylko `round_leave_voting`. `public.rooms.status` zmieniają tylko
  `game_start` i `game_close`.
- **S3.** Każda publiczna funkcja gry łapie wyłącznie `sqlstate 'MLT01'`: nigdzie nie ma `when others`.
- **S4.** Każda nowa funkcja `private.*` nie ma grantów, ma właściciela `postgres` i `search_path=''`. Wzór:
  `function_facts`, `:581-583`.
- **S5.** `reveal_round` i `cast_vote` istnieją w dokładnie jednej wersji. Wzór: `:586-595`.

Każdego strażnika sprawdza próbny alarm według `test-plan.md:190-194`. Przykład: tymczasowa migracja kasuje urnę wprost
w nowej funkcji, więc S1 musi zaświecić na czerwono.

### 5.5 Nowe nazwy „load-bearing”

Projekt nie ma osobnego rejestru kontraktów. Szukałem „kontrakt”, „load-bearing” i „rejestr” w `context/foundation/`,
`AGENTS.md` i `README.md` i nic nie znalazłem. Nośne nazwy zapisuje dziś:

- nagłówek migracji (lista niezmienników: FLR:4-16, FGE:4-17);
- lista pomocników w `test-plan.md:159-163`;
- zamknięta lista kodów w `src/lib/rooms/errors.ts:7-18`;
- planowana tabela K1.

Do zarejestrowania (nagłówek nowej migracji i `test-plan.md` §6.2; reguła w `AGENTS.md` tylko za zgodą Karola):

- **SQLSTATE `MLT01`**, czyli spodziewana odmowa gry, i `private.refuse(text)`;
- **typ `private.game`** i repozytorium: `private.game_lock(uuid)`, `private.game_voter(private.game, text)`,
  `private.game_require_leader(private.game)`;
- **warunek:** `private.round_require_current(private.game, integer)`;
- **metody:** `private.round_vote`, `private.round_reveal`, `private.round_skip`, `private.round_next`,
  `private.game_start`, `private.game_end`, `private.game_close`, `private.round_leave_voting`;
- **zmieniona sygnatura:** `public.reveal_round(uuid, integer)`;
- **usunięta:** `private.finish_round(uuid)`;
- **bez zmian (kontrakt Workera):** `start_game`, `cast_vote(uuid, text, text, integer)`, `next_round`,
  `skip_round`, `end_game`, `create_room`, `room_lobby`, `private.open_next_round`, `private.drop_round_state` i
  wszystkie kody odmów;
- **proponowana reguła do `AGENTS.md` (Conventions):** „Każda nowa funkcja gry ładuje Grę przez `private.game_lock` i
  zmienia ją tylko metodami agregatu; spodziewana odmowa tylko przez `private.refuse`.”

### 5.6 Decyzje dla właściciela, poza zakresem i ryzyka

**Decyzje (faza 0):**

- **0.1** Domknąć F2 teraz (faza 2)? Rekomendacja: tak, przed S-07.
- **0.2** Fazy agregatu (3–5) przed S-07? Rekomendacja: tak, jeśli S-07 jest następne; jeśli nie, mogą poczekać.
- **0.3** Odsłona pominiętej rundy: `round_over` (rekomendacja; ten sam kod co głos i pominięcie na pominiętej rundzie,
  FGE:191-193, :337-340) czy zostawić `ok`?
- **0.4** Mechanizm odmów: `raise` z `MLT01` i łapanie w fasadzie (rekomendacja) czy funkcje warunków zwracające
  kod?

**Poza zakresem:**

- N7 (kategorie i 18+ sprawdzane tylko w Workerze);
- nieużywany parametr `p_link_token` w `create_room` (FLR:18-20, też „usunąć później”);
- F3 i F5 z `review-fixes.md:12-20`;
- `hostQuestionsLeft`, które w Workerze powtarza wiedzę bazy („N rund = N pytań”, `server.ts:207-224`);
- typowany związek kodów odmów (K3 w `refactor-opportunities`);
- przywracanie własnego głosu po odświeżeniu (S-04);
- głosy usuniętego gracza (S-09, OQ3).

**Ryzyka:**

- Blok `exception` dodaje jeden punkt zapisu na wywołanie. Przy 20 graczach koszt jest pomijalny, ale warto zmierzyć
  przy próbie 6.5.
- Przebudowa sześciu funkcji ma duży zasięg. Siatką bezpieczeństwa jest CI `db` (175 testów Vitest i 105 asercji pgTAP
  po S-03, `test-plan.md:306`) i przełączanie po jednej funkcji.
- Zmiana sygnatury `reveal_round`: przeciążenia w PostgREST, więc zawsze jedna wersja i test S5.
- Workers Builds wdraża `main` nawet przy czerwonym CI (`AGENTS.md:32`): bramka przed każdym `git push`.
- Nazwy „Gra”, „Runda” i „urna” trzeba zweryfikować z `context/domain/glossary.md`, którego ta analiza celowo nie
  czytała.
