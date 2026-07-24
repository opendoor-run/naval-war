-- Close the hidden-state leak: the deck/harbor/discard piles and the invite
-- token were readable by every authenticated user (not just players in that
-- game) via the "games readable by signed-in users" `using (true)` policy.
-- Paste this whole file into the Supabase Dashboard SQL Editor and run it once.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. game_secrets: holds the piles. RLS enabled, deliberately NO policies -
--    only the service_role (used by edge functions) can ever read/write it.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists game_secrets (
  game_id uuid primary key references games (id) on delete cascade,
  draw_pile jsonb not null default '[]'::jsonb,
  discard_pile jsonb not null default '[]'::jsonb,
  harbor_pile jsonb not null default '[]'::jsonb
);
alter table game_secrets enable row level security;
revoke select, insert, update, delete on game_secrets from anon, authenticated;

insert into game_secrets (game_id, draw_pile, discard_pile, harbor_pile)
select id, draw_pile, discard_pile, harbor_pile from games
on conflict (game_id) do nothing;

-- New games need a game_secrets row too - a trigger means no edge function
-- can forget to create one.
create or replace function create_game_secrets_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into game_secrets (game_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists games_create_secrets on games;
create trigger games_create_secrets
  after insert on games
  for each row execute function create_game_secrets_row();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. games: replace the piles with public counts, and pending_drawn_card
--    with a public has-a-pending-card flag (the card id itself moves to the
--    drawer's own hands row, below).
-- ─────────────────────────────────────────────────────────────────────────

alter table games
  add column if not exists draw_count int not null default 0,
  add column if not exists discard_count int not null default 0,
  add column if not exists harbor_count int not null default 0,
  add column if not exists has_pending_card boolean not null default false;

update games g
set draw_count = coalesce(jsonb_array_length(g.draw_pile), 0),
    discard_count = coalesce(jsonb_array_length(g.discard_pile), 0),
    harbor_count = coalesce(jsonb_array_length(g.harbor_pile), 0),
    has_pending_card = (g.pending_drawn_card is not null);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. hands: the actual pending card moves here, scoped to its drawer - the
--    existing "hands readable by owner only" policy already protects it.
-- ─────────────────────────────────────────────────────────────────────────

alter table hands add column if not exists pending_card text;

update hands h
set pending_card = g.pending_drawn_card
from games g
where h.game_id = g.id
  and g.pending_drawn_card is not null
  and g.turn_seat is not null
  and h.user_id = (
    select gp.user_id from game_players gp
    where gp.game_id = g.id and gp.seat_index = g.turn_seat
  );

alter table games
  drop column if exists draw_pile,
  drop column if exists discard_pile,
  drop column if exists harbor_pile,
  drop column if exists pending_drawn_card;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. games RLS: members/host only (was: any authenticated user). Widening
--    the invite_token entropy for new games while we're in here - existing
--    tokens are unaffected since this only changes the column default.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "games readable by signed-in users" on games;
drop policy if exists "games readable by members or host" on games;
create policy "games readable by members or host" on games
  for select to authenticated using (is_game_member(id) or host_id = auth.uid());

alter table games alter column invite_token set default encode(gen_random_bytes(16), 'hex');

revoke select on games from authenticated;
grant select (
  id, invite_token, host_id, target_score, max_players, status, current_round,
  dealer_seat, turn_seat, special_phase_seat, version, drawn_this_turn,
  has_pending_card, draw_count, discard_count, harbor_count, created_at
) on games to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. profiles RLS: co-players only (was: any authenticated user could dump
--    every profile). Also make the update policy's WITH CHECK explicit
--    instead of relying on the USING-clause fallback.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "profiles readable by any signed-in user" on profiles;
drop policy if exists "profiles readable by co-players" on profiles;
create policy "profiles readable by co-players" on profiles
  for select to authenticated using (
    id = auth.uid()
    or exists (
      select 1 from game_players gp
      where gp.user_id = profiles.id and is_game_member(gp.game_id)
    )
  );

drop policy if exists "profiles updatable by owner" on profiles;
create policy "profiles updatable by owner" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 6. is_game_member: pin search_path (SECURITY DEFINER + mutable search_path
--    is the classic privilege-escalation shape) and stop PUBLIC from calling
--    it directly.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function is_game_member(p_game_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from game_players
    where game_id = p_game_id and user_id = auth.uid()
  );
$$;

revoke execute on function is_game_member(uuid) from public;
grant execute on function is_game_member(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Defense in depth: RLS is meant to be the only write barrier already
--    ("All writes happen through Edge Functions using the service_role key"),
--    but Supabase's default GRANT ALL to anon/authenticated was never
--    revoked, so RLS was the *only* thing enforcing that. Lock table
--    privileges down to match, leaving exactly the one client write path
--    that actually exists (chat inserts).
-- ─────────────────────────────────────────────────────────────────────────

revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant insert on chat_messages to authenticated;
