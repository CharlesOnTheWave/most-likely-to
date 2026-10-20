Project rules for all agents: @AGENTS.md

<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs - Moduł 4, Lekcja 5 (Modernizacja DDD)

Ujawnij domenę, której kod legacy nigdy nie nazwał, a następnie użyj jej jako danych wejściowych do kolejnego cyklu.

```
domain distillation -> invariant aggregate / anti-corruption layer -> /10x-shape -> /10x-roadmap -> /10x-research -> /10x-plan
```

### Router zadań - Od czego zacząć

| Umiejętność / prompt | Użyj, gdy |
| --- | --- |
| `/10x-domain-distillation` | Jednorazowa mapa domeny. Zapisuje wszechobecny język wraz z jego źródłami, poddomenami Core/Supporting/Generic, niezmiennikami oraz informacją, czy kod je egzekwuje, rozbieżnościami między modelem a kodem i rankingiem „napraw najpierw” do `context/domain/domain-distillation.md`, a także `context/domain/glossary.md`. Użyj `--replace`, aby odświeżyć; poprzednie uruchomienie trafia do `context/archive/`. |
| `m4l5-1-domain-distillation` | Ta sama destylacja jako pojedynczy prompt, wykonywana krok po kroku. |
| `m4l5-2-invariant-aggregate-refactor` | Kluczowa reguła biznesowa jest egzekwowana w wielu miejscach albo wcale. Planuje agregat strażniczy, który jest jej właścicielem. |
| `m4l5-3-anti-corruption-layer` | Zewnętrzna zależność przenika do domeny. Planuje wokół niej warstwę Anti-Corruption Layer. |
| `/10x-shape` -> `/10x-roadmap` -> `/10x-research` -> `/10x-plan` | Przekazywanie artefaktów `context/domain/` do kolejnego cyklu. |

### Twarde zasady

- **Odkrywaj domenę; nie zakładaj jej.** Zacznij bez nazw encji, agregatów ani ścieżek i wskaż, skąd pochodzi każdy termin (z dokumentu lub kodu).
- **Twórz mapę albo plan, nie kod.** Te artefakty nie modyfikują kodu produkcyjnego; zmiana następuje później przez `/10x-plan` -> `/10x-implement`.
- **Używaj terminów ze słownika.** Gdy istnieje `context/domain/glossary.md`, używaj jego terminów w kodzie, planach i rozmowach oraz unikaj nazw oznaczonych przez niego jako „don't call it”.

<!-- END @przeprogramowani/10x-cli -->
