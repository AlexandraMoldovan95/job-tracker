-- Job Tracker - database schema and Row Level Security (Supabase / Postgres).
-- Run once in Supabase -> SQL Editor (this is the setup the live project was created with).
-- Every row belongs to the user who created it (user_id = auth.uid()), and RLS lets each user
-- select, insert, update and delete only their own rows - enforced by Postgres itself, not just
-- hidden in the UI. Account deletion: see delete_my_account.sql.

-- Table 1: companies
create table public.companii (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  nume text not null,
  website text,
  notite text,
  created_at timestamptz not null default now()
);

-- Table 2: applications, each linked to a company (deleted with it)
create table public.aplicari (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  companie_id uuid not null references public.companii(id) on delete cascade,
  post text not null,
  status text not null default 'aplicat'
    check (status in ('aplicat','interviu','oferta','respins','retras')),
  data_aplicarii date not null default current_date,
  salariu_estimat numeric,
  notite text,
  created_at timestamptz not null default now()
);

-- RLS on both tables: each user sees and changes only their own rows
alter table public.companii enable row level security;
alter table public.aplicari enable row level security;

create policy "companii_select_own" on public.companii
  for select using (auth.uid() = user_id);
create policy "companii_insert_own" on public.companii
  for insert with check (auth.uid() = user_id);
create policy "companii_update_own" on public.companii
  for update using (auth.uid() = user_id);
create policy "companii_delete_own" on public.companii
  for delete using (auth.uid() = user_id);

create policy "aplicari_select_own" on public.aplicari
  for select using (auth.uid() = user_id);
create policy "aplicari_insert_own" on public.aplicari
  for insert with check (auth.uid() = user_id);
create policy "aplicari_update_own" on public.aplicari
  for update using (auth.uid() = user_id);
create policy "aplicari_delete_own" on public.aplicari
  for delete using (auth.uid() = user_id);

-- Table 3: resume versions (independent of companies/applications),
-- split into CV sections, all optional except the version name
create table public.cv_versiuni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  nume_versiune text not null,
  descriere text,
  experienta text,
  educatie text,
  competente text,
  proiecte text,
  voluntariat text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cv_versiuni enable row level security;

create policy "cv_select_own" on public.cv_versiuni
  for select using (auth.uid() = user_id);
create policy "cv_insert_own" on public.cv_versiuni
  for insert with check (auth.uid() = user_id);
create policy "cv_update_own" on public.cv_versiuni
  for update using (auth.uid() = user_id);
create policy "cv_delete_own" on public.cv_versiuni
  for delete using (auth.uid() = user_id);
