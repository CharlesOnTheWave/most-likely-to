-- TEMPORARY break-check, never `db push`, reverted in the next commit.
--
-- context/changes/testing-lobby-foundation/plan.md, Faza 2, item 4. Opens three permissions on purpose, breaking the
-- rules in AGENTS.md (Conventions) on purpose, so that CI turns exactly these tests red: the canary (anon reads
-- player_secrets), G2 (anon calls create_room) and H6 (host B selects host A's room). Every other test stays as it was.

grant select on table public.player_secrets to anon;

grant execute on function public.create_room(text, text, text[], text[], boolean) to anon;

drop policy "Hosts read their rooms" on public.rooms;
create policy "Break-check: any host reads any room" on public.rooms
  for select to authenticated
  using (true);
