-- Belt-and-braces DB constraints matching invariants the app already enforces in TS, so a
-- direct write (or a future bug in the edge-function validation) can't produce nonsensical
-- data. Paste this whole file into the Supabase Dashboard SQL Editor and run it once.

-- ─────────────────────────────────────────────────────────────────────────
-- display_name: unbounded today - a huge name gets rendered into every other
-- player's TurnTracker/ScorePanel/chat. Truncate any existing outliers first
-- so the constraint doesn't fail on old data.
-- ─────────────────────────────────────────────────────────────────────────

update profiles set display_name = left(display_name, 32) where char_length(display_name) > 32;
alter table profiles drop constraint if exists profiles_display_name_length;
alter table profiles add constraint profiles_display_name_length check (char_length(display_name) between 1 and 32);

update game_players set display_name = left(display_name, 32) where char_length(display_name) > 32;
alter table game_players drop constraint if exists game_players_display_name_length;
alter table game_players add constraint game_players_display_name_length check (char_length(display_name) between 1 and 32);

-- ─────────────────────────────────────────────────────────────────────────
-- games: bounds already enforced in create-game's TS validation - mirror
-- them at the DB level.
-- ─────────────────────────────────────────────────────────────────────────

alter table games drop constraint if exists games_max_players_range;
alter table games add constraint games_max_players_range check (max_players between 3 and 9);

alter table games drop constraint if exists games_target_score_range;
alter table games add constraint games_target_score_range check (target_score between 10 and 100000);

-- ─────────────────────────────────────────────────────────────────────────
-- game_players / destroyer_squadrons: simple non-negativity invariants.
-- ─────────────────────────────────────────────────────────────────────────

alter table game_players drop constraint if exists game_players_seat_index_nonneg;
alter table game_players add constraint game_players_seat_index_nonneg check (seat_index >= 0);

alter table destroyer_squadrons drop constraint if exists destroyer_squadrons_hits_nonneg;
alter table destroyer_squadrons add constraint destroyer_squadrons_hits_nonneg check (hits_taken >= 0);

-- ─────────────────────────────────────────────────────────────────────────
-- jsonb columns the app always treats as arrays - guard against a stray
-- object/scalar ever being written to one.
-- ─────────────────────────────────────────────────────────────────────────

alter table hands drop constraint if exists hands_cards_is_array;
alter table hands add constraint hands_cards_is_array check (jsonb_typeof(cards) = 'array');

alter table task_forces drop constraint if exists task_forces_ships_is_array;
alter table task_forces add constraint task_forces_ships_is_array check (jsonb_typeof(ships) = 'array');
alter table task_forces drop constraint if exists task_forces_minefields_is_array;
alter table task_forces add constraint task_forces_minefields_is_array check (jsonb_typeof(minefields) = 'array');
alter table task_forces drop constraint if exists task_forces_deep_six_is_array;
alter table task_forces add constraint task_forces_deep_six_is_array check (jsonb_typeof(deep_six) = 'array');

alter table game_secrets drop constraint if exists game_secrets_draw_pile_is_array;
alter table game_secrets add constraint game_secrets_draw_pile_is_array check (jsonb_typeof(draw_pile) = 'array');
alter table game_secrets drop constraint if exists game_secrets_discard_pile_is_array;
alter table game_secrets add constraint game_secrets_discard_pile_is_array check (jsonb_typeof(discard_pile) = 'array');
alter table game_secrets drop constraint if exists game_secrets_harbor_pile_is_array;
alter table game_secrets add constraint game_secrets_harbor_pile_is_array check (jsonb_typeof(harbor_pile) = 'array');
