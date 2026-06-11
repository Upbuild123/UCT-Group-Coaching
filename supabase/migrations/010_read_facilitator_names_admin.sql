drop policy if exists "read facilitator names" on public.users;

create policy "read facilitator names" on public.users
  for select to authenticated
  using (role in ('facilitator', 'admin'));
