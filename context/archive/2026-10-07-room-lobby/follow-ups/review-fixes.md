# Follow-upy z przeglądu implementacji S-01

Źródło: `reviews/impl-review.md` (08.10.2026). Decyzje Karola z triage: F1 i F2 idą do S-02, a F4 do najbliższej migracji, która rusza nicki (S-02 albo S-04).

## Dla S-02 (first-live-round)

- **F1, uprawnienia hosta.**
  - Stan dziś: `authenticated` ma `insert` na `rooms` i `players` oraz `update (status)` na `rooms`, a polityka „Hosts update their rooms” (`supabase/migrations/20261007122858_room_lobby.sql:73-76`) sprawdza tylko `host_id`. Host może więc swoim tokenem przez REST:
    - otworzyć z powrotem zamknięty pokój;
    - sam wybrać kod linku, bo `create_room` przyjmuje `p_link_token`;
    - zapisać dowolne nazwy kategorii.
  - Gdy S-02 doda stany gry do `status`, ten sam grant pozwoliłby hostowi przeskakiwać etapy.
  - Co zrobić w migracji S-02:
    - zawęzić polityki do przejść, które gra dopuszcza (albo przenieść zapisy hosta do funkcji `security definer` i odebrać `insert`/`update`);
    - kod linku generować w SQL;
    - kategorie z bazy filtrować przez `CATEGORIES` przy losowaniu.
- **F2, dzwonek bez ogranicznika.**
  - Stan dziś: każdy dzwonek na `live-sync:<roomId>` wywołuje od razu `refresh()` na każdym ekranie (`src/components/room/RoomLobby.tsx`).
  - Ryzyko: kanał jest publiczny, a `room_id` zna każdy gość, więc seria dzwonków to N żądań do Workera na każdy dzwonek. Może to zjeść limit 100 tys. żądań dziennie.
  - Co zrobić w S-02, gdzie dzwonek pójdzie przy każdym głosie: najwyżej jedno pobranie naraz plus jedno „na koniec”, z odstępem ok. 1 s.

## Dla migracji, która rusza nicki (S-02 albo S-04)

- **F4, reguła nicku.**
  - Stan dziś: wgrana `private.normalize_nick` jest szersza niż w planie (szczegóły w `change.md`, nota „Reguła nicku”).
  - Nadal przechodzą niektóre niewidoczne znaki: selektory wariantu U+FE00–FE0F (uwaga: U+FE0F zmienia wygląd emotek), znaczniki U+E0000–E007F, U+061C, U+180F, U+1BCA0–1BCA3, U+1D173–1D17A.
  - `join_room` nie ma limitu długości `p_nick` przed wyrażeniami regularnymi.
  - Co zrobić: `create or replace function private.normalize_nick` z brakującymi zakresami, odrzucenie `char_length(p_nick) > 100` przed normalizacją i krok smoke dla „Ola”+U+FE0F.
