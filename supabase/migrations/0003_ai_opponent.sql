-- AI opponent support: a bot flag on game_players, plus 5 seed bot accounts
-- so bots can be seated in game_players like any other player (that table's
-- user_id has a real FK to profiles -> auth.users).

alter table game_players add column if not exists is_bot boolean not null default false;

-- Seed 5 fixed-id bot accounts (auth.users + profiles). These are never
-- signed into - the game-action edge function acts on their behalf using
-- the service role key, exactly like it does for the seed data below.
do $$
declare
  bot record;
begin
  for bot in
    select * from (values
      ('b0000000-0000-4000-8000-000000000001'::uuid, 'Bot: Halsey'),
      ('b0000000-0000-4000-8000-000000000002'::uuid, 'Bot: Nimitz'),
      ('b0000000-0000-4000-8000-000000000003'::uuid, 'Bot: Yamamoto'),
      ('b0000000-0000-4000-8000-000000000004'::uuid, 'Bot: Doenitz'),
      ('b0000000-0000-4000-8000-000000000005'::uuid, 'Bot: Cunningham')
    ) as t(id, name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', bot.id, 'authenticated', 'authenticated',
      bot.id || '@bots.naval-war.invalid', gen_random_uuid()::text,
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    )
    on conflict (id) do nothing;

    insert into profiles (id, display_name) values (bot.id, bot.name)
    on conflict (id) do nothing;
  end loop;
end $$;
