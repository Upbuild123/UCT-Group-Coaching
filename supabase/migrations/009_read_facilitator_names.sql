create policy "read facilitator names" on public.users
  for select to authenticated
  using (role = 'facilitator');
