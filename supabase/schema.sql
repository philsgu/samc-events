-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- This extends the built-in auth.users with a public profiles table

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  cell_number text not null,
  email text not null,
  specialty text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins can view all profiles (checked via a function to avoid recursion)
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Admins can update all profiles
create policy "Admins can update all profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Admins can delete profiles
create policy "Admins can delete profiles"
  on public.profiles for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Allow inserting own profile on signup
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup trigger (optional convenience)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- profile will be inserted by the app after auth signup
  return new;
end;
$$;

-- ─── Cron Logs ────────────────────────────────────────────────────────────────
-- Run this block in Supabase SQL Editor to enable reminder run status in admin.

create table if not exists public.cron_logs (
  id           bigint generated always as identity primary key,
  job          text not null,           -- e.g. 'send-reminders'
  ran_at       timestamptz not null default now(),
  success      boolean not null,
  total_sent   int not null default 0,
  total_failed int not null default 0,
  summary      text,                    -- human-readable message
  details      jsonb                    -- full results array
);

alter table public.cron_logs enable row level security;

-- Only authenticated admins can read log rows
create policy "Admins can read cron_logs"
  on public.cron_logs for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
