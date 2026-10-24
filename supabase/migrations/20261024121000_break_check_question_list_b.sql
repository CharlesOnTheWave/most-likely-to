-- BREAK-CHECK B, temporary (context/changes/question-list-review/plan.md, Faza 1 #4): reverted right after CI.
-- private.open_next_round, after the list, no longer skips candidates that are on any row of the list.
-- Expected red: question-list.test.ts "after the list, the candidates [Q02 removed, Q01 reworded, Q17] give round 17
-- the fresh Q17"; everything else green.

create or replace function private.open_next_round(p_room_id uuid, p_number integer, p_candidates text[])
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_position integer;
  v_question text;
  v_eligible uuid[];
  v_round uuid;
begin
  if coalesce(cardinality(p_candidates), 0) > 1000 then
    raise exception 'too many candidates' using errcode = '22023';
  end if;

  -- The list first. The entry's question id only when it has no text of its own.
  select g.position, case when g.text is null then g.question_id end into v_position, v_question
  from private.game_questions g
  where g.room_id = p_room_id
    and not g.removed
    and not exists (
      select 1 from private.rounds r where r.room_id = p_room_id and r.list_position = g.position
    )
  order by g.position
  limit 1;

  if v_position is null then
    select c.question_id into v_question
    from unnest(p_candidates) with ordinality as c (question_id, place)
    where c.question_id ~ '^[a-z0-9-]+-[0-9]{3}$'
      and not exists (
        select 1 from private.rounds r where r.room_id = p_room_id and r.question_id = c.question_id
      )
    order by c.place
    limit 1;

    if v_question is null then
      return false;
    end if;
  end if;

  select array_agg(p.id order by p.seat) into v_eligible
  from public.players p
  where p.room_id = p_room_id;

  insert into private.rounds (room_id, number, question_id, list_position, eligible)
  values (p_room_id, p_number, v_question, v_position, v_eligible)
  returning id into v_round;

  insert into private.ballot_boxes (round_id) values (v_round);

  return true;
end;
$$;
