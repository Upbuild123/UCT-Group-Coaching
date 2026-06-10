alter type signup_status_type add value if not exists 'no_show';
alter table public.group_sessions add column if not exists no_show_email_sent_at timestamptz;
