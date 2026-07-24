-- Assorted hygiene fixes from the Phase 5 audit pass. Paste this whole file into the
-- Supabase Dashboard SQL Editor and run it once.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. User deletion was impossible: six FKs to profiles used the default
-- NO ACTION, so deleting an auth.users row (which cascades to profiles) failed
-- with an FK violation for anyone who had ever played. Postgres requires
-- dropping and re-adding a constraint to change its ON DELETE behavior, and
-- since 0001_init.sql declared these inline (not with an explicit constraint
-- name), we look up whatever Postgres actually auto-named them rather than
-- guess - guessing wrong would silently leave the old blocking constraint in
-- place alongside a new one that does nothing.
--
-- Per-game rows cascade (deleting a player's account cleans up everywhere
-- they played); chat history is kept but anonymized (user_id set null).
-- ─────────────────────────────────────────────────────────────────────────

create or replace function drop_single_column_fk(p_table regclass, p_column name) returns void
language plpgsql
as $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    where con.conrelid = p_table
      and con.contype = 'f'
      and con.conkey = array(
        select attnum from pg_attribute
        where attrelid = p_table and attname = p_column
      )
  loop
    execute format('alter table %s drop constraint %I', p_table::text, r.conname);
  end loop;
end;
$$;

select drop_single_column_fk('games', 'host_id');
select drop_single_column_fk('game_players', 'user_id');
select drop_single_column_fk('hands', 'user_id');
select drop_single_column_fk('task_forces', 'owner_id');
select drop_single_column_fk('destroyer_squadrons', 'owner_id');
select drop_single_column_fk('chat_messages', 'user_id');

drop function drop_single_column_fk(regclass, name);

alter table games add constraint games_host_id_fkey
  foreign key (host_id) references profiles (id) on delete cascade;

alter table game_players add constraint game_players_user_id_fkey
  foreign key (user_id) references profiles (id) on delete cascade;

alter table hands add constraint hands_user_id_fkey
  foreign key (user_id) references profiles (id) on delete cascade;

alter table task_forces add constraint task_forces_owner_id_fkey
  foreign key (owner_id) references profiles (id) on delete cascade;

alter table destroyer_squadrons add constraint destroyer_squadrons_owner_id_fkey
  foreign key (owner_id) references profiles (id) on delete cascade;

alter table chat_messages alter column user_id drop not null;
alter table chat_messages add constraint chat_messages_user_id_fkey
  foreign key (user_id) references profiles (id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. chat_messages.created_at was a plain column default, not enforced -
-- a client could insert a message with an arbitrary created_at and
-- backdate/reorder itself in everyone else's view.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function force_chat_created_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists chat_messages_force_created_at on chat_messages;
create trigger chat_messages_force_created_at
  before insert on chat_messages
  for each row execute function force_chat_created_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. destroyer_squadrons integrity: no link back to the owner's task force
-- and no uniqueness guarantee, so orphans and duplicates were both possible.
-- task_forces' primary key is (game_id, owner_id), so it's already unique
-- and can be referenced by a composite FK.
-- ─────────────────────────────────────────────────────────────────────────

alter table destroyer_squadrons drop constraint if exists destroyer_squadrons_owner_task_force_fkey;
alter table destroyer_squadrons add constraint destroyer_squadrons_owner_task_force_fkey
  foreign key (game_id, owner_id) references task_forces (game_id, owner_id) on delete cascade;

alter table destroyer_squadrons drop constraint if exists destroyer_squadrons_unique_per_owner_card;
alter table destroyer_squadrons add constraint destroyer_squadrons_unique_per_owner_card
  unique (game_id, owner_id, card_id);
