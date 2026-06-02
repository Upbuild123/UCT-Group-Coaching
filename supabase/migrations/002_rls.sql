-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.rounds enable row level security;
alter table public.group_sessions enable row level security;
alter table public.signups enable row level security;
alter table public.full_group_requests enable row level security;
alter table public.audit_log enable row level security;

-- Helper: get current user role
create or replace function public.current_user_role()
returns user_role language sql security definer stable
set search_path = public, auth
as $$
  select role from public.users where id = auth.uid()
$$;

-- users: admin can do everything; others read their own row
create policy "admin full access" on public.users
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "self read" on public.users
  for select to authenticated
  using (id = auth.uid());

-- rounds: admin full access; others read-only
create policy "admin full access" on public.rounds
  for all to authenticated
  using (public.current_user_role() = 'admin');

create policy "authenticated read" on public.rounds
  for select to authenticated
  using (true);

-- group_sessions: admin full access; facilitators read their own; students read published
create policy "admin full access" on public.group_sessions
  for all to authenticated
  using (public.current_user_role() = 'admin');

create policy "facilitator read own" on public.group_sessions
  for select to authenticated
  using (
    public.current_user_role() = 'facilitator'
    and facilitator_id = auth.uid()
  );

create policy "student read published" on public.group_sessions
  for select to authenticated
  using (
    public.current_user_role() = 'student'
    and status in ('published', 'full')
  );

-- signups: admin full access; students manage their own; facilitators read signups for their groups
create policy "admin full access" on public.signups
  for all to authenticated
  using (public.current_user_role() = 'admin');

create policy "student manage own" on public.signups
  for all to authenticated
  using (
    public.current_user_role() = 'student'
    and student_id = auth.uid()
  )
  with check (
    public.current_user_role() = 'student'
    and student_id = auth.uid()
    and signup_type in ('primary', 'additional')
  );

create policy "facilitator read group signups" on public.signups
  for select to authenticated
  using (
    public.current_user_role() = 'facilitator'
    and group_session_id in (
      select id from public.group_sessions where facilitator_id = auth.uid()
    )
  );

-- full_group_requests: admin full access; students read/create their own; facilitators read requests involving their groups
create policy "admin full access" on public.full_group_requests
  for all to authenticated
  using (public.current_user_role() = 'admin');

create policy "student manage own" on public.full_group_requests
  for all to authenticated
  using (
    public.current_user_role() = 'student'
    and student_id = auth.uid()
  )
  with check (
    public.current_user_role() = 'student'
    and student_id = auth.uid()
  );

create policy "facilitator read involved" on public.full_group_requests
  for select to authenticated
  using (
    public.current_user_role() = 'facilitator'
    and (
      current_group_session_id in (
        select id from public.group_sessions where facilitator_id = auth.uid()
      )
      or requested_group_session_id in (
        select id from public.group_sessions where facilitator_id = auth.uid()
      )
    )
  );

-- audit_log: admin read-only; authenticated users can insert their own entries
create policy "admin read" on public.audit_log
  for select to authenticated
  using (public.current_user_role() = 'admin');

create policy "authenticated insert own" on public.audit_log
  for insert to authenticated
  with check (actor_user_id = auth.uid());
