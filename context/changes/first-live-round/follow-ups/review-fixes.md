# Follow-upy z przeglądu implementacji S-02

Źródło: `reviews/impl-review.md` (15.10.2026). Karol przyjął rekomendacje: F1, F2, F3 i F5 poprawione w tej zmianie przed `db push`; F7 sprawdzany w ręcznej rundzie 6.5; F4 i F6 odłożone tutaj.

## W tej zmianie (faza 6)

- **F7, czytnik ekranu.** W ręcznej rundzie 6.5 Karol włącza na telefonie czytnik ekranu (Android: TalkBack, iPhone: VoiceOver) na czas odsłony i sprawdza, że ją ogłasza. Wynik trafia do notatki fazy 2 w test-plan §6.6.

## Na później (S-03 albo następny audyt obserwowalności)

- **F4, wysypany ekran nie zostawia śladu.**
  - Stan dziś: `src/lib/client-events.ts:8` przyjmuje `island_crash`, a `src/pages/api/client-events.ts:27` loguje je jako `error`, ale nic w `src/` go nie wysyła. Ekran pokoju nie ma granicy błędów (error boundary), więc gdy wyspa się wysypie, gracz widzi pusty ekran, a logi milczą.
  - Co zrobić: granica błędów w `RoomScreen` z napisem dla gracza („Coś się popsuło — odśwież”) i zgłoszeniem `island_crash` przez to samo wejście co `realtime_status` (widoczna karta, najwyżej 3 na typ). Test jednostkowy granicy i jej stan na `/dev/room-states` do oceny.
  - Dlaczego nie teraz: nowy kod ekranu przed wdrożeniem S-02 (test, zrzut, przeklikanie, kolejny przebieg CI); ścieżki rundy pokrywa e2e.
- **F6, trasy JSON czytają całą treść przed limitem.**
  - Stan dziś: `readJsonBody` (`src/lib/rooms/json-route.ts:46-53`) robi `request.text()`, a długość (4096) sprawdza dopiero potem. `/api/client-events` jest publiczny, a `Origin` zatrzymuje tylko przeglądarki.
  - Co zrobić: odrzucać 400 `invalid_body` po nagłówku `Content-Length` większym niż limit, zanim treść zostanie przeczytana (treść bez tego nagłówka czytać z limitem). Przy triage logów traktować linie `op: "client"` jako niezaufane.
  - Dlaczego nie teraz: zużycie dziennego limitu żądań dotyczy każdej publicznej trasy, nie tylko tej; pola zgłoszeń są z list, więc nic nie wstrzykną do logu.
