# Pokój i poczekalnia (room-lobby) — Plan Brief

> Full plan: `context/changes/room-lobby/plan.md`
> Research: `context/changes/room-lobby/research.md`

## What & Why

Host zakłada grę (swój nick, kategorie, 18+ osobno przy każdej) i dostaje link na Discorda. Gość otwiera link na telefonie, wpisuje nick i trafia do poczekalni, a wszyscy widzą listę graczy na żywo (US-01, FR-002, FR-005). To pierwsza zmiana z tabelami w bazie. Jej schemat i tożsamość gościa dziedziczą S-02 (jeden głos na gracza), S-04 (powrót na nick) i S-09 (nowy link).

## Starting Point

- Gotowy jest dzwonek z F-01 (publiczny kanał, stan z serwera, sprawdzony na produkcji na 20 telefonach).
- Gotowa jest baza pytań F-02 (8 kategorii, tylko na serwerze) i logowanie hosta.
- Nie ma tabel, migracji, tożsamości gościa ani ekranów gry. `/` to strona startera.
- CLI Supabase nie jest połączone, a projekt Supabase jest jeden dla pracy i produkcji.

## Desired End State

- Zalogowany host na `/` zakłada grę i trafia na `/r/<id>` z linkiem `/j/<kod>` i przyciskiem „Kopiuj”.
- Gość z linku wpisuje nick i widzi „Jesteś w grze jako Ola”, listę graczy i „Czekamy, aż host zacznie”.
- Lista u wszystkich uzupełnia się sama.
- Druga „Nowa gra” zamyka stary pokój, a jego link mówi, że gra jest zamknięta.
- Smoke sprawdza obie drogi lokalnie, w CI i na produkcji. Test na telefonach z aplikacji Discord jest zapisany.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Nick | „Ola” ≠ „ola”, niewidoczne różnice się nie liczą (spacje, znaki niewidoczne, NFC), 1–20 znaków | Na liście nie ma dwóch nicków różniących się tylko niewidocznymi znakami; litery z innych alfabetów o tym samym wyglądzie to przyjęte ryzyko. | Plan (Karol), plan-review F5 |
| Nick hosta | Pole „Twój nick” w „Nowej grze” | Host głosuje i jest graczem powiązanym z kontem od początku. | Plan (Karol) |
| Kilka pokoi | Najwyżej jeden otwarty; „Nowa gra” zamyka stary, przy gościach pyta | Nikt nie czeka w porzuconej poczekalni. | Plan (Karol) |
| Kategorie | Wszystkie zaznaczone, 18+ wyłączone, minimum jedna | Najszybsza droga do gry, a 18+ to świadomy wybór. | Plan (Karol) |
| Poczekalnia gościa | Swój nick i lista na żywo | Gość widzi znajomych, a S-02 i tak potrzebuje tej listy. | Plan (Karol) |
| Tożsamość gościa | Ciasteczko httpOnly na 24 h, w bazie tylko `sha256` w tabeli bez uprawnień | Bez kont i limitów; odcisk nie działa jak hasło. | Research, recenzja |
| Zapis | Host przez RLS (`create_room` invoker), gość przez funkcje `security definer` z kompletem sprawdzeń; bez klucza secret | Wytrych do wspólnej bazy produkcyjnej nie trafia do `.dev.vars`. | Research, recenzja |
| Lista na żywo | Dzwonek z F-01 przez `waitUntil` + odpytywanie co 15 s i po powrocie do karty | Wzór sprawdzony w F-01; zgubiony dzwonek to najwyżej 15 s opóźnienia. | Research, recenzja |
| Migracje | `supabase login` + `link` raz, potem tylko `db push` za zgodą | Supabase pamięta historię; mieszanie z SQL w panelu ją psuje. | Plan (krytyk) |
| Próba migracji | Szkic PR po fazie 1: CI wgrywa migrację na czystego Postgresa (`auto_expose_new_tables = false`), dopiero potem `db push` | Bez Dockera to jedyna próba przed jedyną bazą. | plan-review F1, F3 |
| Kolejność gracza | `seat` (1, 2, 3…) zamiast godziny wejścia | O gościu zostaje tylko nick, jak chce PRD. | plan-review F6 |
| Przegląd kodu | `/10x-impl-review` na gałęzi przed scaleniem | Scalenie to wdrożenie, poprawki nie powinny wymagać drugiego. | plan-review F4 |
| Link | `/j/<22 znaki>` osobno od `/r/<uuid>` i tematu kanału | S-09 wymieni link bez zmiany pokoju. | Research (FR-004) |
| Pytania | Zostają w pliku na serwerze; pokój pamięta tylko kategorie i 18+ | Losowanie to S-02, a przeniesienie do bazy nie jest potrzebne. | Plan |
| Strony testowe | `/dev/live-sync` i nowe `/dev/room-states` tylko lokalnie | Decyzja F-01 „do czasu S-01” się kończy; sonda zostaje. | Plan |
| R4, K1 (ramki, hover) | Przez `/10x-ui` po scaleniu S-01 i S-05 | Obie zmiany ruszają te same klocki. | Plan |

## Scope

**In scope:**
- migracja z trzema tabelami, RLS, uprawnieniami i czterema funkcjami;
- strona główna dla obu stanów, zakładanie gry, ekran pokoju hosta i gościa, strona linku;
- przekierowanie zalogowanego z `/auth/*` (oprócz `?error=`);
- lista na żywo, smoke hosta i gościa, CI na `PUBLISHABLE_KEY`;
- strona stanów i zrzuty do oceny, test na telefonach.

**Out of scope:**
- start, pytania i głosy (S-02);
- powrót na nick po utracie ciasteczka (S-04);
- usuwanie graczy i nowy link (S-09), współhost (S-07), lista gier (S-13);
- limit graczy, Presence, klucz secret, konta anonimowe, pytania w bazie;
- zmiany w `/dashboard` i plikach S-05.

## Architecture / Approach

**Baza zamknięta domyślnie.**
- `rooms` i `players` są dostępne dla hosta przez RLS. `player_secrets` nie ma uprawnień.
- Gość dociera tylko przez `join_room`, `room_link` i `room_lobby`. Każda sama sprawdza link, nick i stan pokoju.

**Serwer Astro.**
- `POST /api/rooms` woła `create_room`, a `POST /api/rooms/join` woła `join_room`.
- `join` ustawia ciasteczko `mlt_player_<roomId>` i dzwoni na `live-sync:<roomId>`.

**Lista na żywo.** Wyspa `RoomLobby` na `/r/<id>` po dzwonku albo co 15 s pobiera `GET /api/rooms/<id>/lobby` (`room_lobby`) i pokazuje widok hosta albo gościa.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Baza na produkcji | Migracja sprawdzona przez CI na szkicu PR, potem wgrana przez połączone CLI; reguły w AGENTS.md | Nieodwracalna zmiana wspólnej bazy; brak `revoke` otwiera funkcje dla `anon` |
| 2. Host | Strona główna, zakładanie gry, ekran z linkiem, przekierowanie z `/auth/*`, smoke hosta, CI | Konflikty z S-05 w smoke i README |
| 3. Gość i lista na żywo | Strona linku, opaska, poczekalnia, dzwonek i odpytywanie, smoke gościa | Utrata dzwonka i ciasteczka w przeglądarce Discorda |
| 4. Stany i ocena | `/dev/room-states`, zrzuty do oceny Karola | Poprawki wyglądu rozciągną fazę |
| 5. Produkcja i telefony | Dokumenty, PR, scalenie, smoke na produkcji, test na telefonach | Zachowanie iPhone'a w aplikacji Discord |

**Prerequisites:**
- Commit dokumentów S-01 i S-05 na `main` i push za zgodą Karola.
- Worktree S-01 z kopią `.dev.vars`, `npm ci`, `npx astro sync` i serwerem na porcie 4322.
- Karol łączy CLI Supabase (login i hasło do bazy).

**Estimated effort:** ~4–5 sesji, po jednej na fazę. Faza 1 jest krótka, a fazy 2 i 3 są największe.

## Open Risks & Assumptions

- **Przeglądarka Discorda na iOS** trzyma ciasteczka osobno od Safari. Gość po przełączeniu jest nowy, a jego nick jest zajęty. Przyjęte do S-04.
- **Funkcje gościa są publicznymi endpointami** dla każdego z kluczem publishable. Chronią je tylko sprawdzenia w SQL. Gdy link wycieknie, host klika „Nowa gra”.
- **Supabase zmienia domyślne uprawnienia** (według zapowiedzi 30.10.2026 dla istniejących projektów). Migracja nadaje je jawnie, więc działa przed zmianą i po niej.
- **`locals.cfContext.waitUntil` w `astro dev`** jest niesprawdzone. Rezerwą jest czekanie na dzwonek.
- **Smoke zostawia pokoje** konta testowego w bazie produkcyjnej do czasu S-13.

## Success Criteria (Summary)

- Ekipa na Discordzie: host zakłada grę w mniej niż 5 minut, a każdy gość z telefonu dołącza w mniej niż 30 s bez instrukcji.
- Host i goście widzą dołączających bez odświeżania. Zajęty nick, zamknięta gra i zły link mówią po polsku, co zrobić.
- Nikt z zewnątrz nie czyta tabel gry, a tożsamości gościa nie da się przejąć z bazy.
