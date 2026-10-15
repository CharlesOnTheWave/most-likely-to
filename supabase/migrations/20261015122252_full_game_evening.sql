-- S-03 full-game-evening: the next question, a skipped round and the end of the game
-- (context/changes/full-game-evening/plan.md, Faza 2).
--
-- One round becomes an evening (decisions D1-D4 and T1 of context/changes/full-game-evening/research.md):
--   - the Worker sends the game's pool in its own random order, and the database opens the next round with the first
--     question not yet played in the room (D1); private.rounds' key (room_id, question_id) stays a backstop only;
--   - "Pomiń pytanie" only while a round is voting: its urn is deleted, it stays as a row in phase skipped with no
--     count, and the next question opens in the same transaction (D2, D3); skipping the last question does not end the
--     game;
--   - "Zakończ grę" closes the room and drops the urn of a round in progress, as "Nowa gra" does (D4);
--   - a vote and the host's moves carry the number of the question on the screen, and another number is round_over, so
--     a late screen never votes in a question its player has not seen, and a double click never skips two (T1).
--
-- The invariants of every round function in *_first_live_round.sql hold here too: the room's row is locked first,
-- everything is checked before the first write, an expected refusal is data ({ok: false, reason}), never an exception,
-- no function returns a vote's target, counts appear only once a round is revealed, and no round table gets a time or
-- a sequence column.
--
-- Deployment order (plan, Critical Implementation Details): this migration ships before the Worker that uses it.
-- start_game is unchanged and cast_vote still takes the old Worker's arguments (p_round defaults to null), and the old
-- Worker cannot skip a question, so no round is in phase skipped before the new Worker is deployed.
--
-- Never edit this file once it has been pushed; a fix is a new migration.

-- A round may be skipped ------------------------------------------------------------------------------------------

-- Only widened: every voting and revealed round stays valid.
alter table private.rounds drop constraint rounds_phase_check;
alter table private.rounds add constraint rounds_phase_check check (phase in ('voting', 'revealed', 'skipped'));

-- Round helper: no grants, called only from the definer functions below -----------------------------------------------

-- Opens round p_number of the room with the first candidate, in the given order, that has the question id format and
-- was not played in this room yet (checked before the insert, so a repeat is never a 23505 with the row's values in
-- DETAIL), with an empty urn. Who may vote: the players in the room now, in seat order (nobody joins a game in play).
-- false when no candidate is left; nothing is written then. The caller holds the room's lock and has checked the room
-- and its latest round.
create function private.open_next_round(p_room_id uuid, p_number integer, p_candidates text[])
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_question text;
  v_eligible uuid[];
  v_round uuid;
begin
  select c.question_id into v_question
  from unnest(p_candidates) with ordinality as c (question_id, position)
  where c.question_id ~ '^[a-z0-9-]+-[0-9]{3}$'
    and not exists (
      select 1 from private.rounds r where r.room_id = p_room_id and r.question_id = c.question_id
    )
  order by c.position
  limit 1;

  if v_question is null then
    return false;
  end if;

  select array_agg(p.id order by p.seat) into v_eligible
  from public.players p
  where p.room_id = p_room_id;

  insert into private.rounds (room_id, number, question_id, eligible)
  values (p_room_id, p_number, v_question, v_eligible)
  returning id into v_round;

  insert into private.ballot_boxes (round_id) values (v_round);

  return true;
end;
$$;

-- Host: next question, skip, end --------------------------------------------------------------------------------------

-- Definer, host only: "Następne pytanie". p_round is the number of the round on the host's screen, which must be the
-- latest one, revealed or skipped; p_candidates is the game's pool in the Worker's order.
create function public.next_round(p_room_id uuid, p_round integer, p_candidates text[])
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

  return jsonb_build_object('ok', true);
end;
$$;

-- Definer, host only: "Pomiń pytanie", only while round p_round, the latest one, is voting. Its votes are gone: the urn
-- is deleted, the round stays as a row in phase skipped with no count (D3), and the next question opens at once (D2).
-- { ok: true } also when no candidate is left: the skipped round stays the latest one, and the game goes on.
create function public.skip_round(p_room_id uuid, p_round integer, p_candidates text[])
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

  perform private.open_next_round(p_room_id, v_number + 1, p_candidates);

  return jsonb_build_object('ok', true);
end;
$$;

-- Definer, host only: "Zakończ grę", while the game is in play. Closes the room for everyone and drops the in-progress
-- state of its round (D4); revealed results (counts only) stay, as after "Nowa gra".
create function public.end_game(p_room_id uuid)
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
  -- The room's row first: a vote cast right now is either dropped below or finds the room closed.
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

  if v_status <> 'playing' then
    return jsonb_build_object('ok', false, 'reason', 'no_round');
  end if;

  update public.rooms set status = 'closed' where id = p_room_id;
  perform private.drop_round_state(p_room_id);

  return jsonb_build_object('ok', true);
end;
$$;

-- A vote with the question's number ---------------------------------------------------------------------------------

-- One version only (T1): the old one next to this one would take a vote into a skipped round. Dropped and created in
-- one transaction, so no call finds neither.
drop function public.cast_vote(uuid, text, text);

-- Definer, for anon and authenticated: a vote. The voter is the host by auth.uid() or a guest by the token, as in
-- room_lobby; p_target is a nick of the room, or null for an abstention. A vote is final. p_round is the number of the
-- question the voter saw: another number than the latest round's is round_over. Without it (the Worker deployed before
-- S-03) the vote goes to the latest round, as before. Only a voting round takes a vote. Writes only the voter's row and
-- the count (the urn invariants in *_first_live_round.sql), and answers { ok: true } and nothing else.
create function public.cast_vote(
  p_room_id uuid,
  p_target text,
  p_player_token text default null,
  p_round integer default null
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
  v_voter uuid;
  v_round uuid;
  v_number integer;
  v_phase text;
  v_eligible uuid[];
  v_target uuid;
  v_voters integer;
begin
  -- The server sends either no token (the host) or the cookie's 32-byte token; anything else is not our client.
  if p_player_token is not null and p_player_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid player token' using errcode = '22023';
  end if;

  -- The room's row first: votes to one room take turns, and none lands in a room that is closing or a round that is
  -- being skipped.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  if v_host is null then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  if v_user is not null and v_user = v_host then
    select p.id into v_voter
    from public.players p
    where p.room_id = p_room_id and p.user_id = v_user;
  elsif p_player_token is not null then
    select p.id into v_voter
    from public.player_secrets s
    join public.players p on p.id = s.player_id
    where s.token_hash = sha256(convert_to(p_player_token, 'UTF8')) and p.room_id = p_room_id;
  end if;

  -- Someone who is not in this room learns nothing about it.
  if v_voter is null then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  if v_status = 'closed' then
    return jsonb_build_object('ok', false, 'reason', 'room_closed');
  end if;

  if v_status <> 'playing' then
    return jsonb_build_object('ok', false, 'reason', 'no_round');
  end if;

  select r.id, r.number, r.phase, r.eligible into v_round, v_number, v_phase, v_eligible
  from private.rounds r
  where r.room_id = p_room_id
  order by r.number desc
  limit 1;

  if v_round is null then
    return jsonb_build_object('ok', false, 'reason', 'no_round');
  end if;

  -- A choice made at another question never lands in this one, which the voter has not seen.
  if p_round is not null and p_round <> v_number then
    return jsonb_build_object('ok', false, 'reason', 'round_over');
  end if;

  if v_phase = 'revealed' then
    return jsonb_build_object('ok', false, 'reason', 'round_revealed');
  end if;

  -- A skipped round takes no vote: its votes are gone, and a new one would set its urn up again.
  if v_phase <> 'voting' then
    return jsonb_build_object('ok', false, 'reason', 'round_over');
  end if;

  -- Only who was in the room when the round opened votes in it. Joining is refused during a game, so this cannot
  -- happen in S-03; S-08 decides about late players.
  if not (v_voter = any (v_eligible)) then
    return jsonb_build_object('ok', false, 'reason', 'no_round');
  end if;

  -- Checked here, before any write: the primary key is only a backstop.
  if exists (select 1 from private.round_voters v where v.round_id = v_round and v.player_id = v_voter) then
    return jsonb_build_object('ok', false, 'reason', 'already_voted');
  end if;

  if p_target is not null then
    select p.id into v_target
    from public.players p
    where p.room_id = p_room_id and p.nick = p_target and p.id = any (v_eligible);

    if v_target is null then
      return jsonb_build_object('ok', false, 'reason', 'unknown_target');
    end if;
  end if;

  insert into private.round_voters (round_id, player_id) values (v_round, v_voter);

  -- A crash empties the unlogged urn but keeps the logged round in voting: the votes cast before it are lost (D1 of
  -- S-02), and the first vote after it sets the urn up again, so every later vote counts.
  insert into private.ballot_boxes (round_id) values (v_round) on conflict (round_id) do nothing;

  if v_target is null then
    update private.ballot_boxes b set abstained = b.abstained + 1 where b.round_id = v_round;
  else
    update private.ballot_boxes b
    set tally = jsonb_set(
      b.tally,
      array[v_target::text],
      to_jsonb(coalesce((b.tally ->> v_target::text)::integer, 0) + 1)
    )
    where b.round_id = v_round;
  end if;

  -- The last eligible voter reveals the round.
  select count(*) into v_voters
  from private.round_voters v
  where v.round_id = v_round;

  if v_voters >= cardinality(v_eligible) then
    perform private.finish_round(v_round);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- State for the screens ---------------------------------------------------------------------------------------------

-- Definer: the lobby for the room's host (auth.uid()) or for a player whose token hash is in this room; null for
-- anyone else, whether or not the room exists. Returns nicks in seat order and no ids, user ids, hashes or link code,
-- plus the latest round of a game in play: who has voted while it is open (never how, never a count) and whether the
-- round before it was skipped (after_skip: public to everyone, tied to no one's vote, so a screen that slept through
-- the skip still says the votes were lost); the counts per nick once it is revealed; only its number and phase once it
-- is skipped. No round in the lobby, and none once the room is closed: a round that ended without a reveal has no
-- counts to show.
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
  v_phase text;
  v_abstained integer;
  v_ballots integer;
  v_round_state jsonb;
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

  if v_status = 'playing' then
    select r.id, r.number, r.question_id, r.phase, r.abstained, r.ballots
    into v_round, v_number, v_question, v_phase, v_abstained, v_ballots
    from private.rounds r
    where r.room_id = p_room_id
    order by r.number desc
    limit 1;
  end if;

  if v_round is not null and v_phase = 'voting' then
    -- Who has voted, in seat order: never the order of voting.
    v_round_state := jsonb_build_object(
      'number', v_number,
      'question_id', v_question,
      'phase', v_phase,
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
    'round', v_round_state
  );
end;
$$;

-- Function owners and grants ------------------------------------------------------------------------------------------

-- A security definer function runs with its owner's rights; on Supabase that must be postgres.
alter function public.next_round(uuid, integer, text[]) owner to postgres;
alter function public.skip_round(uuid, integer, text[]) owner to postgres;
alter function public.end_game(uuid) owner to postgres;
alter function public.cast_vote(uuid, text, text, integer) owner to postgres;
alter function public.room_lobby(uuid, text) owner to postgres;

-- As in *_first_live_round.sql: the revokes are repeated for every function this file creates or replaces, so each
-- one's grants read in one place. The private helper gets none: only definer functions call it.
revoke execute on function private.open_next_round(uuid, integer, text[]) from public, anon, authenticated;
revoke execute on function public.next_round(uuid, integer, text[]) from public, anon, authenticated;
revoke execute on function public.skip_round(uuid, integer, text[]) from public, anon, authenticated;
revoke execute on function public.end_game(uuid) from public, anon, authenticated;
revoke execute on function public.cast_vote(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.room_lobby(uuid, text) from public, anon, authenticated;

grant execute on function public.next_round(uuid, integer, text[]) to authenticated;
grant execute on function public.skip_round(uuid, integer, text[]) to authenticated;
grant execute on function public.end_game(uuid) to authenticated;
grant execute on function public.cast_vote(uuid, text, text, integer) to anon, authenticated;
grant execute on function public.room_lobby(uuid, text) to anon, authenticated;
