-- BREAK-CHECK (a), temporary: reverted with git revert right after CI, never pushed to a database (test-plan §6.2).
-- Makes the urn's count table logged, so a round in progress would reach the WAL.
-- Expected red: only pgTAP "private.ballot_boxes is unlogged" (supabase/tests/round_creator_view.test.sql).
alter table private.ballot_boxes set logged;
