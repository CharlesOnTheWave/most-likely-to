# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Dopisuj regułę „ask” dla każdego skrótu do wdrożenia lub bazy

- **Context**: Dodawanie lub zmiana skryptów w package.json, workflowów i narzędzi CLI, które w środku wdrażają albo zmieniają bazę (wrangler deploy, wrangler secret, supabase db). Szczególnie przy wdrożeniu (M1L5).
- **Problem**: Reguły uprawnień w .claude/settings.json widzą tylko polecenie wpisane przez agenta, nie to, co ono uruchamia. 25.09 w eksperymencie A/B `npx shadcn add` sam odpalił `npm install` mimo reguły deny. Tak samo `npm run deploy` z `wrangler deploy` w środku przeszłoby bez pytania, bo `Bash(npm *)` jest w allow, a ask obejmuje tylko `npx wrangler deploy`.
- **Rule**: Gdy dodajesz skrypt, workflow lub narzędzie, które w środku publikuje albo zmienia stan zdalny lub bazę, w tej samej zmianie dopisz regułę `ask` dla polecenia, które agent faktycznie wpisze (np. `Bash(npm run deploy*)`).
- **Applies to**: plan, implement, impl-review

## Pytania gry tylko po stronie serwera

- **Context**: `src/data/questions.ts`, gdy S-01, S-02 i S-06 zaczną używać pytań.
- **Problem**: Import w wyspie React wysyła całą bazę, z pytaniami 18+ i pytaniami z kolejnych rund, do przeglądarki każdego gracza.
- **Rule**: Pytania importujemy tylko w kodzie serwera. Do przeglądarki trafia tylko to, co dana osoba ma teraz zobaczyć (np. pytanie bieżącej rundy; host w S-06 swoją listę), jako zwykły tekst, nigdy przez `set:html` ani `dangerouslySetInnerHTML`.
- **Applies to**: plan, implement, impl-review
