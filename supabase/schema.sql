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
  medications text[] not null default '{}',
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
  notes text not null default ''
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
  notes text not null default ''
);

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

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'households', 'people', 'dogs', 'tasks', 'milestones',
    'health_events', 'journal_entries', 'exposure_items',
    'relationship_logs', 'feedback'
  ])
  loop
    execute format('drop policy if exists "authenticated read/write" on %I;', t);
    execute format(
      'create policy "authenticated read/write" on %I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  households, people, dogs, tasks, milestones, health_events,
  journal_entries, exposure_items, relationship_logs, feedback;
