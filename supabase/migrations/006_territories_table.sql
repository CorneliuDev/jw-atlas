-- ============================================================
-- Migration: territories table + RLS + grants
-- Spec reference: §5.6 territories
-- ============================================================

create table public.territories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  geometry geometry(Polygon, 4326) not null,
  date_sort_start integer not null,
  date_sort_end integer,
  description text,
  source_reference text,
  source_url text,
  status content_status not null default 'pending',
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Spatial index for efficient map-viewport and geometry queries later.
create index territories_geometry_idx on public.territories using gist (geometry);

-- Index for the date-range filtering the timeline linkage will rely on
-- (spec §6.4: "only borders valid at the selected date/range are shown").
create index territories_date_range_idx on public.territories (date_sort_start, date_sort_end);

alter table public.territories enable row level security;

create policy "Approved territories are viewable by everyone"
  on public.territories for select
  using (status = 'approved');

create policy "Users can view their own pending/rejected territories"
  on public.territories for select
  using (auth.uid() = created_by);

create policy "Admins can view all territories"
  on public.territories for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid() and users.role = 'admin'
    )
  );

create policy "Active users can create territories"
  on public.territories for insert
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.users
      where users.id = auth.uid() and users.status = 'active'
    )
  );

create policy "Creators and admins can update territories"
  on public.territories for update
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.users
      where users.id = auth.uid() and users.role = 'admin'
    )
  );

-- Reuse the same trigger function from Phase 1 — no new logic, per spec §9.
create trigger enforce_territories_status
  before insert on public.territories
  for each row execute function public.enforce_content_status();

grant select on public.territories to anon, authenticated;
grant insert, update on public.territories to authenticated;