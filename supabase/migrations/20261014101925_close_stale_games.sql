-- S-02 first-live-round: the hourly sweep of abandoned games (context/changes/first-live-round/plan.md, Faza 2 #1b;
-- context/changes/first-live-round/reviews/plan-review.md, F1).
--
-- A round abandoned without a reveal and without "Nowa gra" must not keep its urn for weeks (decision D1 of
-- context/changes/first-live-round/research.md: the in-progress state is deleted whenever a round ends). Every hour,
-- games started more than 12 hours ago are closed and their in-progress state deleted, as create_room does; revealed
-- results (counts only) stay. A file of its own, so a refused extension cannot hold back the round's migration.
--
-- Never edit this file once it has been pushed; a fix is a new migration.

-- Installed into pg_catalog, as Supabase documents it (supabase.com/docs/guides/cron/install).
create extension if not exists pg_cron with schema pg_catalog;

-- Definer, owned by postgres, no grants: only the cron job and the owner run it. The room's row first, as in every
-- round function; a room locked by a vote in progress is skipped and closed an hour later. Raises nothing of its own,
-- so no row's values reach cron.job_run_details, which keeps the text of any error.
create function private.close_stale_games()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room uuid;
begin
  for v_room in
    select r.id
    from public.rooms r
    where r.status = 'playing' and r.started_at < now() - interval '12 hours'
    for update skip locked
  loop
    update public.rooms set status = 'closed' where id = v_room;
    perform private.drop_round_state(v_room);
  end loop;
end;
$$;

alter function private.close_stale_games() owner to postgres;
revoke execute on function private.close_stale_games() from public, anon, authenticated;

-- Every hour on the hour. Scheduling under the same name replaces the job, so running this again adds no second one.
select cron.schedule('close-stale-games', '0 * * * *', 'select private.close_stale_games()');
