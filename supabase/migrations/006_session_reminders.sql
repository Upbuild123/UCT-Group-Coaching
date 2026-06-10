alter table public.group_sessions add column if not exists reminder_sent_at timestamptz;
