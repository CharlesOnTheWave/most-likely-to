-- The creator's view of a round (#1): what the database owner can read and the publishable key cannot. Catalog, grants,
-- publication and the rows a round leaves behind, read as postgres on the throwaway database of the CI job db. Runs
-- after the Vitest db suite on the same database, so other rooms exist: every count here is scoped to this file's rooms
-- and rounds. Oracle: decision D1 of context/archive/2026-10-13-first-live-round/research.md (the urn that disappears:
-- in-progress state only in unlogged private tables with no grants, outside the publication, deleted at the reveal and
-- whenever a round ends otherwise), plan-review F1 of that change (an hourly pg_cron sweep closes games started more
-- than 12 hours ago) and decisions D3 and D4 of context/changes/full-game-evening/research.md (a skipped round stays as
-- a row with no urn and no count; ending the game drops the urn).
--
-- The round's objects (private.rounds, round_results, ballot_boxes, round_voters, rooms.started_at, start_game,
-- cast_vote, private.close_stale_games, the cron schema) came with S-02; the evening's (next_round, skip_round,
-- end_game, cast_vote with p_round) come with phase 2 of S-03. Each assertion about an object that may be missing must
-- be its own `not ok`, never an error that ends the file: nothing here names them statically. They are reached only
-- through to_regclass, to_regprocedure, pgTAP functions that report a missing table (table_privs_are, columns_are),
-- lives_ok, and the helpers below, which run a call or a count dynamically and hand the error back as text for the TAP
-- diagnostics.
--
-- Rounds are played through the functions as the game's roles: each call switches to anon, or to authenticated with
-- the host in request.jwt.claims, and back to the owner. Hosts are rows inserted into auth.users by the owner. The
-- whole file is rolled back.

begin;

select plan(105);

-- Helpers ------------------------------------------------------------------------------------------------------------

-- This file's rooms and guests, and every round of those rooms seen so far. A round is remembered by each move of the
-- host and by each count, and never forgotten: a count cannot pass because the round row itself was deleted while its
-- urn rows stayed behind, and the rounds opened after the start (S-03) are counted too.
create temp table test_rooms (key text primary key, host_id uuid not null, room_id uuid not null);
create temp table test_rounds (
  room_key text not null,
  number integer not null,
  round_id uuid not null,
  primary key (room_key, number)
);
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

-- Adds the room's rounds that exist now to test_rounds. Raises when private.rounds cannot be read; the callers turn
-- that into text.
create function pg_temp.remember_rounds(p_key text) returns void language plpgsql as $$
begin
  if to_regclass('private.rounds') is null then
    return;
  end if;
  execute $q$
    insert into pg_temp.test_rounds (room_key, number, round_id)
    select $1, r.number, r.id from private.rounds r where r.room_id = $2
    on conflict (room_key, number) do nothing
  $q$ using p_key, pg_temp.room_of(p_key);
end;
$$;

-- The id of the room's round p_number as remembered, or null.
create function pg_temp.round_id_of(p_key text, p_number integer) returns uuid language sql as $$
  select t.round_id from pg_temp.test_rounds t where t.room_key = p_key and t.number = p_number
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

-- A move of the room's host, made as the host; then the room's rounds are remembered.
create function pg_temp.host_moves(p_key text, p_sql text) returns text language plpgsql as $$
declare
  v_outcome text;
begin
  v_outcome := pg_temp.outcome(pg_temp.call_as('authenticated', pg_temp.host_of(p_key), p_sql));
  begin
    perform pg_temp.remember_rounds(p_key);
  exception when others then
    return 'moved, but the rounds could not be read: ' || sqlstate || ' ' || sqlerrm;
  end;
  return v_outcome;
end;
$$;

-- "Zacznij grę" as the room's host, with a real question id.
create function pg_temp.host_starts(p_key text) returns text language plpgsql as $$
begin
  return pg_temp.host_moves(p_key, format(
    'select public.start_game(%L, %L)', pg_temp.room_of(p_key), 'na-co-dzien-001'
  ));
end;
$$;

-- "Odsłoń wynik" as the room's host.
create function pg_temp.host_reveals(p_key text) returns text language plpgsql as $$
begin
  return pg_temp.host_moves(p_key, format('select public.reveal_round(%L)', pg_temp.room_of(p_key)));
end;
$$;

-- "Następne pytanie" as the room's host: p_round is the round on the host's screen, p_candidates the Worker's pool.
create function pg_temp.host_next(p_key text, p_round integer, p_candidates text[]) returns text language plpgsql as $$
begin
  return pg_temp.host_moves(p_key, format(
    'select public.next_round(%L, %s, %L::text[])', pg_temp.room_of(p_key), p_round, p_candidates
  ));
end;
$$;

-- "Pomiń pytanie" as the room's host.
create function pg_temp.host_skips(p_key text, p_round integer, p_candidates text[]) returns text language plpgsql as $$
begin
  return pg_temp.host_moves(p_key, format(
    'select public.skip_round(%L, %s, %L::text[])', pg_temp.room_of(p_key), p_round, p_candidates
  ));
end;
$$;

-- "Zakończ grę" as the room's host.
create function pg_temp.host_ends(p_key text) returns text language plpgsql as $$
begin
  return pg_temp.host_moves(p_key, format('select public.end_game(%L)', pg_temp.room_of(p_key)));
end;
$$;

-- A guest of the room votes with its own token; a null target is an abstention. Like host_votes, with no question
-- number: the call of the Worker deployed before S-03, which must keep working once cast_vote takes p_round.
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

-- Rows in one urn table, as text: a count, or why there is none to give. Of every round of the room seen so far, or of
-- round p_number only, so a new round's empty urn is never counted as a leftover of the one before it.
create function pg_temp.urn_rows(p_table text, p_key text, p_number integer default null) returns text
language plpgsql as $$
declare
  v_ids uuid[];
  v_count bigint;
begin
  if to_regclass(format('private.%I', p_table)) is null then
    return 'no table private.' || p_table;
  end if;
  perform pg_temp.remember_rounds(p_key);
  select array_agg(t.round_id) into v_ids
  from pg_temp.test_rounds t
  where t.room_key = p_key and (p_number is null or t.number = p_number);
  if coalesce(cardinality(v_ids), 0) = 0 then
    return coalesce('no round ' || p_number || ' in this room', 'no round was started in this room');
  end if;
  execute format('select count(*) from private.%I u where u.round_id = any($1)', p_table)
    into v_count using v_ids;
  return v_count::text;
exception when others then
  return 'error ' || sqlstate || ': ' || sqlerrm;
end;
$$;

-- The phase of the room's round p_number.
create function pg_temp.round_phase(p_key text, p_number integer) returns text language plpgsql as $$
declare
  v_id uuid;
  v_phase text;
begin
  if to_regclass('private.rounds') is null then
    return 'no table private.rounds';
  end if;
  perform pg_temp.remember_rounds(p_key);
  v_id := pg_temp.round_id_of(p_key, p_number);
  if v_id is null then
    return 'no round ' || p_number || ' in this room';
  end if;
  execute 'select r.phase::text from private.rounds r where r.id = $1' into v_phase using v_id;
  return coalesce(v_phase, 'the round row is gone');
exception when others then
  return 'error ' || sqlstate || ': ' || sqlerrm;
end;
$$;

-- What a crash does to one room's round: the unlogged urn tables lose their rows and the logged round stays in voting.
-- A real crash empties both tables whole; this file deletes only its own room's rows.
create function pg_temp.crash_urn(p_key text) returns text language plpgsql as $$
declare
  v_ids uuid[];
begin
  perform pg_temp.remember_rounds(p_key);
  select array_agg(t.round_id) into v_ids from pg_temp.test_rounds t where t.room_key = p_key;
  if coalesce(cardinality(v_ids), 0) = 0 then
    return 'no round was started in this room';
  end if;
  execute 'delete from private.ballot_boxes b where b.round_id = any($1)' using v_ids;
  execute 'delete from private.round_voters v where v.round_id = any($1)' using v_ids;
  return 'emptied';
exception when others then
  return 'error ' || sqlstate || ': ' || sqlerrm;
end;
$$;

-- The revealed result of the room's round p_number as one line: every counted player by nick, then the abstentions
-- and the ballots.
create function pg_temp.results_of(p_key text, p_number integer) returns text language plpgsql as $$
declare
  v_id uuid;
  v_results text;
begin
  perform pg_temp.remember_rounds(p_key);
  v_id := pg_temp.round_id_of(p_key, p_number);
  if v_id is null then
    return 'no round ' || p_number || ' in this room';
  end if;
  execute $q$
    select string_agg(p.nick || ' ' || rr.votes, ', ' order by p.nick)
      || ' | abstained ' || max(r.abstained) || ' | ballots ' || max(r.ballots)
    from private.rounds r
    join private.round_results rr on rr.round_id = r.id
    join public.players p on p.id = rr.player_id
    where r.id = $1
  $q$ into v_results using v_id;
  return coalesce(v_results, 'no results');
exception when others then
  return 'error ' || sqlstate || ': ' || sqlerrm;
end;
$$;

-- Every count the room's round p_number keeps: the abstentions and the ballots (set at the reveal, never before) and
-- its rows in private.round_results. A round that ended without a reveal keeps 'abstained none | ballots none |
-- results 0'.
create function pg_temp.round_counts(p_key text, p_number integer) returns text language plpgsql as $$
declare
  v_id uuid;
  v_counts text;
begin
  perform pg_temp.remember_rounds(p_key);
  v_id := pg_temp.round_id_of(p_key, p_number);
  if v_id is null then
    return 'no round ' || p_number || ' in this room';
  end if;
  execute $q$
    select 'abstained ' || coalesce(r.abstained::text, 'none')
      || ' | ballots ' || coalesce(r.ballots::text, 'none')
      || ' | results ' || (select count(*) from private.round_results rr where rr.round_id = r.id)
    from private.rounds r
    where r.id = $1
  $q$ into v_counts using v_id;
  return coalesce(v_counts, 'the round row is gone');
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

-- Every table and view of schema private, today's and any later one, that fails one check: 'none', or their names.
-- 'grants': any privilege of anon or authenticated, on the table or a column of it; 'published': in
-- supabase_realtime; 'order': a time, serial or identity column. The scan must see private.rounds, or it proves
-- nothing.
create function pg_temp.private_tables_failing(p_check text) returns text language plpgsql as $$
declare
  v_tables text[];
  v_failing text;
begin
  if p_check not in ('grants', 'published', 'order') then
    return 'unknown check ' || p_check;
  end if;
  select array_agg(c.relname::text order by c.relname) into v_tables
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'private' and c.relkind in ('r', 'p', 'v', 'm', 'f');
  if not ('rounds' = any (coalesce(v_tables, '{}'))) then
    return 'private.rounds is not among the tables of schema private';
  end if;
  select string_agg(t.name, ', ' order by t.name) into v_failing
  from unnest(v_tables) as t (name)
  where case p_check
    when 'grants' then exists (
      select 1
      from unnest(array['anon', 'authenticated']) as g (role_name)
      where has_table_privilege(
          g.role_name, format('private.%I', t.name), 'select,insert,update,delete,truncate,references,trigger'
        )
        or has_any_column_privilege(g.role_name, format('private.%I', t.name), 'select,insert,update,references')
    )
    when 'published' then exists (
      select 1 from pg_catalog.pg_publication_tables p
      where p.pubname = 'supabase_realtime' and p.schemaname = 'private' and p.tablename = t.name
    )
    else pg_temp.order_columns(t.name) <> 'none'
  end;
  return coalesce(v_failing, 'none');
end;
$$;

-- How a function runs and who may call it, as one line: definer or invoker, owner, settings (search_path), and which
-- of anon, authenticated and PUBLIC hold execute. 'no function <signature>' when it is missing.
create function pg_temp.function_facts(p_signature text) returns text language plpgsql as $$
declare
  v_fn regprocedure := to_regprocedure(p_signature);
  v_facts text;
begin
  if v_fn is null then
    return 'no function ' || p_signature;
  end if;
  select concat_ws(' | ',
    case when p.prosecdef then 'security definer' else 'security invoker' end,
    'owner ' || pg_catalog.pg_get_userbyid(p.proowner),
    coalesce(array_to_string(p.proconfig, ', '), 'no settings'),
    'execute: ' || coalesce((
      select string_agg(g.grantee, ', ' order by g.grantee)
      from (values ('anon'), ('authenticated'), ('public')) as g (grantee)
      where case g.grantee
        when 'public' then exists (
          select 1 from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE'
        )
        else has_function_privilege(g.grantee, p.oid, 'execute')
      end
    ), 'nobody')
  )
  into v_facts
  from pg_catalog.pg_proc p
  where p.oid = v_fn;
  return v_facts;
end;
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

-- The same, for every table of schema private: the ones above by name, and any later one by this scan (S-03 adds none,
-- so the scan holds from the start).
select is(
  pg_temp.private_tables_failing('grants'), 'none',
  'no table of schema private grants anything to anon or authenticated'
);
select is(pg_temp.private_tables_failing('published'), 'none', 'no table of schema private is in supabase_realtime');
select is(
  pg_temp.private_tables_failing('order'), 'none', 'no table of schema private has a time, serial or identity column'
);

-- Catalog: the evening's functions -----------------------------------------------------------------------------------

-- A security definer function runs as its owner: postgres, with an empty search_path, and only the role the game needs
-- may call it. Positive control first: S-02's start_game passes the same check, so a red one below is the function's,
-- not the check's.
select is(
  pg_temp.function_facts('public.start_game(uuid, text)'),
  'security definer | owner postgres | search_path="" | execute: authenticated',
  'positive control of the check: start_game runs as postgres with an empty search_path, for authenticated only'
);
select is(
  pg_temp.function_facts('public.next_round(uuid, integer, text[])'),
  'security definer | owner postgres | search_path="" | execute: authenticated',
  'next_round runs as postgres with an empty search_path, for authenticated only'
);
select is(
  pg_temp.function_facts('public.skip_round(uuid, integer, text[])'),
  'security definer | owner postgres | search_path="" | execute: authenticated',
  'skip_round runs as postgres with an empty search_path, for authenticated only'
);
select is(
  pg_temp.function_facts('public.end_game(uuid)'),
  'security definer | owner postgres | search_path="" | execute: authenticated',
  'end_game runs as postgres with an empty search_path, for authenticated only'
);
select is(
  pg_temp.function_facts('public.cast_vote(uuid, text, text, integer)'),
  'security definer | owner postgres | search_path="" | execute: anon, authenticated',
  'cast_vote with p_round runs as postgres with an empty search_path, for anon and authenticated'
);

-- Two versions side by side would be a back door: the one without p_round would take a vote into a skipped round.
select is(
  (
    select string_agg(p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')', '; ')
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cast_vote'
  ),
  'cast_vote(p_room_id uuid, p_target text, p_player_token text, p_round integer)',
  'cast_vote exists in exactly one version, the one with p_round'
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
select is(pg_temp.round_phase('revealed', 1), 'revealed', 'the last vote revealed the round');
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

-- A round skipped while voting keeps nothing of its votes -------------------------------------------------------

-- D3: the skipped round stays as a row in phase skipped, with no urn and no count; the next round opens with its own
-- empty urn, so only round 2's rows are counted.
select isnt(pg_temp.open_room('skipped', array['Ola', 'Bartek']), null, 'setup: a host opens a room and 2 guests join');
select is(pg_temp.host_starts('skipped'), 'ok', 'start_game as the host starts the evening with a skip');
select is(pg_temp.host_reveals('skipped'), 'ok', 'setup: reveal_round as the host reveals round 1');
select is(
  pg_temp.host_next('skipped', 1, array['na-co-dzien-001', 'na-co-dzien-002']), 'ok',
  'next_round as the host opens round 2'
);
select is(pg_temp.guest_votes('skipped', 'Ola', 'Bartek'), 'ok', 'cast_vote as Ola in round 2 is accepted');
select is(
  pg_temp.urn_rows('round_voters', 'skipped', 2), '1', 'before the skip, private.round_voters of round 2 holds the vote'
);
select is(
  pg_temp.host_skips('skipped', 2, array['na-co-dzien-001', 'na-co-dzien-002', 'na-co-dzien-003']), 'ok',
  'skip_round as the host skips round 2 while it is voting'
);
select is(pg_temp.round_phase('skipped', 2), 'skipped', 'the skipped round stays as a row in phase skipped');
select is(
  pg_temp.urn_rows('ballot_boxes', 'skipped', 2), '0', 'after the skip, no private.ballot_boxes row of round 2 is left'
);
select is(
  pg_temp.urn_rows('round_voters', 'skipped', 2), '0', 'after the skip, no private.round_voters row of round 2 is left'
);
select is(
  pg_temp.round_counts('skipped', 2), 'abstained none | ballots none | results 0',
  'the skipped round keeps no count: no abstentions, no ballots, no results'
);

-- A game ended while a round is voting keeps nothing of that round ---------------------------------------------------

-- D4: "Zakończ grę" closes the room and drops the urn of the round in progress, as "Nowa gra" does.
select isnt(pg_temp.open_room('ended', array['Ola', 'Bartek']), null, 'setup: a host opens a room and 2 guests join');
select is(pg_temp.host_starts('ended'), 'ok', 'start_game as the host starts the evening to end');
select is(pg_temp.host_reveals('ended'), 'ok', 'setup: reveal_round as the host reveals round 1');
select is(
  pg_temp.host_next('ended', 1, array['na-co-dzien-001', 'na-co-dzien-002']), 'ok',
  'next_round as the host opens round 2'
);
select is(pg_temp.guest_votes('ended', 'Ola', 'Bartek'), 'ok', 'cast_vote as Ola in round 2 is accepted');
select is(
  pg_temp.urn_rows('round_voters', 'ended', 2), '1', 'before the end, private.round_voters of round 2 holds the vote'
);
select is(pg_temp.host_ends('ended'), 'ok', 'end_game as the host ends the game while round 2 is voting');
select is(pg_temp.room_status('ended'), 'closed', 'end_game closes the room');
select is(
  pg_temp.urn_rows('ballot_boxes', 'ended', 2), '0', 'after the end, no private.ballot_boxes row of round 2 is left'
);
select is(
  pg_temp.urn_rows('round_voters', 'ended', 2), '0', 'after the end, no private.round_voters row of round 2 is left'
);
select is(
  pg_temp.round_counts('ended', 2), 'abstained none | ballots none | results 0',
  'the round ended without a reveal keeps no count'
);

-- A crash mid-round loses the votes cast before it, and only those -------------------------------------------------

-- The urn is unlogged, so a crash empties it while the logged round stays in voting. The votes cast before the crash
-- are lost and their voters may vote again (D1, plan Migration Notes); every vote after it must count. Oracle written
-- out from the votes after the crash: Ola for Bartek, Bartek abstains, the host for Ola.
select isnt(
  pg_temp.open_room('crashed', array['Ola', 'Bartek']), null, 'setup: a host opens a room and 2 guests join'
);
select is(pg_temp.host_starts('crashed'), 'ok', 'start_game as the host starts the round to crash');
select is(pg_temp.guest_votes('crashed', 'Ola', 'Ola'), 'ok', 'cast_vote as Ola before the crash is accepted');
select is(pg_temp.crash_urn('crashed'), 'emptied', 'setup: a crash empties the urn of the round in progress');
select is(
  pg_temp.guest_votes('crashed', 'Ola', 'Bartek'), 'ok', 'after the crash, Ola, whose vote it lost, votes again'
);
select is(pg_temp.guest_votes('crashed', 'Bartek', null), 'ok', 'after the crash, Bartek abstains');
select is(pg_temp.host_votes('crashed', 'Ola'), 'ok', 'after the crash, the host votes, the last of 3');
select is(pg_temp.round_phase('crashed', 1), 'revealed', 'the last vote after the crash revealed the round');
select is(
  pg_temp.results_of('crashed', 1),
  'Bartek 1, Host 0, Ola 1 | abstained 1 | ballots 3',
  'the reveal after a crash counts every vote cast after it'
);

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

-- S-03: an evening abandoned in its second round, whose urn only a sweep that reads every round of the room drops.
select isnt(
  pg_temp.open_room('stale-round-2', array['Ola', 'Bartek']), null, 'setup: a host opens a room and 2 guests join'
);
select is(pg_temp.host_starts('stale-round-2'), 'ok', 'start_game as the host starts the stale evening');
select is(pg_temp.host_reveals('stale-round-2'), 'ok', 'setup: reveal_round as the host reveals round 1');
select is(
  pg_temp.host_next('stale-round-2', 1, array['na-co-dzien-001', 'na-co-dzien-002']), 'ok',
  'next_round as the host opens round 2 of the stale evening'
);
select is(
  pg_temp.guest_votes('stale-round-2', 'Ola', 'Bartek'), 'ok',
  'cast_vote as Ola in round 2 of the stale evening is accepted'
);
select lives_ok(
  format(
    'update public.rooms set started_at = now() - interval %L where id = %L',
    '13 hours', pg_temp.room_of('stale-round-2')
  ),
  'setup: the stale evening started 13 hours ago (rooms.started_at)'
);

select is(pg_temp.urn_rows('round_voters', 'stale'), '1', 'before the sweep, the stale game holds its vote');
select is(
  pg_temp.urn_rows('round_voters', 'stale-round-2', 2), '1',
  'before the sweep, round 2 of the stale evening holds its vote'
);
select lives_ok('select private.close_stale_games()', 'private.close_stale_games() runs as the owner');

select is(pg_temp.room_status('stale'), 'closed', 'the sweep closes a game started 13 hours ago');
select is(pg_temp.urn_rows('ballot_boxes', 'stale'), '0', 'the sweep leaves no private.ballot_boxes row of it');
select is(pg_temp.urn_rows('round_voters', 'stale'), '0', 'the sweep leaves no private.round_voters row of it');
select is(
  pg_temp.urn_rows('ballot_boxes', 'stale-round-2', 2), '0',
  'the sweep leaves no private.ballot_boxes row of the stale evening''s round 2'
);
select is(
  pg_temp.urn_rows('round_voters', 'stale-round-2', 2), '0',
  'the sweep leaves no private.round_voters row of the stale evening''s round 2'
);

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
