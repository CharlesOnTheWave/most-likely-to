-- S-06 question-list-review: the host reviews the game's question list in the lobby before the start
-- (context/changes/question-list-review/plan.md, Faza 1; PRD FR-012).
--
-- The game's question list is a thing of its own that belongs to the room: private.game_questions, one row per entry,
-- read and written only through the definer functions below, by the room's host and only in the lobby. Its life:
--   - open_question_list ("Przejrzyj pytania"): the first 15 distinct candidates the Worker sends (the picked
--     categories, 18+ only where the host included it, in the Worker's random order) become positions 1-15; opening it
--     again changes nothing;
--   - remove_list_question ("Usuń"): the entry is marked removed, never deleted, so its question id stays on the list
--     and never comes up in this game;
--   - edit_list_question ("Popraw"): the entry gets a text of its own; a question id of the base stays in the row, so
--     the base's wording of that question never comes up after the list either;
--   - add_own_question ("Dodaj własne"): a new entry with a text and no question id;
--   - draw_list_question ("Dolosuj pytanie"): the first candidate on no row of the list becomes a new entry.
-- A position is the entry's handle: it never changes, and a new entry takes max(position) + 1, so the host's screen
-- names an entry by its position with no race against a refresh. At most 100 rows per room. The list keeps no nick and
-- no vote, and it stays with the room once the room closes (removals and own questions are S-11's and the game
-- creator's to read, FR-021); it goes only with the room itself.
--
-- With a list, the game plays it first. start_game opens round 1 with the first entry not removed, and p_question_id
-- means nothing then (it stays for the Worker deployed before this migration and for a game with no list).
-- private.open_next_round (next_round, skip_round) takes the next entry not removed and not played yet before any
-- candidate; after the list it takes the candidates as before, now skipping every question id on any row of the list.
-- A round from an entry keeps the entry's position (rounds.list_position), and its question id only when the entry has
-- no text of its own, so per-question data stored under a base id (S-11) never mixes two wordings. room_lobby gives the
-- host the list in every status of the room (during the game the Worker counts the questions left from it) and a
-- guest null; and to every player, in a voting or revealed round with no question id, the entry's text
-- (question_text).
--
-- The invariants of every round function in *_first_live_round.sql hold here too: the room's row is locked first,
-- everything is checked before the first write, an expected refusal is data ({ok: false, reason}), never an exception,
-- no function returns a vote's target, counts appear only once a round is revealed, and no table of schema private gets
-- a time or a sequence column. A list of candidates no screen of the game sends is not an expected refusal: as in
-- private.open_next_round, more than 1000 raise 22023.
--
-- Deployment order (plan, Critical Implementation Details): this migration ships before the Worker that uses it. The
-- Worker deployed before it never calls the new functions, so no room has a list, and with no list start_game,
-- next_round and skip_round behave as before this migration. Its parser copies only the keys of its own contract from
-- room_lobby, at the top and in a voting or revealed round, so question_list and question_text pass it by; a skipped
-- round gets no new key, since that parser refuses any.
--
-- Never edit this file once it has been pushed; a fix is a new migration.

-- The game's question list: schema private, no grants, no policies ----------------------------------------------------

-- One row per entry of a room's list. Logged, like private.rounds: it holds no vote, and a game in play reads it.
create table private.game_questions (
  room_id uuid not null references public.rooms (id) on delete cascade,
  -- The entry's handle: 1-15 from open_question_list, then max + 1. Never renumbered, never reused.
  position integer not null check (position between 1 and 100),
  -- "<category-id>-<NNN>" (src/data/questions.ts) for a question of the base; null for the host's own question. The
  -- Worker draws it, the database checks only the format.
  question_id text check (question_id ~ '^[a-z0-9-]+-[0-9]{3}$'),
  -- The host's own wording after private.question_text; null for a question of the base as it stands.
  text text check (char_length(text) between 1 and 90),
  -- "Usuń": the entry stays, so its question id never comes up in this game.
  removed boolean not null default false,
  constraint game_questions_pkey primary key (room_id, position),
  constraint game_questions_room_question_key unique (room_id, question_id),
  constraint game_questions_question_check check (question_id is not null or text is not null)
);

alter table private.game_questions enable row level security;

-- Reached only through the definer functions below, like the round tables.
revoke all on table private.game_questions from public, anon, authenticated;

-- A round may come from an entry of the list -------------------------------------------------------------------------

-- Only widened: every round so far has a question id and no list position. The format check on question_id stays, and
-- a null passes it; the key (room_id, question_id) takes any number of nulls.
alter table private.rounds alter column question_id drop not null;

-- The entry a round was opened from: an own or reworded question has its text there, and the list's next entry is the
-- first one with no round. Each entry is played at most once.
alter table private.rounds add column list_position integer;
alter table private.rounds add constraint rounds_list_position_fkey
  foreign key (room_id, list_position) references private.game_questions (room_id, position);
alter table private.rounds add constraint rounds_room_list_position_key unique (room_id, list_position);
alter table private.rounds add constraint rounds_question_check
  check (question_id is not null or list_position is not null);

-- Text helper: no grants, called only from the definer functions below ------------------------------------------------

-- A question's text as stored: the nick rule's normalization (NFC, Unicode whitespace to a space, control and invisible
-- characters removed, runs of spaces collapsed, edges trimmed), then without the trailing question marks and spaces,
-- since the screen adds the "?" itself (src/data/questions.ts). The callers cap the raw text at 400 characters first,
-- so the regular expressions never run on a very long text, and accept 1-90 characters after this.
create function private.question_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select rtrim(private.normalize_nick(p_text), '? ')
$$;

-- Host: the list in the lobby -----------------------------------------------------------------------------------------

-- Definer, host only: "Przejrzyj pytania". p_candidates is the pool of the picked categories in the Worker's random
-- order. The first 15 distinct candidates in the question id format, in that order, become positions 1-15. A list that
-- has rows already stays as it is and the answer is ok (a double click, the host's second screen); no_questions when no
-- candidate is usable, and nothing is written then.
create function public.open_question_list(p_room_id uuid, p_candidates text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_questions text[];
begin
  -- The room's row first: a start or another move of the host right now waits for this one.
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

  -- The list is reviewed before the start only.
  if v_status <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'game_started');
  end if;

  if exists (select 1 from private.game_questions g where g.room_id = p_room_id) then
    return jsonb_build_object('ok', true);
  end if;

  -- The game sends at most 216 ids; a longer list is malformed input, as in private.open_next_round.
  if coalesce(cardinality(p_candidates), 0) > 1000 then
    raise exception 'too many candidates' using errcode = '22023';
  end if;

  -- A repeated candidate counts once, at its first place.
  select array_agg(d.question_id order by d.first_place) into v_questions
  from (
    select c.question_id, min(c.place) as first_place
    from unnest(p_candidates) with ordinality as c (question_id, place)
    where c.question_id ~ '^[a-z0-9-]+-[0-9]{3}$'
    group by c.question_id
    order by first_place
    limit 15
  ) d;

  if v_questions is null then
    return jsonb_build_object('ok', false, 'reason', 'no_questions');
  end if;

  insert into private.game_questions (room_id, position, question_id)
  select p_room_id, q.place::integer, q.question_id
  from unnest(v_questions) with ordinality as q (question_id, place);

  return jsonb_build_object('ok', true);
end;
$$;

-- Definer, host only: "Dolosuj pytanie". The first candidate, in the given order, in the question id format and on no
-- row of the list (removed and reworded entries included) becomes a new entry at the end. list_full at 100 rows;
-- no_questions when no candidate is left, and nothing is written then.
create function public.draw_list_question(p_room_id uuid, p_candidates text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_question text;
begin
  -- The room's row first, as in open_question_list.
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

  if (select count(*) from private.game_questions g where g.room_id = p_room_id) >= 100 then
    return jsonb_build_object('ok', false, 'reason', 'list_full');
  end if;

  if coalesce(cardinality(p_candidates), 0) > 1000 then
    raise exception 'too many candidates' using errcode = '22023';
  end if;

  select c.question_id into v_question
  from unnest(p_candidates) with ordinality as c (question_id, place)
  where c.question_id ~ '^[a-z0-9-]+-[0-9]{3}$'
    and not exists (
      select 1 from private.game_questions g where g.room_id = p_room_id and g.question_id = c.question_id
    )
  order by c.place
  limit 1;

  if v_question is null then
    return jsonb_build_object('ok', false, 'reason', 'no_questions');
  end if;

  insert into private.game_questions (room_id, position, question_id)
  select p_room_id, coalesce(max(g.position), 0) + 1, v_question
  from private.game_questions g
  where g.room_id = p_room_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Definer, host only: "Usuń". The entry at p_position is marked removed and stays on the list. question_unknown when
-- there is no such entry or it is removed already (a double click, the host's second screen).
create function public.remove_list_question(p_room_id uuid, p_position integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
begin
  -- The room's row first, as in open_question_list.
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

  if not exists (
    select 1 from private.game_questions g
    where g.room_id = p_room_id and g.position = p_position and not g.removed
  ) then
    return jsonb_build_object('ok', false, 'reason', 'question_unknown');
  end if;

  update private.game_questions g
  set removed = true
  where g.room_id = p_room_id and g.position = p_position;

  return jsonb_build_object('ok', true);
end;
$$;

-- Definer, host only: "Popraw". The entry at p_position gets p_text as its own text, after private.question_text. A
-- question id of the base stays in the row: that wording of the question does not come up after the list either.
-- question_unknown when there is no such entry or it is removed; invalid_question_text for a raw text over 400
-- characters or a stored text outside 1-90 characters.
create function public.edit_list_question(p_room_id uuid, p_position integer, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_text text;
begin
  -- The room's row first, as in open_question_list.
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

  if not exists (
    select 1 from private.game_questions g
    where g.room_id = p_room_id and g.position = p_position and not g.removed
  ) then
    return jsonb_build_object('ok', false, 'reason', 'question_unknown');
  end if;

  -- A cap before the text rule, so its regular expressions never run on a very long text.
  if p_text is null or char_length(p_text) > 400 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_question_text');
  end if;

  v_text := private.question_text(p_text);
  if v_text is null or char_length(v_text) not between 1 and 90 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_question_text');
  end if;

  update private.game_questions g
  set text = v_text
  where g.room_id = p_room_id and g.position = p_position;

  return jsonb_build_object('ok', true);
end;
$$;

-- Definer, host only: "Dodaj własne". p_text, after private.question_text, becomes a new entry at the end with no
-- question id. invalid_question_text as in edit_list_question; list_full at 100 rows.
create function public.add_own_question(p_room_id uuid, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_text text;
begin
  -- The room's row first, as in open_question_list.
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

  -- A cap before the text rule, so its regular expressions never run on a very long text.
  if p_text is null or char_length(p_text) > 400 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_question_text');
  end if;

  v_text := private.question_text(p_text);
  if v_text is null or char_length(v_text) not between 1 and 90 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_question_text');
  end if;

  if (select count(*) from private.game_questions g where g.room_id = p_room_id) >= 100 then
    return jsonb_build_object('ok', false, 'reason', 'list_full');
  end if;

  insert into private.game_questions (room_id, position, text)
  select p_room_id, coalesce(max(g.position), 0) + 1, v_text
  from private.game_questions g
  where g.room_id = p_room_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Round: start and the next question, with the list first -------------------------------------------------------------

-- Definer, host only: "Zacznij grę". Fixes who may vote (everyone in the room now, the host included; at least 3,
-- US-01) and opens round 1 with its urn. With a list, round 1 is its first entry not removed, and p_question_id means
-- nothing: list_empty when every entry is removed. With no list, round 1 is p_question_id, as before this migration.
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

  insert into private.rounds (room_id, number, question_id, list_position, eligible)
  values (p_room_id, 1, v_question, v_position, v_eligible)
  returning id into v_round;

  insert into private.ballot_boxes (round_id) values (v_round);

  update public.rooms set status = 'playing', started_at = now() where id = p_room_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Opens round p_number of the room, with an empty urn: the list's first entry, in the order of positions, that is not
-- removed and has no round yet; after the list, the first candidate, in the given order, that has the question id
-- format, was not played in this room yet and is on no row of the list (removed and reworded entries included).
-- Checked before the insert, so a repeat is never a 23505 with the row's values in DETAIL. Who may vote: the players
-- in the room now, in seat order. false when nothing is left; nothing is written then. The caller holds the room's lock
-- and has checked the room and its latest round.
-- More than 1000 candidates raises an exception, not a refusal, also while the list lasts: the game sends at most 216
-- ids, so such a list is malformed input from a client calling the database directly, as a malformed player token is.
-- The exception also rolls back what the caller wrote before the call (the urn skip_round deletes), and its message
-- holds no value of the list.
create or replace function private.open_next_round(p_room_id uuid, p_number integer, p_candidates text[])
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_position integer;
  v_question text;
  v_eligible uuid[];
  v_round uuid;
begin
  if coalesce(cardinality(p_candidates), 0) > 1000 then
    raise exception 'too many candidates' using errcode = '22023';
  end if;

  -- The list first. The entry's question id only when it has no text of its own.
  select g.position, case when g.text is null then g.question_id end into v_position, v_question
  from private.game_questions g
  where g.room_id = p_room_id
    and not g.removed
    and not exists (
      select 1 from private.rounds r where r.room_id = p_room_id and r.list_position = g.position
    )
  order by g.position
  limit 1;

  if v_position is null then
    select c.question_id into v_question
    from unnest(p_candidates) with ordinality as c (question_id, place)
    where c.question_id ~ '^[a-z0-9-]+-[0-9]{3}$'
      and not exists (
        select 1 from private.rounds r where r.room_id = p_room_id and r.question_id = c.question_id
      )
      and not exists (
        select 1 from private.game_questions g where g.room_id = p_room_id and g.question_id = c.question_id
      )
    order by c.place
    limit 1;

    if v_question is null then
      return false;
    end if;
  end if;

  select array_agg(p.id order by p.seat) into v_eligible
  from public.players p
  where p.room_id = p_room_id;

  insert into private.rounds (room_id, number, question_id, list_position, eligible)
  values (p_room_id, p_number, v_question, v_position, v_eligible)
  returning id into v_round;

  insert into private.ballot_boxes (round_id) values (v_round);

  return true;
end;
$$;

-- State for the screens -----------------------------------------------------------------------------------------------

-- Definer: the room's state for its host (auth.uid()) or for a player whose token hash is in this room; null for anyone
-- else, whether or not the room exists, a latecomer still waiting included. Returns nicks in seat order and no ids,
-- user ids, hashes or link code, plus the latest round of a game in play: who may vote in it (eligible: the players
-- when it opened, in seat order, so someone let in since then is among the players but not here until the next
-- question), who has voted while it is open (never how, never a count) and whether the round before it was skipped
-- (after_skip); the counts per nick once it is revealed; only its number and phase once it is skipped. A voting or
-- revealed round says its question by question_id, or, for an entry of the list with a text of its own, by
-- question_text (null otherwise). No round in the lobby, and none once the room is closed: a round that ended without a
-- reveal has no counts to show. requests: the nicks of the latecomers waiting, in the order of asking, for the host
-- only; [] for a guest, and in every status (none before the start, and none once the room is closed). question_list:
-- for the host of a room with a list, in every status, its entries not removed in the order of positions and the
-- number of its rows with a question id of the base (base_count, removed and reworded entries included); null for a
-- guest and for a room with no list.
create or replace function public.room_lobby(p_room_id uuid, p_player_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_role text;
  v_me text;
  v_me_id uuid;
  v_round uuid;
  v_number integer;
  v_question text;
  v_list_position integer;
  v_question_text text;
  v_phase text;
  v_eligible uuid[];
  v_abstained integer;
  v_ballots integer;
  v_round_state jsonb;
  v_requests jsonb := '[]'::jsonb;
  v_question_list jsonb;
begin
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id;

  if v_host is null then
    return null;
  end if;

  if v_user is not null and v_user = v_host then
    v_role := 'host';
    select p.id, p.nick into v_me_id, v_me
    from public.players p
    where p.room_id = p_room_id and p.user_id = v_user;
  elsif p_player_token ~ '^[A-Za-z0-9_-]{43}$' then
    select p.id, p.nick into v_me_id, v_me
    from public.player_secrets s
    join public.players p on p.id = s.player_id
    where s.token_hash = sha256(convert_to(p_player_token, 'UTF8')) and p.room_id = p_room_id;

    if v_me is null then
      return null;
    end if;
    v_role := 'guest';
  else
    return null;
  end if;

  -- Only the host decides who comes in, so only the host sees who asks.
  if v_role = 'host' then
    select coalesce(jsonb_agg(q.nick order by q.created_at, q.id), '[]'::jsonb) into v_requests
    from public.join_requests q
    where q.room_id = p_room_id and q.status = 'pending';
  end if;

  -- Only the host reviews the list, so only the host sees it: a guest learns a question when its round opens.
  if v_role = 'host' and exists (select 1 from private.game_questions g where g.room_id = p_room_id) then
    v_question_list := jsonb_build_object(
      'entries', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object('position', g.position, 'question_id', g.question_id, 'text', g.text)
            order by g.position
          ),
          '[]'::jsonb
        )
        from private.game_questions g
        where g.room_id = p_room_id and not g.removed
      ),
      'base_count', (
        select count(*) from private.game_questions g where g.room_id = p_room_id and g.question_id is not null
      )
    );
  end if;

  if v_status = 'playing' then
    select r.id, r.number, r.question_id, r.list_position, r.phase, r.eligible, r.abstained, r.ballots
    into v_round, v_number, v_question, v_list_position, v_phase, v_eligible, v_abstained, v_ballots
    from private.rounds r
    where r.room_id = p_room_id
    order by r.number desc
    limit 1;
  end if;

  -- An own or reworded question has no question id: its text comes from its entry of the list.
  if v_round is not null and v_phase <> 'skipped' and v_question is null then
    select g.text into v_question_text
    from private.game_questions g
    where g.room_id = p_room_id and g.position = v_list_position;
  end if;

  if v_round is not null and v_phase = 'voting' then
    -- Who may vote and who has voted, both in seat order: never the order of voting.
    v_round_state := jsonb_build_object(
      'number', v_number,
      'question_id', v_question,
      'question_text', v_question_text,
      'phase', v_phase,
      'eligible', (
        select coalesce(jsonb_agg(p.nick order by p.seat), '[]'::jsonb)
        from public.players p
        where p.room_id = p_room_id and p.id = any (v_eligible)
      ),
      'voted', (
        select coalesce(jsonb_agg(p.nick order by p.seat), '[]'::jsonb)
        from private.round_voters v
        join public.players p on p.id = v.player_id
        where v.round_id = v_round
      ),
      'me_voted', exists (
        select 1 from private.round_voters v where v.round_id = v_round and v.player_id = v_me_id
      ),
      'after_skip', exists (
        select 1 from private.rounds r
        where r.room_id = p_room_id and r.number = v_number - 1 and r.phase = 'skipped'
      )
    );
  elsif v_round is not null and v_phase = 'skipped' then
    -- Its votes are gone: no count, no question, not even who voted.
    v_round_state := jsonb_build_object('number', v_number, 'phase', v_phase);
  elsif v_round is not null then
    -- Every eligible player in seat order, zeros included: counts per nick and nothing more.
    v_round_state := jsonb_build_object(
      'number', v_number,
      'question_id', v_question,
      'question_text', v_question_text,
      'phase', v_phase,
      'results', (
        select coalesce(
          jsonb_agg(jsonb_build_object('nick', p.nick, 'votes', rr.votes) order by p.seat),
          '[]'::jsonb
        )
        from private.round_results rr
        join public.players p on p.id = rr.player_id
        where rr.round_id = v_round
      ),
      'abstained', v_abstained,
      'ballots', v_ballots
    );
  end if;

  return jsonb_build_object(
    'status', v_status,
    'role', v_role,
    'me', v_me,
    'players', (
      select coalesce(
        jsonb_agg(jsonb_build_object('nick', p.nick, 'host', p.user_id is not null) order by p.seat),
        '[]'::jsonb
      )
      from public.players p
      where p.room_id = p_room_id
    ),
    'round', v_round_state,
    'requests', v_requests,
    'question_list', v_question_list
  );
end;
$$;

-- Function owners and grants ------------------------------------------------------------------------------------------

-- A security definer function runs with its owner's rights; on Supabase that must be postgres. The text helper too, as
-- private.open_next_round in *_round_number_required.sql: the definer functions call it as postgres.
alter function private.question_text(text) owner to postgres;
alter function public.open_question_list(uuid, text[]) owner to postgres;
alter function public.draw_list_question(uuid, text[]) owner to postgres;
alter function public.remove_list_question(uuid, integer) owner to postgres;
alter function public.edit_list_question(uuid, integer, text) owner to postgres;
alter function public.add_own_question(uuid, text) owner to postgres;
alter function public.start_game(uuid, text) owner to postgres;
alter function public.room_lobby(uuid, text) owner to postgres;

-- As in *_full_game_evening.sql: the revokes are repeated for every function this file creates or replaces, so each
-- one's grants read in one place. The private helpers get none: only definer functions call them.
revoke execute on function private.question_text(text) from public, anon, authenticated;
revoke execute on function private.open_next_round(uuid, integer, text[]) from public, anon, authenticated;
revoke execute on function public.open_question_list(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.draw_list_question(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.remove_list_question(uuid, integer) from public, anon, authenticated;
revoke execute on function public.edit_list_question(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.add_own_question(uuid, text) from public, anon, authenticated;
revoke execute on function public.start_game(uuid, text) from public, anon, authenticated;
revoke execute on function public.room_lobby(uuid, text) from public, anon, authenticated;

-- The list is the signed-in host's to review; the room's state stays readable by its guests, who have no session.
grant execute on function public.open_question_list(uuid, text[]) to authenticated;
grant execute on function public.draw_list_question(uuid, text[]) to authenticated;
grant execute on function public.remove_list_question(uuid, integer) to authenticated;
grant execute on function public.edit_list_question(uuid, integer, text) to authenticated;
grant execute on function public.add_own_question(uuid, text) to authenticated;
grant execute on function public.start_game(uuid, text) to authenticated;
grant execute on function public.room_lobby(uuid, text) to anon, authenticated;
