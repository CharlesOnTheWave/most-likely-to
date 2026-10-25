---
artifact: domain-glossary
created: 2026-10-20
source: context/domain/domain-distillation.md
---

# Glossary: Most Likely To

Use these words in code, tests, commits and conversations. When a name in the code differs from the term, the term wins in new code; renaming old code is a separate decision. Terms stay in Polish (the game and its documents are Polish); code names stay in English.

## Runda na żywo (Core)

| term | means | name in code | don't call it |
| --- | --- | --- | --- |
| runda | jedno pytanie na ekranie wszystkich, od otwarcia do odsłony albo pominięcia | `rounds`, `RoundState` | „pytanie” w kodzie (w tekstach UI dla gracza „Pytanie N.” jest w porządku) |
| głos | wybór jednej osoby z listy albo wstrzymanie się; nigdzie nie istnieje jako rekord | `cast_vote`; ślady: `round_voters`, `ballot_boxes.tally` | „kartka z celem”, cokolwiek, co łączy głosującego z celem |
| wstrzymanie się | świadomy wybór „nikt”, liczony osobno | `abstained`, `target: null`, `"abstain"` | „pomijanie” (to robi prowadzący z pytaniem) |
| kto już zagłosował | lista nicków, które oddały głos w tej rundzie, bez celu | `voted`, `me_voted` | „głosy” |
| uprawnieni | gracze, którzy mogą głosować w tej rundzie: wszyscy w pokoju przy jej otwarciu | `eligible`; `round.eligible` w stanie pokoju | „gracze” (to nie zawsze ta sama lista) |
| odsłona | moment, w którym wszyscy widzą, ile głosów dostała każda osoba | `reveal_round`, `finish_round`, `phase = 'revealed'` | „przewinięcie”, „advance” |
| wynik | liczba głosów na każdą osobę w jednej rundzie | `round_results`, `RoundResult` | „wynik jakości” (to ocena pytania) |
| urna | stan rundy w toku: kto zagłosował i liczniki; znika przy odsłonie i każdym innym końcu | `ballot_boxes` (+ `round_voters`) | „głosy w bazie” |
| pominięcie pytania | prowadzący porzuca rundę w trakcie głosowania; głosy przepadają | `skip_round`, `phase = 'skipped'` | „wstrzymanie się” |
| następne pytanie | prowadzący otwiera kolejną rundę po odsłonie albo pominięciu | `next_round` | „przewinięcie”, „advance” |
| numer pytania | numer rundy, którą gracz widział na ekranie, wysyłany z akcją | `rounds.number`, `p_round`, `round` w ciele żądania | — |

## Pokój i gracze (Supporting)

| term | means | name in code | don't call it |
| --- | --- | --- | --- |
| pokój | byt z linkiem: od założenia przez hosta do zamknięcia | `rooms` | „sesja”, „wieczór” |
| gra | pokój w stanie `playing`: od startu do końca | `status = 'playing'`, `start_game`, `end_game` | — |
| wieczór | tylko tekst ekranu końcowego („Koniec wieczoru”) | `EveningEnd` | nazwa bytu w kodzie |
| poczekalnia | stan pokoju przed startem | `status = 'lobby'`, `RoomLobby` | „lobby” w znaczeniu całego stanu pokoju |
| stan pokoju | wszystko, co gracz widzi o pokoju w danej chwili, w każdym statusie | `room_lobby`, `LobbyState`, `GET …/lobby` | „lobby” |
| host | zalogowana osoba, która zakłada grę i ją prowadzi; też gra i głosuje | `host_id`, `role: "host"` | „twórca gry”, „creator”, „owner” |
| gość | gracz bez konta, wchodzi linkiem i nickiem | `role: "guest"`, `players.user_id is null` | „player” jako synonim gościa |
| gracz | każdy z nickiem w pokoju, także host | `players`, `LobbyPlayer` | „gość” (host też jest graczem) |
| prowadzący | host albo (później) współhost | dziś tylko host | — |
| współhost | gość z prawem prowadzenia rund | *missing in code* (S-07) | — |
| spóźniony | ktoś, kto prosi o wejście do trwającej gry | `join_requests` (jego prośba); po wpuszczeniu zwykły gracz | — |
| prośba o wejście | spóźniony prosi o wejście do trwającej gry, host wpuszcza („Wpuść”) albo odrzuca („Odrzuć”); po odrzuceniu można poprosić jeszcze raz | `join_requests`, `request_join`, `admit_latecomer`, `reject_latecomer`; `requests` w stanie pokoju (tylko host) | „dołączenie” (to wejście z linku w poczekalni, bez hosta) |
| nick | nazwa gracza w pokoju; unikalna po normalizacji, wielkość liter się liczy | `nick`, `nick_key` | „login”, „imię” |
| zapamiętany nick | ostatni nick przyjęty w tej przeglądarce, podpowiadany w formularzu wejścia i „Nowej grze”; tylko nick, nigdy głos | `src/lib/rooms/remembered-nick.ts`, `mlt-nick` | „konto”, „login” |
| link do pokoju | zaproszenie `/j/<kod>`, osobne od adresu pokoju | `link_token`, `/j/[token]` | „token” bez dopowiedzenia (token gościa to coś innego) |
| miejsce | kolejność dołączenia: host 1, goście dalej | `seat` | „czas wejścia” |
| token gościa | losowy sekret w ciasteczku, którym gość wraca do pokoju; w bazie tylko hash | `newPlayerToken`, `mlt_player_<roomId>`, `token_hash` | „sesja” |
| powrót po odświeżeniu | gracz wraca na swój nick i do bieżącej rundy | ponowne wejście w `join.ts` i `/j/[token]` | „odzyskanie nicku” (bez ciasteczka: *missing in code*, S-04) |
| usunięcie gracza | prowadzący usuwa gracza, pokój dostaje nowy link | *missing in code* (S-09) | „kick”, „ban” |
| lista własnych gier | panel hosta z grami i kasowaniem | *missing in code* (S-13) | „dashboard” (to pozostałość startera) |
| ekipa | grupa znajomych grająca razem; nie ma tożsamości w grze | *missing in code* | „team”, „crew” jako byt w kodzie |

## Pytania (Supporting)

| term | means | name in code | don't call it |
| --- | --- | --- | --- |
| pytanie | końcówka zdania „Kto z nas najprawdopodobniej…” z niezmiennym id `<kategoria>-<NNN>` | `QUESTIONS`, `QuestionId`, `question_id` | — |
| kategoria | temat pytań wybierany przez hosta przy zakładaniu gry | `CATEGORIES`, `categories` | — |
| pytania 18+ | pytania z flagą 18+, włączane osobno w każdej wybranej kategorii | `adult`, `adult_categories` | — |
| wspólna baza pytań | wszystkie pytania gry, kuratorowane przez twórcę gry | `src/data/questions.ts` | „pula” |
| lista pytań gry | pytania należące do jednej gry, które host może przejrzeć w poczekalni („Przejrzyj pytania”); gra gra je najpierw, w kolejności pozycji, a potem losuje dalej z wybranych kategorii | `private.game_questions`, `question_list`, `QuestionList` | „pula hosta” |
| pozostałe pytania | niezagrane wpisy listy pytań gry i niezagrane pytania wybranych kategorii spoza listy | `questionsLeft`, `hostQuestionsLeft` | „pula” bez dopowiedzenia |
| własne pytanie | pytanie dopisane przez hosta do listy pytań gry („Dodaj własne”), bez id z bazy pytań | `text` bez `question_id` w `game_questions`, `add_own_question` | „propozycja pytania” (to pytanie gościa) |
| usunięcie pytania z listy | host zdejmuje pytanie z listy pytań gry („Usuń”); wpis zostaje oznaczony, a pytanie nie pada w tej grze | `removed`, `remove_list_question` | „pominięcie” (to porzucenie rundy, `skip_round`) |
| dolosowanie pytania | host dobiera na koniec listy pytań gry kolejne pytanie z wybranych kategorii, którego nie ma na liście („Dolosuj pytanie”) | `draw_list_question` | — |
| propozycja pytania | pytanie zgłoszone przez gościa do zatwierdzenia | *missing in code* (S-10) | — |
| reakcja | kciuk w górę albo w dół po odsłonie | *missing in code* (S-11) | „ocena gracza” |
| ocena pytania | zbiorcza ocena pytania z danych o rozgrywce | *missing in code* (S-11) | „wynik” |
| dobór uczący się | losowanie, które woli pytania dobrze zagrane u innych ekip | *missing in code* (S-12); dziś `shuffledPool` bez wag | — |

## Operator (poza grą)

| term | means | name in code | don't call it |
| --- | --- | --- | --- |
| twórca gry | operator projektu: kuratoruje bazę pytań i ma dostęp do bazy danych | tylko komentarze („creator”, „owner”) | „host”; host „zakłada grę”, nie jest jej twórcą |
