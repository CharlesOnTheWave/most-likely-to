-- S-11 question-reactions-play-data: a thumb up or down on the reveal, and per-question counters of how the game's
-- questions play (context/changes/question-reactions-play-data/plan.md, Faza 1; PRD FR-016, FR-018).
--
-- The counters: private.question_stats, one row per question id of the base, with no room, no player and no time, so
-- they stay when a game is deleted (FR-019, S-13) and feed the choice of questions (S-12). Only a round with a question
-- id counts: an own or reworded question of the game's question list has none (*_question_list_review.sql), so two
-- wordings never mix. A game whose host is in private.stats_excluded_hosts (the smoke account) counts nothing. They
-- grow only in transactions that already move the game on, after the last refusal of their function:
--   - the reveal (private.finish_round): revealed, eligible, ballots and abstained, from the numbers the reveal shows
--     everyone; with at least 2 votes for persons also scored, scored_eligible, scored_votes and scored_top (fewer say
--     nothing about how the votes gather);
--   - the skip (skip_round): skipped, and nothing of the urn it deletes (D3 of
--     context/archive/2026-10-15-full-game-evening/research.md);
--   - the start (start_game): listed for each entry of the game's question list from the base with no text of its own,
--     and removed for those of them removed. The list is final only here, so a room closed in the lobby counts nothing;
--   - the fold of the thumbs (next_round, private.drop_round_state): thumbs_up and thumbs_down.
-- A round abandoned while voting (end_game, "Nowa gra", the sweep) counts nothing. The database does not know the base
-- (it checks only the id's format), so a host calling these functions directly could inflate the counters of any id:
-- accepted at the game's scale (plan, Open Question 8 of the research).
--
-- The thumb (react_round, anon and authenticated): any player of the room, the host and a latecomer let in mid-round
-- included, on the latest round once it is revealed; up, down, or none to take it back, and the last one stands. Nobody
-- else sees it. It lives like the urn (D1 of context/archive/2026-10-13-first-live-round/research.md): one row per
-- player in the unlogged private.round_reactions, no grants, outside the publication. It is folded into the counters
-- and deleted in the transaction of the host's move or of the sweep, never in the player's own: a counter written there
-- would carry the player's transaction id (xmin) next to the question. The boundary of this in-progress state: from the
-- reveal until the fold, usually "Następne pytanie", at most about 13 hours for a game abandoned on a reveal (the
-- hourly sweep of games started more than 12 hours ago, *_close_stale_games.sql); a crash empties the table, and the
-- thumbs given so far are lost. "Następne pytanie" folds only once the next round is open: after no_questions the
-- thumbs wait for the end of the game, so a thumb changed after that refusal still counts once.
--
-- The invariants of every round function in *_first_live_round.sql hold here too: the room's row is locked first,
-- everything is checked before the first write, an expected refusal is data ({ok: false, reason}), never an exception,
-- no function returns a vote's target, counts appear only once a round is revealed, and no table of schema private gets
-- a time or a sequence column. An upsert of several counter rows goes in the order of question ids, so two games
-- starting at once with the same questions never deadlock.
--
-- private.finish_round (*_first_live_round.sql), next_round and skip_round (*_full_game_evening.sql), start_game
-- (*_question_list_review.sql) and private.drop_round_state (*_latecomer_admission.sql) are replaced with the same
-- signatures, each from its latest definition with lines added only; their grants stay as they were.
--
-- Deployment order (plan, Critical Implementation Details): this migration ships before the Worker that uses it. It
-- only adds: the Worker deployed before it never calls react_round, and the replaced functions answer as before.
--
-- Never edit this file once it has been pushed; a fix is a new migration.

-- The question counters, the thumbs and the excluded hosts: schema private, no grants, no policies --------------------

-- One row per question id of the base, created by its first count. Logged: a sum of reveals, skips, lists and folded
-- thumbs, with no room, no round, no player and no time, so it holds no pair and stays when a game is deleted (FR-019).
-- Aggregate data of FR-016 only. eligible and scored_eligible (the players who could vote) let S-12 weigh the counts
-- by the size of the group, since the rounds' own results go with their games (S-13).
create table private.question_stats (
  -- "<category-id>-<NNN>" (src/data/questions.ts), which never changes and never comes back for another question.
  question_id text primary key check (question_id ~ '^[a-z0-9-]+-[0-9]{3}$'),
  -- Reveals of the question.
  revealed integer not null default 0,
  -- The sum of the eligible players of those reveals.
  eligible integer not null default 0,
  -- The sum of their ballots, abstentions included.
  ballots integer not null default 0,
  -- The sum of their abstentions.
  abstained integer not null default 0,
  -- Of those reveals, the ones with at least 2 votes for persons.
  scored integer not null default 0,
  -- The sum of the eligible players of those.
  scored_eligible integer not null default 0,
  -- The sum of their votes for persons.
  scored_votes integer not null default 0,
  -- The sum of the most votes one person got in each of them: scored_top / scored_votes is how the votes gather.
  scored_top integer not null default 0,
  -- Rounds of the question skipped while voting.
  skipped integer not null default 0,
  -- Starts of a game with the question on its list, as an entry of the base with no text of its own.
  listed integer not null default 0,
  -- Of those, the ones with the entry removed ("Usuń").
  removed integer not null default 0,
  -- Thumbs at the fold.
  thumbs_up integer not null default 0,
  thumbs_down integer not null default 0
);

-- A player's thumb on a revealed round, until the fold. Unlogged, like the urn: never in the WAL, so neither a replica,
-- logical decoding nor a backup holds one, and it cannot be published. One row per player: a second thumb replaces the
-- first, and none deletes it.
create unlogged table private.round_reactions (
  round_id uuid not null references private.rounds (id) on delete cascade,
  -- No foreign key on purpose, as in private.round_voters: its check would lock the player's row in players.
  player_id uuid not null,
  up boolean not null,
  primary key (round_id, player_id)
);

-- Hosts whose games count nothing. No foreign key to auth.users: the throwaway database of CI has none of these
-- accounts.
create table private.stats_excluded_hosts (
  user_id uuid primary key
);

alter table private.question_stats enable row level security;
alter table private.round_reactions enable row level security;
alter table private.stats_excluded_hosts enable row level security;

-- Reached only through the functions below, like the round tables.
revoke all on table private.question_stats, private.round_reactions, private.stats_excluded_hosts
  from public, anon, authenticated;

-- The smoke account (scripts/smoke.mjs) reveals and skips real questions of the base at every deployment.
insert into private.stats_excluded_hosts (user_id) values ('d894161a-7308-48d9-984b-17937b1a3013'::uuid);

-- Counter helpers: no grants, called only from the round functions ---------------------------------------------------

-- Whether the room's games count: not when its host is in private.stats_excluded_hosts.
create function private.counts_for_stats(p_room_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not exists (
    select 1
    from public.rooms r
    join private.stats_excluded_hosts x on x.user_id = r.host_id
    where r.id = p_room_id
  )
$$;

-- The fold: the thumbs on every round of the room with a question id go into that question's counters, unless the
-- room's games count nothing; then every thumb of the room is deleted, those of an own or reworded question included.
-- The caller holds the room's lock: a thumb sent right now either is folded here or finds the round over.
create function private.fold_reactions(p_room_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if private.counts_for_stats(p_room_id) then
    insert into private.question_stats as s (question_id, thumbs_up, thumbs_down)
    select r.question_id, count(*) filter (where t.up), count(*) filter (where not t.up)
    from private.round_reactions t
    join private.rounds r on r.id = t.round_id
    where r.room_id = p_room_id and r.question_id is not null
    group by r.question_id
    order by r.question_id
    on conflict (question_id) do update
    set thumbs_up = s.thumbs_up + excluded.thumbs_up, thumbs_down = s.thumbs_down + excluded.thumbs_down;
  end if;
end;
$$;

-- The reveal and the end of a game, with the counters -----------------------------------------------------------------

-- The reveal: a count for every eligible player still in the room (zeros included), the abstentions and the number of
-- ballots, then the in-progress rows go. The caller holds the room's lock and has checked that the round is voting.
-- S-11: in between, the question's counters get the reveal's numbers.
create or replace function private.finish_round(p_round_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_tally jsonb;
  v_abstained integer;
  v_ballots integer;
  v_question text;
  v_eligible integer;
  v_counts boolean;
  v_votes integer;
  v_top integer;
  v_scored boolean;
begin
  select b.tally, b.abstained into v_tally, v_abstained
  from private.ballot_boxes b
  where b.round_id = p_round_id;

  select count(*) into v_ballots
  from private.round_voters v
  where v.round_id = p_round_id;

  insert into private.round_results (round_id, player_id, votes)
  select r.id, p.id, coalesce((v_tally ->> p.id::text)::integer, 0)
  from private.rounds r
  join public.players p on p.id = any (r.eligible)
  where r.id = p_round_id;

  -- S-11: the question's counters, from the numbers this reveal shows everyone, for a question of the base in a game
  -- that counts. The votes for persons are the results just written; with fewer than 2 of them the reveal says nothing
  -- about how the votes gather, so only the scored counters skip it.
  select r.question_id, cardinality(r.eligible), private.counts_for_stats(r.room_id)
  into v_question, v_eligible, v_counts
  from private.rounds r
  where r.id = p_round_id;

  if v_question is not null and v_counts then
    select coalesce(sum(rr.votes), 0), coalesce(max(rr.votes), 0) into v_votes, v_top
    from private.round_results rr
    where rr.round_id = p_round_id;

    v_scored := v_votes >= 2;

    insert into private.question_stats as s (
      question_id, revealed, eligible, ballots, abstained, scored, scored_eligible, scored_votes, scored_top
    )
    values (
      v_question,
      1,
      v_eligible,
      v_ballots,
      coalesce(v_abstained, 0),
      case when v_scored then 1 else 0 end,
      case when v_scored then v_eligible else 0 end,
      case when v_scored then v_votes else 0 end,
      case when v_scored then v_top else 0 end
    )
    on conflict (question_id) do update
    set revealed = s.revealed + excluded.revealed,
      eligible = s.eligible + excluded.eligible,
      ballots = s.ballots + excluded.ballots,
      abstained = s.abstained + excluded.abstained,
      scored = s.scored + excluded.scored,
      scored_eligible = s.scored_eligible + excluded.scored_eligible,
      scored_votes = s.scored_votes + excluded.scored_votes,
      scored_top = s.scored_top + excluded.scored_top;
  end if;

  update private.rounds
  set phase = 'revealed', abstained = coalesce(v_abstained, 0), ballots = v_ballots
  where id = p_round_id;

  delete from private.round_voters where round_id = p_round_id;
  delete from private.ballot_boxes where round_id = p_round_id;
end;
$$;

-- Everything a game in play keeps apart from its players, dropped whenever the room closes (end_game, "Nowa gra" in
-- create_room, private.close_stale_games): the urn of a round that ends without a reveal, so no voter and no count
-- stays (D1 of S-02), and the room's requests to join, pending or rejected. Results already revealed stay. Never at a
-- reveal: a request waits for the host's answer through every round. S-11: the thumbs are folded first.
create or replace function private.drop_round_state(p_room_id uuid)
returns void
language sql
set search_path = ''
as $$
  -- S-11: the thumbs of the room's last reveal go into the counters, and go.
  select private.fold_reactions(p_room_id);

  delete from private.round_voters v
  using private.rounds r
  where r.id = v.round_id and r.room_id = p_room_id;

  delete from private.ballot_boxes b
  using private.rounds r
  where r.id = b.round_id and r.room_id = p_room_id;

  delete from public.join_requests q
  where q.room_id = p_room_id;
$$;

-- Host: start, next question, skip ----------------------------------------------------------------------------------

-- Definer, host only: "Zacznij grę". Fixes who may vote (everyone in the room now, the host included; at least 3,
-- US-01) and opens round 1 with its urn. With a list, round 1 is its first entry not removed, and p_question_id means
-- nothing: list_empty when every entry is removed. With no list, round 1 is p_question_id. S-11: right before round 1
-- opens, the list as it stands is counted.
create or replace function public.start_game(p_room_id uuid, p_question_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_position integer;
  v_question text;
  v_eligible uuid[];
  v_round uuid;
begin
  -- The room's row first: a guest joining or a move on the list right now is either in the round below or finds the
  -- game started.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  -- Another host's room looks like no room at all.
  if v_host is null or v_user is null or v_user <> v_host then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  if v_status = 'closed' then
    return jsonb_build_object('ok', false, 'reason', 'room_closed');
  end if;

  if v_status <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'game_started');
  end if;

  if exists (select 1 from private.game_questions g where g.room_id = p_room_id) then
    -- The entry's question id only when it has no text of its own.
    select g.position, case when g.text is null then g.question_id end into v_position, v_question
    from private.game_questions g
    where g.room_id = p_room_id and not g.removed
    order by g.position
    limit 1;

    if v_position is null then
      return jsonb_build_object('ok', false, 'reason', 'list_empty');
    end if;
  else
    if p_question_id is null or p_question_id !~ '^[a-z0-9-]+-[0-9]{3}$' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_question');
    end if;
    v_question := p_question_id;
  end if;

  select array_agg(p.id order by p.seat) into v_eligible
  from public.players p
  where p.room_id = p_room_id;

  if coalesce(cardinality(v_eligible), 0) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'not_enough_players');
  end if;

  -- S-11: the list as it stands, final now: each entry of the base with no text of its own is listed, and removed too
  -- when the host removed it. No list, no rows; a room closed in the lobby never gets here.
  if private.counts_for_stats(p_room_id) then
    insert into private.question_stats as s (question_id, listed, removed)
    select g.question_id, 1, case when g.removed then 1 else 0 end
    from private.game_questions g
    where g.room_id = p_room_id and g.question_id is not null and g.text is null
    order by g.question_id
    on conflict (question_id) do update
    set listed = s.listed + excluded.listed, removed = s.removed + excluded.removed;
  end if;

  insert into private.rounds (room_id, number, question_id, list_position, eligible)
  values (p_room_id, 1, v_question, v_position, v_eligible)
  returning id into v_round;

  insert into private.ballot_boxes (round_id) values (v_round);

  update public.rooms set status = 'playing', started_at = now() where id = p_room_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Definer, host only: "Następne pytanie". p_round is the number of the round on the host's screen, which must be the
-- latest one, revealed or skipped; p_candidates is the game's pool in the Worker's order. S-11: once the next round is
-- open, the thumbs are folded.
create or replace function public.next_round(p_room_id uuid, p_round integer, p_candidates text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_number integer;
  v_phase text;
begin
  -- The room's row first: a vote or another move of the host right now waits for this one.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  -- Another host's room looks like no room at all.
  if v_host is null or v_user is null or v_user <> v_host then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  if v_status = 'closed' then
    return jsonb_build_object('ok', false, 'reason', 'room_closed');
  end if;

  if v_status = 'playing' then
    select r.number, r.phase into v_number, v_phase
    from private.rounds r
    where r.room_id = p_room_id
    order by r.number desc
    limit 1;
  end if;

  if v_number is null then
    return jsonb_build_object('ok', false, 'reason', 'no_round');
  end if;

  -- A screen behind the game, or the same click sent twice: the round it moves on from is over already.
  if p_round is null or p_round <> v_number then
    return jsonb_build_object('ok', false, 'reason', 'round_over');
  end if;

  if v_phase = 'voting' then
    return jsonb_build_object('ok', false, 'reason', 'round_in_progress');
  end if;

  -- Every candidate played: the game goes on until the host ends it (D2).
  if not private.open_next_round(p_room_id, v_number + 1, p_candidates) then
    return jsonb_build_object('ok', false, 'reason', 'no_questions');
  end if;

  -- S-11: only now that the next round is open: after no_questions the thumbs wait for the end of the game, and a thumb
  -- changed after that refusal still counts once.
  perform private.fold_reactions(p_room_id);

  return jsonb_build_object('ok', true);
end;
$$;

-- Definer, host only: "Pomiń pytanie", only while round p_round, the latest one, is voting. Its votes are gone: the urn
-- is deleted, the round stays as a row in phase skipped with no count (D3), and the next question opens at once (D2).
-- { ok: true } also when no candidate is left: the skipped round stays the latest one, and the game goes on. S-11: the
-- skip is counted before the next question opens.
create or replace function public.skip_round(p_room_id uuid, p_round integer, p_candidates text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_round uuid;
  v_number integer;
  v_phase text;
begin
  -- The room's row first: a vote cast right now is either deleted with the urn below or finds the round skipped.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  -- Another host's room looks like no room at all.
  if v_host is null or v_user is null or v_user <> v_host then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  if v_status = 'closed' then
    return jsonb_build_object('ok', false, 'reason', 'room_closed');
  end if;

  if v_status = 'playing' then
    select r.id, r.number, r.phase into v_round, v_number, v_phase
    from private.rounds r
    where r.room_id = p_room_id
    order by r.number desc
    limit 1;
  end if;

  if v_round is null then
    return jsonb_build_object('ok', false, 'reason', 'no_round');
  end if;

  -- A screen behind the game, or the same skip sent twice: never skip a question nobody has answered yet.
  if p_round is null or p_round <> v_number then
    return jsonb_build_object('ok', false, 'reason', 'round_over');
  end if;

  -- The counts were shown: nothing is left to lose.
  if v_phase = 'revealed' then
    return jsonb_build_object('ok', false, 'reason', 'round_revealed');
  end if;

  if v_phase <> 'voting' then
    return jsonb_build_object('ok', false, 'reason', 'round_over');
  end if;

  delete from private.round_voters where round_id = v_round;
  delete from private.ballot_boxes where round_id = v_round;
  update private.rounds set phase = 'skipped' where id = v_round;

  -- S-11: the skip itself, for a question of the base in a game that counts; nothing of the urn deleted above (D3).
  if private.counts_for_stats(p_room_id) then
    insert into private.question_stats as s (question_id, skipped)
    select r.question_id, 1
    from private.rounds r
    where r.id = v_round and r.question_id is not null
    on conflict (question_id) do update
    set skipped = s.skipped + 1;
  end if;

  perform private.open_next_round(p_room_id, v_number + 1, p_candidates);

  return jsonb_build_object('ok', true);
end;
$$;

-- Player: a thumb on the reveal ---------------------------------------------------------------------------------------

-- Definer, for anon and authenticated: a thumb on the question just revealed (FR-018). The player is the host by
-- auth.uid() or a guest by the token, as in cast_vote: any player of the room, a latecomer let in mid-round included,
-- since a thumb rates the question, not the result. p_round is the number of the round on the player's screen, which
-- must be the latest one, and revealed; p_reaction is up, down, or none to take the thumb back. Writes only the
-- player's row in private.round_reactions, never a counter, and answers { ok: true } and nothing else.
create function public.react_round(
  p_room_id uuid,
  p_round integer,
  p_reaction text,
  p_player_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_player uuid;
  v_round uuid;
  v_number integer;
  v_phase text;
begin
  -- The server sends either no token (the host) or the cookie's 32-byte token; anything else is not our client.
  if p_player_token is not null and p_player_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid player token' using errcode = '22023';
  end if;

  -- The screen sends one of these three; anything else is not our client either.
  if p_reaction is null or p_reaction not in ('up', 'down', 'none') then
    raise exception 'invalid reaction' using errcode = '22023';
  end if;

  -- The room's row first: a thumb and the host's move that folds the thumbs take turns.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  if v_host is null then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  if v_user is not null and v_user = v_host then
    select p.id into v_player
    from public.players p
    where p.room_id = p_room_id and p.user_id = v_user;
  elsif p_player_token is not null then
    select p.id into v_player
    from public.player_secrets s
    join public.players p on p.id = s.player_id
    where s.token_hash = sha256(convert_to(p_player_token, 'UTF8')) and p.room_id = p_room_id;
  end if;

  -- Someone who is not in this room learns nothing about it.
  if v_player is null then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  if v_status = 'closed' then
    return jsonb_build_object('ok', false, 'reason', 'room_closed');
  end if;

  if v_status <> 'playing' then
    return jsonb_build_object('ok', false, 'reason', 'no_round');
  end if;

  select r.id, r.number, r.phase into v_round, v_number, v_phase
  from private.rounds r
  where r.room_id = p_room_id
  order by r.number desc
  limit 1;

  if v_round is null then
    return jsonb_build_object('ok', false, 'reason', 'no_round');
  end if;

  -- A screen behind the game, or one that names no question: never a thumb on a question its player has not seen.
  if p_round is null or p_round <> v_number then
    return jsonb_build_object('ok', false, 'reason', 'round_over');
  end if;

  -- A skipped round showed no result, and its question is gone.
  if v_phase = 'skipped' then
    return jsonb_build_object('ok', false, 'reason', 'round_over');
  end if;

  -- Only once the result is on the screen.
  if v_phase <> 'revealed' then
    return jsonb_build_object('ok', false, 'reason', 'no_round');
  end if;

  if p_reaction = 'none' then
    delete from private.round_reactions t where t.round_id = v_round and t.player_id = v_player;
  else
    insert into private.round_reactions (round_id, player_id, up)
    values (v_round, v_player, p_reaction = 'up')
    on conflict (round_id, player_id) do update set up = excluded.up;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Function owners and grants ------------------------------------------------------------------------------------------

-- A security definer function runs with its owner's rights; on Supabase that must be postgres. The helpers too, as
-- private.question_text in *_question_list_review.sql: the definer functions call them as postgres.
alter function private.counts_for_stats(uuid) owner to postgres;
alter function private.fold_reactions(uuid) owner to postgres;
alter function public.react_round(uuid, integer, text, text) owner to postgres;
alter function public.start_game(uuid, text) owner to postgres;
alter function public.next_round(uuid, integer, text[]) owner to postgres;
alter function public.skip_round(uuid, integer, text[]) owner to postgres;

-- As in *_full_game_evening.sql: the revokes are repeated for every function this file creates or replaces, so each
-- one's grants read in one place. The private helpers get none: only definer functions call them.
revoke execute on function private.counts_for_stats(uuid) from public, anon, authenticated;
revoke execute on function private.fold_reactions(uuid) from public, anon, authenticated;
revoke execute on function private.finish_round(uuid) from public, anon, authenticated;
revoke execute on function private.drop_round_state(uuid) from public, anon, authenticated;
revoke execute on function public.react_round(uuid, integer, text, text) from public, anon, authenticated;
revoke execute on function public.start_game(uuid, text) from public, anon, authenticated;
revoke execute on function public.next_round(uuid, integer, text[]) from public, anon, authenticated;
revoke execute on function public.skip_round(uuid, integer, text[]) from public, anon, authenticated;

-- A thumb is every player's, guests included, who have no session; the host's moves stay the signed-in host's.
grant execute on function public.react_round(uuid, integer, text, text) to anon, authenticated;
grant execute on function public.start_game(uuid, text) to authenticated;
grant execute on function public.next_round(uuid, integer, text[]) to authenticated;
grant execute on function public.skip_round(uuid, integer, text[]) to authenticated;
