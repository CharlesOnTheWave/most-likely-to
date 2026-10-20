Project rules for all agents: @AGENTS.md

<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs — Moduł 4, Lekcja 4 (Refaktoryzacja)

Przejdź od zarejestrowanych problemów do decyzji o refaktoryzacji, której możesz bronić, a następnie wprowadzaj zmianę małymi krokami, które możesz cofnąć.

```
/10x-new (research-only intention) -> /10x-research (options, no decision) -> ast-grep verification -> /10x-plan (decide) -> /10x-implement
```

### Router zadań — od czego zacząć

| Umiejętność / prompt | Użyj, gdy |
| --- | --- |
| `m4l4-1-new-change-intention` | Rozpoczynasz zmianę za pomocą `/10x-new` i jawnej intencji: zbadać i uszeregować, bez refaktoryzacji, bez decyzji na tym etapie. |
| `m4l4-2-refactor-opportunities-research` | Uruchamiasz `/10x-research` dla każdego zarejestrowanego problemu z trzech perspektyw tylko do odczytu: obecny kształt, historia decyzji (czy było to celowe?), wykonalność migracji. Kończy się uszeregowanymi opcjami i ich kompromisami. |
| `m4l4-3-ranking-ast-grep-verification` | Sprawdzasz strukturalne twierdzenia stojące za rankingiem za pomocą ast-grep i poprawiasz raport tak, aby wcześniejsza liczba pozostała widoczna. |
| `/10x-plan` -> `/10x-plan-review` -> `/10x-implement` | Bronisz wybranej opcji podczas wywiadu dotyczącego planu, a następnie realizujesz plan. |

### Twarde zasady

- **Badanie szereguje; plan decyduje.** Bez refaktoryzacji i bez ostatecznego wyboru w ramach badania.
- **Najpierw zabezpieczenie.** Testy charakteryzujące, które utrwalają obecne zachowanie, poprzedzają pierwszą zmianę strukturalną.
- **Każdą fazę można cofnąć niezależnie.** Preferuj Strangler Fig, Branch by Abstraction oraz kolejność w stylu Mikado zamiast przepisywania typu big-bang.
- **Zachowaj niezmienione zachowanie.** Faza refaktoryzacji, która zmienia obserwowalne zachowanie, jest odrębną zmianą.

<!-- END @przeprogramowani/10x-cli -->
