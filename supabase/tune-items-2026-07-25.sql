-- Bulk tuning after migrate-items-2026-07-25.sql (2026-07-25)
--
-- The migration is mechanical: it moves rows across and picks conservative
-- defaults. This file is where you make the migrated data actually *use* the new
-- model — turning on logging where it earns its keep, assigning checklist steps to
-- a specific dog, and so on.
--
-- NOTHING HERE RUNS BY DEFAULT. Every block is independent and commented out.
-- Read a block, decide if you want it, uncomment it, run it. Run one block at a
-- time so a bad result is obvious and easy to undo.
--
-- Dogs are referenced by name rather than uuid throughout, so these are safe to
-- paste without looking any ids up.

-- ===========================================================================
-- 0. Look before you leap — what did the migration actually produce?
-- ===========================================================================
-- Run this first. It's read-only.

select
  category,
  intent,
  requires_completion,
  requires_log,
  count(*) as rows,
  string_agg(title, ' | ' order by title) as titles
from items
group by category, intent, requires_completion, requires_log
order by category, intent;


-- ===========================================================================
-- 1. Turn on logging for a whole category
-- ===========================================================================
-- The migration only switched logging on for training-ish routines and health
-- rows. Anything else you want the weekly review-logs pass to read needs it
-- turned on explicitly. Example: exercise (walks, hikes) — worth logging duration
-- and how it went, so the agent can correlate exercise against behaviour.

-- update items
--    set requires_log = true,
--        log_fields = '[{"fieldName":"Duration","dataType":"number","unit":"min"},
--                       {"fieldName":"Distance","dataType":"number","unit":"mi"}]'::jsonb
--  where category = 'exercise'
--    and requires_log = false;


-- ===========================================================================
-- 2. Add a log field to items that already log, without clobbering the rest
-- ===========================================================================
-- Appends one field, skipping any item that already has it. Example: cost on
-- every vet/grooming item, so spending analytics has something to read later.

-- update items
--    set log_fields = log_fields || '[{"fieldName":"Cost","dataType":"number","unit":"$"}]'::jsonb
--  where requires_log = true
--    and category in ('vet', 'grooming', 'medication')
--    and not (log_fields @> '[{"fieldName":"Cost"}]'::jsonb);


-- ===========================================================================
-- 3. Assign every checklist step of an item to one dog
-- ===========================================================================
-- For solo-dog work that migrated with unassigned steps. Example: everything
-- tagged only to Mara — her steps should say so, so a future joint session
-- doesn't read as ambiguous.

-- update items i
--    set checklist = (
--          select jsonb_agg(step || jsonb_build_object('dogId', d.id::text))
--          from jsonb_array_elements(i.checklist) step
--          cross join (select id from dogs where name = 'Mara') d
--        )
--  where i.requires_completion = true
--    and jsonb_array_length(i.checklist) > 0
--    and i.dog_ids = array[(select id from dogs where name = 'Mara')];


-- ===========================================================================
-- 4. Split a joint session's steps between the two dogs
-- ===========================================================================
-- The case you actually described: one calendar item, different work per dog.
-- Assign by matching on the step name. Everything not matched stays unassigned,
-- i.e. "both dogs" — which is usually what you want for warm-ups.
--
-- Edit the two name lists, and the title, before running.

-- update items i
--    set checklist = (
--          select jsonb_agg(
--                   case
--                     when step->>'itemName' in ('Proof leave it with distractions', 'Place command duration')
--                       then step || jsonb_build_object('dogId', (select id from dogs where name = 'Griz')::text)
--                     when step->>'itemName' in ('Charge marker word', 'Name recognition')
--                       then step || jsonb_build_object('dogId', (select id from dogs where name = 'Mara')::text)
--                     else step - 'dogId'
--                   end
--                   order by ord
--                 )
--          from jsonb_array_elements(i.checklist) with ordinality as t(step, ord)
--        )
--  where i.title = 'REPLACE WITH THE ITEM TITLE';


-- ===========================================================================
-- 5. Re-point an item's checklist at a training milestone
-- ===========================================================================
-- Once set, the checklist is derived from the milestone's steps and ticking rows
-- off advances that milestone. Drops the item's own hand-typed steps, which is
-- the point — no more maintaining the same list twice.

-- update items
--    set checklist_source_milestone_id = 'marker-word',
--        checklist = '[]'::jsonb
--  where title = 'REPLACE WITH THE ITEM TITLE';

-- Milestone ids to choose from:
-- select id, title, dog_ids from milestones order by title;


-- ===========================================================================
-- 6. Fix intent labels in bulk
-- ===========================================================================
-- `intent` only drives the label shown in the Add menu and re-seeded defaults on
-- edit — it changes no behaviour. Worth tidying anyway so the UI reads honestly.

-- update items set intent = 'appointment'
--  where category in ('vet', 'grooming', 'vaccine') and intent <> 'appointment';

-- update items set intent = 'training'
--  where category in ('training', 'handling', 'socialization') and intent <> 'training';


-- ===========================================================================
-- 7. Make a recurring event stop nagging as an incomplete task
-- ===========================================================================
-- If the migration turned completion on for something that's really just a block
-- on the calendar (a standing work meeting, a recurring social thing), switch it
-- off. Its checklist is kept in place in case you change your mind — an item with
-- requires_completion = false simply never reads it.

-- update items
--    set requires_completion = false
--  where title in ('REPLACE', 'WITH', 'TITLES');


-- ===========================================================================
-- 8. Undo helpers
-- ===========================================================================
-- Every block above is a plain UPDATE against `items`. Nothing here deletes, and
-- the original rows are still sitting untouched in `tasks` / `calendar_events` /
-- `health_events` until you drop those tables by hand. To start the item side
-- over completely:
--
--   delete from items;            -- cascades to item_occurrences + item_logs
--   -- then re-run migrate-items-2026-07-25.sql
--
-- Only do that before you've logged anything real against the new tables.
