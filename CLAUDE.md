Project rules for all agents: @AGENTS.md

<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs — Moduł 5, Lekcja 2 (Agent zespołowy z SDK)

Zbuduj minimalnego agenta do przeglądu kodu: diff na wejściu, ustrukturyzowany werdykt JSON na wyjściu. Schemat i prompt systemowy są kontraktem, od którego zależy wszystko później (bramka CI, ewaluacje).

```
review schema + system prompt -> review.ts (ready-made agent SDK or AI SDK ToolLoopAgent) -> git diff | npx tsx review.ts
```

### Router zadań — od czego zacząć

| Umiejętność / prompt / szablon | Użyj, gdy |
| --- | --- |
| `m5l2-review-schema.ts.template` (config templates) | Rozpoczynasz tworzenie recenzenta. Skopiuj go do pakietu recenzenta: sześć ocenianych kryteriów (1–10), werdykt i podsumowanie jako schemat zod oraz prompt systemowy. |
| `m5l2-agent` (prompts) | Konfigurujesz punkt wejścia AI SDK, a następnie planujesz modułowego recenzenta `ToolLoopAgent` za pomocą `/10x-plan`. |
| `/10x-plan` -> `/10x-implement` | Przekształcasz jednoplikowego recenzenta w moduły wielokrotnego użytku. |

### Twarde zasady

- **Schemat jest kontraktem.** Najpierw zmień kryteria, wartości werdyktu lub nazwy pól w schemacie, a następnie w promptach, bramkach i ewaluacjach.
- **Przypinaj główne wersje.** Kod lekcji jest przeznaczony dla AI SDK 7 (`ai@7`, `@openrouter/ai-sdk-provider@3`) oraz Node 22+.
- **Śledź koszt każdego uruchomienia.** Loguj użycie z każdego przeglądu i ustaw twardy limit budżetu, zanim agent zacznie działać bez nadzoru.

<!-- END @przeprogramowani/10x-cli -->
