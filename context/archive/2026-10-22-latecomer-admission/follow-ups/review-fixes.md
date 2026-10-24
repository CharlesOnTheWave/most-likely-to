# Poprawki z przeglądu implementacji (latecomer-admission)

Źródło: `reviews/impl-review.md` (24.10.2026). Decyzja Karola: F1 i F4 przy następnej zmianie w tych plikach, F2 i F3
przyjęte jako znane ryzyko (opis w raporcie).

## F1: testy `request_join` na zły token i równoległe prośby

- **Kiedy**: przy następnej zmianie, która dotyka `tests/db` (np. S-13).
- **Co**: pierwsza odmowa publicznej funkcji, 22023 na token w złym formacie, nie ma testu (w
  `tests/db/latecomers.test.ts` zły token sprawdza tylko `join_request_state`). Limit 5 i zajęte nicki są sprawdzane
  tylko kolejnymi wywołaniami, więc blokada wiersza pokoju nie jest ćwiczona.
- **Zrób**: w `latecomers.test.ts` próba z tokenem w złym formacie (22023) i sześć równoległych `requestJoin`
  (`Promise.all`, różne tokeny i nicki): dokładnie 5 × `ok` i 1 × `requests_full`. Przed pisaniem `test-plan.md` §6.

## F4: wiersz prośby u hosta może zostać wyszarzony

- **Kiedy**: przy następnej zmianie w `src/components/room/JoinRequests.tsx`.
- **Co**: po udanym „Wpuść”/„Odrzuć” wiersz czeka (`aria-disabled`), aż odświeżony stan go usunie, a wiersze mają klucz
  = nick (`JoinRequests.tsx:55,127`). Gdy odrzucony poprosi jeszcze raz pod tym samym nickiem, zanim dojdzie
  odświeżenie hosta (np. po nieudanym odświeżeniu), wiersz zostaje wyszarzony, dopóki nick nie zniknie z listy.
- **Zrób**: zdjąć stan „czeka” wiersza, gdy przychodzi odświeżona lista, która dalej ma jego nick (np. licznik
  odświeżeń jako prop albo część klucza); przypadek w E2E albo w podglądzie.

## Przy `/10x-archive latecomer-admission`, w tym samym PR

- **Co**: 11 komentarzy w kodzie wskazuje `context/changes/latecomer-admission/`. Zmień je na ścieżkę w
  `context/archive/2026-10-22-latecomer-admission/`: `scripts/smoke.mjs:309`, `src/lib/rooms/shared.ts:20`,
  `supabase/tests/round_creator_view.test.sql:14`, `tests/db/latecomers.test.ts:22, 23`,
  `tests/db/support/rounds.ts:48`, `tests/unit/json-route.test.ts:133`, `tests/unit/room-errors.test.ts:16, 25`,
  `tests/unit/room-state.test.ts:10, 485`.
- **Bez zmian**: nagłówek wypchniętej migracji `20261022132240_latecomer_admission.sql`.
