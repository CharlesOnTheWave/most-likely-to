-- The creator's view of a round (#1): what the database owner can read and the publishable key cannot. Catalog, grants,
-- publication and the rows a round leaves behind, read as postgres on the throwaway database of the CI job db. Runs
-- after the Vitest db suite on the same database, so other rooms exist: every count here is scoped to this file's rooms
-- and rounds. Oracle: decision D1 of context/changes/first-live-round/research.md (the urn that disappears: in-progress
-- state only in unlogged private tables with no grants, outside the publication, deleted at the reveal and whenever a
-- round ends otherwise) and plan-review F1 (an hourly pg_cron sweep closes games started more than 12 hours ago).
--
-- The round's objects (private.rounds, round_results, ballot_boxes, round_voters, rooms.started_at, start_game,
-- cast_vote, private.close_stale_games, the cron schema) come with phase 2. Until then each assertion about them must
-- be its own `not ok`, never an error that ends the file: nothing here names them statically. They are reached only
-- through to_regclass, pgTAP functions that report a missing table (table_privs_are, columns_are), lives_ok, and the
-- helpers below, which run a call or a count dynamically and hand the error back as text for the TAP diagnostics.
--
-- Rounds are played through the functions as the game's roles: each call switches to anon, or to authenticated with
-- the host in request.jwt.claims, and back to the owner. Hosts are rows inserted into auth.users by the owner. The
-- whole file is rolled back.

begin;

select plan(56);

-- Helpers ------------------------------------------------------------------------------------------------------------

-- This file's rooms and guests. round_ids is kept at the start, so a count cannot pass because the round row itself
-- was deleted while its urn rows stayed behind.
create temp table test_rooms (key text primary key, host_id uuid not null, room_id uuid not null, round_ids text[]);
create temp table test_guests (
  room_key text not null,
  nick text not null,
  player_token text not null,
  primary key (room_key, nick)
);

create function pg_temp.room_of(p_key text) returns uuid language sql as $$
  select t.room_id from pg_temp.test_rooms t where t.key = p_key
$$;

create function pg_temp.host_of(p_key text) returns uuid language sql as $$
  select t.host_id from pg_temp.test_rooms t where t.key = p_key
$$;

create function pg_temp.rounds_of(p_key text) returns text[] language sql as $$
  select t.round_ids from pg_temp.test_rooms t where t.key = p_key
$$;

create function pg_temp.room_status(p_key text) returns text language sql as $$
  select r.status from public.rooms r where r.id = pg_temp.room_of(p_key)
$$;

-- One call as a role, the way PostgREST makes it: anon with no user, or authenticated as p_user. Returns the call's
-- jsonb, or {"error": sqlstate, "message": ...} when it raised (a missing function in phase 1), so the assertion shows
-- the error instead of the file ending on it. The role goes back to the owner either way.
create function pg_temp.call_as(p_role text, p_user uuid, p_sql text) returns jsonb language plpgsql as $$
declare
  v_answer jsonb;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('role', p_role, 'sub', p_user)::text, true);
  perform set_config('role', p_role, true);
  begin
    execute p_sql into v_answer;
  exception when others then
    v_answer := jsonb_build_object('error', sqlstate, 'message', sqlerrm);
  end;
  reset role;
  return v_answer;
end;
$$;

-- 'ok' for an accepted call; otherwise the whole answer, so a refusal or an error shows in the diagnostics.
create function pg_temp.outcome(p_answer jsonb) returns text language sql as $$
  select case when p_answer ->> 'ok' = 'true' then 'ok' else coalesce(p_answer::text, 'no answer') end
$$;

-- A new host opens a room through create_room and each guest joins through join_room with a fresh 43-character token,
-- each as its role. The link code is read back from the room: phase 2's create_room ignores the one it is sent. Returns
-- the room id, or null when a step was refused.
create function pg_temp.open_room(p_key text, p_guests text[]) returns uuid language plpgsql as $$
declare
  v_host uuid := gen_random_uuid();
  v_answer jsonb;
  v_room uuid;
  v_link text;
  v_nick text;
  v_token text;
begin
  insert into auth.users (id, email) values (v_host, 'pgtap-' || p_key || '@example.com');
  v_answer := pg_temp.call_as('authenticated', v_host, format(
    'select public.create_room(%L, %L, array[%L], array[]::text[], false)',
    'Host', substr(md5(random()::text), 1, 22), 'na-co-dzien'
  ));
  v_room := (v_answer ->> 'room_id')::uuid;
  if v_room is null then
    return null;
  end if;
  select r.link_token into v_link from public.rooms r where r.id = v_room;
  insert into pg_temp.test_rooms (key, host_id, room_id) values (p_key, v_host, v_room);

  foreach v_nick in array p_guests loop
    v_token := md5(random()::text) || substr(md5(random()::text), 1, 11);
    v_answer := pg_temp.call_as('anon', null, format('select public.join_room(%L, %L, %L)', v_link, v_nick, v_token));
    if v_answer ->> 'ok' is distinct from 'true' then
      return null;
    end if;
    insert into pg_temp.test_guests (room_key, nick, player_token) values (p_key, v_nick, v_token);
  end loop;
  return v_room;
end;
$$;

-- "Zacznij grę" as the room's host, with a real question id; then the room's round ids are kept.
create function pg_temp.host_starts(p_key text) returns text language plpgsql as $$
declare
  v_outcome text;
  v_ids text[];
begin
  v_outcome := pg_temp.outcome(pg_temp.call_as('authenticated', pg_temp.host_of(p_key), format(
    'select public.start_game(%L, %L)', pg_temp.room_of(p_key), 'na-co-dzien-001'
  )));
  if to_regclass('private.rounds') is not null then
    begin
      execute 'select array_agg(r.id::text) from private.rounds r where r.room_id = $1'
        into v_ids using pg_temp.room_of(p_key);
      update pg_temp.test_rooms set round_ids = v_ids where key = p_key;
    exception when others then
      return 'started, but its rounds could not be read: ' || sqlstate || ' ' || sqlerrm;
    end;
  end if;
  return v_outcome;
end;
$$;

-- A guest of the room votes with its own token; a null target is an abstention.
create function pg_temp.guest_votes(p_key text, p_nick text, p_target text) returns text language plpgsql as $$
declare
  v_token text;
begin
  select g.player_token into v_token from pg_temp.test_guests g where g.room_key = p_key and g.nick = p_nick;
  return pg_temp.outcome(pg_temp.call_as('anon', null, format(
    'select public.cast_vote(%L, %L, %L)', pg_temp.room_of(p_key), p_target, v_token
  )));
end;
$$;

-- The room's host votes by its session (no token).
create function pg_temp.host_votes(p_key text, p_target text) returns text language plpgsql as $$
begin
  return pg_temp.outcome(pg_temp.call_as('authenticated', pg_temp.host_of(p_key), format(
    'select public.cast_vote(%L, %L)', pg_temp.room_of(p_key), p_target
  )));
end;
$$;

-- "Nowa gra" as the room's host, with the "guests are still in it" question answered: closes the room.
create function pg_temp.host_opens_new_room(p_key text) returns text language plpgsql as $$
begin
  return pg_temp.outcome(pg_temp.call_as('authenticated', pg_temp.host_of(p_key), format(
    'select public.create_room(%L, %L, array[%L], array[]::text[], true)',
    'Host', substr(md5(random()::text), 1, 22), 'na-co-dzien'
  )));
end;
$$;

-- Rows of the room's rounds in one urn table, as text: a count, or why there is none to give.
create function pg_temp.urn_rows(p_table text, p_key text) returns text language plpgsql as $$
declare
  v_ids text[] := pg_temp.rounds_of(p_key);
  v_count bigint;
begin
  if to_regclass(format('private.%I', p_table)) is null then
    return 'no table private.' || p_table;
  end if;
  if coalesce(cardinality(v_ids), 0) = 0 then
    return 'no round was started in this room';
  end if;
  execute format('select count(*) from private.%I u where u.round_id::text = any($1)', p_table)
    into v_count using v_ids;
  return v_count::text;
exception when others then
  return 'error ' || sqlstate || ': ' || sqlerrm;
end;
$$;

create function pg_temp.round_phase(p_key text) returns text language plpgsql as $$
declare
  v_ids text[] := pg_temp.rounds_of(p_key);
  v_phase text;
begin
  if to_regclass('private.rounds') is null then
    return 'no table private.rounds';
  end if;
  if coalesce(cardinality(v_ids), 0) = 0 then
    return 'no round was started in this room';
  end if;
  execute 'select string_agg(r.phase::text, '','') from private.rounds r where r.id::text = any($1)'
    into v_phase using v_ids;
  return coalesce(v_phase, 'the round row is gone');
exception when others then
  return 'error ' || sqlstate || ': ' || sqlerrm;
end;
$$;

-- Whether a private table is in the Realtime publication, which would send its rows to every subscriber.
create function pg_temp.publication_of(p_table text) returns text language sql as $$
  select case
    when to_regclass(format('private.%I', p_table)) is null then 'no table private.' || p_table
    when exists (
      select 1 from pg_catalog.pg_publication_tables t
      where t.pubname = 'supabase_realtime' and t.schemaname = 'private' and t.tablename = p_table
    ) then 'in supabase_realtime'
    else 'not published'
  end
$$;

-- Columns that would put an order on the rows (a time, a serial default or an identity): 'none', or the list.
create function pg_temp.order_columns(p_table text) returns text language sql as $$
  select case
    when to_regclass(format('private.%I', p_table)) is null then 'no table private.' || p_table
    else coalesce((
      select string_agg(a.attname || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod), ', ' order by a.attnum)
      from pg_catalog.pg_attribute a
      join pg_catalog.pg_type ty on ty.oid = a.atttypid
      left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = to_regclass(format('private.%I', p_table))
        and a.attnum > 0
        and not a.attisdropped
        and (
          -- D: date and time types; T: interval.
          ty.typcategory in ('D', 'T')
          or a.attidentity <> ''
          or pg_catalog.pg_get_expr(d.adbin, d.adrelid) like 'nextval(%'
        )
    ), 'none')
  end
$$;

create function pg_temp.cron_job(p_name text) returns text language plpgsql as $$
declare
  v_job text;
begin
  if to_regclass('cron.job') is null then
    return 'no table cron.job';
  end if;
  execute 'select string_agg(j.schedule || '' | '' || j.command, ''; '') from cron.job j where j.jobname = $1'
    into v_job using p_name;
  return coalesce(v_job, 'no job ' || p_name);
exception when others then
  return 'error ' || sqlstate || ': ' || sqlerrm;
end;
$$;

-- Positive control (green from day one) -------------------------------------------------------------------------------

-- If this fails, the file reads the wrong database or the owner's view is broken: nothing below means anything.
select table_privs_are(
  'public', 'player_secrets', 'anon', array[]::name[],
  'positive control: anon has no privilege on public.player_secrets'
);

-- Catalog: the urn's tables ------------------------------------------------------------------------------------------

-- Unlogged: never written to the WAL, so no replica, logical decoding or backup holds a round in progress.
select is(
  (select c.relpersistence::text from pg_catalog.pg_class c where c.oid = to_regclass('private.ballot_boxes')),
  'u',
  'private.ballot_boxes is unlogged'
);
select is(
  (select c.relpersistence::text from pg_catalog.pg_class c where c.oid = to_regclass('private.round_voters')),
  'u',
  'private.round_voters is unlogged'
);

-- No API role reaches a round table directly: only the functions do.
select table_privs_are('private', 'rounds', 'anon', array[]::name[], 'anon has no privilege on private.rounds');
select table_privs_are(
  'private', 'rounds', 'authenticated', array[]::name[], 'authenticated has no privilege on private.rounds'
);
select table_privs_are(
  'private', 'round_results', 'anon', array[]::name[], 'anon has no privilege on private.round_results'
);
select table_privs_are(
  'private', 'round_results', 'authenticated', array[]::name[],
  'authenticated has no privilege on private.round_results'
);
select table_privs_are(
  'private', 'ballot_boxes', 'anon', array[]::name[], 'anon has no privilege on private.ballot_boxes'
);
select table_privs_are(
  'private', 'ballot_boxes', 'authenticated', array[]::name[], 'authenticated has no privilege on private.ballot_boxes'
);
select table_privs_are(
  'private', 'round_voters', 'anon', array[]::name[], 'anon has no privilege on private.round_voters'
);
select table_privs_are(
  'private', 'round_voters', 'authenticated', array[]::name[], 'authenticated has no privilege on private.round_voters'
);

-- Postgres Changes would send every row to anyone holding the publishable key.
select is(pg_temp.publication_of('rounds'), 'not published', 'private.rounds is not in supabase_realtime');
select is(
  pg_temp.publication_of('round_results'), 'not published', 'private.round_results is not in supabase_realtime'
);
select is(pg_temp.publication_of('ballot_boxes'), 'not published', 'private.ballot_boxes is not in supabase_realtime');
select is(pg_temp.publication_of('round_voters'), 'not published', 'private.round_voters is not in supabase_realtime');

-- A time or a sequence next to a vote would tell the order of voting, and with it who voted for whom.
select is(pg_temp.order_columns('rounds'), 'none', 'private.rounds has no time, serial or identity column');
select is(
  pg_temp.order_columns('round_results'), 'none', 'private.round_results has no time, serial or identity column'
);
select is(pg_temp.order_columns('ballot_boxes'), 'none', 'private.ballot_boxes has no time, serial or identity column');
select is(pg_temp.order_columns('round_voters'), 'none', 'private.round_voters has no time, serial or identity column');

-- What stays after the reveal is a count per target, with no voter; who voted is never stored next to a target.
select columns_are(
  'private', 'round_results', array['round_id', 'player_id', 'votes'],
  'private.round_results has only round_id, player_id (the target) and votes: no voter column'
);
select columns_are(
  'private', 'round_voters', array['round_id', 'player_id'],
  'private.round_voters has only round_id and player_id (the voter): no target column'
);

-- The schema is reached only through security definer functions.
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated has no usage on schema private'
);

-- A round played to the reveal leaves only counts -------------------------------------------------------------------

-- Host, Ola and Bartek: the third vote reveals the round by itself.
select isnt(
  pg_temp.open_room('revealed', array['Ola', 'Bartek']), null, 'setup: a host opens a room and 2 guests join'
);
select is(pg_temp.host_starts('revealed'), 'ok', 'start_game as the host starts the round');
select is(pg_temp.guest_votes('revealed', 'Ola', 'Bartek'), 'ok', 'cast_vote as Ola is accepted');
select is(pg_temp.guest_votes('revealed', 'Bartek', null), 'ok', 'cast_vote as Bartek, an abstention, is accepted');
select is(pg_temp.urn_rows('round_voters', 'revealed'), '2', 'mid-round, private.round_voters lists the 2 voters');
select is(pg_temp.host_votes('revealed', 'Ola'), 'ok', 'cast_vote as the host, the last of 3, is accepted');
select is(pg_temp.round_phase('revealed'), 'revealed', 'the last vote revealed the round');
select is(pg_temp.urn_rows('ballot_boxes', 'revealed'), '0', 'after the reveal, no private.ballot_boxes row is left');
select is(pg_temp.urn_rows('round_voters', 'revealed'), '0', 'after the reveal, no private.round_voters row is left');

-- A round abandoned by "Nowa gra" leaves nothing ---------------------------------------------------------------------

select isnt(
  pg_temp.open_room('abandoned', array['Ola', 'Bartek']), null, 'setup: a host opens a room and 2 guests join'
);
select is(pg_temp.host_starts('abandoned'), 'ok', 'start_game as the host starts the round to abandon');
select is(pg_temp.guest_votes('abandoned', 'Ola', 'Bartek'), 'ok', 'cast_vote as Ola is accepted');
select is(pg_temp.urn_rows('round_voters', 'abandoned'), '1', 'before Nowa gra, private.round_voters holds the vote');
select is(
  pg_temp.host_opens_new_room('abandoned'), 'ok', 'setup: Nowa gra with confirmation closes the room mid-round'
);
select is(pg_temp.urn_rows('ballot_boxes', 'abandoned'), '0', 'after Nowa gra, no private.ballot_boxes row is left');
select is(pg_temp.urn_rows('round_voters', 'abandoned'), '0', 'after Nowa gra, no private.round_voters row is left');

-- The hourly sweep closes games started over 12 hours ago, and only those -------------------------------------------

-- Called directly: the schedule is checked by its row in cron.job, not by waiting for it.
select isnt(pg_temp.open_room('stale', array['Ola', 'Bartek']), null, 'setup: a host opens a room and 2 guests join');
select is(pg_temp.host_starts('stale'), 'ok', 'start_game as the host starts the stale game');
select is(pg_temp.guest_votes('stale', 'Ola', 'Bartek'), 'ok', 'cast_vote as Ola in the stale game is accepted');
select lives_ok(
  format(
    'update public.rooms set started_at = now() - interval %L where id = %L', '13 hours', pg_temp.room_of('stale')
  ),
  'setup: the stale game started 13 hours ago (rooms.started_at)'
);

select isnt(pg_temp.open_room('fresh', array['Ola', 'Bartek']), null, 'setup: a host opens a room and 2 guests join');
select is(pg_temp.host_starts('fresh'), 'ok', 'start_game as the host starts a game now');
select is(pg_temp.guest_votes('fresh', 'Ola', 'Bartek'), 'ok', 'cast_vote as Ola in the fresh game is accepted');

-- The clock runs from the start of the game, not from the room: an old lobby is not a stale game.
select isnt(pg_temp.open_room('old-lobby', array[]::text[]), null, 'setup: a host opens a room with no guests');
update public.rooms set created_at = now() - interval '13 hours' where id = pg_temp.room_of('old-lobby');

select is(pg_temp.urn_rows('round_voters', 'stale'), '1', 'before the sweep, the stale game holds its vote');
select lives_ok('select private.close_stale_games()', 'private.close_stale_games() runs as the owner');

select is(pg_temp.room_status('stale'), 'closed', 'the sweep closes a game started 13 hours ago');
select is(pg_temp.urn_rows('ballot_boxes', 'stale'), '0', 'the sweep leaves no private.ballot_boxes row of it');
select is(pg_temp.urn_rows('round_voters', 'stale'), '0', 'the sweep leaves no private.round_voters row of it');

select is(pg_temp.room_status('fresh'), 'playing', 'the sweep leaves a game started now in play');
select is(pg_temp.urn_rows('ballot_boxes', 'fresh'), '1', 'the sweep leaves the urn of a game started now');
select is(pg_temp.urn_rows('round_voters', 'fresh'), '1', 'the sweep leaves the voters of a game started now');

-- Needs the sweep itself: without it, an untouched lobby would prove nothing.
select ok(
  to_regprocedure('private.close_stale_games()') is not null and pg_temp.room_status('old-lobby') = 'lobby',
  'the sweep leaves alone a lobby created 13 hours ago'
);

select is(
  pg_temp.cron_job('close-stale-games'),
  '0 * * * * | select private.close_stale_games()',
  'cron.job runs select private.close_stale_games() every hour as close-stale-games'
);

select * from finish();

rollback;
