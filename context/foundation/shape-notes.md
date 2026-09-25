---
project: "Most Likely To"
context_type: greenfield
created: 2026-09-19
updated: 2026-09-20
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 8
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "preparation cost (hours per Google Form), no one to organize, existing tools don't fit live co-play"
    - topic: "insight vs existing apps"
      decision: "unverified — user has not checked existing 'most likely to' apps; hypothesis recorded, open question raised"
    - topic: "primary persona scope"
      decision: "any host of any friend group (not only the author's group); guests are secondary"
    - topic: "host access"
      decision: "sign-in without registration/password; several one-click sign-in methods offered, host picks (tentative); provider list is a downstream choice"
    - topic: "guest access"
      decision: "room link + nick, no account (MVP); browser-pinned nick considered for later"
    - topic: "roles"
      decision: "three roles: host, co-host (in-room privilege granted by host), guest"
    - topic: "MVP scope"
      decision: "full v1 despite cost disclosure: sign-in, room, round, categories, host panel with own questions, guest proposals + approval, learning question selection, co-host; evening history and browser-pinned nick deferred to v2"
    - topic: "timeline"
      decision: "8 weeks working estimate, sustained-effort cost acknowledged; revisit after first milestone (room + round working with 3 people)"
    - topic: "scoring"
      decision: "no points, no ranking — fun is the reveal and the conversation (FR-010 removed)"
    - topic: "round timing"
      decision: "no round timer; reveal when all voted or host/co-host advances at will; players see who has voted"
    - topic: "vote anonymity"
      decision: "votes are anonymous — counts per person only, never who voted for whom"
    - topic: "business rule (2026-09-20)"
      decision: "main rule = live round (same question for all at once, one anonymous vote each, reveal when the last vote lands or the leader advances, conversation happens immediately); supporting rule = question selection learning from all crews' play, bad questions withdrawn and sent to the creator"
    - topic: "product framing (2026-09-20)"
      decision: "web-app; medium scale (tens to a hundred users, no assumption beyond that); no hard deadline; after-hours work; 100x-scale question deferred by design"
    - topic: "non-goals (2026-09-20)"
      decision: "hard: never who-voted-for-whom; no points/ranking across evenings; no multi-curator/moderation; soft: no guest accounts in v1 (allowed later once the 'why' is known — PRD review 2026-09-20); no native app/offline; soft (v1 only, not forever): no other mini-games, no AI question generation, no in-app chat — evening summary and emoji reactions kept as nice-to-have FR-022/FR-023"
    - topic: "question pool model (Open Question 4, resolved 2026-09-20)"
      decision: "shared base curated by the game creator (new role) + per-game question list; host picks categories, reviews and edits the drawn list before start only; list lives in that game only (no host pool in panel); guests propose during the evening, host or co-host approves into this game's list; after the game all new questions (approved proposals + host's own) go to the creator for verification into the shared base"
  frs_drafted: 22
  quality_check_status: accepted
---

# Shape notes

## Seed idea (verbatim)

Gra imprezowa „Kto z nas najprawdopodobniej…” w przeglądarce dla ekipy znajomych grających na Discordzie, bez ograniczenia liczby graczy (minimum 3).

Host loguje się jednym kliknięciem (np. przez Discord), bez rejestracji i hasła; zakłada pokój, wybiera kategorie pytań i wysyła link. Goście nie mają kont: wchodzą linkiem i wpisują nick.

Runda: na ekranach wszystkich pojawia się pytanie z puli, każdy na telefonie wskazuje jedną osobę z listy nicków (albo pomija), po zebraniu głosów lub upływie czasu następuje odsłona (kto ile głosów dostał), punkty, następne pytanie. Rozmowa dzieje się na Discordzie, aplikacja wyświetla, zbiera i podlicza.

Pula pytań ma kategorie wybierane przed grą. Host dodaje własne pytania w panelu; goście proponują pytania z poziomu linku, host zatwierdza. Każda sesja zbiera dane o pytaniach (rozkład głosów, czas do głosu, pominięcia, reakcje po rundzie), z których liczona jest jakość pytania sterująca doborem: bez powtórek w sesji i z ostatnich wieczorów, częściej pytania dobre, rzadziej słabe.

Uprawnienia: host zarządza pokojem, pulą i historią; gość głosuje i proponuje.

Poza zakresem: inne mini-gry, ruch w czasie rzeczywistym, aplikacja mobilna, czat głosowy, konta gości, generowanie pytań przez AI.

Otwarte: zasady punktacji i remisów przy dużej liczbie głosów; definicja „dobrego pytania” na podstawie zebranych danych; czy pula startowa jest wspólna dla wszystkich hostów, czy każdy zaczyna od zera; jak długo żyje pokój i historia; czy zamiast logowania hosta wystarczy tajny link hosta (wtedy: co z pulą bez właściciela).

Opcjonalne, do rzucenia w sesji dopiero, jeśli sam uznasz: ocena pytania kciukiem po rundzie; statystyki ekipy między wieczorami; odsłona „kto na kogo”, nie tylko „ile głosów”.

## Vision & Problem Statement

Ekipa znajomych umawia się na godzinę na Discordzie, żeby zagrać w „Kto z nas najprawdopodobniej…”. Jedyne narzędzie, jakie host widział, to Google Forms: ankietę trzeba zbudować ręcznie, za każdym razem od zera, a pytania dopisywać samemu; zajmuje to godziny. Ciężar spada na jedną osobę, a gdy ona nie ma czasu, gra się nie odbywa. Ankieta asynchroniczna nie pasuje do wspólnego grania na żywo z odsłoną, punktami i rozmową.

Hipoteza hosta (niezweryfikowana wobec istniejących aplikacji): to, czego brakuje, to wspólna runda na żywo (każdy z telefonem, rozmowa na Discordzie), pula pytań z kategoriami i własnymi pytaniami ekipy, która zostaje między wieczorami, oraz dobór pytań uczący się z rozgrywki.

Dotychczasowa forma, którą gra zastępuje: kumpel wysyła link do ankiety, każdy wypełnia ją w swoim czasie, po tygodniu ekipa zbiera się i czyta odpowiedzi. Nowa forma: zbieracie się na Discordzie i wypełniacie w czasie rzeczywistym, rozmowa dzieje się od razu (jak kalambury przy stole, nie ankieta).

Skala (nota z 2026-09-20): produkt nie zakłada więcej niż około stu użytkowników. Zanim do tego dojdzie, host chce na nowo przemyśleć sens i skalę gry (m.in. weryfikację pytań przez jednego twórcę); to świadomie poza v1.

## User & Persona

**Host** (główna persona) — osoba organizująca wieczór dla swojej ekipy znajomych; dowolna ekipa, nie tylko ekipa autora. Kontekst: 3+ osób na Discordzie, telefony w rękach, około godziny. Moment: „zagrajmy w coś” — host chce w minutę mieć gotową grę, bez budowania ankiety.

### Secondary persona

**Gość** — uczestnik bez konta; wchodzi linkiem, wpisuje nick, głosuje, proponuje pytania.

## Access Control

- **Twórca gry** (operator; rola dodana 2026-09-20 wraz z modelem puli) — buduje i kuratoruje wspólną bazę pytań z kategoriami, z której losują wszyscy hości; po każdym wieczorze weryfikuje nowe pytania (zatwierdzone propozycje gości i własne pytania hosta) i dołącza je do bazy albo odrzuca. Jedna osoba w MVP (autor).
- **Host** — loguje się bez rejestracji i hasła; do wyboru kilka sposobów logowania jednym kliknięciem, zależnie od preferencji osoby (wstępnie; konkretna lista dostawców to decyzja późniejsza, poza PRD). Host jest właścicielem swoich gier: wybiera kategorie, przegląda i poprawia listę pytań na dany wieczór przed startem, ma historię wieczorów (v2) i prawo skasowania swoich danych. Nie ma trwałej puli własnej — pytania dopisane przez hosta żyją w tej grze, a potem trafiają do weryfikacji twórcy.
- **Współhost** — gość, któremu host w pokoju nadaje uprawnienia prowadzenia: start i pominięcie rundy, zatwierdzanie propozycji (trafiają tylko do listy tej gry, więc nic trwałego nie psuje), wpuszczanie spóźnionych, usunięcie gracza z pokoju. Nie ma dostępu do panelu hosta. Cel: wieczór nie umiera, gdy host wyjdzie.
- **Gość** — wchodzi linkiem do pokoju, wpisuje nick, bez konta. Może głosować, pomijać, proponować pytania. Tożsamość żyje w tej sesji.
- **Niezalogowany na trasie hosta** (panel, tworzenie pokoju) → przekierowanie do logowania. Link do pokoju działa bez logowania.
- **Później, do przemyślenia (nie w MVP):** nick „przypięty” w przeglądarce, żeby ten sam telefon proponował ten sam nick następnym razem.

| możliwość | twórca gry | host | współhost | gość |
|---|---|---|---|---|
| tworzenie pokoju, wybór kategorii | – | ✓ | – | – |
| przegląd i edycja listy pytań gry przed startem | – | ✓ | – | – |
| start / pominięcie rundy, zakończenie gry | – | ✓ | ✓ | – |
| głosowanie, pomijanie, propozycja pytania | – | ✓ | ✓ | ✓ |
| zatwierdzanie propozycji (do listy tej gry) | – | ✓ | ✓ | – |
| wpuszczanie spóźnionych, usunięcie gracza z pokoju | – | ✓ | ✓ | – |
| nadanie / odebranie roli współhosta | – | ✓ | – | – |
| panel hosta: lista własnych gier i kasowanie pojedynczych (v1 minimalnie, pełna historia v2) | – | ✓ | – | – |
| wspólna baza pytań i kategorie; weryfikacja nowych pytań po grze | ✓ | – | – | – |

## Success Criteria

### Primary
- Host zakłada grę (logowanie → kategorie → link) w mniej niż 5 minut.
- Ekipa rozgrywa co najmniej 10 pytań w jednym wieczorze bez awarii i bez sięgania po Google Forms.

### Secondary
- Goście sami dodali własne pytania w trakcie wieczoru.
- Po 3 wieczorach pytania są zauważalnie lepsze (ekipa to czuje).
- Ktoś spoza ekipy autora zagrał i dał feedback, że to fajne.

### Guardrails
- Runda przeżywa odświeżenie strony i wypadnięcie gracza; gracz wraca na swój nick, gra idzie dalej.
- Gość dołącza w mniej niż 30 sekund bez instrukcji.
- O gościu nie zostaje nic poza nickiem i głosami; host może skasować historię.
- Działa na telefonie w przeglądarce, bez instalacji.

### MVP flow (v1, locked)
1. Host otwiera stronę, loguje się jednym kliknięciem.
2. Host klika „nowa gra”, wybiera kategorie pytań.
3. Host dostaje link do pokoju, wkleja go na Discordzie.
4. Host widzi, jak goście dołączają; klika „start”.
5. Gość otwiera link na telefonie, wpisuje nick, jest w pokoju.
6. Na ekranach pojawia się pytanie.
7. Każdy wskazuje osobę z listy nicków (albo pomija).
8. Po zebraniu głosów lub upływie czasu: odsłona (kto ile głosów).
9. Następne pytanie. Po ostatnim: koniec wieczoru. *(bez punktacji — decyzja z rundy sokratejskiej FR-010)*

Zakres v1 (decyzja hosta po ujawnieniu kosztu): logowanie hosta, pokój, runda, kategorie, opcjonalny przegląd listy pytań przed startem, propozycje gości z zatwierdzaniem, dobór uczący się z rozgrywki, współhost, minimalna lista własnych gier z kasowaniem (doprecyzowane 2026-09-20 przy FR-019). Do v2: pełna historia wieczorów w panelu, nick przypięty w przeglądarce, panel weryfikacji dla twórcy gry (FR-021).

### Timeline acknowledgment
Acknowledged on 2026-09-19: 8-week MVP requires sustained dedication; user accepted. Szacunek roboczy, do rewizji po pierwszym kamieniu milowym (pokój + runda działają z 3 osobami).

## Functional Requirements

### Dostęp i role
- FR-001: Host can sign in with one click via an external provider, without registration or password; host identity is tied to the e-mail, so the same host can sign in through an alternative method (another provider or e-mail) when one is unavailable. Priority: must-have
  > Socrates: Counter-argument considered: "provider outage on game night or a host without an account at that provider locks the host out of their own pool." Resolution: amended; identity keyed by e-mail, at least one alternative sign-in path (second provider or e-mail).
- FR-002: Guest can join a room via its link by entering a nick, without an account; the room rejects a duplicate nick. Priority: must-have
  > Socrates: Counter-argument considered: "two guests with the same nick mix up votes; a leaked link lets a stranger in mid-game." Resolution: duplicate nick rejected (rare in practice — people pick individual nicks before the game); late joiners go through host admission (FR-020).
- FR-003: Host can grant and revoke the co-host role to a guest in the room. Priority: must-have
  > Socrates: Counter-argument considered: "co-host approving guest proposals puts someone else's decisions into the host's permanent pool." Resolution (2026-09-20, after pool model): kept — approvals land only in this game's list, nothing permanent; the shared base is gated separately by the game creator (FR-021). Co-host: run rounds, approve proposals, admit latecomers, remove players.
- FR-004: Host or co-host can remove a player from the room; after removal the room gets a new link and the old one stops working. Priority: must-have
  > Socrates: Counter-argument considered: "removed player returns via the same link under a new nick; removal mid-round leaves dangling votes." Resolution: amended — new room link after removal (host hands it to newcomers). Votes on/by a removed player mid-round: rule not decided → Open Questions.
- FR-020: Latecomer can request to join a started game with a chosen nick; the request is visible to host and co-host on every screen, including mid-vote; once admitted, the latecomer sees the current round and votes from the next one. Priority: must-have
  > Socrates: Counter-argument considered: "21:30, the host is mid-round looking at the question, not at notifications; a latecomer spends five minutes on Discord asking to be let in." Resolution: amended — knock visible to both leaders everywhere; entry from the next round.

### Pokój i rozgrywka
- FR-005: Host can create a room, choose question categories for the game, and get a shareable room link. Priority: must-have
  > Socrates: Counter-argument considered: "host picks two thin categories and the game ends after six questions; no count shown at selection." Resolution: kept as written; the question base will grow over a long time, showing counts is not needed.
- FR-006: Host or co-host can start the game, skip the current round, and end the game; a skipped question discards its votes without points and does not count toward question quality; ending the game requires a confirmation. Priority: must-have
  > Socrates: Counter-arguments considered: "skipping after some have voted wastes their votes and pollutes question data"; "an accidental 'end game' kills the evening." Resolution: both accepted — amended as above.
- FR-007: All players in the room see the current question at the same time. Priority: must-have
  > Socrates: Counter-argument considered: "a player on a slow connection sees the question seconds later and has less time to vote." Resolution: kept; there is no round timer (see FR-009), so delivery latency does not disadvantage anyone.
- FR-008: Player can vote for exactly one person from the nick list (including themselves) or abstain. Priority: must-have
  > Socrates: Counter-arguments considered: "self-vote skews results"; "abstain button pollutes data / is redundant without a timer." Resolution: self-vote explicitly allowed (it is part of the fun); abstain kept as an explicit choice.
- FR-009: Players see who has already voted (never for whom — votes are anonymous); reveal happens when everyone has voted or whenever host or co-host advances the round (players who did not vote simply do not vote), and shows how many votes each person received. Priority: must-have
  > Socrates: Counter-arguments considered: "counts without 'who voted for whom' cut the best part of the conversation"; "host advancing early causes arguments." Resolution: votes stay anonymous by rule (no 'who voted for whom', ever); host has full control and may advance at any time.
- FR-010: *removed 2026-09-19 — no scoring in this game; the fun is the reveal and the conversation, not a ranking (host decision).*
- FR-011: Player who refreshes the page or reconnects returns to their nick and the current round state, including a vote already cast; reclaiming a nick requires verification that it is the same person. Priority: must-have
  > Socrates: Counter-arguments considered: "someone else takes my nick while I am disconnected"; "reconnect without restoring the vote lets a player vote twice." Resolution: both accepted — amended as above; verification mechanism is a downstream choice.

### Pula pytań

*Model puli (rozstrzygnięty 2026-09-20): wspólna baza pytań z kategoriami, kuratorowana przez twórcę gry; z niej losowana jest lista pytań na daną grę. Lista należy do tej jednej gry — host nie ma trwałej puli własnej w panelu.*

- FR-012: Host can optionally review the drawn question list before starting the game (remove questions, draw more from the base, edit wording, add own questions); the default path is "start now" without reviewing; the list belongs to this game only. Priority: must-have
  > Socrates: Counter-argument considered: "Friday 20:00, six people waiting on Discord while the host spends 10 minutes polishing 15 questions — the 'game in under 5 minutes' criterion dies." Resolution: amended — review is optional, default is start now; a bad question mid-game is skipped (FR-006).
- FR-013: Guest can propose questions from the room link during the evening, up to a per-guest limit per game (number to be set). Priority: must-have
  > Socrates: Counter-argument considered: "one guest floods the queue with 12 proposals mid-round and the host clicks approve/reject instead of playing." Resolution: amended — per-guest limit per evening; exact number → Open Questions.
- FR-014: Host or co-host can approve or reject proposed questions; approved ones enter this game's question list. Priority: must-have
  > Socrates: Counter-argument considered: "an approved proposal lands behind 20 base questions and never gets played in a 12-round evening." Resolution: kept as written; where the approved question lands in the order is a downstream detail.
- FR-015: Game draws questions from the shared base in the selected categories only, without repeats within a game and without questions played on the host's recent evenings. Priority: must-have
  > Socrates: Counter-argument considered: "60 questions in 3 categories, the same crew plays four Fridays in a row and after excluding recent evenings nothing is left to draw." Resolution: kept; host's view: the base is small at first and that is fine, it grows over time. Behaviour when fresh questions run out is not decided → Open Questions (non-blocking).
- FR-021: Game creator can review, after a game, the new questions it produced (approved guest proposals and the host's own additions or edits) and add each to the shared base under a category, or reject it. Priority: nice-to-have
  > Socrates: Counter-argument considered: "in v1 there is one creator, and a review panel is another screen inside an 8-week budget when a list to review outside the app would do." Resolution: downgraded to nice-to-have — in v1 the app sets new questions aside for review and the creator adds them to the base the same way the starting base is built (outside the UI); the in-app panel is v2.
- FR-016: App records per-question play data that feeds the quality score, across all hosts' games: vote distribution (how concentrated), skips, post-round reactions, and removals from a game list by a host before start. Priority: must-have
  > Socrates: Counter-argument considered: "with no timer and the crew talking on Discord, 'time to vote' is noise (someone went for a beer), and four measures are four times the work of one." Resolution: amended — time to vote dropped from v1; only what the quality score uses is recorded.
- FR-017: Question selection prefers questions with a higher quality score computed from play data of all crews; a question with too few plays to be judged is drawn as neutral (or slightly favoured) until it has enough plays; a question that keeps being skipped, removed, or voted nonsensically stops being drawn and is set aside for the game creator to rework (feeds FR-021). Priority: must-have
  > Socrates: Counter-argument considered: "a new question gets three thumbs down because it landed on someone who took offence, the algorithm buries it forever, old 'good' questions play on repeat and new ones never get a chance." Resolution: amended — new questions get a chance before being judged; the play-count threshold is a downstream tuning detail.
- FR-018: Player can react to the question (thumb up / down) with a single tap on the reveal screen; the reaction is optional and never blocks the host from advancing. Priority: must-have
  > Socrates: Counter-argument considered: "after the reveal everyone laughs on Discord, nobody looks at the phone, the host taps 'next'; after ten evenings reactions cover 4% of rounds and the quality score has nothing to stand on." Resolution: amended — one tap on the reveal screen, non-blocking; host accepts that reactions will be sparse and the score also rests on skips and vote spread (FR-016).
- FR-019: Host can see a minimal list of their past games (date, number of questions, who played) and delete any of them; deletion removes everything tied to nicks (players, votes, results), while anonymous per-question aggregates stay in the shared base. Priority: must-have
  > Socrates: Counter-argument considered: "with no evening history in v1 it is unclear what 'delete an evening' even means; and if per-question play data already fed the shared quality score, either 'delete' rolls quality back or the button lies." Resolution: amended — a minimal game list enters v1 (full history stays v2); delete removes all person-linked data and says openly that anonymous question aggregates remain.

### Dodatki (nice-to-have, dopisane w fazie 6 przy Non-Goals; bez rundy sokratejskiej)
- FR-022: Players can see an end-of-evening summary with highlights such as "most voted tonight" and "nobody voted for X tonight"; no points and no ranking across evenings. Priority: nice-to-have
- FR-023: Player can send an emoji or gif reaction visible to the room during the evening; voice and text conversation stays on Discord. Priority: nice-to-have

## User Stories

### US-01: Ekipa rozgrywa pierwszą rundę

- **Given** zalogowany host stworzył pokój z wybranymi kategoriami i co najmniej 2 gości dołączyło nickiem
- **When** host klika „start”
- **Then** wszyscy widzą to samo pytanie; gdy wszyscy zagłosują (albo host przewinie), wszyscy widzą odsłonę z liczbą głosów na osobę, bez informacji kto na kogo

#### Acceptance Criteria
- Pytanie pochodzi tylko z wybranych kategorii i nie powtórzyło się w tej sesji
- Gość, który odświeży stronę w trakcie rundy, wraca na swój nick, widzi bieżące pytanie i swój oddany głos
- Przy 3 graczach odsłona następuje natychmiast po trzecim głosie; nie ma timera
- W trakcie rundy widać, kto już zagłosował, ale nigdy na kogo

## Business Logic

Aplikacja prowadzi rundę na żywo: pokazuje wszystkim to samo pytanie w tej samej chwili, zbiera od każdego jeden anonimowy głos i odsłania wynik w momencie, gdy zagłosuje ostatnia osoba (albo prowadzący przewinie), tak żeby rozmowa o wyniku działa się od razu na Discordzie, a nie tydzień później po zebraniu ankiet.

**Wejście i wyjście.** Wejściem są lista nicków w pokoju i głosy graczy (jeden głos na osobę z listy albo wstrzymanie się; głos na siebie dozwolony). Wyjściem jest odsłona „ile głosów na kogo" (nigdy „kto na kogo") i przejście do następnego pytania. Ekipa spotyka się z tą regułą w każdej rundzie, od „start" do „koniec wieczoru"; w trakcie widać, kto już zagłosował, żeby wiadomo było, na kogo się czeka. Dotychczasowa forma (link do ankiety, każdy wypełnia w swoim czasie, spotkanie po tygodniu) jest tym, co ta reguła zastępuje.

**Reguła pomocnicza: dobór pytań uczący się z rozgrywek.** Kolejne pytanie pochodzi z kategorii wybranych przez hosta, nie powtarza się w tej grze ani z ostatnich wieczorów tej ekipy, a częściej padają pytania, które dobrze zagrały u wszystkich ekip (mało pominięć, kciuki w górę, głosy skupione na jednej osobie), rzadziej te, które grały słabo. Nowe pytanie dostaje szansę, zanim zostanie ocenione. Pytanie, które jest stale pomijane, usuwane z list przez hostów albo głosowane „bez sensu", przestaje się pojawiać i trafia do twórcy gry na warsztat. Gra ulepsza się więc dzięki rozgrywkom innych ludzi, nie tylko własnej ekipy. Wagi sygnałów, progi „za mało zagrań" i „wycofać" są do ustalenia po pierwszych wieczorach (Open Question 7).

## Non-Functional Requirements

- Oddany głos jest potwierdzony na ekranie gracza natychmiast; odsłona pojawia się u każdego gracza w pokoju w ciągu 2 s od ostatniego głosu albo przewinięcia przez prowadzącego.
- Gra działa w przeglądarce telefonu i komputera, w dwóch ostatnich głównych wersjach popularnych przeglądarek, bez instalowania czegokolwiek.
- Pokój z 20 graczami głosującymi równocześnie zachowuje się tak samo jak pokój z 3 graczami (brak limitu graczy; 20 to poziom, na którym to sprawdzamy).
- Gracz, który odświeży stronę albo straci połączenie, jest z powrotem w bieżącej rundzie na swoim nicku w mniej niż 10 s, bez pomocy hosta.
- O gościu nie zostaje nic poza nickiem i głosami; „kto na kogo głosował" nigdy nie jest pokazywane ani możliwe do odzyskania, także przez hosta i twórcę gry.
- O hoście aplikacja przechowuje wyłącznie adres e-mail z logowania (tożsamość), bez innych danych osobowych.

Odrzucone przy zbieraniu (świadomie): automatyczne kasowanie gier po 30 dniach (host kasuje sam, FR-019), zobowiązanie do braku przerw serwisowych w weekendowe wieczory.

## Non-Goals

Funkcjonalne:
- **Żadnej odsłony ani zapisu „kto na kogo głosował", w jakiejkolwiek formie** — trwała zasada gry, nie „na później"; aplikacja nie ma zbierać, że gość X głosował na gościa Y, ani razu, ani 200 razy.
- **Bez punktów i rankingu między wieczorami** — zabawą jest odsłona i rozmowa; jednorazowe „podsumowanie wieczoru" (FR-022) to dodatek, nie tabela wyników.
- **Bez kont gości w v1** — gość wchodzi linkiem i wpisuje nick; nick pamiętany w przeglądarce to v2. Konto gościa nie jest zakazane na przyszłość (decyzja hosta przy przeglądzie PRD 2026-09-20): jeśli ktoś chce, nie zabraniamy, ale najpierw trzeba ustalić, po co gość chce mieć konto (Open Question 9).
- **Bez innych mini-gier** — jedna gra; inne tryby najwyżej po kursie, jeśli ekipa i inni hości polubią koncept.
- **Bez generowania pytań przez AI w v1** — nie wykluczone na przyszłość; wcześniej host chce zrobić research, jakie pytania działają najlepiej (Open Question 8).
- **Bez wielu kuratorów bazy i narzędzi moderacji** — jedna osoba (twórca gry) weryfikuje pytania; żadnych ról moderatorów, zgłoszeń, banów.
- **Bez czatu głosowego i tekstowego w aplikacji** — rozmowa jest na Discordzie; emotka lub gif do pokoju (FR-023) to dodatek, nie czat.

Niefunkcjonalne:
- **Bez aplikacji mobilnej ze sklepu i bez trybu offline** — tylko przeglądarka, tylko z siecią.
- **Bez założeń o skali powyżej około stu użytkowników** — przed wyjściem poza tę skalę host chce przemyśleć sens gry od nowa.

## Quality cross-check

Run 2026-09-20. Access Control: present. Business Logic (one-sentence rule): present. Project artifacts: present. Timeline-cost acknowledged: present (8 weeks, accepted 2026-09-19). Non-Goals: present. Preserved behavior: n/a (greenfield). No gaps; status `accepted`. Open Questions 1–3 and 5–8 remain genuinely open and are non-blocking; `/10x-prd` should carry them verbatim.

## Session log

- 2026-09-19: phases 1–3, FRs drafted, Socratic round for FR-001…FR-011.
- 2026-09-20: pool model resolved, Socratic round completed (FR-012…FR-021), Business Logic, NFRs, product framing, Non-Goals, cross-check accepted, project named "Most Likely To". Shape complete; next step `/10x-prd`.
- Working style that worked: counter-arguments as concrete scenarios ("Friday 20:00, crew waiting, Discord down"), host answers in free text, not only options.

## Open Questions (running)

1. **Czy istniejące aplikacje „most likely to” już rozwiązują problem przygotowania?** — Owner: host. Sprawdzić 2–3 gotowe aplikacje przed budową; jeśli któraś daje pulę własną, rundę na żywo dla ekipy zdalnej i uczenie się z rozgrywki, hipoteza wglądu wymaga zmiany. Block: nie, ale wpływa na Vision.
2. **Kto w ostatnich miesiącach realnie organizował te wieczory i jak często udało się zagrać?** — Owner: host. Kalibruje, jak często panel hosta będzie używany.
3. **Co z głosami oddanymi na gracza (i przez gracza) wyrzuconego w środku rundy?** — Owner: host. Propozycja do rozważenia: głosy przepadają, odsłona liczy się bez niego. Block: nie.
4. ~~**Model puli pytań: ile poziomów i kto zatwierdza?**~~ — **Rozstrzygnięte 2026-09-20** (patrz `## Access Control` i wstęp do `### Pula pytań`): wspólna baza twórcy gry + lista pytań per gra, edytowana przez hosta przed startem; propozycje gości zatwierdza host lub współhost do listy tej gry; po grze wszystkie nowe pytania idą do weryfikacji twórcy (FR-021). Czwarta rola: twórca gry.
5. **Ile propozycji pytań może wysłać jeden gość w jednej grze?** (FR-013) — Owner: host. Liczba do ustalenia; propozycja z rozmowy: około 3. Block: nie.
6. **Co losuje gra, gdy w wybranych kategoriach skończą się pytania, których ta ekipa jeszcze nie grała?** (FR-015) — Owner: host. Host uważa, że mała baza na start to nie problem (baza rośnie), ale zachowanie w tym przypadku nie jest opisane. Block: nie.
7. **Co znaczy „za mało zagrań, by oceniać” w FR-017 (próg liczby zagrań) i z jakich sygnałów FR-016 liczy się wynik jakości?** — Owner: host. Kierunek: pominięcia, reakcje, skupienie głosów; wagi i próg do ustalenia po pierwszych wieczorach. Block: nie (szczegół reguły, nie sama reguła).
8. **Jakie pytania „most likely to" działają najlepiej?** — Owner: host. Research poza aplikacją: artykuły, badania, istniejące gry; wynik zasili bazę startową i ewentualnie przyszłe generowanie pytań (poza v1). Block: nie.
9. **Po co gość miałby chcieć konta?** — Owner: host. Konto gościa dopuszczalne po v1, jeśli ktoś go chce, ale dopiero gdy wiadomo, co ma dawać. Do rozstrzygnięcia przed jakąkolwiek pracą nad kontami gości. Block: nie.
