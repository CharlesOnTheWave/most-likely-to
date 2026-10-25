-- S-15 game-summary: the end of the game shows a short summary of it (context/changes/game-summary/plan.md, Faza 1;
-- PRD FR-022).
--
-- room_lobby gives a closed room the sums of its reveals (game_totals): the number of its revealed rounds and, for
-- every player with a result in at least one of them, the sum of those results, in seat order, zeros included. The
-- Worker turns them into what the end screen shows; the database only adds them up.
--
-- No pair, and nothing the room has not seen. private.round_results holds a count per player and round and no voter
-- (D1 of context/archive/2026-10-13-first-live-round/research.md), and each of its counts is one the reveal of its
-- round showed everyone in the room; a sum of them names no voter either. A skipped round and a round ended without a
-- reveal (end_game, "Nowa gra" in create_room, private.close_stale_games) have no results: they add nothing to the sums
-- and are not counted among the revealed rounds. A latecomer who could vote in no revealed round (let in after the last
-- of them opened) has no result, so is not in the sums. game_totals is null in the lobby, while the game is in play
-- (after a reveal too) and for a closed room with no revealed round. The host and every player of the room read it
-- with room_lobby's checks as before this migration; anyone else still gets null.
--
-- The invariants of every round function in *_first_live_round.sql hold here too: no function returns a vote's target,
-- and counts appear only once a round is revealed. Only room_lobby changes, with the same signature (create or
-- replace), so it stays in exactly one version (supabase/tests/round_creator_view.test.sql): no new table, no grant on
-- a table, no new function.
--
-- Deployment order (plan, Critical Implementation Details): this migration ships before the Worker that uses it. The
-- Worker deployed before it copies only the keys of its own contract from room_lobby, so game_totals passes it by; the
-- Worker after it requires the key.
--
-- Never edit this file once it has been pushed; a fix is a new migration.

-- State for the screens -----------------------------------------------------------------------------------------------

-- Definer: the room's state for its host (auth.uid()) or for a player whose token hash is in this room; null for anyone
-- else, whether or not the room exists, a latecomer still waiting included. Returns nicks in seat order and no ids,
-- user ids, hashes or link code, plus the latest round of a game in play: who may vote in it (eligible: the players
-- when it opened, in seat order, so someone let in since then is among the players but not here until the next
-- question), who has voted while it is open (never how, never a count) and whether the round before it was skipped
-- (after_skip); the counts per nick once it is revealed; only its number and phase once it is skipped. A voting or
-- revealed round says its question by question_id, or, for an entry of the list with a text of its own, by
-- question_text (null otherwise). No round in the lobby, and none once the room is closed: a round that ended without a
-- reveal has no counts to show. requests: the nicks of the latecomers waiting, in the order of asking, for the host
-- only; [] for a guest, and in every status (none before the start, and none once the room is closed). question_list:
-- for the host of a room with a list, in every status, its entries not removed in the order of positions and the
-- number of its rows with a question id of the base (base_count, removed and reworded entries included); null for a
-- guest and for a room with no list. game_totals: for a closed room with a revealed round, the number of its revealed
-- rounds (revealed) and the sums of their results (totals: every player with a result in at least one of them, as
-- nick and votes, in seat order, zeros included); only counts per nick from the reveals, never a voter; null in the
-- lobby, while the game is in play and for a closed room with no revealed round.
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
  v_revealed integer;
  v_game_totals jsonb;
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
        jsonb_agg(jsonb_build_object('nick', p.nick, 'host', p.user_id is not null) order by p.seat),
        '[]'::jsonb
      )
      from public.players p
      where p.room_id = p_room_id
    ),
    'round', v_round_state,
    'requests', v_requests,
    'question_list', v_question_list,
    'game_totals', v_game_totals
  );
end;
$$;

-- Function owners and grants ------------------------------------------------------------------------------------------

-- A security definer function runs with its owner's rights; on Supabase that must be postgres.
alter function public.room_lobby(uuid, text) owner to postgres;

-- As in *_full_game_evening.sql: the revokes are repeated for every function this file creates or replaces, so each
-- one's grants read in one place.
revoke execute on function public.room_lobby(uuid, text) from public, anon, authenticated;

-- The room's state stays readable by its guests, who have no session.
grant execute on function public.room_lobby(uuid, text) to anon, authenticated;
