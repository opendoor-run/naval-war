-- In-game chat. Paste into the Supabase Dashboard SQL Editor and run once.
--
-- Unlike game state, chat isn't subject to the rules engine, so clients
-- write directly (through RLS) instead of going through an Edge Function.

create table if not exists chat_messages (
  id bigserial primary key,
  game_id uuid not null references games (id) on delete cascade,
  user_id uuid not null references profiles (id),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;

create policy "chat readable by game members" on chat_messages
  for select to authenticated using (is_game_member(game_id));

create policy "chat postable by game members" on chat_messages
  for insert to authenticated with check (is_game_member(game_id) and user_id = auth.uid());

alter publication supabase_realtime add table chat_messages;
