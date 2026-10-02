-- Enforce group capacity in the database so simultaneous signups can't overbook a group.
-- Locking the group row serialises concurrent inserts for the same group; each waits for the
-- previous one to commit, then counts again. Admin overrides (manual adds, approved full-group
-- requests) are allowed to exceed capacity and the per-round limit on purpose.
create or replace function public.enforce_group_capacity()
returns trigger
language plpgsql
as $$
declare
  group_capacity int;
  confirmed_count int;
begin
  if new.status <> 'confirmed' or new.signup_type = 'admin_override' then
    return new;
  end if;

  select capacity into group_capacity
  from public.group_sessions
  where id = new.group_session_id
  for update;

  select count(*) into confirmed_count
  from public.signups
  where group_session_id = new.group_session_id
    and status = 'confirmed';

  if confirmed_count >= group_capacity then
    raise exception 'Group is full' using errcode = 'P0001';
  end if;

  -- A student may hold at most 2 sessions per round (MAX_SIGNUPS_PER_ROUND in lib/types.ts).
  -- Lock the student's row so two signups for different groups can't both slip under the cap.
  perform 1 from public.users where id = new.student_id for update;

  select count(*) into confirmed_count
  from public.signups
  where student_id = new.student_id
    and round_id = new.round_id
    and status = 'confirmed';

  if confirmed_count >= 2 then
    raise exception 'Round signup limit reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists signups_enforce_group_capacity on public.signups;
create trigger signups_enforce_group_capacity
  before insert on public.signups
  for each row execute function public.enforce_group_capacity();

-- One primary signup per student per round, even if two requests race (e.g. a double click).
create unique index if not exists signups_one_primary_per_round_ux
  on public.signups (student_id, round_id)
  where status = 'confirmed' and signup_type = 'primary';
