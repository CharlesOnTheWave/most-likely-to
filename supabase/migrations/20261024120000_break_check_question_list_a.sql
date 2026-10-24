-- BREAK-CHECK A, temporary (context/changes/question-list-review/plan.md, Faza 1 #4): reverted right after CI.
-- room_lobby gives a guest the room's question list too.
-- Expected red: question-list.test.ts "in the lobby a guest sees question_list: null while the host's list is open"
-- and "while the game is in play a guest still sees question_list: null"; everything else green.

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
  if exists (select 1 from private.game_questions g where g.room_id = p_room_id) then
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
