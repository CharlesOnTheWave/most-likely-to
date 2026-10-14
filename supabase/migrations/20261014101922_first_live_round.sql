-- S-02 first-live-round: the game's states, the round with its urn, and the closing of F1 and F4
-- (context/changes/first-live-round/plan.md, Faza 2).
--
-- The urn that disappears (decision D1 of context/changes/first-live-round/research.md). Invariants of every round
-- function:
--   - a vote's transaction writes only the voter's row in private.round_voters and the count in private.ballot_boxes;
--     the last vote also closes the round (the results, the phase, the in-progress rows deleted);
--   - the in-progress state lives only in unlogged tables in schema private: no grants, outside the publication, never
--     in the WAL, deleted at the reveal and whenever the round ends otherwise (create_room, close_stale_games);
--   - no time or sequence column in any round table: the order of voting would tell who voted for whom;
--   - everything is checked before the first write, and an expected refusal is data ({ok: false, reason}), never an
--     exception, whose DETAIL could carry a row's values;
--   - no function returns a vote's target, and counts appear only once the round is revealed;
--   - the room's row is locked first (for update), then the round or the urn, as in join_room. A player's row is never
--     locked, and no urn table has a foreign key to players: a lock writes the locker's transaction id into the row,
--     which would sit next to the voter.
--
-- F1: the host no longer writes to rooms or players directly. create_room is security definer and makes the link code
-- in SQL. It keeps p_link_token, accepted and ignored, so the Worker deployed before this migration keeps working until
-- the new one ships (deployment order in the plan); a later migration drops the parameter.
-- F4: the nick rule drops more invisible characters and a long text before it, and nicks are compared by
-- players.nick_key, the nick without variation selectors and tags, while the nick is shown as typed (decision D5, W2).
--
-- Never edit this file once it has been pushed; a fix is a new migration.

-- The link code's random bytes (Supabase keeps pgcrypto in schema extensions).
create extension if not exists pgcrypto with schema extensions;

-- F1: the host reads, the functions write ---------------------------------------------------------------------------

-- The host still reads its rooms and their players through RLS (the Worker reads the link code that way). Revoking all
-- also drops the column grant update (status).
revoke all on table public.rooms, public.players from public, anon, authenticated;
grant select on table public.rooms, public.players to authenticated;

drop policy "Hosts open their rooms" on public.rooms;
drop policy "Hosts update their rooms" on public.rooms;
drop policy "Hosts join their open rooms" on public.players;

-- Game states ---------------------------------------------------------------------------------------------------------

alter table public.rooms drop constraint rooms_status_check;
alter table public.rooms add constraint rooms_status_check check (status in ('lobby', 'playing', 'closed'));

-- At most one open room per host, a game in play included: "Nowa gra" closes either.
drop index public.rooms_one_open_per_host;
create unique index rooms_one_open_per_host on public.rooms (host_id) where status in ('lobby', 'playing');

-- When the game started, set once by start_game. The game's time, not a vote's: no round table holds a time. The hourly
-- sweep of abandoned games (*_close_stale_games.sql) counts from it.
alter table public.rooms add column started_at timestamptz;

-- Nick (F4) -----------------------------------------------------------------------------------------------------------

-- The nick as shown. S-01's rule (what looks the same is the same nick: NFC, Unicode whitespace and the blank U+2800 to
-- a space, control and invisible characters removed, runs of spaces collapsed, edges trimmed, NFC again; case counts),
-- now also removing the Default_Ignorable U+061C, U+180F, U+1BCA0-U+1BCA3 and U+1D173-U+1D17A. Variation selectors and
-- tags stay, so a heart or a flag looks as typed; nick_key drops them for the comparison. Every character is an escape
-- (\uXXXX, and \UXXXXXXXX beyond the BMP), never literal: a review cannot see an invisible one.
create or replace function private.normalize_nick(p_nick text)
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
            '[\u0009-\u000D\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u2800\u3000]', ' ', 'g'
          ),
          '[\u0001-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F'
            || '\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A]',
          '', 'g'
        ),
        ' {2,}', ' ', 'g'
      ),
      ' '
    ),
    NFC
  )
$$;

-- The nick as compared (decision D5, W2): without variation selectors (U+FE00-U+FE0F, U+E0100-U+E01EF) and tags
-- (U+E0000-U+E007F), then the nick rule once more, so edges, spaces and NFC are settled after the removal (a letter, a
-- selector and a combining accent compose once the selector is gone). "Ola" + U+2764 is the same nick with and without
-- U+FE0F; the flag of Scotland (U+1F3F4 + tags) is the black flag, a rare case accepted in D5.
create function private.nick_key(p_nick text)
returns text
language sql
immutable
set search_path = ''
as $$
  select private.normalize_nick(
    regexp_replace(p_nick, '[\uFE00-\uFE0F\U000E0000-\U000E007F\U000E0100-\U000E01EF]', '', 'g')
  )
$$;

-- Stored, so it is computed once per row and never again after a later change of the functions: added only now, after
-- the new normalize_nick.
alter table public.players add column nick_key text generated always as (private.nick_key(nick)) stored;

-- The same name on the new key: join_room maps a violation of players_room_nick_key to nick_taken.
alter table public.players drop constraint players_room_nick_key;
alter table public.players add constraint players_room_nick_key unique (room_id, nick_key);

-- Round tables: schema private, no grants, no policies ---------------------------------------------------------------

-- One row per round. No time and no sequence; the id is random.
create table private.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  number integer not null check (number >= 1),
  -- "<category-id>-<NNN>" (src/data/questions.ts); the Worker draws it, the database checks only the format.
  question_id text not null check (question_id ~ '^[a-z0-9-]+-[0-9]{3}$'),
  phase text not null default 'voting' check (phase in ('voting', 'revealed')),
  -- Who may vote: the players in the room at the start, in seat order.
  eligible uuid[] not null check (cardinality(eligible) >= 1),
  -- Set at the reveal, never before.
  abstained integer check (abstained >= 0),
  ballots integer check (ballots >= 0),
  constraint rounds_room_number_key unique (room_id, number),
  constraint rounds_room_question_key unique (room_id, question_id)
);

-- What stays after the reveal: a count per target and no voter. Its foreign key to players locks every eligible
-- player's row at once, in the reveal's transaction, so that lock tells nothing about any one voter.
create table private.round_results (
  round_id uuid not null references private.rounds (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  votes integer not null check (votes >= 0),
  primary key (round_id, player_id)
);

-- The urn while the round is open: counts per target player id and the abstentions, with no voter. Unlogged: never in
-- the WAL, so neither a replica, logical decoding nor a backup holds a round in progress, and it cannot be published.
-- A crash empties it, and the round in progress loses its votes (accepted in D1).
create unlogged table private.ballot_boxes (
  round_id uuid primary key references private.rounds (id) on delete cascade,
  tally jsonb not null default '{}',
  abstained integer not null default 0 check (abstained >= 0)
);

-- Who has voted while the round is open, with no target. player_id has no foreign key on purpose: its check would lock
-- the voter's row in players (see the header).
create unlogged table private.round_voters (
  round_id uuid not null references private.rounds (id) on delete cascade,
  player_id uuid not null,
  primary key (round_id, player_id)
);

alter table private.rounds enable row level security;
alter table private.round_results enable row level security;
alter table private.ballot_boxes enable row level security;
alter table private.round_voters enable row level security;

revoke all on table private.rounds, private.round_results, private.ballot_boxes, private.round_voters
  from public, anon, authenticated;

-- Round helpers: no grants, called only from the definer functions below ----------------------------------------------

-- A round that ends without a reveal (a closed room) leaves no voter and no count. Results already revealed stay.
create function private.drop_round_state(p_room_id uuid)
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

-- The reveal: a count for every eligible player still in the room (zeros included), the abstentions and the number of
-- ballots, then the in-progress rows go. The caller holds the room's lock and has checked that the round is voting.
create function private.finish_round(p_round_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_tally jsonb;
  v_abstained integer;
  v_ballots integer;
begin
  select b.tally, b.abstained into v_tally, v_abstained
  from private.ballot_boxes b
  where b.round_id = p_round_id;

  select count(*) into v_ballots
  from private.round_voters v
  where v.round_id = p_round_id;

  insert into private.round_results (round_id, player_id, votes)
  select r.id, p.id, coalesce((v_tally ->> p.id::text)::integer, 0)
  from private.rounds r
  join public.players p on p.id = any (r.eligible)
  where r.id = p_round_id;

  update private.rounds
  set phase = 'revealed', abstained = coalesce(v_abstained, 0), ballots = v_ballots
  where id = p_round_id;

  delete from private.round_voters where round_id = p_round_id;
  delete from private.ballot_boxes where round_id = p_round_id;
end;
$$;

-- Host: new room ------------------------------------------------------------------------------------------------------

-- Definer now (F1): the host has no write grant of its own. Closes the host's open room, a game in play included (asks
-- first when guests are in it), drops its round's in-progress state, then opens a new one with the host as player 1, in
-- one transaction. p_link_token is ignored: the code is made here.
create or replace function public.create_room(
  p_nick text,
  p_link_token text,
  p_categories text[],
  p_adult_categories text[],
  p_confirm_close boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host uuid := (select auth.uid());
  v_nick text;
  v_open_room uuid;
  v_closed_room uuid;
  v_room uuid;
begin
  if v_host is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
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

  if coalesce(cardinality(p_categories), 0) < 1
    or array_position(p_categories, null) is not null
    or not (coalesce(p_adult_categories, '{}') <@ p_categories) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_categories');
  end if;

  -- One block, so a unique_violation below also undoes closing the old room and dropping its round's state.
  begin
    -- The lock orders this against join_room and the round functions: a guest joining or a vote cast right now is
    -- either counted below or finds the room closed.
    select r.id into v_open_room
    from public.rooms r
    where r.host_id = v_host and r.status in ('lobby', 'playing')
    for update;

    if v_open_room is not null then
      if not coalesce(p_confirm_close, false) and exists (
        select 1 from public.players p where p.room_id = v_open_room and p.user_id is null
      ) then
        return jsonb_build_object('ok', false, 'reason', 'open_room_has_guests');
      end if;

      update public.rooms set status = 'closed' where id = v_open_room;
      -- A round abandoned mid-vote keeps no voter and no count (D1).
      perform private.drop_round_state(v_open_room);
      v_closed_room := v_open_room;
    end if;

    -- 16 random bytes, base64url without padding: 22 characters, as in src/lib/rooms/tokens.ts.
    insert into public.rooms (host_id, link_token, categories, adult_categories)
    values (
      v_host,
      translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_'),
      p_categories,
      coalesce(p_adult_categories, '{}')
    )
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
create or replace function public.join_room(p_link_token text, p_nick text, p_player_token text)
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

  -- The row lock makes joins to one room take turns (seat numbers) and orders them against create_room closing it and
  -- start_game fixing who may vote.
  select r.id, r.status into v_room, v_status
  from public.rooms r
  where r.link_token = p_link_token
  for update;

  if v_room is null then
    return jsonb_build_object('ok', false, 'reason', 'room_unknown');
  end if;

  -- A game in play takes no one new; S-08 decides about late players.
  if v_status = 'playing' then
    return jsonb_build_object('ok', false, 'reason', 'game_started');
  end if;

  if v_status <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'room_closed');
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
create or replace function public.room_link(p_link_token text)
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

  -- A game in play: the page lets the room's own players back in and turns everyone else away.
  if v_status = 'playing' then
    return jsonb_build_object('status', 'started', 'room_id', v_room);
  end if;

  return jsonb_build_object('status', 'closed');
end;
$$;

-- Definer: the lobby for the room's host (auth.uid()) or for a player whose token hash is in this room; null for
-- anyone else, whether or not the room exists. Returns nicks in seat order and no ids, user ids, hashes or link code,
-- plus the round of a game in play: who has voted while it is open (never how, never a count), the counts per nick
-- once it is revealed. No round in the lobby, and none once the room is closed: a round that ended without a reveal
-- has no counts to show.
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
      )
    );
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

-- Round: start, vote, reveal ------------------------------------------------------------------------------------------

-- Definer, host only: "Zacznij grę". Fixes who may vote (everyone in the room now, the host included; at least 3,
-- US-01) and opens round 1 with its urn. S-03 adds the next rounds.
create function public.start_game(p_room_id uuid, p_question_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_host uuid;
  v_status text;
  v_eligible uuid[];
  v_round uuid;
begin
  -- The room's row first: a guest joining right now is either on the list below or finds the game started.
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

  if v_status <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'game_started');
  end if;

  if p_question_id is null or p_question_id !~ '^[a-z0-9-]+-[0-9]{3}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_question');
  end if;

  select array_agg(p.id order by p.seat) into v_eligible
  from public.players p
  where p.room_id = p_room_id;

  if coalesce(cardinality(v_eligible), 0) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'not_enough_players');
  end if;

  insert into private.rounds (room_id, number, question_id, eligible)
  values (p_room_id, 1, p_question_id, v_eligible)
  returning id into v_round;

  insert into private.ballot_boxes (round_id) values (v_round);

  update public.rooms set status = 'playing', started_at = now() where id = p_room_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Definer, for anon and authenticated: a vote. The voter is the host by auth.uid() or a guest by the token, as in
-- room_lobby; p_target is a nick of the room, or null for an abstention. A vote is final (D2). Writes only the voter's
-- row and the count (the urn invariants in the header), and answers { ok: true } and nothing else.
create function public.cast_vote(p_room_id uuid, p_target text, p_player_token text default null)
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

-- Definer, host only: "Odsłoń wynik", at any time and with no threshold (FR-009, D3). A second reveal changes nothing
-- and still answers ok.
create function public.reveal_round(p_room_id uuid)
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
    select r.id, r.phase into v_round, v_phase
    from private.rounds r
    where r.room_id = p_room_id
    order by r.number desc
    limit 1;
  end if;

  if v_round is null then
    return jsonb_build_object('ok', false, 'reason', 'no_round');
  end if;

  if v_phase = 'voting' then
    perform private.finish_round(v_round);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Function owners and grants ------------------------------------------------------------------------------------------

-- A security definer function runs with its owner's rights; on Supabase that must be postgres.
alter function public.create_room(text, text, text[], text[], boolean) owner to postgres;
alter function public.join_room(text, text, text) owner to postgres;
alter function public.room_link(text) owner to postgres;
alter function public.room_lobby(uuid, text) owner to postgres;
alter function public.start_game(uuid, text) owner to postgres;
alter function public.cast_vote(uuid, text, text) owner to postgres;
alter function public.reveal_round(uuid) owner to postgres;

-- create or replace keeps a function's grants; the revokes are repeated for every function this file creates or
-- replaces, so each one's grants read in one place. The private helpers get none: only definer functions call them.
revoke execute on function private.normalize_nick(text) from public, anon, authenticated;
revoke execute on function private.nick_key(text) from public, anon, authenticated;
revoke execute on function private.drop_round_state(uuid) from public, anon, authenticated;
revoke execute on function private.finish_round(uuid) from public, anon, authenticated;
revoke execute on function public.create_room(text, text, text[], text[], boolean) from public, anon, authenticated;
revoke execute on function public.join_room(text, text, text) from public, anon, authenticated;
revoke execute on function public.room_link(text) from public, anon, authenticated;
revoke execute on function public.room_lobby(uuid, text) from public, anon, authenticated;
revoke execute on function public.start_game(uuid, text) from public, anon, authenticated;
revoke execute on function public.cast_vote(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.reveal_round(uuid) from public, anon, authenticated;

-- create_room no longer runs as the host, so no API role needs anything in schema private.
revoke usage on schema private from public, anon, authenticated;

grant execute on function public.create_room(text, text, text[], text[], boolean) to authenticated;
grant execute on function public.join_room(text, text, text) to anon, authenticated;
grant execute on function public.room_link(text) to anon, authenticated;
grant execute on function public.room_lobby(uuid, text) to anon, authenticated;
grant execute on function public.start_game(uuid, text) to authenticated;
grant execute on function public.cast_vote(uuid, text, text) to anon, authenticated;
grant execute on function public.reveal_round(uuid) to authenticated;
