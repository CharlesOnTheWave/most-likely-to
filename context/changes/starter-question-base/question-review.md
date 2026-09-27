# Przegląd pytań: baza startowa (F-02)

Zapis przeglądu bazy startowej przez twórcę gry (Karola). Do `src/data/questions.ts` trafiają wyłącznie wiersze ze statusem `fajne` (Faza 3 planu).

- Na ekranie pytanie brzmi: „Kto z nas najprawdopodobniej {tekst}?”.
- Statusy: `propozycja` (czeka na ocenę), `fajne`, `do poprawy` (nowa wersja trafia do nowego wiersza), `usunięte`.
- Minimum w każdej kategorii: 15 zwykłych i 5 pytań 18+ ze statusem `fajne`.
- Numery `dNN` to numery szkicu, a nie identyfikatory pytań w grze; te nadaje Faza 3.
- Strona przeglądu: prywatny artefakt claude.ai (link w rozmowie z Claude); oceny zapisują się w jego bazie (kolekcja `marks`).

## Wynik rundy 1 (27.09.2026)

Karol przejrzał wszystkie 216 pytań i zaakceptował je w czacie, bez oznaczania na stronie przeglądu: „pytania przejrzane. nie chce mi sie wypelniac formularza, ale doslownie kazde jest w sumie smieszne, podobaja mi sie. wstępnie akceptuje wszystkie”. Wszystkie wiersze mają więc status `fajne`; żadne pytanie nie jest do poprawy ani do usunięcia, więc runda 2 nie jest potrzebna.

## Na co dzień (`na-co-dzien`)

| # | Pytanie (końcówka) | 18+ | Status | Uwaga Karola | Runda |
| --- | --- | --- | --- | --- | --- |
| d01 | spóźniłby się na własne urodziny | – | fajne |  | 1 |
| d02 | zostawiłby herbatę do wystygnięcia i zapomniał o niej trzy razy | – | fajne |  | 1 |
| d03 | zjadłby na śniadanie wczorajszą pizzę prosto z lodówki | – | fajne |  | 1 |
| d04 | miałby w telefonie ponad dziesięć tysięcy nieprzeczytanych maili | – | fajne |  | 1 |
| d05 | chodziłby w piżamie cały weekend | – | fajne |  | 1 |
| d06 | zgubiłby klucze we własnym mieszkaniu | – | fajne |  | 1 |
| d07 | zamówiłby jedzenie, mając pełną lodówkę | – | fajne |  | 1 |
| d08 | wyszedłby ze sklepu z pełną torbą, ale bez tego, po co przyszedł | – | fajne |  | 1 |
| d09 | odpisałby na wiadomość po trzech tygodniach | – | fajne |  | 1 |
| d10 | ustawiłby dziesięć budzików i przespał wszystkie | – | fajne |  | 1 |
| d11 | gadałby do swoich roślin doniczkowych | – | fajne |  | 1 |
| d12 | zapomniałby, po co wszedł do pokoju | – | fajne |  | 1 |
| d13 | oglądałby ten sam serial po raz piąty zamiast zacząć nowy | – | fajne |  | 1 |
| d14 | trzymałby w szafie ubrania z metkami sprzed roku | – | fajne |  | 1 |
| d15 | przeczytałby cały regulamin, zanim kliknie „akceptuję” | – | fajne |  | 1 |
| d16 | zrobiłby pranie i zostawił je w pralce na dwa dni | – | fajne |  | 1 |
| d17 | kłóciłby się z nawigacją w samochodzie | – | fajne |  | 1 |
| d18 | miałby w lodówce więcej sosów niż jedzenia | – | fajne |  | 1 |
| d19 | planowałby w kalendarzu cały tydzień, łącznie z drzemkami | – | fajne |  | 1 |
| d20 | nadałby imię swojemu odkurzaczowi | – | fajne |  | 1 |
| d21 | napisałby do ex o drugiej w nocy | 18+ | fajne |  | 1 |
| d22 | poszedłby na randkę w dresie | 18+ | fajne |  | 1 |
| d23 | otworzyłby wino w poniedziałek, „bo zasłużył” | 18+ | fajne |  | 1 |
| d24 | znałby po imieniu ekspedientkę z nocnego | 18+ | fajne |  | 1 |
| d25 | zasnąłby na randce | 18+ | fajne |  | 1 |
| d26 | przewijałby Tindera zamiast spać | 18+ | fajne |  | 1 |
| d27 | nosiłby w portfelu tę samą prezerwatywę od liceum | 18+ | fajne |  | 1 |

## Imprezy (`imprezy`)

| # | Pytanie (końcówka) | 18+ | Status | Uwaga Karola | Runda |
| --- | --- | --- | --- | --- | --- |
| d01 | zasnąłby na własnej imprezie | – | fajne |  | 1 |
| d02 | zatańczyłby na stole | – | fajne |  | 1 |
| d03 | przyszedłby na imprezę godzinę przed czasem | – | fajne |  | 1 |
| d04 | przejąłby muzykę na imprezie i puszczał tylko swoje kawałki | – | fajne |  | 1 |
| d05 | zaśpiewałby w karaoke bez ani jednej trafionej nuty | – | fajne |  | 1 |
| d06 | zostałby do końca imprezy i jeszcze pozmywał naczynia | – | fajne |  | 1 |
| d07 | wyszedłby z imprezy po angielsku | – | fajne |  | 1 |
| d08 | przebrałby się na imprezę, na której nikt inny się nie przebrał | – | fajne |  | 1 |
| d09 | zorganizowałby imprezę-niespodziankę i sam się wygadał | – | fajne |  | 1 |
| d10 | zjadłby wszystkie przekąski, zanim przyjdą goście | – | fajne |  | 1 |
| d11 | przyprowadziłby na imprezę kogoś, kogo nikt nie zna | – | fajne |  | 1 |
| d12 | opowiadałby tę samą anegdotę na każdej imprezie | – | fajne |  | 1 |
| d13 | zrobiłby na imprezie sto zdjęć i nie wysłał nikomu ani jednego | – | fajne |  | 1 |
| d14 | pokłóciłby się o zasady gry planszowej | – | fajne |  | 1 |
| d15 | zamówiłby dla wszystkich pizzę z ananasem bez pytania | – | fajne |  | 1 |
| d16 | zostałby wodzirejem na weselu kuzyna | – | fajne |  | 1 |
| d17 | przespałby północ w sylwestra | – | fajne |  | 1 |
| d18 | zgubiłby telefon na domówce, na której było dziesięć osób | – | fajne |  | 1 |
| d19 | przyniósłby na imprezę gitarę i nie oddał jej nikomu do rana | – | fajne |  | 1 |
| d20 | tańczyłby sam na parkiecie, zanim ktokolwiek się odważy | – | fajne |  | 1 |
| d21 | wypiłby za dużo i zaczął mówić po angielsku | 18+ | fajne |  | 1 |
| d22 | obudziłby się rano w wannie gospodarza | 18+ | fajne |  | 1 |
| d23 | pocałowałby o północy kogoś, kogo poznał pięć minut wcześniej | 18+ | fajne |  | 1 |
| d24 | zdjąłby koszulkę na parkiecie | 18+ | fajne |  | 1 |
| d25 | wyznawałby wszystkim miłość po trzecim drinku | 18+ | fajne |  | 1 |
| d26 | wróciłby z imprezy w cudzej kurtce | 18+ | fajne |  | 1 |
| d27 | flirtowałby z barmanem dla darmowego shota | 18+ | fajne |  | 1 |

## Przyszłość (`przyszlosc`)

| # | Pytanie (końcówka) | 18+ | Status | Uwaga Karola | Runda |
| --- | --- | --- | --- | --- | --- |
| d01 | zostałby milionerem | – | fajne |  | 1 |
| d02 | wyprowadziłby się w Bieszczady hodować kozy | – | fajne |  | 1 |
| d03 | zostałby sławny w internecie przez przypadek | – | fajne |  | 1 |
| d04 | założyłby własną firmę przed trzydziestką | – | fajne |  | 1 |
| d05 | miałby piątkę dzieci | – | fajne |  | 1 |
| d06 | zostałby burmistrzem swojego miasta | – | fajne |  | 1 |
| d07 | wygrałby teleturniej w telewizji | – | fajne |  | 1 |
| d08 | poleciałby w kosmos | – | fajne |  | 1 |
| d09 | napisałby bestseller | – | fajne |  | 1 |
| d10 | przeżyłby apokalipsę zombie | – | fajne |  | 1 |
| d11 | wziąłby ślub w Las Vegas | – | fajne |  | 1 |
| d12 | wróciłby do swojej dawnej szkoły jako nauczyciel | – | fajne |  | 1 |
| d13 | miałby w domu więcej kotów niż mebli | – | fajne |  | 1 |
| d14 | dożyłby setki | – | fajne |  | 1 |
| d15 | rzuciłby korpo i otworzył food trucka | – | fajne |  | 1 |
| d16 | przepuściłby wygraną w lotto w jeden rok | – | fajne |  | 1 |
| d17 | zagrałby w reklamie telewizyjnej | – | fajne |  | 1 |
| d18 | zbudowałby dom własnymi rękami | – | fajne |  | 1 |
| d19 | mieszkałby za dziesięć lat na innym kontynencie | – | fajne |  | 1 |
| d20 | wynalazłby coś, czego będą używać wszyscy | – | fajne |  | 1 |
| d21 | wziąłby ślub z kimś poznanym na wakacjach | 18+ | fajne |  | 1 |
| d22 | miałby na koncie trzy rozwody | 18+ | fajne |  | 1 |
| d23 | otworzyłby własny pub i był w nim najlepszym klientem | 18+ | fajne |  | 1 |
| d24 | zostałby zawodowym degustatorem piwa | 18+ | fajne |  | 1 |
| d25 | poznałby miłość życia w aplikacji randkowej | 18+ | fajne |  | 1 |
| d26 | wróciłby do ex po dziesięciu latach | 18+ | fajne |  | 1 |
| d27 | wystąpiłby w randkowym reality show | 18+ | fajne |  | 1 |

## Wpadki i obciach (`wpadki-i-obciach`)

| # | Pytanie (końcówka) | 18+ | Status | Uwaga Karola | Runda |
| --- | --- | --- | --- | --- | --- |
| d01 | pomachałby komuś, kto machał do osoby za nim | – | fajne |  | 1 |
| d02 | wysłałby wiadomość o kimś prosto do tej osoby | – | fajne |  | 1 |
| d03 | wszedłby z impetem w szklane drzwi | – | fajne |  | 1 |
| d04 | powiedziałby do nauczycielki „mamo” | – | fajne |  | 1 |
| d05 | zaciąłby się w drzwiach tramwaju | – | fajne |  | 1 |
| d06 | odpowiedziałby „nawzajem” kelnerowi, który życzy smacznego | – | fajne |  | 1 |
| d07 | przewróciłby się na prostej drodze | – | fajne |  | 1 |
| d08 | zaśmiałby się w najmniej odpowiednim momencie | – | fajne |  | 1 |
| d09 | polubiłby przez przypadek czyjeś zdjęcie sprzed pięciu lat | – | fajne |  | 1 |
| d10 | wyszedłby z toalety z papierem przyklejonym do buta | – | fajne |  | 1 |
| d11 | zapomniałby czyjegoś imienia w trakcie przedstawiania go innym | – | fajne |  | 1 |
| d12 | chodziłby cały dzień w bluzie założonej na lewą stronę | – | fajne |  | 1 |
| d13 | zamówiłby w restauracji nie to, co chciał, bo nie umiał wymówić nazwy | – | fajne |  | 1 |
| d14 | ciągnąłby kilka razy drzwi z napisem „pchać” | – | fajne |  | 1 |
| d15 | zasnąłby w autobusie i obudził się na pętli | – | fajne |  | 1 |
| d16 | śpiewałby na głos w słuchawkach, myśląc, że nikt nie słyszy | – | fajne |  | 1 |
| d17 | pomyliłby sale i przesiedział cały wykład na innym kierunku | – | fajne |  | 1 |
| d18 | potknąłby się, wchodząc na scenę po nagrodę | – | fajne |  | 1 |
| d19 | wysłałby głosówkę, której wcale nie chciał wysłać | – | fajne |  | 1 |
| d20 | pomyliłby obcą osobę z kumplem i klepnął ją w plecy | – | fajne |  | 1 |
| d21 | pomyliłby imię osoby, z którą jest na randce | 18+ | fajne |  | 1 |
| d22 | wysłałby pikantną wiadomość na rodzinną grupę | 18+ | fajne |  | 1 |
| d23 | dałby się przyłapać rodzicom na całowaniu | 18+ | fajne |  | 1 |
| d24 | obudziłby się po imprezie z czyimś numerem napisanym na ręce | 18+ | fajne |  | 1 |
| d25 | próbowałby tańczyć na rurze i spadł | 18+ | fajne |  | 1 |
| d26 | wróciłby z imprezy do domu, ale nie do swojego | 18+ | fajne |  | 1 |
| d27 | wyznałby miłość po pijaku, a rano udawał, że nic nie pamięta | 18+ | fajne |  | 1 |

## Gry i internet (`gry-i-internet`)

| # | Pytanie (końcówka) | 18+ | Status | Uwaga Karola | Runda |
| --- | --- | --- | --- | --- | --- |
| d01 | grałby do piątej rano, bo „jeszcze jedna runda” | – | fajne |  | 1 |
| d02 | rzuciłby padem po przegranej | – | fajne |  | 1 |
| d03 | wydałby majątek na skórki w grze | – | fajne |  | 1 |
| d04 | dostałby bana na własnym serwerze Discorda | – | fajne |  | 1 |
| d05 | kłóciłby się na czacie gry z dwunastolatkiem | – | fajne |  | 1 |
| d06 | zwaliłby każdą przegraną na lagi | – | fajne |  | 1 |
| d07 | przeszedłby grę na najwyższym poziomie tylko po to, żeby się pochwalić | – | fajne |  | 1 |
| d08 | oglądałby poradniki do gry dłużej, niż w nią grał | – | fajne |  | 1 |
| d09 | wyszedłby z meczu w połowie, bo przegrywał | – | fajne |  | 1 |
| d10 | założyłby kanał na Twitchu, który ogląda tylko mama | – | fajne |  | 1 |
| d11 | wdałby się w kłótnię w komentarzach pod filmikiem o kotach | – | fajne |  | 1 |
| d12 | miałby w jednej grze więcej godzin, niż przespał w tym roku | – | fajne |  | 1 |
| d13 | wrzucałby na serwer zrzut ekranu każdej swojej wygranej | – | fajne |  | 1 |
| d14 | miałby na Steamie sto gier, których nigdy nie uruchomił | – | fajne |  | 1 |
| d15 | stałby się memem na naszym serwerze | – | fajne |  | 1 |
| d16 | przegapiłby wesele kuzyna, bo był w środku rajdu | – | fajne |  | 1 |
| d17 | gadałby pół godziny na wyciszonym mikrofonie | – | fajne |  | 1 |
| d18 | oddałby wszystkie przedmioty w grze za jedną rzadką broń | – | fajne |  | 1 |
| d19 | wstałby o czwartej rano po limitowany przedmiot w grze | – | fajne |  | 1 |
| d20 | przeklikałby wszystkie dialogi, a potem pytał, o co chodzi w fabule | – | fajne |  | 1 |
| d21 | podrywałby kogoś w grze, nie wiedząc, kim ta osoba jest | 18+ | fajne |  | 1 |
| d22 | zorganizowałby na Discordzie grę alkoholową w środę | 18+ | fajne |  | 1 |
| d23 | poznałby drugą połówkę w grze online | 18+ | fajne |  | 1 |
| d24 | zniknąłby z Discorda w pół zdania, bo „ktoś przyszedł” | 18+ | fajne |  | 1 |
| d25 | sprzedałby konto w grze, żeby postawić wszystkim kolejkę | 18+ | fajne |  | 1 |
| d26 | nie dałby nikomu zajrzeć do swojej historii przeglądarki | 18+ | fajne |  | 1 |
| d27 | grałby rankingi po pijaku i spadł o dwie ligi | 18+ | fajne |  | 1 |

## Podróże i przygody (`podroze-i-przygody`)

| # | Pytanie (końcówka) | 18+ | Status | Uwaga Karola | Runda |
| --- | --- | --- | --- | --- | --- |
| d01 | zgubiłby paszport na lotnisku | – | fajne |  | 1 |
| d02 | przegapiłby samolot, siedząc przy bramce | – | fajne |  | 1 |
| d03 | wybrałby w górach „skrót”, który wydłużył trasę o trzy godziny | – | fajne |  | 1 |
| d04 | spakowałby się godzinę przed wyjazdem | – | fajne |  | 1 |
| d05 | przywiózłby z wakacji walizkę pamiątek dla wszystkich | – | fajne |  | 1 |
| d06 | zjadłby na zagranicznym targu smażonego pająka | – | fajne |  | 1 |
| d07 | pojechałby autostopem przez Europę | – | fajne |  | 1 |
| d08 | spaliłby się na raka pierwszego dnia wakacji | – | fajne |  | 1 |
| d09 | pojechałby na wakacje bez planu i bez noclegu | – | fajne |  | 1 |
| d10 | skoczyłby na bungee | – | fajne |  | 1 |
| d11 | zgubiłby się w obcym mieście i trafił do najlepszej knajpy | – | fajne |  | 1 |
| d12 | przespałby noc na szczycie, żeby zobaczyć wschód słońca | – | fajne |  | 1 |
| d13 | spakowałby pięć par butów na weekend | – | fajne |  | 1 |
| d14 | dogadywałby się z miejscowymi na migi przez cały wyjazd | – | fajne |  | 1 |
| d15 | wszedłby na Rysy w klapkach | – | fajne |  | 1 |
| d16 | kupiłby bilet w jedną stronę bez planu powrotu | – | fajne |  | 1 |
| d17 | zrobiłby na wakacjach tysiąc zdjęć i ani jednego z ludźmi | – | fajne |  | 1 |
| d18 | zatrzasnąłby się na balkonie w hotelu | – | fajne |  | 1 |
| d19 | przepłynąłby jezioro wpław, bo „to niedaleko” | – | fajne |  | 1 |
| d20 | pojechałby na lotnisko w złym dniu | – | fajne |  | 1 |
| d21 | przeżyłby wakacyjny romans | 18+ | fajne |  | 1 |
| d22 | wróciłby z wakacji z tatuażem, którego nie pamięta | 18+ | fajne |  | 1 |
| d23 | przepiłby cały budżet wakacyjny w trzy dni | 18+ | fajne |  | 1 |
| d24 | kąpałby się nago w jeziorze o północy | 18+ | fajne |  | 1 |
| d25 | przespałby noc na dworcu po imprezie w obcym mieście | 18+ | fajne |  | 1 |
| d26 | zakochałby się w przewodniku wycieczki | 18+ | fajne |  | 1 |
| d27 | przywiózłby w walizce więcej wina niż ubrań | 18+ | fajne |  | 1 |

## Sport i wyzwania (`sport-i-wyzwania`)

| # | Pytanie (końcówka) | 18+ | Status | Uwaga Karola | Runda |
| --- | --- | --- | --- | --- | --- |
| d01 | przebiegłby maraton bez przygotowania | – | fajne |  | 1 |
| d02 | kupiłby karnet na siłownię i poszedł raz | – | fajne |  | 1 |
| d03 | przyjąłby każdy zakład, nawet najgłupszy | – | fajne |  | 1 |
| d04 | zjadłby najostrzejszą papryczkę świata dla zakładu | – | fajne |  | 1 |
| d05 | wskoczyłby do przerębla w styczniu | – | fajne |  | 1 |
| d06 | zrobiłby sto pompek, żeby coś udowodnić | – | fajne |  | 1 |
| d07 | krzyczałby na sędziego przez telewizor | – | fajne |  | 1 |
| d08 | nabawiłby się kontuzji na rozgrzewce | – | fajne |  | 1 |
| d09 | zostałby trenerem personalnym | – | fajne |  | 1 |
| d10 | przeszedłby pieszo całą Polskę | – | fajne |  | 1 |
| d11 | przegrałby w ping-ponga z dzieckiem | – | fajne |  | 1 |
| d12 | kupiłby cały sprzęt do nowego sportu i rzucił go po tygodniu | – | fajne |  | 1 |
| d13 | robiłby na siłowni więcej selfie niż serii | – | fajne |  | 1 |
| d14 | wytrzymałby miesiąc bez słodyczy | – | fajne |  | 1 |
| d15 | pojechałby rowerem nad morze | – | fajne |  | 1 |
| d16 | podjąłby każde wyzwanie z TikToka | – | fajne |  | 1 |
| d17 | zdobyłby Koronę Gór Polski | – | fajne |  | 1 |
| d18 | obraziłby się po przegranym meczu w piłkarzyki | – | fajne |  | 1 |
| d19 | biegałby codziennie o szóstej rano | – | fajne |  | 1 |
| d20 | zapisałby się na triathlon po jednym treningu | – | fajne |  | 1 |
| d21 | wygrałby konkurs picia piwa na czas | 18+ | fajne |  | 1 |
| d22 | zapisałby się na siłownię dla ładnej osoby z recepcji | 18+ | fajne |  | 1 |
| d23 | poszedłby pobiegać z kacem, żeby „wypocić” imprezę | 18+ | fajne |  | 1 |
| d24 | przebiegłby nago przez boisko w trakcie meczu | 18+ | fajne |  | 1 |
| d25 | umówiłby się na randkę na ściance wspinaczkowej | 18+ | fajne |  | 1 |
| d26 | zapisałby się na bieg z piwem na każdym kilometrze | 18+ | fajne |  | 1 |
| d27 | chodziłby na mecze wyłącznie dla piwa na trybunach | 18+ | fajne |  | 1 |

## Praca i szkoła (`praca-i-szkola`)

| # | Pytanie (końcówka) | 18+ | Status | Uwaga Karola | Runda |
| --- | --- | --- | --- | --- | --- |
| d01 | zasnąłby na zebraniu | – | fajne |  | 1 |
| d02 | zostawiłby włączony mikrofon w najgorszym momencie spotkania | – | fajne |  | 1 |
| d03 | dałby się złapać na ściąganiu | – | fajne |  | 1 |
| d04 | odpowiedziałby „do wszystkich” na maila do jednej osoby | – | fajne |  | 1 |
| d05 | przyszedłby do pracy w kapciach | – | fajne |  | 1 |
| d06 | napisałby pracę zaliczeniową w noc przed terminem | – | fajne |  | 1 |
| d07 | zostałby szefem swojego szefa | – | fajne |  | 1 |
| d08 | zjadłby cudzy obiad z firmowej lodówki | – | fajne |  | 1 |
| d09 | oglądałby w pracy serial z udawaną tabelką na drugim ekranie | – | fajne |  | 1 |
| d10 | rzuciłby pracę w dramatyczny sposób | – | fajne |  | 1 |
| d11 | spóźniłby się na własną rozmowę kwalifikacyjną | – | fajne |  | 1 |
| d12 | przynosiłby ciasto do pracy w każdy piątek | – | fajne |  | 1 |
| d13 | dostałby uwagę za gadanie na lekcji | – | fajne |  | 1 |
| d14 | poszedłby na wagary i wpadł na wychowawczynię w galerii | – | fajne |  | 1 |
| d15 | odpisywałby na maile o drugiej w nocy | – | fajne |  | 1 |
| d16 | zostałby przewodniczącym samorządu | – | fajne |  | 1 |
| d17 | podpisałby listę obecności za pół grupy | – | fajne |  | 1 |
| d18 | zrobiłby sześćdziesiąt slajdów na pięciominutową prezentację | – | fajne |  | 1 |
| d19 | kłóciłby się z nauczycielem o pół punktu | – | fajne |  | 1 |
| d20 | zostałby pracownikiem miesiąca, nic nie robiąc | – | fajne |  | 1 |
| d21 | wdałby się w romans biurowy | 18+ | fajne |  | 1 |
| d22 | przyszedłby do pracy prosto z imprezy | 18+ | fajne |  | 1 |
| d23 | wypiłby za dużo na firmowej wigilii i powiedział szefowi, co myśli | 18+ | fajne |  | 1 |
| d24 | wysłałby dwuznaczną emotkę na firmowym czacie | 18+ | fajne |  | 1 |
| d25 | przespałby egzamin po imprezie w akademiku | 18+ | fajne |  | 1 |
| d26 | schowałby piersiówkę w szufladzie biurka | 18+ | fajne |  | 1 |
| d27 | umówiłby się na randkę z kimś z działu HR | 18+ | fajne |  | 1 |
