-- deferred-review-fixes: the question's number on every move of a round, and a cap on the candidates' list
-- (context/changes/deferred-review-fixes/plan.md, Faza 2; F2 and F3 of
-- context/archive/2026-10-15-full-game-evening/follow-ups/review-fixes.md).
--
-- A move lands only in the round its sender sees (T1 of context/archive/2026-10-15-full-game-evening/research.md), now
-- for the vote and "Odsłoń wynik" as for "Następne pytanie" and "Pomiń pytanie":
--   - cast_vote takes no vote without p_round: a missing number is round_over, like another number. p_round keeps its
--     default, because it follows p_player_token, which has one; the number is required by the refusal in the body;
--   - reveal_round takes p_round, in one version only (dropped and created here): a missing or another number is
--     round_over, and so is the reveal of a skipped round, which used to answer ok and change nothing. A second reveal
--     of a revealed round still answers ok (D3 of context/archive/2026-10-13-first-live-round/research.md);
--   - private.open_next_round raises 22023 on more than 1000 candidates, before it reads any (the game sends at most
--     216), so next_round and skip_round write nothing then.
--
-- The invariants of every round function in *_first_live_round.sql hold here too: the room's row is locked first,
-- everything is checked before the first write, an expected refusal is data ({ok: false, reason}), never an exception,
-- no function returns a vote's target, counts appear only once a round is revealed, and no round table gets a time or
-- a sequence column. A list no screen of the game sends is not an expected refusal: like a malformed player token, it
-- is an exception.
--
-- Deployment order (plan, Critical Implementation Details): this migration is pushed right before the Worker that uses
-- it, while nobody plays (`npx supabase db push`, then the merge at once). In between, the old Worker's "Odsłoń wynik"
-- sends no p_round and gets round_over, while the last vote still reveals the round; votes from screens loaded since
-- S-03 already carry p_round, and the old Worker passes it on.
--
-- Never edit this file once it has been pushed; a fix is a new migration.

-- Round helper: no grants, called only from the definer functions below -----------------------------------------------

-- Opens round p_number of the room with the first candidate, in the given order, that has the question id format and
-- was not played in this room yet (checked before the insert, so a repeat is never a 23505 with the row's values in
-- DETAIL), with an empty urn. Who may vote: the players in the room now, in seat order (nobody joins a game in play).
-- false when no candidate is left; nothing is written then. The caller holds the room's lock and has checked the room
-- and its latest round.
-- More than 1000 candidates raises an exception, not a refusal: the game sends at most 216 ids, so such a list is
-- malformed input from a client calling the database directly, as a malformed player token is. The exception also
-- rolls back what the caller wrote before the call (the urn skip_round deletes), and its message holds no value of the
-- list.
create or replace function private.open_next_round(p_room_id uuid, p_number integer, p_candidates text[])
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_question text;
  v_eligible uuid[];
  v_round uuid;
begin
  if coalesce(cardinality(p_candidates), 0) > 1000 then
    raise exception 'too many candidates' using errcode = '22023';
  end if;

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

-- A vote only with the question's number ------------------------------------------------------------------------------

-- Definer, for anon and authenticated: a vote. The voter is the host by auth.uid() or a guest by the token, as in
-- room_lobby; p_target is a nick of the room, or null for an abstention. A vote is final. p_round is the number of the
-- question the voter saw: without it, or with another number than the latest round's, the vote is round_over. Only a
-- voting round takes a vote. Writes only the voter's row and the count (the urn invariants in *_first_live_round.sql),
-- and answers { ok: true } and nothing else.
create or replace function public.cast_vote(
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

  -- A choice made at another question never lands in this one, which the voter has not seen; nor does a choice that
  -- names no question.
  if p_round is null or p_round <> v_number then
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

-- "Odsłoń wynik" with the question's number ---------------------------------------------------------------------------

-- One version only (T1): the old one next to this one would reveal a round the host's screen has not shown. Dropped
-- and created in one transaction, so no call finds neither.
drop function public.reveal_round(uuid);

-- Definer, host only: "Odsłoń wynik", at any time and with no threshold (FR-009, D3). p_round is the number of the
-- round on the host's screen, which must be the latest one: without it, or with another number, the reveal is
-- round_over. A second reveal changes nothing and still answers ok (D3); a skipped round has no votes left to show, so
-- its reveal is round_over, as a vote in it is. p_round defaults to null only so that a call without it (the Worker
-- deployed before this migration) gets that named refusal instead of PGRST202 (no such function).
create function public.reveal_round(p_room_id uuid, p_round integer default null)
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
  -- The room's row first, as in cast_vote.
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

  -- A screen behind the game, or a screen that names no question: never reveal a question it has not shown.
  if p_round is null or p_round <> v_number then
    return jsonb_build_object('ok', false, 'reason', 'round_over');
  end if;

  if v_phase = 'voting' then
    perform private.finish_round(v_round);
    return jsonb_build_object('ok', true);
  end if;

  -- D3: the counts are shown already.
  if v_phase = 'revealed' then
    return jsonb_build_object('ok', true);
  end if;

  -- Skipped: its votes are gone, and an ok would say something was revealed.
  return jsonb_build_object('ok', false, 'reason', 'round_over');
end;
$$;

-- Function owners and grants ------------------------------------------------------------------------------------------

-- A security definer function runs with its owner's rights; on Supabase that must be postgres.
alter function private.open_next_round(uuid, integer, text[]) owner to postgres;
alter function public.cast_vote(uuid, text, text, integer) owner to postgres;
alter function public.reveal_round(uuid, integer) owner to postgres;

-- As in *_full_game_evening.sql: the revokes are repeated for every function this file creates or replaces, so each
-- one's grants read in one place. The private helper gets none: only definer functions call it.
revoke execute on function private.open_next_round(uuid, integer, text[]) from public, anon, authenticated;
revoke execute on function public.cast_vote(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.reveal_round(uuid, integer) from public, anon, authenticated;

grant execute on function public.cast_vote(uuid, text, text, integer) to anon, authenticated;
grant execute on function public.reveal_round(uuid, integer) to authenticated;
