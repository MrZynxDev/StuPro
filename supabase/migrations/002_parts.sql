-- Découper un devoir / un examen en plusieurs parties réparties sur plusieurs jours.
alter table public.items
  add column if not exists parent_id uuid references public.items(id) on delete cascade,
  add column if not exists part smallint,
  add column if not exists parts smallint;
create index if not exists items_parent on public.items(parent_id);
