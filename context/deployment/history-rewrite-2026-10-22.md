# Przepisanie historii repo (materiały kursu)

- **Co:** z całej historii publicznego repo zniknęły materiały kursu 10xDevs (paczki z `10x get`: 39 skilli w `.claude/skills/`, `.claude/prompts/`, `.claude/config-templates/`, `.claude/.10x-cli-manifest.json`, `.10x-cli.json`) i blok kursu w `CLAUDE.md`. Reszta plików w każdym commicie bez zmian, a drzewo `main` przed i po przepisaniu jest identyczne.
- **Kiedy:** 23.10.2026. `main` na GitHubie nadpisany (`1c7a191` → `446f143`), pozostałe gałęzie na GitHubie usunięte.
- **Dlaczego:** rada pod pytaniem na czacie kursu („wyczyść historię i dodaj do `.gitignore`”, z +1 organizatora). Lokalnie materiały kursu zostają poza gitem (`.gitignore`, `CLAUDE.local.md`). Plan i decyzje: `context/archive/2026-10-22-course-materials-purge/plan.md`.
- **Jak:** `git filter-repo` (`--invert-paths`, `--replace-text`, `--preserve-commit-hashes`, `--prune-empty never`, `--prune-degenerate never`), więc każdy stary commit ma dokładnie jeden nowy. Przed publikacją każda para sprawdzona: różni się tylko plikami kursu i blokiem w `CLAUDE.md`, a autor, daty i opis są te same.
- **Przyjęte ryzyko:** stare commity zostają dostępne na GitHubie pod starymi numerami i przez strony 16 PR-ów (`refs/pull/*` są tylko do odczytu, a GitHub nie usuwa danych, które nie są tajne). 18 commitów (16 scaleń PR-ów i 2 commity z sesji w chmurze) straciło znaczek „Verified”.
- **Stare numery:** w `context/` (także w `context/archive/`) i w opisach commitów zostały stare SHA. Tłumaczy je mapa niżej. Kopia zapasowa starej historii jest na dysku właściciela.

## Mapa numerów

216 commitów, od najstarszego: stary SHA, nowy SHA, pierwsza linia opisu. Ostatnie commity gałęzi `latecomer-admission` (`1153156`) i `keep-supabase-awake` (`6842913`) są tylko lokalne, nigdy nie trafiły na GitHuba.

```text
237a2970704e4ec641b1264c3ab15e2498f98202 ab7bc1b2060ec3e5c318ef0f580d5889b2a2263b Initial scaffold: 10x-astro-starter + course context
850bdb76d4ed32ac5e0c1f1a7d01f66e7442202d a02a4c39209bb1809c7adbbbf32053dbc96ecc57 Add Claude Code permission policy from M1L3
1f3811185d4b1b5feb07acec2dc342c50c960899 6a83b91fe67504516f37649b9efa4faa6b71f03b Add M1L4 lesson package (10x-agents-md, 10x-rule-review, 10x-lesson)
fe7a8f9323d3fd08ffc1093566c3d34883cfa562 15c6dbd2659fc6e736ad23fca555536d6f87b483 Tighten agent permissions, run CI on main, drop scaffold rules
a691ed4df931eca2493d3172cd8b913970467e33 0dbbc09c5912d7978aa426dcae7c149c975a6fa6 Add AGENTS.md project rules and import them from CLAUDE.md
00212eebcc92ca8cf2a9e927cef93483b4b53cec 90f7ead3726c7664308902ba33e160cbb7b33458 Move cn() to the shadcn cn package
16bc76f302874c1703edce7a72f1693eecbb0cc8 e70c72c42a59fe202d6490d537682131c9fb6667 Drop AGENTS.md rules the A/B test showed redundant
b3bff8889e50faef89a77fc985e88a70c0a0f2a7 72cc50ed5823a208c960ef7a4f587d61e29bd629 Add first lesson: ask rules for deploy and database wrappers
4c36f5c226910a569eca60304ddacdb53207e909 a1feda38de961b996b086511b1bdd5cdacb7672a Add M1L5 lesson package (10x-infra-research, deploy plan prompts)
52a479941b35af7ad2c22ff3d49ea4938a394806 2debaf47e31fcbc9c5d5c24dc27f89a0f9c3beed Record Cloudflare Workers platform decision and gate rollback/delete
52a452091eb4ef7642d1adc1d60153dc51e365ea c7374cbf1bc1f387aecbd5b280929bc0d9f00f40 Add first deployment plan and name the Worker most-likely-to
800c10d4d31a19f32426ac43c688462bdb09dd04 0b9499bad0150ecd5b39cb317d3b17c512799538 Link the production URL in README and note Workers Builds deploys
335c3e53f97522181f7935c5519bf399eaa59a8c a67e6e6b4b58f9ed6a25467020ba3306951fbd72 Record first deployment status in the deploy plan and AGENTS.md
9f4238ef0864235c49d70975b7f104d8eed4b2ea 91a4a3b205350327bf3b239d871f65efa1cfa318 Mark the M1L5 badge as claimed in the deploy plan
8b95a0951f0d96845436e6d1a092fe536d1e804f 64893673576f399eca556ea52a3effb60a5942e1 Add M2L1 lesson package (10x-roadmap)
7d66ca8f53752de51ed8006fda025ddcd92aeeea e6e2545b62107ff38638c27e47532bf7ce5b4633 Add first-milestone roadmap and keep v1 Polish-only in the PRD
4f41acec3cf4487d072b29d7e0a733faa1310d61 e0bca91f6390f83c8c1b10da83e37a8c5afbda2a Keep course agent skills in .claude out of ESLint
71a400442b525118d505971e0dc1df9a2f82268e 5daab115634de35e2dab1a5cddf1a4d3057701fb Add M2L2 lesson package (10x-new, 10x-plan, 10x-plan-review, 10x-implement, 10x-archive, 10x-status)
18292da6e982d7c8ae0d3a1beaf428a2dfdadfd3 9aa1b22045afea6f12893dd61a7480246c85b9a6 feat(starter-question-base): szkielet bazy pytań (p1)
6069e39108803e1cf01c6e0beca59d8ed89ce95b 0e45318d7e9eabe4b62d1f5c36641f2673a260fd docs(starter-question-base): szkic pytań i przegląd Karola (p2)
a818518a4e1fc0146afc86b6fabd3f607e71b5c7 5ac45fbb0f4230d56869fbd803a39ad900ac063f feat(starter-question-base): baza w kodzie (p3)
b29ce02bec558401f40204b9c09e847db510cdd0 2c74b8bb75f92fc958e0de60b2ef5b1da366416a chore(starter-question-base): close out plan (epilogue)
c1c4cda55f5abd19e5d26494aa3515185521460c 78b96407f6015a8b8492af2d2eb87a68372369a9 Add M2L3 lesson package (10x-impl-review)
eec2d8d38b72f3d3fc480e1d1c0c647ebb78d4e1 7ad23f550275b031ced14815007e851591b6ac4d fix(starter-question-base): poprawki po przeglądzie kodu (impl-review)
95e22ed8212fc056f793a2c83cc311ddc8e90103 a99725e79ccbb2a2db0c90aff51aac9c20270b98 docs(agents): doprecyzuj regułę o context/archive/
ce22a1a2ac9e8850bda92f5ca69a0659c8dae00e ebc4c484f5b8214bf28f57a1402bca67b2849b0a chore(archive): close starter-question-base
8f3ad5a892c972c0e6d77b44ec02f03488f46266 22464a5ca499e9969ba2842016ae5cfddb242c75 Add M2L4 lesson package (10x-research, 10x-frame)
793454af755ad808a767a9a04a9613fa1224af61 05de4c8b34b0d55134b0553a0d992366f07bef63 docs(live-sync-spike): research i plan F-01
21a17cf8b9dacc495a10ed582437d0ec2e57a52b 22d7c262c0719848bcde3b5c69d6df6dbef2fa2c docs(live-sync-spike): przegląd planu F-01 i poprawki z triage
7bcb4ea706b4679c3a91c757fc120ab8323a67e1 dabe21ca6a73162199ea44ff570906f62bb010ff chore(live-sync-spike): Zasady, uprawnienia i zależności (p1)
e3a055527aac2ee2e013c2ecdd4ed8264edbfdb5 cd48160e29a67e4a898f4c7d97895ad62f4e9279 feat(live-sync-spike): Dzwonek i tablica (serwer) (p2)
af8e69c7ab2dec1611d3b957c92007cadb1ce9af df3c1349d2e857e454b3217ad13398b78adb72c2 feat(live-sync-spike): Strona demo (przeglądarka) (p3)
3a8ad3fb56457736234e322ea0c89c24a00fd62a 2e94a74aa5a2ecd07e8af4967351da7e0be13496 feat(live-sync-spike): Sonda i pomiar lokalny (p4)
3746df6c6e880ba1521b0e974d0005d800e477cb a5681926dca5832341ca0194b31392d574f05654 fix(live-sync-spike): poprawki po przeglądzie implementacji (impl-review)
7c8675c4a023eed364158fa4e08928398019acea e9986750805f2538e8195e1523e5131065c82b5e docs(live-sync-spike): Produkcja i telefon (p5)
7d6c44bdb11344b2f2a5759135e1000137fae9dc 122c388668357536cf69f96a2859f4b2364a3c33 chore(live-sync-spike): close out plan (epilogue)
1bebcdb7c4ee3788d2b018d42801602ef9465ab3 774c9571b282a7e5b4bcaa26a51e08d8ca993cd8 chore(archive): close live-sync-spike
fa73ca17bab419d1345886105ebd8874ffce2dda 7ef8418eaa8d47c7e83d9249e63fb388dc3528bb docs(lessons): po poprawkach z przeglądu uruchom zmieniony kod przed push
2442ccf6750c8a38e10f3a0edf0df7f47c2b4cf9 131a5edaf4cd34b660afcb6861f21415157aa35c Add M2L5 lesson package (10x-ui)
bb90b7fd59d376ebc4b6a8768288ba94583f4ff2 ee16bbcce0a63f6436dbf30bf456bfe491a4dbe2 feat(ui-signin-contract): Klocki i tryb ciemny (p1)
77c380f67b044831bab9fda86215d77cb4589324 034cb6d041e80aeb53f1caf7256f8e7695061f4e feat(ui-signin-contract): Logowanie na tokenach i klockach (p2)
123f775af1993b1fff315bdd88841e8c9b142bc8 2e28d6667574406ca1c7bc97198cf2421215c74a feat(ui-signin-contract): Paleta gry (p3)
559c72f981987a68cfdcc610e1b493b8aabf73b2 de348e55ef2993552044bad5c79665fe1985e290 feat(ui-signin-contract): Stany i błędy (p4)
9e713f726691b8de9f4db6f54ddc9fa37b132c60 2c86c8cf9358c34aa4815320577fd644a98cf6da feat(ui-signin-contract): Zabezpieczenie: reguła UI i skan (p5)
b43dbb7a757b0477d1826e2d2889aceba72e23c7 70e8c5c40a4f06d6812767f2faefaf1de999e32b docs(ui-signin-contract): Zabezpieczenie: sprawdzian i liczby (p5)
35b4479080b61d09b290dbb0f3cbe47cf38233d5 9ebaaaca1f62215a1d70bc6dba2611c0499d2472 chore(ui-signin-contract): close out plan (epilogue)
337df5cb51c9ece742247355855e5c4282ca4885 083252bb6be4577be552bc67d0f5f021817c8810 fix(ui-signin-contract): poprawki po przeglądzie implementacji (impl-review)
37b017de6495560a17262e86a1ffe16dbedfbe61 b7947f84b497be0ab43fd986088fa755e2116409 docs(ui-signin-contract): wynik z produkcji (smoke 8/8, kitchen sink 404)
fe959b327155ed1b1eb20769af7e06248e15e542 81f274f34fabaebb80e8b8eb2f8bd51114d239ad chore(archive): close ui-signin-contract
bc5867c1ceb3561cb864e302f22e667a360a5146 552427d7587509b340b703731cb6e0617a0f8531 chore(one-click-host-login): Porządek w Supabase i stałe konto testowe (p1)
713972fd3176ed93b4dcac41576113a81b66f817 7f0fe0f8840ba3e12bc3b67c13b92b5fea1ffc1a docs(one-click-host-login): SHA fazy 1 w Progress i decyzja o koncie hosta
119ec8cf4addd0ba2d9b29c9367aa05371c93bc9 46d2650f0bb95d88f80aa8287e5cb89a4f484088 docs(room-lobby): research, plan i plan-review S-01 (pokój i poczekalnia)
6dbfedd1a27643490b4936788945c61806230a7d 638e5383b5ab286d839bea96bdad178224c5706c feat(room-lobby): Baza na produkcji (p1)
618dee8d919260a3be8f34cd1001eb05e330b353 8e664baab208e333430195ff584428b7f4397d48 docs(room-lobby): wynik fazy 1 i SHA w Progress
77860b811ecda1a9b5ba9e88f8aa221e477a201a 114d91ce1922951de33798db85dc013fed36837b feat(room-lobby): Host — nowa gra i pokój z linkiem (p2)
71d2d9b2b805fb31b974b02dbfe16fa56e9e71d8 b19d5d1531e905d61366a4622ee1ea0759ce7581 feat(one-click-host-login): Logowanie przez dostawcę (serwer) (p2)
1c42d52d0fe79236dcad46b8b6a5fe02c47e16e6 7588972dad4d55ce482dc2393fe07b2713135e3e feat(room-lobby): Gość i lista na żywo (p3)
1bcdb9d992123cee7253d3574b040ea452521c05 c79e00e5eb84ab8d340f369dc107ee0ece8ec770 feat(one-click-host-login): Ekran logowania i porządki (p3)
2c27324e0648bc49dff958211ebc446fcb51ff0b bfaf5984766968cd2839d5e97dd02fae5e0e32df docs(one-click-host-login): SHA fazy 3 w Progress
1a40af44a8e3f00cb689ce628b0d876bfb9c1548 06a1eecf099dfeea7749c6265e7d69a0138e7583 Merge pull request #2 from CharlesOnTheWave/one-click-host-login
6429f75818b2ef38a1bcb479111749d7e8dc7d0c f506c3a42bfda07dab6312eee3fae4107a85072e feat(room-lobby): Ekrany — stany do oceny Karola (p4)
89b966d862fdc3067c41ad0a48c05bfe2a968635 6b863184076bb08111d523058635be7ce4f239b0 Merge origin/main (S-05 one-click-host-login) into room-lobby
6721ed30a22287b187df2edf0e15a456e0f4fb26 2c65956b01e12b4ddbf19d2b6ea317dee8604c94 docs(one-click-host-login): Produkcja i test na telefonach (p4)
f69679e33692334d692971e45a861e798909b462 c415cf3e923abc4148a65162ac33568207ff5d52 chore(one-click-host-login): close out plan (epilogue)
95baf937cd1e3ef0efe780ec9977598039d275d3 a57f8aed58eb3c1c0a9f8457b0f42c7634bd1a5d Merge origin/main (S-05 docs: phone test, epilogue) into room-lobby
adba7923aed8943f088ec3de3f5a81a7a1f9aa31 fff29bcc4ff12d90ad2d17c4682e42f168882b00 feat(room-lobby): Fokus błędu serwera i README przed PR (p5)
f6764a18ee714a233ca4c170c1f2a361b2dac03e 1562d5a2c0b142f935b938061e014497f79b3cc7 fix(room-lobby): Poprawki z impl-review (p5)
ecbf2118d8ce6e228d542c1115cdb885ff64932a 28529daad99672d051b9e9fcc3052bcef6cbb926 Merge pull request #1 from CharlesOnTheWave/room-lobby
bb1240f65ab67e335212a55f7f5b9971e1ecc86d f7a27c63a06a28518915d5bf8bfff3ccc6880783 docs(room-lobby): Produkcja i telefony (p5)
8b5ac35a2a75984fa359646a85624ca350d1dbac 6b6804aac78b1470b7973ead5da14595658ab2a4 chore(room-lobby): close out plan (epilogue)
90136b235519008fcb2fce55bd5909ad0e9cf584 fbbf3150b594bf19dcc21ecdec8a8295e4e91ddc chore(archive): close room-lobby
957bb6d30ad84eda6404caf83812de0559fb2719 4823cfc7ebdd25c76c495573ba20a5971ce2b22c fix(one-click-host-login): Poprawki z impl-review
066365abff7410571a76170215bc287e9ee82450 5986322a8af80dd04733a3500ec78e526cb52fbf chore(archive): close one-click-host-login
9cf1bec8cc1f74602a7c3c609f7ac7be4034759d 6019d675ac41e9cbc10e114e0b393eb532ae5b52 docs(deploy): Wyłączone buildy gałęzi w Workers Builds
ef568fad80e99ca7406c1be18edf725541b823f5 d707ec47f9f828ba4df82c17d8c9b3a44f1b0302 Add M3L1 lesson package (10x-test-plan)
3ffff4ff93595526736aa262f658538242c2ec6f 94c80326e40707a92c63139263a55ee7229b91bd docs(test-plan): Plan testów M3L1 (mapa ryzyk, 4 fazy, bramki)
4cb6fa435138ef7431efca132aefc09b7b775900 0640313ee725f2cbc87224e12a0b70d906142e18 Add M3L2 lesson package (10x-tdd)
4c50599ce5ca05d28f65afd88531068327455a4c 1663da4c621724e5653f2f87489a2a5540acc61a chore(testing-lobby-foundation): Runner i potok testów (p1)
a0c12d1dcee4f572bf4047b9bb328dff52074a74 3c4b137a9479eeeed31889df07ca4e11c2d2f5b6 chore(testing-lobby-foundation): Role — strażnicy i znane dziury F1 (p2)
694f876c1b9941ed3d632ea1162df6530714ff10 f7ed952acf8546802fab9dc686cc2b14bdf91811 chore(testing-lobby-foundation): TEMPORARY break-check, otwiera 3 uprawnienia (p2, do cofnięcia)
4f4d9fbf06e000461eb179a5543de3c6d82d58bd 23c78f0d6d407c6a2064715ca94e067f465fe438 Revert „TEMPORARY break-check” (p2)
0174ff0831f3d443efef45778990d26c787c90c6 77aacf3b7d4c98e1f945a861b71822c443119364 chore(testing-lobby-foundation): Stała wersja CLI Supabase w CI, zamknięcie fazy 2 (p2)
2f566bf2d1b71a386f532c5ba6d30efaff36df87 1107e24e95a9960380cc2a9cb3700374c236da00 chore(testing-lobby-foundation): Nicki i wejście gościa (p3)
566a0a00c57224eac561a4084d73ea3609fda568 e23c1717581c01dc97c1ed67bf8f0cac675936ea chore(testing-lobby-foundation): TEMPORARY break-check, link ustawia ciasteczko gracza (p3, do cofnięcia)
fa5875234273ee9797ec1bb34cedd6ab32202739 fdbc6693689f16bee2cf41e72db994a42214cfcc Revert „TEMPORARY break-check, link ustawia ciasteczko gracza” (p3)
21a4debaa1251059551c424baeef452f049f0017 fd5b3532a63347796cf48497c6f8288bf01352dd chore(testing-lobby-foundation): Cookbook testów, reguły i dokumenty (p4)
5c9203052d26cb61b15ad44c23f6c99eab5b7436 6769aa04aef841ac169bcc48b6220cc2f98ab9d0 chore(testing-lobby-foundation): Poprawki z przeglądu implementacji (F1–F8)
12229d11dfc5867e0cc5765b717e0491cc3fcb8e 35b15d18c9552d6c6eb7931e152c64398b74dc42 Merge pull request #3 from CharlesOnTheWave/testing-lobby-foundation
48ffc79c1109f63a84d8eec43d61a17adc872188 48ba5ddbd69f297c00f13cf872fe3688002d1552 chore(testing-lobby-foundation): close out plan (epilogue)
0ae2de0f944d107a41ce9fdf5e4e6dc639728ec7 16951c491db44500949462c525d7d170c95ea9ea chore(archive): close testing-lobby-foundation
a6f14416f4504dfaf3c5578d71b5fe03e214b5de 0683022ea7c7354d93a44860f7a4b6682606a249 Add M3L3 lesson package (10x-configure-hook)
ada6b4e347c13b9c5096f5b2696012fa1b77500f 3e1e306d1480da756952c82d63a6d2d7f9725d11 Agent hooks: lint and related tests per edit, end-of-turn sweep (M3L3)
ed74845ee8ae895550d276729054286b2035aef1 f0ded002e5f6e4e51f8f69420300894b281f76ab Merge pull request #4 from CharlesOnTheWave/agent-hooks
13f64b9392d6e983fa0f32eee199fc2a89bfa4f9 4826b78700b3fc007e2949514c86516f7af80c0f Add M3L4 lesson package (10x-e2e-setup, 10x-e2e)
99cb9a3ecb2c6ea0a9eda0f59d55856d4959f87f f714acea59d8ae390962ac9cffcb75d32713f439 E2E: Playwright setup, lobby seed test, CI job e2e (M3L4)
3acab472ac2def8016b2378db57d569df70f1999 942a2721e3ab872ba472a2b46e071d58b7364c1e test: risk #2 lobby connection-drop e2e
0885f9d7c7e2ac27b9b44b144308a1de3835f5e4 31308ff95d480f008ccb23771f625e572bebfe77 temp: run the e2e suite twice in a row on one database (revert before merge)
9f669fcbc82e5b82773527ee865aad04986f922b e844c2e60ecc58919d0342e8514cfad809359928 Revert "temp: run the e2e suite twice in a row on one database (revert before merge)"
8278677f795343cbdc5f8ddff2a12d2e6e4843a0 9b858f072cd0d98a4c0a6b0a5e04df1e07de3edf temp: break-check B1 — no bell after a guest joins (revert before merge)
4a4ce82d7404845b1977c314f017c8ca42756497 ef5d8fee064f7d8dfd9831f78bf445f3b06a4295 Revert "temp: break-check B1 — no bell after a guest joins (revert before merge)"
123497ab3e00c741721f6fe9aaa4490d28e70990 59bca839aa5dcfa8d499d40f5cc7cf4d53a12906 temp: break-check B2 — a rejoined channel does not refetch the list (revert before merge)
171c101af46b7e4cc31a006b77e5abfd797ef29c 5bc3f924e2cf9e083d87fa58a6ccd56d05eeb5c9 Revert "temp: break-check B2 — a rejoined channel does not refetch the list (revert before merge)"
e200a64d52a9ba89c5afbbb71599e29a4064c1cf f899e519a43c8499c50555714a75eefc3b1b35ec docs: E2E in AGENTS.md Testing and test-plan §4, §6.4
03351fdf566ccb4fd204903c4a1fcca583d8bbd3 f6ea4066b8f1ff0fcc4c1bdf56332b68d1530a96 Merge pull request #5 from CharlesOnTheWave/e2e-lobby
c32deb94f44dfdac59268f69d0575b6cd45af4db dc65d643613e92b00f373b8e4537788797707f2b Add M3L5 lesson package (10x-observability-audit)
89d6d1543c879c8091fc0f84e4ed7f9fc0f5d770 3ff78893cdc4e7af4deb0dd9c12db8dcd85e22c3 docs: observability audit of guest join and live lobby (M3L5)
d4bff27a9520a4ce3c456da13faa5385c767811c 26844054d271b038ff2ed6992b9293603c009754 fix: log Supabase Auth failures in the middleware instead of dropping them
0a9b6a634a6b5248d0293bb4d333b308bd93894e 9545bcdc65cb4a8c4ad032473a02eda0fcc23f20 Merge pull request #6 from CharlesOnTheWave/auth-error-log
06c7921c5db35c3e8275a49159cf59d185fb4e4c ba7bb7093be2fd3d5f2519d5764b101f00398b73 docs(first-live-round): research, plan and plan review for S-02
ebcb9c5c1c75cd49fe77b3017687ac4f48c63936 3508605f1dc1012c8341e0cba4a2ea031a3d8de6 chore(first-live-round): Zasady i testy przed kodem (p1)
4fedd342d00e453c6d93e2c7b72eb7e1c8debdb7 cc6221aa809ac1bdbc2ad54faa0524bf38a8adc5 feat(first-live-round): Baza: urna, stany gry, domknięcie F1/F4 (p2)
90e3b7cd1a2eae83886fc3174b2ece1d967eafaf 0920d4539ab61467da926bc25a9741f74483ec02 feat(first-live-round): Serwer rundy (p3)
b5a753e3feb2abc180a95bb6f8ba238a3bcd671e b555be4cba2d574dc670447f873dbbbc8cdb23cc feat(first-live-round): Ekrany rundy (p4)
745d9d55444fbbfac32ad71ffa729bbb068fa1cb 970ccfe02c9dd51aa8c53b76f771c1bdc751e843 chore(first-live-round): Test w przeglądarce i smoke z rundą (p5)
886ab9e03a8c49dc888f6fb6cf86e2190b99235c 7979beda6e0648eff35a715cfa0038d55ed40862 test(first-live-round): TEMP break-check (a) — urna logowana
16a72cf8f14bf02ed5e7ccce9a1df47510432d2f c95d54d00bb052e9a40adcf28284dde00dedfb2e Revert "test(first-live-round): TEMP break-check (a) — urna logowana"
7429a99e511c25746181a4bcbe2d9ee5df55295d 5e80998c371cf675e859bd378dd821fd74c88e9b test(first-live-round): TEMP break-check (b) — głos zwraca liczbę
cc0d07a12100d5e763216ceefedcd2a75c7fc507 622d85b3e971bff751ca19304fca98972aa3c39a Revert "test(first-live-round): TEMP break-check (b) — głos zwraca liczbę"
7bf6b088dc2a47011286fbfea6d383a7f561b355 0b8582a3ae7abb0c39e334c690ea490c612d3525 test(first-live-round): TEMP break-check (c) — ekran odsłony pokazuje liczby +1
ff9476298b945c9331c1e858cfa3f069c9c19ea8 457f0bd6e010487fd79ba7b9dc5923a8edf8c878 Revert "test(first-live-round): TEMP break-check (c) — ekran odsłony pokazuje liczby +1"
009ad52fccd29746a39f24177d4a19e3ca331562 59483abb0415581e2fd3d424e1f6a83712c27740 docs(first-live-round): Wyniki próbnych alarmów w planie testów (p5)
f5f046b19f3ec7de90a76176cbc61812534de602 0ac2db94eb8cbc1beddc1b7f2114e2621b900d70 test(first-live-round): Ustalenia przeglądu jako testy, przed poprawką (p6)
236afc33c7a38cda0daeedbbf1b67ec167ba1763 deea4eb2d56edf6aaf9218b5a5cc04884a165f42 fix(first-live-round): Głosy po awarii bazy liczą się w odsłonie (F1 z przeglądu)
a375be3dd144398bd7a98a1e2b7655e201d24593 bfc19dc2b8e11d68420bc9095ffc4679fbc89d7a Merge pull request #7 from CharlesOnTheWave/first-live-round
1ea3edf32093ef7be932cfe1267589f5eaed671b a74a31455f28053ec32a42a6cf2e82bc0f8b0535 docs(first-live-round): Wdrożenie na produkcję i notatki fazy 2 planu testów (p6)
66d8e09fec93b6443d67791979a7f509c9e74d04 50eb23c5568432d25fc4ee06b1180cc50fa4cd72 chore(first-live-round): close out plan (epilogue)
85cc9238db8165f790da003369dcd422f5bb22f7 8e8900e5b39b2f26f02e661bb028e2cecfc48a93 docs(first-live-round): Cron close-stale-games działa na produkcji (6.8)
f1ed6ff93361c546d8c76a9b0b4121a14f9ea55a 5c062d7f139d130fa143bb43d616f01fdc8c49b0 chore(archive): close first-live-round
4738dfff0a4f53c92d57c8f86803a752bbaac703 68db9e3506228e0c1e0cad398697d1755bbb6fcb docs: Ścieżki do zarchiwizowanego first-live-round w AGENTS.md i planie testów
08e02aa13fe9f497e59affca786b86c968b58c8a ac7659311648a3a7451b9a673ece86ee2dd1eb75 docs(full-game-evening): research, plan and plan brief for S-03
5f3e40cd9de1aedfc54cf2b9c328f94f39afb99a 39bd1ea3551e0631680e5cec05a511cb159f275e chore(full-game-evening): Testy przed kodem (p1)
ecb290d5d90bd962965cd6652f8a7fe735c425d8 4107448e4f54ad5016815958fa35e2062d536d25 feat(full-game-evening): Baza: kolejne pytania, pominięcie, koniec gry (p2)
250746254c33ec598c3ea5744a49cba619959724 a58f2145ddb2ff25afe1c702a9cba1e5898048e2 feat(full-game-evening): Serwer wieczoru (p3)
ba71ece16f609c8546621f4cf4c6cc5e20640fd0 017c5f9feeefbcaa6f2284141bebc7925401c5ce feat(full-game-evening): Ekrany wieczoru (p4)
89f864bc68a8683f560cb17fa510d8cff8197e91 23e0accdfd6caa878d8220055a9ab8a8b7cc34d1 chore(full-game-evening): Test w przeglądarce i smoke z wieczorem (p5)
d4ad0737d8502317ff48bc5c5e316f3124229e4b 593e48b7b73b759e4509cf9a927733bf8d734e3a test(full-game-evening): TEMP break-check (a) — cast_vote ignoruje numer pytania
c37fdf766644349b445dfe589eac0f9017c64f3b 284182384b00753622b75475141d81ce8ab6b3c3 Revert "test(full-game-evening): TEMP break-check (a) — cast_vote ignoruje numer pytania"
c302b69d05113f0d730288027245b65b3b499db3 caf739ba5cea89a35681c98768230d79615b8182 test(full-game-evening): TEMP break-check (b) — pominięcie zostawia urnę
2f148b5a03f24fbd89855563ff62f93ba5027884 768ad5b7591ee2ac0e4b8ec19ad67eeb682b312b Revert "test(full-game-evening): TEMP break-check (b) — pominięcie zostawia urnę"
9f02557cd2e7132cad4bd3ce34720517f1a2d198 e614250be78a970c22ef0435dcce280102d0826e test(full-game-evening): TEMP break-check (c) — Następne pytanie bez dzwonka
cd6854a455de50a3e6174e5073c7057f528076e8 75df5040456e4a21910aba23c4a21b8a8adb5b1f Revert "test(full-game-evening): TEMP break-check (c) — Następne pytanie bez dzwonka"
7c444cac0e0788478bdfc278948c4b04766d11f5 7573e7c1a4a7b726000dcb49729d0c6e900abaa6 docs(full-game-evening): Wyniki próbnych alarmów w planie testów (p5)
8e76b018b321e0b0a14113169a66bf50d211a01b 9f8e61d058750c04f1ed81db9a51d4dc83215769 fix(full-game-evening): Poprawki z przeglądu implementacji (p6)
95ca6cc634f34fe13b7b8d9a55cc0e9d09bc36ce 4d348165a214e2a6e3d4f92568f4dde7e196d6f3 Merge pull request #8 from CharlesOnTheWave/full-game-evening
4323e692bba736d07fb814e9911db6ab9492f804 1ba7d240ca56eb4d706b0f35a42dfa680965e8ae docs(full-game-evening): Wdrożenie i ręczny wieczór, zamknięcie planu (p6)
2916ed0abe2f87dfc0bafcf364077c8e7c5b4599 8fed3af0f23ee0978aae73930cdb194fbec164f4 chore(archive): close full-game-evening
0ed1d4e744a79362d94be45399660950b4f2f886 cbd6480ca1d7addea083c8d2e3ef0d75493993e7 feat(room-wide-layout): Układ M w kodzie (p1)
519bf3f1ac8881dbc295fb8953dbea6680e0cfa8 89795fd0f7e1438e76569a80c838c9959b852241 chore(room-wide-layout): Bramka, reguła i test telefonu (p2)
3fbbaea4e51defdacda7d27a62146be7e92b4ee2 dd08f950b9872ba2a7703b550312f6160e3fa63d chore(room-wide-layout): TEMP próbny alarm, przyciski hosta schowane pod 1024 px
7fa4c802fb1e4bc5cfb42f7d4fec03a2b2c58016 51482459499920055e7b24f3ccd21641aeb20ba6 Revert "chore(room-wide-layout): TEMP próbny alarm, przyciski hosta schowane pod 1024 px"
e56592a89eac770d344d47d229f15dcce6f7efc9 5ca405909c49587bc2a1a6e26c6b73c5473c530f docs(room-wide-layout): Wynik próbnego alarmu w planie testów (p2)
8722b0e5e1985f4b6cd0ec1617d608fe3cbfb0ff 1e3a6b7422f1053ea598c9ff07c1ae4c3b18664a fix(room-wide-layout): Poprawki z przeglądu implementacji (p3)
18f2638e5707cc009439478f8759b83275f90e4f 9ac7ba991ea2fde087f5443bf2a5d0f8eb21eb9b chore(room-wide-layout): TEMP próbny alarm, pasek hosta bez sticky
cfe158f4e76f7264483f9fbb6e81e91d95b8a5f3 48d0ce104b03f6873dd5b3cb8d670c6bad5a906d Revert "chore(room-wide-layout): TEMP próbny alarm, pasek hosta bez sticky"
aed26ec8f77dbc711ff1996f996b50d50368f000 c2d574ee6b69145a6584531497c7bb2c98f6306d docs(room-wide-layout): Wynik próbnego alarmu paska hosta (p3)
295c43803bbe686e176a6fa77539e168d9a9c668 12ba3cb7181a59388e9f428c892689c157821478 Merge pull request #9 from CharlesOnTheWave/room-wide-layout
287ab1ae00424272b7ce644b641d2482d1075657 056f6b1c2e5c561e0a91c22a601bc26c2d782fdc docs(room-wide-layout): Przegląd i wdrożenie (p3)
511368a9748788f97a4b209f2c36924813f6a528 dd329d3f3945b5032f9da91d6cdae7e3532ccb91 chore(room-wide-layout): close out plan (epilogue)
a10611f9cc87fef17e70ceee717e6cbcca39f4b7 6602982b604c839b880e802bf2e32e9a83934170 chore(archive): close room-wide-layout
628cd4d374f717fbc17186d89eec91b881474480 96e76c631baa592c4c8ed50a814c1325f0d371c0 docs(roadmap): Szeroki układ z Parked do Done
07a081489e8efee2326bd164b427167eb3de6289 b5bd5934842dcbd738d45182bb225738b96a2574 Sync 10x toolkit (10x-plan, 10x-implement, 10x-archive, 10x-roadmap, 10x-ui)
fb3667f1d8c9857f6f94c8c802ebc6254d6db4ec d6fbed17bb0fd28b0843bcd91d8cf4e08ea03165 Add M4L1 lesson package (10x-ray)
df36c14c7fb5ae9a3033569e6f36151739b92102 fe8d033eb7d3262dfd499025e73f85fd58e27ac1 docs(agents): point to files instead of @-importing them (M4L1)
64c0a3b56c018985a27e4454ad455ea8b2f63ff2 2e4889838c7c35e6691a64200dc4aa314bf2861d docs(agents): move security rules up after rule review (M4L1)
1f1299ec8c28efdc06d8a0e6a905399fc419fda7 61b07aa58c05253514a34e22a75d97d5a586c9f3 docs(agents): keep the "never hide failures" rule from M3L5 (M4L1)
785f859b15d5d9c476870ff8e4defd6ce3fd9348 f067ae6705cd73b87741b24a8f7129103080bf39 Add M4L2 lesson package (10x-repo-map)
7a6a08f5b4758e1194cc54721771336d1addeade 45a53212bb8da9495bceec798a0755d6fc8dbe52 docs(map): project map of the game (M4L2)
06b025dd495314f33601a32f19f51971f43421cf 7449c5d0f1f8b90037d967f7f49aad463cb41bfb Add M4L3 lesson package (m4l3-* prompts)
d6ed6c0924647cbe1a6cb9de202cf1e7428eb6ca 8e10049432512955509ed7dee5a6cc7087744867 docs(changes): guest-to-vote flow analysis (M4L3)
a17a8f57d58cb2dbf90f8b82010fc424f6bcff6e d5ce364f143279bb7c797f305ab3eecedca2bd7a Add M4L4 lesson package (m4l4-* prompts)
eb0cb6077e43cc888c3a8c14ca08612e33a89fb4 6f4ca615e5d060a702a912f559ce59ab1736d273 docs(changes): refactor opportunities research, verified (M4L4)
03932373b80b447ff41b00ef96b9f51a5572ab2c e577e821c27e3675542ccc5cdecc066a0bcf3af7 docs(changes): refactor opportunities plan and review (M4L4)
a4eb12761306088d7a5c8052b2aa2ed7664d83e2 03b09f8f766f900fec40763b1d3145010cd0df49 Add M4L5 lesson package (m4l5-* prompts, 10x-domain-distillation skill)
0fad99179e3aed872f1cd03c5c03e3dd181ac8b8 b706ec9e8fedd191af54ae75a1368f396170b6b7 docs(domain): domain distillation, glossary, invariant and ACL plans (M4L5)
eb7d2bee1d0b3bbc5fab518f339e1003fe9c6f64 6ef8489435ffd81c3bd0e65b0284f75ca3b20d92 docs: 10xArchitect report for module 4
04192d112de00110f63564601ada44784c530968 d1edf11c92898f99f13ba109637ee89a8b50a698 chore(deferred-review-fixes): Testy przed migracją (p1)
d75f4f88ccc58dc863d470f2301fa7e3386d3d93 b9d0c3c7a8603ea733c9b2b7f5a0e3e6f35247d8 feat(deferred-review-fixes): Migracja, Worker i ekran (F2 + F3) (p2)
0c33559a1268589465e1ccac6205efe3cb38eb0b 613f5f4ff71e0046a18ae239c053aa93d0ad80cb Add M5L1 lesson package (10x-opportunity-map, 10x-mom-test skills)
101050f57c9db309994899ee54c9dd103b75ffa8 67f199adafaeb71af4402d06331cbb92553f10de docs(team): opportunity map for team friction (M5L1)
420414a71562f5c0f67098e8e4e2f6572d08322b 8280197f7b433625053f07007f03f286e09c5a55 feat(deferred-review-fixes): F5, pytania skończyły się w trakcie gry (p3)
88bb289ba774fe380e51ce508e48831cb6d4d3d8 fc90ba5d6ddc007ef4815f0841e228601679a34e docs(deferred-review-fixes): Dokumenty i wdrożenie (p4)
1f98e0795a57871e3c37da0cc1c0d8734383210b 6363a28fff86feaa36cb70ce4a4c19fd705ca4b0 Merge pull request #10 from CharlesOnTheWave/deferred-review-fixes
44c9101db20cbc5e58e077f46eda943a3e22000f 3e82ff3ee6b3b05c945e1fbc95d3ce220201a2cd Add M5L2 lesson package (m5l2-agent prompt, review schema template)
5f2e123a4985ba1e7146ef9475c17ff1b0bf4ba6 5d93df81b2be603b56d6dee8e234a0ac242aada3 chore(deferred-review-fixes): close out plan (epilogue)
7a475b1c497ef431fc83e4300a1a9f79723f6a96 45c393ea3e486632d76cb11a48690bfdb2ea1d39 fix(deferred-review-fixes): Poprawki z przeglądu implementacji
538ce4dcc8e26f8fa65b192ea1e8d1c3d9d2a7b6 185bec7115c7f9643d3a8d3e52e3e83fde372a6b chore(archive): close deferred-review-fixes
4a44655fdcebabe580088bf771246e270d429a73 e8f94d3733122014e269b9ff7c76e96a1be2cfed chore(deferred-review-fixes): ścieżki do archiwum (F2 z przeglądu)
3b8d050149fd69a80ba7de1ee54a2a967f464037 a80e6f64907fa0613a781b6b85887046a19d9914 Merge pull request #11 from CharlesOnTheWave/deferred-review-fixes
c5dac7f01e48876d037d615cc457a90becb5e4b4 2c692e4177b87dc4356fadb1cf22d97bc37ba478 feat(keep-supabase-awake): Skrypt, workflow i reguły „pytaj” (p1)
fa36dcd0f2a4ea3bd86e8f1b2228a5c44b3ecb10 e6fbec3d0ad65cf98b32e2b2fb83ea7b03eda71b docs(keep-supabase-awake): Dokumenty (p2)
8a5e6a2b661994ffd528e750a04d3bf7d76e74a1 5e2ace612496f5c43362c2b3935b6b34838192f4 Merge pull request #13 from CharlesOnTheWave/keep-supabase-awake
6842913f416b4143d024d00863088b9e29ffc80e 2f35c62faeb4c589d07b8c074f5443613210145f chore(keep-supabase-awake): Sekrety, PR, scalenie i pierwszy przebieg (p3)
dafe6dbcdf3a6832fbe2af0e59b6126c74285b40 78a1bba8cf89acf8615e95cc31bc62f9a6c3a2f6 docs(roadmap): S-08 przed S-07, spóźnionych wpuszcza na razie sam host
345dddf6e3160705f76330fb92c4117de836af19 e687265237247ec6146e5ad57081b4e0fe972339 Add M5L3 lesson package (m5l3-* prompts and templates, 10x-impl-review-ci skill)
0e25ef5a8e483095c67395f37fb5b8774b5beeb5 3359d3eba63dc5da8b14ed62c87dfd364fa35033 feat(pr-review): PR reviewer on the Claude Agent SDK (M5L2)
d51fd17734d49cc7ae8a57eab73a45ec33cb9b0a 076c6c35703016029ecc268099de206dbd8c5ffa feat(pr-review): AI review job on every PR (M5L3)
15014f0f30708e8721308782758a55e8b4393216 743fb2b2734494e06865c7c7490f4c2e1dd039ae fix(pr-review): report the API error text instead of a schema mismatch
8144456de2efe639720d49df7eb41fd002bd861c 4e77b547c9d52f1f2e5a23e4c492963da9140df1 fix(pr-review): strip whitespace from the pasted subscription token
94143d13ffa356d5697cec3d0b54259dbb6c8685 f22cb0ed980ee254979ff0f3a38eeaccb5452b57 Merge pull request #12 from CharlesOnTheWave/pr-review-agent
682d5a5e798e46a16746706f720d13d70045c680 1e3cbcafbb481cbb3f027ae89e75d6f0171d469d feat(latecomer-admission): Baza (p1)
3bf6fcc87b0ff0a4a490bfbc115b45dcff1228ff c75f71562722cbefeaff75cc9376b8e12dce97c2 test(latecomer-admission): próbny alarm, tymczasowo psuje prośby (revert zaraz po CI)
75831a4f260977448ca7dfaa511fe2dd6f067baf 29e18e8882c7f7ff50816d28e22d2615494bbaa9 revert(latecomer-admission): cofnięcie próbnego alarmu 3bf6fcc
a158f4d76a451d3e7e9dc9fedbb903d948d58c31 733bb33400ffcc439866feaa201b7a8ca9234463 Add M5L4 lesson package (m5l4-* prompts and templates, pack-init, tf-registry, setup-cicd skills)
ef390785c39f9510e9e703fb1c6327a367319f1e 8f5ac8f9f833c2049c0360a4738c245a427d1d73 docs(team): record M5L4 decision on AI artifact distribution
295beca5527a58be7d2d53e01f3d7b752df32123 140eba3af713c7fd6493df64714afc2d8c860999 feat(latecomer-admission): Strona linku i serwer gry (p2)
c208316f702853a29f01a355659edd227835d04a f20c3e11347199dc668bc01801e727505c0a50b1 Add M5L5 lesson package (10x-goal-implement skill)
6827aaa092f9fab70928c0c06d322b709fe596c9 9e00c34396406b0f7602bf95e55f914d55858a7d test(refactor-opportunities): Test bramy RPC (K1) (p1)
c2170638fe316cec097c1822540244d7fcfc9c2d ee79f123de994054842280e9f5fe8d40141809a0 chore(refactor-opportunities): record p1 commit in Progress
d84f144c41dc45938c9255e10728e6c7ecca476f 9b4ed8f63f4614bf800f1c300766c068c76373a6 feat(latecomer-admission): Ekrany gry (p3)
49920931fcb4dc784144eba6786024f15f00ae81 5f366965de77ca614fe00694149a81ac7e4063e0 Merge pull request #15 from CharlesOnTheWave/claude/practical-faraday-tpe4vl
5640430a95443e4ddbb5245bcf126aa53e44495c 674e7193f91533ca8c5b7836a4a24c24dfecf74c Merge origin/main into latecomer-admission (test bramy RPC z PR #15)
5add8c98f71d0e784868a22f5e04b8ba4c340b2b 050c14d286f260900c27bf1110f8d4f28b6e7860 test(latecomer-admission): Brama RPC dla funkcji S-08, baza na produkcji
2ed130428e730f009fdec110826c7b733cf8cbd4 2e2010f3c596e76b2500f9f508813c32a11edc7b Merge pull request #14 from CharlesOnTheWave/latecomer-admission
1153156c07f1f15822468533fb925161f1928ef0 dcc4648b066817c1b82e66f7739d6900bdaf5176 chore(latecomer-admission): Progress fazy 4 po wdrożeniu
b3f68447e6cdd10acaa8cb688a88905913a7b315 b71446c36e4b73295e6a5c2d1c5c73373e4aa478 chore(course-materials-purge): Zwykły PR: pliki kursu poza gitem (p1)
1c7a1911cbd681c995c60f5c82187c4c1fba70de 446f1432de64381ecf18fef059a8c8a15b9dda5b Merge pull request #16 from CharlesOnTheWave/course-materials-purge
```
