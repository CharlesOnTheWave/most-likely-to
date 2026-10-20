# Sources: documents

- documents: 2 requirements, 13 narrative (1 roadmap + 9 archived change folders + 3 open change folders), 3 reference, 7 engineering

## Domain documents

| path | kind | what it is about |
| --- | --- | --- |
| `context/foundation/prd.md` | requirements | product requirements: vision, personas, success criteria, user stories, functional and non-functional requirements, business logic, access control, non-goals, open questions |
| `context/foundation/shape-notes.md` | requirements | discovery notes the PRD was written from |
| `context/foundation/roadmap.md` | narrative | milestone and vertical slices (S-xx), what is done and what is next |
| `context/archive/2026-09-27-live-sync-spike/` | narrative | archived change: technical spike for live updates between devices |
| `context/archive/2026-09-27-starter-question-base/` | narrative | archived change: the first content base shipped with the game |
| `context/archive/2026-10-04-one-click-host-login/` | narrative | archived change: sign-in for the organiser |
| `context/archive/2026-10-04-ui-signin-contract/` | narrative | archived change: sign-in screen design contract |
| `context/archive/2026-10-07-room-lobby/` | narrative | archived change: creating a game and joining it before play |
| `context/archive/2026-10-10-testing-lobby-foundation/` | narrative | archived change: first database and unit tests for the joining flow |
| `context/archive/2026-10-13-first-live-round/` | narrative | archived change: first playable round, including anonymity decisions (research D1, reviews) |
| `context/archive/2026-10-15-full-game-evening/` | narrative | archived change: a whole evening of play, several rounds in a row |
| `context/archive/2026-10-15-room-wide-layout/` | narrative | archived change: wide-screen layout of the play screens |
| `context/changes/guest-vote-flow-analysis/` | narrative | open (research-only) change: analysis of one flow end to end; agent-written research, read for vocabulary and recorded decisions, not as proof about code |
| `context/changes/refactor-opportunities/` | narrative | open change: refactoring research, plan and review; agent-written, same caveat |
| `context/changes/bootstrap-verification/` | narrative | verification log of the initial scaffold |
| `README.md` | reference | how to run the project, scripts |
| `AGENTS.md` | reference | agent instructions; its "Hard Rules" restate product rules (anonymity, non-goals) with links to decisions |
| `CLAUDE.md` | reference | imports `AGENTS.md`, plus course tooling block (not product) |
| `context/foundation/tech-stack.md` | engineering | stack decision |
| `context/foundation/infrastructure.md` | engineering | hosting decision |
| `context/foundation/test-plan.md` | engineering | test strategy, risks, quality gates |
| `context/foundation/test-stack.md` | engineering | test tooling |
| `context/foundation/lessons.md` | engineering | team lessons (rules learned) |
| `context/deployment/deploy-plan.md` | engineering | deployment steps and rules |
| `context/audits/observability/` | engineering | observability audit report |

Excluded from documents: `context/map/` (an earlier agent analysis of the repository; would feed a previous run's conclusions back in), `context/domain/` (this run), `.claude/` (course tooling).

## Product goals

Vision and problem — `context/foundation/prd.md:20-24` (section "Vision & Problem Statement").

Success criteria, primary — `context/foundation/prd.md:36-38`:
> - Host zakłada grę (logowanie → kategorie → link) w mniej niż 5 minut.
> - Ekipa rozgrywa co najmniej 10 pytań w jednym wieczorze bez awarii i bez sięgania po Google Forms.

Success criteria, secondary — `context/foundation/prd.md:40-43`:
> - Goście sami dodali własne pytania w trakcie wieczoru.
> - Po 3 wieczorach pytania są zauważalnie lepsze (ekipa to czuje).
> - Ktoś spoza ekipy autora zagrał i dał feedback, że to fajne.

Guardrails — `context/foundation/prd.md:45-49`:
> - Runda przeżywa odświeżenie strony i wypadnięcie gracza; gracz wraca na swój nick, gra idzie dalej.
> - Gość dołącza w mniej niż 30 sekund bez instrukcji.
> - O gościu nie zostaje nic poza nickiem i głosami; host może skasować historię.
> - Działa na telefonie w przeglądarce, bez instalacji.

Non-goals — `context/foundation/prd.md:177-191` (first item: `prd.md:180`, "Żadnej odsłony ani zapisu „kto na kogo głosował", w jakiejkolwiek formie").

Business logic statement — `context/foundation/prd.md:148-155`.

## Change goals

Each archived and open change folder has its own `change.md` / `plan.md` with goals of that change only (for example `context/archive/2026-10-13-first-live-round/`, `context/changes/refactor-opportunities/plan.md`). Not used to judge the Core.

## Limitations

- The PRD is marked `status: draft` (`context/foundation/prd.md:4`) and covers a v1 scope wider than what is built; the roadmap says which slices are done.
- Requirements are in Polish; code identifiers are in English. Terms are not translated by this run; matching across languages is the synthesis's job.
- Two of the narrative folders (`guest-vote-flow-analysis`, `refactor-opportunities`) are agent analyses of the code; they carry recorded decisions but are not independent evidence about the code.
