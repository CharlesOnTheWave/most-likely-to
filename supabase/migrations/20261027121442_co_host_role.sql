-- S-07 co-host-role: the host gives a guest of the room the co-host role, and a co-host leads the game as the host does
-- (context/changes/co-host-role/plan.md, Faza 1; PRD FR-003, FR-006, FR-009, FR-020 and Access Control).
--
-- The leader (prowadzący) is the room's host or a co-host. A co-host is a guest with players.cohost set: any guest of
-- the room, a latecomer let in included, and any number of them; never the host's own row (a check). Only the host
-- gives and takes the role (set_cohost), in the lobby and while the game is in play. No API role writes the flag:
-- authenticated keeps select on players only, and no grant or policy is added.
--
-- A guest has no session, so the seven moves of the leader take the player token as the vote does: start_game,
-- reveal_round, next_round, skip_round, end_game, admit_latecomer and reject_latecomer get p_player_token text default
-- null as their last argument and are granted to anon too. Each is dropped and created in this transaction (create or
-- replace would leave the old version beside it, a door its check does not guard), from its latest definition with only
-- the host check changed: right after the room's row lock, private.leader_refusal decides who moves the game. The
-- leader is the host by auth.uid(), or a player of this room with the co-host role by the sha256 of the token; a player
-- of the room without the role gets not_leader, anyone else room_unknown, as before; a malformed token raises 22023, as
-- in cast_vote. Every other check stays inside each function, which is now a public endpoint.
--
-- What the database still does not check (known hole F1 of context/changes/co-host-role/reviews/plan-review.md, pinned
-- by a test.fails in tests/db/cohost.test.ts): the game's pool. start_game, next_round and skip_round check only the
-- format of the question ids the Worker draws from the picked categories (FR-005), so a co-host calling them with the
-- token of its own cookie could open a question of another category, or an 18+ one the host did not include. Until
-- now only the host could, in its own room.
--
-- room_lobby (same signature, create or replace): a player is { nick, host, cohost }, so everyone sees who leads;
-- requests go to every leader; the new leader_draw gives a leader what the Worker needs to draw the next question and
-- to count the questions left (the room's categories, its 18+ ones and two numbers of the game's question list), and
-- null to everyone else. role stays host or guest, and question_list stays the host's.
--
-- The thumbs (*_question_play_data.sql, which says "the host's move") are folded in the transaction of the leader's
-- move: "Następne pytanie" by the host or a co-host, as before never in a player's own transaction.
--
-- The invariants of every round function in *_first_live_round.sql hold here too: the room's row is locked first,
-- everything is checked before the first write, an expected refusal is data ({ok: false, reason}), never an exception,
-- no function returns a vote's target, and counts appear only once a round is revealed. The co-host flag is read
-- without locking the player's row. set_cohost locks the room's row too, so giving or taking the role and a move take
-- turns: a move after the role is taken gets not_leader.
--
-- Deployment order (plan, Critical Implementation Details): this migration ships before the Worker that uses it. For
-- the Worker deployed before it, it only adds: the moves keep their arguments (p_player_token defaults to null, so the
-- signed-in host's calls answer as before), anon with no token gets room_unknown, and that Worker copies only the keys
-- of its own contract from room_lobby, so cohost and leader_draw pass it by.
--
-- Never edit this file once it has been pushed; a fix is a new migration.

-- The co-host role ----------------------------------------------------------------------------------------------------

-- Set only by set_cohost, and only for a guest: the host's own row (user_id set) never holds it. It goes with the
-- player and the room, and needs no clean-up: a closed room refuses every move.
alter table public.players add column cohost boolean not null default false;
alter table public.players add constraint players_cohost_check check (not cohost or user_id is null);

-- The leader's check: no grants, called only from the definer functions below ----------------------------------------

-- Who may move the game in the room whose row the caller has just locked (p_host: its host_id, null for no room). null
-- for a leader: the host by auth.uid(), or a player of this room with the co-host role by the sha256 of p_player_token,
-- so a signed-in person who is a guest in another person's room is known by the token, as in cast_vote. 'not_leader'
-- for a player of the room without the role; 'room_unknown' for anyone else, who learns nothing about the room. A
-- malformed token raises 22023, as in cast_vote: the server sends either no token or the cookie's 32-byte one.
create function private.leader_refusal(p_room_id uuid, p_host uuid, p_player_token text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_cohost boolean;
begin
  if p_player_token is not null and p_player_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid player token' using errcode = '22023';
  end if;

  if p_host is null then
    return 'room_unknown';
  end if;

  if v_user is not null and v_user = p_host then
    return null;
  end if;

  -- The flag is read, never locked: the caller's lock on the room's row already orders this against set_cohost.
  if p_player_token is not null then
    select p.cohost into v_cohost
    from public.player_secrets s
    join public.players p on p.id = s.player_id
    where s.token_hash = sha256(convert_to(p_player_token, 'UTF8')) and p.room_id = p_room_id;
  end if;

  if v_cohost is null then
    return 'room_unknown';
  end if;

  if not v_cohost then
    return null; -- PRÓBNY ALARM (a)
  end if;

  return null;
end;
$$;

-- Leader: start, next question, skip ----------------------------------------------------------------------------------

-- One version only: the old one beside this one would let the signed-in host's door skip the leader's check. Dropped
-- and created in one transaction, so no call finds neither; the same for every move below.
drop function public.start_game(uuid, text);

-- Definer, the leader's (the host, or a co-host by p_player_token): "Zacznij grę". Fixes who may vote (everyone in the
-- room now, the host included; at least 3, US-01) and opens round 1 with its urn. With a list, round 1 is its first
-- entry not removed, and p_question_id means nothing: list_empty when every entry is removed. With no list, round 1 is
-- p_question_id. S-11: right before round 1 opens, the list as it stands is counted.
create function public.start_game(p_room_id uuid, p_question_id text, p_player_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host uuid;
  v_status text;
  v_refusal text;
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

  -- Only the room's leader moves the game; anyone else learns nothing about the room.
  v_refusal := private.leader_refusal(p_room_id, v_host, p_player_token);
  if v_refusal is not null then
    return jsonb_build_object('ok', false, 'reason', v_refusal);
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

  -- S-11: the list as it stands, final now: each entry of the base with no text of its own is listed, and removed too
  -- when the host removed it. No list, no rows; a room closed in the lobby never gets here.
  if private.counts_for_stats(p_room_id) then
    insert into private.question_stats as s (question_id, listed, removed)
    select g.question_id, 1, case when g.removed then 1 else 0 end
    from private.game_questions g
    where g.room_id = p_room_id and g.question_id is not null and g.text is null
    order by g.question_id
    on conflict (question_id) do update
    set listed = s.listed + excluded.listed, removed = s.removed + excluded.removed;
  end if;

  insert into private.rounds (room_id, number, question_id, list_position, eligible)
  values (p_room_id, 1, v_question, v_position, v_eligible)
  returning id into v_round;

  insert into private.ballot_boxes (round_id) values (v_round);

  update public.rooms set status = 'playing', started_at = now() where id = p_room_id;

  return jsonb_build_object('ok', true);
end;
$$;

drop function public.next_round(uuid, integer, text[]);

-- Definer, the leader's: "Następne pytanie". p_round is the number of the round on the leader's screen, which must be
-- the latest one, revealed or skipped; p_candidates is the game's pool in the Worker's order. S-11: once the next round
-- is open, the thumbs are folded.
create function public.next_round(
  p_room_id uuid,
  p_round integer,
  p_candidates text[],
  p_player_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host uuid;
  v_status text;
  v_refusal text;
  v_number integer;
  v_phase text;
begin
  -- The room's row first: a vote or another leader's move right now waits for this one.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  -- Only the room's leader moves the game; anyone else learns nothing about the room.
  v_refusal := private.leader_refusal(p_room_id, v_host, p_player_token);
  if v_refusal is not null then
    return jsonb_build_object('ok', false, 'reason', v_refusal);
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

  -- Every candidate played: the game goes on until a leader ends it (D2).
  if not private.open_next_round(p_room_id, v_number + 1, p_candidates) then
    return jsonb_build_object('ok', false, 'reason', 'no_questions');
  end if;

  -- S-11: only now that the next round is open: after no_questions the thumbs wait for the end of the game, and a thumb
  -- changed after that refusal still counts once.
  perform private.fold_reactions(p_room_id);

  return jsonb_build_object('ok', true);
end;
$$;

drop function public.skip_round(uuid, integer, text[]);

-- Definer, the leader's: "Pomiń pytanie", only while round p_round, the latest one, is voting. Its votes are gone: the
-- urn is deleted, the round stays as a row in phase skipped with no count (D3), and the next question opens at once
-- (D2). { ok: true } also when no candidate is left: the skipped round stays the latest one, and the game goes on.
-- S-11: the skip is counted before the next question opens.
create function public.skip_round(
  p_room_id uuid,
  p_round integer,
  p_candidates text[],
  p_player_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host uuid;
  v_status text;
  v_refusal text;
  v_round uuid;
  v_number integer;
  v_phase text;
begin
  -- The room's row first: a vote cast right now is either deleted with the urn below or finds the round skipped.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  -- Only the room's leader moves the game; anyone else learns nothing about the room.
  v_refusal := private.leader_refusal(p_room_id, v_host, p_player_token);
  if v_refusal is not null then
    return jsonb_build_object('ok', false, 'reason', v_refusal);
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

  -- S-11: the skip itself, for a question of the base in a game that counts; nothing of the urn deleted above (D3).
  if private.counts_for_stats(p_room_id) then
    insert into private.question_stats as s (question_id, skipped)
    select r.question_id, 1
    from private.rounds r
    where r.id = v_round and r.question_id is not null
    on conflict (question_id) do update
    set skipped = s.skipped + 1;
  end if;

  perform private.open_next_round(p_room_id, v_number + 1, p_candidates);

  return jsonb_build_object('ok', true);
end;
$$;

-- Leader: reveal, end ---------------------------------------------------------------------------------------------------

drop function public.reveal_round(uuid, integer);

-- Definer, the leader's: "Odsłoń wynik", at any time and with no threshold (FR-009, D3). p_round is the number of the
-- round on the leader's screen, which must be the latest one: without it, or with another number, the reveal is
-- round_over. A second reveal changes nothing and still answers ok (D3); a skipped round has no votes left to show, so
-- its reveal is round_over, as a vote in it is. p_round keeps its default of null only because it comes before
-- p_player_token, which has one; the number is required by the refusal in the body.
create function public.reveal_round(p_room_id uuid, p_round integer default null, p_player_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host uuid;
  v_status text;
  v_refusal text;
  v_round uuid;
  v_number integer;
  v_phase text;
begin
  -- The room's row first, as in cast_vote.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  -- Only the room's leader moves the game; anyone else learns nothing about the room.
  v_refusal := private.leader_refusal(p_room_id, v_host, p_player_token);
  if v_refusal is not null then
    return jsonb_build_object('ok', false, 'reason', v_refusal);
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

drop function public.end_game(uuid);

-- Definer, the leader's: "Zakończ grę", while the game is in play. Closes the room for everyone and drops the
-- in-progress state of its round (D4); revealed results (counts only) stay, as after "Nowa gra".
create function public.end_game(p_room_id uuid, p_player_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host uuid;
  v_status text;
  v_refusal text;
begin
  -- The room's row first: a vote cast right now is either dropped below or finds the room closed.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  -- Only the room's leader moves the game; anyone else learns nothing about the room.
  v_refusal := private.leader_refusal(p_room_id, v_host, p_player_token);
  if v_refusal is not null then
    return jsonb_build_object('ok', false, 'reason', v_refusal);
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

-- Leader: let a latecomer in, or turn them away -------------------------------------------------------------------------

drop function public.admit_latecomer(uuid, text);

-- Definer, the leader's: "Wpuść". p_nick is a nick on the leader's list: the pending request with that nick (as
-- compared) becomes a player at the next seat, under the request's nick, with the request's token hash in
-- player_secrets; the request is deleted. The new player sees the round in progress and votes from the next question
-- on: who votes in a round stays who was in the room when it opened.
create function public.admit_latecomer(p_room_id uuid, p_nick text, p_player_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host uuid;
  v_status text;
  v_refusal text;
  v_request uuid;
  v_nick text;
  v_hash bytea;
  v_player uuid;
  v_constraint text;
begin
  -- The room's row first: a request, a vote or another leader's move right now waits for this one.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  -- Only the room's leader moves the game; anyone else learns nothing about the room.
  v_refusal := private.leader_refusal(p_room_id, v_host, p_player_token);
  if v_refusal is not null then
    return jsonb_build_object('ok', false, 'reason', v_refusal);
  end if;

  -- Requests wait only while the game is in play. A nick over the nick rule's cap is on no list, and its regular
  -- expressions never run on it.
  if v_status = 'playing' and char_length(p_nick) <= 100 then
    select q.id, q.nick, q.token_hash into v_request, v_nick, v_hash
    from public.join_requests q
    where q.room_id = p_room_id and q.status = 'pending' and q.nick_key = private.nick_key(p_nick);
  end if;

  -- Let in or turned away already (a double click, another leader's screen), or the room is no longer in play.
  if v_request is null then
    return jsonb_build_object('ok', false, 'reason', 'request_unknown');
  end if;

  -- A backstop only: request_join keeps a waiting nick apart from the players under the room's lock, and nobody joins
  -- a game in play another way. Its own refusal, because nick_taken speaks to the one who asks, not to the leader.
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

drop function public.reject_latecomer(uuid, text);

-- Definer, the leader's: "Odrzuć", with admit_latecomer's checks. The request stays, rejected: the latecomer's screen
-- says so, and the same token may ask again through request_join. Its nick is free for others meanwhile.
create function public.reject_latecomer(p_room_id uuid, p_nick text, p_player_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host uuid;
  v_status text;
  v_refusal text;
  v_request uuid;
begin
  -- The room's row first, as in admit_latecomer.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  -- Only the room's leader moves the game; anyone else learns nothing about the room.
  v_refusal := private.leader_refusal(p_room_id, v_host, p_player_token);
  if v_refusal is not null then
    return jsonb_build_object('ok', false, 'reason', v_refusal);
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

-- Host: give and take the co-host role ----------------------------------------------------------------------------------

-- Definer, host only: the role button by a guest's nick, in the lobby and while the game is in play. p_nick is a nick
-- of the room (as compared, as in admit_latecomer); p_cohost true gives the role, false takes it. { ok: true }, also
-- when the guest already has the value sent (a double click, the host's second screen), or { ok: false, reason } with
-- reason in room_unknown (another host's room, or no room), room_closed, player_unknown (no guest with that nick: a
-- nick in no room, or the host's own, which never takes the role). A missing p_cohost is not our client: 22023.
create function public.set_cohost(p_room_id uuid, p_nick text, p_cohost boolean)
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
begin
  -- The screen sends true or false; anything else is not our client.
  if p_cohost is null then
    raise exception 'invalid cohost' using errcode = '22023';
  end if;

  -- The room's row first: a leader's move right now either runs before the change or sees it.
  select r.host_id, r.status into v_host, v_status
  from public.rooms r
  where r.id = p_room_id
  for update;

  -- Only the host gives and takes the role. Another host's room looks like no room at all.
  if v_host is null or v_user is null or v_user <> v_host then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  if v_status = 'closed' then
    return jsonb_build_object('ok', false, 'reason', 'room_closed');
  end if;

  -- A guest of the room: the host's own row (user_id set) is never one. A nick over the nick rule's cap is no player's,
  -- and its regular expressions never run on it.
  if char_length(p_nick) <= 100 then
    select p.id into v_player
    from public.players p
    where p.room_id = p_room_id and p.user_id is null and p.nick_key = private.nick_key(p_nick);
  end if;

  if v_player is null then
    return jsonb_build_object('ok', false, 'reason', 'player_unknown');
  end if;

  update public.players set cohost = p_cohost where id = v_player and cohost <> p_cohost;

  return jsonb_build_object('ok', true);
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
-- reveal has no counts to show. players: { nick, host, cohost } each, so everyone sees who leads. A leader is the host
-- or a co-host (S-07). requests: the nicks of the latecomers waiting, in the order of asking, for a leader; [] for
-- anyone else, and in every status (none before the start, and none once the room is closed). question_list: for the
-- host of a room with a list, in every status, its entries not removed in the order of positions and the number of its
-- rows with a question id of the base (base_count, removed and reworded entries included); null for a guest, a co-host
-- included, and for a room with no list. leader_draw: for a leader, in every status, what the leader's moves need, for
-- the Worker only: the room's categories and its 18+ ones, the number of the list's entries not removed (list_entries)
-- and its base_count (list_base_count), both 0 with no list; never the list itself; null for anyone else. game_totals:
-- for a closed room with a revealed round, the number of its revealed rounds (revealed) and the sums of their results
-- (totals: every player with a result in at least one of them, as nick and votes, in seat order, zeros included); only
-- counts per nick from the reveals, never a voter; null in the lobby, while the game is in play and for a closed room
-- with no revealed round.
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
  v_categories text[];
  v_adult_categories text[];
  v_role text;
  v_leader boolean;
  v_me text;
  v_me_id uuid;
  v_me_cohost boolean;
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
  v_leader_draw jsonb;
  v_revealed integer;
  v_game_totals jsonb;
begin
  select r.host_id, r.status, r.categories, r.adult_categories
  into v_host, v_status, v_categories, v_adult_categories
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
    select p.id, p.nick, p.cohost into v_me_id, v_me, v_me_cohost
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

  -- The leader is the host or a co-host, as in private.leader_refusal.
  v_leader := v_role = 'host' or coalesce(v_me_cohost, false);

  -- Only a leader decides who comes in, so only a leader sees who asks.
  if v_leader then
    select coalesce(jsonb_agg(q.nick order by q.created_at, q.id), '[]'::jsonb) into v_requests
    from public.join_requests q
    where q.room_id = p_room_id and q.status = 'pending';
  end if;

  -- Only the host reviews the list, so only the host sees it: a guest, a co-host included, learns a question when its
  -- round opens.
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

  -- What a leader's moves need from the room, for the Worker only (it never goes to a screen): the picked categories
  -- and their 18+ ones, to draw the next question, and two numbers of the game's question list, to count the questions
  -- left: its entries not removed (list_entries) and its rows with a question id of the base (list_base_count, removed
  -- and reworded entries included), both 0 with no list. Never the list itself, which stays the host's.
  if true then -- PRÓBNY ALARM (b)
    v_leader_draw := jsonb_build_object(
      'categories', to_jsonb(v_categories),
      'adult_categories', to_jsonb(v_adult_categories),
      'list_entries', (
        select count(*)::integer from private.game_questions g where g.room_id = p_room_id and not g.removed
      ),
      'list_base_count', (
        select count(*)::integer
        from private.game_questions g
        where g.room_id = p_room_id and g.question_id is not null
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

  -- The sums of the reveals, only once the room is closed: every count in them is one a reveal already showed the room.
  -- Skipped rounds and a round ended without a reveal have no results, and are not counted.
  if v_status = 'closed' then
    select count(*) into v_revealed
    from private.rounds r
    where r.room_id = p_room_id and r.phase = 'revealed';

    if v_revealed > 0 then
      -- Every player with a result in a revealed round, in seat order, zeros included: a sum per nick and nothing more.
      -- A latecomer who could vote in no revealed round has no result, so is not here.
      v_game_totals := jsonb_build_object(
        'revealed', v_revealed,
        'totals', (
          select coalesce(
            jsonb_agg(jsonb_build_object('nick', t.nick, 'votes', t.votes) order by t.seat),
            '[]'::jsonb
          )
          from (
            select p.nick, p.seat, sum(rr.votes)::integer as votes
            from private.rounds r
            join private.round_results rr on rr.round_id = r.id
            join public.players p on p.id = rr.player_id
            where r.room_id = p_room_id and r.phase = 'revealed'
            group by p.id, p.nick, p.seat
          ) t
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'role', v_role,
    'me', v_me,
    'players', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('nick', p.nick, 'host', p.user_id is not null, 'cohost', p.cohost) order by p.seat
        ),
        '[]'::jsonb
      )
      from public.players p
      where p.room_id = p_room_id
    ),
    'round', v_round_state,
    'requests', v_requests,
    'question_list', v_question_list,
    'leader_draw', v_leader_draw,
    'game_totals', v_game_totals
  );
end;
$$;

-- Function owners and grants ------------------------------------------------------------------------------------------

-- A security definer function runs with its owner's rights; on Supabase that must be postgres. The helper too, as
-- private.counts_for_stats in *_question_play_data.sql: the definer functions call it as postgres.
alter function private.leader_refusal(uuid, uuid, text) owner to postgres;
alter function public.start_game(uuid, text, text) owner to postgres;
alter function public.next_round(uuid, integer, text[], text) owner to postgres;
alter function public.skip_round(uuid, integer, text[], text) owner to postgres;
alter function public.reveal_round(uuid, integer, text) owner to postgres;
alter function public.end_game(uuid, text) owner to postgres;
alter function public.admit_latecomer(uuid, text, text) owner to postgres;
alter function public.reject_latecomer(uuid, text, text) owner to postgres;
alter function public.set_cohost(uuid, text, boolean) owner to postgres;
alter function public.room_lobby(uuid, text) owner to postgres;

-- As in *_full_game_evening.sql: the revokes are repeated for every function this file creates or replaces, so each
-- one's grants read in one place. The private helper gets none: only definer functions call it.
revoke execute on function private.leader_refusal(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.start_game(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.next_round(uuid, integer, text[], text) from public, anon, authenticated;
revoke execute on function public.skip_round(uuid, integer, text[], text) from public, anon, authenticated;
revoke execute on function public.reveal_round(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.end_game(uuid, text) from public, anon, authenticated;
revoke execute on function public.admit_latecomer(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.reject_latecomer(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.set_cohost(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.room_lobby(uuid, text) from public, anon, authenticated;

-- A co-host is a guest with no session, so the leader's moves are public endpoints, with every check inside; giving
-- and taking the role stays the signed-in host's. The room's state stays readable by its guests.
grant execute on function public.start_game(uuid, text, text) to anon, authenticated;
grant execute on function public.next_round(uuid, integer, text[], text) to anon, authenticated;
grant execute on function public.skip_round(uuid, integer, text[], text) to anon, authenticated;
grant execute on function public.reveal_round(uuid, integer, text) to anon, authenticated;
grant execute on function public.end_game(uuid, text) to anon, authenticated;
grant execute on function public.admit_latecomer(uuid, text, text) to anon, authenticated;
grant execute on function public.reject_latecomer(uuid, text, text) to anon, authenticated;
grant execute on function public.set_cohost(uuid, text, boolean) to authenticated;
grant execute on function public.room_lobby(uuid, text) to anon, authenticated;
