-- ════════════════════════════════════════════════════════════
-- CIRCLES APP — FULL DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor → New Query → Run
-- ════════════════════════════════════════════════════════════

-- ── PROFILES ──────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'anonymous',
  location text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ── CIRCLES ───────────────────────────────────────────────
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id),
  starts_at timestamptz not null,
  duration_minutes int not null default 10,
  status text not null default 'settling'
    check (status in ('settling', 'meditating', 'conversation', 'closed')),
  participant_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.circles enable row level security;

create policy "Circles are viewable by everyone"
  on public.circles for select
  using (true);

create policy "Authenticated users can create circles"
  on public.circles for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update circles"
  on public.circles for update
  using (auth.uid() is not null);

-- ── CIRCLE PARTICIPANTS ───────────────────────────────────
create table if not exists public.circle_participants (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'anonymous',
  location text,
  mood text,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (circle_id, user_id)
);

alter table public.circle_participants enable row level security;

create policy "Circle participants are viewable by everyone"
  on public.circle_participants for select
  using (true);

create policy "Authenticated users can join circles"
  on public.circle_participants for insert
  with check (auth.uid() is not null);

create policy "Users can update own participation"
  on public.circle_participants for update
  using (auth.uid() = user_id);

-- Index for fast participant count queries
create index if not exists idx_circle_participants_active
  on public.circle_participants(circle_id)
  where left_at is null;

-- ── CAMPFIRE ──────────────────────────────────────────────
create table if not exists public.campfire (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  participant_count int not null default 0
);

alter table public.campfire enable row level security;

create policy "Campfire is viewable by everyone"
  on public.campfire for select
  using (true);

create policy "Authenticated users can create campfire"
  on public.campfire for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update campfire"
  on public.campfire for update
  using (auth.uid() is not null);

-- ── CAMPFIRE PARTICIPANTS ─────────────────────────────────
create table if not exists public.campfire_participants (
  id uuid primary key default gen_random_uuid(),
  campfire_id uuid not null references public.campfire(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (campfire_id, user_id)
);

alter table public.campfire_participants enable row level security;

create policy "Campfire participants are viewable by everyone"
  on public.campfire_participants for select
  using (true);

create policy "Authenticated users can join campfire"
  on public.campfire_participants for insert
  with check (auth.uid() is not null);

create policy "Users can update own campfire participation"
  on public.campfire_participants for update
  using (auth.uid() = user_id);

-- ── FUNCTIONS ─────────────────────────────────────────────

-- Safely increment participant_count on a circle
create or replace function public.increment_participant_count(cid uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.circles
  set participant_count = participant_count + 1
  where id = cid;
end;
$$;

-- ── REALTIME ──────────────────────────────────────────────
-- Enable realtime for the tables the app subscribes to
alter publication supabase_realtime add table public.circles;
alter publication supabase_realtime add table public.circle_participants;
alter publication supabase_realtime add table public.campfire_participants;

-- ════════════════════════════════════════════════════════════
-- DONE. You should see "Success" at the bottom of the SQL editor.
-- ════════════════════════════════════════════════════════════
