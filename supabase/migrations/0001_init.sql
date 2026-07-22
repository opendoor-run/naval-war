-- Naval War schema + RLS.
-- Paste this whole file into the Supabase Dashboard SQL Editor and run it once.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  invite_token text not null unique default encode(gen_random_bytes(6), 'hex'),
  host_id uuid not null references profiles (id),
  target_score int not null default 100,
  max_players int not null default 6,
  status text not null default 'lobby'
    check (status in ('lobby', 'special_phase', 'in_progress', 'round_end', 'finished')),
  current_round int not null default 1,
  dealer_seat int,
  turn_seat int,
  special_phase_seat int,
  draw_pile jsonb not null default '[]'::jsonb,
  discard_pile jsonb not null default '[]'::jsonb,
  harbor_pile jsonb not null default '[]'::jsonb,
  pending_drawn_card text,
  version bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists game_players (
  game_id uuid not null references games (id) on delete cascade,
  user_id uuid not null references profiles (id),
  seat_index int not null,
  display_name text not null,
  total_score int not null default 0,
  is_eliminated_this_round boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id),
  unique (game_id, seat_index)
);

create table if not exists hands (
  game_id uuid not null references games (id) on delete cascade,
  user_id uuid not null references profiles (id),
  cards jsonb not null default '[]'::jsonb,
  primary key (game_id, user_id)
);

create table if not exists task_forces (
  game_id uuid not null references games (id) on delete cascade,
  owner_id uuid not null references profiles (id),
  ships jsonb not null default '[]'::jsonb,
  minefields jsonb not null default '[]'::jsonb,
  smoke_active boolean not null default false,
  deep_six jsonb not null default '[]'::jsonb,
  primary key (game_id, owner_id)
);

create table if not exists destroyer_squadrons (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  owner_id uuid not null references profiles (id),
  card_id text not null,
  hits_taken int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists game_log (
  id bigserial primary key,
  game_id uuid not null references games (id) on delete cascade,
  seat_index int,
  message text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Helper: is the current user seated in this game? (SECURITY DEFINER so it
-- can read game_players without triggering recursive RLS evaluation.)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function is_game_member(p_game_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from game_players
    where game_id = p_game_id and user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- All writes happen through Edge Functions using the service_role key,
-- which bypasses RLS entirely. Clients (anon/authenticated) only ever get
-- SELECT policies below - there are intentionally no insert/update/delete
-- policies for the client roles.
-- ─────────────────────────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table games enable row level security;
alter table game_players enable row level security;
alter table hands enable row level security;
alter table task_forces enable row level security;
alter table destroyer_squadrons enable row level security;
alter table game_log enable row level security;

create policy "profiles readable by any signed-in user" on profiles
  for select to authenticated using (true);

create policy "profiles editable by owner" on profiles
  for insert to authenticated with check (id = auth.uid());

create policy "profiles updatable by owner" on profiles
  for update to authenticated using (id = auth.uid());

-- Games are discoverable by anyone signed in (invite_token is the real
-- secret; knowing a game's UUID without the token doesn't let you join).
create policy "games readable by signed-in users" on games
  for select to authenticated using (true);

create policy "game_players readable by game members" on game_players
  for select to authenticated using (is_game_member(game_id));

create policy "hands readable by owner only" on hands
  for select to authenticated using (user_id = auth.uid());

create policy "task_forces readable by game members" on task_forces
  for select to authenticated using (is_game_member(game_id));

create policy "destroyer_squadrons readable by game members" on destroyer_squadrons
  for select to authenticated using (is_game_member(game_id));

create policy "game_log readable by game members" on game_log
  for select to authenticated using (is_game_member(game_id));

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime: broadcast row changes on these tables to subscribed clients.
-- ─────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table games;
alter publication supabase_realtime add table game_players;
alter publication supabase_realtime add table hands;
alter publication supabase_realtime add table task_forces;
alter publication supabase_realtime add table destroyer_squadrons;
alter publication supabase_realtime add table game_log;
