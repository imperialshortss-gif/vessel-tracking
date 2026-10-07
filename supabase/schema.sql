create table if not exists public.voyages (
  id text primary key,
  name text not null,
  origin text not null,
  destination text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  dest_lat double precision not null,
  dest_lng double precision not null,
  departure timestamptz not null,
  speed double precision not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.voyages enable row level security;

drop policy if exists "Public can read voyages" on public.voyages;
create policy "Public can read voyages"
on public.voyages for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated admins can insert voyages" on public.voyages;
create policy "Authenticated admins can insert voyages"
on public.voyages for insert
to authenticated
with check (true);

drop policy if exists "Authenticated admins can update voyages" on public.voyages;
create policy "Authenticated admins can update voyages"
on public.voyages for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admins can delete voyages" on public.voyages;
create policy "Authenticated admins can delete voyages"
on public.voyages for delete
to authenticated
using (true);