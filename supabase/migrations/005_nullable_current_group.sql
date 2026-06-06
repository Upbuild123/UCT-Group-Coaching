-- supabase/migrations/005_nullable_current_group.sql
alter table public.full_group_requests
  alter column current_group_session_id drop not null;
