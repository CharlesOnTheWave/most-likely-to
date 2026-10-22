-- S-08 latecomer-admission: a latecomer asks to join a game in play, and the host lets them in or turns them away
-- (context/changes/latecomer-admission/plan.md, Faza 1; PRD FR-020).
--
-- A request to join is a thing of its own, never a row in players or player_secrets before the host lets it in:
-- room_lobby takes anyone whose token hash is in player_secrets for a player of the room as that player. Its life:
--   - request_join (anon, with the token the Worker keeps in the room's cookie): pending, at most 5 at once per room,
--     with a nick under join_room's rule that no player and no other pending request has;
--   - admit_latecomer (the host, "Wpuść"): a player at the next seat with the request's nick; the request's token hash
--     moves to player_secrets, so the latecomer's cookie opens the room, and the request is deleted;
--   - reject_latecomer (the host, "Odrzuć"): rejected; the same token may ask again, and its request is pending again;
--   - every closing of the room (end_game, "Nowa gra" in create_room, private.close_stale_games) deletes the room's
--     requests in private.drop_round_state.
-- Only the host sees the nicks waiting (room_lobby's requests); a latecomer sees only its own request
-- (join_request_state), never the question, the players or anyone else's request.
--
-- Who votes in a round stays the snapshot of the players when it opened (start_game, private.open_next_round): someone
-- let in mid-round sees the round and votes from the next question on, with no change to cast_vote. room_lobby now
-- says who they are (round.eligible), so a screen counts and offers only them. The comments "nobody joins a game in
-- play" in *_full_game_evening.sql and *_round_number_required.sql predate this file: a game in play still takes no
-- one through join_room (game_started), and a latecomer comes in only through a request.
--
-- The requests live in public, like player_secrets, not in private: no grants and no policies, reached only through
-- the definer functions below, and with a time column (the host's list in the order of asking), which no table of
-- schema private may have (supabase/tests/round_creator_view.test.sql).
--
-- The invariants of every round function in *_first_live_round.sql hold here too: the room's row is locked first,
-- everything is checked before the first write, an expected refusal is data ({ok: false, reason}), never an exception,
-- and no function returns a vote's target or a count before the reveal.
--
-- Deployment order (plan, Critical Implementation Details): this migration ships before the Worker that uses it. It
-- only adds: the Worker deployed before it copies only the keys of its own contract from room_lobby, and nothing calls
-- the new functions yet.
--
-- Never edit this file once it has been pushed; a fix is a new migration.

-- Requests to join: schema public, no grants, no policies ---------------------------------------------------------

-- One row per latecomer's token in a room, with a random id.
create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  -- The nick as shown, after private.normalize_nick, as in players.
  nick text not null check (char_length(nick) between 1 and 20),
  -- The nick as compared, as in players.
  nick_key text generated always as (private.nick_key(nick)) stored,
  -- sha256 of the token in the latecomer's cookie mlt_player_<roomId>, which becomes the player's token once let in.
  -- Unique across rooms: the Worker's token belongs to one room.
  token_hash bytea not null unique,
  status text not null default 'pending' check (status in ('pending', 'rejected')),
  -- The host's list in the order of asking. A request, not a vote: no round table holds a time.
  created_at timestamptz not null default now()
);

-- Two latecomers waiting never share a nick. A backstop only: request_join checks it under the room's lock.
create unique index join_requests_pending_nick_key on public.join_requests (room_id, nick_key) where status = 'pending';

alter table public.join_requests enable row level security;

-- Reached only through the definer functions below, like player_secrets: neither a host nor anyone else reads a token
-- hash or another latecomer's request back.
revoke all on table public.join_requests from public, anon, authenticated;

-- Closing the room ----------------------------------------------------------------------------------------------------

-- Everything a game in play keeps apart from its players, dropped whenever the room closes (end_game, "Nowa gra" in
-- create_room, private.close_stale_games): the urn of a round that ends without a reveal, so no voter and no count
-- stays (D1 of S-02), and the room's requests to join, pending or rejected. Results already revealed stay. Never at a
-- reveal: a request waits for the host's answer through every round.
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

  delete from public.join_requests q
  where q.room_id = p_room_id;
$$;

-- Latecomer: ask, and see how the request stands ----------------------------------------------------------------------

-- Definer: a public endpoint for anon, like join_room, so every check lives here. A game in play takes no one new
-- through join_room; a latecomer asks the host here instead, with the token of the room's cookie, and only its sha256
-- is stored. The checks in join_room's order, all before the first write: the token's format, the link and the room's
-- lock, the room's status, a player already, the nick rule, a request already waiting, a nick taken, the room's limit
-- of 5 waiting. { ok: true } also when nothing changes (a player already, or a request already waiting: the form sent
-- twice), so the screen moves on to the room or to waiting.
create function public.request_join(p_link_token text, p_nick text, p_player_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room uuid;
  v_status text;
  v_hash bytea;
  v_nick text;
  v_request uuid;
  v_request_status text;
begin
  -- The server sends the cookie's 32-byte token or a fresh one; anything else is not our client.
  if p_player_token is null or p_player_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid player token' using errcode = '22023';
  end if;

  if p_link_token is null or p_link_token !~ '^[A-Za-z0-9_-]{22}$' then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  -- The row lock makes requests to one room take turns (the limit, the nicks) and orders them against the host letting
  -- someone in, a round opening and the room closing.
  select r.id, r.status into v_room, v_status
  from public.rooms r
  where r.link_token = p_link_token
  for update;

  if v_room is null then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  -- Before the start anyone joins through join_room, without the host.
  if v_status = 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'room_open');
  end if;

  if v_status <> 'playing' then
    return jsonb_build_object('ok', false, 'reason', 'room_closed');
  end if;

  v_hash := sha256(convert_to(p_player_token, 'UTF8'));

  -- Let in already: the screen moves on to the room.
  if exists (
    select 1
    from public.player_secrets s
    join public.players p on p.id = s.player_id
    where s.token_hash = v_hash and p.room_id = v_room
  ) then
    return jsonb_build_object('ok', true);
  end if;

  -- A cap before the nick rule, so its regular expressions never run on a very long text.
  if char_length(p_nick) > 100 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_nick');
  end if;

  -- A nick of only selectors or tags looks empty too.
  v_nick := private.normalize_nick(p_nick);
  if v_nick is null or char_length(v_nick) not between 1 and 20 or private.nick_key(v_nick) = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_nick');
  end if;

  select q.id, q.status into v_request, v_request_status
  from public.join_requests q
  where q.token_hash = v_hash and q.room_id = v_room;

  -- Waiting already, under the nick it asked with: the form sent twice changes nothing.
  if v_request_status = 'pending' then
    return jsonb_build_object('ok', true);
  end if;

  -- What looks the same is the same nick, among the players and the latecomers waiting (this token's own request is not
  -- waiting by now).
  if exists (
    select 1 from public.players p where p.room_id = v_room and p.nick_key = private.nick_key(v_nick)
  ) or exists (
    select 1 from public.join_requests q
    where q.room_id = v_room and q.status = 'pending' and q.nick_key = private.nick_key(v_nick)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'nick_taken');
  end if;

  -- At most 5 wait at once, so the host's list never covers the game.
  if (
    select count(*) from public.join_requests q where q.room_id = v_room and q.status = 'pending'
  ) >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'requests_full');
  end if;

  -- Turned away before: the same request asks again, under the nick sent now, and takes its place at the end of the
  -- host's list, as a request made now.
  if v_request is not null then
    update public.join_requests
    set nick = v_nick, status = 'pending', created_at = now()
    where id = v_request;
  else
    insert into public.join_requests (room_id, nick, token_hash)
    values (v_room, v_nick, v_hash);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Definer, for anon and authenticated: how the latecomer's own request stands, for the waiting screen; writes nothing.
-- { state: "admitted" } once the token is a player of the room; { state: "closed" } once the room is closed (its
-- requests went with it); { state: "pending" | "rejected", nick } for the token's request in the room;
-- { state: "none" } otherwise: a malformed token, an unknown room, or a token with nothing in this room. Never the
-- question, the players or anyone else's request: whoever is still outside sees nothing of the game.
create function public.join_request_state(p_room_id uuid, p_player_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_hash bytea;
  v_nick text;
  v_request_status text;
begin
  if p_player_token is null or p_player_token !~ '^[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('state', 'none');
  end if;

  select r.status into v_status
  from public.rooms r
  where r.id = p_room_id;

  if v_status is null then
    return jsonb_build_object('state', 'none');
  end if;

  v_hash := sha256(convert_to(p_player_token, 'UTF8'));

  if exists (
    select 1
    from public.player_secrets s
    join public.players p on p.id = s.player_id
    where s.token_hash = v_hash and p.room_id = p_room_id
  ) then
    return jsonb_build_object('state', 'admitted');
  end if;

  if v_status = 'closed' then
    return jsonb_build_object('state', 'closed');
  end if;

  select q.nick, q.status into v_nick, v_request_status
  from public.join_requests q
  where q.token_hash = v_hash and q.room_id = p_room_id;

  if v_request_status is null then
    return jsonb_build_object('state', 'none');
  end if;

  return jsonb_build_object('state', v_request_status, 'nick', v_nick);
end;
$$;

-- Host: let a latecomer in, or turn them away ------------------------------------------------------------------------

-- Definer, host only: "Wpuść". p_nick is a nick on the host's list: the pending request with that nick (as compared)
-- becomes a player at the next seat, under the request's nick, with the request's token hash in player_secrets; the
-- request is deleted. The new player sees the round in progress and votes from the next question on: who votes in a
-- round stays who was in the room when it opened.
create function public.admit_latecomer(p_room_id uuid, p_nick text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_request uuid;
  v_nick text;
  v_hash bytea;
  v_player uuid;
  v_constraint text;
begin
  -- The room's row first: a request, a vote or another move of the host right now waits for this one.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  -- Another host's room looks like no room at all.
  if v_host is null or v_user is null or v_user <> v_host then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  -- Requests wait only while the game is in play. A nick over the nick rule's cap is on no list, and its regular
  -- expressions never run on it.
  if v_status = 'playing' and char_length(p_nick) <= 100 then
    select q.id, q.nick, q.token_hash into v_request, v_nick, v_hash
    from public.join_requests q
    where q.room_id = p_room_id and q.status = 'pending' and q.nick_key = private.nick_key(p_nick);
  end if;

  -- Let in or turned away already (a double click, the host's second screen), or the room is no longer in play.
  if v_request is null then
    return jsonb_build_object('ok', false, 'reason', 'request_unknown');
  end if;

  -- A backstop only: request_join keeps a waiting nick apart from the players under the room's lock, and nobody joins
  -- a game in play another way. Its own refusal, because nick_taken speaks to the one who asks, not to the host.
  begin
    insert into public.players (room_id, nick, seat)
    select p_room_id, v_nick, coalesce(max(p.seat), 0) + 1
    from public.players p
    where p.room_id = p_room_id
    returning id into v_player;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'players_room_nick_key' then
        return jsonb_build_object('ok', false, 'reason', 'latecomer_nick_taken');
      end if;
      raise;
  end;

  insert into public.player_secrets (player_id, token_hash)
  values (v_player, v_hash);

  delete from public.join_requests where id = v_request;

  return jsonb_build_object('ok', true);
end;
$$;

-- Definer, host only: "Odrzuć", with admit_latecomer's checks. The request stays, rejected: the latecomer's screen says
-- so, and the same token may ask again through request_join. Its nick is free for others meanwhile.
create function public.reject_latecomer(p_room_id uuid, p_nick text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_request uuid;
begin
  -- The room's row first, as in admit_latecomer.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  -- Another host's room looks like no room at all.
  if v_host is null or v_user is null or v_user <> v_host then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  if v_status = 'playing' and char_length(p_nick) <= 100 then
    select q.id into v_request
    from public.join_requests q
    where q.room_id = p_room_id and q.status = 'pending' and q.nick_key = private.nick_key(p_nick);
  end if;

  if v_request is null then
    return jsonb_build_object('ok', false, 'reason', 'request_unknown');
  end if;

  update public.join_requests set status = 'rejected' where id = v_request;

  return jsonb_build_object('ok', true);
end;
$$;

-- State for the screens -----------------------------------------------------------------------------------------------

-- Definer: the room's state for its host (auth.uid()) or for a player whose token hash is in this room; null for anyone
-- else, whether or not the room exists, a latecomer still waiting included. Returns nicks in seat order and no ids,
-- user ids, hashes or link code, plus the latest round of a game in play: who may vote in it (eligible: the players
-- when it opened, in seat order, so someone let in since then is among the players but not here until the next
-- question), who has voted while it is open (never how, never a count) and whether the round before it was skipped
-- (after_skip); the counts per nick once it is revealed; only its number and phase once it is skipped. No round in the
-- lobby, and none once the room is closed: a round that ended without a reveal has no counts to show. requests: the
-- nicks of the latecomers waiting, in the order of asking, for the host only; [] for a guest, and in every status (none
-- before the start, and none once the room is closed).
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
  if v_role = 'host' then
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

-- Function owners and grants ------------------------------------------------------------------------------------------

-- A security definer function runs with its owner's rights; on Supabase that must be postgres.
alter function public.request_join(text, text, text) owner to postgres;
alter function public.join_request_state(uuid, text) owner to postgres;
alter function public.admit_latecomer(uuid, text) owner to postgres;
alter function public.reject_latecomer(uuid, text) owner to postgres;
alter function public.room_lobby(uuid, text) owner to postgres;

-- As in *_full_game_evening.sql: the revokes are repeated for every function this file creates or replaces, so each
-- one's grants read in one place. The private helper gets none: only definer functions call it.
revoke execute on function private.drop_round_state(uuid) from public, anon, authenticated;
revoke execute on function public.request_join(text, text, text) from public, anon, authenticated;
revoke execute on function public.join_request_state(uuid, text) from public, anon, authenticated;
revoke execute on function public.admit_latecomer(uuid, text) from public, anon, authenticated;
revoke execute on function public.reject_latecomer(uuid, text) from public, anon, authenticated;
revoke execute on function public.room_lobby(uuid, text) from public, anon, authenticated;

-- The latecomer has no session, so asking and its own request's state are public endpoints; letting in and turning
-- away are the signed-in host's.
grant execute on function public.request_join(text, text, text) to anon, authenticated;
grant execute on function public.join_request_state(uuid, text) to anon, authenticated;
grant execute on function public.admit_latecomer(uuid, text) to authenticated;
grant execute on function public.reject_latecomer(uuid, text) to authenticated;
grant execute on function public.room_lobby(uuid, text) to anon, authenticated;
