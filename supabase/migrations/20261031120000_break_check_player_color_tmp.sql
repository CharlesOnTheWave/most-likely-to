-- TEMPORARY break-check for S-18 phase 1 (plan 1.4; test-plan.md §6.2 "Break-check"). Reverted in the next commit;
-- never pushed to any database (never `npx supabase db push` this file).
-- (a) set_player_color lets a taken colour through: no color_taken refusal.
-- (b) private.free_color always gives 0.

create or replace function private.free_color(p_room_id uuid)
returns smallint
language sql
stable
set search_path = ''
as $$
  select 0::smallint
$$;

create or replace function public.set_player_color(p_room_id uuid, p_color integer, p_player_token text default null)
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
  v_color smallint;
begin
  if p_color is null or p_color not between 0 and 19 then
    raise exception 'invalid color' using errcode = '22023';
  end if;

  if p_player_token is not null and p_player_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid player token' using errcode = '22023';
  end if;

  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  if v_host is not null and v_user is not null and v_user = v_host then
    select p.id, p.color into v_player, v_color
    from public.players p
    where p.room_id = p_room_id and p.user_id = v_user;
  elsif v_host is not null and p_player_token is not null then
    select p.id, p.color into v_player, v_color
    from public.player_secrets s
    join public.players p on p.id = s.player_id
    where s.token_hash = sha256(convert_to(p_player_token, 'UTF8')) and p.room_id = p_room_id;
  end if;

  if v_player is null then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  if v_status = 'closed' then
    return jsonb_build_object('ok', false, 'reason', 'room_closed');
  end if;

  -- BROKEN (a): no check that another player of the room has p_color.
  if v_color <> p_color then
    update public.players set color = p_color where id = v_player;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
