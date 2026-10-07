-- Run this AFTER creating the admin authentication user in Supabase.
-- Replace the values below with your chosen username and the email used
-- internally for the Supabase Auth account.

create table if not exists public.admin_users (
  username text primary key,
  email text unique not null,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Public can look up admin login email" on public.admin_users;
create policy "Public can look up admin login email"
on public.admin_users
for select
to anon, authenticated
using (true);

-- Example:
-- insert into public.admin_users (username, email)
-- values ('admin', 'internal-auth-email@example.com');
