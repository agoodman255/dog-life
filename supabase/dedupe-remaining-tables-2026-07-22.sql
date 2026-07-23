-- ONE-TIME CLEANUP — run this once in the Supabase SQL Editor, then run the
-- updated seed.sql. Safe to delete this file afterward; it's not meant to
-- be re-run.
--
-- health_events, journal_entries, relationship_logs, calendar_events, and
-- alone_time_logs had the same underlying flaw as `tasks` did: no stable id
-- and no conflict handling in the seed generator, so every re-run of
-- seed.sql inserted a fresh duplicate of every row instead of updating one
-- in place.
--
-- Unlike tasks, these tables also accept real rows entered through the app
-- (quick-log, journal entries, relationship tracker, alone-time log), so a
-- content-based unique constraint (e.g. title + date) isn't safe here — it
-- would reject legitimate future entries that happen to share a title and
-- date. Instead, scripts/generate-seed-sql.ts now assigns each seed row a
-- fixed, deterministic id and upserts on that id going forward — real rows
-- keep getting fresh server-generated ids and are never touched by reseeding.
--
-- This cleanup wipes ONLY the existing (seed-originated) rows in these 5
-- tables. That's safe specifically because this household confirmed on
-- 2026-07-22 that none of these have real logged data yet — if that's
-- changed, stop and say so before running this, since it deletes rows with
-- no way to tell seed data apart from real entries once mixed together.

delete from health_events where household_id = '11111111-1111-1111-1111-111111111111';
delete from journal_entries where household_id = '11111111-1111-1111-1111-111111111111';
delete from relationship_logs where household_id = '11111111-1111-1111-1111-111111111111';
delete from calendar_events where household_id = '11111111-1111-1111-1111-111111111111';
delete from alone_time_logs where household_id = '11111111-1111-1111-1111-111111111111';
