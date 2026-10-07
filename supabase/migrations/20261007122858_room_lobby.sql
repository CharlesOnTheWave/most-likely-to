-- S-01 room-lobby: rooms, players and the guest's identity (context/changes/room-lobby/plan.md, Phase 1).
--
-- Closed by default. Every table gets RLS and only explicit grants, and every function first revokes the EXECUTE that
-- Postgres gives PUBLIC (and Supabase gives anon and authenticated), then grants it back to the roles that need it.
-- This holds before and after Supabase stops granting new public tables to the API roles (30.10.2026 for existing
-- projects).
--
-- The host writes through RLS as authenticated (create_room is security invoker). A guest reaches the tables only
-- through the security definer functions join_room, room_link and room_lobby. Anyone with the publishable key can call
-- them directly, bypassing the Worker, so every check lives inside them.
--
-- Never edit this file once it has been pushed; a fix is a new migration.

create schema if not exists private;
revoke all on schema private from public;

-- Tables ------------------------------------------------------------------------------------------------------------

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  -- The code in /j/<code>. Separate from id and the live-sync topic, so S-09 can replace the link and keep the room.
  link_token text not null unique check (link_token ~ '^[A-Za-z0-9_-]{22}$'),
  -- S-02 adds the game states.
  status text not null default 'lobby' check (status in ('lobby', 'closed')),
  categories text[] not null check (cardinality(categories) >= 1),
  adult_categories text[] not null default '{}' check (adult_categories <@ categories),
  created_at timestamptz not null default now()
);

-- At most one open room per host: "Nowa gra" closes the previous one.
create unique index rooms_one_open_per_host on public.rooms (host_id) where status = 'lobby';

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  nick text not null check (char_length(nick) between 1 and 20),
  -- Set only for the host. Nothing about a guest is kept but the nick (PRD).
  user_id uuid references auth.users (id) on delete cascade,
  -- Join order (host 1, then guests) instead of a join time.
  seat integer not null,
  constraint players_room_nick_key unique (room_id, nick),
  constraint players_room_user_key unique (room_id, user_id),
  constraint players_room_seat_key unique (room_id, seat)
);

-- The guest's identity: sha256 of the token in their httpOnly cookie. No grants and no policies on purpose: only the
-- security definer functions below read or write it, so neither a host nor anyone else can read a hash back.
create table public.player_secrets (
  player_id uuid primary key references public.players (id) on delete cascade,
  token_hash bytea not null unique
);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.player_secrets enable row level security;

revoke all on table public.rooms, public.players, public.player_secrets from public, anon, authenticated;
grant select, insert on table public.rooms to authenticated;
grant update (status) on table public.rooms to authenticated;
grant select, insert on table public.players to authenticated;

-- Policies: the host only, per operation -----------------------------------------------------------------------------

create policy "Hosts read their rooms" on public.rooms
  for select to authenticated
  using (host_id = (select auth.uid()));

create policy "Hosts open their rooms" on public.rooms
  for insert to authenticated
  with check (host_id = (select auth.uid()) and status = 'lobby');

create policy "Hosts update their rooms" on public.rooms
  for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy "Hosts read players in their rooms" on public.players
  for select to authenticated
  using (exists (
    select 1 from public.rooms r
    where r.id = players.room_id and r.host_id = (select auth.uid())
  ));

create policy "Hosts join their open rooms" on public.players
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.rooms r
      where r.id = players.room_id and r.host_id = (select auth.uid()) and r.status = 'lobby'
    )
  );

-- Nick ---------------------------------------------------------------------------------------------------------------

-- What looks the same is the same nick: NFC, Unicode whitespace (and the blank U+2800) to a space, control and
-- invisible characters removed, runs of spaces collapsed, edges trimmed. Case counts ("Ola" and "ola" are two nicks).
-- Removing U+200D splits joined emoji into their parts; accepted. Look-alike letters from other scripts are an
-- accepted risk. NFC runs again at the end, because a removed invisible character can leave a letter next to its
-- combining mark.
create function private.normalize_nick(p_nick text)
returns text
language sql
immutable
set search_path = ''
as $$
  select normalize(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            normalize(p_nick, NFC),
            '[\u0009-\u000D\u0085   -     ⠀　]', ' ', 'g'
          ),
          '[\u0001-\u001F\u007F-\u009F­͏ᅟᅠ឴឵᠋-᠎​-‏‪-‮⁠-⁯ㅤ﻿ﾠ]',
          '', 'g'
        ),
        ' {2,}', ' ', 'g'
      ),
      ' '
    ),
    NFC
  )
$$;

-- Host: new room -------------------------------------------------------------------------------------------------------

-- Invoker: runs through the host's RLS. Closes the host's open room (asks first when guests are in it), then opens a
-- new one with the host as player 1, in one transaction.
create function public.create_room(
  p_nick text,
  p_link_token text,
  p_categories text[],
  p_adult_categories text[],
  p_confirm_close boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_host uuid := (select auth.uid());
  v_nick text := private.normalize_nick(p_nick);
  v_open_room uuid;
  v_closed_room uuid;
  v_room uuid;
begin
  if v_host is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  if v_nick is null or char_length(v_nick) not between 1 and 20 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_nick');
  end if;

  if coalesce(cardinality(p_categories), 0) < 1
    or array_position(p_categories, null) is not null
    or not (coalesce(p_adult_categories, '{}') <@ p_categories) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_categories');
  end if;

  -- One block, so a unique_violation below also undoes closing the old room.
  begin
    -- The lock orders this against join_room: a guest joining right now is either counted below or finds the room
    -- closed.
    select r.id into v_open_room
    from public.rooms r
    where r.host_id = v_host and r.status = 'lobby'
    for update;

    if v_open_room is not null then
      if not coalesce(p_confirm_close, false) and exists (
        select 1 from public.players p where p.room_id = v_open_room and p.user_id is null
      ) then
        return jsonb_build_object('ok', false, 'reason', 'open_room_has_guests');
      end if;

      update public.rooms set status = 'closed' where id = v_open_room;
      v_closed_room := v_open_room;
    end if;

    insert into public.rooms (host_id, link_token, categories, adult_categories)
    values (v_host, p_link_token, p_categories, coalesce(p_adult_categories, '{}'))
    returning id into v_room;

    insert into public.players (room_id, nick, user_id, seat)
    values (v_room, v_nick, v_host, 1);
  exception
    -- Two "Załóż grę" at once: the second one hits the one-open-room index.
    when unique_violation then
      return jsonb_build_object('ok', false, 'reason', 'try_again');
  end;

  return jsonb_build_object('ok', true, 'room_id', v_room, 'closed_room_id', v_closed_room);
end;
$$;

-- Guest: join, link state, lobby state ------------------------------------------------------------------------------

-- Definer: a public endpoint for anon. Takes the raw player token and stores only its sha256, so a hash read from
-- anywhere never works as the token.
create function public.join_room(p_link_token text, p_nick text, p_player_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room uuid;
  v_status text;
  v_nick text;
  v_player uuid;
  v_constraint text;
begin
  -- The server always sends a fresh 32-byte token; anything else is not our client.
  if p_player_token is null or p_player_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid player token' using errcode = '22023';
  end if;

  if p_link_token is null or p_link_token !~ '^[A-Za-z0-9_-]{22}$' then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  -- The row lock makes joins to one room take turns (seat numbers) and orders them against create_room closing it.
  select r.id, r.status into v_room, v_status
  from public.rooms r
  where r.link_token = p_link_token
  for update;

  if v_room is null then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  -- S-02 decides about joining after the start.
  if v_status <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'room_closed');
  end if;

  v_nick := private.normalize_nick(p_nick);
  if v_nick is null or char_length(v_nick) not between 1 and 20 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_nick');
  end if;

  begin
    insert into public.players (room_id, nick, seat)
    select v_room, v_nick, coalesce(max(p.seat), 0) + 1
    from public.players p
    where p.room_id = v_room
    returning id into v_player;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'players_room_nick_key' then
        return jsonb_build_object('ok', false, 'reason', 'nick_taken');
      end if;
      raise;
  end;

  insert into public.player_secrets (player_id, token_hash)
  values (v_player, sha256(convert_to(p_player_token, 'UTF8')));

  return jsonb_build_object('ok', true, 'room_id', v_room);
end;
$$;

-- Definer: what the /j/<code> page needs, nothing more. A malformed code is just unknown.
create function public.room_link(p_link_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_room uuid;
  v_status text;
begin
  if p_link_token is null or p_link_token !~ '^[A-Za-z0-9_-]{22}$' then
    return jsonb_build_object('status', 'unknown');
  end if;

  select r.id, r.status into v_room, v_status
  from public.rooms r
  where r.link_token = p_link_token;

  if v_room is null then
    return jsonb_build_object('status', 'unknown');
  end if;

  if v_status = 'lobby' then
    return jsonb_build_object('status', 'open', 'room_id', v_room);
  end if;

  return jsonb_build_object('status', 'closed');
end;
$$;

-- Definer: the lobby for the room's host (auth.uid()) or for a player whose token hash is in this room; null for
-- anyone else, whether or not the room exists. Returns nicks in seat order and no ids, user ids, hashes or link code.
create function public.room_lobby(p_room_id uuid, p_player_token text default null)
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
begin
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id;

  if v_host is null then
    return null;
  end if;

  if v_user is not null and v_user = v_host then
    v_role := 'host';
    select p.nick into v_me
    from public.players p
    where p.room_id = p_room_id and p.user_id = v_user;
  elsif p_player_token ~ '^[A-Za-z0-9_-]{43}$' then
    select p.nick into v_me
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
    )
  );
end;
$$;

-- Function owners and grants -------------------------------------------------------------------------------------------

-- A security definer function runs with its owner's rights; on Supabase that must be postgres.
alter function public.join_room(text, text, text) owner to postgres;
alter function public.room_link(text) owner to postgres;
alter function public.room_lobby(uuid, text) owner to postgres;

revoke execute on function private.normalize_nick(text) from public, anon, authenticated;
revoke execute on function public.create_room(text, text, text[], text[], boolean) from public, anon, authenticated;
revoke execute on function public.join_room(text, text, text) from public, anon, authenticated;
revoke execute on function public.room_link(text) from public, anon, authenticated;
revoke execute on function public.room_lobby(uuid, text) from public, anon, authenticated;

-- create_room runs as the host, so the host needs the nick rule too. private is not exposed in the API.
grant usage on schema private to authenticated;
grant execute on function private.normalize_nick(text) to authenticated;
grant execute on function public.create_room(text, text, text[], text[], boolean) to authenticated;
grant execute on function public.join_room(text, text, text) to anon, authenticated;
grant execute on function public.room_link(text) to anon, authenticated;
grant execute on function public.room_lobby(uuid, text) to anon, authenticated;
