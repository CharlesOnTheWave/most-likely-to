-- BREAK-CHECK (b), temporary: reverted with git revert right after CI, never pushed to a database (test-plan §6.2).
-- cast_vote answers also the target's count so far (for an abstention, the abstentions so far).
-- Expected red: only tests/db/round-anonymity.test.ts "cast_vote answers exactly { ok: true }, to a guest and to the host".
create or replace function public.cast_vote(p_room_id uuid, p_target text, p_player_token text default null)
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
  v_phase text;
  v_eligible uuid[];
  v_target uuid;
  v_voters integer;
  v_count integer;
begin
  -- The server sends either no token (the host) or the cookie's 32-byte token; anything else is not our client.
  if p_player_token is not null and p_player_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid player token' using errcode = '22023';
  end if;

  -- The room's row first: votes to one room take turns, and none lands in a room that is closing.
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

  select r.id, r.phase, r.eligible into v_round, v_phase, v_eligible
  from private.rounds r
  where r.room_id = p_room_id
  order by r.number desc
  limit 1;

  if v_round is null then
    return jsonb_build_object('ok', false, 'reason', 'no_round');
  end if;

  if v_phase = 'revealed' then
    return jsonb_build_object('ok', false, 'reason', 'round_revealed');
  end if;

  -- Only who was in the room at the start votes in this round. Joining is refused during a game, so this cannot happen
  -- in S-02; S-08 decides about late players.
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

  if v_target is null then
    update private.ballot_boxes b set abstained = b.abstained + 1 where b.round_id = v_round
    returning b.abstained into v_count;
  else
    update private.ballot_boxes b
    set tally = jsonb_set(
      b.tally,
      array[v_target::text],
      to_jsonb(coalesce((b.tally ->> v_target::text)::integer, 0) + 1)
    )
    where b.round_id = v_round
    returning (b.tally ->> v_target::text)::integer into v_count;
  end if;

  -- The last eligible voter reveals the round.
  select count(*) into v_voters
  from private.round_voters v
  where v.round_id = v_round;

  if v_voters >= cardinality(v_eligible) then
    perform private.finish_round(v_round);
  end if;

  return jsonb_build_object('ok', true, 'votes', v_count);
end;
$$;
