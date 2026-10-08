# Logowanie hosta jednym kliknięciem — Plan Brief

> Full plan: `context/changes/one-click-host-login/plan.md`
> Research: `context/changes/one-click-host-login/research.md`

## What & Why

Host loguje się do gry jednym kliknięciem przez Discorda albo Google, bez rejestracji i hasła (PRD FR-001, roadmapa S-05). Ekipa umawia się na Discordzie, więc to dla niej najkrótsza droga. Google jest drogą zapasową, gdy Discord zawiedzie. W tej samej zmianie zamykamy dziurę: bez potwierdzania maili ktoś mógłby założyć konto na cudzy adres i przejąć konto hosta, gdy ten zaloguje się dostawcą.

## Starting Point

Dziś host loguje się e-mailem i hasłem ze startera. Ekran logowania jest na kontrakcie UI z M2L5, a rejestracja to stara, angielska hybryda. W Supabase „Confirm email” jest wyłączone. Smoke i sonda F-01 przy każdym uruchomieniu zakładają nowe konto w jedynym projekcie, wspólnym z produkcją.

## Desired End State

Na ekranie logowania są na górze przyciski „Zaloguj przez Discord” i „Zaloguj przez Google”. Pod nimi jest kreska i formularz z hasłem dla starych kont, a na dole zdanie „Nowe konto: przez Discord albo Google.”. Anulowanie albo błąd kończy się polskim komunikatem. Rejestracja z hasłem nie istnieje, a `/auth/signup` prowadzi na logowanie. Smoke loguje się stałym kontem testowym i sprawdza też drogę do dostawców. Na produkcji logowanie działa na laptopie i na telefonach, a wynik testu jest zapisany.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Dostawcy | Discord (główny) + Google (zapasowy) | Ekipa jest na Discordzie, a Google chroni przed awarią jednego dostawcy i spełnia FR-001. | Research (decyzja C, 06.10) |
| Dziura przejęcia konta | „Confirm email” ON i usunięcie starych kont przed włączeniem dostawców | Wyłączone potwierdzanie łączy konta po niezweryfikowanym e-mailu, a przełącznik nie działa wstecz. | Research |
| Logowanie hasłem | Zostaje dla istniejących kont; rejestracja znika (Parked w roadmapie) | Bez własnej skrzynki nadawczej nie da się potwierdzić adresu nowego konta. | Research (decyzja C) |
| Ekran | Przyciski na górze, kreska, formularz, stopka | Wersja wybrana przez Karola z podglądu. | Plan (wywiad 06.10) |
| `/auth/signup` | 302 na `/auth/signin` | Linki w plikach S-01 działają bez dotykania tych plików. | Plan (wywiad 06.10) |
| Polityka prywatności | Pomijamy (przyjęte ryzyko) | Gra na razie tylko dla znajomych; wraca przed otwarciem dla obcych. | Plan (wywiad 06.10) |
| Projekt Google | Na osobnym Gmailu gry, tryb Testing | Dane Karola niewidoczne dla graczy; przy podstawowych zakresach brak limitów. | Plan (wywiad 06.10) |
| Site URL i przekierowania | Produkcyjne `/auth/signin`; `localhost:4321` i `4322` | Błędy stanu OAuth lądują na ekranie logowania; drugi serwer w worktree działa. | Plan (wywiad 06.10) |
| Smoke | Stałe konto testowe z `.dev.vars`; OAuth do skoku na dostawcę (`SMOKE_OAUTH=1`) | Koniec zakładania kont; smoke łapie wyłączonego dostawcę (zły client id lub sekret wychodzi dopiero przy ręcznym logowaniu). | Research (recenzja), plan-review F3 |
| Callback | `/api/auth/callback`, bez zmian w `middleware.ts` | S-01 przekierowuje zalogowanych z `/auth/*` i jest właścicielem middleware. | Research |
| Wylogowanie | `scope: "local"` | Wylogowanie na telewizorze nie wylogowuje telefonu hosta. | Research (recenzja) |
| Faza 1 | Na `main` przed założeniem worktree, z pushem za zgodą i zielonym CI | Obie gałęzie (S-01, S-05) potrzebują konta testowego i nowego smoke; CI sprawdzone raz, nie w dwóch gałęziach. | Plan (07.10), plan-review F1 |
| Przyciski dostawców | Osobny formularz na dostawcę z ukrytym polem | Zablokowany przycisk wypada z danych formularza. | Plan (07.10) |
| Komunikat błędu | Nad przyciskami, wspólny dla obu dróg; fokus na nim po załadowaniu | Błąd może przyjść z dostawcy albo z hasła; czytnik ekranu go usłyszy; Karol ocenia na zrzutach. | Plan (07.10), plan-review F2 |
| Sonda F-01 | Też na koncie testowym | Inaczej przestaje działać po „Confirm email” ON. | Plan (07.10) |

## Scope

**In scope:**
- Porządek kont i ustawień Auth w Supabase, konto testowe, smoke, sonda i CI na koncie testowym.
- Aplikacje Discord i Google, endpoint startu, callback, polskie komunikaty, wylogowanie lokalne.
- Nowy ekran logowania, usunięcie rejestracji, kitchen sink, zrzuty.
- PR, wdrożenie za zgodą, smoke na produkcji, test na telefonach.

**Out of scope:**
- Rejestracja hasłem, logowanie z e-maila, SMTP, domena, polityka prywatności, publikacja w Google.
- Apple, Microsoft, GitHub, `signInWithIdToken`, ręczne łączenie kont.
- `middleware.ts`, strona po zalogowaniu, `Topbar.astro`, `Welcome.astro`, `dashboard.astro` (S-01).
- Migracje bazy.

## Architecture / Approach

Logowanie zostaje w całości po stronie serwera:

1. Przycisk wysyła `POST /api/auth/oauth`.
2. Serwer woła `signInWithOAuth` i odpowiada 302 do Supabase, z ciasteczkiem PKCE.
3. Supabase prowadzi do Discorda albo Google, a potem wraca do `GET /api/auth/callback`.
4. Callback wymienia kod na sesję (`exchangeCodeForSession`) i przekierowuje na `/`.

Każdy błąd wraca na `/auth/signin?error=<kod>`, a polski tekst daje mapa w `auth-errors.ts`. Błędy stanu, które Supabase wysyła prosto na Site URL, ekran czyta z `error_code`. Sekrety dostawców są tylko w panelu Supabase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Porządek w Supabase i konto testowe | „Confirm email” ON, 2 konta, Site URL, smoke, sonda i CI na koncie testowym; push za zgodą i smoke na produkcji | Usunięcie kont jest nieodwracalne; produkcyjna rejestracja pada do fazy 3 (oczekiwane) |
| 2. Logowanie przez dostawcę (serwer) | Aplikacje Discord i Google, `oauth.ts`, `callback.ts`, komunikaty, smoke OAuth | Konfiguracja konsoli Google (Authorized domains); ciasteczko PKCE na Workers |
| 3. Ekran logowania i porządki | Przyciski, kreska, stopka, błąd nad przyciskami, koniec rejestracji, zrzuty | Wygląd i brzmienie komunikatów do oceny Karola |
| 4. Produkcja i telefony | Wdrożenie za zgodą, smoke prod z `SMOKE_OAUTH=1`, `phone-test.md` | Przeglądarka w Discordzie i WebView przy Google; czas 300 s |

**Prerequisites:** Gmail gry przed fazą 2; dostęp Karola do paneli Supabase, Discorda i Google Cloud; telefon z iOS na fazę 4; Supabase nieuśpiony (ruch smoke w fazie 1 odsuwa uśpienie spodziewane około 11.10).

**Estimated effort:** około 3–4 sesji. Faza 1 i 2 to głównie panele i 2 endpointy, faza 3 to ekran i zrzuty, faza 4 to wdrożenie i test na telefonach.

## Open Risks & Assumptions

- Przeglądarka wbudowana w Discorda może zgubić ciasteczko PKCE albo zablokować Google (`disallowed_useragent`). Reakcja ustalona z góry: podpowiedź „Otwórz stronę w Chrome lub Safari”.
- Logowanie wolniejsze niż 300 s (hasło, 2FA, nowe urządzenie) kończy się komunikatem „zacznij od nowa”.
- Różne e-maile u dostawców to dwa osobne konta hosta (przyjęte w v1).
- Ekran zgody Google pokazuje `<ref>.supabase.co` zamiast nazwy gry. Ikona Google jest monochromatyczna, co odbiega od wytycznych marki Google; w trybie Testing nikt tego nie egzekwuje.
- Brak polityki prywatności (RODO art. 13). Wraca przed otwarciem gry dla obcych.
- Zachowanie hostowanego Supabase sprawdzone w kodzie z gałęzi master; produkcja może działać na starszej wersji. Smoke i test ręczny to potwierdzą.

## Success Criteria (Summary)

- Host z ekipy loguje się na produkcji jednym kliknięciem przez Discorda albo Google, na laptopie i na telefonie, i trafia do gry zalogowany.
- Nikt nie założy już konta z hasłem, a stare konto Karola nadal działa hasłem.
- Smoke na produkcji przechodzi bez zakładania kont i łapie wyłączonego dostawcę. Po każdej zmianie ustawień dostawcy Karol loguje się raz ręcznie.
