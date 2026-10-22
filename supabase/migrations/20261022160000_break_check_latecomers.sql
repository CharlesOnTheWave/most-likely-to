-- BREAK-CHECK, temporary (context/changes/latecomer-admission/plan.md, Faza 1 #4): reverted right after CI.
-- (a) room_lobby gives a guest the room's requests; (b) drop_round_state no longer deletes the room's requests.
-- Expected red: latecomers.test.ts "while round 1 is voting the host sees requests: [Kuba] and a guest sees
-- requests: []" and "after the end Ula's request is closed and the host sees no requests"; pgTAP 64, 89 and 121.

create or replace function private.drop_round_state(p_room_id uuid)
returns void
language sql
set search_path = ''
as $$
  delete from private.round_voters v
  using private.rounds r
  where r.id = v.round_id and r.room_id = p_room_id;

  delete from private.ballot_boxes b
  using private.rounds r
  where r.id = b.round_id and r.room_id = p_room_id;
$$;

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
  v_eligible uuid[];
  v_abstained integer;
  v_ballots integer;
  v_round_state jsonb;
  v_requests jsonb := '[]'::jsonb;
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
  if v_role in ('host', 'guest') then
    select coalesce(jsonb_agg(q.nick order by q.created_at, q.id), '[]'::jsonb) into v_requests
    from public.join_requests q
    where q.room_id = p_room_id and q.status = 'pending';
  end if;

  if v_status = 'playing' then
    select r.id, r.number, r.question_id, r.phase, r.eligible, r.abstained, r.ballots
    into v_round, v_number, v_question, v_phase, v_eligible, v_abstained, v_ballots
    from private.rounds r
    where r.room_id = p_room_id
    order by r.number desc
    limit 1;
  end if;

  if v_round is not null and v_phase = 'voting' then
    -- Who may vote and who has voted, both in seat order: never the order of voting.
    v_round_state := jsonb_build_object(
      'number', v_number,
      'question_id', v_question,
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
    'requests', v_requests
  );
end;
$$;

alter function public.room_lobby(uuid, text) owner to postgres;
revoke execute on function private.drop_round_state(uuid) from public, anon, authenticated;
revoke execute on function public.room_lobby(uuid, text) from public, anon, authenticated;
grant execute on function public.room_lobby(uuid, text) to anon, authenticated;
