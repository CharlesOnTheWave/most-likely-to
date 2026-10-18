Project rules for all agents: @AGENTS.md

<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs — moduł 4, lekcja 1 (Kontekst na dużą skalę)

Utrzymuj ten plik reguł w zwięzłej formie i kieruj z niego do kontekstu, który znajduje się gdzie indziej. Duża baza kodu nie potrzebuje większego pliku głównego.

```
lean root rules file -> context/ (system of record) -> per-module rules only when a trigger signal appears
```

### Router zadań — od czego zacząć

| Umiejętność | Użyj jej, gdy |
| --- | --- |
| `/10x-agents-md` -> `/10x-rule-review` | Odchudzasz rozbudowany główny plik reguł: przenieś szczegóły do `context/` i pozostaw odnośnik. |
| `/10x-ray <skill> [args]` | Chcesz zobaczyć, jak działa umiejętność: mapuje jej kroki, rozgałęzienia i punkty kontroli człowieka, następnie ją uruchamia i wyjaśnia każdy krok w trakcie jego wykonywania. Dodaj `--mode html`, aby obserwować ją w przeglądarce. |
| `/10x-lesson` | Błąd agenta, który ciągle powraca, powinien stać się zapisaną lekcją, a nie kolejną linią w tym pliku. |

### Twarde reguły

- **Pliki instrukcji się sumują; nie nadpisują się.** Narzędzia scalają pliki główne, zagnieżdżone i na poziomie użytkownika. Nie powtarzaj tej samej reguły na kilku poziomach.
- **Test włączenia.** Linia należy tutaj tylko wtedy, gdy agent popełniłby bez niej błąd. Fakty, które agent może odczytać z kodu lub z `context/`, pozostają tam i otrzymują odnośnik.
- **Dodawaj strukturę dla poszczególnych modułów tylko wtedy, gdy pojawi się sygnał.** Przykłady: agent ciągle myli dwa obszary albo konwencje jednego modułu wypierają wszystko inne. Sam rozmiar repozytorium nie jest sygnałem.

<!-- END @przeprogramowani/10x-cli -->
