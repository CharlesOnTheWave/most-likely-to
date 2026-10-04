---
change_id: ui-signin-contract
title: Ui signin contract
status: implementing
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Notes

Zmiana wizualna prowadzona przez `/10x-ui` (M2L5). Cel: kontrakt UI (tokeny i komponenty) na istniejącym ekranie, zanim powstaną ekrany gry S-01 i S-02, żeby od początku budowały na nim, a nie na literałach ze startera.

- **Widok (jeden):** `/auth/signin`, czyli `src/pages/auth/signin.astro` z wyspą `src/components/auth/SignInForm.tsx` i jej komponentami (`FormField`, `PasswordToggle`, `SubmitButton`, `ServerError`). Komponenty auth dzieli z `/auth/signup`, ale zakres to jeden widok plus globalne tokeny.
- **Źródło tokenów:** `src/styles/global.css` (`:root`, `.dark`, publikacja w `@theme inline`), fabryczna paleta shadcn `neutral` (`components.json`: style `new-york`, baseColor `neutral`). W tym samym pliku `@utility bg-cosmic` z kolorami hex poza systemem tokenów.
- **Komponenty:** `src/components/ui` (`button.tsx`, `LibBadge.astro`). Brakujące dodajemy przez `npx shadcn@latest add <name>` (AGENTS.md).
- **Plik reguł agenta:** `AGENTS.md` (źródło prawdy; `CLAUDE.md` go importuje i ma blok 10x-cli). Brak reguł zachęcających do wartości jednorazowych. Jedyna reguła UI: shadcn przez CLI i `cn` z paczki `cn`.
- **Wariant kontraktu:** świeży starter z martwym plikiem tokenów. Widok używa 0 klas semantycznych; jedyny import z `src/components/ui` to `Button` w `SubmitButton.tsx`, nadpisany klasami palety.
- **Przed-audyt 2026-10-04 (skan literałów z `/10x-ui`):** 13 trafień w plikach widoku (`signin.astro` 4, `FormField.tsx` 5, `SubmitButton.tsx` 2, `ServerError.tsx` 1, `PasswordToggle.tsx` 1), do tego tło `bg-cosmic`. `Layout.astro` 0. `Banner.astro` 9 (hex w `<style>`; baner pokazuje się tylko przy brakującej konfiguracji, poza zakresem). Liczba ma spadać po każdej fazie wizualnej.
- **Pomysł Karola na później (2026-10-04):** nazwa gry „Most Likely To” na ekranie logowania, jak u innych gier przeglądarkowych. Decyzja: nie w tej zmianie; napis przyjdzie razem z prawdziwym logo (grafika, czcionka, ikonka karty) jako osobna zmiana UI po S-01/S-02, jako wspólny element wszystkich ekranów.
