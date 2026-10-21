# Mapa okazji

## Kontekst

- **Projekt / kontekst**: gra „Most Likely To”. Pracuje jedna osoba (właściciel repo, jedyny, kto scala) z dwoma terminalami agentów: tor kursu na `main` i tor gry w osobnym worktree, który dowozi zmiany przez PR-y. Grę testuje ekipa znajomych na wieczorach.
- **Ograniczenie danych**: publiczne repo, pierwsza wersja czyta tylko diff, opis PR-a i dokumenty z repo, czyli dane niewrażliwe. Bazy, logów produkcji i `.dev.vars` nie dotyka.
- **Data**: 2026-10-21 (M5L1, `/10x-opportunity-map`)

## Mapa

| Sygnał | Istniejąca / domyślna odpowiedź | Cienkie uzupełnienie | Pierwsza użyteczna wersja | Ryzyko danych | Kierunek, jeśli się sprawdzi |
|---|---|---|---|---|---|
| PR-y toru gry (10 w 2 tygodnie) czekają na recenzję właściciela; długich raportów nie czyta, CI mówi tylko „zielone / czerwone” | checki GitHuba (`ci`, `smoke`, `db`, `e2e`); `/10x-impl-review` i `/code-review` odpalane ręcznie przez agenta, który pisał kod; gotowe akcje review AI w GitHubie | komentarz pod PR: kilka linii po ludzku + flagi twardych zasad z `AGENTS.md` | prompt odpalony ręcznie na scalonych PR-ach #7–#9 i na #10, wynik w Markdownie | tylko odczyt, publiczny kod; klucz LLM wyłącznie jako sekret CI | narzędzie wewnętrzne → bramka review / CI (M5L2–L3) |
| Dwa terminale muszą wiedzieć, co robi drugi | `gh pr list`, gałęzie, pliki z instrukcjami sesji z sekcją „Stan”, `git fetch` przed pushem | brak: obecny układ wystarcza | brak; za 2 tygodnie sprawdzić, czy była kolizja | lokalne | czekać / nie budować |
| Pamięć agenta toru kursu (poza repo) urosła do ok. 220 KB; każda sesja szuka w niej sekcji startowej | sekcja „Stan” w pliku instrukcji sesji, sekcja „START TUTAJ” na górze pamięci, indeks pamięci | brak: to porządki, nie narzędzie | jednorazowe skrócenie starych wpisów | lokalne, prywatne notatki | czekać / nie budować |
| Skille i reguły kopiowane między projektami | `10x get` / `10x sync` (CLI kursu już jest rejestrem); obejście EPERM w kopii projektu | brak: paczki pobiera jeden projekt | brak | lokalne, niewrażliwe | rejestr artefaktów: czekać |

## Rekomendowany pierwszy kandydat

```text
Kandydat:
Recenzja PR po ludzku (robocza nazwa „streszczenie PR”)

Czyta:
diff i opis PR-a z GitHuba, wynik jobów CI, twarde zasady z AGENTS.md, context/domain/glossary.md

Zwraca:
jeden komentarz pod PR, 5–8 linii: co zmienia się w grze dla gracza i hosta; czy PR dotyka
twardych zasad (anonimowość głosu, migracje, ścieżki „tylko przez PR”, klucze Supabase);
werdykt „można scalać” albo „najpierw sprawdź X” z linkami do plików

Nie robi:
nie scala i na start nie blokuje merge (tylko komentarz); nie poprawia kodu; nie ocenia stylu
(to robi lint); nie czyta bazy, logów produkcji ani .dev.vars; nie zastępuje checków CI

Ryzyko danych:
publiczne repo, tylko odczyt diffu, czyli dane niewrażliwe. Klucz LLM wyłącznie jako sekret
GitHub Actions; workflow na pull_request (nie pull_request_target), uprawnienia tylko do
komentarza; treść PR-a traktować jako dane, nie polecenia (próba wstrzyknięcia instrukcji
w publicznym repo); koszt tokenów na jeden PR zmierzyć przed włączeniem na stałe

Kierunek, jeśli się sprawdzi:
narzędzie wewnętrzne → bramka review / CI: job w .github/workflows/ (zmiana tylko przez PR)
```

## Dlaczego ten kandydat

- **Powtarza się:** 10 PR-ów od 07.10 do 20.10, czyli kilka tygodniowo, i każdy czeka na scalenie przez właściciela.
- **Łączy źródła i role:** diff z GitHuba, wynik CI i zasady projektu (`AGENTS.md`, słownik) w jednym miejscu. Łączy też dwie role: agenta, który pisze PR, i właściciela, który go scala. Dziś recenzję robi zwykle ten sam agent, który napisał kod. Uzupełnienie daje niezależne spojrzenie.
- **Wyraźny ból dziś:** raporty recenzji są długie, a właściciel ich nie czyta, więc w praktyce scala „na zielone CI”. CI nie wie jednak, czy zmiana łamie anonimowość głosu.
- **Da się sprawdzić tylko do odczytu:** na scalonych PR-ach #7–#9 widać, czy komentarz złapałby to, co i tak wyszło w recenzjach.
- **Nie zastępuje platformy:** GitHub i CI zostają źródłem prawdy, a komentarz tylko do nich linkuje.
- **Złożoność istotna zostaje:** recenzja właściciela przed scaleniem jest celowa (`AGENTS.md`: ścieżki tylko przez PR i zielone CI). Narzędzie skraca czytanie, ale nie usuwa decyzji.

Pozostałe sygnały odpadają. Koordynacja terminali działa od niedawna i jeszcze nie zawiodła. Rozrost pamięci to porządki, nie narzędzie. Rejestr skilli już istnieje (CLI kursu), a dla jednej osoby i kilku lekcji do końca kursu nie warto go dublować.

## Kierunek, jeśli się sprawdzi

- **Pierwszy krok (M5L2):** prompt recenzji odpalony ręcznie na PR-ach #7–#10. Mierzymy koszt tokenów i to, czy 5–8 linii wystarcza do decyzji o scaleniu.
- **Dalej (M5L3):** standardy recenzji i Definition of Done z `AGENTS.md`, potem job w `.github/workflows/` przez osobny PR. Najpierw sprawdzić `gh pr list`, czy tor gry nie zmienia tych samych plików.
- **Walidacja:** bez `/10x-mom-test`, bo jedynym użytkownikiem jest właściciel, a przeszłe zachowanie znamy (10 scalonych PR-ów). Wróć do walidacji, gdyby narzędzie miało służyć komuś jeszcze.
- **Dowody do 10xChampion:** widok pipeline'u z jobem, logi joba i komentarz LLM pod PR-em.
