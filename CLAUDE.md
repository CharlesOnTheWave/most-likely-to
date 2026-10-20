Project rules for all agents: @AGENTS.md

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Moduł 4, Lekcja 3 (Analiza funkcji)

Przekształć Mapę Projektu w ugruntowaną analizę jednej funkcji: co działa, co jest słabe, co należy zmodernizować.

```
context/map/repo-map.md -> /10x-research (trace + test gaps + blast radius) -> ast-grep verification -> research.md
```

### Router zadań — od czego zacząć

| Umiejętność / prompt | Użyj, gdy |
| --- | --- |
| `m4l3-1-research-with-map` | Uruchamiasz `/10x-research` dla jednej funkcji z `repo-map.md` jako danymi wejściowymi. Trzech równoległych podagentów śledzi przepływ od początku do końca, znajduje luki w pokryciu testami i mierzy promień rażenia. Raport kończy się sekcjami Przegląd funkcji i Dług techniczny. Dostosuj nazwę funkcji w prompcie do swojego repozytorium. |
| `m4l3-2-ast-grep-verification` | Potwierdzasz lub obalasz każde twierdzenie strukturalne w tym raporcie (liczby miejsc wywołania, „tylko tutaj”, „zawsze przez X”) za pomocą ast-grep, a następnie poprawiasz raport. |
| `/10x-repo-map` | Nie ma jeszcze `context/map/repo-map.md` lub jest nieaktualny. |

### Twarde zasady

- **To jest badanie, nie refaktoryzacja.** W tej lekcji nie zmieniaj kodu produkcyjnego.
- **Sprawdź każde twierdzenie strukturalne narzędziem.** ast-grep precyzyjnie dopasowuje składnię; grep dopasowuje dosłowny tekst. Zweryfikuj każde zero z ast-grep za pomocą grep, aby błędny wzorzec nie został uznany za „brak wystąpień”.
- **Cytuj `file:line`** dla każdego kroku śledzenia i każdej pozycji długu.

<!-- END @przeprogramowani/10x-cli -->
