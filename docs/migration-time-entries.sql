-- =============================================================================
-- Migration: time_entries + time_breaks für Arbeitszeiterfassung
-- Im Supabase SQL Editor ausführen (Mandanten-Supabase, nicht Lizenzportal).
-- Voraussetzung: profiles, orders existieren.
-- Idempotent.
-- =============================================================================

create table if not exists public.time_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  start timestamptz not null,
  "end" timestamptz,
  notes text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.time_entries enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'time_entries' loop
    execute format('drop policy if exists %I on public.time_entries', r.policyname);
  end loop;
end $$;

create policy "User can read own time_entries" on public.time_entries for select using (auth.uid() = user_id);
create policy "Admin can read all time_entries" on public.time_entries for select using (public.is_admin());
create policy "User can insert own time_entries" on public.time_entries for insert with check (auth.uid() = user_id);
create policy "Admin can update time_entries" on public.time_entries for update using (public.is_admin());

create table if not exists public.time_breaks (
  id uuid default gen_random_uuid() primary key,
  time_entry_id uuid references public.time_entries(id) on delete cascade not null,
  start timestamptz not null,
  "end" timestamptz,
  created_at timestamptz default now()
);

alter table public.time_breaks enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'time_breaks' loop
    execute format('drop policy if exists %I on public.time_breaks', r.policyname);
  end loop;
end $$;

create policy "User can read own time_breaks" on public.time_breaks for select using (
  exists (select 1 from public.time_entries te where te.id = time_entry_id and te.user_id = auth.uid())
);
create policy "Admin can read all time_breaks" on public.time_breaks for select using (public.is_admin());
create policy "User can insert time_breaks" on public.time_breaks for insert with check (
  exists (select 1 from public.time_entries te where te.id = time_entry_id and te.user_id = auth.uid())
);
create policy "User can update own time_breaks" on public.time_breaks for update using (
  exists (select 1 from public.time_entries te where te.id = time_entry_id and te.user_id = auth.uid())
);

create index if not exists idx_time_entries_user_date on public.time_entries(user_id, date desc);
