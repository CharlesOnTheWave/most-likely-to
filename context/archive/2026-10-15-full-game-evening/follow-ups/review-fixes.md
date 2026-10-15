# Follow-upy z przeglądu implementacji S-03

Źródło: `reviews/impl-review.md` (15.10.2026). Karol przyjął rekomendacje: F1, F4, F6 i F9 poprawione w tej zmianie przed `db push`; F7 i F8 zostają bez zmian (F7: klawiatura jeszcze raz w ręcznym wieczorze 6.5); F2, F3 i F5 odłożone tutaj.

## Na później

- **F2, numer pytania jeszcze nie jest obowiązkowy.**
  - Stan dziś: głos bez `round` trafia do najnowszej rundy (`src/pages/api/rooms/[id]/vote.ts`, `cast_vote` z `p_round default null` w `supabase/migrations/20261015122252_full_game_evening.sql`). To okno wdrożenia dla ekranów wczytanych przed S-03, ale bez daty zamknięcia. „Odsłoń wynik” nie niesie numeru (`reveal.ts`, `reveal_round` z S-02), więc nieaktualny ekran hosta może odsłonić rundę, której nie pokazał.
  - Co zrobić: gdy ekrany sprzed S-03 na pewno zniknęły (np. dzień po wdrożeniu), nowa migracja: `cast_vote` z obowiązkowym `p_round`, `reveal_round` z `p_round` (inny numer → `round_over`). `vote.ts` odpowiada `invalid_body` bez `round`, ekran wysyła numer przy odsłonie. Testy: `game-rules.test.ts` (głos bez numeru → odmowa, odsłona ze starym numerem → `round_over`), pgTAP (jedna wersja `cast_vote` i `reveal_round`), smoke (kroki rundy z S-02 dziś głosują bez numeru, więc trzeba je przestawić).
  - Dlaczego nie teraz: wymaga migracji, a dzisiejsza musi przyjmować wywołania starego Workera do scalenia (wdrożenie „baza, potem kod”). Gracz nie zyskuje na tym nic: zawsze może wysłać właściwy numer, a host i tak może odsłonić w każdej chwili (D3).

- **F3, lista kandydatów bez limitu i bez testu filtra formatu.**
  - Stan dziś: `private.open_next_round` sprawdza każdy element `p_candidates` pod blokadą wiersza pokoju, a długość listy ogranicza tylko `statement_timeout` i limit treści PostgREST. Filtr formatu id (`question_id ~ '^[a-z0-9-]+-[0-9]{3}$'`) chroni przed błędem ograniczenia z wartościami wiersza w DETAIL, ale żaden test go nie sprawdza.
  - Co zrobić: w następnej migracji odmowa dla list dłuższych niż ok. 1000 (baza pytań ma 216 id); test bazy w `game-rules.test.ts`: kandydaci `["NA-CO-DZIEN-001", null, Q]` otwierają Q, same błędne → `no_questions` i `error` null.
  - Dlaczego nie teraz: dotyczy tylko hosta, który woła bazę wprost i obciąża własny pokój; Worker zawsze wysyła poprawne id. Zmiana przetestowanej migracji tuż przed wdrożeniem to większe ryzyko niż ta dziura.

- **F5, `no_questions` w trakcie wieczoru pokazuje tekst ze startu gry.**
  - Stan dziś: `src/lib/rooms/errors.ts` ma dla `no_questions` „W wybranych kategoriach nie ma pytań. Załóż nową grę z innymi kategoriami.”. `next_round` zwraca ten sam kod, gdy pula skończy się w trakcie wieczoru, a rada „załóż nową grę” zamknęłaby bieżącą.
  - Co zrobić: `next.ts` zamienia `no_questions` na własny kod (np. `questions_ran_out`) z tekstem „Pytania z wybranych kategorii się skończyły.”; nowy kod na ręcznej liście w `tests/unit/room-errors.test.ts`.
  - Dlaczego nie teraz: ścieżka zdarza się tylko przy `questionsLeft` równym `null` albo nieaktualnym (drugi ekran hosta). Przy kolejnym pobraniu stanu ekran sam pokaże właściwy tekst i „Zakończ grę”.
