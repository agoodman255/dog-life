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
  created_at timestamptz not null default now()
);

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
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  category text not null,
  kind text not null,
  day_of_week text,
  active_from date,
  active_to date,
  date date,
  window_label text not null default '',
  time_label text not null default '',
  duration_hours numeric,
  coverage_needed text not null default 'none',
  status text not null default 'confirmed',
  importance text,
  notes text not null default '',
  attendees uuid[] not null default '{}',
  rover_visits int,
  prep_steps text[] not null default '{}',
  rover_instructions text[] not null default '{}',
  post_steps text[] not null default '{}'
);

-- `create table if not exists` above is a no-op once the table already exists in
-- production, so these columns are added explicitly for anyone re-running this file
-- against a database that already had calendar_events from an earlier sync.
alter table calendar_events add column if not exists attendees uuid[] not null default '{}';
alter table calendar_events add column if not exists rover_visits int;
alter table calendar_events add column if not exists prep_steps text[] not null default '{}';
alter table calendar_events add column if not exists rover_instructions text[] not null default '{}';
alter table calendar_events add column if not exists post_steps text[] not null default '{}';

-- Logged instances of the puppy being left alone comfortably, compared
-- against calendar_events that need coverage to flag readiness gaps early.
create table if not exists alone_time_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  date date not null,
  duration_minutes int not null,
  notes text not null default ''
);

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
alter table alone_time_logs enable row level security;
alter table task_instances enable row level security;
alter table inbox_requests enable row level security;
alter table meals enable row level security;
alter table recipe_ingredients enable row level security;
alter table inventory enable row level security;
alter table grocery_list enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'households', 'people', 'dogs', 'tasks', 'milestones',
    'health_events', 'journal_entries', 'exposure_items',
    'relationship_logs', 'feedback', 'product_feedback',
    'calendar_events', 'alone_time_logs', 'task_instances', 'inbox_requests',
    'meals', 'recipe_ingredients', 'inventory', 'grocery_list'
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
    'calendar_events', 'alone_time_logs', 'task_instances', 'inbox_requests',
    'meals', 'recipe_ingredients', 'inventory', 'grocery_list'
  ])
  loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I;', t);
    end if;
  end loop;
end $$;
