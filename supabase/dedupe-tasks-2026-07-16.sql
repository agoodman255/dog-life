-- ONE-TIME CLEANUP — run this once in the Supabase SQL Editor, then run the
-- updated schema.sql, then the updated seed.sql. Safe to delete this file
-- afterward; it's not meant to be re-run.
--
-- Root cause: unlike dogs/people/milestones, the `tasks` table has no stable
-- client-side id and no unique constraint, so every re-run of seed.sql
-- inserted a brand-new copy of every task (fresh gen_random_uuid() each
-- time) instead of updating the existing row. Re-running seed.sql multiple
-- times over this project's history piled up duplicates of every task —
-- this is what showed up as "Breakfast repeated 5+ times" on the calendar.
--
-- This script: (1) for each (household_id, title) group, keeps the
-- lowest-id row and re-points any task_instances referencing a duplicate
-- over to the keeper (so no start/end/reschedule history is lost even if it
-- happened to attach to a duplicate row), then (2) deletes the duplicates.
-- schema.sql (run after this) adds a unique constraint so this can't
-- recur, and seed.sql (regenerated) now upserts by (household_id, title)
-- instead of blindly inserting.

with ranked as (
  select id, household_id, title,
         row_number() over (partition by household_id, title order by id) as rn
  from tasks
),
keepers as (
  select household_id, title, id as keep_id from ranked where rn = 1
),
losers as (
  select r.id as lose_id, k.keep_id
  from ranked r
  join keepers k on k.household_id = r.household_id and k.title = r.title
  where r.rn > 1
)
update task_instances
set template_id = losers.keep_id
from losers
where task_instances.template_id = losers.lose_id;

with ranked as (
  select id,
         row_number() over (partition by household_id, title order by id) as rn
  from tasks
)
delete from tasks
using ranked
where tasks.id = ranked.id
  and ranked.rn > 1;
