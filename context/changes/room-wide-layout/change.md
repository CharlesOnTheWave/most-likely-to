---
change_id: room-wide-layout
title: Szeroki układ strony pokoju na laptopie i dużym monitorze
status: impl_reviewed
created: 2026-10-15
updated: 2026-10-18
archived_at: null
---

## Notes

Zmiana `/10x-ui` z roadmapy (§Parked, „Szeroki układ ekranów gry na laptopie i dużym monitorze”, decyzja Karola 2026-10-15 przy S-03, faza 4, zrzuty).

- **Jeden widok:** strona pokoju `/r/[id]` (`src/pages/r/[id].astro`, wyspa `src/components/room/RoomScreen.tsx`) ze wszystkimi stanami: poczekalnia, głosowanie, odsłona, pominięte ostatnie pytanie, koniec wieczoru, ekran po wysypaniu; do tego nagłówek tej strony (`src/components/room/AppHeader.astro`).
- **Poza zakresem:** strona główna z „Nowa gra” (`src/pages/index.astro`) i strona dołączania gościa (`src/pages/j/[token].astro`). To krótkie formularze, którym wąska kolumna nie szkodzi.
- **Wariant kontraktu:** istniejący system projektowy. Tokeny w `src/styles/global.css` (`:root`, `.dark`, `@theme inline`; aplikacja zawsze ciemna), komponenty shadcn w `src/components/ui`, zasady w `AGENTS.md` §UI, kontrola literałów `scripts/ui-literals.mjs` w `npm run lint` (obejmuje już `src/components/room/` i `src/pages/r/[id].astro`), podglądy stanów na `/dev/room-states`. Przed-audyt 15.10: 0 literałów w widokach pokoju.
- **Problem:** cała strona pokoju to jedna kolumna `max-w-lg` (512 px, `src/pages/r/[id].astro:62`, nagłówek `AppHeader.astro:16`). Na monitorze 1920 px gra zajmuje niecałą jedną trzecią szerokości. Po odsłonie wykres, tabela i przyciski hosta stoją jeden pod drugim, więc przyciski spadają pod dolną krawędź ekranu. Karol gra z przeglądarką na całym ekranie, a wielu graczy ma dwa monitory.
- **Cel z roadmapy:** wszystkie ekrany gry naraz, np. dwie kolumny od ok. 1024 px. Telefon bez zmian.
- **Decyzja Karola (15.10):** przed planem 4 warianty układu (nie więcej) na tymczasowej stronie podglądów, z prawdziwymi komponentami gry. Zrzuty: laptop jako całe okno gry 1:1, telefon w prawdziwej wielkości, te same stany w każdym wariancie, strona „Co oceniasz” w Chrome Karola. Karol wybiera (albo miesza), dopiero potem plan i kod gry.
- **Wybór Karola z galerii 4 wariantów (15.10, po stanach):** poczekalnia A, gość przed głosem dziś, host po głosie C („chyba C, nie jestem pewien”), odsłona 5 graczy B, odsłona 20 graczy C, koniec wieczoru dziś. Złożone w mieszankę „M” (`mixLayout` w prototypie): poczekalnia A, głosowanie gościa dziś, głosowanie hosta i odsłona C, pominięte i koniec dziś; nagłówek zawsze szeroki. Druga galeria (M kontra dziś, 11 stanów): Karol potwierdził M („git”, 15.10) razem z obiema rekomendacjami. Pasek hosta pojawia się dopiero po głosie hosta; przed głosem przyciski stoją pod listą jak dziś, bo w prototypie pasek zasłaniał „Zagłosuj”. Nagłówek jest zawsze szeroki, także nad wąską treścią, żeby nie skakał między ekranami.
- **Proces:** zmiany w `src/pages/r/` tylko przez PR na zielonym CI (AGENTS.md). Stare ścieżki `context/changes/full-game-evening/` w komentarzach 21 plików (`src/`, `tests/`, `scripts/smoke.mjs`, `supabase/tests/`) poprawić w PR tej zmiany, jeśli i tak go otwiera, na `context/archive/2026-10-15-full-game-evening/`.
- **Wynik (18.10):** PR #9 scalony (`295c438`), Workers Builds zielone, smoke na produkcji 53/53 bez pominięć. Test wieczoru gra też w oknie telefonu (projekt `phone`), a dwa próbne alarmy trafiły dokładnie: przyciski hosta schowane pod 1024 px zaświeciły tylko `phone`, pasek bez `sticky` tylko krok „Host's bar” w `chromium`. Runda Karola na produkcji (laptop z przeglądarką na całym ekranie jako host, telefon, incognito): wszystko zgodne z planem, telefon jak dawniej.
