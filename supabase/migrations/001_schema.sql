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
  capacity int not null default 5 check (capacity > 0),
  status group_status not null default 'draft',
  calendar_event_id text,
  created_at timestamptz not null default now(),
  check (end_time_utc > start_time_utc)
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

-- Prevent duplicate active signups for same student+group
create unique index signups_student_group_session_ux
  on public.signups (student_id, group_session_id)
  where status = 'confirmed';

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
  created_at timestamptz not null default now(),
  check (current_group_session_id <> requested_group_session_id)
);

-- Prevent duplicate pending requests for same student+session
create unique index fgr_student_round_pending_ux
  on public.full_group_requests (student_id, round_id, requested_group_session_id)
  where status = 'pending';

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

-- Indexes for frequently queried FK columns
create index idx_group_sessions_round_id on public.group_sessions (round_id);
create index idx_group_sessions_facilitator_id on public.group_sessions (facilitator_id);
create index idx_signups_student_id on public.signups (student_id);
create index idx_signups_group_session_id on public.signups (group_session_id);
create index idx_signups_round_id on public.signups (round_id);
create index idx_fgr_student_id on public.full_group_requests (student_id);
create index idx_fgr_round_id on public.full_group_requests (round_id);
create index idx_fgr_current_group on public.full_group_requests (current_group_session_id);
create index idx_fgr_requested_group on public.full_group_requests (requested_group_session_id);
create index idx_audit_log_actor on public.audit_log (actor_user_id);
