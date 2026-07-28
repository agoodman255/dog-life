-- Quick log v2 (backlog item 17) — 2026-07-26
--
-- Makes `item_logs` able to hold a Dashboard Quick log: a potty break, play session,
-- training rep, meal or water check recorded against the dog(s) directly, with no
-- scheduled item behind it.
--
-- Why extend item_logs rather than add a table: the ingest pipeline the review-logs
-- skill runs already reads this table incrementally via `processed_at`, and a Quick
-- log is the same shape as an item log — timestamped, structured `values`, free text,
-- dog-scoped. A second table would have meant a second ingest path for no gain.
--
-- Safe to re-run. Every statement is guarded, and the same statements live in
-- schema.sql so a fresh database gets them without this file.

-- 1. A Quick log has no item behind it.
alter table item_logs alter column item_id drop not null;

-- 2. Which of the five it is. Makes the row self-describing, so the ingest pass never
--    has to join to `items` to know what it's reading.
alter table item_logs add column if not exists quick_log_kind text;

-- 3. The 1-5 score every Quick log carries. Same scale as item_occurrences.rating.
alter table item_logs add column if not exists rating int;

-- 4. Set when the Quick log's training type was a milestone, so a session that
--    advanced milestone progress can be traced back to the entry that caused it.
alter table item_logs add column if not exists milestone_id text references milestones (id) on delete set null;

-- 5. Which of that milestone's steps the entry advanced. Deleting the log rolls
--    exactly these back one session each, so a mis-tick isn't permanent. Also tells
--    the ingest pass which steps were actually practised, not just which milestone.
alter table item_logs add column if not exists advanced_step_titles text[] not null default '{}';

-- At least one source: an item log has item_id, a Quick log has quick_log_kind, and a
-- Quick log that satisfied a scheduled slot has both. Existing rows all have item_id
-- set and quick_log_kind null, so they pass as-is.
--
-- Amended in place on 2026-07-27 (this file had never been run against production) so
-- whichever of this and schema.sql runs first produces the relaxed form. The drop makes
-- it safe if an interim run installed the original XOR version.
alter table item_logs drop constraint if exists item_logs_source_check;
alter table item_logs add constraint item_logs_source_check
  check (item_id is not null or quick_log_kind is not null);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'item_logs_rating_check') then
    alter table item_logs add constraint item_logs_rating_check
      check (rating is null or rating between 1 and 5);
  end if;
end $$;

-- Feeds the Dashboard's Log section, which reads one day of Quick logs at a time.
create index if not exists item_logs_quick_idx on item_logs (quick_log_kind, occurrence_date) where quick_log_kind is not null;

-- Verification — expect item_id nullable, the three new columns present, both
-- constraints listed, and every existing row still satisfying the source check.
--
--   select column_name, is_nullable, data_type from information_schema.columns
--   where table_name = 'item_logs' order by ordinal_position;
--
--   select conname from pg_constraint where conrelid = 'item_logs'::regclass;
--
--   select count(*) as would_violate from item_logs
--   where item_id is null and quick_log_kind is null;  -- expect 0
--
-- Note: nothing here touches `alone_time_logs`. Alone time is now logged through the
-- Quick log's Training type, but it still writes an `alone_time_logs` row as well —
-- that table is what computeDogAloneTimeReadiness reads, and it is unchanged.
