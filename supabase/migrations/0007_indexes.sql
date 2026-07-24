-- No migration so far has created a single index beyond primary keys and the unique
-- constraints. Add the ones backing the app's hottest queries. Paste this whole file into
-- the Supabase Dashboard SQL Editor and run it once.

-- game_log: backs a `where game_id = ? order by created_at desc limit 50` query that runs
-- on every realtime resync AND on the client's fallback poll.
create index if not exists game_log_game_created_idx on game_log (game_id, created_at desc);

-- game_players(user_id): backs "which games am I in" on every home-page load - today a
-- seq scan since the PK's leading column is game_id, not user_id.
create index if not exists game_players_user_idx on game_players (user_id);

-- hands/task_forces(owner) and destroyer_squadrons: same shape of gap - filtered by a
-- non-leading-PK column on every context load, and destroyer_squadrons' PK is a synthetic
-- id, so game_id is entirely unindexed there.
create index if not exists hands_user_idx on hands (user_id);
create index if not exists task_forces_owner_idx on task_forces (owner_id);
create index if not exists destroyer_squadrons_game_idx on destroyer_squadrons (game_id);
create index if not exists destroyer_squadrons_owner_idx on destroyer_squadrons (owner_id);

-- chat_messages: filtered/ordered by game_id + created_at on every load, filtered by
-- user_id nowhere hot today but matches the FK for consistency and future moderation queries.
create index if not exists chat_messages_game_idx on chat_messages (game_id, created_at);
create index if not exists chat_messages_user_idx on chat_messages (user_id);

-- games(host_id): backs "games I host" checks and delete-game's ownership lookup pattern.
create index if not exists games_host_idx on games (host_id);
