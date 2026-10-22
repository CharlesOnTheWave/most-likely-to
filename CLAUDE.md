Project rules for all agents: @AGENTS.md

<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs — Moduł 5, Lekcja 3 (Przegląd kodu w CI)

Przenieś agenta przeglądu do GitHub Actions i zamień jego werdykt w bramkę merge. Oceń zmiany promptów i modeli na stałym zestawie przypadków przed ich wdrożeniem.

```
m5l3-requirements -> /10x-new -> /10x-research -> /10x-plan -> review.yml + composite action -> promptfoo evals
```

### Router zadań — od czego zacząć

| Umiejętność / prompt / szablon | Użyj, gdy |
| --- | --- |
| `m5l3-requirements` + `m5l3-cicd` (prompty) | Prowadzisz badania i planujesz przepływ pracy przeglądu CI na podstawie pisemnych wymagań. |
| `m5l3-review.yml.template`, `m5l3-action.yml.template` (szablony konfiguracji) | Podłączasz recenzenta do przepływu PR: akcja kompozytowa z wejściami tytułu, treści i diffu, etykietami `ai-cr:passed` / `ai-cr:failed` oraz nieudaną kontrolą przy werdykcie `fail`. |
| `m5l3-promptfoo` (prompt) + `m5l3-promptfooconfig.yaml.template` | Porównujesz modele lub zmiany promptów na tych samych diffach za pomocą asercji is-json, llm-rubric i javascript. |
| `/10x-impl-review-ci` | Przeglądasz PR względem jego `context/changes/<id>/plan.md` w CI za pomocą Claude Code Action; szablon jego workflow znajduje się w katalogu `references/` umiejętności. |

### Twarde zasady

- **Przypinaj akcje zewnętrzne do pełnego SHA commita** z tagiem w komentarzu.
- **Bramkuj na polu werdyktu**, nigdy na swobodnym tekście wyjściowym.
- **Przekazuj wielowierszowe wartości (diffy) przez pliki lub ograniczniki heredoc**, a nie przez jednowierszowe zapisy `$GITHUB_OUTPUT`.
- **Uruchom zestaw ewaluacyjny przed zmianą promptu lub modelu przeglądu.**

<!-- END @przeprogramowani/10x-cli -->
