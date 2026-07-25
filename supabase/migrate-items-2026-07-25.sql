-- Migration: tasks + calendar_events + health_events -> items (2026-07-25)
--
-- Run supabase/schema.sql FIRST (it creates the items / item_occurrences /
-- item_logs / item_deletions tables), then run this file once.
--
-- This is additive and re-runnable: it copies rows across and leaves the old
-- tables untouched. Nothing is dropped. Verify the counts at the bottom, use the
-- app for a bit, and only then drop the old tables by hand (statements are at the
-- very bottom, commented out deliberately — do not uncomment them in the same
-- session you run the copy).

begin;

-- --- calendar_events -> items ----------------------------------------------
-- The closest match: same scheduling model, so this is a straight column copy.
-- Neither capability flag is set, because a calendar event never had a way to be
-- completed or logged. Turn them on per-item in the app afterwards.
insert into items (
  household_id, title, category, intent, kind, recurrence, excluded_dates, date, window_label,
  start_time, end_time, duration_hours, status, attendees, dog_ids,
  requires_completion, checklist, requires_log, log_fields,
  alone_time_required, alone_time_required_amount, coverage_confirmed, coverage_notes,
  priority, supplies, setting, difficulty,
  rover_visits, prep_steps, rover_instructions, post_steps, notes
)
select
  household_id, title, category, 'event', kind, recurrence, excluded_dates, date, window_label,
  start_time, end_time, duration_hours, status, attendees, dog_ids,
  false, '[]'::jsonb, false, '[]'::jsonb,
  alone_time_required, alone_time_required_amount, coverage_confirmed, coverage_notes,
  'important', '{}', 'either', 1,
  rover_visits, prep_steps, rover_instructions, post_steps, notes
from calendar_events
on conflict (household_id, title) do nothing;

-- --- tasks -> items ---------------------------------------------------------
-- Tasks had no recurrence field at all; they simply rendered on every day the
-- calendar drew. That implicit "every day" becomes an explicit daily recurrence
-- anchored to the day the puppy comes home, so the routine does not back-fill
-- months of history that never happened.
--
-- `duration` was minutes, `duration_hours` is hours. `checklist_schema` (typed
-- rows) wins over the plain `checklist` text array when present; otherwise each
-- string becomes a boolean row. `griz_participation` is deliberately dropped —
-- `formation` and `dog_ids` already carry that, and it hardcoded one dog's name
-- into the schema.
insert into items (
  household_id, title, category, intent, kind, recurrence, window_label,
  start_time, duration_hours, status, assigned_to, dog_ids,
  requires_completion, checklist, requires_log, log_fields,
  alone_time_required, priority, supplies, setting, difficulty,
  location, formation, related_milestone_id, notes
)
select
  t.household_id,
  t.title,
  t.category,
  case when t.category in ('training', 'handling', 'socialization') then 'training' else 'routine' end,
  'recurring',
  jsonb_build_object('frequency', 'daily', 'interval', 1, 'startDate', '2026-08-01'),
  '',
  nullif(t.time, ''),
  t.duration::numeric / 60,
  'confirmed',
  t.assigned_to,
  t.dog_ids,
  true,
  case
    when jsonb_array_length(coalesce(t.checklist_schema, '[]'::jsonb)) > 0 then t.checklist_schema
    else coalesce(
      (select jsonb_agg(jsonb_build_object('itemName', c, 'dataType', 'boolean')) from unnest(t.checklist) as c),
      '[]'::jsonb
    )
  end,
  t.category in ('training', 'handling', 'socialization'),
  '[]'::jsonb,
  'no',
  t.priority,
  t.supplies,
  t.setting,
  t.difficulty,
  t.location,
  t.formation,
  t.related_milestone_id,
  t.notes
from tasks t
on conflict (household_id, title) do nothing;

-- --- health_events -> items -------------------------------------------------
-- The old `kind` column conflated a category ("was this a vet visit?") with a
-- measurement ("this row records a weight"). Categories absorb the former; the
-- latter becomes a log field, which is strictly better — a weigh-in is now a
-- value with a date attached rather than a row whose title spells the number out.
-- Every health row gets requires_log = true, since recording details afterwards
-- is the entire reason these exist.
insert into items (
  household_id, title, category, intent, kind, date, window_label,
  duration_hours, status, dog_ids,
  requires_completion, checklist, requires_log, log_fields,
  alone_time_required, priority, supplies, setting, difficulty,
  document_url, notes
)
select
  h.household_id,
  h.title,
  case h.kind
    when 'vaccine' then 'vaccine'
    when 'vet' then 'vet'
    when 'medication' then 'medication'
    when 'grooming' then 'grooming'
    else 'health'
  end,
  case when h.kind in ('vet', 'vaccine', 'grooming') then 'appointment' else 'health-record' end,
  'one-off',
  h.date,
  '',
  case when h.kind in ('vet', 'vaccine', 'grooming') then 1 else null end,
  'confirmed',
  case when h.dog_id is null then '{}'::uuid[] else array[h.dog_id] end,
  false,
  '[]'::jsonb,
  true,
  case h.kind
    when 'vet' then '[{"fieldName":"Weight","dataType":"number","unit":"lbs"},{"fieldName":"Temperature","dataType":"number","unit":"°F"},{"fieldName":"Cost","dataType":"number","unit":"$"},{"fieldName":"Next due","dataType":"date"}]'::jsonb
    when 'vaccine' then '[{"fieldName":"Vaccine name","dataType":"text"},{"fieldName":"Next due","dataType":"date"},{"fieldName":"Cost","dataType":"number","unit":"$"}]'::jsonb
    when 'medication' then '[{"fieldName":"Dose","dataType":"text"},{"fieldName":"Cost","dataType":"number","unit":"$"}]'::jsonb
    when 'grooming' then '[{"fieldName":"Weight","dataType":"number","unit":"lbs"},{"fieldName":"Cost","dataType":"number","unit":"$"}]'::jsonb
    else '[{"fieldName":"Weight","dataType":"number","unit":"lbs"},{"fieldName":"Cost","dataType":"number","unit":"$"}]'::jsonb
  end,
  'no',
  'important',
  '{}',
  'either',
  1,
  h.document_url,
  h.notes
from health_events h
on conflict (household_id, title) do nothing;

-- --- task_instances -> item_occurrences -------------------------------------
-- Matched back to the new item by title, since the old template_id pointed at a
-- tasks row whose id did not carry over.
insert into item_occurrences (
  id, household_id, item_id, original_date, date, state, assigned_to, original_assigned_to,
  scheduled_time, start_time, start_time_zone, end_time, end_time_zone, rating, checklist, history
)
select
  ti.id, ti.household_id, i.id, ti.original_date, ti.date, ti.state, ti.assigned_to, ti.original_assigned_to,
  ti.scheduled_time, ti.start_time, ti.start_time_zone, ti.end_time, ti.end_time_zone, ti.rating, ti.checklist, ti.history
from task_instances ti
join tasks t on t.id = ti.template_id
join items i on i.household_id = t.household_id and i.title = t.title
on conflict (id) do nothing;

-- --- deletion audit tables --------------------------------------------------
insert into item_deletions (id, household_id, item_id, item_title, scope, occurrence_date, note, deleted_at)
select id, household_id, event_id, event_title, scope, occurrence_date, note, deleted_at
from calendar_event_deletions
on conflict (id) do nothing;

insert into item_deletions (id, household_id, item_id, item_title, scope, occurrence_date, note, deleted_at)
select id, household_id, task_id, task_title, scope, occurrence_date, note, deleted_at
from task_deletions
on conflict (id) do nothing;

-- --- inbox_requests ---------------------------------------------------------
-- Occurrence ids carried over unchanged above, so this is a straight copy.
update inbox_requests set item_occurrence_id = task_instance_id where item_occurrence_id is null;

commit;

-- --- Verify before dropping anything ---------------------------------------
-- Expect items = tasks + calendar_events + health_events, minus any title
-- collisions the `on conflict do nothing` clauses skipped. If the numbers do not
-- line up, look for duplicate titles before assuming data was lost.
select
  (select count(*) from items) as items,
  (select count(*) from tasks) as old_tasks,
  (select count(*) from calendar_events) as old_calendar_events,
  (select count(*) from health_events) as old_health_events,
  (select count(*) from item_occurrences) as item_occurrences,
  (select count(*) from task_instances) as old_task_instances;

-- Titles that collided and were therefore skipped — check these by hand:
select title, count(*) from (
  select title from tasks
  union all select title from calendar_events
  union all select title from health_events
) all_titles group by title having count(*) > 1;

-- --- Cleanup (run only after verifying, in a separate session) --------------
-- drop table if exists inbox_requests cascade;  -- recreate from schema.sql afterwards
-- drop table if exists task_instances cascade;
-- drop table if exists task_deletions;
-- drop table if exists calendar_event_deletions;
-- drop table if exists tasks cascade;
-- drop table if exists calendar_events cascade;
-- drop table if exists health_events cascade;
