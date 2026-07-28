-- Link scheduled routines to the Quick log — 2026-07-27
--
-- A scheduled routine is the *expectation* ("a potty break should happen around 7:15");
-- a Quick log is the *observation* ("one happened at 7:18 — poo, outside, firm"). Same
-- event, two moments. Until now the database forbade saying so: `item_logs` could carry
-- an item_id or a quick_log_kind but never both, so logging a potty break left the 7:15
-- slot sitting not_started forever.
--
-- Safe to re-run. Every statement is guarded, and all of them also live in schema.sql so
-- a fresh database gets them without this file.
--
-- Run after migrate-quick-logs-2026-07-26.sql. That file has been amended to produce the
-- relaxed constraint too, so the order between the two doesn't actually matter — but the
-- columns it adds are assumed present here.

-- 1. A log may now be both. Widening only: every existing row already satisfies this,
--    so there is nothing to backfill and nothing that can fail.
alter table item_logs drop constraint if exists item_logs_source_check;
alter table item_logs add constraint item_logs_source_check
  check (item_id is not null or quick_log_kind is not null);

-- 2. When the thing actually happened, as distinct from when the row was written.
--    Without this a 7:18 potty break entered at 9pm reads as a 9pm event — which would
--    match it to the wrong scheduled slot, sort it to the wrong place in the day, and
--    put it in the wrong bucket in every interval calculation.
alter table item_logs add column if not exists happened_at timestamptz;
update item_logs set happened_at = logged_at where happened_at is null;

-- 3. Which logs claim an occurrence. Stored, not re-derived: deleting a log has to
--    release exactly the occurrence it satisfied, and the app already learned this
--    lesson the hard way — `alone_time_logs` rows are matched back on (date, duration,
--    dogs) because no id was stored, and two identical entries on one day delete the
--    wrong one. Same reasoning as milestone_advanced on this table.
--
--    An occurrence flips to completed only once the union of dogIds across these logs
--    covers the item's dogs, so logging a potty for one of two dogs doesn't claim the
--    other one went out.
alter table item_occurrences add column if not exists satisfied_by_log_ids text[] not null default '{}';

-- 4. Which items belong on the calendar at all. See the note in schema.sql — the column
--    says which items are background routines; the Calendar's per-viewer toggle decides
--    whether to act on it.
alter table items add column if not exists calendar_visibility text not null default 'calendar';

-- Verification — expect happened_at populated for every row, both new columns present,
-- and the relaxed constraint in place.
--
--   select count(*) as missing_happened_at from item_logs where happened_at is null;  -- expect 0
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'item_logs'::regclass and conname = 'item_logs_source_check';
--   -- expect: CHECK ((item_id IS NOT NULL) OR (quick_log_kind IS NOT NULL))
--
--   select count(*) as would_violate from item_logs
--   where item_id is null and quick_log_kind is null;  -- expect 0
--
--   select column_name, data_type, column_default from information_schema.columns
--   where table_name in ('item_occurrences', 'items')
--     and column_name in ('satisfied_by_log_ids', 'calendar_visibility');
--
-- Note on deletes: item_logs.item_id stays `on delete cascade`, which is right for a log
-- *of* an item but wrong for an observation about a dog that merely satisfied one. The
-- app detaches Quick logs (nulls item_id / occurrence_date) before removing an item, so
-- deleting the "Morning potty" routine doesn't take months of health history with it.
-- Deleting an item directly in SQL bypasses that — detach first:
--
--   update item_logs set item_id = null, occurrence_date = null
--   where item_id = '<id>' and quick_log_kind is not null;
