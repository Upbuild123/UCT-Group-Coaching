-- Enums
create type user_role as enum ('admin', 'facilitator', 'student');
create type signup_status as enum ('closed', 'open', 'extra_signups_open');
create type group_status as enum ('draft', 'published', 'full', 'canceled');
create type signup_status_type as enum ('confirmed', 'canceled', 'moved');
create type signup_type as enum ('primary', 'additional', 'admin_override');
create type request_status as enum ('pending', 'approved', 'rejected', 'canceled');
create type facilitator_decision as enum ('approved', 'rejected');

-- Users (extends Supabase auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'student',
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

-- Rounds
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  round_number int not null check (round_number between 1 and 4),
  title text not null,
  signup_status signup_status not null default 'closed',
  created_at timestamptz not null default now(),
  unique (round_number)
);

-- Group Sessions
create table public.group_sessions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  facilitator_id uuid not null references public.users(id),
  title text not null,
  notes text,
  start_time_utc timestamptz not null,
  end_time_utc timestamptz not null,
  original_timezone text not null,
  capacity int not null default 5,
  status group_status not null default 'draft',
  calendar_event_id text,
  created_at timestamptz not null default now()
);

-- Signups
create table public.signups (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  group_session_id uuid not null references public.group_sessions(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  status signup_status_type not null default 'confirmed',
  signup_type signup_type not null default 'primary',
  created_at timestamptz not null default now()
);

-- Full Group Requests
create table public.full_group_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  current_group_session_id uuid not null references public.group_sessions(id),
  requested_group_session_id uuid not null references public.group_sessions(id),
  reason text,
  status request_status not null default 'pending',
  decided_by_user_id uuid references public.users(id),
  decided_at timestamptz,
  new_facilitator_decision facilitator_decision,
  old_facilitator_decision facilitator_decision,
  created_at timestamptz not null default now()
);

-- Audit Log
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
