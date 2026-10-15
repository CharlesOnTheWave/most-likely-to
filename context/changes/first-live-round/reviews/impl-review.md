<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Pierwsza runda na żywo (S-02) z testami anonimowości i reguł rundy (first-live-round)

- **Plan**: context/changes/first-live-round/plan.md
- **Scope**: Full plan (fazy 1–5 ukończone; faza 6, czyli przegląd i wdrożenie, właśnie trwa)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-15
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 5 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

Kryteria automatyczne powtórzone 15.10 na kodzie `009ad52`:

- **Lokalnie:** `npm run lint`, `npx astro check` (0 błędów, 0 ostrzeżeń), `npm test` (252/252), `npm run test:hooks` (33/33) i `npm run build` przechodzą.
- **CI na PR #7 (run 38642446114):** `ci`, `db` (Vitest 117/117, pgTAP 56/56), `smoke` 46/46 i `e2e` 4/4 są zielone.
- **Migracje:** `git diff main...HEAD -- supabase/migrations` pokazuje tylko `20261014101922_first_live_round.sql` i `20261014101925_close_stale_games.sql`.
- **Kontrole ręczne faz 1–5:** wszystkie odhaczone. Przy 4.5 brakuje dowodu dla części „czytnik ekranu” (F7).

Odstępstwa od planu opisane w commitach faz i zatwierdzone przez Karola w trakcie:

- przełącznik „Koło | Paski”, `chart.ts`, tokeny `--chart-6…20`, pytanie powtórzone przy odsłonie, „Odsłoń wynik” w dwóch krokach (p4, po ocenie zrzutów);
- serwer wysyła `question: null`, a ekran pokazuje „Nie udało się wczytać pytania.”, zamiast tekstu zastępczego z serwera (p4);
- 400 `invalid_body` z limitem 4096 znaków w trasach JSON (p3);
- ogranicznik zwalnia tylko na dzwonkach, nie na własnych odświeżeniach ekranu (p4).

Drobne niespójności bez skutku w kodzie:

- plan 3.1 mówi „dokładnie 11 pól” logu, a 3.6 sam wymaga `hasUser` i `hasPlayerCookie`; `src/lib/log.ts` ma 13 pól;
- opis commita p3 mówi, że losowanie jest „bez powtórek”, a `src/lib/rounds/draw.ts:25` zostawia to S-03 (w S-02 gra ma jedną rundę, a `unique (room_id, question_id)` i tak pilnuje bazy).

Sprawdzone i bez uwag:

- **Uprawnienia w funkcjach `security definer`:**
  - każda funkcja rundy najpierw blokuje wiersz `rooms` (`for update`);
  - `start_game` i `reveal_round` sprawdzają `auth.uid() = host_id`, a obcy dostaje `room_unknown`;
  - `cast_vote` szuka głosującego tylko w `p_room_id`, wpuszcza tylko uprawnionych, sprawdza drugi głos przed zapisem i przyjmuje tylko cel z listy uprawnionych;
  - `create_room` tworzy kod linku w SQL; brak dynamicznego SQL w plpgsql.
- **Konwencje migracji:** RLS, `revoke all` i brak grantów na 4 nowych tabelach; `set search_path = ''` i nazwy ze schematem; `revoke execute`, potem wybiórczy `grant`; właścicielem funkcji `definer` jest `postgres`. Stary Worker tylko czyta tabele, więc odebranie hostowi `insert`/`update` nie psuje go między `db push` a scaleniem.
- **Anonimowość:**
  - żadna funkcja nie zwraca celu, a liczby pojawiają się dopiero w fazie `revealed`;
  - `voted` idzie w kolejności miejsc;
  - odmowy wracają jako dane, nie wyjątki z `DETAIL`;
  - w tabelach rundy nie ma kolumn czasu, `serial` ani `identity`; urna nielogowana i poza publikacją;
  - logowane zapisy w transakcji głosu to tylko blokady wierszy `rooms` i `rounds`.
- **Logi:**
  - `log.ts` przepuszcza tylko klucze z listy i proste wartości, a każdy `console.*` w zmienionym kodzie idzie przez `logEvent`;
  - smoke nie wypisuje celów głosu;
  - `ringRoom` loguje `code: error.message` (tekst serwera Realtime) tak samo jak na `main`, teraz z `roomId`, zgodnie z audytem L6 (429 i 401 muszą się różnić). Żądanie dzwonka niesie tylko temat (id pokoju) i `{seq}`, więc tekst nie ma czego zdradzić.
- **Współbieżność:** ta sama kolejność blokad wszędzie (`create_room`, `join_room`, sprzątanie z `skip locked`). Głos, odsłona i automatyczna odsłona po ostatnim głosie idą po kolei dzięki blokadzie pokoju.
- **XSS i reguła pytań (lessons.md, wpis 2):** brak `set:html` i `dangerouslySetInnerHTML`; `questions.ts` i `draw.ts` tylko na serwerze.
- **Trasy JSON:** start, vote, reveal i client-events sprawdzają `Content-Type` i `Origin` i wysyłają `no-store`. `PLAYER_TOKEN_PATTERN` filtruje ciasteczko przed bazą.
- **Sekrety:** brak klucza secret i `service_role`; testy tylko kluczem publishable, poza pgTAP jako właściciel (dozwolony wyjątek).
- **Ekran:** brak pustych `catch`; ogranicznik ograniczony (jedno pobranie w locie, odstęp 0,5–15 s, przerwanie po 3 s); zgłoszenia najwyżej 3 na typ.
- **UI:** kolory tylko z tokenów (`--chart-1…20` w `:root`, `.dark` i `@theme inline`); jedyny `style` to szerokość paska liczona z danych.
- **Testy wg cookbooka:** brak `beforeEach`/`afterEach` w plikach bazy; znaczniki F1 i F4 zdjęte, żaden test nie usunięty; niewidoczne znaki tylko jako `\u{…}`; wyrocznie rozpisane ręcznie; dokładne zbiory kluczy przez `toEqual`.
- **Lessons:** reguły `ask` dla `supabase test*` i `SMOKE_ROUND=*` są (wpis 1).
- **Zakres:** nic z S-03, S-04 ani S-08 nie weszło (bez następnej rundy, czasu i punktów; własny wybór tylko w pamięci ekranu, „Twój głos: X” znika po odświeżeniu).

## Findings

### F1 — Po awarii bazy w trakcie rundy nowe głosy nie są liczone, a odsłona pokazuje same zera

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261014101922_first_live_round.sql:691-701 (`cast_vote`), :182-209 (`finish_round`)
- **Detail**: Awaria Postgresa, natychmiastowe zatrzymanie albo przełączenie na replikę czyszczą tabele nielogowane: znika wiersz `private.ballot_boxes` i wiersze `private.round_voters`. Logowana `private.rounds` zostaje w fazie `voting`. Potem każdy głos zapisuje wiersz w `round_voters` i odpowiada `{ok:true}`, ale `update private.ballot_boxes … where round_id = v_round` nie trafia w żaden wiersz i nikt tego nie sprawdza. `finish_round` zamienia brakujące liczby na 0. Odsłona pokazuje wszystkich z zerem, „Wstrzymało się: 0” i `ballots = N`: zły wynik bez żadnej linii logu (ryzyko #3). Migration Notes w planie mówią „Runda w toku traci głosy, a gracze mogą zagłosować ponownie”, czyli nowe głosy miały się liczyć. Utrata głosów sprzed awarii jest przyjęta w D1. Zgubienie głosów po awarii nie jest.
- **Fix**: Najpierw nieprzechodzący test pgTAP: w rundzie w toku, jako właściciel, skasować wiersze urny tej rundy (to robi awaria), zagłosować rolami gry, odsłonić i oczekiwać liczb równych nowym głosom. Potem w `cast_vote` przed aktualizacją licznika `insert into private.ballot_boxes (round_id) values (v_round) on conflict (round_id) do nothing`. Migracja nie jest jeszcze wgrana na produkcję, więc poprawka idzie do tego samego pliku (AGENTS.md zabrania edycji tylko wgranej migracji). CI pokaże przejście z czerwonego na zielony między dwoma commitami.
  - Strength: Jedna linia SQL; wynik po awarii zgadza się z Migration Notes i z D1.
  - Tradeoff: Dwa przebiegi CI (czerwony, potem zielony) i dwa pytania o push przed `db push`.
  - Confidence: HIGH — kolumny urny mają wartości domyślne (`tally '{}'`, `abstained 0`), więc wstawiony wiersz od razu liczy.
  - Blind spot: Jak często Supabase na planie darmowym zatrzymuje bazę w trybie, który czyści tabele nielogowane, nie sprawdzono. Zwykłe, czyste zatrzymanie ich nie czyści.
- **Decision**: FIXED — test pgTAP „the reveal after a crash counts every vote cast after it” najpierw czerwony, potem `cast_vote` zakłada brakującą urnę (`on conflict do nothing`) w tej samej, jeszcze niewgranej migracji

### F2 — Nikt nie sprawdza, że `cast_vote` odmawia komuś spoza pokoju

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/db/round-rules.test.ts:50-90
- **Detail**: Kod jest poprawny: `cast_vote` (migracja :630-644) szuka głosującego tylko w `p_room_id` i odpowiada `room_unknown`. Żaden test nie woła go jednak jako host drugiego pokoju, z tokenem gościa z drugiego pokoju ani jako gość bez tokenu. Host B jest sprawdzany tylko przy `start_game` i `reveal_round`. `cast_vote` jest przyznany `anon`, a test-plan §2 #4 wymaga właśnie tego („gość nie zadziała w cudzym pokoju ani jako inny gracz”, przez RPC).
- **Fix**: W `beforeAll` scenariusza głównego trzy sondy (`castVote(hostB.client, room.id, "Ola")`, `castVote(anon, room.id, "Ola", <token Zosi z pokoju B>)`, `castVote(anon, room.id, "Ola")`), każda oczekuje dokładnie `{ok:false, reason:"room_unknown"}`, a istniejąca wyrocznia odsłony (Ola 3) zostaje bez zmian. Bez nowych rejestracji.
- **Decision**: FIXED — 3 sondy obcych (host B, token Zosi, brak tokenu) w `round-rules.test.ts`, każda `room_unknown`; wyrocznia Ola 3 bez zmian

### F3 — Nieaktualne zdania o „odsłony jeszcze nie ma” i o smoke

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/e2e/seed.spec.ts:2-3, tests/e2e/lobby-connection-drop.spec.ts:2, context/foundation/test-stack.md:16, README.md:193, :214, :219, .github/workflows/ci.yml:98, src/lib/live-sync/shared.ts:5
- **Detail**:
  - `seed.spec.ts:2-3`: „The reveal, the rest of #2, does not exist yet (S-02); no spec covers it.” — odsłona jest, a pokrywa ją `round.spec.ts`.
  - `lobby-connection-drop.spec.ts:2`: „the reveal is unbuilt (S-02)”.
  - `test-stack.md:16`: „the reveal is unbuilt until S-02”; nie wymienia `round.spec.ts`.
  - `README.md:193` (smoke, pokój): bez rundy, bez kroku „Ola”+FE0F, bez 409 dla gry w toku; w całej sekcji smoke (`:188-204`) brak `SMOKE_ROUND`.
  - `README.md:214`: „GitHub Actions runs three jobs”, a jest ich cztery (brak `e2e`; nieaktualne już na `main`).
  - `README.md:219` i `ci.yml:98`: znane dziury „znana dziura … → S-02” w logu, a dziś nie ma żadnej; README nie wspomina kroku pgTAP.
  - `src/lib/live-sync/shared.ts:5`: `LOBBY_POLL_MS` opisane jako odpytywanie lobby, a dziś steruje też ekranem gry w toku.
  - Status fazy 2 w `test-plan.md:79` („planned”) zmienia faza 6 (Notatki), więc nie jest tu ustaleniem.
- **Fix**: Jeden commit dokumentów poprawia wszystkie zdania z listy (bez zmian w kodzie i asercjach).
- **Decision**: FIXED — nagłówki `seed.spec.ts` i `lobby-connection-drop.spec.ts`, `test-stack.md`, README (smoke z rundą, FE0F i `SMOKE_ROUND`; 4 joby z pgTAP i e2e), komentarz w `ci.yml`, `LOBBY_POLL_MS` w `shared.ts`

### F4 — `island_crash` jest na liście zgłoszeń, ale nikt go nie wysyła

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/client-events.ts:8, src/pages/api/client-events.ts:27
- **Detail**: Walidator przyjmuje `island_crash`, a endpoint loguje je na poziomie `error`, ale w `src/` nic go nie wysyła: ekran pokoju nie ma granicy błędów (error boundary). Gdy ekran rundy się wysypie, gracz widzi pusty ekran, a w logach nie ma śladu, choć lista sugeruje, że będzie. Plan (3.8) wpisał zdarzenie na listę, ale 4.2 nie mówi, kto je wysyła, więc luka jest w samym planie.
- **Fix A ⭐ Recommended**: Odłożyć do follow-upu (`follow-ups/review-fixes.md`): granica błędów w `RoomScreen`, która wysyła `island_crash`, w S-03 albo przy następnym audycie obserwowalności.
  - Strength: Wdrożenie S-02 nie czeka na nowy kod ekranu; ścieżki rundy pokrywa e2e, a na pierwszym wieczorze gracze sami powiedzą, że ekran zniknął.
  - Tradeoff: Do tego czasu wysypany ekran nie zostawia śladu w logach.
  - Confidence: MED — e2e łapie wysypanie się ekranu na ścieżce szczęśliwej, nie na rzadkich stanach.
  - Blind spot: Nie wiemy, jak często wyspy React wysypują się na telefonach graczy.
- **Fix B**: Dodać teraz granicę błędów w `RoomScreen` z napisem dla gracza i zgłoszeniem `island_crash`.
  - Strength: Domyka D4 zgodnie z intencją; zgodne z CLAUDE.md („nigdy nie ukrywaj dowodów”).
  - Tradeoff: Nowy kod ekranu przed wdrożeniem: test, zrzut do oceny i przeklikanie (lessons.md, wpis 3), kolejny przebieg CI.
  - Confidence: MED — wzorzec znany, ale w repo nie ma jeszcze granicy błędów.
  - Blind spot: Jak sprawdzić ją w e2e bez psucia kodu produkcyjnego.
- **Decision**: DEFERRED (Fix A) — `follow-ups/review-fixes.md`, S-03 albo następny audyt obserwowalności

### F5 — Nick z samych selektorów wariantu dostaje odmowę, ale nikt tego nie sprawdza

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supabase/migrations/20261014101922_first_live_round.sql:249, :356; tests/db/nicks.test.ts:122-129
- **Detail**: `private.nick_key(v_nick) = ''` daje `invalid_nick` w `create_room` i `join_room`. Tego warunku nie ma w planie ani w opisie commita. Test pustych nicków sprawdza "", spację, U+200B i U+3000, ale nie nick złożony tylko z selektorów wariantu albo znaczników. Strażnik bez testu, który by go pilnował.
- **Fix**: Dopisać do `it.each` w `nicks.test.ts:122` dwa przypadki: sam U+FE0F i sam znacznik (np. U+E0067), jako ucieczki `\u{…}`.
- **Decision**: FIXED — sam U+FE0F i sam U+E0067 dostają `invalid_nick` (`nicks.test.ts`)

### F6 — Trasy JSON czytają całą treść żądania przed limitem 4096 znaków

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/rooms/json-route.ts:46-53
- **Detail**: `readJsonBody` robi `request.text()` i dopiero potem sprawdza długość. Bardzo duża treść trafia więc w całości do pamięci Workera. `/api/client-events` jest publiczny, a nagłówek `Origin` zatrzymuje tylko przeglądarki, więc skrypt może też zapychać logi fałszywymi `island_crash` (pola są z list, więc nic nie wstrzyknie). Zużycie dziennego limitu żądań dotyczy każdej publicznej trasy, nie tylko tej.
- **Fix**: Odrzucać 400 po nagłówku `Content-Length` większym niż limit, zanim treść zostanie przeczytana.
- **Decision**: DEFERRED — `follow-ups/review-fixes.md`; limit żądań dotyczy każdej publicznej trasy

### F7 — 4.5 odhaczone, choć czytnika ekranu nie uruchamiano

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 4.5; commit b5a753e
- **Detail**: Kryterium 4.5 to „Fokus i czytnik ekranu: przyciski głosowania osiągalne klawiaturą, zmiana fazy ogłaszana”. Opis commita p4 mówi: klawiatura sprawdzona, ogłoszenia przez region `aria-live`, „czytnika ekranu nie uruchamiano, zostaje do rundy w fazie 6”. Ogłoszenie zmiany fazy jest więc zbudowane, ale nikt go nie usłyszał.
- **Fix**: W ręcznej rundzie 6.5 włączyć na telefonie czytnik ekranu (Android: TalkBack, iPhone: VoiceOver) na czas odsłony i sprawdzić, że ją ogłasza.
- **Decision**: MOVED TO 6.5 — Karol sprawdza czytnik ekranu w ręcznej rundzie (`follow-ups/review-fixes.md`); 15.10 runda 6.5 odbyła się bez czytnika → DEFERRED do ręcznej rundy S-03 (`follow-ups/review-fixes.md`)
