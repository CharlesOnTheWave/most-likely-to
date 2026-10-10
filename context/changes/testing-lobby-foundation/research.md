---
date: 2026-10-10T10:39:46+02:00
researcher: Claude (Opus 5.5) z Karolem
git_commit: 4cb6fa4
branch: main
repository: most-likely-to
topic: "Faza 1 planu testów (testing-lobby-foundation): ryzyka #4 (ktoś działa ponad swoją rolę) i #6 (gość nie wchodzi albo traci nick) — ścieżki awarii w kodzie, wyrocznia, warstwa testu, runner i miejsce uruchamiania testów bazy"
tags: [research, testing, test-plan-phase-1, rls, supabase, nick-rule, vitest, pgtap, ci]
status: complete
last_updated: 2026-10-10
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Decyzje Karola po researchu: ścieżka B dla F1/F4; korekty przeniesione do test-plan.md §2"
---

# Research: fundament testów i zabezpieczenie lobby (faza 1 planu testów)

**Date**: 2026-10-10T10:39:46+02:00
**Researcher**: Claude (Opus 5.5) z Karolem
**Git Commit**: 4cb6fa4
**Branch**: main
**Repository**: most-likely-to

## Research Question

Uziemić fazę 1 z `context/foundation/test-plan.md` §3 (ryzyka #4 i #6): dla każdego ryzyka znaleźć prawdziwą ścieżkę awarii w kodzie, sprawdzić (a nie przyjąć na wiarę) wskazówki z §2 Risk Response Guidance, wskazać istniejące testy, najtańszą warstwę z prawdziwym sygnałem i mylące dowody z hot-spotów. Dodatkowo, z sesji Karola 10.10:

1. Czy F1 (uprawnienia hosta przez REST) i F4 (luki reguły nicku, brak limitu długości) z `context/archive/2026-10-07-room-lobby/follow-ups/review-fixes.md` nadal są w kodzie; jeśli tak — opcje zamiast testów utrwalających dziurę.
2. Testy uprawnień jako gość i jako zalogowany host; klucz service_role najwyżej do seedowania.
3. Gdzie uruchamiać testy bazy bez lokalnego Dockera (CI / Docker Desktop / bramka ad hoc), z kosztem i sygnałem; czy bramka ma być wymagana przy każdym pushu.
4. Czy wybrany runner działa z Astro 7 + Cloudflare Workers (aktualna dokumentacja, z datą). Plan ma zacząć się od fazy infrastruktury.

Research zbiera fakty i opcje. Decyzje podejmuje `/10x-plan` razem z Karolem.

## Summary

- **F1 i F4 nadal są w kodzie.** W repo jest jedna migracja, `supabase/migrations/20261007122858_room_lobby.sql` (stan katalogu 10.10). Uczciwe testy zgodne z wyrocznią będą więc dziś czerwone:
  - w #4 dla trzech akcji hosta przez REST: ponowne otwarcie zamkniętego pokoju, wybór kodu linku, zapis własnego nicku z pominięciem reguły nicku. Trzecia luka jest nowa, nie ma jej w F1;
  - w #6 dla 9 z 22 par nicków z listy w sekcji 3.1 (8 par z „Ola” i jedna z emotką „😀”).
  - Stanu bazy produkcyjnej nie sprawdzałem zapytaniem. Migracje trafiają tam przez `db push` (`context/deployment/deploy-plan.md`), a nowszej migracji w repo nie ma.
- **Opcje dla czerwonych testów** (sekcja 8):
  - A — naprawić F1 i F4 w tej zmianie nową migracją;
  - B — oznaczyć jako znaną porażkę (`test.fails`) z odwołaniem do S-02/S-04;
  - C — F4 teraz, F1 jako znana porażka.
  - **Rekomendacja: B**, z F4 dopiętym do migracji S-02 (folder `first-live-round`, wspólny z fazą 2), a nie odłożonym do S-04. To wymaga decyzji Karola, bo zmienia triage z 08.10 tylko w części „S-02 albo S-04”.
- **Warstwa i runner: jeden runner, Vitest 5**, w dwóch zestawach:
  - **unit** — czyste funkcje, bez infrastruktury, uruchamiany lokalnie i w CI;
  - **db** — integracja przez REST/RPC lokalnego Supabase kluczem publishable, jako `anon` i jako zalogowany host.
  - Testy bazy wchodzą tymi samymi drzwiami co atakujący z F1 (REST z pominięciem Workera). Klucz secret/service_role nie jest potrzebny nawet do seedowania: lokalny Supabase ma wyłączone potwierdzanie maila (`supabase/config.toml:215`), więc hosta zakłada zwykła rejestracja kluczem publishable, tak jak już robi to CI (`.github/workflows/ci.yml:51-59`).
  - pgTAP (`supabase test db`) odrzucony na teraz. Potrzebuje Dockera także przy `--db-url`, a role tylko symuluje przez `set local role`, uruchamiany jako superużytkownik `postgres` (sekcje 5 i 6).
- **Gdzie: CI**, w jobie z `supabase start`, na każdym PR i pushu na `main` (wyzwalacze już są, `ci.yml:3-7`).
  - Lokalnie testy bazy są niedostępne: brak Dockera i brak WSL 2 (`wsl --status`, 10.10).
  - Nie na produkcji: to jedyny projekt Supabase (AGENTS.md, Testing).
  - Bramka nie zatrzyma wdrożenia, bo Workers Builds wdraża `main` mimo czerwonego CI (`deploy-plan.md:7,142`). Do fazy 4 „wymagana” znaczy więc: zmiany bazy i pokoju idą przez PR i są scalane tylko na zielonym.
- **Zgodność (sprawdzone 2026-10-10):**
  - Vitest 5.0.3 (2026-09-30) wymaga Vite ≥ 6.4 i Node ≥ 22.12. Projekt ma Vite 8.3.0, CI Node 22 (`ci.yml:16`), a lokalnie jest Node 24.19.0.
  - Integracja `getViteConfig()` z adapterem `@astrojs/cloudflare` 14 w trybie Node jest niepotwierdzona (issue Astro #15878).
  - Rekomendacja: osobny `vitest.config.ts` bez `getViteConfig`, alias `@` → `src`, testy bez importów `astro:*` (sekcja 6).
- **Korekty do planu testów §2** (do przeniesienia albo `--refresh`, sekcja 9):
  - hot-spot `src/pages/api/` jest mylący dla #4, bo ścieżka awarii omija Workera;
  - hot-spot `src/components/room/` jest mylący dla reguły nicku, bo reguła żyje w SQL;
  - „host przeskakuje etapy gry” jest dla fazy 1 spekulatywne, bo stanów gry jeszcze nie ma;
  - „< 30 s z telefonu” nie da się udowodnić testem automatycznym, to sprawdzenie ręczne (iOS wciąż otwarty);
  - warstwa unit ma w #4/#6 mało do pilnowania, bo obie reguły żyją w SQL.

## Detailed Findings

### 1. F1 i F4 — czy dziury nadal są

- **Jedna migracja w repo**: `supabase/migrations/20261007122858_room_lobby.sql` (`ls supabase/migrations`, 10.10). Dotknął jej jeden commit w oknie hot-spotów: `6dbfedd feat(room-lobby): Baza na produkcji (p1)`.
- **F1 jest:**
  - `grant select, insert on table public.rooms to authenticated;` / `grant update (status) on table public.rooms to authenticated;` / `grant select, insert on table public.players to authenticated;` (`…room_lobby.sql:59-61`);
  - polityka zmiany sprawdza tylko właściciela, bez statusu: `using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()))` (`:73-76`);
  - `create_room` przyjmuje kod od wołającego (`p_link_token text`, `:133`) i wstawia go bez zmian (`values (v_host, p_link_token, …)`, `:184`). Worker podaje losowy kod (`src/pages/api/rooms/index.ts:40`), ale funkcja jest przyznana `authenticated` (`:375`), więc host może ją wywołać sam;
  - kategorie sprawdza tylko Worker (`index.ts:26`). Tabela pilnuje jedynie `cardinality >= 1` i `adult_categories <@ categories` (`:26-27`).
- **F4 jest:**
  - klasy znaków w `private.normalize_nick` (`:114`, `:116`; zdekodowane 10.10) nie obejmują m.in. U+FE00–FE0F, U+E0000–E0FFF, U+061C, U+180F, U+1BCA0–1BCA3, U+1D173–1D17A (pełna lista w sekcji 3.1);
  - `join_room` normalizuje bez wcześniejszego limitu długości (`v_nick := private.normalize_nick(p_nick);`, `:241`). To samo dzieje się w `create_room`, w bloku `declare` (`:145`).
- **Produkcja**: nie sprawdzana zapytaniem w tej sesji. Według AGENTS.md (Conventions) migracje stosuje się wyłącznie przez `npx supabase db push`, a nowszej migracji nie ma, więc wniosek „na produkcji tak samo” jest wnioskiem, nie obserwacją.

### 2. Ryzyko #4 — kto może zrobić co ponad swoją rolę

Wyrocznia: PRD Access Control (`context/foundation/prd.md:156-175`) mówi, co każda rola **może**; nie wylicza zakazów „otwórz zamknięty pokój” ani „wybierz kod linku”. Te dwa zakazy pochodzą z decyzji Karola w triage F1 (08.10, `context/archive/2026-10-07-room-lobby/reviews/impl-review.md` F1: „ACCEPTED — Fix A: wymaganie dla S-02”) i z roadmapy (`context/foundation/roadmap.md:136`), a pośrednio z komunikatu gry „Ta gra jest zamknięta. Poproś hosta o nowy link.” (`src/lib/rooms/errors.ts:11`). To akceptowalne źródło (decyzja właściciela), ale nie linia PRD — pytanie 4 w Open Questions.

| # | Rola i akcja | Drzwi (bez Workera) | Wyrocznia | Stan dziś (z kodu) |
|---|---|---|---|---|
| H1 | Host otwiera z powrotem zamknięty pokój | `PATCH /rest/v1/rooms?id=eq.<stary>` `{status:"lobby"}` tokenem hosta; gdy ma otwarty pokój, najpierw zamyka go tym samym PATCH-em | triage F1, roadmap S-02 Risk | **przechodzi**: polityka bez statusu (`:73-76`); indeks `rooms_one_open_per_host` (`:32`) blokuje tylko drugi otwarty pokój naraz |
| H2 | Host sam wybiera kod linku | `rpc("create_room", {p_link_token: "<wybrany>"})` albo `POST /rest/v1/rooms` z `link_token` | triage F1; FR-002/FR-004 (wyciek linku wpuszcza obcych, `prd.md:85,89`) | **przechodzi** obiema drogami (`:133,184`; `:59,69-71`) |
| H3 | Host zapisuje swój nick z pominięciem reguły nicku | `POST /rest/v1/rooms`, potem `POST /rest/v1/players` z `nick: "Ola​"`, `user_id` = swój; gość „Ola” wchodzi | FR-002 + reguła S-01 „co wygląda tak samo, to ten sam nick” (`:97`) | **przechodzi** — nowe, poza listą F1: polityka sprawdza tylko `user_id` i pokój (`:85-93`), tabela tylko długość 1–20 (`:37`) |
| H4 | Host zapisuje kategorie spoza bazy | `POST /rest/v1/rooms` z `categories: ["cokolwiek"]` | FR-005/FR-015 | przechodzi; to sprawa losowania pytań (#3, faza 2), nie roli |
| H5 | Host przeskakuje etapy gry | — | FR-006 | **nie do sprawdzenia w fazie 1**: `status` ma dziś tylko `lobby`/`closed` (`:25`), stany dodaje S-02 |
| H6 | Host czyta lub zmienia cudzy pokój, dopisuje się do cudzego | REST select/patch/insert tokenem innego konta | `prd.md:159` (host jest właścicielem swoich gier) | odmowa: polityki `:65-67`, `:73-76`, `:85-93` |
| H7 | Host czyta `player_secrets` (hash tokenu gościa) | REST select | FR-011 (`prd.md:105`); plan S-01: czytelny hash „mógłby w S-02 głosować za gościa” | odmowa: brak grantu (`:58-61`) |
| H8 | Host dopisuje gościa (`user_id` null) albo wstawia pokój `closed` | REST insert | jak H6 | odmowa: `user_id = auth.uid()` (`:88`), `status = 'lobby'` (`:71`) |
| G1 | Gość (`anon`) czyta tabele | REST select | `prd.md:161` | odmowa (`revoke`, `:58`); ręcznie 08.10: „REST z kluczem publishable na trzech tabelach 401 `42501`” (`impl-review.md:23`) |
| G2 | Gość zakłada pokój | `rpc("create_room")` jako `anon` | `prd.md:162,167` | odmowa (`revoke` `:367`, `grant` tylko `authenticated` `:375`); ręcznie 08.10: „`create_room` jako anon 401” |
| G3 | Gość czyta poczekalnię cudzego pokoju swoim tokenem | `rpc("room_lobby", {p_room_id: B, p_player_token: tokenA})` | „Tożsamość żyje w tej sesji” (`prd.md:161`) | `null`: hash tokenu musi należeć do gracza tego pokoju (`:329-337`) |
| G4 | Gość działa jako inny gracz | potrzebny cudzy token: 32 losowe bajty (`src/lib/rooms/tokens.ts:24`), w bazie tylko sha256 (`:261-262`) | FR-011 | gość nie ma dziś innych akcji niż wejście i odczyt poczekalni; głosowanie dojdzie w S-02 |

Wniosek dla wskazówki z §2: „uprawnienia w bazie są włączone i smoke przechodzi, więc jest bezpiecznie” — rzeczywiście błędne. Kroki pokoju w smoke (`scripts/smoke.mjs:204-274`) chodzą przez Workera, a H1–H3 go omijają. Zielone dziś przypadki H6–H8 i G1–G3 to tanie testy-strażnicy: złapią migrację S-02, która przypadkiem otworzy grant.

### 3. Ryzyko #6 — nick, link, odświeżenie, długość, czas wejścia

#### 3.1 Pary nicków (wyrocznia z Unicode, nie z `normalize_nick`)

Źródła wyroczni (Unicode 18.0.0, pliki z 2026-08): `DerivedCoreProperties.txt` (Default_Ignorable_Code_Point), `PropList.txt` (White_Space), UTS #51 rev. 31 i `emoji-variation-sequences.txt`, Core Spec §5.21, §23.4, §23.8.3. Decyzje produktowe: wielkość liter się liczy, a podobne litery z innych alfabetów są przyjętym ryzykiem (`…room_lobby.sql:97-100`, plan S-01). Funkcja `private.normalize_nick` nie jest dostępna dla `anon` (`revoke` `:366`), więc test idzie przez `join_room`, czyli drzwi gościa. Oczekiwanego wyniku nie da się wtedy policzyć tą samą funkcją.

| Para (baza „Ola”) | Dlaczego wygląda identycznie | Oczekiwane | Dziś |
|---|---|---|---|
| `"Ola "`, `" Ola"` | White_Space na brzegu | `nick_taken` | odrzucany (smoke `:252` dla spacji na końcu) |
| `"O​la"` | ZWSP, Default_Ignorable | `nick_taken` | odrzucany (smoke `:253`) |
| `"Ola "`, `"O­la"`, `"Ola﻿"`, `"O⁠la"` | NBSP; soft hyphen, BOM i WJ (Default_Ignorable) | `nick_taken` | odrzucany (klasy `:114,116`) |
| `"Olaㅤ"`, `"Ola⠀"` | wypełniacz Hangul (Default_Ignorable), pusty znak Braille'a (NamesList: „imaged as a fixed-width blank”) | `nick_taken` | odrzucany |
| `"Olá"` vs `"Olá"` (U+00E1) | równoważność kanoniczna (UAX #15) | `nick_taken` | odrzucany (NFC) |
| `"Ola️"`, `"O︎la"` | selektor wariantu po literze spoza listy par: „should be invisible and ignored” (Core §23.4) | `nick_taken` | **przechodzi** |
| `"Ola\u{E0100}"` | VS-17, poza listą par | `nick_taken` | **przechodzi** |
| `"Ola\u{E0041}"` | znacznik (tag); Core §5.21 ostrzega przed niewidocznymi znacznikami | `nick_taken` | **przechodzi** |
| `"Ola؜"`, `"Ola᠏"`, `"Ola\u{1BCA0}"`, `"Ola\u{1D173}"` | Default_Ignorable | `nick_taken` | **przechodzi** |
| `"Ola😀"` vs `"Ola😀️"` | U+1F600 nie ma pary z FE0F, więc selektor nic nie zmienia | `nick_taken` | **przechodzi** |
| `"ola"` vs `"Ola"` | wielkość liter się liczy (decyzja S-01) | wchodzi | wchodzi (smoke `:254`) |
| `"Ola1"`, `"Óla"` vs `"Ola"` | widocznie inne | wchodzi | wchodzi — kontrola przeciw zbyt agresywnej poprawce (np. NFKC + małe litery) |

Zastrzeżenie: Unicode 18 (D57h) zaleca **widoczne** wyświetlanie „źle umieszczonych” selektorów. Czy przeglądarki już tak robią, nie sprawdzałem; przegląd F4 zakładał, że „Ola”+U+FE0F wygląda jak „Ola”. To fakt do potwierdzenia jednym zrzutem przed planem poprawki, a nie przed testem: para jest w liście tak czy inaczej.

**Bez wyroczni — nie asertować, dopóki Karol nie zdecyduje** (Open Questions 2–3):

- `"Ola❤"` vs `"Ola❤️"`: FE0F zmienia tu wygląd (para U+2764 jest na liście UTS #51);
- flaga Szkocji (znaczniki) vs zwykła czarna flaga;
- `"#"` vs `"#️"`;
- formy zgodności, które łączy dopiero NFKC: pełna szerokość „Ｏｌａ”, ligatura „ﬁ”, cyfra rzymska „Ⅰ” vs „I”.

Już przyjęte w S-01: usunięcie U+200D łączy rodzinę emotek z ich składnikami (`:99`).

Postgres: `normalize()` w PG 17 używa tablic Unicode 15.1 (`unicode_version.h`), a znaki spoza nich przechodzą bez zmian. Punkty kodowe powyżej U+FFFF zapisuje się w klasie znaków jako `\U000E0100` (dokumentacja PG 17, functions-matching). `char_length` liczy punkty kodowe, a nie widoczne znaki (flaga Szkocji to 7).

#### 3.2 Za długi nick — czytelna odmowa

- **Ścieżka:** formularz (`src/components/room/JoinForm.tsx:26-31` blokuje > 20 po stronie przeglądarki) → `POST /api/rooms/join` → `join_room` → `invalid_nick` (`…room_lobby.sql:242-244`) → `/j/<kod>?error=invalid_nick` (`src/pages/api/rooms/join.ts:17,44`) → „Nick musi mieć od 1 do 20 znaków.” (`src/lib/rooms/errors.ts:4`).
- **Za długi nick dociera do bazy w trzech sprawdzonych sytuacjach:** wejście z pominięciem formularza (REST albo `POST` z innego klienta), wysłanie formularza, zanim wyspa React się załaduje (formularz to zwykły `POST`, `JoinForm.tsx:53`), albo rozjazd licznika przeglądarki z bazą. `nickLength` (`src/lib/rooms/shared.ts:23-25`) robi tylko NFC i białe znaki, a nie usuwa znaków niewidocznych; sam kod zaznacza „The database has the final word” (`:22`).
- **Bardzo długi nick (F4):** brak limitu przed normalizacją, więc cały tekst przechodzi przez NFC i trzy wyrażenia regularne. Wynik to `invalid_nick`, o ile zapytanie nie przekroczy limitu czasu instrukcji. Dokumentacja Supabase podaje 3 s dla `anon`; nie sprawdzałem tego w tej sesji. Gdyby przekroczyło, gość dostanie ogólne „Coś poszło nie tak.” (`errors.ts:16`) zamiast czytelnej odmowy.
- **Wyrocznia testu:** czytelna odmowa (`invalid_nick`) dla 21 znaków i dla bardzo długiego tekstu. Próg 100 z F4 to szczegół implementacji, którego test nie powinien przybijać.

#### 3.3 Samo otwarcie linku (podgląd Discorda) niczego nie zmienia

- Strona `GET /j/<kod>` woła z bazy dwie funkcje: `room_link` i `room_lobby` (`src/pages/j/[token].astro:26,33`). Obie funkcje są `stable` (`…room_lobby.sql:272`, `:306`). PostgreSQL nie pozwala funkcji nie-`volatile` wykonać poleceń zmieniających dane (dokumentacja PG, xfunc-volatility). Nie uruchamiałem tego.
- W `src/pages/j/[token].astro` nie ma `cookies.set`; ciasteczko gościa ustawia `POST` w `join.ts:47`. Klient Supabase może zapisać ciasteczka sesji przy jej odświeżeniu (`setAll`, `src/lib/supabase.ts:16-18`), a middleware woła `getUser()` (`src/middleware.ts:12`). Bot Discorda nie ma ciasteczek sesji, więc nie ma czego odświeżać (wniosek z `@supabase/ssr`, nieuruchamiany).
- **Istniejący test:** smoke „guest sees the join form” (`scripts/smoke.mjs:241`) sprawdza tylko status 200, a nie to, że nic nie powstało.
- **Najtańszy prawdziwy sygnał: krok smoke** (świeży słoik ciasteczek, `GET /j/<kod>` kilka razy). Sprawdza dwie rzeczy:
  - odpowiedź nie ustawia ciasteczka `mlt_player_`;
  - lista u hosta ma tyle samo osób.
- Test na poziomie bazy pokryłby funkcje, a nie stronę `GET`.

#### 3.4 Po odświeżeniu gracz wraca na swój nick

- **Ciasteczko** `mlt_player_<roomId>`: httpOnly, SameSite=Lax, Max-Age 24 h (`tokens.ts:10,28,34-41`).
- **Odświeżenie** `/r/<id>` i `/api/rooms/<id>/lobby` czyta to ciasteczko (`src/pages/r/[id].astro:25`) i woła `room_lobby`. Funkcja zwraca `me`, czyli nick przypięty do hasha tokenu (`…room_lobby.sql:329-338`).
- **Nick zostaje zajęty**, bo wiersz gracza nie znika. Ktoś inny z tym samym nickiem dostaje `nick_taken`.
- **Istniejące testy:**
  - smoke „lobby lists the host and Ola” (`smoke.mjs:248`) sprawdza listę nicków, ale nie `"me":"Ola"`;
  - zwykły duplikat „Ola” (bez niewidocznych znaków) nie ma kroku w smoke.
- **Ograniczenia przyjęte do S-04** (poza fazą 1):
  - ciasteczko wygasa po 24 h;
  - przeglądarka Discorda na iOS trzyma ciasteczka osobno od Safari (plan S-01, `context/archive/2026-10-07-room-lobby/plan.md:49`); iPhone nie był testowany (`phone-test.md`, G4/P1).

#### 3.5 Wejście z telefonu w < 30 s

- Zmierzone raz, 08.10, na Androidzie w przeglądarce Discorda: ok. 10 s (`context/archive/2026-10-07-room-lobby/phone-test.md`, G1). iOS niesprawdzony (G4).
- To miara czasu człowieka. Test automatyczny jej nie udowodni, a pomiar na lokalnym serwerze nic nie mówi. Właściwa warstwa: ręczna próba na telefonie przed prawdziwym wieczorem, z iPhone'em jako otwartą pozycją. Wskazówka §2 dla #6 wymienia już „ręczny test telefonu (iOS)”; trzeba tylko jasno zapisać, że „< 30 s” nie wchodzi do testów automatycznych fazy 1.

### 4. Istniejące testy

- **Brak runnera unit/integration:** `package.json` nie ma skryptu `test`, a w `node_modules` nie ma `vitest` (sprawdzone 10.10).
- **Smoke** (`scripts/smoke.mjs`, 32 kroki według planu testów §4) w części pokoju pokrywa:
  - logowanie hosta i założenie pokoju (`:205-237`);
  - dla #6: spację na końcu i ZWSP (`:252-253`), wielkość liter (`:254`), poczekalnię bez ciasteczka → 404 (`:255`), zamknięty link → 410 i status `closed` u Oli (`:265-267`), nieznany link → 404 (`:268`);
  - dla #4: nic przez REST. Ręczne sondy REST/RPC z 08.10 (`impl-review.md:23`) są jednorazowe i nie da się ich powtórzyć.
- **Uboczna obserwacja do H2:** krok „unknown link is not found” używa stałego kodu `AAAAAAAAAAAAAAAAAAAAAA` (`smoke.mjs:268`). Host, który dziś założy pokój z tym kodem przez `create_room`, zmieni wynik tego kroku na produkcji z 404 na 200 albo 410.

### 5. Role w testach i pułapki „fałszywie zielone”

- **Role bez klucza secret.** `anon` to klient z kluczem publishable bez sesji. Host to klient po `signUp` + `signInWithPassword` na lokalnym Supabase; lokalnie `enable_confirmations = false` (`supabase/config.toml:215`), a CI już tak zakłada konto smoke (`ci.yml:51-59`). Seedowanie idzie prawdziwymi drzwiami ról: `create_room` jako host, `join_room` jako gość. Klucz secret/service_role nie jest potrzebny do niczego w fazie 1. Supabase w swoim przykładzie Vitest używa go do seedowania (dokumentacja testing overview), ale my tego nie potrzebujemy.
- **Pułapka 1 — uprzywilejowany klucz** omija RLS i daje fałszywie zielony wynik. Zabezpieczenie: setup testów odmawia startu, gdy klucz nie zaczyna się od `sb_publishable_` (ten sam wzór co `src/lib/supabase.ts:28`). Do tego test-kanarek: `anon` czytający `player_secrets` musi dostać odmowę.
- **Pułapka 2 — produkcja.** `.dev.vars` wskazuje na jedyny projekt, czyli produkcję (AGENTS.md, Testing), a tam „Confirm email” jest włączone. Testy z rejestracją wysyłałyby maile na fikcyjne adresy i zostawiały konta. Zabezpieczenie: setup odmawia startu, gdy host URL nie jest `127.0.0.1` ani `localhost`.
- **Pułapka 3 — RLS milczy przy `using`.** `PATCH` lub `select` cudzego wiersza zwraca 0 wierszy bez błędu, więc asercja „brak błędu” przechodzi i przy odmowie, i przy zgodzie. Asercja musi sprawdzać skutek: ponowny odczyt jako właściciel, status bez zmian, `room_link` dalej `closed`. Odmowa `with check` przy `insert` daje błąd `42501`.
- **Pułapka 4 — pgTAP bez `set local role`** działa jako `postgres` (superużytkownik, omija RLS). To jeden z powodów, by nie zaczynać od pgTAP.
- **Pułapka 5 — wyrocznia lustrzana.** Oczekiwane pary pochodzą z tabeli w 3.1, a nie z wywołania `normalize_nick`, której `anon` i tak nie może wywołać.
- **Izolacja.** Testy na poziomie aplikacji nie mają transakcji do wycofania (dokumentacja Supabase), a baza CI jest jednorazowa (`supabase stop --no-backup`, `ci.yml:66-67`). Indeks „jeden otwarty pokój na hosta” (`…room_lobby.sql:32`) sprawia, że testy hosta potrzebują osobnych kont (losowy e-mail na plik testów) albo ścisłej kolejności.

### 6. Runner i zgodność ze stosem (sprawdzone 2026-10-10)

| Fakt | Źródło (data) |
|---|---|
| Przewodnik Astro nadal poleca Vitest z `getViteConfig()` z `astro/config` | docs.astro.build/en/guides/testing/ (bez daty) |
| Oficjalny przykład `examples/with-vitest`: `astro ^7.3.8` + `vitest ^5.0.3` + `getViteConfig` | repo withastro/astro, `main`, 10.10 |
| Vitest 5.0.0 z 2026-09-03, 5.0.3 z 2026-09-30; wymaga Vite ≥ 6.4 i Node ≥ 22.12 | vitest.dev, wydania na GitHubie |
| Projekt: astro 7.3.2, `@astrojs/cloudflare` 14.3.1, Vite 8.3.0; CI Node 22 (`ci.yml:16`), lokalnie Node 24.19.0 | `node_modules`, 10.10 |
| `getViteConfig` + `@astrojs/cloudflare` + Vitest 4+: issue #15878 zamknięte 2026-07-02 jako „Fixed by #17248” (astro 7.0.6). Changelog opisuje tylko tryb przeglądarki i pomijanie serwera dev, więc tryb Node z adapterem 14 jest **niepotwierdzony** | github.com/withastro/astro |
| `@cloudflare/vitest-pool-workers` wycofany na rzecz `@cloudflare/vitest-plugin` 1.4.0 (Vitest ^4.1 lub ^5). Służy do testów w środowisku Workers; faza 1 go nie potrzebuje | npm, developers.cloudflare.com (2026-08-20) |
| `supabase test db` uruchamia `pg_prove` w kontenerze dla `--local`, `--linked` i `--db-url`, więc Docker jest potrzebny także przy zdalnej bazie; robi `create extension if not exists pgtap` na celu | supabase/cli `SIDE_EFFECTS.md` (develop, X 2026); supabase.com/docs/reference/cli/supabase-test-db |
| Natywny stos bez Dockera (`supabase stack`, CLI 2.118.0, 2026-09-25): „Windows: Not supported” | supabase/cli releases |
| Lokalny klucz publishable istnieje: CI wyciąga `PUBLISHABLE_KEY` z `supabase status -o env` (`ci.yml:42`), a smoke w CI przechodzi z kluczem `sb_publishable_` (`impl-review.md:23`). Publiczna dokumentacja `supabase status` wymienia tylko stare klucze; nasz CI rozstrzyga tę sprzeczność | ci.yml; supabase.com/docs |
| `supabase/setup-cli` jest w v3.0.1 (2026-09-24); `ci.yml:35` używa `@v1` z `version: latest`. Nie blokuje fazy 1, do odnotowania | github.com/supabase/setup-cli |
| Supabase CLI w lockfile: 2.117.0 (`package.json` mówi `^2.23.4`) | `node_modules/supabase/package.json`, 10.10 |

Rekomendacja konfiguracji (do decyzji w planie):

- osobny `vitest.config.ts` bez `getViteConfig`: omija niepotwierdzony styk z adapterem Cloudflare, bo testy fazy 1 nie renderują `.astro` i nie potrzebują modułów `astro:*`;
- alias `@` → `./src`, tak jak w `tsconfig.json` `paths`;
- testy nie importują `src/lib/supabase.ts`, bo ten importuje `astro:env/server` (`:3`). Testy bazy tworzą własnego klienta supabase-js z `API_URL` i `PUBLISHABLE_KEY`.

Pierwsza faza planu powinna udowodnić, że runner działa: jeden test unit importujący `@/lib/rooms/shared` oraz `npm run lint`, `npx astro check` i `npm run build` dalej zielone z nowymi plikami.

Warstwa unit w fazie 1 ma niewiele do pilnowania w #4/#6, bo obie reguły żyją w SQL. Uczciwi kandydaci:

- `roomErrorMessage` (`errors.ts:18-21`): pięć kodów odmowy z drogi wejścia gościa (`invalid_nick`, `nick_taken`, `room_closed`, `room_unknown`, `service_unavailable`; `join.ts:21,26,44`) daje tekst inny niż ogólny „Coś poszło nie tak.”. Szósty kod, `unexpected` (`src/lib/rooms/server.ts:29`), celowo dostaje tekst ogólny. Test łapie przemianowany kod. Asercja „nie ogólny tekst”, a nie przepisany tekst — inaczej powstaje lustro.
- `nickLength`: tylko podpowiedź w UI, słaby sygnał.

Główna wartość unit w fazie 1 to postawienie runnera pod fazę 2 (losowanie pytań, #3).

### 7. Gdzie uruchamiać testy bazy

| Opcja | Koszt | Sygnał | Werdykt |
|---|---|---|---|
| **CI** (GitHub Actions, `supabase start` jak w jobie `smoke`) | Bez instalacji u Karola. W tym samym jobie co smoke testy dokładają tylko swój czas, bo start stosu jest już zapłacony (job `smoke` ok. 2 min, `deploy-plan.md:122`). Osobny job to drugi start stosu. Pętla agenta: push gałęzi i szkic PR; buildy gałęzi są wyłączone, więc push gałęzi nie wdraża (`deploy-plan.md:164-165`) | Prawdziwy Postgres 17 + PostgREST + GoTrue, te same migracje, role `anon`/`authenticated` przez te same drzwi co atakujący | **rekomendowane** |
| **Docker Desktop lokalnie** | WSL 2 nie jest zainstalowany (`wsl --status`, 10.10), więc trzeba doinstalować WSL 2 lub Hyper-V i Docker Desktop. Darmowy do użytku osobistego (docs.docker.com, licencja). Docker Desktop wymaga 8 GB RAM, a `supabase start` „at least 7GB of RAM”. Do tego czas Karola (≤ 15 h/tydz.) | Taki jak CI, plus szybka pętla lokalna | opcjonalnie później, nie warunek fazy 1 |
| **Ad hoc na zdalnej bazie** | Jedyny projekt to produkcja (AGENTS.md); tam „Confirm email” jest włączone, więc testy nie założą hosta bez klucza secret, co łamie zasadę kluczy. `supabase test db --db-url` i tak chce Dockera. Drugi, testowy projekt Supabase jest możliwy, ale to dwa `db push` na migrację i usypianie darmowego projektu | — | odrzucone na fazę 1 |

Czy wymagana przy każdym pushu:

- **Uruchamiana automatycznie:** na każdym PR i pushu na `main` (wyzwalacze `ci.yml:3-7`).
- **Wymagana przez proces:** dla PR-ów dotykających `supabase/migrations/`, `src/lib/rooms/`, `src/pages/api/rooms/`, `src/pages/j/` i `src/pages/r/`; scalanie tylko na zielonym.
- **Technicznie nie zatrzyma produkcji,** bo Workers Builds wdraża `main` mimo czerwonego CI (`deploy-plan.md:7,142`). To ryzyko #5 i faza 4.
- **W planie testów:**
  - §4: „DB: tylko CI (lokalnie brak Dockera)”;
  - §5: wiersz „unit + integration” z dopiskiem, że integracja jest lokalnie niedostępna.

Bramka nie jest więc „ad hoc”, bo CI daje ją tanio.

### 8. Opcje dla testów, które dziś będą czerwone (F1: H1–H3; F4: 9 par z 3.1)

| Ścieżka | Co w tej zmianie | Koszt | Ryzyko | Co zostaje na później |
|---|---|---|---|---|
| **A. Naprawić F1 i F4 teraz** | Nowa migracja: odebrać `authenticated` `insert`/`update` na `rooms`/`players`, `create_room` jako `security definer` z kodem linku z SQL, reguła nicku + limit długości; `npx supabase db push` (zgoda Karola) | Największy. Zmiana Workera (`index.ts:40`) i kolejność wdrożenia: baza przed Workerem albo zgodna sygnatura, bo stary Worker podaje `p_link_token` | F1 przerobi i tak S-02 (stany gry), więc podwójna praca. Migracja na jedynej, produkcyjnej bazie w fazie „postaw testy” | nic |
| **B. Znana porażka** | Testy z oczekiwaniem z wyroczni, oznaczone `test.fails` (Vitest) z komentarzem „F1 → S-02” / „F4 → migracja nicków”. CI zostaje zielone, a wynik wypisuje te testy jako oczekiwane porażki. Po naprawie test sam robi się czerwony i wymusza zdjęcie oznaczenia | Najmniejszy | Dziury zostają na produkcji do naprawy. Wpływ wg przeglądu: host działa tylko na swoich pokojach (`impl-review.md` F1), a nick to co najwyżej psikus | F1 i F4 jako kryteria akceptacji migracji S-02 |
| **C. F4 teraz, F1 jako znana porażka** | Migracja tylko z regułą nicku i limitem; F1 przez `test.fails` | Średni: `db push` plus decyzja o emotkach (niżej) | Zmienia triage z 08.10 (F4 → S-02/S-04) | F1 |

Czego **nie** robić: testu, który asertuje dzisiejsze zachowanie dziury (np. „host może otworzyć zamknięty pokój”). Tak samo `it.skip` / `it.todo`, które milczą w wyniku.

- **Adwokat diabła (przeciw B):** „Faza 1 kończy się zieloną bramką, a dziury są na produkcji. To dokładnie wzór z ryzyka #5: zielone, choć zepsute.” Odpowiedź: `test.fails` nie jest zielone-bo-pominięte. Asercja zostaje prawdziwa (z wyroczni), wynik pokazuje ją jako oczekiwaną porażkę, a naprawa bez zdjęcia oznaczenia zapali CI na czerwono. Do tego wpis w planie testów §6.6.
- **Krytyk (przeciw A i C):** „Migracja na jedynej bazie w fazie, której celem jest postawić testy, poszerza zakres. F1 i tak zmieni S-02, a F4 wymaga decyzji o emotkach, której jeszcze nie ma.”
- **Analogia z gry:** B to jak sędzia, który wpisuje do protokołu „plansza ma znany błąd, poprawka przy następnym remoncie (S-02)”. Gorzej byłoby przykleić na błąd naklejkę „tak ma być” (test lustrzany) albo zamknąć grę na remont w dniu, w którym przyszło się tylko podłączyć zegar (A).
- **Rekomendacja: B**, a do planu S-02 (faza 2, folder `first-live-round`) dopisać F4 obok F1. Wtedy testy z `test.fails` staną się kryteriami akceptacji tej migracji. Jeśli Karol woli zamknąć nicki szybciej, C jest uczciwą alternatywą, ale dopiero po decyzji o emotkach.

Decyzja o emotkach, potrzebna przy każdej poprawce F4:

- **W1 — usuwać selektory wariantu i znaczniki,** jak dziś U+200D (`:99`). Najtańsze. Skutek: `join_room` zapisuje znormalizowany nick (`:247`), więc „Ola❤️” może wyświetlić się jako „Ola❤” w stylu tekstowym, a flaga Szkocji jako czarna flaga.
- **W2 — osobny klucz porównania:** wyświetlanie bez zmian, a unikalność liczona na kluczu. Większa migracja: nowa kolumna albo indeks na funkcji zamiast `players_room_nick_key`, którego nazwę sprawdza `join_room` (`:255`).
- **W3 — odrzucać nicki z selektorami.** Klawiatury emotek wstawiają FE0F do części emotek (np. ❤️); dla konkretnych klawiatur niepotwierdzone. Grozi częstymi odmowami. Nie rekomendowane.

Dla par z 3.1 warianty W1, W2 i W3 dają ten sam wynik (odrzucenie). Różnią się parami z listy „bez wyroczni” oraz tym, jak nick się wyświetla.

### 9. Hot-spoty i ryzyka spekulatywne (korekty do planu testów §2)

- **#4, `src/pages/api/` (10 commitów/30 dni): mylący.**
  - Rozbicie per podkatalog: `auth/` 6, `rooms/` 2, `live-sync/` 1 (`git log --since=2026-09-08 --until=2026-10-09`, 10.10). Większość to S-05 i ekran logowania.
  - Ścieżka awarii H1–H3 to REST prosto do Supabase, z pominięciem Workera.
  - Prawdziwy dowód: impl-review F1 i granty w migracji pokoju (jeden commit w oknie).
- **#6, `src/components/room/` (5 commitów/30 dni): mylący dla nicków.**
  - To zmiany ekranów (stany p3/p4/p5), a reguła nicku żyje w SQL.
  - Częściowo trafny dla „wejścia z telefonu”, czyli UX formularza.
- **#4, „host przeskakuje etapy gry”: spekulatywne dla fazy 1.** Stanów gry nie ma (`…room_lobby.sql:25`). Należy do fazy 2 (S-02 / `first-live-round`); faza 1 może dać wzór testów ról, z którego faza 2 skorzysta.
- **#4, warstwa:** wskazówka „integration (baza w CI, z rolą gościa i rolą zalogowanego hosta)” jest trafna. Doprecyzowanie: przez REST/RPC kluczem publishable (Vitest), a nie pgTAP.
- **#6, „< 30 s z telefonu”:** tylko ręcznie, iOS otwarty (3.5).
- **§4 Stack:**
  - kandydat pgTAP nie wybrany (Docker także przy `--db-url`);
  - Vitest 5 dla unit i integracji;
  - lokalny Node to 24.19.0, a nie 22.14 jak w tabeli; CI używa 22.

## Code References

- `supabase/migrations/20261007122858_room_lobby.sql:25` — `status` tylko `lobby`/`closed`
- `supabase/migrations/20261007122858_room_lobby.sql:32` — jeden otwarty pokój na hosta
- `supabase/migrations/20261007122858_room_lobby.sql:37` — tabela `players` pilnuje tylko długości nicku
- `supabase/migrations/20261007122858_room_lobby.sql:58-61` — `revoke` i granty dla `authenticated` (F1)
- `supabase/migrations/20261007122858_room_lobby.sql:65-93` — polityki hosta; `:73-76` bez warunku na status
- `supabase/migrations/20261007122858_room_lobby.sql:97-125` — `private.normalize_nick`; klasy znaków `:114`, `:116`
- `supabase/migrations/20261007122858_room_lobby.sql:131-198` — `create_room` (invoker, `p_link_token` `:133`, `:184`)
- `supabase/migrations/20261007122858_room_lobby.sql:204-266` — `join_room` (normalizacja bez limitu `:241`, `nick_taken` `:255`)
- `supabase/migrations/20261007122858_room_lobby.sql:269-298` — `room_link` (`stable` `:272`)
- `supabase/migrations/20261007122858_room_lobby.sql:302-357` — `room_lobby` (`stable` `:306`, tożsamość gościa `:329-338`)
- `supabase/migrations/20261007122858_room_lobby.sql:362-378` — właściciele funkcji, `revoke`/`grant execute`
- `src/pages/api/rooms/index.ts:26,40` — Worker sprawdza kategorie i podaje losowy kod linku
- `src/pages/api/rooms/join.ts:14-47` — wejście gościa, przekierowania z kodem błędu, ciasteczko
- `src/pages/j/[token].astro:12-38` — `GET` linku tylko czyta
- `src/pages/r/[id].astro:25` — pokój po odświeżeniu czyta ciasteczko
- `src/lib/rooms/tokens.ts:10,19-41` — kody, ciasteczko gościa (24 h, httpOnly, Lax)
- `src/lib/rooms/shared.ts:3,22-25` — limit 20 i licznik w przeglądarce
- `src/lib/rooms/errors.ts:4-21` — teksty odmów
- `src/lib/supabase.ts:3,28` — `astro:env/server`; tylko klucz `sb_publishable_` dla przeglądarki
- `src/components/room/JoinForm.tsx:26-31` — blokada > 20 w formularzu
- `scripts/smoke.mjs:239-268` — kroki pokoju istotne dla #6
- `.github/workflows/ci.yml:27-67` — job `smoke` z lokalnym Supabase
- `supabase/config.toml:215` — lokalnie bez potwierdzania maila

## Architecture Insights

- **Zasady pokoju żyją w bazie, a Worker to tylko jedne z drzwi.** Komentarz migracji mówi to wprost: „Anyone with the publishable key can call them directly, bypassing the Worker, so every check lives inside them” (`:9-10`). F1 to miejsce, gdzie ta zasada nie objęła zapisów hosta (RLS zamiast funkcji). Testy uprawnień trzeba więc pisać na poziomie bazy i REST, a nie HTTP Workera.
- **Tożsamość gościa to losowy token w ciasteczku,** a w bazie jest tylko jego sha256 w tabeli bez grantów (`:47-52`). Dzięki temu G3/G4 są dziś zamknięte konstrukcyjnie, a test-strażnik pilnuje, żeby S-02/S-04 tego nie otworzyły.
- **Nick jest zapisywany po normalizacji** (`:247`), więc reguła porównania jest też regułą wyświetlania. Stąd decyzja W1/W2 przy F4.

## Historical Context (from prior changes)

- `context/archive/2026-10-07-room-lobby/reviews/impl-review.md` — F1 (WARNING, MEDIUM, ACCEPTED jako wymaganie S-02; Fix B „nowa migracja od razu” odrzucony), F4 (OBSERVATION, ACCEPTED, do najbliższej migracji nicków), sondy REST/RPC z 08.10 (`:23`).
- `context/archive/2026-10-07-room-lobby/follow-ups/review-fixes.md` — co zrobić z F1 (S-02) i F4 (S-02 albo S-04), w tym krok smoke dla „Ola”+U+FE0F.
- `context/archive/2026-10-07-room-lobby/change.md` — nota „Reguła nicku”: wgrana reguła szersza niż w planie, luki odesłane do F4.
- `context/archive/2026-10-07-room-lobby/plan.md` — ciasteczko gościa i hash (`:46-49,80`), `GET /j/<kod>` niczego nie zmienia przez podgląd Discorda (`:53,374`), pgTAP i testy jednostkowe poza zakresem S-01 (`:67`).
- `context/archive/2026-10-07-room-lobby/phone-test.md` — Android ok. 10 s do wejścia, iPhone niesprawdzony.
- `context/archive/2026-10-07-room-lobby/reviews/plan-review.md:57` — „Karol nie ma Dockera”, migracje najpierw w CI na szkicu PR.
- `context/deployment/deploy-plan.md:7,122,142,164-165` — Workers Builds wdraża `main` mimo czerwonego CI; czasy jobów; buildy gałęzi wyłączone.
- `context/foundation/roadmap.md:136` — S-02 Risk: tylko dozwolone przejścia statusu; S-04 (`:151-162`) — powrót na nick.

## Related Research

- `context/archive/2026-10-07-room-lobby/research.md` — tożsamość gościa, zapis przez `security definer`, model ról (S-01).

## Decyzje Karola (2026-10-10, po researchu)

- **F1 i F4: ścieżka B.**
  - Testy zgodne z wyrocznią dla H1–H3 i 9 par z 3.1 powstają w fazie 1, oznaczone jako oczekiwana porażka (`test.fails`) z odwołaniem do naprawy.
  - Naprawa F1 i F4 idzie razem do migracji S-02 (`first-live-round`, faza 2 planu testów). Tym samym zmienia się część triage z 08.10, która dopuszczała S-04 dla F4.
  - W tej zmianie nie ma migracji ani `db push`.
- **Korekty do planu testów przeniesione** do `context/foundation/test-plan.md` §2:
  - Source dla #4 i #6;
  - Risk Response Guidance dla #4 i #6;
  - słowo „zapisuje sobie nick z pominięciem reguły nicku” w opisie ryzyka #4.

  Faza 1 w §3 ma status `researched`. §4 (Stack) bez zmian: tabelę stosu zaktualizuje implementacja fazy 1.

## Open Questions

Decyzje dla Karola (do `/10x-plan`):

1. ~~**F1 i F4: ścieżka A, B czy C** (sekcja 8).~~ Rozstrzygnięte: B (sekcja „Decyzje Karola”).
2. **Czy „Ola❤” i „Ola❤️” to ten sam nick** (W1/W2/W3, sekcja 8). Rekomendacja na dziś: nie asertować; wybór przy poprawce F4.
3. **Formy zgodności** („Ｏｌａ” pełnej szerokości, „ﬁ”, „Ⅰ”) — ten sam nick czy nie. Rekomendacja: nie identyczne, poza zakresem, tak jak litery z innych alfabetów.
4. **Czy zamknięty pokój jest ostateczny.** Wyrocznia H1 pochodzi z triage F1 i roadmapy, a nie z tabeli PRD Access Control. Rekomendacja: tak (komunikat gry „Poproś hosta o nowy link”).

Fakty do potwierdzenia w trakcie (nie blokują planu):

- czy przeglądarki pokazują „Ola”+U+FE0F jak „Ola” (Unicode 18 D57h zaleca widoczne wyświetlanie);
- limit czasu instrukcji dla `anon` przy bardzo długim nicku;
- czy integracja ma iść w jobie `smoke`, czy w osobnym jobie (koszt drugiego `supabase start` vs osobny czerwony sygnał).
