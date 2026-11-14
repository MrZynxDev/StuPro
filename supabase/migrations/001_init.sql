-- StuPro : schéma initial. À exécuter dans Supabase → SQL Editor.

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#f2a65a',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null check (type in ('examen', 'devoir', 'etude')),
  title text not null check (char_length(title) between 1 and 120),
  subject text not null default '',
  date date not null,
  time time,
  priority text not null default 'moyenne' check (priority in ('basse', 'moyenne', 'haute')),
  notes text not null default '',
  done boolean not null default false,
  due_at timestamptz not null,               -- date + heure (8h si pas d'heure), calculé côté client dans le fuseau de l'utilisateur
  remind_minutes_before integer,             -- null = pas de rappel
  remind_at timestamptz,                     -- due_at - remind_minutes_before
  notified_at timestamptz,                   -- rempli quand le rappel push est envoyé
  created_at timestamptz not null default now()
);

create index if not exists items_user_date on public.items (user_id, date);
create index if not exists items_pending_reminders on public.items (remind_at) where notified_at is null and done = false;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Sécurité : chacun ne voit que ses propres données
alter table public.subjects enable row level security;
alter table public.items enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "own subjects" on public.subjects;
create policy "own subjects" on public.subjects for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own items" on public.items;
create policy "own items" on public.items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Si l'heure, la date ou le rappel change, le rappel doit pouvoir repartir
create or replace function public.reset_notified() returns trigger language plpgsql as $$
begin
  if new.remind_at is distinct from old.remind_at then
    new.notified_at := null;
  end if;
  return new;
end $$;

drop trigger if exists items_reset_notified on public.items;
create trigger items_reset_notified before update on public.items
  for each row execute function public.reset_notified();

-- Synchronisation en temps réel entre appareils
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'items') then
    alter publication supabase_realtime add table public.items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'subjects') then
    alter publication supabase_realtime add table public.subjects;
  end if;
end $$;
