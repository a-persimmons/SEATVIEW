-- SeatView public data and server-only builder configuration.
-- Apply with the Supabase SQL editor or `supabase db push`.

create table if not exists public.venues (
  id text primary key,
  name text not null,
  city text not null,
  aliases jsonb not null default '[]'::jsonb,
  public_facts jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  model jsonb not null,
  stand_tiers jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.simulations (
  id text primary key,
  venue_id text not null references public.venues(id) on delete restrict,
  slug text not null unique,
  title text not null,
  artist text not null,
  city text not null,
  venue_name text not null,
  event_date date not null,
  event_time text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  version integer not null default 1 check (version > 0),
  data jsonb not null,
  poster_key text,
  reference_image_key text,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_configs (
  id text primary key,
  base_url text not null,
  api_key text not null,
  model_name text not null,
  vision_model_name text,
  search_provider text not null default 'none' check (search_provider in ('none', 'tavily')),
  search_base_url text,
  search_api_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists simulations_published_date_idx
  on public.simulations (status, event_date, event_time);
create index if not exists simulations_published_city_idx
  on public.simulations (status, city);
create index if not exists simulations_venue_idx
  on public.simulations (venue_id);

-- All browser access goes through the Hono/tRPC backend. The server uses the
-- Supabase secret key, which bypasses RLS. Browser anon/authenticated roles get
-- no direct table policies, especially not for model_configs.
alter table public.venues enable row level security;
alter table public.simulations enable row level security;
alter table public.model_configs enable row level security;
revoke all on table public.venues from anon, authenticated;
revoke all on table public.simulations from anon, authenticated;
revoke all on table public.model_configs from anon, authenticated;

-- Original seat-map images stay private. The backend stores only object keys
-- and creates short-lived signed URLs when a published simulation is opened.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seatview-assets',
  'seatview-assets',
  false,
  12582912,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
