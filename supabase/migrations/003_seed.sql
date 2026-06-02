-- Seed the 4 rounds
insert into public.rounds (round_number, title, signup_status) values
  (1, 'Round 1', 'closed'),
  (2, 'Round 2', 'closed'),
  (3, 'Round 3', 'closed'),
  (4, 'Round 4', 'closed');

-- Note: Admin user (michael@upbuild.com) must be created via Supabase Auth dashboard
-- or CLI after migrations run, then inserted into public.users with role='admin'.
-- See Task 3 Step 4 for the exact command.
