alter table public.users add column if not exists timezone_confirmed boolean not null default true;
alter table public.users alter column timezone_confirmed set default false;

create policy "self update timezone" on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
