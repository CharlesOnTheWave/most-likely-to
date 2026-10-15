-- PRÓBNY ALARM (b) S-03, TYMCZASOWY (context/foundation/test-plan.md §6.2, Break-check). skip_round nie usuwa wierszy urny pominietej rundy.
-- Ma zaświecić: tylko 2 asercje pgTAP 'after the skip, no private.ballot_boxes / round_voters row of round 2 is left'.
-- Cofany git revert w następnym commicie. NIGDY npx supabase db push.
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

  update private.rounds set phase = 'skipped' where id = v_round;

  perform private.open_next_round(p_room_id, v_number + 1, p_candidates);

  return jsonb_build_object('ok', true);
end;
$$;
