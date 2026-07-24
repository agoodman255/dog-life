-- Migrates calendar_events from the pre-2026-07-23 shape (day_of_week/active_from/
-- active_to/time_label/coverage_needed) to the new recurrence-engine shape
-- (recurrence jsonb/excluded_dates/start_time/end_time/alone_time_required), and
-- unifies category taxonomy across calendar_events and tasks (the old "care" task
-- category is split into "potty"/"meals"; gym/volleyball/curling -> "sports",
-- concert/comedy -> "entertainment").
--
-- Run AFTER schema.sql (which adds the new columns as nullable/defaulted) and
-- BEFORE re-running seed.sql. Safe to run once; re-running is a no-op on rows
-- that already have the new columns filled in, since the day_of_week/time_label/
-- coverage_needed columns get dropped at the end (their absence prevents this
-- script from trying to backfill from them again).

-- 1. Backfill recurrence (jsonb) for recurring events from the old day-of-week fields.
update calendar_events
set recurrence = jsonb_strip_nulls(jsonb_build_object(
  'frequency', 'weekly',
  'interval', 1,
  'daysOfWeek', case when day_of_week is not null then jsonb_build_array(day_of_week) else null end,
  'startDate', coalesce(active_from, '2026-08-01'),
  'endDate', active_to
))
where kind = 'recurring' and recurrence is null;

-- 2. Backfill start_time from time_label where it contains a clean, parseable clock time.
update calendar_events
set start_time = (regexp_match(time_label, '(\d{1,2}:\d{2}\s*(?:AM|PM))', 'i'))[1]
where start_time is null and time_label ~* '\d{1,2}:\d{2}\s*(AM|PM)';

-- Anything that didn't yield a clean time keeps the original context in window_label
-- instead of silently dropping it.
update calendar_events
set window_label = trim(both ', ' from concat_ws(', ', nullif(window_label, ''), time_label))
where start_time is null and time_label is not null and time_label <> '';

-- 3. Backfill alone_time_required from the old coverage_needed flag.
update calendar_events
set alone_time_required = case coverage_needed when 'rover' then 'all' when 'full-day' then 'all' else 'no' end
where coverage_needed is not null;

-- 4. Unify category taxonomy on calendar_events.
update calendar_events set category = case category
  when 'gym' then 'sports'
  when 'volleyball' then 'sports'
  when 'curling' then 'sports'
  when 'concert' then 'entertainment'
  when 'comedy' then 'entertainment'
  else category
end
where category in ('gym', 'volleyball', 'curling', 'concert', 'comedy');

-- 5. Unify category taxonomy on tasks — "care" splits into "potty" vs "meals" by
-- title, matching how src/data.ts's seed tasks were reclassified.
update tasks set category = 'potty' where category = 'care' and title ~* 'potty';
update tasks set category = 'meals' where category = 'care' and title ~* '(meal|breakfast|dinner|feed)';
-- Anything left in "care" (a custom task that matched neither pattern) falls back to
-- "chores" rather than being silently stuck on a category the app no longer offers.
update tasks set category = 'chores' where category = 'care';

-- 6. Drop the old columns now that everything above is backfilled.
alter table calendar_events drop column if exists day_of_week;
alter table calendar_events drop column if exists active_from;
alter table calendar_events drop column if exists active_to;
alter table calendar_events drop column if exists time_label;
alter table calendar_events drop column if exists coverage_needed;
