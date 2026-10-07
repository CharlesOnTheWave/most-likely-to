# Pokój i poczekalnia (room-lobby) — plan implementacji

## Overview

Zalogowany host zakłada grę: wpisuje swój nick, wybiera kategorie (przy każdej osobno decyduje o pytaniach 18+) i dostaje link do wklejenia na Discordzie. Gość otwiera link na telefonie, wpisuje nick i trafia do poczekalni. Host i goście widzą listę graczy na żywo (PRD US-01, FR-002, FR-005; roadmapa S-01).

To pierwsza zmiana z tabelami w bazie. Na jej schemacie i tożsamości gościa stoją S-02 (jeden głos na gracza), S-04 (powrót na swój nick) i S-09 (nowy link po usunięciu gracza). Zmiana idzie równolegle z S-05 (`one-click-host-login`) w osobnym worktree (lekcja M2L6). Fakty i opcje zebrał `research.md`. Decyzje zapadły w wywiadzie z Karolem 07.10, a trzy decyzje techniczne przeszły recenzję adwokata diabła i krytyka.

## Current State Analysis

- **Baza.** Nie ma `supabase/migrations/`, tabel, polityk RLS ani wywołań `.from(`/`.rpc(` w `src/` (`research.md`, sekcja 4). CLI Supabase nie jest połączone z projektem (`supabase/.temp/` ma tylko `cli-latest`), a w `package.json` jest CLI 2.117.0.
- **Jeden projekt Supabase** dla rozwoju i produkcji. Każda migracja zmienia bazę produkcyjną i jest nieodwracalna (`infrastructure.md:167`). Polecenia `npx supabase db *` i `migration up/down/repair` są w ask (`.claude/settings.json:33-36`).
- **Tożsamość.** Middleware wpisuje `locals.user` i chroni tylko `/dashboard` (`src/middleware.ts:4-22`). Mechanizmu dla gościa nie ma. Serwer ma tylko klucz publishable, więc każde zapytanie działa jako `anon` albo `authenticated` (`src/lib/supabase.ts:5-29`).
- **Na żywo.** Dzwonek z F-01: `ringRoom(supabase, room, seq)` wysyła `bell` przez `httpSend` z limitem 5 s (`src/lib/live-sync/server.ts:11-26`). Temat `live-sync:<room>`, gdzie `room` pasuje do `^[a-z0-9-]{1,64}$` (`src/lib/live-sync/shared.ts:6-18`), więc UUID pokoju się mieści. Wzór klienta, który subskrybuje i pobiera stan, jest w `src/components/live-sync/LiveSyncDemo.tsx:33-82`.
- **Pytania.** `CATEGORIES` (8 kategorii) i `QUESTIONS` są w jednym module `src/data/questions.ts:21-40`. Wolno go importować tylko na serwerze (`lessons.md`, wpis 2).
- **Ekrany.** `/` pokazuje starterowe `Welcome.astro` z `Topbar.astro` (jedyny import `Topbar`), z literałami kolorów. `dashboard.astro` to zaślepka, z której korzystają smoke (`scripts/smoke.mjs:48,59,61`) i test ręczny S-05. Klocki shadcn są w `src/components/ui/`, bez checkbox i badge. Wzorzec formularza: wyspa React z natywnym `<form>` i błędem serwera jako kodem w `?error=` (`SignInForm.tsx`, `src/lib/auth-errors.ts:5-26`).
- **Strona testowa F-01** `/dev/live-sync` nie ma blokady trybu DEV (`src/pages/dev/live-sync.astro:1-12`). Sonda `scripts/live-sync-probe.mjs` używa tylko `/api/live-sync/{config,state,ring}`.
- **CI** (`.github/workflows/ci.yml:41-46`) startuje lokalny Supabase bez Realtime i bierze `ANON_KEY` jako `SUPABASE_KEY`. Dlatego `getPublicSupabaseConfig` zwraca tam `null`.

## Desired End State

- **Strona główna.**
  - Niezalogowany widzi na `/` nazwę gry i zaproszenie do logowania.
  - Zalogowany host widzi formularz „Nowa gra”: pole „Twój nick” i 8 kategorii, wszystkie zaznaczone, przy każdej przełącznik 18+ (wyłączony).
  - Gdy host ma otwarty pokój, widzi nad formularzem „Wróć do pokoju” z liczbą graczy.
- **Zakładanie gry.**
  - „Załóż grę” tworzy pokój, a host jest w nim pierwszym graczem.
  - Host trafia na `/r/<id>` z linkiem `/j/<kod>` i przyciskiem „Kopiuj”.
  - Druga „Nowa gra” zamyka poprzedni pokój. Gdy są w nim goście, najpierw prosi o potwierdzenie.
- **Wejście gościa.**
  - Gość otwiera `/j/<kod>`, wpisuje nick i trafia na `/r/<id>`: „Jesteś w grze jako Ola”, lista graczy i „Czekamy, aż host zacznie”.
  - Zajęty nick, zamknięta gra i nieznany link mają polskie komunikaty.
- **Lista na żywo.** Lista u hosta i gości uzupełnia się sama: dzwonek, a do tego sprawdzanie co 15 s i po powrocie do karty.
- **Logowanie.** Zalogowany na `/auth/*` trafia na `/`, chyba że adres ma `error` albo `error_code` (kontrakt z S-05).
- **Strony deweloperskie.** `/dev/live-sync` i nowa `/dev/room-states` odpowiadają 404 na produkcji.
- **Baza.** Tabele `rooms`, `players` i `player_secrets` są na produkcji. Ktoś z zewnątrz z kluczem publishable nie czyta ich wprost. Gość działa tylko przez trzy funkcje: dołączenie, stan linku i stan poczekalni.
- **Testy.** Smoke sprawdza drogę hosta i gościa, także w CI na lokalnym Supabase z migracją. Wynik testu na telefonach jest w `phone-test.md`.

Weryfikacja: kryteria sukcesu faz poniżej. Rozstrzygają smoke na produkcji i test na telefonach.

### Key Discoveries:

- **Domyślne uprawnienia w Supabase.** Supabase odbiera automatyczne uprawnienia do nowych tabel w `public`. Dokumentacja zapowiada zmianę (https://supabase.com/docs/guides/api/securing-your-api); według dyskusji supabase/discussions#45329 istniejące projekty dostaną ją 30.10.2026. Migracja musi więc sama zrobić `revoke` i `grant` i wtedy działa przed zmianą i po niej (recenzja: krytyk). Lokalny `supabase start` (binarka TypeScript CLI) bez klucza `[api].auto_expose_new_tables` nadal daje stare uprawnienia domyślne (`db-setup.ts:890` w v2.117.0), więc `config.toml` ustawia go na `false`, żeby CI odwzorowało produkcję po 30.10 (plan-review F1).
- **EXECUTE dla wszystkich.** Postgres daje `EXECUTE` każdej nowej funkcji roli `PUBLIC`, a Supabase dodatkowo `anon` i `authenticated`. Każda funkcja musi mieć `revoke execute … from public, anon, authenticated` i wybiórczy `grant` (krytyk, adwokat diabła).
- **Funkcja `security definer` w `public`.** Dla `anon` to publiczny endpoint pod `/rest/v1/rpc/<nazwa>`, dostępny z pominięciem Workera. Advisor zgłosi ostrzeżenia 0028/0029, co jest zamierzone („Option 3: intentional”) pod warunkiem, że wszystkie sprawdzenia są w samej funkcji: `set search_path = ''` i nazwy ze schematem (https://supabase.com/docs/guides/database/database-advisors).
- **Odcisk opaski nie może działać jak hasło.** Gdyby funkcje przyjmowały gotowy hash, a host mógł go odczytać przez RLS, mógłby w S-02 głosować za gościa. Dlatego funkcje dostają surowy token i liczą `sha256(convert_to(token, 'UTF8'))` same, a hash leży w osobnej tabeli bez uprawnień (adwokat diabła).
- **Ciasteczka na telefonach.**
  - Ciasteczko bez `maxAge` jest sesyjne. W przeglądarce Discorda na iOS takie ciasteczka mogą znikać, gdy aplikacja idzie w tło (niepotwierdzone), więc dajemy 24 h.
  - Przeglądarka Discorda na iOS trzyma ciasteczka osobno od Safari. Gość, który przełączy się do Safari, wygląda jak nowy, a jego nick jest zajęty. To przyjęte ograniczenie do S-04 (krytyk, adwokat diabła).
- **Dzwonek po odpowiedzi.** Workers może przerwać obietnicę po zakończeniu odpowiedzi. Adapter udostępnia `locals.cfContext.waitUntil` (`node_modules/@astrojs/cloudflare/types.d.ts`, `dist/utils/cf-helpers.d.ts:2`), więc dzwonek idzie przez `waitUntil`.
- **Klucz w CI.** `supabase status -o env` w CLI 2.117 wypisuje `PUBLISHABLE_KEY` (`sb_publishable_…`, lokalnie stały). CI może go użyć zamiast `ANON_KEY` (krytyk, kod źródłowy supabase/cli).
- **Migracje na bazę zdalną.** `db push` wymaga `supabase link`, czyli `supabase login` i hasła do bazy. Wklejenie SQL w panelu omija historię migracji, a mieszanie obu dróg psuje późniejsze `db push` (krytyk). Decyzja Karola: tylko `db push`.
- **Podgląd linku w Discordzie.** Bot Discorda pobiera wklejony link, żeby pokazać podgląd. `GET /j/<kod>` nie może więc niczego zmieniać i nie może mieć danych w znacznikach OG (adwokat diabła).

## What We're NOT Doing

- **Start gry, pytania i głosy (S-02).** Na ekranie hosta nie ma przycisku „start”. `join_room` przyjmuje gościa tylko w stanie `lobby`, a co z wejściem po starcie, zdecyduje S-02 (spóźnieni to S-08).
- **Powrót na swój nick po utracie ciasteczka (S-04).** Gość, którego telefon „zapomniał”, wpisuje inny nick, a stary nick zostaje na liście.
- **Usuwanie graczy i nowy link (S-09), współhost (S-07), lista gier i kasowanie (S-13).** Pokoje i gracze ze smoke zostają w bazie produkcyjnej do czasu S-13.
- **Przeniesienie pytań do bazy.** Pokój zapamiętuje tylko wybrane kategorie i kategorie z 18+. Losowanie w S-02 czyta pytania z pliku na serwerze.
- **Limit graczy w pokoju.** PRD nie ma limitu. Na zalanie pokoju po wycieku linku host klika „Nowa gra”.
- **Litery z innych alfabetów o tym samym wyglądzie** (cyrylickie „О” obok łacińskiego „O”). Normalizacja ich nie łączy. To przyjęte ryzyko przy grze ze znajomymi (plan-review F5).
- **Klucz secret na serwerze, konta anonimowe Supabase, sesje Astro w KV** (odrzucone w wywiadzie, sekcja „Implementation Approach”).
- **Presence i broadcast z bazy (`realtime.send`).**
- **Ramki pól i kolor przycisku (R4, K1 z `ui-checks.md:47,52`).** Wracają przez `/10x-ui`, gdy S-01 i S-05 będą na `main`, bo obie zmiany ruszają te same tokeny i klocki. Nowe widoki używają obecnych tokenów.
- **Zmiany w `/dashboard`, w krokach smoke dla `/dashboard`, w ekranie logowania i w plikach S-05** (`src/pages/auth/*`, `src/components/auth/*`, `src/pages/api/auth/*`, `src/lib/auth-errors.ts`). Klocki z `src/components/auth/` (`FormField`, `SubmitButton`, `ServerError`, `useSubmitPending`) tylko importujemy.
- **Testy jednostkowe i pgTAP.** Logikę bazy sprawdza smoke przez HTTP, lokalnie, w CI i na produkcji.

## Implementation Approach

**Decyzje z wywiadu (07.10):**

| Obszar | Decyzja |
| --- | --- |
| Nick | Wielkość liter się liczy („Ola” i „ola” to dwa nicki). Niewidoczne różnice się nie liczą: NFC, białe znaki zamienione na spację, usunięte znaki niewidoczne, zwinięte spacje, obcięte brzegi. 1–20 znaków po normalizacji. Emotki dozwolone. Litery z innych alfabetów o tym samym wyglądzie nie są łączone (przyjęte ryzyko). |
| Nick hosta | Pole „Twój nick” w „Nowej grze”. Host jest graczem z `user_id` od chwili założenia pokoju. |
| Kilka pokoi | Host ma najwyżej jeden otwarty pokój. „Nowa gra” zamyka poprzedni, a gdy są w nim goście, najpierw pyta. Stary link pokazuje „Ta gra jest zamknięta. Poproś hosta o nowy link.” |
| Kategorie | Na starcie wszystkie zaznaczone, 18+ wyłączone. Co najmniej jedna kategoria. |
| Poczekalnia gościa | Swój nick i lista graczy na żywo. |
| Tożsamość gościa | „Opaska”: losowy token (32 bajty, base64url) w ciasteczku httpOnly `mlt_player_<roomId>`, `SameSite=Lax`, `Max-Age` 24 h, `Secure` na https. W bazie tylko `sha256` tokenu, w tabeli bez uprawnień. |
| Zapis | Host przez RLS jako `authenticated` (funkcja `create_room` z `security invoker`). Gość przez funkcje `security definer` z kompletem sprawdzeń. Bez klucza secret. |
| Lista na żywo | Dzwonek z F-01 na `live-sync:<roomId>`, wysłany przez `waitUntil`. Klient pobiera stan po dzwonku, po (ponownej) subskrypcji, co 15 s, gdy karta jest widoczna, i po powrocie do karty. |
| Migracje | `npx supabase login` i `link` raz (Karol), potem każda migracja przez `db push` (ask, zgoda Karola). Nigdy SQL w panelu. |

**Ustalone w planie:**

- **Adresy.** Link gościa to `/j/<kod>`, gdzie `<kod>` ma 22 znaki base64url (16 losowych bajtów z `crypto.getRandomValues` na serwerze). Pokój to `/r/<uuid>`. Kod linku jest osobny od identyfikatora pokoju i tematu kanału, więc S-09 wymieni link bez zmiany pokoju i kanału.
- **Strona testowa F-01.** `/dev/live-sync` dostaje blokadę DEV jak kitchen sink. `/api/live-sync/*` zostaje dla sondy.
- **Stany ekranów.** Osobna strona `/dev/room-states` zamiast dopisywania do kitchen sinka, który przebudowuje S-05.
- **CI** bierze `PUBLISHABLE_KEY`.
- **Kolejność.** Najpierw baza na produkcji, potem host, potem gość z listą na żywo, stany ekranów i na końcu produkcja z telefonami.

## Critical Implementation Details

**Migracja przed kodem i bez poprawek wstecz.** Migracja trafia na produkcję w fazie 1, na długo przed scaleniem kodu (każdy push na `main` wdraża). Przedtem CI na szkicu PR wgrywa ją na czystego Postgresa (`supabase start`), bo lokalnie nie ma Dockera, a `db push --dry-run` tylko wypisuje pliki (plan-review F3). Wgranej migracji nie edytujemy. Każda poprawka to nowy plik z `npx supabase migration new`, wgrany przez `db push`.

**Worktree.** S-01 pracuje w swoim worktree, a serwer deweloperski działa na porcie 4322 (`npm run dev -- --port 4322`). Inny port na `localhost` odeśle logowanie dostawcą S-05 na produkcję. Do worktree trzeba skopiować `.dev.vars` z głównego katalogu i uruchomić `npm ci` oraz `npx astro sync`. `supabase link` zapisuje stan w `supabase/.temp/` (poza gitem) tego katalogu, w którym go uruchomiono, więc Karol łączy CLI w worktree S-01.

**Nick nigdy w adresie ani w logach.** Nick, token gościa i kod linku nie trafiają do `console.*`. Do adresu przy błędzie trafia tylko kod błędu i kod linku (już zweryfikowany wzorcem), nigdy nick.

**`rpc` zawsze POST.** Nie używać `rpc(…, { get: true })`, bo argumenty, w tym token gościa, trafiłyby do adresu i logów.

**Ciasteczko `Secure` tylko na https.** Ustawiane, gdy `context.url.protocol === "https:"`. Na `http://localhost` przeglądarki i tak je przyjmują, ale telefon w sieci lokalnej po `http://<IP>` odrzuciłby ciasteczko `Secure`. Testy na telefonach robimy na produkcji.

**Konflikty z S-05 przy scalaniu.** Obie zmiany ruszają `scripts/smoke.mjs`, tabelę tras w `README.md` i `scripts/ui-literals.mjs`. Kroki S-01 w smoke idą osobnym blokiem po istniejących krokach, a nowe widoki w osobnym katalogu `src/components/room/`, skanowanym przez `readdirSync`. Zmiana scalana jako druga rozwiązuje konflikty i powtarza smoke.

## Faza 1: Baza na produkcji

### Overview

Migracja z tabelami, uprawnieniami i funkcjami, najpierw sprawdzona przez CI na szkicu PR, potem wgrana na produkcję przez połączone CLI. Do tego reguły dla następnych migracji w `AGENTS.md` i stan bazy w `deploy-plan.md`. Kodu aplikacji jeszcze nie ruszamy.

### Changes Required:

#### 1. Połączenie CLI z projektem (Karol, raz)

**File**: brak zmian w repo (`supabase/.temp/` jest w `supabase/.gitignore`)

**Intent**: `db push` potrzebuje połączonego projektu. Karol robi to sam, bo logowanie i hasło do bazy są jego. Agent prowadzi go krok po kroku i nie widzi hasła.

**Contract**:
- W terminalu worktree S-01, poza czatem: `npx supabase login` (przeglądarka), potem `npx supabase link --project-ref xadljhxjgmckjlmsgmmj` z hasłem do bazy wpisanym w podpowiedź.
- Jeśli Karol nie zna hasła, ustawia nowe w panelu (Database → Settings). Gra używa kluczy API, więc nowe hasło niczego nie psuje.

#### 2. Migracja `room_lobby`

**File**: `supabase/migrations/<timestamp>_room_lobby.sql` (utworzona przez `npx supabase migration new room_lobby`)

**Intent**: Tabele pokoi i graczy, zamknięte domyślnie, z RLS dla hosta i funkcjami dla gościa. Wszystkie reguły gry (nick, stan pokoju, jeden otwarty pokój) pilnuje baza, bo funkcje są osiągalne z pominięciem Workera.

**Contract**:

- **Tabele** (RLS włączone na każdej):
  - `public.rooms`:
    - `id uuid pk default gen_random_uuid()`;
    - `host_id uuid not null references auth.users(id) on delete cascade`;
    - `link_token text not null unique check (link_token ~ '^[A-Za-z0-9_-]{22}$')`;
    - `status text not null default 'lobby' check (status in ('lobby','closed'))`, poszerzy go S-02;
    - `categories text[] not null check (cardinality(categories) >= 1)`;
    - `adult_categories text[] not null default '{}' check (adult_categories <@ categories)`;
    - `created_at timestamptz not null default now()`;
    - częściowy unikalny indeks `(host_id) where status = 'lobby'`.
  - `public.players`:
    - `id uuid pk default gen_random_uuid()`;
    - `room_id uuid not null references public.rooms(id) on delete cascade`;
    - `nick text not null check (char_length(nick) between 1 and 20)`;
    - `user_id uuid null references auth.users(id) on delete cascade`, ustawione tylko dla hosta;
    - `seat integer not null`: numer kolejny w pokoju (host 1, goście po kolei), zamiast godziny wejścia, bo o gościu zostaje tylko nick (plan-review F6);
    - `unique (room_id, nick)`, `unique (room_id, user_id)`, `unique (room_id, seat)`.
  - `public.player_secrets`:
    - `player_id uuid pk references public.players(id) on delete cascade`;
    - `token_hash bytea not null unique`.
- **Uprawnienia do tabel:**
  - najpierw `revoke all … from public, anon, authenticated` na wszystkich trzech;
  - potem `grant select, insert, update (status) on rooms to authenticated` oraz `grant select, insert on players to authenticated`;
  - `player_secrets` nie dostaje żadnych uprawnień ani polityk (komentarz w migracji: dostęp tylko przez funkcje);
  - `anon` nie dostaje uprawnień do żadnej tabeli.
- **Polityki** (per operacja, `(select auth.uid())`):
  - `rooms`: select, insert i update tylko gdy `host_id` to zalogowany; insert dodatkowo tylko ze `status = 'lobby'`;
  - `players`: select tylko w pokojach hosta; insert tylko z `user_id` równym zalogowanemu, w jego pokoju w stanie `lobby`.
- **`private.normalize_nick(text) returns text`:**
  - schemat `private` nie jest wystawiony w API;
  - funkcja jest `immutable`;
  - kolejność:
    1. `normalize(…, NFC)`;
    2. białe znaki (tab, nowa linia, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, U+3000) na spację;
    3. usunięcie znaków sterujących (Cc) i niewidocznych (U+00AD, U+180E, U+200B–U+200F, U+202A–U+202E, U+2060–U+2064, U+FEFF);
    4. zwinięcie ciągów spacji w jedną;
    5. obcięcie brzegów.
  - Usunięcie U+200D rozbija złożone emotki na pojedyncze, co przyjmujemy.
  - Uprawnienia: `usage` na schemacie i `execute` tylko dla `authenticated`, bo woła ją `create_room` z `security invoker`.
- **`public.create_room(p_nick text, p_link_token text, p_categories text[], p_adult_categories text[], p_confirm_close boolean default false) returns jsonb`:**
  - `security invoker`, więc działa przez RLS hosta;
  - zwraca `{ok:true, room_id, closed_room_id}` albo `{ok:false, reason}`, gdzie `reason` to `not_signed_in` | `invalid_nick` | `invalid_categories` | `open_room_has_guests` | `try_again`;
  - jeśli host ma otwarty pokój z gośćmi (gracze z `user_id is null`), a `p_confirm_close` jest fałszywe, zwraca `open_room_has_guests`; w przeciwnym razie zamyka ten pokój;
  - wstawia pokój z `host_id = auth.uid()` (kolumna nie ma wartości domyślnej) i wiersz gracza hosta z `seat = 1` w jednej transakcji;
  - `unique_violation` z częściowego indeksu (dwa „Załóż grę” naraz) zamienia na `try_again` (plan-review F2);
  - `execute` tylko dla `authenticated`.
- **`public.join_room(p_link_token text, p_nick text, p_player_token text) returns jsonb`:**
  - `security definer`, `set search_path = ''`;
  - sprawdza wzorce: link 22 znaki, token gracza `^[A-Za-z0-9_-]{43}$`;
  - nick normalizuje funkcją `private.normalize_nick`;
  - pokój szuka przez `link_token … for update` i przyjmuje tylko w stanie `lobby`;
  - wstawia gracza z `seat` o jeden większym od największego w pokoju (pod blokadą wiersza pokoju) i `sha256(convert_to(p_player_token,'UTF8'))` do `player_secrets`, a `unique_violation` na nicku zamienia na `nick_taken`;
  - zwraca `{ok:true, room_id}` albo `{ok:false, reason}`, gdzie `reason` to `invalid_nick` | `nick_taken` | `room_unknown` | `room_closed`;
  - `execute` dla `anon` i `authenticated`.
- **`public.room_link(p_link_token text) returns jsonb`:**
  - `security definer`;
  - zwraca `{status:'open', room_id}`, `{status:'closed'}` albo `{status:'unknown'}`, także dla złego wzorca;
  - `execute` dla `anon` i `authenticated`.
- **`public.room_lobby(p_room_id uuid, p_player_token text default null) returns jsonb`:**
  - `security definer`, `stable`;
  - wpuszcza hosta pokoju (`auth.uid() = host_id`) albo gracza, którego hash tokenu jest w tym pokoju; dla każdego innego zwraca `null`;
  - zwraca `{status, role:'host'|'guest', me:<nick>, players:[{nick, host:boolean}]}` w kolejności `seat`;
  - nie zwraca identyfikatorów, `user_id`, hashy ani kodu linku;
  - `execute` dla `anon` i `authenticated`.
- **Każda funkcja:** `set search_path = ''`, nazwy ze schematem, `revoke execute … from public, anon, authenticated`, potem wybiórczy `grant`. Właścicielem funkcji `security definer` musi być `postgres`.

#### 3. Reguły dla następnych migracji

**File**: `AGENTS.md` (Conventions), `context/deployment/deploy-plan.md` (stan Supabase, nowa sekcja o migracjach)

**Intent**: Następny agent (S-02 i dalej) zakłada tabele i funkcje tak samo bezpiecznie i wgrywa je tylko jedną drogą.

**Contract**:
- `AGENTS.md`, zdanie o migracjach poszerzone o:
  - każda tabela: RLS, `revoke all … from public, anon, authenticated`, jawne `grant` tylko tego, czego rola potrzebuje, i polityka na każdą nadaną operację; tabela osiągalna tylko przez funkcje nie dostaje uprawnień ani polityk;
  - każda funkcja: `set search_path = ''`, `revoke execute … from public, anon, authenticated`, wybiórczy `grant`;
  - funkcja `security definer` dla `anon` to publiczny endpoint, więc wszystkie sprawdzenia są w niej;
  - wgrywanie tylko przez `npx supabase db push` (ask), nigdy SQL w panelu; wgranej migracji nie edytujemy.
- `deploy-plan.md`:
  - wpis z datą: CLI połączone (`supabase link`, w którym katalogu);
  - migracje: `db push --dry-run`, `db push`, `migration list`;
  - zapowiedź Supabase o uprawnieniach od 30.10.2026 i to, że nasze migracje nadają je jawnie.

#### 4. CI jak produkcja po 30.10

**File**: `supabase/config.toml`

**Intent**: Lokalny Supabase w CI ma nie dawać nowym tabelom i funkcjom uprawnień domyślnych, tak jak produkcja po 30.10. Dzięki temu CI sprawdza, że migracja sama nadaje wszystko, czego gra potrzebuje (plan-review F1).

**Contract**: W sekcji `[api]` klucz `auto_expose_new_tables = false` z komentarzem: odwzorowuje domyślne uprawnienia produkcji po zmianie Supabase z 30.10.2026; nasze migracje nadają uprawnienia jawnie.

### Success Criteria:

#### Automated Verification:

- CI na szkicu PR gałęzi S-01 zielone: `supabase start` wgrywa migrację `room_lobby` przy `auto_expose_new_tables = false`, a istniejący smoke przechodzi (przed `db push`)
- `npx supabase db push --dry-run` (ask) pokazuje tylko migrację `room_lobby`
- Po `npx supabase db push` (ask, za zgodą Karola) `npx supabase migration list` pokazuje `room_lobby` lokalnie i zdalnie
- Zapytania REST z kluczem publishable (`GET /rest/v1/rooms`, `/players`, `/player_secrets`) kończą się błędem uprawnień, a nie wierszami
- Wywołania RPC z kluczem publishable: `room_link` z nieznanym kodem daje `{"status":"unknown"}`, `join_room` z nieznanym linkiem daje `{"ok":false,"reason":"room_unknown"}`, `create_room` jako `anon` daje błąd uprawnień
- Bramka przechodzi: `npm run lint`, `npx astro check`, `npm run build`

#### Manual Verification:

- Karol w panelu Supabase (Advisors → Security): brak błędów RLS dla nowych tabel; nowe ostrzeżenia to tylko 0028/0029 dla `join_room`, `room_link` i `room_lobby`
- Karol w Table Editor widzi `rooms`, `players` i `player_secrets` z włączonym RLS

**Implementation Note**: Kolejność: commit migracji, push gałęzi S-01 i szkic PR do `main` (za zgodą Karola; push gałęzi nie wdraża produkcji), zielone CI, dopiero potem `db push --dry-run` i `db push`. Klucz publishable do zapytań REST agent czyta z `.dev.vars` i nie wypisuje go. `db push` tylko za wyraźną zgodą Karola. Po fazie commit w worktree i pauza na potwierdzenie Karola.

---

## Faza 2: Host — nowa gra i pokój z linkiem

### Overview

Strona główna dla obu stanów, zakładanie gry z zamykaniem starego pokoju, ekran pokoju hosta z linkiem. Do tego przekierowanie zalogowanego z `/auth/*`, kroki smoke dla hosta i CI na kluczu publishable.

### Changes Required:

#### 1. Logika pokoju po stronie serwera

**File**: `src/lib/rooms/server.ts`, `src/lib/rooms/tokens.ts`, `src/lib/rooms/errors.ts`, `src/lib/rooms/shared.ts` (nowe)

**Intent**: Jedno miejsce na wywołania funkcji bazy, tokeny i polskie komunikaty, w tym samym stylu co `auth-errors.ts`.

**Contract**:
- `tokens.ts`:
  - `newLinkToken()` daje 22 znaki base64url z 16 bajtów, a `newPlayerToken()` 43 znaki z 32 bajtów (`crypto.getRandomValues`);
  - `playerCookieName(roomId)` daje `mlt_player_<roomId>`;
  - `playerCookieOptions(url)` daje `httpOnly`, `sameSite: "lax"`, `path: "/"`, `maxAge: 86400` oraz `secure` tylko na https;
  - wzorce `LINK_TOKEN_PATTERN` i `UUID_PATTERN`.
- `server.ts`:
  - wrappery `createRoom`, `roomLink`, `joinRoom` i `roomLobby` na `supabase.rpc(...)` (zawsze POST);
  - błąd sieci albo 5xx daje kod `service_unavailable`;
  - `ringLobby(locals, supabase, roomId)` woła `ringRoom(supabase, roomId, Date.now())` przez `locals.cfContext.waitUntil`, a gdy go brak, czeka na wynik; błąd dzwonka tylko loguje.
- `shared.ts` (bezpieczny w przeglądarce): `NICK_MAX_LENGTH = 20`, typ `LobbyState` (`status`, `role`, `me`, `players: {nick, host}[]`).
- `errors.ts`:
  - `roomErrorMessage(code)` daje polski tekst dla `invalid_nick`, `nick_taken`, `invalid_categories`, `open_room_has_guests`, `try_again`, `room_closed`, `room_unknown`, `service_unavailable`, a dla innego kodu tekst ogólny;
  - `nick_taken` dopowiada: „Jeśli to ty, a telefon cię nie pamięta (np. otworzyłeś link w innej przeglądarce), wpisz inny nick.”

#### 2. Zakładanie gry

**File**: `src/pages/api/rooms/index.ts` (nowy, `POST`)

**Intent**: Formularz „Nowa gra” tworzy pokój albo wraca z kodem błędu, tym samym kanałem co logowanie.

**Contract**:
- Bez `locals.user` daje 302 na `/auth/signin`.
- Pola formularza: `nick`, `category` (wielokrotne), `adult` (wielokrotne), `confirm_close`.
- Kategorie spoza `CATEGORIES` dają `invalid_categories`. `adult` spoza zaznaczonych kategorii odrzucamy po cichu.
- Sukces: dzwonek do `closed_room_id`, jeśli jest (goście starego pokoju od razu widzą zamknięcie), potem 302 na `/r/<room_id>`.
- Błąd: 302 na `/?error=<kod>`.

#### 3. Strona główna

**File**: `src/pages/index.astro` (przepisany), `src/components/room/NewGameForm.tsx`, `src/components/room/Landing.astro`, `src/components/room/AppHeader.astro` (nowe); usunąć `src/components/Welcome.astro`, `src/components/Topbar.astro`; `src/components/ui/checkbox.tsx`, `src/components/ui/badge.tsx` (`npx shadcn@latest add checkbox badge`)

**Intent**: Niezalogowany widzi zaproszenie do logowania. Host widzi „Nową grę” i ewentualnie „Wróć do pokoju”. Widoki są od razu na tokenach.

**Contract**:
- **`AppHeader.astro`:** nazwa gry; dla zalogowanego jego e-mail i „Wyloguj” (`POST /api/auth/signout`).
- **`Landing.astro`:** opis w jednym zdaniu, przycisk „Zaloguj się, żeby założyć grę” do `/auth/signin` i podpowiedź „Masz link od hosta? Otwórz go, żeby dołączyć”.
- **Dane strony dla zalogowanego:** otwarty pokój hosta przez RLS (`rooms`, `status = 'lobby'`) i liczba graczy przez `room_lobby`. Kategorie z `CATEGORIES` idą do wyspy jako `{id, name}[]`, import tylko we frontmatterze (`lessons.md`).
- **Wyspa `NewGameForm`:**
  - natywny `<form method="POST" action="/api/rooms">`;
  - pole nicku z licznikiem do 20 i walidacją w przeglądarce;
  - każda kategoria ma checkbox (domyślnie zaznaczony) i checkbox „18+” (domyślnie wyłączony, nieaktywny, gdy kategoria jest odznaczona);
  - błąd, gdy nie zostanie żadna kategoria;
  - `ServerError` dla `?error=`;
  - przy otwartym pokoju z gośćmi pierwsze kliknięcie pokazuje w formularzu ostrzeżenie „Stary pokój (N graczy) zostanie zamknięty” i drugi przycisk, który wysyła `confirm_close=1`; bez `window.confirm`;
  - prop `preview` dla `/dev/room-states` (wzór z `SignInForm.tsx:15-22`).

#### 4. Ekran pokoju (część hosta)

**File**: `src/pages/r/[id].astro`, `src/components/room/RoomLobby.tsx` (nowe)

**Intent**: Host widzi link do wklejenia, przycisk „Kopiuj” i listę graczy. Na żywo i widok gościa dochodzą w fazie 3, ale strona i komponent od razu obsługują obie role.

**Contract**:
- Zły UUID albo `room_lobby` zwracające `null` dają stronę „Nie jesteś w tym pokoju. Poproś hosta o link.” ze statusem 404.
- Host dostaje `link_token` przez RLS (`rooms`) i pełny adres `${Astro.url.origin}/j/<kod>`.
- Wyspa `RoomLobby` dostaje `roomId`, `initial: LobbyState`, `linkUrl` (tylko host) i `preview`.
- Przycisk „Kopiuj” używa `navigator.clipboard.writeText` i pokazuje „Skopiowano”. Gdy schowek nie działa, zaznacza pole z linkiem.
- Lista pokazuje liczbę graczy, host ma odznakę „host”.

#### 5. Przekierowanie zalogowanego

**File**: `src/middleware.ts`

**Intent**: Zalogowany host nie widzi ekranu logowania (D2 z `ui-signin-contract`), ale komunikaty błędów S-05 dalej do niego docierają.

**Contract**: Gdy jest `locals.user`, a ścieżka zaczyna się od `/auth/` i adres nie ma parametru `error` ani `error_code`, odpowiedź to przekierowanie na `/`. `PROTECTED_ROUTES` bez zmian (`/dashboard`).

#### 6. Smoke hosta i CI

**File**: `scripts/smoke.mjs`, `.github/workflows/ci.yml`, `scripts/ui-literals.mjs`

**Intent**: Smoke łapie zepsute zakładanie gry lokalnie, w CI i na produkcji. CI dostaje prawdziwy klucz publishable.

**Contract**:
- **`smoke.mjs`:**
  - `request` przyjmuje opcjonalny słoik ciasteczek i na życzenie zwraca treść odpowiedzi;
  - nowy blok `roomSteps` po istniejących krokach: logowanie hosta; `GET /auth/signin` daje 302 `/`; `GET /auth/signin?error=access_denied` daje 200; `POST /api/rooms` (nick „Smoke host”, wszystkie kategorie, bez 18+, `confirm_close=1`, żeby goście z przerwanego wcześniej przebiegu nie blokowali startu) daje 302 `/r/<uuid>`; `GET /r/<id>` daje 200 z linkiem `/j/<22 znaki>` w treści (zapamiętany dla fazy 3); `GET /` daje 200.
- **`ci.yml`:** `grep` bierze `^(API_URL|PUBLISHABLE_KEY)=`, a `SUPABASE_KEY` i `apikey` przy zakładaniu konta testowego używają `PUBLISHABLE_KEY`. Realtime zostaje wyłączony.
- **`ui-literals.mjs`:** dochodzą katalog `src/components/room` (przez `readdirSync`), `src/pages/index.astro` i `src/pages/r/[id].astro`.

### Success Criteria:

#### Automated Verification:

- Bramka przechodzi: `npm run lint` (z `ui-literals: 0 literals`), `npx astro check`, `npm run build`
- Smoke lokalny (`BASE_URL=http://localhost:4322 npm run smoke`) kończy się „All smoke steps passed”, z krokami hosta
- `grep -n "PUBLISHABLE_KEY" .github/workflows/ci.yml` pokazuje oba miejsca, a `grep -n "ANON_KEY" .github/workflows/ci.yml` nic

#### Manual Verification:

- Karol zalogowany na `http://localhost:4322`: `/` pokazuje formularz z 8 zaznaczonymi kategoriami i wyłączonym 18+, a „Załóż grę” prowadzi na ekran pokoju z linkiem i nim samym na liście
- „Kopiuj” kopiuje pełny link `/j/<kod>`
- Druga „Nowa gra” przy pustym pokoju tworzy nowy pokój bez pytania, a `/` pokazuje „Wróć do pokoju” do nowego
- Zalogowany na `/auth/signin` trafia na `/`, a `/auth/signin?error=access_denied` pokazuje komunikat
- Niezalogowany na `/` widzi zaproszenie do logowania

**Implementation Note**: Smoke lokalny tworzy pokoje w bazie produkcyjnej na koncie testowym. To oczekiwane. Po fazie commit i pauza na potwierdzenie Karola.

---

## Faza 3: Gość i lista na żywo

### Overview

Strona linku, wejście gościa z opaską, poczekalnia gościa, lista na żywo u wszystkich, blokada DEV dla strony testowej F-01 i kroki smoke dla gościa.

### Changes Required:

#### 1. Strona linku

**File**: `src/pages/j/[token].astro`, `src/components/room/JoinForm.tsx` (nowe)

**Intent**: Gość w mniej niż 30 s wpisuje nick i jest w pokoju. Zamknięta gra i zły link mówią po polsku, co zrobić.

**Contract**:
- `GET` niczego nie zmienia (podgląd linku w Discordzie). Tytuł strony to „Dołącz do gry”, bez danych pokoju w znacznikach OG.
- Zły wzorzec albo `room_link` = `unknown` daje stronę „Nie znamy tego linku. Sprawdź, czy skopiował się cały.” ze statusem 404.
- `closed` daje „Ta gra jest zamknięta. Poproś hosta o nowy link.” ze statusem 410.
- `open`:
  - jeśli zalogowany jest hostem tego pokoju albo ma ważne ciasteczko tego pokoju (`room_lobby` nie jest `null`), przekierowanie na `/r/<room_id>`;
  - w przeciwnym razie wyspa `JoinForm`: pole nicku (licznik do 20), ukryte pole `link`, przycisk „Dołącz”, `ServerError` dla `?error=` i prop `preview`.

#### 2. Dołączenie

**File**: `src/pages/api/rooms/join.ts` (nowy, `POST`)

**Intent**: Wpis do pokoju, opaska i dzwonek do hosta.

**Contract**:
- Pola `link` i `nick`. Zły wzorzec `link` daje 302 `/j/invalid` (strona 404).
- Gość z ważnym ciasteczkiem tego pokoju trafia na `/r/<id>` bez nowego wpisu.
- W przeciwnym razie `newPlayerToken()` → `join_room`:
  - sukces: ciasteczko `mlt_player_<room_id>`, `ringLobby` i 302 `/r/<room_id>`;
  - błąd: 302 `/j/<link>?error=<kod>`.
- Nick nie trafia do adresu ani do logów.

#### 3. Stan poczekalni i lista na żywo

**File**: `src/pages/api/rooms/[id]/lobby.ts` (nowy, `GET`), `src/components/room/RoomLobby.tsx`, `src/pages/r/[id].astro`

**Intent**: Wspólne źródło prawdy dla hosta i gości: baza przez `room_lobby`, a kanał to tylko sygnał „sprawdź”.

**Contract**:
- **Endpoint:** zły UUID albo `null` daje 404 JSON, w przeciwnym razie 200 z `LobbyState`; zawsze `Cache-Control: no-store`. Token gracza bierze z ciasteczka `mlt_player_<id>`.
- **`r/[id].astro`:** czyta ciasteczko pokoju dla gościa i przekazuje do wyspy konfigurację z `getPublicSupabaseConfig()`, która może być `null`.
- **`RoomLobby`:**
  - subskrypcja `topicFor(roomId)`; pobranie stanu po każdym dzwonku i po każdym `SUBSCRIBED`;
  - co 15 s, gdy `document.visibilityState === "visible"`, i przy `visibilitychange` na `visible`;
  - starsza odpowiedź nie nadpisuje nowszej (licznik żądań);
  - bez konfiguracji działa samo odpytywanie co 15 s;
  - błąd pobrania pokazuje dyskretne „Nie udało się odświeżyć listy” i nie czyści listy.
- **Widoki `RoomLobby`:**
  - host: link, „Kopiuj”, lista;
  - gość: „Jesteś w grze jako <nick>”, lista z oznaczeniem „ty” i „Czekamy, aż host zacznie.”;
  - `status = 'closed'`: „Ta gra jest zamknięta. Poproś hosta o nowy link.”, bez listy.
- Klient Supabase w przeglądarce służy tylko do Realtime (`persistSession: false` i podobne, jak w `LiveSyncDemo.tsx:35-37`).

#### 4. Strona testowa F-01 tylko lokalnie

**File**: `src/pages/dev/live-sync.astro`, `README.md` (opis strony i sondy)

**Intent**: Decyzja F-01 „do czasu S-01” się kończy. Strona znika z produkcji, a endpointy zostają dla sondy.

**Contract**: Ten sam wzór co `src/pages/dev/ui-kitchen-sink.astro:9-12` (`import.meta.env.DEV`, status 404, warunkowy render). `/api/live-sync/*` bez zmian.

#### 5. Smoke gościa i skan literałów

**File**: `scripts/smoke.mjs`, `scripts/ui-literals.mjs`

**Intent**: Smoke sprawdza regułę nicku i drogi błędów przez HTTP, w CI na lokalnym Supabase z migracją.

**Contract**:
- Nowe kroki w `roomSteps`, każdy gość z własnym słoikiem ciasteczek:
  - `GET /j/<kod>` daje 200;
  - gość „Ola” daje 302 `/r/<id>` i ciasteczko;
  - `GET /api/rooms/<id>/lobby` jako „Ola” daje 200 z nickami „Smoke host” i „Ola”;
  - „Ola ” (spacja) i „O​la” dają 302 `?error=nick_taken`;
  - „ola” daje 302 `/r/<id>`;
  - `GET /api/rooms/<id>/lobby` bez ciasteczka daje 404;
  - host `POST /api/rooms` bez potwierdzenia daje 302 `/?error=open_room_has_guests`, a z `confirm_close=1` daje 302 `/r/<nowy>`;
  - `GET /j/<stary kod>` daje 410;
  - `GET /api/rooms/<stary id>/lobby` jako „Ola” daje 200 ze `status: "closed"`;
  - `GET /j/AAAAAAAAAAAAAAAAAAAAAA` daje 404;
  - wylogowanie.
- `ui-literals.mjs`: dochodzi `src/pages/j/[token].astro`.

### Success Criteria:

#### Automated Verification:

- Bramka przechodzi: `npm run lint` (z `ui-literals: 0 literals`), `npx astro check`, `npm run build`
- Smoke lokalny (`BASE_URL=http://localhost:4322 npm run smoke`) kończy się „All smoke steps passed”, z krokami gościa
- Build produkcyjny odpowiada 404 na `/dev/live-sync` (`npm run preview -- --port 4323` i `curl -s -o /dev/null -w "%{http_code}" http://localhost:4323/dev/live-sync`)

#### Manual Verification:

- Dwa okna (zwykłe i incognito) na `http://localhost:4322`: gość dołącza linkiem, a lista hosta pokazuje go bez odświeżania w około 2 s; gość widzi hosta i siebie z oznaczeniem „ty”
- Karta hosta w tle przez minutę, w tym czasie dołącza gość; po powrocie lista jest aktualna
- Gość po odświeżeniu zostaje w poczekalni pod swoim nickiem, a ponowne otwarcie linku prowadzi go do pokoju
- Host, który otworzy swój link, trafia na swój ekran pokoju, a lista nie ma drugiego wpisu hosta
- Po „Nowej grze” z potwierdzeniem poczekalnia gościa przełącza się na „Ta gra jest zamknięta” bez odświeżania

**Implementation Note**: Po fazie commit i pauza na potwierdzenie Karola.

---

## Faza 4: Ekrany — stany do oceny Karola

### Overview

Strona ze wszystkimi stanami nowych ekranów, dostępna tylko lokalnie, i zrzuty do oceny Karola. Bramka wizualna jak w M2L5.

### Changes Required:

#### 1. Strona stanów

**File**: `src/pages/dev/room-states.astro` (nowa), `scripts/ui-literals.mjs`

**Intent**: Każdy stan widać obok siebie, bez bazy i bez sieci.

**Contract**:
- Blokada DEV jak w `ui-kitchen-sink.astro:9-12`.
- Stany przez prop `preview`, wyspy bez zapytań i bez subskrypcji:
  - `NewGameForm`: domyślny, błąd nicku, brak kategorii, potwierdzenie zamknięcia pokoju z gośćmi, wysyłanie, błąd serwera;
  - strona główna niezalogowanego;
  - `JoinForm`: domyślny, `nick_taken` z podpowiedzią, wysyłanie;
  - strony „Nie znamy tego linku” i „Ta gra jest zamknięta”;
  - `RoomLobby`: host z 1 graczem i z 8 graczami, nick 20-znakowy i z emotką, „Skopiowano”, gość, pokój zamknięty, błąd odświeżania.
- Plik trafia do `ui-literals.mjs`.

#### 2. Zrzuty do oceny

**File**: brak zmian w repo (zrzuty i strona HTML w scratchpadzie)

**Intent**: Karol ocenia wygląd na dużych zrzutach, a nie w opisie.

**Contract**:
- Zrzuty z headless Chrome, szerokość telefonu (390 px) i komputera, z `http://localhost:4322/dev/room-states`.
- Strona HTML z zrzutami i sekcją „Co oceniasz” otwarta w Chrome Karola.
- Poprawki z oceny wchodzą w tej fazie.

### Success Criteria:

#### Automated Verification:

- Bramka przechodzi: `npm run lint` (z `ui-literals: 0 literals`, także dla `room-states.astro`), `npx astro check`, `npm run build`
- Build produkcyjny odpowiada 404 na `/dev/room-states` (`npm run preview -- --port 4323` i `curl -s -o /dev/null -w "%{http_code}" http://localhost:4323/dev/room-states`)

#### Manual Verification:

- Karol ocenia zrzuty wszystkich stanów i akceptuje albo wskazuje poprawki, które wchodzą w tej fazie
- Formularze działają z klawiatury: Tab przechodzi po polach i przyciskach, fokus jest widoczny, a błąd serwera czytnik ogłasza (`role="alert"`)

**Implementation Note**: Po fazie commit i pauza na potwierdzenie Karola.

---

## Faza 5: Produkcja i telefony

### Overview

Dokumentacja, PR, scalenie za zgodą Karola (wdrożenie), smoke na produkcji i test na telefonach.

### Changes Required:

#### 1. Dokumentacja

**File**: `README.md`, `context/changes/room-lobby/phone-test.md` (nowy)

**Intent**: Następna osoba wie, jakie są trasy i jak działa wejście gościa. Wynik testu na telefonach jest zapisany.

**Contract**:
- `README.md`:
  - tabela tras: `/`, `/j/<kod>`, `/r/<id>`, `/dev/room-states` (dev), `POST /api/rooms`, `POST /api/rooms/join`, `GET /api/rooms/<id>/lobby`;
  - opis smoke (kroki pokoju);
  - sekcja o migracjach: `npx supabase migration new`, wgrywanie przez `db push` za zgodą;
  - CI na `PUBLISHABLE_KEY`.
- `phone-test.md`: urządzenia, przeglądarki (w tym przeglądarka Discorda), czasy dołączenia, wyniki punktów z Manual Verification.

#### 2. PR i scalenie

**File**: brak (git i GitHub)

**Intent**: Kod trafia na produkcję dopiero po zielonym CI i za zgodą Karola. Migracja jest tam od fazy 1.

**Contract**:
- Szkic PR z fazy 1 przechodzi w gotowy do przeglądu.
- Przed scaleniem `/10x-impl-review` na gałęzi, poprawki z triage i ponowny smoke lokalny (`lessons.md`, wpis 3), bo scalenie to wdrożenie (plan-review F4).
- Jeśli S-05 jest już scalone, najpierw rebase na `main` i rozwiązanie konfliktów (`smoke.mjs`, `README.md`, `ui-literals.mjs`), potem ponowny smoke lokalny.
- Push i scalenie tylko za zgodą Karola.

### Success Criteria:

#### Automated Verification:

- CI na PR zielone: `ci` i `smoke` (lokalny Supabase z migracją `room_lobby`, klucz `PUBLISHABLE_KEY`)
- Po scaleniu (za zgodą Karola) smoke na produkcji (`BASE_URL=https://most-likely-to.charlesonthewave.workers.dev npm run smoke`) kończy się „All smoke steps passed”
- Produkcja odpowiada 404 na `/dev/live-sync` i `/dev/room-states` (`curl -s -o /dev/null -w "%{http_code}" https://most-likely-to.charlesonthewave.workers.dev/dev/live-sync` i to samo dla `/dev/room-states`)

#### Manual Verification:

- Test na produkcji: host na laptopie, co najmniej 3 telefony (iPhone z aplikacji Discord, Android z aplikacji Discord, jeden ze zwykłej przeglądarki). Każdy gość dołącza w mniej niż 30 s bez instrukcji, a lista hosta i gości uzupełnia się na żywo. Wynik zapisany w `phone-test.md`
- Karol zakłada grę od wejścia na stronę do linku w mniej niż 5 minut
- iPhone: gość z przeglądarki Discorda po przejściu do Safari widzi przy swoim nicku komunikat „zajęty” z podpowiedzią. To znane ograniczenie do S-04, zapisane w `phone-test.md`

**Implementation Note**: `/10x-impl-review` idzie przed scaleniem (sekcja „PR i scalenie”). Przed archiwum lekcja do `lessons.md`, jeśli wyjdzie coś powtarzalnego.

---

## Testing Strategy

### Unit Tests:

- Brak frameworka (AGENTS.md, Testing). Reguły nicku i bezpieczeństwo funkcji sprawdzamy przez HTTP w smoke, bo gość i tak dociera do bazy tylko przez nie.

### Integration Tests:

- Smoke (`scripts/smoke.mjs`) z blokiem `roomSteps`:
  - droga hosta: zakładanie, link, zamykanie starego pokoju;
  - droga gościa: wejście, `nick_taken` dla spacji i znaku niewidocznego, inna wielkość liter dozwolona, zamknięty i nieznany link, poczekalnia bez ciasteczka;
  - przekierowanie zalogowanego z `/auth/*` z wyjątkiem `?error=`.
- Smoke działa lokalnie (produkcyjna baza, konto testowe), w CI (lokalny Supabase z migracją) i na produkcji po wdrożeniu.
- Zapytania REST z kluczem publishable w fazie 1 potwierdzają, że tabele są zamknięte dla `anon`.

### Manual Testing Steps:

1. Dwa okna na `localhost:4322`: host zakłada grę, gość dołącza, lista hosta uzupełnia się sama.
2. Karta hosta w tle, dołącza gość, powrót do karty: lista aktualna.
3. Gość odświeża stronę: zostaje w poczekalni pod swoim nickiem.
4. „Nowa gra” przy gościach w pokoju: potwierdzenie, a gość widzi „gra zamknięta”.
5. Na produkcji telefony z aplikacji Discord: dołączenie w mniej niż 30 s, lista na żywo, przejście do Safari na iPhonie.

## Performance Considerations

- Odpytywanie co 15 s przy widocznej karcie: 20 graczy przez godzinę to około 4800 żądań do Workera i tyle samo wywołań `room_lobby`. To mało przy limicie 100 tys. żądań dziennie (`infrastructure.md:49-52`).
- Dzwonek przy każdym dołączeniu to 1 + N wiadomości Realtime. Przy 20 graczach to pomijalne wobec 2 mln miesięcznie.
- `join_room` blokuje wiersz pokoju (`for update`), więc dołączenia do jednego pokoju idą po kolei. Przy kilkunastu osobach to milisekundy.

## Migration Notes

- Migracja `room_lobby` jest pierwszą w projekcie. Trafia na produkcję w fazie 1 przez `db push`, przed jakimkolwiek kodem, który jej używa.
- Wycofanie: nowa migracja z `drop table` (najpierw `player_secrets`, `players`, `rooms`), funkcji i schematu `private`. Bez edycji wgranej migracji.
- Dane ze smoke (pokoje i gracze konta testowego) zostają w bazie produkcyjnej. Posprząta je S-13 albo jednorazowa migracja.

## References

- Research: `context/changes/room-lobby/research.md`
- PRD: `context/foundation/prd.md` (US-01, FR-002, FR-004, FR-005, FR-011, Access Control)
- Roadmapa: `context/foundation/roadmap.md` (S-01)
- Technika na żywo F-01: `context/archive/2026-09-27-live-sync-spike/plan.md`, `measurements.md`
- Plan S-05 (styk): `context/changes/one-click-host-login/plan.md`
- Wzorce w kodzie: `src/lib/live-sync/server.ts:11-26`, `src/components/live-sync/LiveSyncDemo.tsx:33-82`, `src/lib/auth-errors.ts:5-26`, `src/pages/dev/ui-kitchen-sink.astro:9-12`, `src/components/auth/SignInForm.tsx:15-22`
- Supabase: https://supabase.com/docs/guides/api/securing-your-api, https://supabase.com/docs/guides/database/database-advisors, https://supabase.com/docs/guides/database/postgres/row-level-security, https://supabase.com/docs/guides/deployment/database-migrations

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza na produkcji

#### Automated

- [ ] 1.8 CI na szkicu PR zielone z migracją `room_lobby` przy `auto_expose_new_tables = false` (przed `db push`)
- [ ] 1.1 `npx supabase db push --dry-run` (ask) pokazuje tylko migrację `room_lobby`
- [ ] 1.2 Po `npx supabase db push` (ask, za zgodą Karola) `npx supabase migration list` pokazuje `room_lobby` lokalnie i zdalnie
- [ ] 1.3 Zapytania REST z kluczem publishable do `rooms`, `players`, `player_secrets` kończą się błędem uprawnień
- [ ] 1.4 Wywołania RPC z kluczem publishable: `room_link` → `unknown`, `join_room` → `room_unknown`, `create_room` jako `anon` → błąd uprawnień
- [x] 1.5 Bramka przechodzi: `npm run lint`, `npx astro check`, `npm run build`

#### Manual

- [ ] 1.6 Advisors → Security: brak błędów RLS, nowe ostrzeżenia tylko 0028/0029 dla trzech funkcji gościa
- [ ] 1.7 Table Editor: trzy tabele z włączonym RLS

### Phase 2: Host — nowa gra i pokój z linkiem

#### Automated

- [ ] 2.1 Bramka przechodzi z `ui-literals: 0 literals`
- [ ] 2.2 Smoke lokalny na porcie 4322 przechodzi z krokami hosta
- [ ] 2.3 CI używa `PUBLISHABLE_KEY` zamiast `ANON_KEY`

#### Manual

- [ ] 2.4 Formularz „Nowa gra” z 8 kategoriami i wyłączonym 18+ prowadzi na ekran pokoju z linkiem i hostem na liście
- [ ] 2.5 „Kopiuj” kopiuje pełny link `/j/<kod>`
- [ ] 2.6 Druga „Nowa gra” przy pustym pokoju działa bez pytania, a `/` pokazuje „Wróć do pokoju”
- [ ] 2.7 Zalogowany na `/auth/signin` trafia na `/`, a z `?error=access_denied` widzi komunikat
- [ ] 2.8 Niezalogowany na `/` widzi zaproszenie do logowania

### Phase 3: Gość i lista na żywo

#### Automated

- [ ] 3.1 Bramka przechodzi z `ui-literals: 0 literals`
- [ ] 3.2 Smoke lokalny na porcie 4322 przechodzi z krokami gościa
- [ ] 3.3 Build produkcyjny odpowiada 404 na `/dev/live-sync`

#### Manual

- [ ] 3.4 Gość dołącza linkiem, a lista hosta pokazuje go bez odświeżania w około 2 s
- [ ] 3.5 Po powrocie do karty hosta z tła lista jest aktualna
- [ ] 3.6 Gość po odświeżeniu zostaje w poczekalni pod swoim nickiem
- [ ] 3.7 Host otwierający swój link trafia na swój ekran pokoju bez drugiego wpisu
- [ ] 3.8 Po „Nowej grze” z potwierdzeniem gość widzi „Ta gra jest zamknięta” bez odświeżania

### Phase 4: Ekrany — stany do oceny Karola

#### Automated

- [ ] 4.1 Bramka przechodzi z `ui-literals: 0 literals` także dla `room-states.astro`
- [ ] 4.2 Build produkcyjny odpowiada 404 na `/dev/room-states`

#### Manual

- [ ] 4.3 Karol ocenia zrzuty wszystkich stanów i akceptuje albo wskazuje poprawki
- [ ] 4.4 Formularze działają z klawiatury, fokus widoczny, błąd serwera ogłaszany

### Phase 5: Produkcja i telefony

#### Automated

- [ ] 5.1 CI na PR zielone (`ci` i `smoke` z migracją i `PUBLISHABLE_KEY`)
- [ ] 5.2 Smoke na produkcji po scaleniu przechodzi
- [ ] 5.3 Produkcja odpowiada 404 na `/dev/live-sync` i `/dev/room-states`

#### Manual

- [ ] 5.4 Test na telefonach: każdy gość dołącza w mniej niż 30 s bez instrukcji, lista na żywo, wynik w `phone-test.md`
- [ ] 5.5 Karol zakłada grę w mniej niż 5 minut
- [ ] 5.6 iPhone: przejście z przeglądarki Discorda do Safari daje komunikat „zajęty” z podpowiedzią, zapisany jako znane ograniczenie
