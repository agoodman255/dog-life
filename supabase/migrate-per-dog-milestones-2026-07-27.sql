-- Per-dog milestone progress + starting positions — 2026-07-27
--
-- Two changes in one pass, because they're the same rewrite of `milestones.steps`:
--
-- 1. Each step object loses its single shared `completedSessions` number and gains
--    `sessionsByDog`, a map of dog id -> sessions logged. One counter per step meant
--    every dog on a milestone shared one number; an adult proofing a known cue and a
--    puppy meeting it for the first time are not at the same place, and a blended
--    figure described neither.
--
-- 2. Sets the household's intended starting positions (Andrew's call, 2026-07-27):
--      * Griz — a trained six-year-old — starts every milestone he's on all but
--        finished: every step complete except one session on the last one. Closest to
--        100% without being there, which is honest (he knows the material, but nothing
--        has been observed and logged in this app yet) and leaves each milestone one
--        real session from completing.
--      * Mara — a brand-new puppy — starts at zero across the board. Any progress
--        previously recorded against her is cleared, deliberately.
--
-- `milestones.steps` is jsonb, so no columns change. Griz is also added to every
-- milestone except the genuinely puppy-scoped one, since he was only on 2 of 36.
--
-- Safe to re-run: it recomputes the same end state each time rather than incrementing.
-- NOTE this is a reset, not a merge — re-running after real sessions have been logged
-- would wipe them back to these starting positions. Run it once, before logging.

begin;

-- Dogs are resolved by name rather than hardcoded uuid so this works against a
-- database seeded independently of supabase/seed.sql.
do $$
declare
  griz_id uuid;
  mara_id uuid;
begin
  select id into griz_id from dogs where name = 'Griz' limit 1;
  select id into mara_id from dogs where name = 'Mara' limit 1;
  if griz_id is null then
    raise exception 'No dog named Griz found — check the dogs table before running this.';
  end if;
  if mara_id is null then
    raise notice 'No dog named Mara found; continuing (only Griz progress will be set).';
  end if;

  -- 1. Griz joins the whole training catalogue. Only the puppy vaccine series stays
  --    single-dog; everything else (obedience, tricks, handling, socialization,
  --    confidence) applies to a dog of any age.
  update milestones m
  set dog_ids = m.dog_ids || griz_id
  where m.id <> 'vaccines-complete'
    and not (griz_id = any(m.dog_ids));

  -- 2. Rewrite every step: drop the old shared counter, write per-dog counts.
  --    Mara is simply left out of the map — a missing key reads as zero.
  update milestones m
  set steps = (
    select jsonb_agg(
      (step - 'completedSessions' - 'sessionsByDog')
      || jsonb_build_object(
           'sessionsByDog',
           case
             when griz_id = any(m.dog_ids) then jsonb_build_object(
               griz_id::text,
               case
                 when step_index = jsonb_array_length(m.steps)
                   then greatest(coalesce((step ->> 'sessionsRequired')::int, 0) - 1, 0)
                 else coalesce((step ->> 'sessionsRequired')::int, 0)
               end
             )
             else '{}'::jsonb
           end
         )
      order by step_index
    )
    from jsonb_array_elements(m.steps) with ordinality as t(step, step_index)
  )
  where jsonb_typeof(m.steps) = 'array'
    and jsonb_array_length(m.steps) > 0;

  -- 3. Stored status is the across-all-dogs one. Griz having progress everywhere makes
  --    these "current"; the app recomputes this on load anyway, but setting it here
  --    avoids every card rendering "locked" for a beat on first paint.
  update milestones m
  set status = 'current'
  where griz_id = any(m.dog_ids)
    and m.status not in ('current', 'skipped', 'delayed');
end $$;

commit;

-- Verification — expect zero rows from the first (nothing left un-migrated), then
-- Griz just under 100% everywhere and Mara at zero.
--
--   select id, title from milestones
--   where exists (select 1 from jsonb_array_elements(steps) s where s ? 'completedSessions');
--
--   select m.title,
--          sum((s ->> 'sessionsRequired')::int) as required,
--          sum(coalesce((s -> 'sessionsByDog' ->> d.id::text)::int, 0)) as griz_done
--   from milestones m
--   cross join jsonb_array_elements(m.steps) s
--   join dogs d on d.name = 'Griz'
--   group by m.title
--   order by m.title;
--
-- Rollback is a restore from backup: the per-dog split can't be reversed to a single
-- number without arbitrarily picking one dog's count, and step 2 discards whatever
-- was there before. Snapshot `milestones` first if that matters:
--
--   create table milestones_backup_2026_07_27 as select * from milestones;
