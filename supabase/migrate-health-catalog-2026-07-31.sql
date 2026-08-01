-- Vaccine/medication catalog — 2026-07-31
--
-- Replaces the Health quick log's free-text "Vaccine name"/"Dose" entry with a
-- catalog picker (built-ins in HEALTH_CATALOG, utils.ts, plus household-added
-- entries stored here), a smart "Brand / product" field, and a per-dog interval
-- override that drives a computed "Next due" date and an auto-maintained calendar
-- reminder item.
--
-- Safe to re-run. Every statement is guarded, and the same statements live in
-- schema.sql so a fresh database gets them without this file.

-- 1. Household-added catalog entries. Built-ins never round-trip through this
--    table — only entries added via "+ Add custom" in the picker.
create table if not exists health_catalog_entries (
  id text primary key,
  household_id uuid not null references households (id) on delete cascade,
  kind text not null check (kind in ('vaccine', 'medication')),
  name text not null,
  default_interval_days int
);

-- 2. Links a lightweight reminder item back to the (dog, catalog entry) pair it's
--    tracking, so a later dose updates that item in place instead of duplicating it.
alter table items add column if not exists health_catalog_entry_id text;

-- 3. Per-dog override of a catalog entry's interval (days), keyed by its id.
--    Absent key = use the catalog entry's own default_interval_days.
alter table dogs add column if not exists health_interval_overrides jsonb not null default '{}';

alter table health_catalog_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'health_catalog_entries' and policyname = 'authenticated read/write'
  ) then
    execute 'create policy "authenticated read/write" on health_catalog_entries for all to authenticated using (true) with check (true);';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'health_catalog_entries'
  ) then
    alter publication supabase_realtime add table health_catalog_entries;
  end if;
end $$;

-- Verification — expect the new table present, the two new columns present with
-- their defaults, and every existing items/dogs row unaffected (nullable/defaulted
-- columns never violate existing rows).
--
--   select column_name, is_nullable, data_type from information_schema.columns
--   where table_name = 'items' and column_name = 'health_catalog_entry_id';
--
--   select column_name, is_nullable, data_type from information_schema.columns
--   where table_name = 'dogs' and column_name = 'health_interval_overrides';
--
--   select count(*) from health_catalog_entries;  -- expect 0 on a database with no
--                                                   -- custom entries added yet
