-- Dog Life OS — Supabase schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to re-run: every statement is idempotent (create-if-not-exists / drop-then-create for policies).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  -- IANA zone the household's wall-clock item times (startTime, recurrence) are
  -- interpreted in. There's no per-item zone field — every item.startTime is a
  -- bare "7:00 AM" label — so this is the one place the reminder sender looks up
  -- to turn that into an actual instant.
  timezone text not null default 'America/Denver'
);

alter table households add column if not exists timezone text not null default 'America/Denver';

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  color text not null default '#2f6f64'
);

create table if not exists dogs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  breed text not null default '',
  birthday date,
  sex text not null default '',
  color text not null default '#6d7d8b',
  weight numeric not null default 0,
  expected_adult_weight numeric not null default 0,
  weight_history jsonb not null default '[]',
  microchip text not null default '',
  photo text not null default '',
  veterinarian text not null default '',
  insurance text not null default '',
  breeder text not null default '',
  health_summary text not null default '',
  medical_history text[] not null default '{}',
  allergies text[] not null default '{}',
  medication_entries jsonb not null default '[]',
  energy int not null default 50,
  confidence int not null default 50,
  fearfulness int not null default 20,
  resource_guarding int not null default 20,
  dog_friendliness int not null default 50,
  human_friendliness int not null default 50,
  noise_sensitivity int not null default 30,
  favorite_rewards text[] not null default '{}',
  favorite_toys text[] not null default '{}',
  mastered_commands text[] not null default '{}',
  exercise_need text not null default '',
  status text not null default 'puppy'
);

-- `create table if not exists` above is a no-op once dogs already exists in
-- production, so this column swap is applied explicitly for anyone re-running
-- this file against a database synced before medications became structured
-- entries (name/kind/dosage/frequency/notes) instead of a flat text list.
alter table dogs add column if not exists medication_entries jsonb not null default '[]';
alter table dogs drop column if exists medications;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  category text not null,
  assigned_to uuid references people (id) on delete set null,
  time text not null default '',
  duration int not null default 0,
  priority text not null default 'important',
  supplies text[] not null default '{}',
  setting text not null default 'indoor',
  difficulty int not null default 1,
  dog_ids uuid[] not null default '{}',
  checklist text[] not null default '{}',
  griz_participation text not null default 'not yet',
  notes text not null default '',
  location text,
  formation text,
  related_milestone_id text,
  checklist_schema jsonb not null default '[]'
);

-- `create table if not exists` above is a no-op once tasks already exists in
-- production, so these columns are added explicitly for anyone re-running this
-- file against a database synced before they were introduced.
alter table tasks add column if not exists location text;
alter table tasks add column if not exists formation text;
alter table tasks add column if not exists related_milestone_id text;
alter table tasks add column if not exists checklist_schema jsonb not null default '[]';

-- Prevents the bug where re-running seed.sql silently duplicated every task
-- (no id/constraint stopped it from inserting a fresh copy each time).
-- If you're seeing duplicate tasks, run supabase/dedupe-tasks-2026-07-16.sql
-- BEFORE this file, or this constraint will fail to add.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_household_title_key') then
    alter table tasks add constraint tasks_household_title_key unique (household_id, title);
  end if;
end $$;

-- Dated instances of a task template (Section 3 of the calendar/task-workflow
-- spec) — this is what actually carries the start/stop/reschedule/skip/delegate
-- lifecycle and its audit trail, since a template alone has no notion of "today".
-- Uses a client-generated text id (matching makeId()) rather than a DB-generated
-- uuid, same pattern as milestones/exposure_items.
create table if not exists task_instances (
  id text primary key,
  household_id uuid not null references households (id) on delete cascade,
  template_id uuid not null references tasks (id) on delete cascade,
  original_date date not null,
  date date not null,
  state text not null default 'not_started',
  assigned_to uuid references people (id) on delete set null,
  original_assigned_to uuid references people (id) on delete set null,
  scheduled_time text not null default '',
  start_time timestamptz,
  start_time_zone text,
  end_time timestamptz,
  end_time_zone text,
  rating int,
  checklist jsonb not null default '[]',
  history jsonb not null default '[]'
);

-- Delegation requests (Section 3.3) — accept/decline inbox tied to a task instance.
create table if not exists inbox_requests (
  id text primary key,
  household_id uuid not null references households (id) on delete cascade,
  task_instance_id text not null references task_instances (id) on delete cascade,
  from_person_id uuid references people (id) on delete set null,
  to_person_id uuid references people (id) on delete set null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- Meal planning, inventory, and grocery list (spec Section 4).
create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  description text not null default '',
  source text not null default 'manual_entry',
  prep_minutes int not null default 0,
  cook_minutes int not null default 0,
  planned_date date
);

create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  meal_id uuid not null references meals (id) on delete cascade,
  ingredient_name text not null,
  quantity numeric not null default 0,
  unit text not null default ''
);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  item_name text not null,
  category text not null default 'other',
  location text not null default 'pantry',
  quantity numeric not null default 0,
  unit text not null default '',
  purchase_date date not null default current_date,
  estimated_expiration_date date not null default current_date
);

create table if not exists grocery_list (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  item_name text not null,
  quantity_needed numeric not null default 0,
  unit text not null default '',
  linked_meal_ids uuid[] not null default '{}',
  status text not null default 'needed'
);

-- milestones keep human-readable slug ids ("sit", "marker-word", ...) since the
-- dependency graph references them directly and that's much more legible than uuids.
create table if not exists milestones (
  id text primary key,
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  track text not null,
  status text not null default 'locked',
  dependencies text[] not null default '{}',
  age_gate_weeks int,
  dog_ids uuid[] not null default '{}',
  steps jsonb not null default '[]',
  sources jsonb not null default '[]',
  why text not null default ''
);

create table if not exists health_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  dog_id uuid references dogs (id) on delete cascade,
  title text not null,
  date date not null,
  kind text not null,
  notes text not null default '',
  document_url text
);

alter table health_events add column if not exists document_url text;

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  dog_ids uuid[] not null default '{}',
  date date not null,
  title text not null,
  text text not null default '',
  tags text[] not null default '{}',
  mood text not null default 'steady'
);

create table if not exists exposure_items (
  id text primary key,
  household_id uuid not null references households (id) on delete cascade,
  category text not null,
  title text not null,
  dog_ids uuid[] not null default '{}',
  status text not null default 'not-started',
  log jsonb not null default '[]'
);

create table if not exists relationship_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  dog_ids uuid[] not null default '{}',
  date date not null,
  comfort int not null default 0,
  shared_toys int not null default 0,
  shared_beds int not null default 0,
  shared_walks int not null default 0,
  body_language int not null default 0,
  resource_guarding int not null default 0,
  play_quality int not null default 0,
  corrections int not null default 0,
  recovery_minutes int not null default 0,
  notes text not null default ''
);

-- One row per task, upserted on (household_id, task_id) — mirrors the "latest
-- completion state" behavior of the local-only version rather than a full
-- per-day history. See BACKLOG.md for the "daily task history" follow-up.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  task_id uuid not null references tasks (id) on delete cascade,
  completed boolean not null default true,
  rating int not null,
  mood text not null default 'calm',
  success_score int not null default 0,
  notes text not null default '',
  accident boolean not null default false,
  barking boolean not null default false,
  fear boolean not null default false,
  guarding boolean not null default false,
  completed_at timestamptz not null default now(),
  unique (household_id, task_id)
);

-- Recurring commitments (gym, volleyball, curling), one-off life events
-- (concerts, tailgates, family visits), and the football schedule all live
-- here as a single flexible calendar entry shape — see
-- docs/knowledge/puppy-life-knowledge.md sections 3-6 for the source data.
-- `recurrence` (jsonb, only set when kind = 'recurring') holds
-- {frequency, interval, daysOfWeek?, monthDay?, startDate, endDate?, occurrenceCount?} —
-- see the Recurrence type in src/types.ts. `excluded_dates` holds YYYY-MM-DD
-- dates skipped when a single occurrence of a recurring series is deleted
-- without deleting the whole series.
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  category text not null,
  kind text not null,
  recurrence jsonb,
  excluded_dates date[] not null default '{}',
  date date,
  window_label text not null default '',
  start_time text,
  end_time text,
  duration_hours numeric,
  alone_time_required text not null default 'no',
  alone_time_required_amount numeric,
  status text not null default 'confirmed',
  importance text,
  notes text not null default '',
  attendees uuid[] not null default '{}',
  dog_ids uuid[] not null default '{}',
  rover_visits int,
  prep_steps text[] not null default '{}',
  rover_instructions text[] not null default '{}',
  post_steps text[] not null default '{}',
  coverage_confirmed boolean not null default false,
  coverage_notes text not null default ''
);

-- `create table if not exists` above is a no-op once the table already exists in
-- production, so these columns are added explicitly for anyone re-running this file
-- against a database that already had calendar_events from an earlier sync. Anyone
-- with pre-2026-07-23 data (day_of_week/active_from/active_to/time_label/coverage_needed
-- columns) should run supabase/migrate-calendar-events-2026-07-23.sql instead, which
-- backfills these new columns from the old ones before they'd otherwise be dropped.
alter table calendar_events add column if not exists attendees uuid[] not null default '{}';
alter table calendar_events add column if not exists dog_ids uuid[] not null default '{}';
alter table calendar_events add column if not exists rover_visits int;
alter table calendar_events add column if not exists prep_steps text[] not null default '{}';
alter table calendar_events add column if not exists rover_instructions text[] not null default '{}';
alter table calendar_events add column if not exists post_steps text[] not null default '{}';
alter table calendar_events add column if not exists recurrence jsonb;
alter table calendar_events add column if not exists excluded_dates date[] not null default '{}';
alter table calendar_events add column if not exists start_time text;
alter table calendar_events add column if not exists end_time text;
alter table calendar_events add column if not exists alone_time_required text not null default 'no';
alter table calendar_events add column if not exists alone_time_required_amount numeric;
alter table calendar_events add column if not exists coverage_confirmed boolean not null default false;
alter table calendar_events add column if not exists coverage_notes text not null default '';

-- Audit trail for deleted calendar events/occurrences — a note is required at
-- delete time (enforced in the app, not here) and kept even after the event
-- itself is gone, which is why event_title is snapshotted rather than joined.
create table if not exists calendar_event_deletions (
  id text primary key,
  household_id uuid not null references households (id) on delete cascade,
  event_id text not null,
  event_title text not null,
  scope text not null,
  occurrence_date date,
  note text not null,
  deleted_at timestamptz not null default now()
);

-- Audit trail for deleted tasks/occurrences, mirroring calendar_event_deletions.
-- scope "instance" means just that day was skipped (see task_instances.history
-- for the matching skip entry); scope "series" means the task template itself
-- was removed from the daily routine, which is why task_title is snapshotted.
create table if not exists task_deletions (
  id text primary key,
  household_id uuid not null references households (id) on delete cascade,
  task_id text not null,
  task_title text not null,
  scope text not null,
  occurrence_date date,
  note text not null,
  deleted_at timestamptz not null default now()
);

-- Logged instances of the puppy being left alone comfortably, compared
-- against calendar_events that need coverage to flag readiness gaps early.
create table if not exists alone_time_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  date date not null,
  duration_minutes int not null,
  dog_ids uuid[] not null default '{}',
  notes text not null default ''
);

alter table alone_time_logs add column if not exists dog_ids uuid[] not null default '{}';

-- In-app feedback submitted via the sidebar wizard — bugs, feature ideas,
-- comments, questions. Pulled into markdown via scripts/export-feedback.ts
-- for review in Claude Code sessions rather than read directly from here.
create table if not exists product_feedback (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  page text not null default '',
  feedback_type text not null default 'comment',
  author_email text not null default '',
  location_note text not null default '',
  message text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Unified items (2026-07-25)
--
-- Replaces the old tasks / calendar_events / health_events split. Those three
-- tables held the same kind of thing with different capabilities bolted on:
-- calendar_events had recurrence but no way to complete anything, tasks had the
-- completion lifecycle but no recurrence at all, health_events had neither. An
-- item now carries both, gated by two booleans (requires_completion / requires_log)
-- so the UI can ask only for what a given item actually needs.
--
-- The old tables are intentionally NOT dropped here — run
-- supabase/migrate-items-2026-07-25.sql to copy their rows across, verify the
-- result, and only then drop them by hand.
-- ---------------------------------------------------------------------------

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  category text not null,
  intent text not null default 'event',
  kind text not null default 'one-off',
  recurrence jsonb,
  excluded_dates date[] not null default '{}',
  date date,
  window_label text not null default '',
  start_time text,
  end_time text,
  duration_hours numeric,
  status text not null default 'confirmed',
  -- Each entry is { id, amount, unit: "minutes"|"hours"|"days" }, one row per
  -- configured email reminder. Empty (the default) = no reminders.
  reminders jsonb not null default '[]',
  assigned_to uuid references people (id) on delete set null,
  attendees uuid[] not null default '{}',
  dog_ids uuid[] not null default '{}',
  requires_completion boolean not null default false,
  checklist jsonb not null default '[]',
  checklist_source_milestone_id text,
  requires_log boolean not null default false,
  log_fields jsonb not null default '[]',
  alone_time_required text not null default 'no',
  alone_time_required_amount numeric,
  coverage_confirmed boolean not null default false,
  coverage_notes text not null default '',
  priority text not null default 'important',
  supplies text[] not null default '{}',
  setting text not null default 'either',
  difficulty int not null default 1,
  location text,
  formation text,
  related_milestone_id text,
  document_url text,
  rover_visits int,
  prep_steps text[] not null default '{}',
  rover_instructions text[] not null default '{}',
  post_steps text[] not null default '{}',
  notes text not null default ''
);

-- Same duplicate-insert guard the old tasks table needed: without it, re-running
-- seed.sql silently inserts a second copy of every item.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_household_title_key') then
    alter table items add constraint items_household_title_key unique (household_id, title);
  end if;
end $$;

alter table items add column if not exists reminders jsonb not null default '[]';
-- 'calendar' (the default) or 'checklist-only'. Checklist-only items still recur, still
-- need completing, and still show on the Dashboard — they're just kept out of the
-- day/week/month grids, where an every-two-hours potty routine buries everything the
-- calendar is actually being consulted for. Whether to honour it is a per-viewer
-- preference in the Calendar; this column only says which items it applies to.
alter table items add column if not exists calendar_visibility text not null default 'calendar';

-- Per-date state for an item. A recurring item needs independent completion state
-- per occurrence — finishing Monday's must not finish Tuesday's — which is exactly
-- what the old task_instances table did, generalized to every item.
create table if not exists item_occurrences (
  id text primary key,
  household_id uuid not null references households (id) on delete cascade,
  item_id uuid not null references items (id) on delete cascade,
  original_date date not null,
  date date not null,
  state text not null default 'not_started',
  assigned_to uuid references people (id) on delete set null,
  original_assigned_to uuid references people (id) on delete set null,
  scheduled_time text not null default '',
  start_time timestamptz,
  start_time_zone text,
  end_time timestamptz,
  end_time_zone text,
  rating int,
  rating_notes text,
  checklist jsonb not null default '[]',
  -- Guard against double-counting milestone progress: re-saving a completion or
  -- reopening and finishing again would otherwise advance it every time.
  milestone_advanced boolean not null default false,
  history jsonb not null default '[]'
);

alter table item_occurrences add column if not exists milestone_advanced boolean not null default false;
-- Which `item_logs` rows claim this occurrence. Stored rather than re-derived, so
-- deleting a log releases exactly the occurrence it satisfied — the same reason
-- `milestone_advanced` is stored, and the opposite of the (date, duration, dogs)
-- guesswork that alone-time rows are matched by.
alter table item_occurrences add column if not exists satisfied_by_log_ids text[] not null default '{}';

-- Timestamped log entries. Usually against an item — multiple per item (and per
-- occurrence) is the point: weight over time, symptoms across days. `processed_at`
-- is stamped by the review-logs skill so its next run only reads what is new.
--
-- `item_id` is nullable because a Quick log (Dashboard → Quick log, added 2026-07-26)
-- has no item behind it: an unplanned potty break just happens. Those rows carry
-- `quick_log_kind` instead, which makes them self-describing so the ingest pass never
-- has to join to `items` to know what it's reading.
--
-- Both can be set at once (2026-07-27): a Quick log that satisfied a scheduled slot is
-- one row that is simultaneously "a potty break, poo, outside, firm" and "this is the
-- 7:15 Morning potty happening". At least one of the two is always set — see the check
-- constraint below.
create table if not exists item_logs (
  id text primary key,
  household_id uuid not null references households (id) on delete cascade,
  item_id uuid references items (id) on delete cascade,
  occurrence_date date,
  logged_at timestamptz not null default now(),
  logged_by uuid references people (id) on delete set null,
  text text not null default '',
  values jsonb not null default '[]',
  dog_ids uuid[] not null default '{}',
  processed_at timestamptz
);

-- Additive for databases created before 2026-07-26. Dropping the not-null on item_id
-- has to run separately from `create table if not exists`, which is a no-op there.
alter table item_logs alter column item_id drop not null;
alter table item_logs add column if not exists quick_log_kind text;
alter table item_logs add column if not exists rating int;
alter table item_logs add column if not exists milestone_id text references milestones (id) on delete set null;
-- Which milestone steps the entry advanced. Deleting the log rolls exactly these back.
alter table item_logs add column if not exists advanced_step_titles text[] not null default '{}';
-- When the thing actually happened, as opposed to when the row was written. A 7:18
-- potty break entered at 9pm is a 7:18 event; `logged_at` says 9pm and would sort it,
-- match it, and chart it wrong. Backfilled from logged_at so old rows stay orderable.
alter table item_logs add column if not exists happened_at timestamptz;
update item_logs set happened_at = logged_at where happened_at is null;

-- Dropped and recreated rather than added-if-missing: this constraint changed meaning
-- on 2026-07-27 (was XOR, now "at least one"), so a database that already has the old
-- version needs the new one, not a skip. Widening only — every existing row passes.
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

create index if not exists item_logs_unprocessed_idx on item_logs (processed_at) where processed_at is null;
create index if not exists item_logs_quick_idx on item_logs (quick_log_kind, occurrence_date) where quick_log_kind is not null;

-- Detaches a Quick log from its item before the item's `on delete cascade` fires,
-- so deleting a routine can't silently take an observation about a dog down with it.
-- A row with quick_log_kind set is a potty/food/water/etc. entry that happened to
-- satisfy a scheduled slot — not a record that only makes sense in the context of the
-- item, the way a vet visit's weight reading does. A plain item log (quick_log_kind
-- null) has no such life outside the item, so it's left alone and cascades normally.
--
-- store.tsx's deleteItem already does this same detach from the app before calling
-- items.remove — this trigger exists so a delete issued directly against the database
-- (the Supabase table editor, a manual `delete from items`) can't bypass it.
create or replace function detach_quick_logs_before_item_delete() returns trigger as $$
begin
  update item_logs
  set item_id = null
  where item_id = old.id and quick_log_kind is not null;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_detach_quick_logs_before_item_delete on items;
create trigger trg_detach_quick_logs_before_item_delete
  before delete on items
  for each row
  execute function detach_quick_logs_before_item_delete();

-- Idempotency guard for the send-reminders edge function (supabase/functions/
-- send-reminders): one row per reminder actually emailed, so a cron run that
-- overlaps the previous one (or reruns after a failure) never double-sends. Not
-- exposed to the client at all — only the edge function's service-role key
-- touches this table.
create table if not exists sent_item_reminders (
  item_id uuid not null references items (id) on delete cascade,
  occurrence_date date not null,
  reminder_id text not null,
  sent_at timestamptz not null default now(),
  primary key (item_id, occurrence_date, reminder_id)
);

-- Merges the old calendar_event_deletions and task_deletions audit tables, which
-- differed only in column naming.
create table if not exists item_deletions (
  id text primary key,
  household_id uuid not null references households (id) on delete cascade,
  -- text, not uuid, and deliberately no foreign key: this is an audit trail of a
  -- row that no longer exists, so the id is a dead reference kept for the record.
  -- Matches how calendar_event_deletions.event_id and task_deletions.task_id were
  -- both typed, and how ItemDeletion.itemId is a plain string in types.ts.
  item_id text not null,
  item_title text not null,
  scope text not null,
  occurrence_date date,
  note text not null,
  deleted_at timestamptz not null default now()
);

-- `create table if not exists` above is a no-op for anyone who ran an earlier
-- version of this file, where item_id was mistyped as uuid — which made the
-- migration fail on the deletion-audit copy, since both source columns are text.
-- The table is an audit log that starts empty, so this widening is free.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'item_deletions' and column_name = 'item_id' and data_type = 'uuid'
  ) then
    alter table item_deletions alter column item_id type text using item_id::text;
  end if;
end $$;

-- inbox_requests now points at item_occurrences instead of task_instances.
alter table inbox_requests add column if not exists item_occurrence_id text;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- v1 policy: any authenticated user can read/write everything. This app has
-- exactly one household with two known logins (Andrew, Bree), so per-household
-- scoping isn't worth the complexity yet — the goal right now is just "signed
-- out visitors see nothing," which this achieves. If more households/users are
-- ever added, tighten these to check people.auth_user_id = auth.uid() joined
-- through household_id instead of a blanket authenticated check.
-- ---------------------------------------------------------------------------

alter table households enable row level security;
alter table people enable row level security;
alter table dogs enable row level security;
alter table tasks enable row level security;
alter table milestones enable row level security;
alter table health_events enable row level security;
alter table journal_entries enable row level security;
alter table exposure_items enable row level security;
alter table relationship_logs enable row level security;
alter table feedback enable row level security;
alter table product_feedback enable row level security;
alter table calendar_events enable row level security;
alter table calendar_event_deletions enable row level security;
alter table task_deletions enable row level security;
alter table alone_time_logs enable row level security;
alter table task_instances enable row level security;
alter table inbox_requests enable row level security;
alter table meals enable row level security;
alter table recipe_ingredients enable row level security;
alter table inventory enable row level security;
alter table grocery_list enable row level security;
alter table items enable row level security;
alter table item_occurrences enable row level security;
alter table item_logs enable row level security;
alter table item_deletions enable row level security;
alter table sent_item_reminders enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'households', 'people', 'dogs', 'tasks', 'milestones',
    'health_events', 'journal_entries', 'exposure_items',
    'relationship_logs', 'feedback', 'product_feedback',
    'calendar_events', 'calendar_event_deletions', 'task_deletions', 'alone_time_logs', 'task_instances', 'inbox_requests',
    'meals', 'recipe_ingredients', 'inventory', 'grocery_list',
    'items', 'item_occurrences', 'item_logs', 'item_deletions', 'sent_item_reminders'
  ])
  loop
    if not exists (
      select 1 from pg_policies where tablename = t and policyname = 'authenticated read/write'
    ) then
      execute format(
        'create policy "authenticated read/write" on %I for all to authenticated using (true) with check (true);',
        t
      );
    end if;
  end loop;
end $$;



-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'households', 'people', 'dogs', 'tasks', 'milestones',
    'health_events', 'journal_entries', 'exposure_items',
    'relationship_logs', 'feedback', 'product_feedback',
    'calendar_events', 'calendar_event_deletions', 'task_deletions', 'alone_time_logs', 'task_instances', 'inbox_requests',
    'meals', 'recipe_ingredients', 'inventory', 'grocery_list',
    'items', 'item_occurrences', 'item_logs', 'item_deletions'
  ])
  loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I;', t);
    end if;
  end loop;
end $$;
